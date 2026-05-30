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

// Contextos
import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';

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

export default function RootLayout() {
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('⏳ Iniciando Base de Datos...');
        await initDatabase();

        console.log('⏰ Registrando Servicios de Fondo (Auto-Checkout)...');
        await BackgroundTasks.register();

        console.log('✅ Sistema Listo. Cargando UI...');
      } catch (e) {
        console.warn('⚠️ Error crítico inicializando la app:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();

    if (lastResponse?.notification?.request?.content?.data) {
      handleNotificationAction(
        router,
        lastResponse.notification.request.content.data as Record<string, unknown>
      );
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data =
          (response?.notification?.request?.content?.data as Record<
            string,
            unknown
          >) || {};

        handleNotificationAction(router, data);
      });

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

