import React, { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// 1. Imports de Servicios Globales
import '../src/services/LocationManager'; 
import '../src/services/BackgroundTasks';

// 2. Imports de Contextos
import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';

// 3. Inicializador de DB
import { initDatabase } from '../src/database/db';

// Configuración de Notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log("⏳ Iniciando Base de Datos...");
        await initDatabase(); 
        console.log("✅ Base de Datos Lista. Cargando UI...");
      } catch (e) {
        console.warn("Error crítico inicializando la app:", e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      // ✅ FIX: "|| {}" Previene el crash si la notificación no tiene datos
      const data = response.notification.request.content.data || {}; 
      
      if (data.action === 'OPEN_DAILY_SETUP') {
        router.push('/(tabs)');
        setTimeout(() => router.setParams({ showSetup: 'true' }), 100);
      } else if (data.action === 'GENERATE_REPORT_PROMPT') {
        router.push('/(tabs)/report');
      } else if (data.action === 'CHECKOUT_DECISION') {
        router.push('/(tabs)');
        setTimeout(() => router.setParams({ showCheckoutPrompt: 'true' }), 100);
      }
    });

    return () => subscription.remove();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
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
  );
}
