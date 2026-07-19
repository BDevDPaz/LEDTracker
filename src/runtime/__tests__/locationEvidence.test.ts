import { getAllAsync } from '../../database/db';
import { logStructured } from '../../utils/logger';
import {
  LOCATION_EVIDENCE_DECISIONS,
  LOCATION_EVIDENCE_SIGNAL_TYPES,
  cleanupOldLocationEvidence,
  getLocationEvidenceForSession,
  recordGpsSampleRejected,
  recordLocationEvidence,
} from '../locationEvidence';

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock('../../database/db', () => ({
  ensureDbReady: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
  })),
  getAllAsync: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logStructured: jest.fn(),
}));

describe('locationEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 0 });
    mockGetFirstAsync.mockResolvedValue({ count: 0 });
  });

  it('recordLocationEvidence guarda fila en location_evidence', async () => {
    await recordLocationEvidence({
      sessionId: 10,
      eventSource: 'TEST',
      signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_RECEIVED,
      decision: LOCATION_EVIDENCE_DECISIONS.NO_DECISION,
      latitude: 1.1,
      longitude: 2.2,
      accuracy: 20,
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO location_evidence'),
      expect.arrayContaining([10, 'TEST', LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_RECEIVED])
    );
  });

  it('recordGpsSampleRejected registra rechazo por weak accuracy con semántica estable', async () => {
    await recordGpsSampleRejected({
      sessionId: 7,
      source: 'APP_INIT',
      latitude: 10,
      longitude: 20,
      accuracy: 120,
      reason: 'WEAK_ACCURACY',
    });

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO location_evidence'),
      expect.arrayContaining([
        7,
        'APP_INIT',
        LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_REJECTED_WEAK_ACCURACY,
        LOCATION_EVIDENCE_DECISIONS.CHECKIN_REJECTED,
      ])
    );
  });

  it('cleanupOldLocationEvidence aplica retención por antigüedad y límite global', async () => {
    mockRunAsync
      .mockResolvedValueOnce({ changes: 3 })
      .mockResolvedValueOnce({ changes: 2 });
    mockGetFirstAsync.mockResolvedValue({ count: 5002 });

    await cleanupOldLocationEvidence();

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM location_evidence WHERE created_at < ?'),
      [expect.any(Number)]
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM location_evidence'),
      [2]
    );
    expect(logStructured).toHaveBeenCalledWith(
      'DEBUG',
      'ESTADO_SISTEMA',
      'LOCATION_EVIDENCE_CLEANUP_EXECUTED',
      expect.objectContaining({
        removedByAge: 3,
        removedByOverflow: 2,
      })
    );
  });

  it('getLocationEvidenceForSession consulta solo location_evidence (sin usar audit_logs)', async () => {
    (getAllAsync as jest.Mock).mockResolvedValue([]);

    await getLocationEvidenceForSession(22);

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM location_evidence'),
      [22]
    );
    expect((getAllAsync as jest.Mock).mock.calls[0][0]).not.toContain('audit_logs');
  });
});
