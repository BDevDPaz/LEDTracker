// --- src/utils/logger.ts ---
import * as SQLite from 'expo-sqlite';
import { LogColor, LogCategory, LogSeverity, SystemLogEntry } from '../types';
import dayjs from './dayjsSetup';

// Cola de logs temporal para cuando la DB aún no está inicializada
const logQueue: SystemLogEntry[] = [];
const auditQueue: AuditLogEntry[] = [];

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const AUDIT_ACTIONS = {
  AUTO_CHECKIN: 'AUTO_CHECKIN',
  AUTO_CHECKOUT: 'AUTO_CHECKOUT',
  MANUAL: 'MANUAL',
  OVERLAP: 'OVERLAP',
  MUTEX: 'MUTEX',
  LOCATION: 'LOCATION',
  PDF: 'PDF',
  PAYROLL: 'PAYROLL'
} as const;

export interface AuditLogEntry {
  session_id: number | null;
  action_type: string;
  details: string;
  timestamp: number;
}

// Vincula la DB al logger y procesa los pendientes
export const setLoggerDB = (db: SQLite.SQLiteDatabase) => {
  dbInstance = db;
  void flushLogQueue();
  void flushAuditQueue();
};

const flushLogQueue = async () => {
  if (!dbInstance) return;
  while (logQueue.length > 0) {
    const entry = logQueue.shift();
    if (entry) {
      await saveSystemLogToDb(entry);
    }
  }
};

const flushAuditQueue = async () => {
  if (!dbInstance) return;
  while (auditQueue.length > 0) {
    const entry = auditQueue.shift();
    if (entry) {
      await saveAuditToDb(entry);
    }
  }
};

const saveSystemLogToDb = async (entry: SystemLogEntry) => {
  if (!dbInstance) return;

  try {
    await dbInstance.runAsync(
      `INSERT INTO system_logs (
        timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.timestamp,
        entry.timestamp_str,
        entry.color,
        entry.categoria,
        entry.severidad,
        entry.mensaje,
        entry.metadata || null
      ]
    );
  } catch (e) {
    console.error('❌ Fallo crítico al guardar log en DB de auditoría:', e);
  }
};

const saveAuditToDb = async (entry: AuditLogEntry) => {
  if (!dbInstance) return;

  try {
    await dbInstance.runAsync(
      `INSERT INTO audit_logs (
        session_id, action_type, details, timestamp
      ) VALUES (?, ?, ?, ?)`,
      [
        entry.session_id,
        entry.action_type,
        entry.details,
        entry.timestamp
      ]
    );
  } catch (e) {
    console.error('❌ Fallo crítico al guardar audit_log en DB:', e);
  }
};

export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
  if (dbInstance) {
    await saveAuditToDb(entry);
  } else {
    auditQueue.push(entry);
  }
};

export const log = (
  color: LogColor,
  categoria: LogCategory,
  severidad: LogSeverity,
  mensaje: string,
  metadata?: any
) => {
  const now = dayjs();
  const timestamp = now.valueOf();
  const timestamp_str = now.format('YYYY-MM-DDTHH:mm:ss.SSSZ');

  const entry: SystemLogEntry = {
    timestamp,
    timestamp_str,
    color,
    categoria,
    severidad,
    mensaje,
    metadata: metadata ? JSON.stringify(metadata, Object.getOwnPropertyNames(metadata)) : undefined
  };

  let icon = '';
  switch (color) {
    case 'VERDE':
      icon = '🟢';
      break;
    case 'AMARILLO':
      icon = '🟡';
      break;
    case 'NARANJA':
      icon = '🟠';
      break;
    case 'AZUL':
      icon = '🔵';
      break;
    case 'BLANCO':
      icon = '⚪️';
      break;
    case 'ROJO':
      icon = '🔴';
      break;
  }

  const consoleMsg = `[${timestamp_str}] ${icon} [${categoria}] ${mensaje}`;

  if (severidad === 'ERROR' && metadata instanceof Error) {
    console.error(consoleMsg, metadata);
  } else if (severidad === 'WARN') {
    console.warn(consoleMsg, metadata || '');
  } else {
    console.log(consoleMsg, metadata || '');
  }

  if (dbInstance) {
    void saveSystemLogToDb(entry);
  } else {
    logQueue.push(entry);
  }
};

