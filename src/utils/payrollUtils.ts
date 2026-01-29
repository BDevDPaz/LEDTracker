/**
 * Calcula la duración efectiva de una sesión en milisegundos.
 * Descuenta el almuerzo si aplica.
 */
export const calculateSessionDuration = (
  startTime: number, 
  endTime: number, 
  lunchTaken: number, // 1 o 0
  lunchStart?: number, 
  lunchEnd?: number
): number => {
  let duration = endTime - startTime;

  if (lunchTaken) {
    if (lunchStart && lunchEnd) {
      // Si tenemos tiempos exactos de almuerzo
      duration -= (lunchEnd - lunchStart);
    } else {
      // Si solo marcó "Sí" sin tiempos (por defecto 1 hora = 3600000ms)
      duration -= 3600000;
    }
  }

  return Math.max(0, duration);
};

/**
 * Calcula el pago total basado en horas y horas extra.
 * Regla: > 8 horas diarias cuentan como Overtime.
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
