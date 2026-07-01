// --- src/feedback/logBridge.ts ---
import dayjs from 'dayjs';
import type { LogCategory, LogSeverity, ToastPriority } from '../types';
import { recordFeedbackEvent } from './feedbackAnalytics';

export type FeedbackKind = 'toast' | 'dialog';
export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackPayload {
  kind: FeedbackKind;
  tone: FeedbackTone;
  title?: string;
  message: string;
  dedupeKey?: string;
  durationMs?: number;
  destructive?: boolean;
  priority?: ToastPriority;
}

type FeedbackEmitter = (payload: FeedbackPayload) => void;

let feedbackEmitter: FeedbackEmitter | null = null;

export const setFeedbackEmitter = (emitter: FeedbackEmitter | null) => {
  feedbackEmitter = emitter;
};

const SILENT_SEVERITIES = new Set<LogSeverity>(['DEBUG']);
const SILENT_CATEGORIES = new Set<LogCategory>([
  'SIN_CAMBIOS',
  'BACKGROUND_TASK',
  'ESTADO_SISTEMA',
  'SERVICIOS_ACTIVOS',
  'EVENTO_GEOCERCA',
  'REINICIO_MONITOREO',
  'MONITOREO_DETENIDO',
]);

const NON_BLOCKING_ERROR_CATEGORIES = new Set<LogCategory>([
  'ACCION_DESTRUCTIVA',
  'MONITOREO_DETENIDO',
]);

const IMPORTANT_VISIBLE_CATEGORIES = new Set<LogCategory>([
  'ERROR_CRITICO',
  'INTEGRIDAD_COMPROMETIDA',
  'ADVERTENCIA',
  'PERMISOS_CONCEDIDOS',
  'PERMISOS_DENEGADOS',
]);

const titleByCategory: Partial<Record<LogCategory, string>> = {
  ERROR_CRITICO: 'Error',
  INTEGRIDAD_COMPROMETIDA: 'Atención',
  ADVERTENCIA: 'Aviso',
  PERMISOS_CONCEDIDOS: 'Listo',
  PERMISOS_DENEGADOS: 'Permisos',
  ACCION_DESTRUCTIVA: 'Aviso',
};

const lastEmissionByKey = new Map<string, number>();
const TOAST_THROTTLE_MS = 1800;
const DIALOG_THROTTLE_MS = 3500;
const MAP_ENTRY_TTL_MS = 60_000;

function cleanupEmissionMap(now: number) {
  for (const [key, ts] of lastEmissionByKey.entries()) {
    if (now - ts > MAP_ENTRY_TTL_MS) {
      lastEmissionByKey.delete(key);
    }
  }
}

function shouldThrottle(payload: FeedbackPayload): boolean {
  const key = payload.dedupeKey || `${payload.kind}:${payload.tone}:${payload.title || ''}:${payload.message}`;
  const now = dayjs().valueOf();
  cleanupEmissionMap(now);
  const previousTs = lastEmissionByKey.get(key);
  const throttleWindow = payload.kind === 'dialog' ? DIALOG_THROTTLE_MS : TOAST_THROTTLE_MS;
  if (previousTs && now - previousTs < throttleWindow) return true;
  lastEmissionByKey.set(key, now);
  return false;
}

function shouldEmitFeedback(severity: LogSeverity, category: LogCategory, message: string): boolean {
  if (SILENT_SEVERITIES.has(severity)) return false;
  if (SILENT_CATEGORIES.has(category)) return false;
  if (IMPORTANT_VISIBLE_CATEGORIES.has(category)) return true;
  if (severity === 'EVENT') return false;
  if (severity === 'ERROR' && NON_BLOCKING_ERROR_CATEGORIES.has(category)) return false;
  if (severity === 'INFO') {
    if (category === 'OPERACION_EXITOSA') {
      if (message.includes('Auto Check-in')) return true;
      if (message.includes('Reporte')) return true;
    }
    return false;
  }
  if (severity === 'WARN') return category === 'ADVERTENCIA';
  if (severity === 'ERROR') return true;
  return false;
}

function humanizeMessage(category: LogCategory, message: string): string {
  if (/Error crítico inicializando la app/i.test(message)) return 'La aplicación no pudo iniciar correctamente. Reiníciala e inténtalo nuevamente.';
  if (/Error cargando datos del HomeScreen/i.test(message)) return 'No pudimos cargar la información principal. Intenta nuevamente.';
  if (/Permisos de ubicación denegados/i.test(message)) return 'Se necesitan permisos de ubicación para continuar.';
  if (/Error crítico agendando notificación/i.test(message)) return 'No pudimos programar la notificación diaria.';
  if (/Permiso de notificaciones denegado/i.test(message)) return 'Las notificaciones están desactivadas. Algunas alertas automáticas no estarán disponibles.';
  if (category === 'PERMISOS_CONCEDIDOS') return 'Acceso concedido correctamente.';
  if (category === 'ERROR_CRITICO') return 'Ocurrió un error importante. Intenta nuevamente.';
  return message;
}

function mapToFeedback(severity: LogSeverity, category: LogCategory, message: string): FeedbackPayload | null {
  if (!shouldEmitFeedback(severity, category, message)) return null;
  const friendlyMessage = humanizeMessage(category, message);
  const title = titleByCategory[category];
  const dedupeKey = `${category}:${friendlyMessage}`;
  if (category === 'ERROR_CRITICO' || category === 'INTEGRIDAD_COMPROMETIDA' || (severity === 'ERROR' && !NON_BLOCKING_ERROR_CATEGORIES.has(category))) {
    return { kind: 'dialog', tone: 'error', title: title || 'Error', message: friendlyMessage, destructive: false, dedupeKey, priority: 'high' };
  }
  if (severity === 'WARN' || category === 'ADVERTENCIA' || category === 'PERMISOS_DENEGADOS') {
    return { kind: 'toast', tone: 'info', title: title || 'Aviso', message: friendlyMessage, durationMs: 3200, dedupeKey, priority: 'high' };
  }
  return { kind: 'toast', tone: 'success', title, message: friendlyMessage, durationMs: 2600, dedupeKey, priority: 'normal' };
}

export function emitFeedbackFromLog(severity: LogSeverity, category: LogCategory, message: string): void {
  if (!feedbackEmitter) return;
  const payload = mapToFeedback(severity, category, message);
  const throttled = payload ? shouldThrottle(payload) : false;
  if (payload) {
    recordFeedbackEvent({ timestamp: dayjs().valueOf(), kind: payload.kind, tone: payload.tone, category, severity, message: payload.message, wasThrottled: throttled, wasDeduped: throttled });
  }
  if (!payload || throttled) return;
  feedbackEmitter(payload);
}
