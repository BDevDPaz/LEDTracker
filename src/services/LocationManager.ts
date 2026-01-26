// src/services/LocationManager.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { getDB, updateSessionEndTime, getSettings, insertWorkSession } from '../database/db'; // ✅ Importamos insertWorkSession
import { WorkSession } from '../types';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { translations } from '../utils/i18n';

const LOCATION_TRACKING_TASK_NAME = 'WORK_LOCATION_TRACKING_TASK';

// ✅ Tarea en segundo plano (monitoreo continuo)
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data;
  if (!locations || !locations.length) return;

  try {
    const db = getDB();
    const location = locations[0];

    // 1. Obtener sesión activa
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );

    if (!session) {
      // Si no hay sesión activa, detener tracking para ahorrar batería
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
      return;
    }

    // 2. Configuración (radio de tolerancia)
    const settings = await getSettings();
    const tolerance = settings?.tolerance_radius || 50;

    // 3. Calcular distancia actual vs punto inicial
    const dist = getDistanceFromLatLonInMeters(
      session.latitude, session.longitude,
      location.coords.latitude, location.coords.longitude
    );

    // 4. Si sale del rango → AUTO-CHECKOUT + Notificación interactiva
    if (dist > tolerance) {
      console.log(`📍 Salida detectada: ${dist.toFixed(0)}m > ${tolerance}m`);

      // ✅ Cerramos la sesión actual (Sitio A)
      await updateSessionEndTime(session.id!, Date.now());

      const lang = settings?.language || 'es';
      const t = translations[lang];

      // ✅ Notificación interactiva para decidir acción
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t.alert_exit_title || "Salida Detectada 🛑",
          body: t.alert_exit_msg || "¿Terminaste tu día o vas a otro sitio?",
          data: { action: 'CHECKOUT_DECISION' }, // Se usará para manejar respuesta
        },
        trigger: null,
      });

      // ✅ Detener tracking temporalmente
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    }
  } catch (err) {
    console.error("❌ Background Task Error:", err);
  }
});

// ✅ Función para crear sesión de tránsito (cuando el usuario elige “Voy a otro sitio”)
export const createTransitSession = async () => {
  const settings = await getSettings();
  const userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

  await insertWorkSession({
    start_time: Date.now(),
    status: 'travel', // 🚗 Estado especial
    address: settings?.employer_name || 'Transito',
    latitude: userLoc.coords.latitude,
    longitude: userLoc.coords.longitude,
    location_confirmed: 1,
    is_manual_edit: 0,
    lunch_taken: 0,
    date_string: new Date().toISOString().split('T')[0]
  });

  // ✅ Reactivar tracking para monitorear llegada al nuevo sitio
  await LocationService.startActiveTracking();
};

// ✅ Servicio principal
export const LocationService = {
  requestPermissions: async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  },

  startActiveTracking: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    if (hasStarted) return;

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20, // Cada 20 metros
      deferredUpdatesInterval: 60000, // Cada 1 minuto
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "WorkTracker Activo",
        notificationBody: "Monitoreando ubicación de trabajo..."
      }
    });
  },

  stopMonitoring: async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    }
  }
};
