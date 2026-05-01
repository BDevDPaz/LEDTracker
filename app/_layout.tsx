import React, { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// 1. Imports de Servicios
import '../src/services/LocationManager'; 
// Importamos la CLASE, no solo el efecto secundario
import { BackgroundTasks } from '../src/services/BackgroundTasks'; 

// 2. Contextos
import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';

// 3. DB
import { initDatabase } from '../src/database/db';

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
        
        // 🛑 CORRECCIÓN CRÍTICA AQUÍ:
        // Registramos explícitamente el servicio de fondo para que empiece a "tictaquear"
        console.log("⏰ Registrando Servicios de Fondo (Auto-Checkout)...");
        await BackgroundTasks.register(); 
        
        console.log("✅ Sistema Listo. Cargando UI...");
      } catch (e) {
        console.warn("Error crítico inicializando la app:", e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // ... (El resto del archivo sigue IGUAL, no cambies nada más abajo)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
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
    if (appIsReady) await SplashScreen.hideAsync();
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <LanguageProvider>
          <LuxuryUIProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LuxuryUIProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </View>
  );
}
