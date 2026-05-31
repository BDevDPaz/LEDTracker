// --- src/utils/payrollUtils.ts ---
import dayjs from './dayjsSetup';

/**
 * Calcula la duración efectiva de una sesión en milisegundos.
 * Utiliza dayjs para garantizar precisión ante saltos de DST o timezone cruzados.
 */
export const calculateSessionDuration = (
  startTime: number,
  endTime: number,
  lunchTaken: number, // 1 o 0
  lunchStart?: number,
  lunchEnd?: number
): number => {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  
  let durationMs = end.diff(start, 'millisecond');

  if (lunchTaken) {
    if (lunchStart && lunchEnd) {
      // Diferencia exacta si hay registros de almuerzo
      const lStart = dayjs(lunchStart);
      const lEnd = dayjs(lunchEnd);
      durationMs -= lEnd.diff(lStart, 'millisecond');
    } else {
      // Restar 1 hora por defecto si solo se marcó "Sí"
      durationMs -= dayjs.duration(1, 'hour').asMilliseconds();
    }
  }

  return Math.max(0, durationMs);
};

/**
 * Calcula el pago total basado en horas y horas extra.
 * Regla de California: > 8 horas diarias cuentan como Overtime.
 */
export const calculatePay = (
  totalHours: number,
  hourlyRate: number,
  overtimeMultiplier: number = 1.5
): { totalPay: number, regularHours: number, overtimeHours: number } => {

  let regularHours = totalHours;
  let overtimeHours = 0;

  if (totalHours > 8) {
    regularHours = 8;
    overtimeHours = totalHours - 8;
  }

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier;

  return {
    totalPay: regularPay + overtimePay,
    regularHours,
    overtimeHours
  };
};

