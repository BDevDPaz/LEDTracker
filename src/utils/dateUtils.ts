// src/utils/dateUtils.ts

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
};

const timeFormatter = new Intl.DateTimeFormat([], TIME_OPTIONS);
const dateFormatter = new Intl.DateTimeFormat([], DATE_OPTIONS);

// Helper para mostrar hora
export const formatTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '--:--';
  return timeFormatter.format(timestamp);
};

// Helper para mostrar fecha
export const formatDate = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '---';
  return dateFormatter.format(timestamp);
};

// Helper para formatear duración (ms -> HH:mm)
export const formatDuration = (ms: number): string => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};
