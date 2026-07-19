import AsyncStorage from '@react-native-async-storage/async-storage';

import { locationAdapter } from './locationAdapter';
import { sessionStoreAdapter } from './sessionStoreAdapter';
import {
  registerAutoCheckinGps,
  MIN_ACCURACY_METERS,
  EXIT_TIMESTAMP_KEY,
  LocationService,
  GEOFENCE_TASK,
} from '../services/LocationManager';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { AUDIT_ACTIONS, logStructured } from '../utils/logger';
import dayjs from '../utils/dayjsSetup';
import { WorkSession } from '../types';

export type RuntimeReconcileSource =
  | 'APP_INIT'
  | 'FOREGROUND'
  | 'DASHBOARD_REFRESH'
  | 'BACKGROUND_TASK';

const DEFAULT_RECONCILE_RADIUS_METERS = 200;
const FAILSAFE_THRESHOLD_MS = 45 * 60 * 1000;
const STALE_EXIT_TIMESTAMP_MS = 12 * 60 * 60 * 1000;

let isReconciling = false;

export type RuntimeReconcileStep =
  | 'pendingArrival'
  | 'activeSession'
  | 'completedSession'
  | 'monitoring'
  | 'exitTimestamp';

export interface RuntimeReconcileStepResult {
  status: 'ok' | 'skipped' | 'failed';
  details: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeReconcileOutcome {
  source: RuntimeReconcileSource;
  status: 'completed' | 'skipped' | 'failed';
  steps: Record<RuntimeReconcileStep, RuntimeReconcileStepResult>;
}

interface RuntimeSnapshot {
  today: string;
  now: number;
  settings: Awaited<ReturnType<typeof sessionStoreAdapter.getSettings>>;
  pendingSessions: WorkSession[];
  stalePendingSessions: WorkSession[];
  activeSession: WorkSession | null;
  completedSessionToday: WorkSession | null;
  monitoringActive: boolean;
  exitTimestampRaw: string | null;
  exitTimestamp: number | null;
  radiusMeters: number;
  hasValidRadius: boolean;
}

function parseExitTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function isInvalidExitTimestamp(
  exitTimestamp: number | null,
  now: number
): boolean {
  return exitTimestamp === null || exitTimestamp <= 0 || exitTimestamp > now;
}

function resolveOutcomeStatus(
  hasFailedStep: boolean,
  hasNonSkippedStep: boolean
): RuntimeReconcileOutcome['status'] {
  if (hasFailedStep) return 'failed';
  if (hasNonSkippedStep) return 'completed';
  return 'skipped';
}

const getDefaultStepResults = (): Record<
  RuntimeReconcileStep,
  RuntimeReconcileStepResult
> => ({
  pendingArrival: { status: 'skipped', details: 'pending_arrival_not_evaluated' },
  activeSession: { status: 'skipped', details: 'active_session_not_evaluated' },
  completedSession: { status: 'skipped', details: 'completed_session_not_evaluated' },
  monitoring: { status: 'skipped', details: 'monitoring_not_evaluated' },
  exitTimestamp: { status: 'skipped', details: 'exit_timestamp_not_evaluated' },
});

const getMonitoringSites = (
  pendingSessions: WorkSession[],
  activeSession: WorkSession | null
): { id: string; latitude: number; longitude: number }[] => {
  const siteMap = new Map<string, { id: string; latitude: number; longitude: number }>();

  for (const session of pendingSessions) {
    if (!session.id || session.latitude == null || session.longitude == null) continue;
    const id = session.id.toString();
    siteMap.set(id, { id, latitude: session.latitude, longitude: session.longitude });
  }

  if (activeSession?.id && activeSession.latitude != null && activeSession.longitude != null) {
    const id = activeSession.id.toString();
    siteMap.set(id, { id, latitude: activeSession.latitude, longitude: activeSession.longitude });
  }

  return Array.from(siteMap.values());
};

async function buildRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  const today = dayjs().format('YYYY-MM-DD');
  const now = dayjs().valueOf();
  const [settings, pendingSessions, history, monitoringActive, exitTimestampRaw] =
    await Promise.all([
      sessionStoreAdapter.getSettings(),
      sessionStoreAdapter.getPendingArrivalSessionsForDate(today),
      sessionStoreAdapter.getHistory(),
      locationAdapter.isTaskRegistered(GEOFENCE_TASK),
      AsyncStorage.getItem(EXIT_TIMESTAMP_KEY),
    ]);

  const activeSession =
    history.find((session) => session.status === 'active' && session.date_string === today) ??
    null;
  const completedSessionToday =
    history.find((session) => session.status === 'completed' && session.date_string === today) ??
    null;
  const stalePendingSessions = history.filter(
    (session) => session.status === 'pending_arrival' && session.date_string !== today
  );
  const parsedRadius = Number(settings?.tolerance_radius);
  const hasValidRadius = Number.isFinite(parsedRadius) && parsedRadius > 0;
  const radiusMeters = hasValidRadius ? parsedRadius : DEFAULT_RECONCILE_RADIUS_METERS;
  const parsedExitTimestamp = parseExitTimestamp(exitTimestampRaw);

  return {
    today,
    now,
    settings,
    pendingSessions,
    stalePendingSessions,
    activeSession,
    completedSessionToday,
    monitoringActive,
    exitTimestampRaw,
    exitTimestamp: parsedExitTimestamp,
    radiusMeters,
    hasValidRadius,
  };
}

export async function reconcilePendingArrivalState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  const snapshot = await buildRuntimeSnapshot();

  if (snapshot.stalePendingSessions.length > 0) {
    logStructured(
      'WARN',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.PENDING_ARRIVAL_STALE_DETECTED,
      {
        source,
        count: snapshot.stalePendingSessions.length,
        sessionIds: snapshot.stalePendingSessions
          .map((session) => session.id)
          .filter((id): id is number => typeof id === 'number'),
      }
    );
  }

  if (snapshot.pendingSessions.length === 0) {
    return {
      status: 'skipped',
      details: 'no_pending_arrival_sessions',
      metadata: {
        stalePendingCount: snapshot.stalePendingSessions.length,
        monitoringActive: snapshot.monitoringActive,
      },
    };
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

    return {
      status: 'skipped',
      details: 'missing_gps_sample',
      metadata: {
        pendingCount: snapshot.pendingSessions.length,
      },
    };
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

    return {
      status: 'skipped',
      details: 'weak_gps_sample',
      metadata: {
        pendingCount: snapshot.pendingSessions.length,
        geoAccuracy: currentLocation.accuracy,
      },
    };
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

  let reconciledCount = 0;

  for (const session of snapshot.pendingSessions) {
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

    if (distanceToTarget > snapshot.radiusMeters) {
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
      reconciledCount += 1;
      logStructured(
        'INFO',
        'OPERACION_EXITOSA',
        AUDIT_ACTIONS.PENDING_ARRIVAL_RECONCILED_TO_ACTIVE,
        {
          source,
          sessionId: session.id,
          distanceToTarget,
          radiusMeters: snapshot.radiusMeters,
        }
      );
    }
  }

  return {
    status: 'ok',
    details: reconciledCount > 0 ? 'pending_arrival_reconciled' : 'pending_arrival_no_changes',
    metadata: {
      pendingCount: snapshot.pendingSessions.length,
      reconciledCount,
      monitoringActive: snapshot.monitoringActive,
      radiusMeters: snapshot.radiusMeters,
    },
  };
}

async function reconcilePendingArrivalSessions(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  return reconcilePendingArrivalState(source);
}

export async function reconcileActiveSessionState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  const snapshot = await buildRuntimeSnapshot();
  const activeSession = snapshot.activeSession;

  if (!activeSession?.id) {
    return { status: 'skipped', details: 'no_active_session' };
  }

  const metadata: Record<string, unknown> = {
    source,
    sessionId: activeSession.id,
    monitoringActive: snapshot.monitoringActive,
    hasExitTimestamp: Boolean(snapshot.exitTimestampRaw),
  };

  if (!snapshot.hasValidRadius) {
    logStructured(
      'WARN',
      'ADVERTENCIA',
      `[${source}] Active session found with invalid tolerance_radius. Reconciliation fallback applied.`,
      {
        ...metadata,
        configuredToleranceRadius: snapshot.settings?.tolerance_radius,
        fallbackToleranceRadius: snapshot.radiusMeters,
      }
    );
  }

  if (snapshot.exitTimestampRaw) {
    if (isInvalidExitTimestamp(snapshot.exitTimestamp, snapshot.now)) {
      logStructured(
        'WARN',
        'ESTADO_SISTEMA',
        AUDIT_ACTIONS.EXIT_TIMESTAMP_INVALID_DETECTED,
        {
          ...metadata,
          exitTimestampRaw: snapshot.exitTimestampRaw,
        }
      );
    } else {
      const exitTimestamp = snapshot.exitTimestamp as number;
      const elapsedMs = snapshot.now - exitTimestamp;
      const failsafeEligible = elapsedMs > FAILSAFE_THRESHOLD_MS;

      logStructured(
        'DEBUG',
        'ESTADO_SISTEMA',
        AUDIT_ACTIONS.ACTIVE_SESSION_WITH_PENDING_EXIT,
        {
          ...metadata,
          exitTimestamp,
          elapsedMinutes: Math.round(elapsedMs / 60000),
          failsafeEligible,
        }
      );
    }
  }

  if (!snapshot.monitoringActive) {
    const sites = getMonitoringSites(snapshot.pendingSessions, activeSession);

    if (sites.length > 0) {
      await LocationService.startMonitoringArrival(sites, snapshot.radiusMeters);
      logStructured(
        'INFO',
        'REINICIO_MONITOREO',
        AUDIT_ACTIONS.MONITORING_RESTARTED,
        {
          ...metadata,
          restartReason: 'active_session_monitoring_inactive',
          siteCount: sites.length,
          radiusMeters: snapshot.radiusMeters,
        }
      );
      return {
        status: 'ok',
        details: 'active_session_reconciled_monitoring_restarted',
        metadata: {
          ...metadata,
          monitoringRestarted: true,
        },
      };
    }
  }

  return {
    status: 'ok',
    details: 'active_session_reconciled',
    metadata,
  };
}

export async function reconcileCompletedSessionState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  const snapshot = await buildRuntimeSnapshot();
  const hasOpenSessions = snapshot.pendingSessions.length > 0 || Boolean(snapshot.activeSession);

  if (hasOpenSessions) {
    return {
      status: 'skipped',
      details: 'open_session_still_present',
      metadata: {
        pendingCount: snapshot.pendingSessions.length,
        hasActiveSession: Boolean(snapshot.activeSession),
      },
    };
  }

  if (!snapshot.completedSessionToday?.id) {
    return { status: 'skipped', details: 'no_completed_session_today' };
  }

  if (snapshot.monitoringActive) {
    await LocationService.stopMonitoring();
    logStructured(
      'INFO',
      'MONITOREO_DETENIDO',
      AUDIT_ACTIONS.COMPLETED_SESSION_MONITORING_CLEARED,
      {
        source,
        sessionId: snapshot.completedSessionToday.id,
      }
    );

    return {
      status: 'ok',
      details: 'completed_session_monitoring_cleared',
      metadata: {
        sessionId: snapshot.completedSessionToday.id,
      },
    };
  }

  return {
    status: 'ok',
    details: 'completed_session_no_monitoring_cleanup_needed',
    metadata: {
      sessionId: snapshot.completedSessionToday.id,
    },
  };
}

export async function reconcileMonitoringState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  const snapshot = await buildRuntimeSnapshot();
  const sites = getMonitoringSites(snapshot.pendingSessions, snapshot.activeSession);
  const shouldMonitor = sites.length > 0;

  if (shouldMonitor && !snapshot.monitoringActive) {
    await LocationService.startMonitoringArrival(sites, snapshot.radiusMeters);
    logStructured(
      'INFO',
      'REINICIO_MONITOREO',
      AUDIT_ACTIONS.MONITORING_RESTARTED,
      {
        source,
        siteCount: sites.length,
        radiusMeters: snapshot.radiusMeters,
      }
    );

    return {
      status: 'ok',
      details: 'monitoring_restarted',
      metadata: { siteCount: sites.length },
    };
  }

  if (!shouldMonitor && snapshot.monitoringActive && snapshot.completedSessionToday?.id) {
    await LocationService.stopMonitoring();
    logStructured(
      'INFO',
      'MONITOREO_DETENIDO',
      AUDIT_ACTIONS.COMPLETED_SESSION_MONITORING_CLEARED,
      {
        source,
        sessionId: snapshot.completedSessionToday.id,
      }
    );

    return {
      status: 'ok',
      details: 'monitoring_disabled_for_completed_session',
      metadata: { sessionId: snapshot.completedSessionToday.id },
    };
  }

  return {
    status: 'ok',
    details: 'monitoring_state_already_consistent',
    metadata: {
      monitoringActive: snapshot.monitoringActive,
      shouldMonitor,
    },
  };
}

export async function reconcileExitTimestampState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileStepResult> {
  const snapshot = await buildRuntimeSnapshot();

  if (!snapshot.exitTimestampRaw) {
    return { status: 'skipped', details: 'no_exit_timestamp' };
  }

  const hasActiveSession = Boolean(snapshot.activeSession?.id);
  const hasCompletedSession = Boolean(snapshot.completedSessionToday?.id);

  if (
    isInvalidExitTimestamp(snapshot.exitTimestamp, snapshot.now)
  ) {
    logStructured(
      'WARN',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.EXIT_TIMESTAMP_INVALID_DETECTED,
      {
        source,
        exitTimestampRaw: snapshot.exitTimestampRaw,
        hasActiveSession,
        hasCompletedSession,
      }
    );

    if (!hasActiveSession && hasCompletedSession) {
      await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
      return {
        status: 'ok',
        details: 'invalid_exit_timestamp_cleared_after_completed',
      };
    }

    return {
      status: 'ok',
      details: 'invalid_exit_timestamp_preserved_ambiguous_state',
    };
  }

  const exitTimestamp = snapshot.exitTimestamp as number;
  const elapsedMs = snapshot.now - exitTimestamp;
  const isStale = elapsedMs > STALE_EXIT_TIMESTAMP_MS;

  if (isStale) {
    logStructured(
      'WARN',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.ACTIVE_SESSION_WITH_PENDING_EXIT,
      {
        source,
        exitTimestamp,
        elapsedMinutes: Math.round(elapsedMs / 60000),
        stale: true,
        hasActiveSession,
      }
    );
  }

  if (!hasActiveSession && hasCompletedSession) {
    await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
    return {
      status: 'ok',
      details: 'exit_timestamp_cleared_after_completed',
      metadata: {
        stale: isStale,
      },
    };
  }

  return {
    status: 'ok',
    details: isStale
      ? 'stale_exit_timestamp_detected_preserved'
      : 'exit_timestamp_preserved_for_failsafe',
    metadata: {
      stale: isStale,
      hasActiveSession,
    },
  };
}

/**
 * Orchestrates the runtime state reconciliation process.
 * Safeguarded against reentrancy and runtime failures.
 */
export async function reconcileRuntimeState(
  source: RuntimeReconcileSource
): Promise<RuntimeReconcileOutcome> {
  const steps = getDefaultStepResults();

  if (isReconciling) {
    logStructured(
      'INFO',
      'SIN_CAMBIOS',
      AUDIT_ACTIONS.RUNTIME_RECONCILE_SKIPPED,
      { source, reason: 'ALREADY_IN_PROGRESS' }
    );

    return {
      source,
      status: 'skipped',
      steps,
    };
  }

  isReconciling = true;

  try {
    logStructured(
      'EVENT',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.RUNTIME_RECONCILE_STARTED,
      { source }
    );

    const stepExecutions: {
      key: RuntimeReconcileStep;
      run: () => Promise<RuntimeReconcileStepResult>;
    }[] = [
      { key: 'pendingArrival', run: () => reconcilePendingArrivalSessions(source) },
      { key: 'activeSession', run: () => reconcileActiveSessionState(source) },
      { key: 'completedSession', run: () => reconcileCompletedSessionState(source) },
      { key: 'monitoring', run: () => reconcileMonitoringState(source) },
      { key: 'exitTimestamp', run: () => reconcileExitTimestampState(source) },
    ];

    let monitoringHandled = false;

    for (const step of stepExecutions) {
      if (step.key === 'monitoring' && monitoringHandled) {
        steps.monitoring = {
          status: 'skipped',
          details: 'monitoring_already_handled_by_previous_step',
        };
        continue;
      }

      try {
        steps[step.key] = await step.run();
      } catch (error) {
        steps[step.key] = {
          status: 'failed',
          details: 'step_failed',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }

      if (
        step.key === 'activeSession' &&
        steps.activeSession.details === 'active_session_reconciled_monitoring_restarted'
      ) {
        monitoringHandled = true;
      }

      if (
        step.key === 'completedSession' &&
        steps.completedSession.details === 'completed_session_monitoring_cleared'
      ) {
        monitoringHandled = true;
      }
    }

    const hasFailedStep = Object.values(steps).some((step) => step.status === 'failed');
    const hasNonSkippedStep = Object.values(steps).some(
      (step) => step.status === 'ok'
    );

    logStructured(
      'INFO',
      'OPERACION_EXITOSA',
      AUDIT_ACTIONS.RUNTIME_RECONCILE_COMPLETED,
      {
        source,
        hasFailedStep,
        steps,
      }
    );

    return {
      source,
      status: resolveOutcomeStatus(hasFailedStep, hasNonSkippedStep),
      steps,
    };
  } catch (error) {
    logStructured(
      'ERROR',
      'ERROR_CRITICO',
      AUDIT_ACTIONS.RUNTIME_RECONCILE_FAILED,
      {
        source,
        error: error instanceof Error ? error.message : String(error),
      }
    );

    return {
      source,
      status: 'failed',
      steps,
    };
  } finally {
    isReconciling = false;
  }
}

/**
 * Semantic wrappers for different entry points
 */
export async function onAppStart(): Promise<RuntimeReconcileOutcome> {
  return reconcileRuntimeState('APP_INIT');
}

export async function onAppForeground(): Promise<RuntimeReconcileOutcome> {
  return reconcileRuntimeState('FOREGROUND');
}

export async function onDashboardRefresh(): Promise<RuntimeReconcileOutcome> {
  return reconcileRuntimeState('DASHBOARD_REFRESH');
}

export async function onBackgroundMaintenance(): Promise<RuntimeReconcileOutcome> {
  return reconcileRuntimeState('BACKGROUND_TASK');
}
