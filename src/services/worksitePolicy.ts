import { RUNTIME_POLICY } from '../runtime/runtimePolicy';

export const GEOFENCE_ENTRY_RADIUS_M = RUNTIME_POLICY.GEOFENCE_ENTRY_RADIUS_M;
export const WORKSITE_EXIT_DISTANCE_M = RUNTIME_POLICY.WORKSITE_EXIT_DISTANCE_M;
export const REQUIRED_STABLE_SAMPLES = RUNTIME_POLICY.REQUIRED_STABLE_GEOFENCE_SAMPLES;
export const MAX_ACCEPTED_ACCURACY_M = RUNTIME_POLICY.GPS_ACCEPTED_ACCURACY_M;

export type WorksiteSampleZone = 'INSIDE_ENTRY' | 'NEAR_SITE' | 'BEYOND_EXIT';

/**
 * Rechaza lecturas sin precisión (null/undefined/0/NaN) o con precisión peor que el umbral.
 */
export function isAcceptableAccuracy(
  accuracy: number | null | undefined,
  maxAccuracyM: number = MAX_ACCEPTED_ACCURACY_M
): boolean {
  if (accuracy === null || accuracy === undefined) return false;
  if (!Number.isFinite(accuracy) || accuracy <= 0) return false;
  return accuracy <= maxAccuracyM;
}

export function classifyDistance(
  distanceM: number,
  entryRadiusM: number = GEOFENCE_ENTRY_RADIUS_M,
  exitDistanceM: number = WORKSITE_EXIT_DISTANCE_M
): WorksiteSampleZone {
  if (distanceM <= entryRadiusM) return 'INSIDE_ENTRY';
  if (distanceM > exitDistanceM) return 'BEYOND_EXIT';
  return 'NEAR_SITE';
}

export interface ExitCounterState {
  consecutiveBeyond: number;
}

/**
 * Anti-ruido: solo confirma salida tras N lecturas consecutivas (> umbral de salida).
 * Una lectura dentro del umbral reinicia el contador.
 */
export function advanceExitCounter(
  state: ExitCounterState,
  zone: WorksiteSampleZone,
  requiredSamples: number = REQUIRED_STABLE_SAMPLES
): { state: ExitCounterState; exitConfirmed: boolean } {
  if (zone !== 'BEYOND_EXIT') {
    return { state: { consecutiveBeyond: 0 }, exitConfirmed: false };
  }
  const consecutiveBeyond = state.consecutiveBeyond + 1;
  return {
    state: { consecutiveBeyond },
    exitConfirmed: consecutiveBeyond >= requiredSamples,
  };
}
