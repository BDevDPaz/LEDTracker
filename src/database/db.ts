// --- src/database/db.ts ---
import * as SQLite from 'expo-sqlite';
import dayjs from '../utils/dayjsSetup';
import { WorkSession, AppSettings } from '../types';
import { log, logAudit, setLoggerDB, AUDIT_ACTIONS } from '../utils/logger';

const DB_NAME = 'ledtracker_v2.db';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbReady = false;

const nowMs = (): number => dayjs().valueOf();

async function openDbOnce(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  return db;
}

async function configureDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const walResult = await database.getFirstAsync<{ journal_mode?: string }>(
    'PRAGMA journal_mode = WAL'
  );

  await database.execAsync(`
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);

  log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 'PRAGMAs SQLite configurados', {
    journal_mode: walResult?.journal_mode ?? 'unknown',
    synchronous: 'NORMAL',
    foreign_keys: 'ON'
  });
}

async function runInTransaction<T>(
  work: (database: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const database = await ensureDbReady();

  try {
    await database.execAsync('BEGIN IMMEDIATE TRANSACTION');
    const result = await work(database);
    await database.execAsync('COMMIT');
    return result;
  } catch (error) {
    try {
      await database.execAsync('ROLLBACK');
    } catch {
      // rollback secundario ignorado
    }
    throw error;
  }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbReady && db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await openDbOnce();

    await configureDatabase(database);

    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        actual_start_time INTEGER,
        end_time INTEGER,
        status TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        target_latitude REAL,
        target_longitude REAL,
        setup_latitude REAL,
        setup_longitude REAL,
        address TEXT,
        client_name TEXT,
        location_confirmed INTEGER DEFAULT 0,
        is_manual_edit INTEGER DEFAULT 0,
        manual_note TEXT,
        lunch_taken INTEGER DEFAULT 0,
        lunch_start INTEGER,
        lunch_end INTEGER,
        date_string TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY NOT NULL,
        employee_name TEXT,
        employer_name TEXT,
        company_email TEXT,
        tolerance_radius INTEGER DEFAULT 200,
        hourly_rate REAL DEFAULT 0,
        language TEXT DEFAULT 'es',
        start_time TEXT DEFAULT '08:00',
        overtime_multiplier REAL DEFAULT 1.5
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        action_type TEXT,
        details TEXT,
        timestamp INTEGER
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        timestamp_str TEXT,
        color TEXT,
        categoria TEXT,
        severidad TEXT,
        mensaje TEXT,
        metadata TEXT
      );
    `);

    setLoggerDB(database);

    const result = await database.runAsync(
      `INSERT OR IGNORE INTO settings (
        id, employee_name, employer_name, company_email,
        tolerance_radius, hourly_rate, language, start_time, overtime_multiplier
      ) VALUES (1, 'Empleado Nuevo', 'LEON''S ELECTRICAL DESIGN', '', 200, 25.0, 'es', '07:00', 1.5)`
    );

    if (result.changes > 0) {
      log(
        'VERDE',
        'OPERACION_EXITOSA',
        'INFO',
        'Base de datos nueva: creando configuración por defecto...'
      );
    }

    dbReady = true;
    log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 'DB inicializada de forma segura');

    return database;
  })();

  try {
    return await initPromise;
  } finally {
    if (!dbReady) {
      initPromise = null;
    }
  }
}

export async function ensureDbReady(): Promise<SQLite.SQLiteDatabase> {
  if (!dbReady || !db) return initDatabase();
  return db;
}

export function isDatabaseReady(): boolean {
  return dbReady;
}

export function getDB(): SQLite.SQLiteDatabase {
  if (!dbReady || !db) {
    throw new Error('Base de datos no inicializada. Usa ensureDbReady() primero.');
  }
  return db;
}

// --------------------------------------------------
// CRUD / helpers exportados
// --------------------------------------------------

export const insertWorkSession = async (session: WorkSession) => {
  try {
    const lastInsertRowId = await runInTransaction(async (database) => {
      const result = await database.runAsync(
        `INSERT INTO work_sessions (
          start_time, status, latitude, longitude,
          target_latitude, target_longitude,
          setup_latitude, setup_longitude,
          address, client_name, manual_note,
          location_confirmed, is_manual_edit, lunch_taken, date_string
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.start_time,
          session.status,
          session.latitude,
          session.longitude,
          session.target_latitude || 0,
          session.target_longitude || 0,
          session.setup_latitude || 0,
          session.setup_longitude || 0,
          session.address,
          session.client_name || '',
          session.manual_note || '',
          session.location_confirmed,
          session.is_manual_edit,
          session.lunch_taken,
          session.date_string
        ]
      );

      const sessionId = Number(result.lastInsertRowId);

      await logAudit({
        session_id: sessionId,
        action_type: AUDIT_ACTIONS.MANUAL,
        details: 'Work session created',
        timestamp: nowMs()
      });

      return result.lastInsertRowId;
    });

    return lastInsertRowId;
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error inserting session', error);
    throw error;
  }
};

export const updateSessionEndTime = async (id: number, endTime: number) => {
  await runInTransaction(async (database) => {
    await database.runAsync(
      `UPDATE work_sessions
       SET end_time = ?, status = 'completed'
       WHERE id = ?`,
      [endTime, id]
    );

    await logAudit({
      session_id: id,
      action_type: AUDIT_ACTIONS.AUTO_CHECKOUT,
      details: `Session closed with end_time=${endTime}`,
      timestamp: nowMs()
    });
  });
};

export const updateSessionLunch = async (id: number, start: number, end: number) => {
  await runInTransaction(async (database) => {
    await database.runAsync(
      `UPDATE work_sessions
       SET lunch_taken = 1, lunch_start = ?, lunch_end = ?
       WHERE id = ?`,
      [start, end, id]
    );

    await logAudit({
      session_id: id,
      action_type: AUDIT_ACTIONS.MANUAL,
      details: `Lunch updated: start=${start}, end=${end}`,
      timestamp: nowMs()
    });
  });
};

export const getSettings = async (): Promise<AppSettings | null> => {
  const database = await ensureDbReady();
  return await database.getFirstAsync<AppSettings>(
    'SELECT * FROM settings WHERE id = 1'
  );
};

export const saveSettings = async (settings: AppSettings) => {
  await runInTransaction(async (database) => {
    await database.runAsync(
      `INSERT OR REPLACE INTO settings (
        id, employee_name, employer_name, company_email,
        tolerance_radius, hourly_rate, language, start_time, overtime_multiplier
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settings.employee_name,
        settings.employer_name,
        settings.company_email,
        settings.tolerance_radius,
        settings.hourly_rate,
        settings.language,
        settings.start_time,
        settings.overtime_multiplier
      ]
    );

    await logAudit({
      session_id: null,
      action_type: AUDIT_ACTIONS.MANUAL,
      details: 'Settings updated',
      timestamp: nowMs()
    });
  });
};

export const deleteWorkSession = async (id: number) => {
  await runInTransaction(async (database) => {
    await database.runAsync(
      `UPDATE work_sessions
       SET status = 'deleted'
       WHERE id = ?`,
      [id]
    );

    await logAudit({
      session_id: id,
      action_type: AUDIT_ACTIONS.MANUAL,
      details: 'Work session soft-deleted',
      timestamp: nowMs()
    });
  });
};

export const updateWorkSessionManual = async (
  id: number,
  startTime: number,
  endTime: number | null,
  note: string
) => {
  await runInTransaction(async (database) => {
    await database.runAsync(
      `UPDATE work_sessions
       SET start_time = ?, end_time = ?, manual_note = ?, is_manual_edit = 1
       WHERE id = ?`,
      [startTime, endTime, note, id]
    );

    await logAudit({
      session_id: id,
      action_type: AUDIT_ACTIONS.MANUAL,
      details: `Manual session update: start=${startTime}, end=${endTime}, note=${note}`,
      timestamp: nowMs()
    });
  });
};

export const checkSessionOverlap = async (
  start: number,
  end: number,
  excludeId: number
): Promise<boolean> => {
  const database = await ensureDbReady();

  const effectiveEnd = end || Number.MAX_SAFE_INTEGER;

  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM work_sessions
     WHERE id != ?
       AND status != 'deleted'
       AND COALESCE(end_time, ?) > ?
       AND start_time < ?`,
    [excludeId, Number.MAX_SAFE_INTEGER, start, effectiveEnd]
  );

  return (result?.count ?? 0) > 0;
};

export const insertAuditLog = async (
  sessionId: number,
  action: string,
  details: string
) => {
  await logAudit({
    session_id: sessionId,
    action_type: action,
    details,
    timestamp: nowMs()
  });
};

export const getTotalDurationMs = async (
  sinceTs: number,
  referenceNow: number
): Promise<number> => {
  const database = await ensureDbReady();

  const result = await database.getFirstAsync<{ total_ms: number }>(
    `SELECT SUM(
        MAX(
          0,
          COALESCE(end_time, ?) - COALESCE(actual_start_time, start_time) -
          (CASE
            WHEN lunch_taken = 1 AND lunch_start IS NOT NULL AND lunch_end IS NOT NULL
            THEN (lunch_end - lunch_start)
            WHEN lunch_taken = 1
            THEN 3600000
            ELSE 0
          END)
        )
      ) as total_ms
     FROM work_sessions
     WHERE status NOT IN ('deleted', 'pending_arrival')
       AND start_time >= ?`,
    [referenceNow, sinceTs]
  );

  return result?.total_ms || 0;
};

export const getWeeklyStats = async (
  mondayTs: number,
  nowTs: number
): Promise<number> => {
  return getTotalDurationMs(mondayTs, nowTs);
};

export const getAllAsync = async <T>(
  query: string,
  params: any[] = []
): Promise<T[]> => {
  const database = await ensureDbReady();
  return await database.getAllAsync<T>(query, params);
};

export const getFirstAsync = async <T>(
  query: string,
  params: any[] = []
): Promise<T | null> => {
  const database = await ensureDbReady();
  return await database.getFirstAsync<T>(query, params);
};

// aliases usados por auditoría / otras capas
export const createSession = insertWorkSession;
export const closeSession = updateSessionEndTime;
export const deleteSession = deleteWorkSession;

export const getOpenSession = async (): Promise<WorkSession | null> => {
  const database = await ensureDbReady();
  return await database.getFirstAsync<WorkSession>(
    `SELECT * FROM work_sessions
     WHERE status NOT IN ('completed', 'deleted')
     ORDER BY start_time DESC
     LIMIT 1`
  );
};

