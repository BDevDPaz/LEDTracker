import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { log, logStructured } from '../utils/logger';
import { NOTIFICATION_SPECS, ensureAllChannels } from './Notifications';
import dayjs from '../utils/dayjsSetup';

export type NotificationEvent =
  | 'ON_DAILY_REMINDER'
  | 'ON_AUTO_CHECKIN'
  | 'ON_AUTO_CHECKOUT_ALERT'
  | 'ON_FAILSAFE_CHECKOUT'
  | 'ON_WEEKLY_REPORT_READY'
  | 'ON_PENDING_REPORT_REMINDER';

interface DispatchOptions {
  customBody?: string;
  data?: Record<string, any>;
  throttleMs?: number;
}

const lastDispatched: Record<string, number> = {};

export const NotificationDispatcher = {
  dispatch: async (event: NotificationEvent, options: DispatchOptions = {}) => {
    try {
      const now = dayjs().valueOf();
      const throttleMs = options.throttleMs ?? 5000; // Default throttle 5s

      if (lastDispatched[event] && (now - lastDispatched[event] < throttleMs)) {
         log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', `Notification throttled for event: ${event}`);
         return null;
      }

      await ensureAllChannels();

      let specKey: keyof typeof NOTIFICATION_SPECS;

      switch (event) {
        case 'ON_DAILY_REMINDER': specKey = 'DAILY_REMINDER'; break;
        case 'ON_AUTO_CHECKIN': specKey = 'AUTO_CHECKIN'; break;
        case 'ON_AUTO_CHECKOUT_ALERT': specKey = 'AUTO_CHECKOUT_ALERT'; break;
        case 'ON_FAILSAFE_CHECKOUT': specKey = 'AUTO_CHECKOUT_FINALIZADO'; break;
        case 'ON_WEEKLY_REPORT_READY': specKey = 'REPORT_READY'; break;
        case 'ON_PENDING_REPORT_REMINDER': specKey = 'REPORT_READY'; break; // Reusing spec
        default:
          throw new Error(`Unknown notification event: ${event}`);
      }

      const spec = NOTIFICATION_SPECS[specKey];

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: spec.title,
          body: options.customBody || spec.body,
          sound: spec.sound,
          data: { ...spec.action ? { action: spec.action } : {}, ...options.data },
          ...(Platform.OS === 'android' && { color: spec.color }),
        },
        trigger: null,
        ...(Platform.OS === 'android' && { channelId: spec.channelId }),
      });

      lastDispatched[event] = now;
      logStructured('INFO', 'SERVICIOS_ACTIVOS', `Notification dispatched: ${event}`, { notificationId, specKey });

      return notificationId;
    } catch (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', `Failed to dispatch notification for event ${event}`, error);
      return null;
    }
  }
};
