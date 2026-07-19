import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { log } from '../utils/logger';
import { getSettings } from '../database/db';
import { NotificationAction } from '../types';

// ======================================================
// CHANNEL CONFIGURATION (Proposal 3)
// ======================================================

export interface NotificationChannelConfig {
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
  description?: string;
  vibrationPattern: number[];
  lightColor: string;
  enableVibration: boolean;
}

export const CHANNELS: Record<string, NotificationChannelConfig> = {
  DAILY_REMINDER: {
    id: 'daily_reminder',
    name: 'Recordatorio Diario',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Notificación matutina para iniciar jornada',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9800',
    enableVibration: true
  },
  GEOFENCE_EVENTS: {
    id: 'geofence_events',
    name: 'Eventos de Ubicación',
    importance: Notifications.AndroidImportance.MAX,
    description: 'Auto check-in/checkout por GPS',
    vibrationPattern: [0, 100, 50, 100],
    lightColor: '#4CAF50',
    enableVibration: true
  },
  REPORTS: {
    id: 'reports',
    name: 'Reportes',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Notificación de reporte disponible',
    vibrationPattern: [0, 200, 200],
    lightColor: '#2196F3',
    enableVibration: true
  },
  FAILSAFE_ALERTS: {
    id: 'failsafe_alerts',
    name: 'Alertas de Seguridad',
    importance: Notifications.AndroidImportance.MAX,
    description: 'Auto cierre de jornada por inactividad',
    vibrationPattern: [0, 150, 100, 150, 100, 150],
    lightColor: '#F44336',
    enableVibration: true
  }
};

const DEFAULT_START_TIME = '06:30';

// ======================================================
// NOTIFICATION SPECS (ANEXO A)
// ======================================================

interface NotificationSpec {
  id: string;
  title: string;
  body: string;
  icon?: string;
  color?: string;
  sound: boolean;
  priority: Notifications.AndroidImportance;
  channelId: string;
  action: NotificationAction;
}

export const NOTIFICATION_SPECS: Record<string, NotificationSpec> = {
  DAILY_REMINDER: {
    id: 'daily_reminder',
    title: '¡Buenos días! ☀️',
    body: 'Es hora de iniciar tu jornada en WTracker.',
    sound: true,
    priority: Notifications.AndroidImportance.HIGH,
    channelId: 'daily_reminder',
    action: 'OPEN_DAILY_SETUP'
  },
  AUTO_CHECKIN: {
    id: 'auto_checkin',
    title: '📍 Llegaste al sitio',
    body: 'Auto Check-in (GPS) validado. ¡Buen trabajo!',
    color: '#4CAF50',
    sound: true,
    priority: Notifications.AndroidImportance.MAX,
    channelId: 'geofence_events',
    action: 'GENERATE_REPORT_PROMPT'
  },
  AUTO_CHECKOUT_ALERT: {
    id: 'auto_checkout_alert',
    title: '⚠️ Saliste del área',
    body: 'Se detectó tu salida.',
    color: '#F44336',
    sound: true,
    priority: Notifications.AndroidImportance.MAX,
    channelId: 'failsafe_alerts',
    action: 'CHECKOUT_DECISION'
  },
  AUTO_CHECKOUT_FINALIZADO: {
    id: 'auto_checkout_final',
    title: 'Jornada Finalizada 🏁',
    body: 'Tu sesión se cerró automáticamente por inactividad.',
    color: '#FF9800',
    sound: true,
    priority: Notifications.AndroidImportance.HIGH,
    channelId: 'failsafe_alerts',
    action: 'OPEN_DAILY_SETUP'
  },
  REPORT_READY: {
    id: 'report_ready',
    title: '📄 Reporte Semanal Listo',
    body: 'Toca para revisar y enviar tu nómina.',
    color: '#2196F3',
    sound: true,
    priority: Notifications.AndroidImportance.HIGH,
    channelId: 'reports',
    action: 'GENERATE_REPORT_PROMPT'
  }
};

// ======================================================
// CHANNEL MANAGEMENT (Proposal 3)
// ======================================================

export async function ensureAllChannels() {
  if (Platform.OS !== 'android') return;

  for (const [_, config] of Object.entries(CHANNELS)) {
    try {
      await Notifications.setNotificationChannelAsync(config.id, {
        name: config.name,
        importance: config.importance,
        description: config.description,
        vibrationPattern: config.enableVibration ? config.vibrationPattern : undefined,
        lightColor: config.lightColor,
        bypassDnd: config.importance === Notifications.AndroidImportance.MAX
      });
    } catch (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', `Failed to create channel ${config.id}`, error);
    }
  }
}

// ======================================================
// PERMISSION MANAGEMENT (Proposal 1)
// ======================================================

export interface PermissionCheckResult {
  isGranted: boolean;
  reason: 'granted' | 'denied' | 'restricted' | 'undetermined';
  message: string;
}

export async function requestAndConfigureNotifications(): Promise<PermissionCheckResult> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'denied') {
      return {
        isGranted: false,
        reason: 'denied',
        message: 'Las notificaciones están desactivadas. Ve a Ajustes > Notificaciones y actívalas.'
      };
    }

    if (existingStatus === 'granted') {
      await ensureAllChannels();
      return {
        isGranted: true,
        reason: 'granted',
        message: 'Notificaciones activas'
      };
    }

    const { status } = await Notifications.requestPermissionsAsync();

    if (status === 'granted') {
      await ensureAllChannels();
      return {
        isGranted: true,
        reason: 'granted',
        message: 'Notificaciones habilitadas'
      };
    } else {
      return {
        isGranted: false,
        reason: status === 'denied' ? 'denied' : 'restricted',
        message: 'No pudimos habilitar las notificaciones. Verifica los permisos en Ajustes.'
      };
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al verificar notificaciones', error);
    return {
      isGranted: false,
      reason: 'undetermined',
      message: 'Error al verificar notificaciones.'
    };
  }
}

// Legacy support (refactored to use new logic)
export async function setupNotifications() {
  const result = await requestAndConfigureNotifications();

  if (!result.isGranted) {
    log('AMARILLO', 'PERMISOS_DENEGADOS', 'WARN', result.message);
  }

  return result.isGranted;
}

// ======================================================
// SCHEDULING HELPERS
// ======================================================

export async function scheduleNotificationWithChannel(
  channelKey: keyof typeof CHANNELS,
  content: Notifications.NotificationContentInput
) {
  if (Platform.OS === 'android') {
    await ensureAllChannels();
  }

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
    ...(Platform.OS === 'android' && {
      channelId: CHANNELS[channelKey].id
    })
  });
}

export async function notifyGeofenceExitDetected(siteLabel?: string) {
  const spec = NOTIFICATION_SPECS.AUTO_CHECKOUT_ALERT;

  await scheduleNotificationWithChannel('FAILSAFE_ALERTS', {
    title: spec.title,
    body: siteLabel
      ? `Se detectó tu salida de ${siteLabel}. ¿Deseas terminar tu jornada?`
      : 'Se detectó tu salida. ¿Deseas terminar tu jornada?',
    sound: spec.sound,
    data: { action: spec.action },
    color: spec.color,
    priority: Notifications.AndroidNotificationPriority.MAX,
  });

  log(
    'VERDE',
    'OPERACION_EXITOSA',
    'INFO',
    'Notificación de salida programada/enviada'
  );
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
    await ensureAllChannels();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Hora inválida para notificación diaria: "${timeString}"`);
    }

    const spec = NOTIFICATION_SPECS.DAILY_REMINDER;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: spec.title,
        body: spec.body,
        sound: spec.sound,
        data: { action: spec.action },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? CHANNELS.DAILY_REMINDER.id : undefined,
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

