import * as SQLite from 'expo-sqlite';

import {
  LogColor,
  LogCategory,
  LogSeverity,
  SystemLogEntry,
  LogMetadata,
} from '../types';
import dayjs from './dayjsSetup';

// Queue for when DB is not yet ready
const logQueue: SystemLogEntry[] = [];
const auditQueue: AuditLogEntry[] = [];

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isFlushing = false;

type LogFeedbackSink = (
  severity: LogSeverity,
  category: LogCategory,
  message: string
) => void;

let logFeedbackSink: LogFeedbackSink | null = null;

export const setLogFeedbackSink = (sink: LogFeedbackSink | null): void => {
  logFeedbackSink = sink;
};

// Internal Diagnostic Channel
const _output = {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export const AUDIT_ACTIONS = {
  AUTO_CHECKIN: 'AUTO_CHECKIN',

  // Legacy / generic actions kept for backwards compatibility.
  // Do not use AUTO_CHECKOUT or MANUAL for new checkout close flows.
  AUTO_CHECKOUT: 'AUTO_CHECKOUT',
  MANUAL: 'MANUAL',

  // Explicit checkout semantics.
  MANUAL_CHECKOUT: 'MANUAL_CHECKOUT',
  AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_GPS',
  AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_FAILSAFE',

  OVERLAP: 'OVERLAP',
  MUTEX: 'MUTEX',
  LOCATION: 'LOCATION',
  PDF: 'PDF',
  PAYROLL: 'PAYROLL',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
  AUTO_CHECKIN_GPS: 'AUTO_CHECKIN_GPS',

  // Runtime Resilience Phase D actions
  RUNTIME_RECONCILE_STARTED: 'RUNTIME_RECONCILE_STARTED',
  RUNTIME_RECONCILE_COMPLETED: 'RUNTIME_RECONCILE_COMPLETED',
  RUNTIME_RECONCILE_SKIPPED: 'RUNTIME_RECONCILE_SKIPPED',
  RUNTIME_RECONCILE_FAILED: 'RUNTIME_RECONCILE_FAILED',
  PENDING_ARRIVAL_RECONCILED_TO_ACTIVE: 'PENDING_ARRIVAL_RECONCILED_TO_ACTIVE',
  ACTIVE_SESSION_EXIT_RECONCILED: 'ACTIVE_SESSION_EXIT_RECONCILED',
  MONITORING_RESTARTED: 'MONITORING_RESTARTED',
  MONITORING_ALREADY_ACTIVE: 'MONITORING_ALREADY_ACTIVE',
  EXIT_TIMESTAMP_STORED: 'EXIT_TIMESTAMP_STORED',
  EXIT_TIMESTAMP_ALREADY_PRESENT: 'EXIT_TIMESTAMP_ALREADY_PRESENT',
  GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION: 'GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION',
  GPS_SAMPLE_REJECTED_WEAK_ACCURACY: 'GPS_SAMPLE_REJECTED_WEAK_ACCURACY',
  PENDING_ARRIVAL_STALE_DETECTED: 'PENDING_ARRIVAL_STALE_DETECTED',
  ACTIVE_SESSION_WITH_PENDING_EXIT: 'ACTIVE_SESSION_WITH_PENDING_EXIT',
  EXIT_TIMESTAMP_INVALID_DETECTED: 'EXIT_TIMESTAMP_INVALID_DETECTED',
  COMPLETED_SESSION_MONITORING_CLEARED: 'COMPLETED_SESSION_MONITORING_CLEARED',

  // Background maintenance observability
  BACKGROUND_RUN_STARTED: 'BACKGROUND_RUN_STARTED',
  BACKGROUND_RUN_COMPLETED: 'BACKGROUND_RUN_COMPLETED',
  BACKGROUND_RUN_FAILED: 'BACKGROUND_RUN_FAILED',

  // Background failsafe observability
  BACKGROUND_FAILSAFE_CHECK_STARTED: 'BACKGROUND_FAILSAFE_CHECK_STARTED',
  BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP: 'BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP',
  BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET: 'BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET',
  BACKGROUND_FAILSAFE_COMPLETED: 'BACKGROUND_FAILSAFE_COMPLETED',

  // Background reports observability
  BACKGROUND_REPORT_CHECK_COMPLETED: 'BACKGROUND_REPORT_CHECK_COMPLETED',
  BACKGROUND_PENDING_REPORT_RETRY_COMPLETED: 'BACKGROUND_PENDING_REPORT_RETRY_COMPLETED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const CHECKOUT_AUDIT_ACTIONS = [
  AUDIT_ACTIONS.MANUAL_CHECKOUT,
  AUDIT_ACTIONS.AUTO_CHECKOUT_GPS,
  AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE,
] as const;

export type CheckoutAuditAction = (typeof CHECKOUT_AUDIT_ACTIONS)[number];

export const LEGACY_CHECKOUT_AUDIT_ACTIONS = [
  AUDIT_ACTIONS.AUTO_CHECKOUT,
] as const;

export type LegacyCheckoutAuditAction =
  (typeof LEGACY_CHECKOUT_AUDIT_ACTIONS)[number];

export const ALL_CHECKOUT_AUDIT_ACTIONS = [
  ...CHECKOUT_AUDIT_ACTIONS,
  ...LEGACY_CHECKOUT_AUDIT_ACTIONS,
] as const;

export type AnyCheckoutAuditAction =
  | CheckoutAuditAction
  | LegacyCheckoutAuditAction;

const checkoutAuditActionSet = new Set<string>(ALL_CHECKOUT_AUDIT_ACTIONS);
const officialCheckoutAuditActionSet = new Set<string>(CHECKOUT_AUDIT_ACTIONS);

export function isCheckoutAuditAction(
  action: string | null | undefined
): action is AnyCheckoutAuditAction {
  return Boolean(action && checkoutAuditActionSet.has(action));
}

export function isOfficialCheckoutAuditAction(
  action: string | null | undefined
): action is CheckoutAuditAction {
  return Boolean(action && officialCheckoutAuditActionSet.has(action));
}

export function getCheckoutMethodLabel(
  action: string | null | undefined
): string | null {
  switch (action) {
    case AUDIT_ACTIONS.MANUAL_CHECKOUT:
      return 'Salida manual';

    case AUDIT_ACTIONS.AUTO_CHECKOUT_GPS:
      return 'Salida automática por GPS';

    case AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE:
      return 'Salida automática por respaldo';

    case AUDIT_ACTIONS.AUTO_CHECKOUT:
      return 'Salida automática legacy';

    default:
      return null;
  }
}

export interface AuditLogEntry {
  session_id: number | null;
  action_type: string;
  details: string;
  timestamp: number;
}

export const setLoggerDB = (db: SQLite.SQLiteDatabase) => {
  dbInstance = db;
  void flushQueues();
};

const flushQueues = async () => {
  if (!dbInstance || isFlushing) return;

  isFlushing = true;

  try {
    if (logQueue.length > 0) {
      const toProcess = logQueue.splice(0, logQueue.length);
      const CHUNK_SIZE = 50;

      for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
        const chunk = toProcess.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = chunk.flatMap((entry) => [
          entry.timestamp,
          entry.timestamp_str,
          entry.color,
          entry.categoria,
          entry.severidad,
          entry.mensaje,
          entry.metadata ?? null,
        ]);

        await dbInstance.runAsync(
          `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES ${placeholders}`,
          values as any
        );
      }
    }

    if (auditQueue.length > 0) {
      const toProcess = auditQueue.splice(0, auditQueue.length);
      const CHUNK_SIZE = 100;

      for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
        const chunk = toProcess.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
        const values = chunk.flatMap((entry) => [
          entry.session_id,
          entry.action_type,
          entry.details,
          entry.timestamp,
        ]);

        await dbInstance.runAsync(
          `INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES ${placeholders}`,
          values as any
        );
      }
    }
  } catch (e) {
    _output.error('❌ Error flushing logger queues:', e);
  } finally {
    isFlushing = false;
  }
};

export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
  if (dbInstance) {
    try {
      await dbInstance.runAsync(
        `INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)`,
        [entry.session_id, entry.action_type, entry.details, entry.timestamp]
      );
    } catch (e) {
      _output.error('❌ Error saving audit log:', e);
      auditQueue.push(entry);
    }
  } else {
    auditQueue.push(entry);
  }
};

function safeSerializeMetadata(metadata: unknown): string | undefined {
  if (metadata === undefined) return undefined;

  try {
    if (metadata instanceof Error) {
      return JSON.stringify(
        {
          name: metadata.name,
          message: metadata.message,
          stack: metadata.stack,
        },
        null,
        0
      );
    }

    return JSON.stringify(metadata);
  } catch {
    return '[unserializable-metadata]';
  }
}

function getIconByColor(color: LogColor): string {
  const icons: Record<LogColor, string> = {
    VERDE: '🟢',
    AMARILLO: '🟡',
    NARANJA: '🟠',
    AZUL: '🔵',
    BLANCO: '⚪️',
    ROJO: '🔴',
  };

  return icons[color] || '•';
}

function levelToColor(level: LogSeverity): LogColor {
  switch (level) {
    case 'ERROR':
      return 'ROJO';
    case 'WARN':
      return 'AMARILLO';
    case 'EVENT':
      return 'NARANJA';
    case 'DEBUG':
      return 'BLANCO';
    default:
      return 'AZUL';
  }
}

export const logStructured = (
  level: LogSeverity,
  category: LogCategory,
  message: string,
  metadata?: LogMetadata
): void => {
  log(levelToColor(level), category, level, message, metadata);
};

export const log = (
  color: LogColor,
  categoria: LogCategory,
  severidad: LogSeverity,
  mensaje: string,
  metadata?: unknown
): void => {
  const now = dayjs();

  const entry: SystemLogEntry = {
    timestamp: now.valueOf(),
    timestamp_str: now.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    color,
    categoria,
    severidad,
    mensaje,
    metadata: safeSerializeMetadata(metadata),
  };

  const icon = getIconByColor(color);
  const consoleMsg = `[${entry.timestamp_str}] ${icon} [${categoria}] ${mensaje}`;

  if (severidad === 'ERROR') {
    _output.error(consoleMsg, metadata ?? '');
  } else if (severidad === 'WARN') {
    _output.warn(consoleMsg, metadata ?? '');
  } else {
    _output.info(consoleMsg, metadata ?? '');
  }

  if (dbInstance) {
    dbInstance
      .runAsync(
        `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.timestamp,
          entry.timestamp_str,
          entry.color,
          entry.categoria,
          entry.severidad,
          entry.mensaje,
          entry.metadata ?? null,
        ]
      )
      .catch((e) => {
        _output.error('❌ Error saving system log:', e);
        logQueue.push(entry);
      });
  } else {
    logQueue.push(entry);
  }

  if (logFeedbackSink) {
    try {
      logFeedbackSink(severidad, categoria, mensaje);
    } catch (e) {
      _output.warn('⚠️ Error emitting log feedback:', e);
    }
  }
};
