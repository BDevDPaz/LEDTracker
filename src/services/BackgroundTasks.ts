import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, insertAuditLog, updateSessionEndTime } from '../database/db';
import { WorkSession } from '../types';
import { generateWeeklyReport } from './ReportGenerator';
import { LocationService } from './LocationManager'; // Para detener monitoreo

const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';
const REPORT_STORAGE_KEY = 'LAST_REPORT_WEEK_ID';

// TIEMPO DE ESPERA ANTES DE AUTO-CHECKOUT (en milisegundos)
// 15 Minutos = 15 * 60 * 1000
const FAILSAFE_THRESHOLD = 15 * 60 * 1000; 

// ------------------------------------------------------------------
// DEFINICIÓN DE LA TAREA MAESTRA
// ------------------------------------------------------------------
TaskManager.defineTask(TASK_NAME, async () => {
  console.log(`🔄 [Background] Ejecutando servicios de fondo...`);
  let newDataProcessed = false;

  try {
    const db = getDB();
    const now = Date.now();

    // =================================================================
    // 🟥 SUB-TAREA 1: FAILSAFE DE AUTO-CHECKOUT (Fase 5)
    // =================================================================
    
    // 1. Buscamos si hay una "Salida de Geocerca" pendiente de decisión
    const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

    if (lastExitStr) {
      const exitTime = parseInt(lastExitStr, 10);
      const timeDiff = now - exitTime;

      // Solo actuamos si han pasado más de 15 minutos desde la salida
      if (timeDiff > FAILSAFE_THRESHOLD) {
        
        // 2. Verificamos si la sesión sigue ACTIVA (si el usuario no hizo nada)
        const session = await db.getFirstAsync<WorkSession>(
          "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
        );

        if (session && session.status === 'active') {
          console.log("⚠️ [Failsafe] Detectada inactividad tras salida. Ejecutando Auto Check-out.");

          // 3. AUTO CHECK-OUT
          // Usamos 'exitTime' (la hora real de salida), NO 'now'.
          await updateSessionEndTime(session.id!, exitTime);
          
          // Actualizamos status a completed
          await db.runAsync("UPDATE work_sessions SET status = 'completed' WHERE id = ?", [session.id]);

          // 4. Auditoría
          await insertAuditLog(
            session.id!, 
            'AUTO_CHECKOUT', 
            `Cierre automático por inactividad (>15min fuera del radio).`
          );

          // 5. Limpieza
          await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
          await LocationService.stopMonitoring();

          // 6. Notificación al Usuario
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Jornada Finalizada 🏁",
              body: "Tu sesión se cerró automáticamente por inactividad tras salir del sitio.",
              sound: true,
            },
            trigger: null,
          });

          newDataProcessed = true;
        } else {
          // Si la sesión ya no es 'active' (ej. el usuario la puso en 'travel' o la cerró manual),
          // borramos la marca de tiempo porque ya no es relevante.
          await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
        }
      }
    }

    // =================================================================
    // 🟦 SUB-TAREA 2: REPORTE SEMANAL AUTOMÁTICO (Fase 6)
    // =================================================================
    
    const dateObj = new Date();
    const day = dateObj.getDay(); // 0=Dom, 1=Lun, 2=Mar
    
    // Ventana: Domingo (Noche) a Martes
    const isReportWindow = (day === 0 && dateObj.getHours() >= 20) || day === 1 || day === 2;

    if (isReportWindow) {
      // Calcular ID de la semana pasada
      const lastWeekMonday = new Date(dateObj);
      const diff = dateObj.getDate() - 7 - (day === 0 ? 6 : day - 1);
      lastWeekMonday.setDate(diff);
      lastWeekMonday.setHours(0, 0, 0, 0);
      const currentWeekId = lastWeekMonday.toISOString().split('T')[0];

      const lastReported = await AsyncStorage.getItem(REPORT_STORAGE_KEY);

      if (lastReported !== currentWeekId) {
        // Generar rangos
        const startTs = lastWeekMonday.getTime();
        const lastWeekSunday = new Date(startTs);
        lastWeekSunday.setDate(lastWeekSunday.getDate() + 6);
        lastWeekSunday.setHours(23, 59, 59, 999);
        const endTs = lastWeekSunday.getTime();

        console.log("📄 [Background] Generando reporte semanal...");
        const pdfUri = await generateWeeklyReport(false, { start: startTs, end: endTs });

        if (pdfUri) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📄 Reporte Semanal Listo",
              body: "Toca para revisar y enviar tu nómina.",
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

    return newDataProcessed 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (error) {
    console.error("❌ [Background] Error crítico:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ------------------------------------------------------------------
// REGISTRO DE LA TAREA
// ------------------------------------------------------------------
export const BackgroundTasks = {
  register: async () => {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn("⚠️ Background Fetch restringido.");
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15 * 60, // 15 minutos
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log("✅ Servicios de fondo (Failsafe + Reportes) registrados.");
      }
    } catch (e) {
      console.log("⚠️ Error registrando background tasks:", e);
    }
  },
  
  unregister: async () => {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  }
};
