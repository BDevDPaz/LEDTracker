import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, insertAuditLog } from '../database/db';
import { WorkSession } from '../types';

export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

// --- CONFIGURACIÓN DE LA TAREA EN SEGUNDO PLANO ---
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) return;

  const { eventType } = data;
  const db = getDB();

  try {
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
    );

    if (!session) return;

    // 🟦 ENTRADA
    if (eventType === Location.GeofencingEventType.Enter) {
      console.log("📍 Geocerca: ENTRADA detectada.");

      if (session.status === 'pending_arrival' || session.status === 'travel') {
        const now = Date.now();

        // ✔️ Integración final: paralelismo seguro
        await Promise.all([
          db.runAsync(
            "UPDATE work_sessions SET status = 'active', actual_start_time = ? WHERE id = ?",
            [now, session.id]
          ),
          insertAuditLog(session.id!, 'GEOFENCE_ENTRY', `Llegada al sitio: ${session.address}. Cambio a ACTIVE.`),
          AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
          Notifications.scheduleNotificationAsync({
            content: {
              title: "📍 Llegaste al sitio",
              body: "Check-in automático realizado. ¡Buen trabajo!",
              sound: true,
            },
            trigger: null,
          })
        ]);
      }
    }

    // 🟥 SALIDA
    else if (eventType === Location.GeofencingEventType.Exit) {
      console.log("📍 Geocerca: SALIDA detectada.");

      if (session.status === 'active') {
        const now = Date.now();

        // ✔️ Integración final: paralelismo seguro
        await Promise.all([
          AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now.toString()),
          insertAuditLog(session.id!, 'GEOFENCE_EXIT', `Salida del radio de trabajo detectada.`),
          Notifications.scheduleNotificationAsync({
            content: {
              title: "⚠️ Saliste del área de trabajo",
              body: "¿Terminaste tu jornada o vas a otro sitio?",
              data: { action: 'CHECKOUT_DECISION' },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              vibrate: [0, 500, 200, 500],
            },
            trigger: null,
          })
        ]);
      }
    }
  } catch (err) {
    console.error("Error en tarea de Geocerca:", err);
  }
});

// --- API PÚBLICA DEL SERVICIO ---
export const LocationService = {
  requestPermissions: async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  },

  /**
   * FASE 1 & 4A: Configurar Geocerca para esperar llegada.
   */
  startMonitoringArrival: async (lat: number, lng: number, radius: number = 200) => {
    try {
      // ✔️ Mantener limpieza previa (HEAD)
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);

      if (isRegistered) {
        try {
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
          console.log("🧹 Monitoreo previo limpiado.");
        } catch {
          console.log("Aviso: No se pudo limpiar geocerca previa.");
        }
      }

      // ✔️ Iniciar geocerca (ambas ramas coinciden)
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

      console.log(`📡 Monitoreando llegada a: ${lat}, ${lng} (Radio: ${radius}m)`);
      return true;
    } catch (e) {
      console.error("Error iniciando geocerca:", e);
      return false;
    }
  },

  /**
   * Detener todo (Al finalizar jornada)
   */
  stopMonitoring: async () => {
    try {
      // ✔️ Mantener versión HEAD (más completa)
      await Promise.all([
        Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {}),
        Location.stopLocationUpdatesAsync(GEOFENCE_TASK).catch(() => {}),
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY)
      ]);

      console.log("🛑 Monitoreo y rastreo detenidos.");
    } catch (e) {
      console.error("Error general deteniendo monitoreo:", e);
    }
  }
};
