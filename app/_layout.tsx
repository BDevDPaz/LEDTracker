import React, { useEffect, useState, useCallback } from 'react';
import { View, AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../src/services/LocationManager';
import { BackgroundTasks, runFailsafeCheck } from '../src/services/BackgroundTasks';
import { ensureWeeklyReportExists, checkAndDeliverPendingReports } from '../src/services/ReportGenerator';
import { setupNotifications, scheduleDailyMorningNotification } from '../src/services/Notifications';
import { log, setLoggerDB } from '../src/utils/logger';
import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';
import { useLogFeedback } from '../src/feedback/useLogFeedback';
import { initDatabase } from '../src/database/db';
import dayjs from '../src/utils/dayjsSetup';
import { useRuntimeSupervisor } from '../src/runtime/useRuntimeSupervisor';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

void SplashScreen.preventAutoHideAsync();
const LAST_FAILSAFE_CHECK_KEY = 'LAST_FAILSAFE_CHECK_TIMESTAMP';

function handleNotificationAction(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  if (data.action === 'OPEN_DAILY_SETUP') { router.push('/(tabs)'); setTimeout(() => router.setParams({ showSetup: 'true' }), 100); return; }
  if (data.action === 'GENERATE_REPORT_PROMPT' || data.action === 'SHOW_REPORT_PROMPT') { router.push('/(tabs)/report'); return; }
  if (data.action === 'CHECKOUT_DECISION') { router.push('/(tabs)'); setTimeout(() => router.setParams({ showCheckoutPrompt: 'true' }), 100); }
}

function FeedbackBridge() { useLogFeedback(); return null; }

export default function RootLayout() {
  useRuntimeSupervisor();

  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        log('AZUL', 'ESTADO_SISTEMA', 'INFO', 'Iniciando Base de Datos...');
        const database = await initDatabase();
        setLoggerDB(database);
        log('AZUL', 'ESTADO_SISTEMA', 'INFO', 'Registrando Servicios de Fondo (Auto-Checkout)...');
        await BackgroundTasks.register();
        await setupNotifications();
        await scheduleDailyMorningNotification();
        log('AZUL', 'ESTADO_SISTEMA', 'INFO', 'Sistema Listo. Cargando UI...');
      } catch (e) { log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error crítico inicializando la app', e); }
      finally { setAppIsReady(true); }
    }
    void prepare();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        try {
          const lastCheck = await AsyncStorage.getItem(LAST_FAILSAFE_CHECK_KEY);
          const now = dayjs().valueOf();
          const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
          if (now - lastCheckTime > 60 * 60 * 1000) {
            log('AZUL', 'ESTADO_SISTEMA', 'DEBUG', 'Ejecutando verificaciones de respaldo (Failsafe + Reportes + Envíos)...');
            await Promise.all([runFailsafeCheck(), ensureWeeklyReportExists(), checkAndDeliverPendingReports()]);
            await AsyncStorage.setItem(LAST_FAILSAFE_CHECK_KEY, now.toString());
          }
        } catch (e) { log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Fallo en verificaciones de respaldo', e); }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification?.request?.content?.data) { handleNotificationAction(router, lastResponse.notification.request.content.data as Record<string, unknown>); }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response?.notification?.request?.content?.data as Record<string, unknown>) || {};
        handleNotificationAction(router, data);
      }
    );
    return () => subscription.remove();
  }, [router]);

  const onLayoutRootView = useCallback(async () => { if (appIsReady) { await SplashScreen.hideAsync(); } }, [appIsReady]);
  if (!appIsReady) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <LanguageProvider>
          <LuxuryUIProvider>
            <FeedbackBridge />
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LuxuryUIProvider>
        </LanguageProvider>
      </View>
    </SafeAreaProvider>
  );
}

