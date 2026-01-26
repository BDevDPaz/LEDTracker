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
    // Identificador único de la semana (Lunes de la semana actual)
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1); 
    const currentWeekId = new Date(d.setDate(diff)).toISOString().split('T')[0];

    const lastReported = await AsyncStorage.getItem(STORAGE_KEY);

    // Si estamos en Domingo Noche (0) o Lunes/Martes (1,2) Y no se ha hecho reporte de esta semana
    const isWindow = (day === 0 && now.getHours() >= 22) || day === 1 || day === 2;
    
    if (isWindow && lastReported !== currentWeekId) {
      console.log("📄 Generando reporte automático...");
      const pdfUri = await generateWeeklyReport(false); // No compartir, solo generar
      
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
      minimumInterval: 60 * 15, // 15 minutos
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
};
