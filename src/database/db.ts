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

    // ✅ Tabla de configuración (con nuevas columnas)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY NOT NULL,
        employee_name TEXT,
        employer_name TEXT NOT NULL,
        company_email TEXT DEFAULT 'bdpaz_developer@outlook.com',
        tolerance_radius INTEGER DEFAULT 50,
        hourly_rate REAL DEFAULT 0,
        language TEXT DEFAULT 'es',
        start_time TEXT DEFAULT '06:00',            -- ⏰ Nueva columna
        overtime_multiplier REAL DEFAULT 1.5        -- 💰 Nueva columna
      );
    `);

    // ✅ Tabla de sesiones (incluye lunch_taken)
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
        date_string TEXT NOT NULL
      );
    `);

    // ✅ Tabla de auditoría
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        action_type TEXT,
        details TEXT,
        timestamp INTEGER
      );
    `);

    // ✅ Migraciones para DB existente
    const migrations = [
      "ALTER TABLE settings ADD COLUMN company_email TEXT DEFAULT 'bdpaz_developer@outlook.com';",
      "ALTER TABLE settings ADD COLUMN tolerance_radius INTEGER DEFAULT 50;",
      "ALTER TABLE work_sessions ADD COLUMN lunch_taken INTEGER DEFAULT 0;",
      "ALTER TABLE settings ADD COLUMN start_time TEXT DEFAULT '06:00';",
      "ALTER TABLE settings ADD COLUMN overtime_multiplier REAL DEFAULT 1.5;"
    ];

    for (const query of migrations) {
      try { await db.runAsync(query); } catch (_) { /* Ignorar si ya existe */ }
    }

    // ✅ Insertar configuración inicial si no existe
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
  const date_string = session.date_string || new Date(session.start_time).toISOString().split('T')[0];

  // ✅ Cerrar cualquier sesión activa o en tránsito antes de crear una nueva
  await db.runAsync(
    "UPDATE work_sessions SET end_time = ?, status = 'completed' WHERE (status = 'active' OR status = 'travel') AND end_time IS NULL",
    [Date.now()]
  );

  const res = await db.runAsync(
    `INSERT INTO work_sessions (
      start_time, status, latitude, longitude, address,
      location_confirmed, is_manual_edit, manual_note, lunch_taken, date_string
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.start_time, session.status, session.latitude, session.longitude, session.address,
      session.location_confirmed, session.is_manual_edit, session.manual_note || '',
      session.lunch_taken, date_string
    ]
  );

  if (res.lastInsertRowId) {
    await insertAuditLog(res.lastInsertRowId, 'CREATED', session.address);
  }
  return res;
};

// ✅ Auditoría
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
