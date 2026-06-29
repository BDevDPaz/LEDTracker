import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { log } from '../utils/logger';
import { getDB, insertAuditLog } from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';
import { LocationFSM } from './LocationFSM';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

const fsm = new LocationFSM(AsyncStorage);

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en callback de Geocerca', error);
    return;
  }

  const { eventType } = data;
  const db = getDB();

  try {
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
    );

    if (!session) return;

    const eventName = eventType === Location.GeofencingEventType.Enter ? 'Enter' : 'Exit';
    const { transition } = await fsm.update(eventName);

    if (transition === 'ENTERED') {
      log('NARANJA', 'EVENTO_GEOCERCA', 'EVENT', 'Geocerca: ENTRADA validada (Hysteresis).');

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
              body: 'Auto Check-in (GPS) validado. ¡Buen trabajo!',
              sound: true,
            },
            trigger: null,
          }),
        ]);

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
        'Geocerca: SALIDA validada (Hysteresis). Iniciando temporizador.'
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
              body: 'Se detectó tu salida del área de trabajo.',
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
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  },

  startMonitoringArrival: async (
    lat: number,
    lng: number,
    radius: number = 200
  ) => {
    try {
      await fsm.reset();

      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: 'WORK_ZONE',
          latitude: lat,
          longitude: lng,
          radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      log(
        'VERDE',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `Monitoreando llegada a: ${lat}, ${lng} (Radio: ${radius}m) con Hysteresis`
      );

      return true;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error iniciando geocerca', e);
      return false;
    }
  },

  stopMonitoring: async () => {
    try {
      const isGeofenceRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);

      await Promise.all([
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
        fsm.reset()
      ]);

      if (isGeofenceRegistered) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }

      log('ROJO', 'MONITOREO_DETENIDO', 'ERROR', 'Monitoreo y rastreo detenidos.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error general deteniendo monitoreo', e);
    }
  },

  getCoordsFromAddress: async (address: string) => {
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
      return null;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error geocodificando dirección', e);
      return null;
    }
  },
};
