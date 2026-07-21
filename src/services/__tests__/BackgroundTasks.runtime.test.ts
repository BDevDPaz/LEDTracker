import * as backgroundTasksModule from '../BackgroundTasks';

describe('BackgroundTasks runtime failsafe', () => {
  const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

  const FIXED_EXIT_TIMESTAMP_MS = 1_700_000_000_000;

  const MOCK_AUDIT_ACTIONS = {
    AUTO_CHECKOUT_FAILSAFE: 'AUTO_CHECKOUT_FAILSAFE',
    BACKGROUND_FAILSAFE_CHECK_STARTED: 'BACKGROUND_FAILSAFE_CHECK_STARTED',
    BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP:
      'BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP',
    BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET:
      'BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET',
    BACKGROUND_FAILSAFE_COMPLETED: 'BACKGROUND_FAILSAFE_COMPLETED',
    BACKGROUND_RUN_STARTED: 'BACKGROUND_RUN_STARTED',
    BACKGROUND_RUN_COMPLETED: 'BACKGROUND_RUN_COMPLETED',
    BACKGROUND_RUN_FAILED: 'BACKGROUND_RUN_FAILED',
    BACKGROUND_REPORT_CHECK_COMPLETED: 'BACKGROUND_REPORT_CHECK_COMPLETED',
    BACKGROUND_PENDING_REPORT_RETRY_COMPLETED:
      'BACKGROUND_PENDING_REPORT_RETRY_COMPLETED',
  };

  let mockAsyncStorage: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
  };

  let mockDb: {
    getFirstAsync: jest.Mock;
  };

  let updateSessionEndTime: jest.Mock;
  let runFailsafeCheck: () => Promise<boolean>;
  let recordFailsafeEligibilityEvidence: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockAsyncStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    mockDb = {
      getFirstAsync: jest.fn(),
    };

    updateSessionEndTime = jest.fn();
    recordFailsafeEligibilityEvidence = jest.fn();

    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: mockAsyncStorage,
      ...mockAsyncStorage,
    }));

    jest.doMock('expo-task-manager', () => ({
      defineTask: jest.fn(),
      isTaskRegisteredAsync: jest.fn(),
    }));

    jest.doMock('expo-background-task', () => ({
      BackgroundTaskResult: {
        Success: 'Success',
        Failed: 'Failed',
      },
      BackgroundTaskStatus: {
        Restricted: 'Restricted',
      },
      getStatusAsync: jest.fn(),
      registerTaskAsync: jest.fn(),
      unregisterTaskAsync: jest.fn(),
      triggerTaskWorkerForTestingAsync: jest.fn(),
    }));

    jest.doMock('expo-notifications', () => ({
      scheduleNotificationAsync: jest.fn(),
    }));

    jest.doMock('../LocationManager', () => ({
      EXIT_TIMESTAMP_KEY,
    }));

    jest.doMock('../ReportGenerator', () => ({
      generateWeeklyReport: jest.fn(),
      checkAndDeliverPendingReports: jest.fn(),
    }));

    jest.doMock('../../engine/workTrackerEngine', () => ({
      engine: {
        dispatch: jest.fn(),
      },
    }));

    jest.doMock('../../database/dbWorkQueue', () => ({
      runDatabaseWork: jest.fn((_name, work) => work()),
    }));

    jest.doMock('../../database/db', () => ({
      ensureDbReady: jest.fn(() => Promise.resolve(mockDb)),
      updateSessionEndTime,
    }));

    jest.doMock('../../runtime/locationEvidence', () => ({
      recordFailsafeEligibilityEvidence,
      recordExitTimestampEvidence: jest.fn(),
      LOCATION_EVIDENCE_SIGNAL_TYPES: {
        EXIT_TIMESTAMP_INVALID: 'EXIT_TIMESTAMP_INVALID',
      },
      LOCATION_EVIDENCE_DECISIONS: {
        NO_DECISION: 'NO_DECISION',
      },
    }));

    jest.doMock('../../utils/logger', () => ({
      AUDIT_ACTIONS: MOCK_AUDIT_ACTIONS,
      log: jest.fn(),
      logStructured: jest.fn(),
    }));

    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    mockDb.getFirstAsync.mockResolvedValue({
      id: 10,
      status: 'active',
      client_name: 'Client',
      actual_start_time: 1,
      start_time: 1,
      address: 'Site',
      location_confirmed: 1,
      is_manual_edit: 0,
      lunch_taken: 0,
      date_string: '2026-07-19',
    });

    runFailsafeCheck = backgroundTasksModule.runFailsafeCheck;
  });

  it('active + EXIT_TIMESTAMP_KEY + threshold cumplido cierra con AUTO_CHECKOUT_FAILSAFE usando timestamp real', async () => {
    const exitTimestamp = FIXED_EXIT_TIMESTAMP_MS;

    mockAsyncStorage.getItem.mockResolvedValue(exitTimestamp.toString());

    const processed = await runFailsafeCheck();

    expect(processed).toBe(true);

    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(EXIT_TIMESTAMP_KEY);

    expect(updateSessionEndTime).toHaveBeenCalledWith(
      10,
      exitTimestamp,
      MOCK_AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE
    );
    expect(recordFailsafeEligibilityEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 10,
        source: 'BackgroundTasks',
        eligible: true,
      })
    );

    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(EXIT_TIMESTAMP_KEY);
  });
});
