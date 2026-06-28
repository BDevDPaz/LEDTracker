// --- src/feedback/logBridge.ts ---
import dayjs from 'dayjs';
import type { LogCategory, LogSeverity } from '../types';

export type FeedbackKind = 'toast' | 'dialog';
export type FeedbackTone = 'success' | 'error' | 'info';

export interface FeedbackPayload {
  kind: FeedbackKind;
  tone: FeedbackTone;
  title?: string;
  message: string;
  /**
   * Clave estable para deduplicación / throttling.
   */
  dedupeKey?: string;
  /**
   * Duración sugerida para futuros consumidores visuales.
   * Actualmente la UI usa su propia duración, pero dejamos
   * este campo listo para evolución.
   */
  durationMs?: number;
  /**
   * Para diálogos destructivos o severos.
   */
  destructive?: boolean;
}

type FeedbackEmitter = (payload: FeedbackPayload) => void;

let feedbackEmitter: FeedbackEmitter | null = null;

export const setFeedbackEmitter = (emitter: FeedbackEmitter | null) => {
  feedbackEmitter = emitter;
};

// ======================================================
// MODO PREMIUM SILENCIOSO
// ======================================================

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

/**
 * Algunas categorías usan ERROR por auditoría,
 * pero no deben volverse UX bloqueante automáticamente.
 */
const NON_BLOCKING_ERROR_CATEGORIES = new Set<LogCategory>([
  'ACCION_DESTRUCTIVA',
  'MONITOREO_DETENIDO',
]);

const IMPORTANT_VISIBLE_CATEGORIES = new Set<LogCategory>([
  'ERROR_CRITICO',
  'INTEGRIDAD_COMPROMETIDA',
  'ADVERTENCIA',
  'PERMISOS_CONCEDIDOS',
]);

const titleByCategory: Partial<Record<LogCategory, string>> = {
  ERROR_CRITICO: 'Error',
  INTEGRIDAD_COMPROMETIDA: 'Atención',
  ADVERTENCIA: 'Aviso',
  PERMISOS_CONCEDIDOS: 'Listo',
  ACCION_DESTRUCTIVA: 'Aviso',
};

// ======================================================
// PRO MAX: DEDUPE + THROTTLING
// ======================================================

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
  const key =
    payload.dedupeKey ||
    `${payload.kind}:${payload.tone}:${payload.title || ''}:${payload.message}`;
  const now = dayjs().valueOf();

  cleanupEmissionMap(now);

  const previousTs = lastEmissionByKey.get(key);
  const throttleWindow = payload.kind === 'dialog' ? DIALOG_THROTTLE_MS : TOAST_THROTTLE_MS;

  if (previousTs && now - previousTs < throttleWindow) {
    return true;
  }

  lastEmissionByKey.set(key, now);
  return false;
}

// ======================================================
// REGLAS DE VISIBILIDAD
// ======================================================

function shouldEmitFeedback(
  severity: LogSeverity,
  category: LogCategory,
  message: string
): boolean {
  if (SILENT_SEVERITIES.has(severity)) return false;
  if (SILENT_CATEGORIES.has(category)) return false;

  // Categorías importantes siempre visibles
  if (IMPORTANT_VISIBLE_CATEGORIES.has(category)) return true;

  // EVENT siempre en silencio para evitar ruido visual
  if (severity === 'EVENT') return false;

  // Ciertos ERROR de auditoría no deben ser UX bloqueante
  if (severity === 'ERROR' && NON_BLOCKING_ERROR_CATEGORIES.has(category)) {
    return false;
  }

  // INFO solo si aporta valor claro al usuario
  if (severity === 'INFO') {
    if (category === 'OPERACION_EXITOSA') {
      if (message.includes('Auto Check-in')) return true;
      if (message.includes('Reporte')) return true;
      return false;
    }

    if (category === 'CONFIG_MODIFICADA') return false;

    return false;
  }

  // WARN visibles solo si son advertencias reales
  if (severity === 'WARN') {
    return category === 'ADVERTENCIA';
  }

  // ERROR visibles salvo excepciones anteriores
  if (severity === 'ERROR') return true;

  return false;
}

// ======================================================
// HUMANIZACIÓN
// ======================================================

function humanizeMessage(category: LogCategory, message: string): string {
  if (/Error crítico inicializando la app/i.test(message)) {
    return 'La aplicación no pudo iniciar correctamente. Reiníciala e inténtalo nuevamente.';
  }

  if (/Error cargando datos del HomeScreen/i.test(message)) {
    return 'No pudimos cargar la información principal. Intenta nuevamente.';
  }

  if (/Error al cargar el historial/i.test(message)) {
    return 'No pudimos cargar el historial. Intenta nuevamente.';
  }

  if (/Error al cargar los settings/i.test(message)) {
    return 'No pudimos cargar la configuración. Intenta nuevamente.';
  }

  if (/Error al guardar la configuración/i.test(message)) {
    return 'No pudimos guardar la configuración. Intenta nuevamente.';
  }

  if (/Permisos de ubicación denegados/i.test(message)) {
    return 'Se necesitan permisos de ubicación para continuar.';
  }

  if (/No se encontró la dirección/i.test(message)) {
    return 'No encontramos la dirección. Revisa el texto e inténtalo otra vez.';
  }

  if (/Horario choca con otra sesión/i.test(message)) {
    return 'Ese horario choca con otra sesión. Revisa las horas e inténtalo nuevamente.';
  }

  if (/Error iniciando geocerca/i.test(message)) {
    return 'No pudimos activar el monitoreo de llegada.';
  }

  if (/Error general deteniendo monitoreo/i.test(message)) {
    return 'No pudimos detener el monitoreo correctamente.';
  }

  if (/No se pudo conectar a la DB/i.test(message)) {
    return 'No pudimos acceder a la base de datos.';
  }

  if (/Error crítico agendando notificación/i.test(message)) {
    return 'No pudimos programar la notificación diaria.';
  }

  if (/Permiso de notificaciones denegado/i.test(message)) {
    return 'Las notificaciones están desactivadas. Algunas alertas automáticas no estarán disponibles.';
  }

  if (/Intento de acceso administrativo fallido/i.test(message)) {
    return 'La contraseña administrativa no es correcta.';
  }

  if (/Zona administrativa desbloqueada correctamente/i.test(message)) {
    return 'Zona administrativa desbloqueada.';
  }

  if (/Error ejecutando lógica de Geocerca/i.test(message)) {
    return 'Ocurrió un problema al procesar la geocerca.';
  }

  if (/Error en Failsafe/i.test(message)) {
    return 'Ocurrió un problema en la protección automática de cierre.';
  }

  if (/Error en Reporte/i.test(message)) {
    return 'No pudimos generar el reporte automático.';
  }

  if (/Error editando registro/i.test(message)) {
    return 'No pudimos guardar los cambios del registro. Intenta nuevamente.';
  }

  if (/Error al borrar registro/i.test(message)) {
    return 'No pudimos eliminar el registro. Intenta nuevamente.';
  }

  if (/Error al cerrar la sesión en la base de datos/i.test(message)) {
    return 'No pudimos finalizar la jornada correctamente. Intenta nuevamente.';
  }

  if (/Fallo general configurando la jornada\/tránsito/i.test(message)) {
    return 'No pudimos completar la configuración de la jornada. Intenta nuevamente.';
  }

  if (category === 'PERMISOS_CONCEDIDOS') {
    return 'Acceso concedido correctamente.';
  }

  if (category === 'ERROR_CRITICO') {
    return 'Ocurrió un error importante. Intenta nuevamente.';
  }

  if (category === 'ADVERTENCIA') {
    return message;
  }

  return message;
}

// ======================================================
// MAPEO → FEEDBACK
// ======================================================

function mapToFeedback(
  severity: LogSeverity,
  category: LogCategory,
  message: string
): FeedbackPayload | null {
  if (!shouldEmitFeedback(severity, category, message)) return null;

  const friendlyMessage = humanizeMessage(category, message);
  const title = titleByCategory[category];
  const dedupeKey = `${category}:${friendlyMessage}`;

  // Errores críticos → dialog bloqueante
  if (
    category === 'ERROR_CRITICO' ||
    category === 'INTEGRIDAD_COMPROMETIDA' ||
    (severity === 'ERROR' && !NON_BLOCKING_ERROR_CATEGORIES.has(category))
  ) {
    return {
      kind: 'dialog',
      tone: 'error',
      title: title || 'Error',
      message: friendlyMessage,
      destructive: false,
      dedupeKey,
    };
  }

  // Warnings → toast discreto
  if (severity === 'WARN' || category === 'ADVERTENCIA') {
    return {
      kind: 'toast',
      tone: 'info',
      title: title || 'Aviso',
      message: friendlyMessage,
      durationMs: 3200,
      dedupeKey,
    };
  }

  // Éxitos importantes → toast success
  return {
    kind: 'toast',
    tone: 'success',
    title,
    message: friendlyMessage,
    durationMs: 2600,
    dedupeKey,
  };
}

// ======================================================
// API PÚBLICA
// ======================================================

export function emitFeedbackFromLog(
  severity: LogSeverity,
  category: LogCategory,
  message: string
): void {
  if (!feedbackEmitter) return;

  const payload = mapToFeedback(severity, category, message);
  if (!payload) return;

  if (shouldThrottle(payload)) {
    return;
  }

  feedbackEmitter(payload);
}

