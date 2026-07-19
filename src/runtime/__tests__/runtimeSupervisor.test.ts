import { reconcileRuntimeState } from '../runtimeSupervisor';
import { locationAdapter } from '../locationAdapter';
import { sessionStoreAdapter } from '../sessionStoreAdapter';
import { registerAutoCheckinGps } from '../../services/LocationManager';
import { AUDIT_ACTIONS, logStructured } from '../../utils/logger';

jest.mock('../locationAdapter', () => ({
  locationAdapter: {
    getCurrentLocation: jest.fn(),
  },
}));

jest.mock('../sessionStoreAdapter', () => ({
  sessionStoreAdapter: {
    getSettings: jest.fn(),
    getPendingArrivalSessionsForDate: jest.fn(),
  },
}));

jest.mock('../../services/LocationManager', () => ({
  MIN_ACCURACY_METERS: 50,
  registerAutoCheckinGps: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  AUDIT_ACTIONS: {
    GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION:
      'GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION',
    GPS_SAMPLE_REJECTED_WEAK_ACCURACY:
      'GPS_SAMPLE_REJECTED_WEAK_ACCURACY',
    PENDING_ARRIVAL_RECONCILED_TO_ACTIVE:
      'PENDING_ARRIVAL_RECONCILED_TO_ACTIVE',
  },
  logStructured: jest.fn(),
}));

describe('runtimeSupervisor runtime reconciliation', () => {
  const pendingSession = {
    id: 1,
    status: 'pending_arrival',
    address: '18144 Burbank Blvd',
    latitude: 34.1718,
    longitude: -118.5193,
    start_time: 1,
    location_confirmed: 0,
    is_manual_edit: 0,
    lunch_taken: 0,
    date_string: '2026-07-19',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    (sessionStoreAdapter.getSettings as jest.Mock).mockResolvedValue({
      tolerance_radius: 200,
    });

    (
      sessionStoreAdapter.getPendingArrivalSessionsForDate as jest.Mock
    ).mockResolvedValue([pendingSession]);

    (registerAutoCheckinGps as jest.Mock).mockResolvedValue(true);
  });

  it('pending_arrival + APP_INIT + ubicación dentro del radio registra AUTO_CHECKIN_GPS', async () => {
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 10,
    });

    await reconcileRuntimeState('APP_INIT');

    expect(registerAutoCheckinGps).toHaveBeenCalledWith(
      pendingSession,
      expect.objectContaining({
        source: 'APP_INIT',
        latitude: 34.1718,
        longitude: -118.5193,
        accuracy: 10,
      })
    );

    expect(logStructured).toHaveBeenCalledWith(
      'INFO',
      'OPERACION_EXITOSA',
      AUDIT_ACTIONS.PENDING_ARRIVAL_RECONCILED_TO_ACTIVE,
      expect.objectContaining({
        source: 'APP_INIT',
        sessionId: pendingSession.id,
      })
    );
  });

  it('pending_arrival + FOREGROUND + GPS weak no registra check-in y loguea rechazo', async () => {
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 100,
    });

    await reconcileRuntimeState('FOREGROUND');

    expect(registerAutoCheckinGps).not.toHaveBeenCalled();

    expect(logStructured).toHaveBeenCalledWith(
      'DEBUG',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.GPS_SAMPLE_REJECTED_WEAK_ACCURACY,
      expect.objectContaining({
        source: 'FOREGROUND',
        geoAccuracy: 100,
      })
    );
  });

  it('pending_arrival + DASHBOARD_REFRESH + fuera del radio no registra check-in', async () => {
    (locationAdapter.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 34.5,
      longitude: -118.9,
      accuracy: 10,
    });

    await reconcileRuntimeState('DASHBOARD_REFRESH');

    expect(registerAutoCheckinGps).not.toHaveBeenCalled();

    expect(logStructured).toHaveBeenCalledWith(
      'DEBUG',
      'ESTADO_SISTEMA',
      AUDIT_ACTIONS.GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION,
      expect.objectContaining({
        source: 'DASHBOARD_REFRESH',
        geoAccuracy: 10,
      })
    );
  });
});

