import dayjs from './dayjsSetup';

/**
 * Formatea un timestamp a hora local corporativa (Ej: 08:30 AM)
 */
export const formatTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '--:--';
  return dayjs(timestamp).format('hh:mm A');
};

/**
 * Formatea un timestamp a fecha legible (Ej: dom., 31 may. 2026)
 */
export const formatDate = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '---';
  return dayjs(timestamp).format('ddd, D MMM YYYY');
};

/**
 * Convierte milisegundos a una cadena de duración (Ej: 8h 30m)
 */
export const formatDuration = (ms: number): string => {
  if (ms <= 0) return '0h 0m';

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

/**
 * Calculates if a session crosses midnight.
 */
export const crossesMidnight = (startTime: number, endTime: number): boolean => {
  return dayjs(startTime).date() !== dayjs(endTime).date();
};
