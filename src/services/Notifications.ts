// --- src/services/Notifications.ts ---
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { log } from '../utils/logger';
import { getSettings } from '../database/db';

const DEFAULT_CHANNEL_ID = 'default';
const DEFAULT_START_TIME = '06:30';

async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: DEFAULT_CHANNEL_ID,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

export async function setupNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log('AMARILLO', 'ADVERTENCIA', 'WARN', 'Permiso de notificaciones denegado.');
    return false;
  }

  await ensureAndroidDefaultChannel();
  return true;
}

export async function scheduleDailyMorningNotification() {
  try {
    const settings = await getSettings();
    const timeToSet = settings?.start_time || DEFAULT_START_TIME;
    await scheduleDailyReminder(timeToSet);
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al obtener configuración para notificaciones', error);
  }
}

export async function scheduleDailyReminder(timeString: string) {
  try {
    await ensureAndroidDefaultChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Hora inválida para notificación diaria: "${timeString}"`);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡Buenos días! ☀️',
        body: 'Es hora de iniciar tu jornada en LEDTracker.',
        sound: true,
        data: { action: 'OPEN_DAILY_SETUP' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? DEFAULT_CHANNEL_ID : undefined,
      },
    });

    log('VERDE', 'OPERACION_EXITOSA', 'INFO', `Notificación diaria reprogramada a las ${timeString}`);
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error crítico agendando notificación', error);
  }
}

export async function cancelNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

