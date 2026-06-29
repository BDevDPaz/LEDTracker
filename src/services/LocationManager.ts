import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';

import { log } from '../utils/logger';
import { getDB, insertAuditLog, getAllAsync } from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';
import { LocationFSM } from './LocationFSM';
import { locationAdapter } from '../runtime/locationAdapter';
import { engine } from '../engine/workTrackerEngine';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

const fsm = new LocationFSM(AsyncStorage);

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
  const siteId = region.identifier;
  const db = getDB();

  try {
    // Site-Aware query: find the specific session matching the region identifier
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE id = ?",
      [parseInt(siteId, 10)]
    );

    if (!session) {
      log('AMARILLO', 'ADVERTENCIA', 'WARN', `Geocerca detectada para sitio desconocido ID: ${siteId}`);
      return;
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

        // Trigger engine update
        engine.dispatch({ type: 'APP_INIT' });

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
        'EVENTO_GEOCERCA',
        'EVENT',
        `Geocerca: SALIDA validada para sitio ${siteId} (Hysteresis). Iniciando temporizador.`
      );

      // Solo marcamos salida si esta es la sesión activa
      // Nota: Si hay múltiples sesiones active (raro pero posible), el failsafe se encargará.
      // Por ahora, si la sesión que disparó el Exit es active, guardamos el timestamp.
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

export const LocationService = {
  requestPermissions: async () => {
    return await locationAdapter.requestPermissions();
  },

  /**
   * Refactored to support multi-site monitoring.
   * @param sites Array of { id, latitude, longitude }
   * @param radius Default tolerance radius
   */
  startMonitoringArrival: async (
    sites: Array<{ id: string, latitude: number, longitude: number }>,
    radius: number = 200
  ) => {
    try {
      // GPS Warm-up
      await locationAdapter.getCurrentLocation();

      const regions: Location.LocationRegion[] = sites.map(site => ({
        identifier: site.id,
        latitude: site.latitude,
        longitude: site.longitude,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

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
      const db = getDB();
      // Obtenemos todos los IDs de sesiones pendientes o activas hoy para limpiar el FSM
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
