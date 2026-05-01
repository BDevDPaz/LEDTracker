import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from '../database/db'; // ✅ Necesario para leer la hora guardada

// Configuración del manejador
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
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
    // Si hay settings, usamos esa hora. Si no, un default.
    const timeToSet = settings?.start_time || "06:30";
    
    await scheduleDailyReminder(timeToSet);
  } catch (error) {
    console.error("❌ Error al obtener configuración para notificaciones:", error);
  }
}

// ✅ FUNCIÓN 2: La lógica real que recibe la hora (string)
// Aquí está la corrección del 'trigger' que hicimos antes.
export async function scheduleDailyReminder(timeString: string) {
  try {
    // 1. Limpiamos anteriores
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. Parseamos la hora
    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // 3. Programamos con el TIPO EXPLÍCITO (Daily)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "¡Buenos días! ☀️",
        body: "Es hora de iniciar tu jornada en LEDTracker.",
        sound: true,
        data: { action: 'OPEN_DAILY_SETUP' }, // Para que abra el modal al tocarla
      },
      trigger: {
        // 🔥 ESTA LÍNEA ES LA QUE EVITA EL ERROR 'INVALID TRIGGER'
        type: Notifications.SchedulableTriggerInputTypes.DAILY, 
        hour: hour,
        minute: minute,
      },
    });

    console.log(`✅ Notificación diaria reprogramada a las ${timeString}`);

  } catch (error) {
    console.error("❌ Error crítico agendando notificación:", error);
  }
}

// Función auxiliar para cancelar todo (Logout, etc.)
export async function cancelNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
