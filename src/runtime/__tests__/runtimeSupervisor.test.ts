import AsyncStorage from '@react-native-async-storage/async-storage';

import { reconcileRuntimeState } from '../runtimeSupervisor';
import { locationAdapter } from '../locationAdapter';
import { sessionStoreAdapter } from '../sessionStoreAdapter';
import { AUDIT_ACTIONS, logStructured } from '../../utils/logger';
import dayjs from '../../utils/dayjsSetup';
import { registerAutoCheckinGps, LocationService } from '../../services/LocationManager';
import {
  recordFailsafeEligibilityEvidence,
  recordGpsSampleAccepted,
  recordGpsSampleRejected,
} from '../locationEvidence';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../locationEvidence', () => ({
  recordGpsSampleAccepted: jest.fn(),
  recordGpsSampleRejected: jest.fn(),
  recordFailsafeEligibilityEvidence: jest.fn(),
  recordExitTimestampEvidence: jest.fn(),
  recordLocationEvidence: jest.fn(),
  LOCATION_EVIDENCE_SIGNAL_TYPES: {
    EXIT_TIMESTAMP_INVALID: 'EXIT_TIMESTAMP_INVALID',
    EXIT_TIMESTAMP_DETECTED: 'EXIT_TIMESTAMP_DETECTED',
  },
  LOCATION_EVIDENCE_DECISIONS: {
    NO_DECISION: 'NO_DECISION',
  },
}));

jest.mock('../locationAdapter', () => ({
  locationAdapter: {
    getCurrentLocation: jest.fn(),
    isTaskRegistered: jest.fn(),
  },
}));

jest.mock('../sessionStoreAdapter', () => ({
  sessionStoreAdapter: {
    getSettings: jest.fn(),
    getPendingArrivalSessionsForDate: jest.fn(),
    getHistory: jest.fn(),
  },
}));

jest.mock('../../services/LocationManager', () => ({
  EXIT_TIMESTAMP_KEY: 'LAST_GEOFENCE_EXIT_TIMESTAMP',
  GEOFENCE_TASK: 'GEOFENCE_TRACKING_TASK',
  registerAutoCheckinGps: jest.fn(),
  LocationService: {
    startMonitoringArrival: jest.fn(),
    stopMonitoring: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  AUDIT_ACTIONS: {
    RUNTIME_RECONCILE_STARTED: 'RUNTIME_RECONCILE_STARTED',
    RUNTIME_RECONCILE_COMPLETED: 'RUNTIME_RECONCILE_COMPLETED',
    RUNTIME_RECONCILE_SKIPPED: 'RUNTIME_RECONCILE_SKIPPED',
    RUNTIME_RECONCILE_FAILED: 'RUNTIME_RECONCILE_FAILED',
    GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION:
      'GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION',
    GPS_SAMPLE_REJECTED_WEAK_ACCURACY:
      'GPS_SAMPLE_REJECTED_WEAK_ACCURACY',
    PENDING_ARRIVAL_RECONCILED_TO_ACTIVE:
      'PENDING_ARRIVAL_RECONCILED_TO_ACTIVE',
    PENDING_ARRIVAL_STALE_DETECTED: 'PENDING_ARRIVAL_STALE_DETECTED',
    ACTIVE_SESSION_WITH_PENDING_EXIT: 'ACTIVE_SESSION_WITH_PENDING_EXIT',
    MONITORING_RESTARTED: 'MONITORING_RESTARTED',
    EXIT_TIMESTAMP_INVALID_DETECTED: 'EXIT_TIMESTAMP_INVALID_DETECTED',
    COMPLETED_SESSION_MONITORING_CLEARED:
      'COMPLETED_SESSION_MONITORING_CLEARED',
  },
  logStructured: jest.fn(),
}));

describe('runtimeSupervisor runtime reconciliation', () => {
  const today = dayjs().format('YYYY-MM-DD');
  const now = dayjs().valueOf();

  const pendingSession = {
    id: 1,
    status: 'pending_arrival',
    address: '18144 Burbank Blvd',
    latitude: 34.1718,
    longitude: -118.5193,
    start_time: now,
    location_confirmed: 0,
    is_manual_edit: 0,
    lunch_taken: 0,
    date_string: today,
  } as any;

  const activeSession = {
    id: 2,
    status: 'active',
    address: '18144 Burbank Blvd',
    latitude: 34.1718,
    longitude: -118.5193,
    start_time: now - 2 * 60 * 60 * 1000,
    date_string: today,
  } as any;

  const completedSession = {
    id: 3,
    status: 'completed',
    address: '18144 Burbank Blvd',
    latitude: 34.1718,
    longitude: -118.5193,
    start_time: now - 3 * 60 * 60 * 1000,
    end_time: now - 30 * 60 * 1000,
    date_string: today,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    (sessionStoreAdapter.getSettings as jest.Mock).mockResolvedValue({
      tolerance_radius: 200,
    });

    (
      sessionStoreAdapter.getPendingArrivalSessionsForDate as jest.Mock
    ).mockResolvedValue([]);

    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([]);

    (locationAdapter.isTaskRegistered as jest.Mock).mockResolvedValue(false);
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue(null);
    (registerAutoCheckinGps as jest.Mock).mockResolvedValue(true);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('APP_INIT + pending_arrival + valid GPS realiza auto-checkin', async () => {
    (
      sessionStoreAdapter.getPendingArrivalSessionsForDate as jest.Mock
    ).mockResolvedValue([pendingSession]);
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([pendingSession]);
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 10,
    });

    const result = await reconcileRuntimeState('APP_INIT');

    expect(registerAutoCheckinGps).toHaveBeenCalledWith(
      pendingSession,
      expect.objectContaining({
        source: 'APP_INIT',
        latitude: 34.1718,
        longitude: -118.5193,
      })
    );
    expect(recordGpsSampleAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'APP_INIT',
      })
    );
    expect(result.status).toBe('completed');
  });

  it('APP_INIT + pending_arrival + weak GPS omite auto-checkin', async () => {
    (
      sessionStoreAdapter.getPendingArrivalSessionsForDate as jest.Mock
    ).mockResolvedValue([pendingSession]);
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([pendingSession]);
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 100,
    });

    await reconcileRuntimeState('APP_INIT');

    expect(registerAutoCheckinGps).not.toHaveBeenCalled();
    expect(recordGpsSampleRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'APP_INIT',
        accuracy: 100,
        reason: 'WEAK_ACCURACY',
      })
    );
    expect(logStructured).toHaveBeenCalledWith(
      'DEBUG',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.GPS_SAMPLE_REJECTED_WEAK_ACCURACY,
      expect.objectContaining({
        source: 'APP_INIT',
        geoAccuracy: 100,
      })
    );
  });

  it('FOREGROUND + active + EXIT_TIMESTAMP_KEY stale audita detección', async () => {
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([activeSession]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      String(now - 13 * 60 * 60 * 1000)
    );

    await reconcileRuntimeState('FOREGROUND');

    expect(recordFailsafeEligibilityEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: activeSession.id,
        source: 'FOREGROUND',
        eligible: true,
      })
    );
    expect(logStructured).toHaveBeenCalledWith(
      expect.any(String),
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.ACTIVE_SESSION_WITH_PENDING_EXIT,
      expect.objectContaining({
        source: 'FOREGROUND',
      })
    );
  });

  it('FOREGROUND + active + monitoring inactive intenta reinicio', async () => {
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([activeSession]);
    (locationAdapter.isTaskRegistered as jest.Mock).mockResolvedValue(false);

    await reconcileRuntimeState('FOREGROUND');

    expect(LocationService.startMonitoringArrival).toHaveBeenCalledWith(
      [
        {
          id: activeSession.id.toString(),
          latitude: activeSession.latitude,
          longitude: activeSession.longitude,
        },
      ],
      200
    );
  });

  it('completed + monitoring active limpia monitoreo sobrante', async () => {
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([completedSession]);
    (locationAdapter.isTaskRegistered as jest.Mock).mockResolvedValue(true);

    await reconcileRuntimeState('FOREGROUND');

    expect(LocationService.stopMonitoring).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith(
      'INFO',
      'MONITOREO_DETENIDO',
      AUDIT_ACTIONS.COMPLETED_SESSION_MONITORING_CLEARED,
      expect.objectContaining({
        source: 'FOREGROUND',
      })
    );
  });

  it('idempotencia: reconciliar dos veces mantiene resultado estable', async () => {
    (
      sessionStoreAdapter.getPendingArrivalSessionsForDate as jest.Mock
    ).mockResolvedValue([pendingSession]);
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([pendingSession]);
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 120,
    });

    const first = await reconcileRuntimeState('FOREGROUND');
    const second = await reconcileRuntimeState('FOREGROUND');

    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
    expect(registerAutoCheckinGps).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('estado ambiguo no borra EXIT_TIMESTAMP_KEY de forma destructiva', async () => {
    (sessionStoreAdapter.getHistory as jest.Mock).mockResolvedValue([activeSession]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-a-number');

    await reconcileRuntimeState('FOREGROUND');

    expect(logStructured).toHaveBeenCalledWith(
      'WARN',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.EXIT_TIMESTAMP_INVALID_DETECTED,
      expect.objectContaining({
        source: 'FOREGROUND',
      })
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});
