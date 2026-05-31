// --- src/database/db.ts ---
import * as SQLite from 'expo-sqlite';
import {
  WorkSession,
  AppSettings
} from '../types';
import { log, setLoggerDB } from '../utils/logger';

const DB_NAME = 'ledtracker_v2.db';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbReady = false;

async function openDbOnce(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  return db;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbReady && db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await openDbOnce();

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
        id, employee_name, employer_name, company_email, tolerance_radius, hourly_rate, language, start_time, overtime_multiplier
      ) VALUES (1, 'Empleado Nuevo', 'LEON''S ELECTRICAL DESIGN', '', 200, 25.0, 'es', '07:00', 1.5)`
    );

    if (result.changes > 0) {
      log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Base de datos nueva: Creando configuración por defecto...');
    }

    dbReady = true;

    log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 'DB Inicializada de forma segura');

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

export const insertWorkSession = async (session: WorkSession) => {
  const database = await ensureDbReady();
  try {
    const result = await database.runAsync(
      `INSERT INTO work_sessions (
        start_time, status, latitude, longitude, target_latitude, target_longitude, setup_latitude, setup_longitude, address, client_name, manual_note, location_confirmed, is_manual_edit, lunch_taken, date_string
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.start_time, session.status, session.latitude, session.longitude, session.target_latitude || 0, session.target_longitude || 0, session.setup_latitude || 0, session.setup_longitude || 0, session.address, session.client_name || '', session.manual_note || '', session.location_confirmed, session.is_manual_edit, session.lunch_taken, session.date_string,
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error inserting session', error);
    throw error;
  }
};

export const updateSessionEndTime = async (id: number, endTime: number) => {
  const database = await ensureDbReady();
  await database.runAsync(
    "UPDATE work_sessions SET end_time = ?, status = 'completed' WHERE id = ?",
    [endTime, id]
  );
};

export const updateSessionLunch = async (id: number, start: number, end: number) => {
  const database = await ensureDbReady();
  await database.runAsync(
    'UPDATE work_sessions SET lunch_taken = 1, lunch_start = ?, lunch_end = ? WHERE id = ?',
    [start, end, id]
  );
};

export const getSettings = async (): Promise<AppSettings | null> => {
  const database = await ensureDbReady();
  return await database.getFirstAsync<AppSettings>('SELECT * FROM settings WHERE id = 1');
};

export const saveSettings = async (settings: AppSettings) => {
  const database = await ensureDbReady();
  await database.runAsync(
    `INSERT OR REPLACE INTO settings (
      id, employee_name, employer_name, company_email, tolerance_radius, hourly_rate, language, start_time, overtime_multiplier
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settings.employee_name, settings.employer_name, settings.company_email, settings.tolerance_radius, settings.hourly_rate, settings.language, settings.start_time, settings.overtime_multiplier,
    ]
  );
};

export const deleteWorkSession = async (id: number) => {
  const database = await ensureDbReady();
  await database.runAsync("UPDATE work_sessions SET status = 'deleted' WHERE id = ?", [id]);
};

export const updateWorkSessionManual = async (id: number, startTime: number, endTime: number | null, note: string) => {
  const database = await ensureDbReady();
  await database.runAsync(
    'UPDATE work_sessions SET start_time = ?, end_time = ?, manual_note = ?, is_manual_edit = 1 WHERE id = ?',
    [startTime, endTime, note, id]
  );
};

export const checkSessionOverlap = async (_start: number, _end: number, _excludeId: number): Promise<boolean> => {
  return false;
};

export const insertAuditLog = async (sessionId: number, action: string, details: string) => {
  const database = await ensureDbReady();
  await database.runAsync(
    'INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)',
    [sessionId, action, details, Date.now()]
  );
};

export const getWeeklyStats = async (mondayTs: number, nowTs: number): Promise<number> => {
  const database = await ensureDbReady();
  const result = await database.getFirstAsync<{ total_ms: number }>(
    `SELECT SUM(MAX(0, COALESCE(end_time, ?) - start_time - (CASE WHEN lunch_taken = 1 THEN 3600000 ELSE 0 END))) as total_ms
     FROM work_sessions
     WHERE status != 'deleted' AND start_time >= ?`,
    [nowTs, mondayTs]
  );
  return result?.total_ms || 0;
};

export const getAllAsync = async <T>(query: string, params: any[] = []): Promise<T[]> => {
  const database = await ensureDbReady();
  return await database.getAllAsync(query, params);
};

export const getFirstAsync = async <T>(query: string, params: any[] = []): Promise<T | null> => {
  const database = await ensureDbReady();
  return await database.getFirstAsync(query, params);
};

