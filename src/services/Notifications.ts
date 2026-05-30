import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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

// Solicitar permisos
export async function setupNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permiso de notificaciones denegado.');
    return false;
  }

  await ensureAndroidDefaultChannel();
  return true;
}

// ------------------------------------------------------------------
// 🕒 LÓGICA DE PROGRAMACIÓN
// ------------------------------------------------------------------

// ✅ FUNCIÓN 1: La que llama tu archivo 'settings.tsx' (Sin argumentos)
// Esta función actúa como puente: busca la hora en la DB y llama a la lógica real.
export async function scheduleDailyMorningNotification() {
  try {
    const settings = await getSettings();
    const timeToSet = settings?.start_time || DEFAULT_START_TIME;

    await scheduleDailyReminder(timeToSet);
  } catch (error) {
    console.error('❌ Error al obtener configuración para notificaciones:', error);
  }
}

// ✅ FUNCIÓN 2: La lógica real que recibe la hora (string)
export async function scheduleDailyReminder(timeString: string) {
  try {
    await ensureAndroidDefaultChannel();

    // 1. Limpiamos anteriores
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. Parseamos la hora
    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error(`Hora inválida para notificación diaria: "${timeString}"`);
    }

    // 3. Programamos con el TIPO EXPLÍCITO (Daily)
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

    console.log(`✅ Notificación diaria reprogramada a las ${timeString}`);
  } catch (error) {
    console.error('❌ Error crítico agendando notificación:', error);
  }
}

// Función auxiliar para cancelar todo (Logout, etc.)
export async function cancelNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

