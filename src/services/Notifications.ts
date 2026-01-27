// src/services/Notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from '../database/db';

// 1. Configuración Inicial
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
}

// 2. Alarma Diaria (CORREGIDA)
export async function scheduleDailyMorningNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  // Leemos la hora configurada (o usamos 06:00 por defecto)
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
      // ✅ FIX CRÍTICO: Especificar el tipo de trigger explícitamente
      type: Notifications.SchedulableTriggerInputTypes.DAILY, 
      hour: hour || 6,
      minute: minute || 0,
    },
  });
  
  console.log(`⏰ Alarma diaria programada: ${hour}:${minute}`);
}

// 3. Snooze (CORREGIDA)
export async function snoozeNotification(minutes: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Recordatorio Pospuesto ⏳",
      body: "¿Ya llegaste al nuevo sitio? Toca para iniciar.",
      data: { action: 'OPEN_DAILY_SETUP' },
    },
    trigger: { 
      // ✅ FIX CRÍTICO: Especificar tipo intervalo
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60, 
      repeats: false 
    },
  });
}
