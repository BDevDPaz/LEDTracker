// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet, LogBox } from 'react-native';
import { LanguageProvider } from '../src/context/LanguageContext';
import { initDatabase } from '../src/database/db';
import { setupNotifications } from '../src/services/Notifications';
import { AutomatedReporting } from '../src/services/AutomatedReporting';

// Ignorar advertencias no críticas (Timers o Background en Dev)
LogBox.ignoreLogs(['Setting a timer', 'expo-background-fetch']);

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const prepareApp = async () => {
      try {
        console.log("🚀 Booting LEDTracker (TS Core)...");
        
        // 1. PASO CRÍTICO: Esperar a que la DB cree las tablas antes de continuar
        await initDatabase();
        console.log("✅ Base de datos lista y tablas verificadas.");

        // 2. Configurar servicios secundarios (con tolerancia a fallos en Dev)
        try {
          await setupNotifications();
          await AutomatedReporting.register();
        } catch (e) {
          console.warn("⚠️ Servicios background limitados (ignorando error en Dev):", e);
        }

        // 3. Todo listo, permitir acceso a la UI
        setIsReady(true);
      } catch (error) {
        console.error("❌ Error FATAL al iniciar:", error);
        setErrorMsg("Error crítico de sistema. Reinicia la app.");
      }
    };

    prepareApp();
  }, []);

  // --- PANTALLA DE CARGA (SPLASH SCREEN) ---
  // Bloquea la UI hasta que la DB existe
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando sistema...</Text>
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>
    );
  }

  // --- APP PRINCIPAL ---
  return (
    <LanguageProvider>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 20,
    fontSize: 16,
  },
  errorText: {
    color: '#FF4444',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
