// --- src/services/BackgroundTasks.ts ---
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../utils/logger';
import { getDB, initDatabase, insertAuditLog, updateSessionEndTime } from '../database/db';
import { WorkSession } from '../types';
import { generateWeeklyReport } from './ReportGenerator';
import { LocationService, EXIT_TIMESTAMP_KEY } from './LocationManager';

const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const REPORT_STORAGE_KEY = 'LAST_REPORT_WEEK_ID';
const FAILSAFE_THRESHOLD_MS = 15 * 60 * 1000;

TaskManager.defineTask(TASK_NAME, async () => {
  log('BLANCO', 'BACKGROUND_TASK', 'DEBUG', 'Tarea iniciada por el sistema...');
  let newDataProcessed = false;

  try {
    let db = getDB();
    if (!db) {
      log('BLANCO', 'BACKGROUND_TASK', 'DEBUG', 'DB no inicializada. Iniciando ahora...');
      await initDatabase();
      db = getDB();
    }

    if (!db) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Fallo fatal: No se pudo conectar a la DB en background.');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const now = Date.now();

    try {
      const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);
      if (lastExitStr) {
        const exitTime = parseInt(lastExitStr, 10);
        if (Number.isNaN(exitTime) || exitTime > now) {
          await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
        } else {
          const timeDiff = now - exitTime;
          if (timeDiff > FAILSAFE_THRESHOLD_MS) {
            const session = await db.getFirstAsync<WorkSession>(
              'SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1'
            );

            if (session?.id && session.status === 'active') {
              // ✅ LOG PARA LA CONSOLA: Auto Check-out exacto
              log('AMARILLO', 'ADVERTENCIA', 'WARN', `Auto Check-out (GPS) ejecutado para sesión #${session.id} por inactividad`);

              await updateSessionEndTime(session.id, exitTime);
              
              // ✅ LOG PARA EL REPORTE PDF
              await insertAuditLog(session.id, 'AUTO_CHECKOUT_GPS', 'Auto Check-out (GPS) por inactividad prolongada fuera del área.');

              try {
                await LocationService.stopMonitoring();
              } catch (e) {
                log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error parando GPS tras Failsafe', e);
              }

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Jornada Finalizada 🏁',
                  body: 'Tu sesión se cerró automáticamente (Auto Check-out).',
                  sound: true,
                },
                trigger: null,
              });

              newDataProcessed = true;
            } else {
              await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
            }
          }
        }
      }
    } catch (failsafeError) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en Failsafe', failsafeError);
    }

    try {
      const dateObj = new Date();
      const day = dateObj.getDay();
      const isReportWindow = (day === 0 && dateObj.getHours() >= 20) || day === 1 || day === 2;

      if (isReportWindow) {
        const lastWeekMonday = new Date(dateObj);
        const diff = dateObj.getDate() - 7 - (day === 0 ? 6 : day - 1);
        lastWeekMonday.setDate(diff);
        lastWeekMonday.setHours(0, 0, 0, 0);

        const currentWeekId = lastWeekMonday.toISOString().split('T')[0];
        const lastReported = await AsyncStorage.getItem(REPORT_STORAGE_KEY);

        if (lastReported !== currentWeekId) {
          const startTs = lastWeekMonday.getTime();
          const lastWeekSunday = new Date(startTs);
          lastWeekSunday.setDate(lastWeekSunday.getDate() + 6);
          lastWeekSunday.setHours(23, 59, 59, 999);
          const endTs = lastWeekSunday.getTime();

          const pdfUri = await generateWeeklyReport(false, { start: startTs, end: endTs });

          if (pdfUri) {
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
            newDataProcessed = true;
          }
        }
      }
    } catch (reportError) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error en Reporte', reportError);
    }

    if (newDataProcessed) {
      log('BLANCO', 'BACKGROUND_TASK', 'INFO', 'Tarea completada con trabajo útil.');
    } else {
      log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', 'Tarea completada sin cambios.');
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (criticalError) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error Crítico General en BackgroundTasks', criticalError);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const BackgroundTasks = {
  register: async () => {
    try {
      const status = await BackgroundTask.getStatusAsync();
      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        log('AMARILLO', 'ADVERTENCIA', 'WARN', 'Background Task restringido por el SO.');
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!isRegistered) {
        await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
        log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 'Servicios de fondo (Failsafe + Reportes) registrados.');
      } else {
        log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 'Servicios de fondo ya estaban registrados.');
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
      log('ROJO', 'MONITOREO_DETENIDO', 'ERROR', 'Servicios de fondo detenidos.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al desregistrar tarea', e);
    }
  },

  triggerForTesting: async () => {
    if (!__DEV__) {
      log('AMARILLO', 'ADVERTENCIA', 'WARN', 'triggerForTesting solo está disponible en builds de desarrollo.');
      return;
    }
    try {
      await BackgroundTask.triggerTaskWorkerForTestingAsync();
      log('BLANCO', 'BACKGROUND_TASK', 'DEBUG', 'Background task disparado manualmente para pruebas.');
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error disparando background task de prueba', e);
    }
  },
};

