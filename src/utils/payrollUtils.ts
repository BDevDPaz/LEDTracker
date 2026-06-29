import dayjs from './dayjsSetup';

/**
 * Constants for payroll calculations
 */
export const MS_PER_MINUTE = 60000;
export const MINUTES_IN_DAY = 1440;
export const LUNCH_THRESHOLD_MINUTES = 360; // 6 hours
export const DEFAULT_LUNCH_MINUTES = 60;
export const REGULAR_HOURS_THRESHOLD_MINUTES = 480; // 8 hours

/**
 * Pure function to calculate duration between two points in time (as minutes of day).
 * Handles midnight crossing (t_end < t_start).
 */
export const calculateDuration = (startMinutes: number, endMinutes: number): number => {
  if (endMinutes < startMinutes) {
    return (MINUTES_IN_DAY - startMinutes) + endMinutes;
  }
  return endMinutes - startMinutes;
};

/**
 * Calculates session duration in integer minutes.
 * Precision: Minutes
 */
export const calculateSessionMinutes = (
  startTimeMs: number,
  endTimeMs: number,
  lunchTaken: number | boolean,
  lunchStartMs?: number | null,
  lunchEndMs?: number | null
): number => {
  const startMin = Math.floor(startTimeMs / MS_PER_MINUTE);
  const endMin = Math.floor(endTimeMs / MS_PER_MINUTE);

  let totalMinutes = endMin - startMin;
  if (totalMinutes < 0) return 0;

  if (lunchTaken) {
    let deductionApplied = false;

    if (lunchStartMs && lunchEndMs) {
      const lStartMin = Math.floor(lunchStartMs / MS_PER_MINUTE);
      const lEndMin = Math.floor(lunchEndMs / MS_PER_MINUTE);

      // Validate break is within shift range
      if (lStartMin >= startMin && lEndMin <= endMin && lEndMin >= lStartMin) {
        totalMinutes -= (lEndMin - lStartMin);
        deductionApplied = true;
      }
    }

    // If no exact lunch applied, check threshold (6 hours)
    if (!deductionApplied && totalMinutes > LUNCH_THRESHOLD_MINUTES) {
      totalMinutes -= DEFAULT_LUNCH_MINUTES;
    }
  }

  return Math.max(0, totalMinutes);
};

/**
 * Backward compatibility with existing code while ensuring integer precision logic.
 * Returns duration in milliseconds.
 */
export const calculateSessionDuration = (
  startTime: number,
  endTime: number,
  lunchTaken: number,
  lunchStart?: number,
  lunchEnd?: number
): number => {
  const minutes = calculateSessionMinutes(startTime, endTime, lunchTaken, lunchStart, lunchEnd);
  return minutes * MS_PER_MINUTE;
};

/**
 * Calculates pay details from total minutes.
 * Ensures zero floating point operations until the final currency conversion.
 */
export const calculatePayFromMinutes = (
  totalMinutes: number,
  hourlyRate: number,
  overtimeMultiplier: number = 1.5
): { totalPay: number; regularMinutes: number; overtimeMinutes: number } => {
  let regularMinutes = Math.max(0, totalMinutes);
  let overtimeMinutes = 0;

  if (regularMinutes > REGULAR_HOURS_THRESHOLD_MINUTES) {
    overtimeMinutes = regularMinutes - REGULAR_HOURS_THRESHOLD_MINUTES;
    regularMinutes = REGULAR_HOURS_THRESHOLD_MINUTES;
  }

  const ratePerMinute = hourlyRate / 60;
  const regularPay = regularMinutes * ratePerMinute;
  const overtimePay = overtimeMinutes * (ratePerMinute * overtimeMultiplier);

  return {
    totalPay: Number((regularPay + overtimePay).toFixed(2)),
    regularMinutes,
    overtimeMinutes
  };
};

/**
 * Calculates total pay based on hours.
 * @deprecated Use calculatePayFromMinutes for better precision.
 */
export const calculatePay = (
  totalHours: number,
  hourlyRate: number,
  overtimeMultiplier: number = 1.5
): { totalPay: number; regularHours: number; overtimeHours: number } => {
  const totalMinutes = Math.max(0, Math.round(totalHours * 60));
  const result = calculatePayFromMinutes(totalMinutes, hourlyRate, overtimeMultiplier);

  return {
    totalPay: result.totalPay,
    regularHours: result.regularMinutes / 60,
    overtimeHours: result.overtimeMinutes / 60
  };
};
