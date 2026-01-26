// src/services/Notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from '../database/db'; // ✅ Para leer hora configurada

// ✅ Configuración inicial de permisos y canal
export async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('work-alerts', {
      name: 'Alertas de Trabajo',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowList: true,
    }),
  });
}

// ✅ Alarma diaria según hora en DB
export async function scheduleDailyMorningNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = await getSettings();
  const timeStr = settings?.start_time || '06:00';
  const [hour, minute] = timeStr.split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Buenos días ☀️",
      body: "¿A dónde irás a trabajar hoy?",
      data: { action: 'OPEN_DAILY_SETUP' },
      sound: true,
    },
    trigger: {
      hour: hour || 6,
      minute: minute || 0,
      repeats: true,
    },
  });

  console.log(`⏰ Alarma diaria programada: ${hour}:${minute}`);
}

// ✅ Snooze para recordatorio (ej. viaje)
export async function snoozeNotification(minutes: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Recordatorio ⏳",
      body: "¿Ya llegaste al nuevo sitio? Toca para iniciar.",
      data: { action: 'OPEN_DAILY_SETUP' },
    },
    trigger: { seconds: minutes * 60, repeats: false },
  });

  console.log(`🔔 Snooze programado en ${minutes} minutos`);
}
