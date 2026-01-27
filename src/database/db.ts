// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import { AppSettings, WorkSession, AuditLog } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = () => {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('worktracker.db');
  }
  return dbInstance;
};

export const initDatabase = async () => {
  const db = getDB();
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY NOT NULL,
        employee_name TEXT,
        employer_name TEXT NOT NULL,
        company_email TEXT DEFAULT 'bdpaz_developer@outlook.com',
        tolerance_radius INTEGER DEFAULT 50,
        hourly_rate REAL DEFAULT 0,
        language TEXT DEFAULT 'es',
        start_time TEXT DEFAULT '06:00',
        overtime_multiplier REAL DEFAULT 1.5
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        address TEXT,
        location_confirmed INTEGER DEFAULT 0,
        is_manual_edit INTEGER DEFAULT 0,
        manual_note TEXT,
        lunch_taken INTEGER DEFAULT 0,
        lunch_start INTEGER,
        lunch_end INTEGER,
        date_string TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        action_type TEXT,
        details TEXT,
        timestamp INTEGER
      );
    `);

    const migrations = [
      "ALTER TABLE settings ADD COLUMN company_email TEXT DEFAULT 'bdpaz_developer@outlook.com';",
      "ALTER TABLE settings ADD COLUMN tolerance_radius INTEGER DEFAULT 50;",
      "ALTER TABLE work_sessions ADD COLUMN lunch_taken INTEGER DEFAULT 0;",
      "ALTER TABLE settings ADD COLUMN start_time TEXT DEFAULT '06:00';",
      "ALTER TABLE settings ADD COLUMN overtime_multiplier REAL DEFAULT 1.5;",
      "ALTER TABLE work_sessions ADD COLUMN lunch_start INTEGER;",
      "ALTER TABLE work_sessions ADD COLUMN lunch_end INTEGER;"
    ];

    for (const query of migrations) {
      try { await db.runAsync(query); } catch (_) { /* Ignorar si ya existe */ }
    }

    const check = await db.getFirstAsync('SELECT * FROM settings WHERE id = 1');
    if (!check) {
      await db.runAsync(
        `INSERT INTO settings (id, employer_name, company_email, tolerance_radius, hourly_rate, language, start_time, overtime_multiplier)
         VALUES (1, 'LEON''S ELECTRICAL DESIGN', 'bdpaz_developer@outlook.com', 50, 0, 'es', '06:00', 1.5)`
      );
    }
    console.log("✅ DB Inicializada Correctamente");
  } catch (error) {
    console.error("❌ Error FATAL en initDatabase:", error);
    throw error;
  }
};

// --- HELPERS ---

export const getSettings = async (): Promise<AppSettings | null> => {
  const db = getDB();
  return await db.getFirstAsync<AppSettings>('SELECT * FROM settings WHERE id = 1');
};

export const insertWorkSession = async (session: WorkSession) => {
  const db = getDB();
  
  // ✅ MEJORA: Generación de fecha Local (No UTC) para evitar error de zona horaria
  let dateStr = session.date_string;
  if (!dateStr) {
      const localDate = new Date(session.start_time);
      dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  }

  // Buscar sesiones huérfanas
  const activeSession = await db.getFirstAsync<WorkSession>(
    "SELECT * FROM work_sessions WHERE (status = 'active' OR status = 'travel') AND end_time IS NULL"
  );

  if (activeSession) {
    const now = Date.now();
    const durationHours = (now - activeSession.start_time) / (1000 * 60 * 60);

    if (durationHours > 12) {
      const maxEndTime = activeSession.start_time + (12 * 60 * 60 * 1000);
      await db.runAsync(
        `UPDATE work_sessions 
         SET end_time = ?, status = 'completed', 
             manual_note = manual_note || ' [AUTO-CERRADO: >12h - Verificar]', 
             is_manual_edit = 1 
         WHERE id = ?`,
        [maxEndTime, activeSession.id]
      );
    } else {
      await db.runAsync(
        "UPDATE work_sessions SET end_time = ?, status = 'completed' WHERE id = ?",
        [now, activeSession.id]
      );
    }
  }

  const res = await db.runAsync(
    `INSERT INTO work_sessions (
      start_time, status, latitude, longitude, address,
      location_confirmed, is_manual_edit, manual_note, lunch_taken, date_string
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.start_time, session.status, session.latitude, session.longitude, session.address,
      session.location_confirmed, session.is_manual_edit, session.manual_note || '',
      session.lunch_taken, dateStr // Usamos la fecha local
    ]
  );

  if (res.lastInsertRowId) {
    await insertAuditLog(res.lastInsertRowId, 'CREATED', session.address);
  }
  return res;
};

const insertAuditLog = async (sessionId: number, action: string, details: string) => {
  const db = getDB();
  await db.runAsync(
    "INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)",
    [sessionId, action, details, Date.now()]
  );
};

export const updateSessionEndTime = async (id: number, end_time: number) => {
  const db = getDB();
  await db.runAsync(
    "UPDATE work_sessions SET end_time = ?, status = 'completed' WHERE id = ?",
    [end_time, id]
  );
  await insertAuditLog(id, 'CLOCK_OUT', 'Normal Exit');
};

export const updateSessionLunch = async (id: number, start: number, end: number) => {
  const db = getDB();
  await db.runAsync(
    "UPDATE work_sessions SET lunch_taken = 1, lunch_start = ?, lunch_end = ? WHERE id = ?",
    [start, end, id]
  );
};

export const checkSessionOverlap = async (startTime: number, endTime: number, excludeId?: number): Promise<boolean> => {
  const db = getDB();
  const effectiveEnd = endTime || Date.now() + 86400000; 

  const res = await db.getFirstAsync<{count: number}>(
    `SELECT COUNT(*) as count FROM work_sessions 
     WHERE status != 'deleted' 
     AND id != ? 
     AND start_time < ? 
     AND (end_time IS NULL OR end_time > ?)`,
    [excludeId || -1, effectiveEnd, startTime]
  );
  return (res?.count || 0) > 0;
};

export const deleteWorkSession = async (id: number) => {
  const db = getDB();
  await db.runAsync("UPDATE work_sessions SET status = 'deleted' WHERE id = ?", [id]);
  await insertAuditLog(id, 'DELETED', 'Session deleted by user');
};

export const updateWorkSessionManual = async (id: number, startTime: number, endTime: number | null, note: string) => {
  const db = getDB();
  await db.runAsync(
    `UPDATE work_sessions 
     SET start_time = ?, end_time = ?, manual_note = ?, is_manual_edit = 1 
     WHERE id = ?`,
    [startTime, endTime, note, id]
  );
  await insertAuditLog(id, 'MODIFIED', note || 'Manual Edit');
};
