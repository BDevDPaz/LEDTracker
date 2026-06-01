// --- app/_layout.tsx ---
import React, { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Servicios
import '../src/services/LocationManager';
import { BackgroundTasks } from '../src/services/BackgroundTasks';
import { log } from '../src/utils/logger';

// Contextos
import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';
import { useLogFeedback } from '../src/feedback/useLogFeedback';

// DB
import { initDatabase } from '../src/database/db';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

void SplashScreen.preventAutoHideAsync();

function handleNotificationAction(
  router: ReturnType<typeof useRouter>,
  data: Record<string, unknown>
) {
  if (data.action === 'OPEN_DAILY_SETUP') {
    router.push('/(tabs)');
    setTimeout(() => router.setParams({ showSetup: 'true' }), 100);
    return;
  }

  if (data.action === 'GENERATE_REPORT_PROMPT') {
    router.push('/(tabs)/report');
    return;
  }

  if (data.action === 'CHECKOUT_DECISION') {
    router.push('/(tabs)');
    setTimeout(() => router.setParams({ showCheckoutPrompt: 'true' }), 100);
  }
}

function FeedbackBridge() {
  useLogFeedback();
  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        log('AZUL', 'ESTADO_SISTEMA', 'INFO', 'Iniciando Base de Datos...');
        await initDatabase();

        log(
          'AZUL',
          'ESTADO_SISTEMA',
          'INFO',
          'Registrando Servicios de Fondo (Auto-Checkout)...'
        );
        await BackgroundTasks.register();

        log('AZUL', 'ESTADO_SISTEMA', 'INFO', 'Sistema Listo. Cargando UI...');
      } catch (e) {
        log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error crítico inicializando la app', e);
      } finally {
        setAppIsReady(true);
      }
    }

    void prepare();
  }, []);

  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();

    if (lastResponse?.notification?.request?.content?.data) {
      handleNotificationAction(
        router,
        lastResponse.notification.request.content.data as Record<string, unknown>
      );
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data =
          (response?.notification?.request?.content?.data as Record<
            string,
            unknown
          >) || {};

        handleNotificationAction(router, data);
      }
    );

    return () => subscription.remove();
  }, [router]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

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

