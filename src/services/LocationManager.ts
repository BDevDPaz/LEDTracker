// src/services/LocationManager.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, insertAuditLog } from '../database/db';
import { WorkSession } from '../types';

const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';

// --- CONFIGURACIÓN DE LA TAREA EN SEGUNDO PLANO ---
// Esta definición debe estar siempre en el scope global
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) return;

  const { eventType } = data; // eventType: 1 (Enter), 2 (Exit)
  const db = getDB();

  try {
    // Obtenemos la última sesión (incluso si está pendiente)
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
    );

    if (!session) return;

    // 🟦 CASO 1: ENTRADA A LA GEOCERCA (Auto Check-in)
    if (eventType === Location.GeofencingEventType.Enter) {
      console.log("📍 Geocerca: ENTRADA detectada.");
      
      // Si estamos esperando llegar (Fase 1) o viajando (Fase 4A)
      if (session.status === 'pending_arrival' || session.status === 'travel') {
        const now = Date.now();
        
        // Optimizamos ejecutando actualizaciones de DB, logs y notificaciones en paralelo
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
    
    // 🟥 CASO 2: SALIDA DE LA GEOCERCA (Inicio de Protocolo de Salida)
    else if (eventType === Location.GeofencingEventType.Exit) {
      console.log("📍 Geocerca: SALIDA detectada.");

      if (session.status === 'active') {
        const now = Date.now();

        // Optimizamos ejecutando almacenamiento, logs y notificaciones en paralelo
        await Promise.all([
          AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now.toString()),
          insertAuditLog(session.id!, 'GEOFENCE_EXIT', `Salida del radio de trabajo detectada.`),
          Notifications.scheduleNotificationAsync({
            content: {
              title: "⚠️ Saliste del área de trabajo",
              body: "¿Terminaste tu jornada o vas a otro sitio?",
              data: { action: 'CHECKOUT_DECISION' }, // Esto lo escucha el _layout
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
  // Solicitud de Permisos
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
      // Iniciamos la nueva geocerca directamente.
      // Expo Location reemplaza automáticamente cualquier tarea de geocerca existente con el mismo nombre.
      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: 'WORK_ZONE',
          latitude: lat,
          longitude: lng,
          radius: radius,
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
      // Ejecutamos la detención de geocerca y limpieza de almacenamiento en paralelo.
      // Usamos un bloque try/catch interno para stopGeofencingAsync para ignorar errores
      // si la tarea no está registrada, evitando la necesidad de un check previo.
      await Promise.all([
        (async () => {
          try {
            await Location.stopGeofencingAsync(GEOFENCE_TASK);
          } catch (e) {
            // Ignoramos error si la tarea no existía
          }
        })(),
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY)
      ]);
      console.log("🛑 Monitoreo detenido.");
    } catch (e) {
      console.error("Error deteniendo monitoreo:", e);
    }
  }
};
