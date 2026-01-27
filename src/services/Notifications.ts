// src/services/Notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from '../database/db';

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

  // ✅ BOTONES DE ACCIÓN
  await Notifications.setNotificationCategoryAsync('CHECKOUT_ACTION', [
    {
      identifier: 'FINISH_DAY',
      buttonTitle: 'Terminar por hoy 🏠',
      options: { isDestructive: false },
    },
    {
      identifier: 'TRANSIT',
      buttonTitle: 'Voy a otro sitio 🚗',
      options: { opensAppToForeground: true },
    },
  ]);
}

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
      type: Notifications.SchedulableTriggerInputTypes.DAILY, 
      hour: hour || 6,
      minute: minute || 0,
    },
  });
}

export async function snoozeNotification(minutes: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Recordatorio Pospuesto ⏳",
      body: "¿Ya llegaste? Toca para iniciar.",
      data: { action: 'OPEN_DAILY_SETUP' },
    },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60, 
      repeats: false 
    },
  });
}
