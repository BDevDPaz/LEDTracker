// src/services/AutomatedReporting.ts
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWeeklyReport } from './ReportGenerator';

const TASK_NAME = 'WEEKLY_REPORT_CHECK';
const STORAGE_KEY = 'LAST_REPORT_WEEK_ID';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const now = new Date();
    const day = now.getDay();
    
    // Semana pasada (Lunes anterior a Domingo anterior)
    const lastWeekMonday = new Date(now);
    lastWeekMonday.setDate(now.getDate() - 7 - (day - 1));
    lastWeekMonday.setHours(0,0,0,0);
    const startTs = lastWeekMonday.getTime();

    const lastWeekSunday = new Date(startTs);
    lastWeekSunday.setDate(lastWeekSunday.getDate() + 6);
    lastWeekSunday.setHours(23,59,59,999);
    const endTs = lastWeekSunday.getTime();

    const currentWeekId = lastWeekMonday.toISOString().split('T')[0];
    const lastReported = await AsyncStorage.getItem(STORAGE_KEY);

    // Ventana: Domingo noche a Martes
    const isWindow = (day === 0 && now.getHours() >= 22) || day === 1 || day === 2;
    
    if (isWindow && lastReported !== currentWeekId) {
      console.log("📄 Generando reporte automático...");
      // ✅ Pasamos rango exacto
      const pdfUri = await generateWeeklyReport(false, { start: startTs, end: endTs });
      
      if (pdfUri) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Reporte Semanal Listo",
            body: "Tu reporte ha sido generado. Toca para verlo.",
            data: { pdfUri }
          },
          trigger: null
        });
        await AsyncStorage.setItem(STORAGE_KEY, currentWeekId);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const AutomatedReporting = {
  register: async () => {
    return BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
};
