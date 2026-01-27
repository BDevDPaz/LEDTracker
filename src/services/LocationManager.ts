// src/services/LocationManager.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, updateSessionEndTime, getSettings, insertWorkSession } from '../database/db';
import { WorkSession } from '../types';
import { getDistanceFromLatLonInMeters } from '../utils/geoUtils';
import { translations } from '../utils/i18n';

const LOCATION_TRACKING_TASK_NAME = 'WORK_LOCATION_TRACKING_TASK';
const DRIFT_COUNTER_KEY = 'GPS_DRIFT_COUNTER';
const MAX_DRIFT_STRIKES = 3;

TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data;
  if (!locations || !locations.length) return;

  try {
    const db = getDB();
    const validLocations = locations.filter((l: any) => l.coords.accuracy && l.coords.accuracy < 60);
    if (validLocations.length === 0) return;

    const location = validLocations[0];
    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );

    if (!session) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
      await AsyncStorage.removeItem(DRIFT_COUNTER_KEY);
      return;
    }

    const settings = await getSettings();
    const tolerance = settings?.tolerance_radius || 50;
    
    const dist = getDistanceFromLatLonInMeters(
      session.latitude, session.longitude,
      location.coords.latitude, location.coords.longitude
    );

    console.log(`📡 GPS: ${dist.toFixed(0)}m / ${tolerance}m | Acc: ${location.coords.accuracy}m`);

    if (dist > tolerance) {
      const currentStrikes = parseInt(await AsyncStorage.getItem(DRIFT_COUNTER_KEY) || '0');
      const newStrikes = currentStrikes + 1;
      
      if (newStrikes >= MAX_DRIFT_STRIKES) {
        console.log("✅ Salida CONFIRMADA.");
        await updateSessionEndTime(session.id!, Date.now());
        await AsyncStorage.removeItem(DRIFT_COUNTER_KEY);

        const lang = settings?.language || 'es';
        const t = translations[lang];

        await Notifications.scheduleNotificationAsync({
          content: {
            title: t.alert_exit_title || "Has salido del sitio 🛑",
            body: "¿Terminaste tu día o vas a otro lugar?",
            data: { action: 'CHECKOUT_DECISION', sessionId: session.id },
            categoryIdentifier: 'CHECKOUT_ACTION',
            sound: true,
          },
          trigger: null,
        });

        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
      } else {
        console.log(`⚠️ Advertencia ${newStrikes}/${MAX_DRIFT_STRIKES}`);
        await AsyncStorage.setItem(DRIFT_COUNTER_KEY, newStrikes.toString());
      }
    } else {
      await AsyncStorage.setItem(DRIFT_COUNTER_KEY, '0');
    }
  } catch (err) {
    console.error("❌ Background Task Error:", err);
  }
});

export const createTransitSession = async () => {
  const db = getDB();
  const settings = await getSettings();
  const userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

  // ✅ MEJORA: Evitar huecos no pagados
  // Buscamos la última sesión completada para encadenar tiempos
  const lastSession = await db.getFirstAsync<WorkSession>(
    "SELECT * FROM work_sessions WHERE status = 'completed' ORDER BY end_time DESC LIMIT 1"
  );

  // Si existe una sesión previa reciente (menos de 30 mins), usamos su final como inicio
  // Si no, usamos Date.now()
  let startTime = Date.now();
  if (lastSession && lastSession.end_time) {
      const gap = startTime - lastSession.end_time;
      // Solo encadenamos si la brecha es razonable (< 30 min)
      if (gap < 30 * 60 * 1000) {
          startTime = lastSession.end_time;
      }
  }

  const localDate = new Date(startTime);
  const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

  await insertWorkSession({
    start_time: startTime, // Tiempo encadenado
    status: 'travel',
    address: 'En Tránsito 🚗',
    latitude: userLoc.coords.latitude,
    longitude: userLoc.coords.longitude,
    location_confirmed: 1,
    is_manual_edit: 0,
    lunch_taken: 0,
    date_string: dateStr
  });

  await LocationService.startActiveTracking();
};

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
    
    await AsyncStorage.setItem(DRIFT_COUNTER_KEY, '0');

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
      accuracy: Location.Accuracy.High, // ALTA PRECISIÓN
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "WorkTracker Activo",
        notificationBody: "Monitoreando ubicación..."
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
