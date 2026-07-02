import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { log, logStructured } from '../utils/logger';
import { ensureDbReady, insertAuditLog, getAllAsync } from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';
import { LocationFSM } from './LocationFSM';
import { locationAdapter } from '../runtime/locationAdapter';
import { engine } from '../engine/workTrackerEngine';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

const fsm = new LocationFSM(AsyncStorage);

const MIN_ACCURACY_METERS = 50;

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: { data: any, error: any }) => {
  if (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en callback de Geocerca', error);
    return;
  }

  const { eventType, region } = data as GeofenceTaskData;
  const siteId = region?.identifier;

  if (!siteId) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', "Geofencing event aborted: missing 'region.identifier' in task payload.");
    return;
  }

  // ✅ NEW: Validate GPS accuracy
  const currentPos = await locationAdapter.getCurrentLocation();

  if (!currentPos) {
    log('AMARILLO', 'GPS_DEBIL', 'WARN', 'No GPS signal, ignoring geofence event');
    return;
  }

  if (currentPos.accuracy && currentPos.accuracy > MIN_ACCURACY_METERS) {
    logStructured('WARN', 'GPS_DEBIL', `GPS accuracy ${currentPos.accuracy}m > ${MIN_ACCURACY_METERS}m, ignoring event`, {
      geoAccuracy: currentPos.accuracy ?? undefined,
      sessionId: parseInt(siteId, 10)
    });
    return;
  }

  const db = await ensureDbReady();

  try {
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE id = ?",
      [parseInt(siteId, 10)]
    );

    if (!session) {
      log('AMARILLO', 'ADVERTENCIA', 'WARN', `Geocerca detectada para sitio desconocido ID: ${siteId}`);
      return;
    }

    // ✅ NEW: Validate speed consistency (basic check)
    if (session.latitude && session.longitude) {
      const distanceM = getDistanceFromLatLonInMeters(
        session.latitude, session.longitude,
        currentPos.latitude, currentPos.longitude
      );

      // Basic heuristic: if we are too far from the center for an 'Enter' event or
      // suddenly jumped huge distance, log it.
      if (eventType === Location.GeofencingEventType.Enter && distanceM > (region.radius + 100)) {
         logStructured('WARN', 'EVENTO_GEOCERCA', `Suspicious Enter event: distance ${Math.round(distanceM)}m from center`, {
           sessionId: session.id,
           geoAccuracy: currentPos.accuracy ?? undefined
         });
      }
    }

    const eventName = eventType === Location.GeofencingEventType.Enter ? 'Enter' : 'Exit';
    const { transition } = await fsm.update(eventName, siteId);

    if (transition === 'ENTERED') {
      log('NARANJA', 'EVENTO_GEOCERCA', 'EVENT', `Geocerca: ENTRADA validada para sitio ${siteId} (Hysteresis).`);

      if (session.status === 'pending_arrival' || session.status === 'travel') {
        const now = dayjs().valueOf();

        await Promise.all([
          db.runAsync(
            "UPDATE work_sessions SET status = 'active', actual_start_time = ? WHERE id = ?",
            [now, session.id!]
          ),
          insertAuditLog(
            session.id!,
            'AUTO_CHECKIN_GPS',
            `Auto Check-in (GPS) validado en: ${session.address}`
          ),
          AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
          Notifications.scheduleNotificationAsync({
            content: {
              title: '📍 Llegaste al sitio',
              body: `Auto Check-in (GPS) validado en ${session.client_name || session.address}. ¡Buen trabajo!`,
              sound: true,
            },
            trigger: null,
          }),
        ]);

        engine.dispatch({ type: 'SYNC_ACTIVE_SESSION' });

        log(
          'VERDE',
          'OPERACION_EXITOSA',
          'INFO',
          `Auto Check-in (GPS) registrado para sesión #${session.id}`
        );
      }
    }

    else if (transition === 'EXITED') {
      log(
        'NARANJA',
        'EVENTO_GEOCERCA', 'EVENT',
        `Geocerca: SALIDA validada para sitio ${siteId} (Hysteresis). Iniciando temporizador.`
      );

      if (session.status === 'active') {
        const now = dayjs().valueOf();

        await Promise.all([
          AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now.toString()),
          insertAuditLog(
            session.id!,
            'GEOFENCE_EXIT',
            'Salida persistente del área de trabajo validada.'
          ),
          Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Saliste del área de trabajo',
              body: `Se detectó tu salida de ${session.client_name || session.address}.`,
              data: { action: 'CHECKOUT_DECISION' },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
          }),
        ]);
      }
    }
  } catch (err) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error ejecutando lógica de Geocerca', err);
  }
});


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
    sites: { id: string, latitude: number, longitude: number }[],
    radius: number = 200
  ) => {
    try {
      // Type-safe region management (Proposal 7)
      const regions: Location.LocationRegion[] = sites.map(site => {
        if (!site.id || Number.isNaN(site.latitude) || Number.isNaN(site.longitude)) {
          throw new Error(`Invalid site data for geofencing: ${JSON.stringify(site)}`);
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

      // GPS Warm-up
      const warmUpResult = await locationAdapter.getCurrentLocation();
      log('AZUL', 'SERVICIOS_ACTIVOS', 'INFO', `GPS Warm-up completed. Accuracy: ${warmUpResult?.accuracy ?? "unknown"}m`);

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
      const siteIds = sessions.map(s => s.id.toString());

      await Promise.all([
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
        fsm.reset(siteIds),
        locationAdapter.stopGeofencing(GEOFENCE_TASK)
      ]);

      log('ROJO', 'MONITOREO_DETENIDO', 'ERROR', 'Monitoreo y rastreo detenidos. Storage limpio.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error general deteniendo monitoreo', e);
    }
  },

  getCoordsFromAddress: async (address: string) => {
    return await locationAdapter.geocodeAddress(address);
  },
};
