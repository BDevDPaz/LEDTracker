describe('LocationManager runtime geofence exit', () => {
  const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

  const MOCK_AUDIT_ACTIONS = {
    AUTO_CHECKIN_GPS: 'AUTO_CHECKIN_GPS',
    GEOFENCE_EXIT: 'GEOFENCE_EXIT',
    EXIT_TIMESTAMP_STORED: 'EXIT_TIMESTAMP_STORED',
    EXIT_TIMESTAMP_ALREADY_PRESENT: 'EXIT_TIMESTAMP_ALREADY_PRESENT',
  };

  let mockAsyncStorage: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
  };

  let mockGeofenceTaskHandler: any;

  let mockDb: {
    getFirstAsync: jest.Mock;
    runAsync: jest.Mock;
  };

  let mockFsmUpdate: jest.Mock;
  let mockGetCurrentLocation: jest.Mock;
  let insertAuditLog: jest.Mock;
  let notifyGeofenceExitDetected: jest.Mock;
  let logStructured: jest.Mock;
  let recordExitTimestampEvidence: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockAsyncStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    mockGeofenceTaskHandler = undefined;

    mockDb = {
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
    };

    mockFsmUpdate = jest.fn();
    mockGetCurrentLocation = jest.fn();
    insertAuditLog = jest.fn();
    notifyGeofenceExitDetected = jest.fn();
    logStructured = jest.fn();
    recordExitTimestampEvidence = jest.fn();

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: mockAsyncStorage,
      ...mockAsyncStorage,
    }));

    jest.doMock('expo-task-manager', () => ({
      defineTask: jest.fn((_taskName, handler) => {
        mockGeofenceTaskHandler = handler;
      }),
      isTaskRegisteredAsync: jest.fn(),
    }));

    jest.doMock('expo-location', () => ({
      GeofencingEventType: {
        Enter: 1,
        Exit: 2,
      },
      Accuracy: {
        Balanced: 3,
      },
    }));

    jest.doMock('expo-notifications', () => ({
      scheduleNotificationAsync: jest.fn(),
      AndroidNotificationPriority: {
        MAX: 'max',
      },
    }));

    jest.doMock('../LocationFSM', () => ({
      LocationFSM: jest.fn().mockImplementation(() => ({
        update: mockFsmUpdate,
        reset: jest.fn(),
      })),
    }));

    jest.doMock('../../runtime/locationAdapter', () => ({
      locationAdapter: {
        getCurrentLocation: mockGetCurrentLocation,
        startGeofencing: jest.fn(),
        stopGeofencing: jest.fn(),
        requestPermissions: jest.fn(),
        geocodeAddress: jest.fn(),
      },
    }));

    jest.doMock('../../database/db', () => ({
      ensureDbReady: jest.fn(() => Promise.resolve(mockDb)),
      insertAuditLog,
      getAllAsync: jest.fn(),
    }));

    jest.doMock('../Notifications', () => ({
      notifyGeofenceExitDetected,
    }));

    jest.doMock('../../runtime/locationEvidence', () => ({
      recordLocationEvidence: jest.fn(),
      recordGpsSampleAccepted: jest.fn(),
      recordGpsSampleRejected: jest.fn(),
      recordGeofenceEventEvidence: jest.fn(),
      recordExitTimestampEvidence,
      LOCATION_EVIDENCE_DECISIONS: {
        NO_DECISION: 'NO_DECISION',
        EXIT_TIMESTAMP_STORED: 'EXIT_TIMESTAMP_STORED',
      },
      LOCATION_EVIDENCE_SIGNAL_TYPES: {
        GPS_SAMPLE_RECEIVED: 'GPS_SAMPLE_RECEIVED',
        EXIT_TIMESTAMP_DETECTED: 'EXIT_TIMESTAMP_DETECTED',
      },
    }));

    jest.doMock('../../utils/logger', () => ({
      AUDIT_ACTIONS: MOCK_AUDIT_ACTIONS,
      log: jest.fn(),
      logStructured,
    }));

    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    mockFsmUpdate.mockResolvedValue({ transition: 'EXITED' });

    mockGetCurrentLocation.mockResolvedValue({
      latitude: 34.1718,
      longitude: -118.5193,
      accuracy: 12,
    });

    mockDb.getFirstAsync.mockResolvedValue({
      id: 2,
      status: 'active',
      address: '18144 Burbank Blvd',
      client_name: 'Test Client',
      latitude: 34.1718,
      longitude: -118.5193,
      start_time: 1,
      actual_start_time: 1,
      location_confirmed: 1,
      is_manual_edit: 0,
      lunch_taken: 0,
      date_string: '2026-07-19',
    });

    require('../LocationManager');
  });

  it('active + geofence exit guarda EXIT_TIMESTAMP_KEY y notifica salida', async () => {
    expect(mockGeofenceTaskHandler).toEqual(expect.any(Function));

    await mockGeofenceTaskHandler({
      data: {
        eventType: 2,
        region: {
          identifier: '2',
          latitude: 34.1718,
          longitude: -118.5193,
          radius: 200,
        },
      },
      error: null,
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      EXIT_TIMESTAMP_KEY,
      expect.any(String)
    );
    expect(recordExitTimestampEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 2,
        source: 'GEOFENCE_TASK',
        decision: 'EXIT_TIMESTAMP_STORED',
      })
    );

    expect(logStructured).toHaveBeenCalledWith(
      'DEBUG',
      'ESTADO_SISTEMA',
      MOCK_AUDIT_ACTIONS.EXIT_TIMESTAMP_STORED,
      expect.objectContaining({
        source: 'GEOFENCE_TASK',
        sessionId: 2,
      })
    );

    expect(insertAuditLog).toHaveBeenCalledWith(
      2,
      MOCK_AUDIT_ACTIONS.GEOFENCE_EXIT,
      'Salida persistente del área de trabajo validada.'
    );

    expect(notifyGeofenceExitDetected).toHaveBeenCalledWith('Test Client');
  });
});
