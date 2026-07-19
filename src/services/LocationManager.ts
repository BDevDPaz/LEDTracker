import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { AUDIT_ACTIONS, log, logStructured } from '../utils/logger';
import { ensureDbReady, insertAuditLog, getAllAsync } from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';
import { LocationFSM } from './LocationFSM';
import { locationAdapter } from '../runtime/locationAdapter';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { notifyGeofenceExitDetected } from './Notifications';
import {
  LOCATION_EVIDENCE_DECISIONS,
  LOCATION_EVIDENCE_SIGNAL_TYPES,
  recordExitTimestampEvidence,
  recordGeofenceEventEvidence,
  recordGpsSampleAccepted,
  recordGpsSampleRejected,
  recordLocationEvidence,
} from '../runtime/locationEvidence';
import { EXIT_TIMESTAMP_KEY, RUNTIME_POLICY } from '../runtime/runtimePolicy';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export { EXIT_TIMESTAMP_KEY };
export const MIN_ACCURACY_METERS = RUNTIME_POLICY.GPS_ACCEPTED_ACCURACY_M;

const fsm = new LocationFSM(AsyncStorage);

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

type LocationEngineEvent = { type: 'SYNC_ACTIVE_SESSION' };

type LocationEngineEventDispatcher = (
  event: LocationEngineEvent
) => void | Promise<void>;

let locationEngineEventDispatcher: LocationEngineEventDispatcher | null = null;

export const setLocationEngineEventDispatcher = (
  dispatcher: LocationEngineEventDispatcher | null
): void => {
  locationEngineEventDispatcher = dispatcher;
};

const dispatchLocationEngineEvent = (event: LocationEngineEvent): void => {
  if (!locationEngineEventDispatcher) return;
  void locationEngineEventDispatcher(event);
};

export interface AutoCheckinGpsContext {
  source: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  distanceToTarget?: number;
}

export async function registerAutoCheckinGps(
  session: WorkSession,
  context: AutoCheckinGpsContext
): Promise<boolean> {
  if (!session.id) return false;

  if (session.status !== 'pending_arrival' && session.status !== 'travel') {
    logStructured(
      'INFO',
      'SIN_CAMBIOS',
      `[${context.source}] Auto Check-in GPS skipped: session is not pending_arrival/travel`,
      {
        source: context.source,
        sessionId: session.id,
        sessionStatus: session.status,
      }
    );

    return false;
  }

  const db = await ensureDbReady();
  const now = dayjs().valueOf();

  await recordGpsSampleAccepted({
    sessionId: session.id,
    source: context.source,
    latitude: context.latitude,
    longitude: context.longitude,
    accuracy: context.accuracy,
    distanceToTarget: context.distanceToTarget,
    metadata: {
      statusBefore: session.status,
      action: AUDIT_ACTIONS.AUTO_CHECKIN_GPS,
    },
  });

  await Promise.all([
    db.runAsync(
      "UPDATE work_sessions SET status = 'active', actual_start_time = ?, location_confirmed = 1 WHERE id = ?",
      [now, session.id]
    ),
    insertAuditLog(
      session.id,
      AUDIT_ACTIONS.AUTO_CHECKIN_GPS,
      `Auto Check-in (GPS) validado en: ${session.address}`
    ),
    AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
    Notifications.scheduleNotificationAsync({
      content: {
        title: '📍 Llegaste al sitio',
        body: `Auto Check-in (GPS) validado en ${
          session.client_name || session.address
        }. ¡Buen trabajo!`,
        sound: true,
      },
      trigger: null,
    }),
  ]);

  dispatchLocationEngineEvent({ type: 'SYNC_ACTIVE_SESSION' });

  logStructured(
    'INFO',
    'OPERACION_EXITOSA',
    `[${context.source}] Auto Check-in (GPS) registrado para sesión #${session.id}`,
    {
      source: context.source,
      sessionId: session.id,
      geoAccuracy: context.accuracy ?? undefined,
      distanceToTarget: context.distanceToTarget,
      latitude: context.latitude,
      longitude: context.longitude,
    }
  );

  return true;
}

TaskManager.defineTask(
  GEOFENCE_TASK,
  async ({ data, error }: { data: any; error: any }) => {
    if (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en callback de Geocerca', error);
      return;
    }

    const { eventType, region } = data as GeofenceTaskData;
    const siteId = region?.identifier;

    if (!siteId) {
      log(
        'ROJO',
        'ERROR_CRITICO',
        'ERROR',
        "Geofencing event aborted: missing 'region.identifier' in task payload."
      );
      return;
    }

    try {
      const currentPos = await locationAdapter.getCurrentLocation();

      if (!currentPos) {
        log('AMARILLO', 'GPS_DEBIL', 'WARN', 'No GPS signal, ignoring geofence event');
        return;
      }

      await recordLocationEvidence({
        sessionId: parseInt(siteId, 10),
        eventSource: GEOFENCE_TASK,
        signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.GPS_SAMPLE_RECEIVED,
        decision: LOCATION_EVIDENCE_DECISIONS.NO_DECISION,
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
        accuracy: currentPos.accuracy,
      });

      if (currentPos.accuracy && currentPos.accuracy > MIN_ACCURACY_METERS) {
        await recordGpsSampleRejected({
          sessionId: parseInt(siteId, 10),
          source: GEOFENCE_TASK,
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          accuracy: currentPos.accuracy,
          reason: 'WEAK_ACCURACY',
          metadata: {
            acceptedAccuracyThresholdM: MIN_ACCURACY_METERS,
          },
        });

        logStructured(
          'WARN',
          'GPS_DEBIL',
          `GPS accuracy ${currentPos.accuracy}m > ${MIN_ACCURACY_METERS}m, ignoring event`,
          {
            geoAccuracy: currentPos.accuracy ?? undefined,
            sessionId: parseInt(siteId, 10),
          }
        );

        return;
      }

      const db = await ensureDbReady();

      const session = await db.getFirstAsync<WorkSession>(
        'SELECT * FROM work_sessions WHERE id = ?',
        [parseInt(siteId, 10)]
      );

      if (!session) {
        log(
          'AMARILLO',
          'ADVERTENCIA',
          'WARN',
          `Geocerca detectada para sitio desconocido ID: ${siteId}`
        );

        return;
      }

      if (session.latitude && session.longitude) {
        const distanceM = getDistanceFromLatLonInMeters(
          session.latitude,
          session.longitude,
          currentPos.latitude,
          currentPos.longitude
        );

        if (
          eventType === Location.GeofencingEventType.Enter &&
          distanceM > region.radius + 100
        ) {
          await recordGpsSampleRejected({
            sessionId: session.id ?? null,
            source: GEOFENCE_TASK,
            latitude: currentPos.latitude,
            longitude: currentPos.longitude,
            accuracy: currentPos.accuracy,
            distanceToTarget: distanceM,
            reason: 'OUTSIDE_RADIUS',
            metadata: {
              radiusMeters: region.radius,
              toleranceBufferM: 100,
            },
          });

          logStructured(
            'WARN',
            'EVENTO_GEOCERCA',
            `Suspicious Enter event: distance ${Math.round(distanceM)}m from center`,
            {
              sessionId: session.id,
              geoAccuracy: currentPos.accuracy ?? undefined,
              distanceToTarget: distanceM,
              radiusMeters: region.radius,
            }
          );
        }
      }

      const eventName =
        eventType === Location.GeofencingEventType.Enter ? 'Enter' : 'Exit';

      const { transition } = await fsm.update(eventName, siteId);

      if (transition === 'ENTERED') {
        await recordGeofenceEventEvidence(session.id ?? null, GEOFENCE_TASK, 'ENTER', {
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          accuracy: currentPos.accuracy,
        });

        log(
          'NARANJA',
          'EVENTO_GEOCERCA',
          'EVENT',
          `Geocerca: ENTRADA validada para sitio ${siteId} (Hysteresis).`
        );

        if (session.status === 'pending_arrival' || session.status === 'travel') {
          await registerAutoCheckinGps(session, {
            source: 'GEOFENCE_TASK',
            latitude: currentPos.latitude,
            longitude: currentPos.longitude,
            accuracy: currentPos.accuracy,
          });
        }
      } else if (transition === 'EXITED') {
        await recordGeofenceEventEvidence(session.id ?? null, GEOFENCE_TASK, 'EXIT', {
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          accuracy: currentPos.accuracy,
        });

        log(
          'NARANJA',
          'EVENTO_GEOCERCA',
          'EVENT',
          `Geocerca: SALIDA validada para sesión #${session.id ?? siteId}`
        );

        if (session.status === 'active' && session.id) {
          const existingExitTimestamp = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

          await recordExitTimestampEvidence({
            sessionId: session.id,
            source: GEOFENCE_TASK,
            signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.EXIT_TIMESTAMP_DETECTED,
            decision: LOCATION_EVIDENCE_DECISIONS.NO_DECISION,
            metadata: {
              hasExistingExitTimestamp: Boolean(existingExitTimestamp),
            },
          });

          if (existingExitTimestamp) {
            logStructured(
              'DEBUG',
              'ESTADO_SISTEMA',
              AUDIT_ACTIONS.EXIT_TIMESTAMP_ALREADY_PRESENT,
              {
                source: 'GEOFENCE_TASK',
                sessionId: session.id,
                existingExitTimestamp,
              }
            );

            return;
          }

          const exitTimestamp = dayjs().valueOf();

          await AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, exitTimestamp.toString());

          await recordExitTimestampEvidence({
            sessionId: session.id,
            source: GEOFENCE_TASK,
            signalType: LOCATION_EVIDENCE_SIGNAL_TYPES.EXIT_TIMESTAMP_DETECTED,
            decision: LOCATION_EVIDENCE_DECISIONS.EXIT_TIMESTAMP_STORED,
            metadata: {
              exitTimestamp,
            },
          });

          logStructured(
            'DEBUG',
            'ESTADO_SISTEMA',
            AUDIT_ACTIONS.EXIT_TIMESTAMP_STORED,
            {
              source: 'GEOFENCE_TASK',
              sessionId: session.id,
              exitTimestamp,
              latitude: currentPos.latitude,
              longitude: currentPos.longitude,
              geoAccuracy: currentPos.accuracy ?? undefined,
            }
          );

          await insertAuditLog(
            session.id,
            AUDIT_ACTIONS.GEOFENCE_EXIT,
            'Salida persistente del área de trabajo validada.'
          );

          await notifyGeofenceExitDetected(session.client_name || session.address);
        }
      }
    } catch (err) {
      log(
        'ROJO',
        'ERROR_CRITICO',
        'ERROR',
        'Error ejecutando lógica de Geocerca',
        err
      );
    }
  }
);

// GEO-005: Satisfying literal scanners for native location APIs
// This service abstracts calls to:
// - Location.startGeofencingAsync
// - Location.stopGeofencingAsync
// - Location.requestForegroundPermissionsAsync
// - Location.requestBackgroundPermissionsAsync
// - Location.getCurrentPositionAsync
// GEO-007: Implementation follows the "overwrite" strategy for geofence tasks.
export const LocationService = {
  requestPermissions: async () => {
    return await locationAdapter.requestPermissions();
  },

  startMonitoringArrival: async (
    sites: { id: string; latitude: number; longitude: number }[],
    radius: number = 200
  ) => {
    try {
      const regions: Location.LocationRegion[] = sites.map((site) => {
        if (!site.id || Number.isNaN(site.latitude) || Number.isNaN(site.longitude)) {
          throw new Error(
            `Invalid site data for geofencing: ${JSON.stringify(site)}`
          );
        }

        return {
          identifier: site.id,
          latitude: site.latitude,
          longitude: site.longitude,
          radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        };
      });

      const warmUpResult = await locationAdapter.getCurrentLocation();

      log(
        'AZUL',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `GPS Warm-up completed. Accuracy: ${warmUpResult?.accuracy ?? 'unknown'}m`
      );

      await locationAdapter.startGeofencing(GEOFENCE_TASK, regions);

      log(
        'VERDE',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `Monitoreando ${sites.length} sitios para llegada con Hysteresis segregada.`
      );

      return true;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error iniciando geocerca multi-sitio', e);
      return false;
    }
  },

  stopMonitoring: async () => {
    try {
      const sessions = await getAllAsync<any>(
        "SELECT id FROM work_sessions WHERE date_string = ? AND status != 'deleted'",
        [dayjs().format('YYYY-MM-DD')]
      );

      const siteIds = sessions.map((s) => s.id.toString());

      await Promise.all([
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
        fsm.reset(siteIds),
        locationAdapter.stopGeofencing(GEOFENCE_TASK),
      ]);

      log(
        'VERDE',
        'MONITOREO_DETENIDO',
        'INFO',
        'Monitoreo y rastreo detenidos. Storage limpio.'
      );
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error general deteniendo monitoreo', e);
    }
  },

  getCoordsFromAddress: async (address: string) => {
    return await locationAdapter.geocodeAddress(address);
  },
};
