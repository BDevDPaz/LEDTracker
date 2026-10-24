/**
 * Rastreo continuo: auto check-out > 3.2 km cierra la sesión y notifica GEOFENCE_EXIT.
 */
describe('LocationManager worksite tracking', () => {
  const SITE = { lat: 34.0522, lon: -118.2437 };
  // ~0.0001° lat ≈ 11 m ; 0.04° ≈ 4.4 km
  const near = { latitude: SITE.lat + 0.0005, longitude: SITE.lon, accuracy: 10 };
  const far = { latitude: SITE.lat + 0.04, longitude: SITE.lon, accuracy: 10 };

  let store: Record<string, string>;
  let mockDb: { getFirstAsync: jest.Mock; runAsync: jest.Mock };
  let updateSessionStatus: jest.Mock;
  let insertAuditLog: jest.Mock;
  let notifyAutoCheckoutGeofenceExit: jest.Mock;
  let stopLocationUpdates: jest.Mock;
  let startLocationUpdates: jest.Mock;
  let recordGpsSampleRejected: jest.Mock;
  let mockFsmUpdate: jest.Mock;
  let mockGetCurrentLocation: jest.Mock;
  let handlers: Record<string, any>;
  let LM: any;

  const session = {
    id: 9, status: 'active', address: 'Calle 1', client_name: 'ACME',
    latitude: SITE.lat, longitude: SITE.lon, target_latitude: SITE.lat, target_longitude: SITE.lon,
  };

  beforeEach(() => {
    jest.resetModules();
    store = {};
    handlers = {};
    mockDb = { getFirstAsync: jest.fn(async () => session), runAsync: jest.fn() };
    updateSessionStatus = jest.fn();
    insertAuditLog = jest.fn();
    notifyAutoCheckoutGeofenceExit = jest.fn();
    stopLocationUpdates = jest.fn();
    startLocationUpdates = jest.fn();
    recordGpsSampleRejected = jest.fn();
    mockFsmUpdate = jest.fn(async () => ({ transition: 'STAY' }));
    mockGetCurrentLocation = jest.fn();

    const asyncStorage = {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete store[k]; }),
    };
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: asyncStorage, ...asyncStorage }));
    jest.doMock('expo-task-manager', () => ({
      defineTask: jest.fn((name: string, h: any) => { handlers[name] = h; }),
      isTaskRegisteredAsync: jest.fn(),
    }));
    jest.doMock('expo-location', () => ({ GeofencingEventType: { Enter: 1, Exit: 2 }, Accuracy: { Balanced: 3 } }));
    jest.doMock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));
    jest.doMock('../LocationFSM', () => ({
      LocationFSM: jest.fn().mockImplementation(() => ({ update: mockFsmUpdate, reset: jest.fn() })),
    }));
    jest.doMock('../../runtime/locationAdapter', () => ({
      locationAdapter: {
        getCurrentLocation: mockGetCurrentLocation, startGeofencing: jest.fn(), stopGeofencing: jest.fn(),
        startLocationUpdates, stopLocationUpdates,
      },
    }));
    jest.doMock('../../database/db', () => ({
      ensureDbReady: jest.fn(async () => mockDb), insertAuditLog, getAllAsync: jest.fn(async () => []), updateSessionStatus,
    }));
    jest.doMock('../Notifications', () => ({ notifyGeofenceExitDetected: jest.fn(), notifyAutoCheckoutGeofenceExit }));
    jest.doMock('../../runtime/locationEvidence', () => ({
      recordLocationEvidence: jest.fn(), recordGpsSampleAccepted: jest.fn(), recordGpsSampleRejected,
      recordGeofenceEventEvidence: jest.fn(), recordExitTimestampEvidence: jest.fn(),
      LOCATION_EVIDENCE_DECISIONS: {}, LOCATION_EVIDENCE_SIGNAL_TYPES: {},
    }));
    jest.doMock('../../utils/logger', () => ({
      AUDIT_ACTIONS: { AUTO_CHECKOUT_GPS: 'AUTO_CHECKOUT_GPS', AUTO_SALIDA: 'AUTO_SALIDA', AUTO_ENTRADA: 'AUTO_ENTRADA', AUTO_CHECKIN_GPS: 'AUTO_CHECKIN_GPS' },
      log: jest.fn(), logStructured: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LM = require('../LocationManager');
  });

  const update = (c: any) => LM.handleWorksiteLocationUpdate([{ coords: c }]);

  it('registra la tarea de rastreo continuo', () => {
    expect(handlers[LM.WORKSITE_TRACKING_TASK]).toBeDefined();
  });

  it('cierra la sesión tras 3 lecturas > 3.2 km, detiene rastreo y notifica GEOFENCE_EXIT', async () => {
    expect(await update(far)).toBe('COUNTING');
    expect(await update(far)).toBe('COUNTING');
    expect(updateSessionStatus).not.toHaveBeenCalled();
    expect(await update(far)).toBe('CHECKED_OUT');

    expect(updateSessionStatus).toHaveBeenCalledWith(9, 'completed', 0, 'AUTO_CHECKOUT_GPS');
    expect(insertAuditLog).toHaveBeenCalledWith(9, 'AUTO_SALIDA', expect.any(String));
    expect(stopLocationUpdates).toHaveBeenCalledWith(LM.WORKSITE_TRACKING_TASK);
    expect(notifyAutoCheckoutGeofenceExit).toHaveBeenCalledWith(9, 'ACME');
  });

  it('una lectura cercana reinicia el contador', async () => {
    await update(far);
    await update(far);
    expect(await update(near)).toBe('RESET');
    await update(far);
    await update(far);
    expect(updateSessionStatus).not.toHaveBeenCalled();
  });

  it.each([null, 0, 500])('rechaza lecturas con precisión %p', async (accuracy) => {
    for (let i = 0; i < 4; i++) expect(await update({ ...far, accuracy })).toBe('REJECTED');
    expect(recordGpsSampleRejected).toHaveBeenCalled();
    expect(updateSessionStatus).not.toHaveBeenCalled();
  });

  it('sin sesión activa detiene el rastreo', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    expect(await update(far)).toBe('NO_SESSION');
    expect(stopLocationUpdates).toHaveBeenCalled();
  });

  it('entrada sospechosa (fuera de radio + 100 m) no alimenta la histéresis', async () => {
    mockGetCurrentLocation.mockResolvedValue(far);
    await handlers[LM.GEOFENCE_TASK]({
      data: { eventType: 1, region: { identifier: '9', radius: 150 } },
      error: null,
    });
    expect(mockFsmUpdate).not.toHaveBeenCalled();
  });

  it('el radio de entrada por defecto es 150 m', async () => {
    const start = jest.requireMock('../../runtime/locationAdapter').locationAdapter.startGeofencing;
    await LM.LocationService.startMonitoringArrival([{ id: '1', latitude: 1, longitude: 1 }]);
    expect(start.mock.calls[0][1][0].radius).toBe(150);
  });
});
