describe('workTrackerEffects runtime checkout semantics', () => {
  const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

  const MOCK_AUDIT_ACTIONS = {
    MANUAL_CHECKOUT: 'MANUAL_CHECKOUT',
    AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_FAILSAFE',
  };

  let mockAsyncStorage: {
    removeItem: jest.Mock;
  };

  let getAllAsync: jest.Mock;
  let updateSessionStatus: jest.Mock;
  let stopMonitoring: jest.Mock;
  let workTrackerEffects: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockAsyncStorage = {
      removeItem: jest.fn(),
    };

    getAllAsync = jest.fn();
    updateSessionStatus = jest.fn();
    stopMonitoring = jest.fn();

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: mockAsyncStorage,
      ...mockAsyncStorage,
    }));

    jest.doMock('../../runtime/runtimeSupervisor', () => ({
      reconcileRuntimeState: jest.fn(),
    }));

    jest.doMock('../../runtime/securityAdapter', () => ({
      securityAdapter: {
        sanitizeInput: jest.fn((value) => value),
      },
    }));

    jest.doMock('../../services/LocationManager', () => ({
      EXIT_TIMESTAMP_KEY,
      LocationService: {
        startMonitoringArrival: jest.fn(),
        stopMonitoring,
        getCoordsFromAddress: jest.fn(),
      },
    }));

    jest.doMock('../../database/dbWorkQueue', () => ({
      runDatabaseWork: jest.fn((_name, work) => work()),
    }));

    jest.doMock('../../database/db', () => ({
      getActiveSession: jest.fn(),
      getSettings: jest.fn(),
      saveSession: jest.fn(),
      updateSessionStatus,
      getAllAsync,
      saveSettings: jest.fn(),
    }));

    jest.doMock('../../utils/logger', () => ({
      AUDIT_ACTIONS: MOCK_AUDIT_ACTIONS,
      log: jest.fn(),
    }));

    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    getAllAsync.mockResolvedValue([]);
    updateSessionStatus.mockResolvedValue(undefined);
    stopMonitoring.mockResolvedValue(undefined);

    const effectsModule = require('../effects/workTrackerEffects') as typeof import('../effects/workTrackerEffects');
    workTrackerEffects = effectsModule.workTrackerEffects;
  });

  it('active + checkout manual después de exit timestamp cierra con MANUAL_CHECKOUT y limpia EXIT_TIMESTAMP_KEY', async () => {
    const dispatch = jest.fn();

    const state = {
      activeSession: {
        id: 7,
        status: 'active',
        address: '18144 Burbank Blvd',
        start_time: 1,
        actual_start_time: 1,
        location_confirmed: 1,
        is_manual_edit: 0,
        lunch_taken: 0,
        date_string: '2026-07-19',
      },
      settings: {
        tolerance_radius: 200,
      },
    } as any;

    await workTrackerEffects(
      {
        type: 'STOP_SESSION_REQUEST',
        lunchMinutes: 0,
      } as any,
      state,
      dispatch
    );

    expect(updateSessionStatus).toHaveBeenCalledWith(
      7,
      'completed',
      0,
      MOCK_AUDIT_ACTIONS.MANUAL_CHECKOUT
    );

    expect(updateSessionStatus).not.toHaveBeenCalledWith(
      expect.any(Number),
      expect.anything(),
      expect.anything(),
      MOCK_AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE
    );

    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(EXIT_TIMESTAMP_KEY);

    expect(stopMonitoring).toHaveBeenCalled();

    expect(dispatch).toHaveBeenCalledWith({
      type: 'DATA_LOADED',
      state: { activeSession: null },
    });
  });
});

