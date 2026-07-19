import { locationAdapter } from './locationAdapter';
import { sessionStoreAdapter } from './sessionStoreAdapter';
import { registerAutoCheckinGps, MIN_ACCURACY_METERS } from '../services/LocationManager';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { AUDIT_ACTIONS, logStructured } from '../utils/logger';
import dayjs from '../utils/dayjsSetup';

export type RuntimeReconcileSource =
  | 'APP_INIT'
  | 'FOREGROUND'
  | 'DASHBOARD_REFRESH'
  | 'BACKGROUND_TASK';

const DEFAULT_RECONCILE_RADIUS_METERS = 200;

let isReconciling = false;

async function reconcilePendingArrivalSessions(
  source: RuntimeReconcileSource
): Promise<void> {
  const settings = await sessionStoreAdapter.getSettings();
  const radiusMeters =
    settings?.tolerance_radius || DEFAULT_RECONCILE_RADIUS_METERS;

  const pendingSessions =
    await sessionStoreAdapter.getPendingArrivalSessionsForDate(
      dayjs().format('YYYY-MM-DD')
    );

  if (pendingSessions.length === 0) {
    return;
  }

  const currentLocation = await locationAdapter.getCurrentLocation();

  if (!currentLocation) {
    logStructured(
      'INFO',
      'SIN_CAMBIOS',
      `[${source}] Runtime reconciliation skipped: no GPS sample available.`,
      {
        source,
        reason: 'NO_GPS_SAMPLE',
      }
    );

    return;
  }

  if (
    currentLocation.accuracy !== undefined &&
    currentLocation.accuracy !== null &&
    currentLocation.accuracy > MIN_ACCURACY_METERS
  ) {
    logStructured(
      'DEBUG',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.GPS_SAMPLE_REJECTED_WEAK_ACCURACY,
      {
        source,
        geoAccuracy: currentLocation.accuracy,
        minAccuracyMeters: MIN_ACCURACY_METERS,
      }
    );

    return;
  }

  logStructured(
    'DEBUG',
    'ESTADO_SISTEMA',
    AUDIT_ACTIONS.GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION,
    {
      source,
      geoAccuracy: currentLocation.accuracy ?? undefined,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    }
  );

  for (const session of pendingSessions) {
    if (
      !session.id ||
      session.latitude === undefined ||
      session.latitude === null ||
      session.longitude === undefined ||
      session.longitude === null
    ) {
      continue;
    }

    const distanceToTarget = getDistanceFromLatLonInMeters(
      session.latitude,
      session.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    if (distanceToTarget > radiusMeters) {
      continue;
    }

    const reconciled = await registerAutoCheckinGps(session, {
      source,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      accuracy: currentLocation.accuracy,
      distanceToTarget,
    });

    if (reconciled) {
      logStructured(
        'INFO',
        'OPERACION_EXITOSA',
        AUDIT_ACTIONS.PENDING_ARRIVAL_RECONCILED_TO_ACTIVE,
        {
          source,
          sessionId: session.id,
          distanceToTarget,
          radiusMeters,
        }
      );
    }
  }
}

/**
 * Orchestrates the runtime state reconciliation process.
 * Safeguarded against reentrancy and runtime failures.
 */
export async function reconcileRuntimeState(
  source: RuntimeReconcileSource
): Promise<void> {
  if (isReconciling) {
    logStructured(
      'INFO',
      'SIN_CAMBIOS',
      `[${source}] Runtime reconciliation skipped: already in progress.`,
      { source, reason: 'ALREADY_IN_PROGRESS' }
    );
    return;
  }

  isReconciling = true;

  try {
    logStructured(
      'EVENT',
      'ESTADO_SISTEMA',
      `[${source}] RUNTIME_RECONCILE_STARTED`,
      { source }
    );

    await reconcilePendingArrivalSessions(source);

    logStructured(
      'INFO',
      'OPERACION_EXITOSA',
      `[${source}] RUNTIME_RECONCILE_COMPLETED`,
      { source }
    );
  } catch (error) {
    logStructured(
      'ERROR',
      'ERROR_CRITICO',
      `[${source}] RUNTIME_RECONCILE_FAILED`,
      { source, error: error instanceof Error ? error.message : String(error) }
    );
  } finally {
    isReconciling = false;
  }
}

/**
 * Semantic wrappers for different entry points
 */
export async function onAppStart(): Promise<void> {
  return reconcileRuntimeState('APP_INIT');
}

export async function onAppForeground(): Promise<void> {
  return reconcileRuntimeState('FOREGROUND');
}

export async function onDashboardRefresh(): Promise<void> {
  return reconcileRuntimeState('DASHBOARD_REFRESH');
}

export async function onBackgroundMaintenance(): Promise<void> {
  return reconcileRuntimeState('BACKGROUND_TASK');
}

