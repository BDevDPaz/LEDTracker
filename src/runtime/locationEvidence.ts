import dayjs from '../utils/dayjsSetup';
import { ensureDbReady, getAllAsync } from '../database/db';
import { logStructured } from '../utils/logger';
import { RUNTIME_POLICY } from './runtimePolicy';

export const LOCATION_EVIDENCE_SIGNAL_TYPES = {
  GPS_SAMPLE_RECEIVED: 'GPS_SAMPLE_RECEIVED',
  GPS_SAMPLE_ACCEPTED: 'GPS_SAMPLE_ACCEPTED',
  GPS_SAMPLE_REJECTED_WEAK_ACCURACY: 'GPS_SAMPLE_REJECTED_WEAK_ACCURACY',
  GPS_SAMPLE_REJECTED_OUTSIDE_RADIUS: 'GPS_SAMPLE_REJECTED_OUTSIDE_RADIUS',
  GEOFENCE_ENTER_DETECTED: 'GEOFENCE_ENTER_DETECTED',
  GEOFENCE_EXIT_DETECTED: 'GEOFENCE_EXIT_DETECTED',
  EXIT_TIMESTAMP_DETECTED: 'EXIT_TIMESTAMP_DETECTED',
  EXIT_TIMESTAMP_INVALID: 'EXIT_TIMESTAMP_INVALID',
} as const;

export const LOCATION_EVIDENCE_DECISIONS = {
  NO_DECISION: 'NO_DECISION',
  CHECKIN_ELIGIBLE: 'CHECKIN_ELIGIBLE',
  CHECKIN_REJECTED: 'CHECKIN_REJECTED',
  EXIT_TIMESTAMP_STORED: 'EXIT_TIMESTAMP_STORED',
  FAILSAFE_ELIGIBLE: 'FAILSAFE_ELIGIBLE',
  FAILSAFE_NOT_ELIGIBLE: 'FAILSAFE_NOT_ELIGIBLE',
} as const;

export interface LocationEvidenceEntry {
  id?: number;
  session_id: number | null;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  distance_to_target: number | null;
  event_source: string;
  signal_type: string;
  decision: string;
  metadata: string | null;
  created_at: number;
}

interface LocationEvidencePayload {
  sessionId?: number | null;
  timestamp?: number;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distanceToTarget?: number | null;
  eventSource: string;
  signalType: string;
  decision: string;
  metadata?: Record<string, unknown>;
}

let lastCleanupAt = 0;

function serializeMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

async function maybeCleanupLocationEvidence(): Promise<void> {
  const now = dayjs().valueOf();
  const elapsedSinceLastCleanup = now - lastCleanupAt;

  if (elapsedSinceLastCleanup < RUNTIME_POLICY.LOCATION_EVIDENCE_CLEANUP_MIN_INTERVAL_MS) {
    return;
  }

  await cleanupOldLocationEvidence();
}

export async function recordLocationEvidence(payload: LocationEvidencePayload): Promise<void> {
  const database = await ensureDbReady();
  const now = dayjs().valueOf();
  const timestamp = payload.timestamp ?? now;

  await database.runAsync(
    `INSERT INTO location_evidence (
      session_id,
      timestamp,
      latitude,
      longitude,
      accuracy,
      distance_to_target,
      event_source,
      signal_type,
      decision,
      metadata,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.sessionId ?? null,
      timestamp,
      payload.latitude ?? null,
      payload.longitude ?? null,
      payload.accuracy ?? null,
      payload.distanceToTarget ?? null,
      payload.eventSource,
      payload.signalType,
      payload.decision,
      serializeMetadata(payload.metadata),
      now,
    ]
  );

  await maybeCleanupLocationEvidence();
}

export async function cleanupOldLocationEvidence(): Promise<void> {
  const database = await ensureDbReady();
  const now = dayjs().valueOf();
  const retentionMs = RUNTIME_POLICY.LOCATION_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const retentionCutoff = now - retentionMs;

  const byAgeResult = await database.runAsync(
    'DELETE FROM location_evidence WHERE created_at < ?',
    [retentionCutoff]
  );
  const removedByAge = byAgeResult.changes ?? 0;

  const countRow = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM location_evidence'
  );
  const totalCount = countRow?.count ?? 0;
  const overflow = Math.max(0, totalCount - RUNTIME_POLICY.LOCATION_EVIDENCE_MAX_ROWS);

  let removedByOverflow = 0;
  if (overflow > 0) {
    const overflowResult = await database.runAsync(
      `DELETE FROM location_evidence
       WHERE id IN (
         SELECT id
         FROM location_evidence
         ORDER BY created_at ASC
         LIMIT ?
       )`,
      [overflow]
    );
    removedByOverflow = overflowResult.changes ?? 0;
  }

  if (removedByAge > 0 || removedByOverflow > 0) {
    logStructured(
      'DEBUG',
      'ESTADO_SISTEMA',
      'LOCATION_EVIDENCE_CLEANUP_EXECUTED',
      {
        removedByAge,
        removedByOverflow,
        maxRows: RUNTIME_POLICY.LOCATION_EVIDENCE_MAX_ROWS,
        retentionDays: RUNTIME_POLICY.LOCATION_EVIDENCE_RETENTION_DAYS,
      }
    );
  }

  lastCleanupAt = now;
}

export async function getLocationEvidenceForSession(
  sessionId: number
): Promise<LocationEvidenceEntry[]> {
  return await getAllAsync<LocationEvidenceEntry>(
    `SELECT *
     FROM location_evidence
     WHERE session_id = ?
     ORDER BY timestamp DESC`,
    [sessionId]
  );
}

interface GpsSampleEvidenceContext {
  sessionId?: number | null;
  source: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distanceToTarget?: number | null;
  metadata?: Record<string, unknown>;
}

export async function recordGpsSampleAccepted(
  context: GpsSampleEvidenceContext
): Promise<void> {
  await recordLocationEvidence({
    sessionId: context.sessionId,
    eventSource: context.source,
    signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_ACCEPTED,
    decision: LOCATION_EVIDENCE_DECISIONS.CHECKIN_ELIGIBLE,
    latitude: context.latitude,
    longitude: context.longitude,
    accuracy: context.accuracy,
    distanceToTarget: context.distanceToTarget,
    metadata: context.metadata,
  });
}

export async function recordGpsSampleRejected(
  context: GpsSampleEvidenceContext & { reason: 'WEAK_ACCURACY' | 'OUTSIDE_RADIUS' }
): Promise<void> {
  const signalType =
    context.reason === 'WEAK_ACCURACY'
      ? LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_REJECTED_WEAK_ACCURACY
      : LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_REJECTED_OUTSIDE_RADIUS;

  await recordLocationEvidence({
    sessionId: context.sessionId,
    eventSource: context.source,
    signalType,
    decision: LOCATION_EVIDENCE_DECISIONS.CHECKIN_REJECTED,
    latitude: context.latitude,
    longitude: context.longitude,
    accuracy: context.accuracy,
    distanceToTarget: context.distanceToTarget,
    metadata: context.metadata,
  });
}

export async function recordGeofenceEventEvidence(
  sessionId: number | null,
  source: string,
  eventType: 'ENTER' | 'EXIT',
  context?: Omit<LocationEvidencePayload, 'sessionId' | 'eventSource' | 'signalType' | 'decision'>
): Promise<void> {
  const signalType =
    eventType === 'ENTER'
      ? LOCATION_EVIDENCE_SIGNAL_TYPES.GEOFENCE_ENTER_DETECTED
      : LOCATION_EVIDENCE_SIGNAL_TYPES.GEOFENCE_EXIT_DETECTED;

  await recordLocationEvidence({
    sessionId,
    eventSource: source,
    signalType,
    decision: LOCATION_EVIDENCE_DECISIONS.NO_DECISION,
    latitude: context?.latitude,
    longitude: context?.longitude,
    accuracy: context?.accuracy,
    distanceToTarget: context?.distanceToTarget,
    metadata: context?.metadata,
  });
}

export async function recordExitTimestampEvidence(context: {
  sessionId?: number | null;
  source: string;
  signalType: (typeof LOCATION_EVIDENCE_SIGNAL_TYPES)['EXIT_TIMESTAMP_DETECTED' | 'EXIT_TIMESTAMP_INVALID'];
  decision: (typeof LOCATION_EVIDENCE_DECISIONS)['NO_DECISION' | 'EXIT_TIMESTAMP_STORED'];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordLocationEvidence({
    sessionId: context.sessionId,
    eventSource: context.source,
    signalType: context.signalType,
    decision: context.decision,
    metadata: context.metadata,
  });
}

export async function recordFailsafeEligibilityEvidence(context: {
  sessionId?: number | null;
  source: string;
  eligible: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordLocationEvidence({
    sessionId: context.sessionId,
    eventSource: context.source,
    signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.EXIT_TIMESTAMP_DETECTED,
    decision: context.eligible
      ? LOCATION_EVIDENCE_DECISIONS.FAILSAFE_ELIGIBLE
      : LOCATION_EVIDENCE_DECISIONS.FAILSAFE_NOT_ELIGIBLE,
    metadata: context.metadata,
  });
}
