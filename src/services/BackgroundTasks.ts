import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, initDatabase, insertAuditLog, updateSessionEndTime } from '../database/db'; // ✅ Importamos initDatabase
import { WorkSession } from '../types';
import { generateWeeklyReport } from './ReportGenerator';
import { LocationService, EXIT_TIMESTAMP_KEY } from './LocationManager';

// Optional import for BackgroundFetch to prevent crashes when native module is missing
let BackgroundFetch: any = null;
try {
  BackgroundFetch = require('expo-background-fetch');
} catch (e) {
  console.warn("⚠️ expo-background-fetch native module not found.");
}

const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const REPORT_STORAGE_KEY = 'LAST_REPORT_WEEK_ID';
const FAILSAFE_THRESHOLD = 15 * 60 * 1000; // 15 Minutos

// ------------------------------------------------------------------
// DEFINICIÓN DE LA TAREA MAESTRA (BLINDADA)
// ------------------------------------------------------------------
TaskManager.defineTask(TASK_NAME, async () => {
  console.log(`🔄 [Background] Tarea iniciada por el sistema...`);
  let newDataProcessed = false;

  try {
    // 🛑 CRÍTICO: Auto-Inicialización en modo "Headless"
    let db = getDB();
    if (!db) {
      console.log("🔌 [Background] DB no inicializada. Iniciando ahora...");
      await initDatabase();
      db = getDB(); // Recargamos la referencia
    }

    if (!db) {
      console.error("❌ [Background] Fallo fatal: No se pudo conectar a la DB.");
      return BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.Failed : 3;
    }

    const now = Date.now();

    // =================================================================
    // 🛡️ BLOQUE 1: FAILSAFE DE AUTO-CHECKOUT
    // =================================================================
    try {
      const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

      if (lastExitStr) {
        const exitTime = parseInt(lastExitStr, 10);
        
        if (isNaN(exitTime) || exitTime > now) {
           await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
        } else {
           const timeDiff = now - exitTime;
           
           if (timeDiff > FAILSAFE_THRESHOLD) {
             const session = await db.getFirstAsync<WorkSession>(
               "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
             );

             if (session && session.id && session.status === 'active') {
                console.log(`⚠️ [Failsafe] Ejecutando Auto-Checkout para sesión #${session.id}`);

                await updateSessionEndTime(session.id, exitTime);
                
                await insertAuditLog(
                  session.id, 
                  'AUTO_CHECKOUT', 
                  `Cierre automático por inactividad (>15min).`
                );

                try { await LocationService.stopMonitoring(); } catch (e) { console.warn("Error parando GPS:", e); }

                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "Jornada Finalizada 🏁",
                    body: "Tu sesión se cerró automáticamente por inactividad.",
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
      console.error("⚠️ [Background] Error en Failsafe:", failsafeError);
    }

    // =================================================================
    // 📄 BLOQUE 2: REPORTE SEMANAL
    // =================================================================
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
    } catch (reportError) {
      console.error("⚠️ [Background] Error en Reporte:", reportError);
    }

    return newDataProcessed 
      ? (BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.NewData : 2)
      : (BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.NoData : 1);

  } catch (criticalError) {
    console.error("❌ [Background] Error Crítico General:", criticalError);
    return BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.Failed : 3;
  }
});

// ------------------------------------------------------------------
// REGISTRO DE LA TAREA (API PÚBLICA)
// ------------------------------------------------------------------
export const BackgroundTasks = {
  register: async () => {
    try {
      if (!BackgroundFetch) {
        console.warn("⚠️ Background Fetch no disponible.");
        return;
      }
      const status = await BackgroundFetch.getStatusAsync();
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn("⚠️ Background Fetch restringido por el SO.");
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15 * 60, // 15 minutos
          stopOnTerminate: false,   // Clave para Android
          startOnBoot: true,        // Clave para Android
        });
        console.log("✅ Servicios de fondo (Failsafe + Reportes) registrados.");
      } else {
        console.log("ℹ️ Servicios de fondo ya estaban registrados.");
      }
    } catch (e) {
      console.error("⚠️ Error registrando background tasks:", e);
    }
  },
  
  unregister: async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered && BackgroundFetch) {
        await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      }
      console.log("🛑 Servicios de fondo detenidos.");
    } catch (e) {
      console.error("Error al desregistrar tarea:", e);
    }
  }
};
