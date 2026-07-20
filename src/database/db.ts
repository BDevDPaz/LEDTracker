import * as SQLite from 'expo-sqlite';
import dayjs from '../utils/dayjsSetup';
import { validateSession } from "../utils/payrollUtils";
import { WorkSession, AppSettings, SessionStatus } from '../types';
import {
  log,
  logAudit,
  AUDIT_ACTIONS,
  CheckoutAuditAction,
  isOfficialCheckoutAuditAction,
} from '../utils/logger';

const DB_NAME = 'wtracker_v1.db';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbReady = false;

const nowMs = (): number => dayjs().valueOf();

const DB_OFFICIAL_CHECKOUT_AUDIT_ACTIONS: readonly CheckoutAuditAction[] = [
  AUDIT_ACTIONS.MANUAL_CHECKOUT,
  AUDIT_ACTIONS.AUTO_CHECKOUT_GPS,
  AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE,
];

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

function assertCheckoutAuditAction(
  action: CheckoutAuditAction | undefined,
  operation: string
): CheckoutAuditAction {
  const isKnownOfficialAction =
    isOfficialCheckoutAuditAction(action) &&
    DB_OFFICIAL_CHECKOUT_AUDIT_ACTIONS.includes(action);

  if (!isKnownOfficialAction) {
    throw new Error(
      `${operation} requires an explicit official checkout audit action`
    );
  }

  return action;
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
        action_type TEXT NOT NULL,
        details TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        timestamp_str TEXT NOT NULL,
        color TEXT,
        categoria TEXT,
        severidad TEXT,
        mensaje TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS location_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        timestamp INTEGER NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        distance_to_target REAL,
        event_source TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        decision TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_by_date ON work_sessions(date_string, status);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON work_sessions(status) WHERE status IN ("active", "pending_arrival");
      CREATE INDEX IF NOT EXISTS idx_audit_logs_by_session ON audit_logs(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_by_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_system_logs_by_time ON system_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_location_evidence_session_time ON location_evidence(session_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_location_evidence_signal_time ON location_evidence(signal_type, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_location_evidence_created_at ON location_evidence(created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session ON work_sessions(date_string, status) WHERE status IN ("pending_arrival", "active");

      -- ⚡ Bolt Optimization: Add index for frequent sorting by start_time DESC
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON work_sessions(start_time DESC);

      INSERT OR IGNORE INTO settings (id, employee_name, employer_name, company_email, language)
      VALUES (1, 'Alex León', 'WTracker Corp', 'nomina@wtracker.app', 'es');
    `);

    db = database;
    dbReady = true;
    return database;
  })();

  return initPromise;
}

export async function ensureDbReady(): Promise<SQLite.SQLiteDatabase> {
  if (dbReady && db) return db;
  return await initDatabase();
}

export const insertWorkSession = async (session: WorkSession) => {
  const error = validateSession(
    session.start_time,
    session.end_time || null,
    session.lunch_start,
    session.lunch_end
  );

  if (error) throw new Error(error);

  await runInTransaction(async (database) => {
    const result = await database.runAsync(
      `INSERT INTO work_sessions (
        start_time, status, latitude, longitude,
        target_latitude, target_longitude, setup_latitude, setup_longitude,
        address, client_name, location_confirmed, is_manual_edit,
        manual_note, lunch_taken, date_string
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.start_time,
        session.status,
        session.latitude,
        session.longitude,
        session.target_latitude || null,
        session.target_longitude || null,
        session.setup_latitude || null,
        session.setup_longitude || null,
        session.address,
        session.client_name || null,
        session.location_confirmed,
        session.is_manual_edit,
        session.manual_note || null,
        session.lunch_taken,
        session.date_string
      ]
    );

    await logAudit({
      session_id: result.lastInsertRowId,
      action_type: AUDIT_ACTIONS.MANUAL,
      details: `Session created for address: ${session.address}`,
      timestamp: nowMs()
    });
  });
};

export const updateSessionEndTime = async (
  id: number,
  endTime: number,
  checkoutAction: CheckoutAuditAction
) => {
  const resolvedCheckoutAction = assertCheckoutAuditAction(
    checkoutAction,
    'updateSessionEndTime'
  );

  await runInTransaction(async (database) => {
    await database.runAsync(
      "UPDATE work_sessions SET end_time = ?, status = 'completed' WHERE id = ?",
      [endTime, id]
    );

    await logAudit({
      session_id: id,
      action_type: resolvedCheckoutAction,
      details: `Session ended at ${endTime}`,
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
  const error = validateSession(startTime, endTime, null, null); // Lunch validation could be added if passed
  if (error) throw new Error(error);

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

  // Unified logic for duration calculation in SQL to match JS payrollUtils
  const result = await database.getFirstAsync<{ total_ms: number }>(
    `SELECT SUM(
        MAX(0,
          (COALESCE(end_time, ?) / 60000) - (COALESCE(actual_start_time, start_time) / 60000) -
          CASE
            WHEN lunch_taken = 1 AND lunch_start IS NOT NULL AND lunch_end IS NOT NULL
              THEN (lunch_end - lunch_start) / 60000
            WHEN lunch_taken = 1 AND ((COALESCE(end_time, ?) - COALESCE(actual_start_time, start_time)) / 60000) > 360
              THEN 60
            ELSE 0
          END
        )
      ) * 60000 AS total_ms
     FROM work_sessions
     WHERE status NOT IN ('deleted', 'pending_arrival')
       AND start_time >= ?`,
    [referenceNow, referenceNow, sinceTs]
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

export const getHistory = async (): Promise<WorkSession[]> => {
  const database = await ensureDbReady();
  return await database.getAllAsync<WorkSession>(
    `SELECT * FROM work_sessions
     WHERE status != 'deleted'
     ORDER BY start_time DESC`
  );
};

export const getDailyCompletedSessions = async (
  dateString: string
): Promise<WorkSession[]> => {
  const database = await ensureDbReady();
  return await database.getAllAsync<WorkSession>(
    `SELECT * FROM work_sessions
     WHERE date_string = ? AND status = 'completed'
     ORDER BY start_time DESC`,
    [dateString]
  );
};

export const updateSessionStatus = async (
  id: number,
  status: SessionStatus,
  lunchMinutes: number = 0,
  checkoutAction?: CheckoutAuditAction
) => {
  const endTime = nowMs();

  await runInTransaction(async (database) => {
    let auditAction: string = AUDIT_ACTIONS.MANUAL;

    if (status === 'completed') {
      const resolvedCheckoutAction = assertCheckoutAuditAction(
        checkoutAction,
        'updateSessionStatus(completed)'
      );

      auditAction = resolvedCheckoutAction;

      let lunchStart = null;
      let lunchEnd = null;
      let lunchTaken = 0;

      if (lunchMinutes > 0) {
        lunchTaken = 1;
        lunchEnd = endTime;
        lunchStart = endTime - lunchMinutes * 60000;
      }

      await database.runAsync(
        `UPDATE work_sessions
         SET end_time = ?, status = ?, lunch_taken = ?, lunch_start = ?, lunch_end = ?
         WHERE id = ?`,
        [endTime, status, lunchTaken, lunchStart, lunchEnd, id]
      );
    } else {
      await database.runAsync(
        `UPDATE work_sessions
         SET status = ?
         WHERE id = ?`,
        [status, id]
      );
    }

    const lunchDetails = lunchMinutes > 0 ? ` con ${lunchMinutes}m de almuerzo` : "";

    await logAudit({
      session_id: id,
      action_type: auditAction,
      details: `Estado de la sesión actualizado a ${status}${lunchDetails}`,
      timestamp: nowMs()
    });
  });
};

export const getActiveSession = getOpenSession;
export const saveSession = insertWorkSession;
