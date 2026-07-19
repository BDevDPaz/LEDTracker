import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUDIT_ACTIONS, log, logStructured } from '../utils/logger';
import { ensureDbReady, updateSessionEndTime } from '../database/db';
import { WorkSession } from '../types';
import { generateWeeklyReport, checkAndDeliverPendingReports } from './ReportGenerator';
import { EXIT_TIMESTAMP_KEY } from './LocationManager';
import dayjs from '../utils/dayjsSetup';
import { engine } from '../engine/workTrackerEngine';
import { runDatabaseWork } from '../database/dbWorkQueue';

const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const REPORT_STORAGE_KEY = 'LAST_REPORT_WEEK_ID';
export const FAILSAFE_THRESHOLD_MS = 45 * 60 * 1000;

export const runFailsafeCheck = async (): Promise<boolean> => {
  logStructured(
    'DEBUG',
    'BACKGROUND_TASK',
    AUDIT_ACTIONS.BACKGROUND_FAILSAFE_CHECK_STARTED,
    {
      source: 'BackgroundTasks',
    }
  );

  const db = await ensureDbReady();
  const now = dayjs().valueOf();

  try {
    const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

    if (!lastExitStr) {
      logStructured(
        'DEBUG',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP,
        {
          source: 'BackgroundTasks',
        }
      );

      return false;
    }

    const exitTime = parseInt(lastExitStr, 10);

    if (Number.isNaN(exitTime) || exitTime > now) {
      await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
      return false;
    }

    const timeDiff = now - exitTime;

    if (timeDiff <= FAILSAFE_THRESHOLD_MS) {
      logStructured(
        'DEBUG',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET,
        {
          source: 'BackgroundTasks',
          exitTimestamp: exitTime,
          elapsedMinutes: Math.round(timeDiff / 60000),
          thresholdMinutes: Math.round(FAILSAFE_THRESHOLD_MS / 60000),
        }
      );

      return false;
    }

    const session = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status = 'active' ORDER BY actual_start_time DESC LIMIT 1"
    );

    if (session?.id) {
      log(
        'AMARILLO',
        'ADVERTENCIA',
        'WARN',
        `Failsafe: Auto Check-out retroactivo para sesión #${session.id} (Salida detectada hace ${Math.round(
          timeDiff / 60000
        )} min)`
      );

      await updateSessionEndTime(
        session.id,
        exitTime,
        AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE
      );

      await Promise.all([
        AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY),
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Jornada Finalizada 🏁',
            body: `Tu sesión en ${
              session.client_name || 'el sitio'
            } se cerró automáticamente por inactividad.`,
            sound: true,
          },
          trigger: null,
        }),
      ]);

      logStructured(
        'INFO',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_FAILSAFE_COMPLETED,
        {
          source: 'BackgroundTasks',
          sessionId: session.id,
          exitTimestamp: exitTime,
          checkoutAction: AUDIT_ACTIONS.AUTO_CHECKOUT_FAILSAFE,
        }
      );

      engine.dispatch({ type: 'BACKGROUND_SESSION_TIMEOUT' });
      return true;
    }

    await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
  } catch (failsafeError) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en Failsafe', failsafeError);
  }

  return false;
};

export const runPendingReportDeliveryCheck = async (): Promise<boolean> => {
  await checkAndDeliverPendingReports();

  logStructured(
    'INFO',
    'BACKGROUND_TASK',
    AUDIT_ACTIONS.BACKGROUND_PENDING_REPORT_RETRY_COMPLETED,
    {
      source: 'BackgroundTasks',
    }
  );

  return false;
};

export const runWeeklyReportWindowCheck = async (): Promise<boolean> => {
  try {
    const currentDate = dayjs();
    const day = currentDate.day();
    const isReportWindow =
      (day === 0 && currentDate.hour() >= 20) || day === 1 || day === 2;

    if (!isReportWindow) {
      logStructured(
        'DEBUG',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_REPORT_CHECK_COMPLETED,
        {
          source: 'BackgroundTasks',
          reportGenerated: false,
          reason: 'outside_report_window',
        }
      );

      return false;
    }

    const targetWeek = day === 0 ? currentDate : currentDate.subtract(1, 'week');
    const startTs = targetWeek.startOf('isoWeek').valueOf();
    const endTs = targetWeek.endOf('isoWeek').valueOf();
    const currentWeekId = targetWeek.startOf('isoWeek').format('YYYY-MM-DD');
    const lastReported = await AsyncStorage.getItem(REPORT_STORAGE_KEY);

    if (lastReported === currentWeekId) {
      logStructured(
        'DEBUG',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_REPORT_CHECK_COMPLETED,
        {
          source: 'BackgroundTasks',
          reportGenerated: false,
          reason: 'already_reported',
          weekId: currentWeekId,
        }
      );

      return false;
    }

    const pdfUri = await generateWeeklyReport(false, {
      start: startTs,
      end: endTs,
    });

    if (!pdfUri) {
      logStructured(
        'DEBUG',
        'BACKGROUND_TASK',
        AUDIT_ACTIONS.BACKGROUND_REPORT_CHECK_COMPLETED,
        {
          source: 'BackgroundTasks',
          reportGenerated: false,
          reason: 'pdf_not_generated',
          weekId: currentWeekId,
        }
      );

      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📄 Reporte Semanal Listo',
        body: 'Toca para revisar y enviar tu nómina.',
        data: { action: 'GENERATE_REPORT_PROMPT' },
        sound: true,
      },
      trigger: null,
    });

    await AsyncStorage.setItem(REPORT_STORAGE_KEY, currentWeekId);

    logStructured(
      'INFO',
      'BACKGROUND_TASK',
      AUDIT_ACTIONS.BACKGROUND_REPORT_CHECK_COMPLETED,
      {
        source: 'BackgroundTasks',
        reportGenerated: true,
        weekId: currentWeekId,
      }
    );

    return true;
  } catch (reportError) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en Reporte', reportError);
    return false;
  }
};

export async function runBackgroundMaintenance(): Promise<boolean> {
  logStructured(
    'DEBUG',
    'BACKGROUND_TASK',
    AUDIT_ACTIONS.BACKGROUND_RUN_STARTED,
    {
      source: 'BackgroundTasks',
    }
  );

  try {
    let newDataProcessed = false;

    const pendingReportProcessed = await runPendingReportDeliveryCheck();
    if (pendingReportProcessed) newDataProcessed = true;

    const failsafeProcessed = await runFailsafeCheck();
    if (failsafeProcessed) newDataProcessed = true;

    const weeklyReportProcessed = await runWeeklyReportWindowCheck();
    if (weeklyReportProcessed) newDataProcessed = true;

    logStructured(
      'INFO',
      'BACKGROUND_TASK',
      AUDIT_ACTIONS.BACKGROUND_RUN_COMPLETED,
      {
        source: 'BackgroundTasks',
        newDataProcessed,
      }
    );

    return newDataProcessed;
  } catch (maintenanceError) {
    logStructured(
      'ERROR',
      'BACKGROUND_TASK',
      AUDIT_ACTIONS.BACKGROUND_RUN_FAILED,
      {
        source: 'BackgroundTasks',
        error: String(maintenanceError),
      }
    );

    throw maintenanceError;
  }
}

TaskManager.defineTask(TASK_NAME, async () => {
  return await runDatabaseWork('bg-database-work', async () => {
    logStructured(
      'DEBUG',
      'ESTADO_SISTEMA',
      'MUTEX_LOCK: bg-database-work',
      {
        source: 'bg-database-work',
        owner: 'BackgroundTasks',
      }
    );

    try {
      log(
        'BLANCO',
        'BACKGROUND_TASK',
        'INFO',
        'Tarea iniciada por el sistema...'
      );

      try {
        const newDataProcessed = await runBackgroundMaintenance();

        if (newDataProcessed) {
          log('BLANCO', 'BACKGROUND_TASK', 'INFO', 'Tarea completada con trabajo útil.');
        } else {
          log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', 'Tarea completada sin cambios.');
        }

        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (criticalError) {
        log(
          'ROJO',
          'ERROR_CRITICO',
          'ERROR',
          'Error Crítico General en BackgroundTasks',
          criticalError
        );

        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    } finally {
      logStructured(
        'DEBUG',
        'ESTADO_SISTEMA',
        'MUTEX_UNLOCK: bg-database-work',
        {
          source: 'bg-database-work',
          owner: 'BackgroundTasks',
        }
      );
    }
  });
});

export const BackgroundTasks = {
  register: async () => {
    try {
      const status = await BackgroundTask.getStatusAsync();

      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        log(
          'AMARILLO',
          'ADVERTENCIA',
          'WARN',
          'Background Task restringido por el SO.'
        );
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);

      if (!isRegistered) {
        await BackgroundTask.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15,
        });

        log(
          'VERDE',
          'SERVICIOS_ACTIVOS',
          'INFO',
          'Servicios de fondo (Failsafe + Reportes) registrados.'
        );
      } else {
        log(
          'VERDE',
          'SERVICIOS_ACTIVOS',
          'INFO',
          'Servicios de fondo ya estaban registrados.'
        );
      }
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error registrando background tasks', e);
    }
  },

  unregister: async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);

      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(TASK_NAME);
      }

      log('VERDE', 'MONITOREO_DETENIDO', 'INFO', 'Servicios de fondo detenidos.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al desregistrar tarea', e);
    }
  },

  triggerForTesting: async () => {
    if (!__DEV__) {
      log(
        'AMARILLO',
        'ADVERTENCIA',
        'WARN',
        'triggerForTesting solo está disponible en builds de desarrollo.'
      );
      return;
    }

    try {
      await BackgroundTask.triggerTaskWorkerForTestingAsync();

      log(
        'BLANCO',
        'BACKGROUND_TASK',
        'DEBUG',
        'Background task disparado manualmente para pruebas.'
      );
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error disparando background task de prueba', e);
    }
  },
};

