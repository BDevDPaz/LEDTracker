import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, initDatabase, insertAuditLog, updateSessionEndTime } from '../database/db'; // ✅ Importamos initDatabase
import { WorkSession } from '../types';
import { generateWeeklyReport } from './ReportGenerator';
import { LocationService } from './LocationManager'; 

const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';
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
    // Si la app está cerrada, _layout.tsx NO se ejecutó, así que 'db' es null.
    let db = getDB();
    if (!db) {
      console.log("🔌 [Background] DB no inicializada. Iniciando ahora...");
      await initDatabase();
      db = getDB(); // Recargamos la referencia
    }

    if (!db) {
      console.error("❌ [Background] Fallo fatal: No se pudo conectar a la DB.");
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const now = Date.now();

    // =================================================================
    // 🛡️ BLOQUE 1: FAILSAFE DE AUTO-CHECKOUT
    // (Envuelto en su propio try/catch para no bloquear el reporte)
    // =================================================================
    try {
      const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

      if (lastExitStr) {
        const exitTime = parseInt(lastExitStr, 10);
        
        // Validación de sanidad (si el timestamp es del futuro o muy viejo, borrarlo)
        if (isNaN(exitTime) || exitTime > now) {
           await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
        } else {
           const timeDiff = now - exitTime;
           
           if (timeDiff > FAILSAFE_THRESHOLD) {
             // Verificamos sesión activa
             const session = await db.getFirstAsync<WorkSession>(
               "SELECT * FROM work_sessions ORDER BY id DESC LIMIT 1"
             );

             // ✅ Validación extra de sesión
             if (session && session.id && session.status === 'active') {
                console.log(`⚠️ [Failsafe] Ejecutando Auto-Checkout para sesión #${session.id}`);

                await updateSessionEndTime(session.id, exitTime); // Usar hora real de salida
                await db.runAsync("UPDATE work_sessions SET status = 'completed' WHERE id = ?", [session.id]);
                
                await insertAuditLog(
                  session.id, 
                  'AUTO_CHECKOUT', 
                  `Cierre automático por inactividad (>15min).`
                );

                await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
                
                // Intentamos detener monitoreo (Try/Catch interno por si LocationService falla)
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
                // Si ya no es activa, limpiamos la marca
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
    // (Independiente del Failsafe)
    // =================================================================
    try {
      const dateObj = new Date();
      const day = dateObj.getDay(); 
      // Ventana: Domingo (Noche) a Martes
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
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (criticalError) {
    console.error("❌ [Background] Error Crítico General:", criticalError);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ------------------------------------------------------------------
// REGISTRO DE LA TAREA (API PÚBLICA)
// ------------------------------------------------------------------
export const BackgroundTasks = {
  register: async () => {
    try {
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
      if (isRegistered) await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      console.log("🛑 Servicios de fondo detenidos.");
    } catch (e) {
      console.error("Error al desregistrar tarea:", e);
    }
  }
};
