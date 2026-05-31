// --- src/services/LocationManager.ts ---
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { log } from '../utils/logger';
import { getDB, insertAuditLog } from '../database/db';
import { WorkSession } from '../types';
import dayjs from '../utils/dayjsSetup';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

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

    // 🟦 ENTRADA (AUTO CHECK-IN)
    if (eventType === Location.GeofencingEventType.Enter) {
      log('NARANJA', 'EVENTO_GEOCERCA', 'EVENT', 'Geocerca: ENTRADA detectada.');

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
            `Auto Check-in (GPS) en: ${session.address}`
          ),
          AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
          Notifications.scheduleNotificationAsync({
            content: {
              title: '📍 Llegaste al sitio',
              body: 'Auto Check-in (GPS) realizado. ¡Buen trabajo!',
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

    // 🟥 SALIDA (Inicia el cronómetro de 15 min para el Auto Check-out)
    else if (eventType === Location.GeofencingEventType.Exit) {
      log(
        'NARANJA',
        'EVENTO_GEOCERCA',
        'EVENT',
        'Geocerca: SALIDA detectada. Iniciando temporizador de inactividad.'
      );

      if (session.status === 'active') {
        const now = dayjs().valueOf();

        await Promise.all([
          AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now.toString()),
          insertAuditLog(
            session.id!,
            'GEOFENCE_EXIT',
            'Salida del radio de trabajo detectada.'
          ),
          Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Saliste del área de trabajo',
              body: '¿Terminaste tu jornada o vas a otro sitio?',
              data: { action: 'CHECKOUT_DECISION' },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              vibrate: [0, 500, 200, 500],
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
      // ✅ Opción A: sobrescribir directamente la geocerca existente
      // sin detenerla primero.
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

      // Opcional: “warm-up” de GPS en foreground.
      // Si no lo quieres usar, puedes comentar esta línea.
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => {});

      log(
        'VERDE',
        'SERVICIOS_ACTIVOS',
        'INFO',
        `Monitoreando llegada a: ${lat}, ${lng} (Radio: ${radius}m)`
      );

      return true;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error iniciando geocerca', e);
      return false;
    }
  },

  stopMonitoring: async () => {
    try {
      await Promise.all([
        Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {}),
        Location.stopLocationUpdatesAsync(GEOFENCE_TASK).catch(() => {}),
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
      ]);

      log('ROJO', 'MONITOREO_DETENIDO', 'ERROR', 'Monitoreo y rastreo detenidos.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error general deteniendo monitoreo', e);
    }
  },
};

