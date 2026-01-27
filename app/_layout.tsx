import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, LogBox } from 'react-native';
import { useFonts, Montserrat_300Light, Montserrat_400Regular, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';

import { LanguageProvider } from '../src/context/LanguageContext';
import { LuxuryUIProvider } from '../src/context/LuxuryUIContext';
import { initDatabase } from '../src/database/db';
import { setupNotifications } from '../src/services/Notifications';
import { AutomatedReporting } from '../src/services/AutomatedReporting';
import { COLORS } from '../src/constants/theme';
import { LuxurySkeleton } from '../src/components/LuxuryUI'; // ✅ Importamos Skeleton

LogBox.ignoreLogs(['Setting a timer', 'expo-background-fetch']);

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    const prepareApp = async () => {
      try {
        console.log("🚀 Booting LEDTracker (Luxury Edition)...");
        await initDatabase();
        console.log("✅ DB lista.");
        try {
          await setupNotifications();
          await AutomatedReporting.register();
        } catch (e) {
          console.warn("⚠️ Servicios background limitados:", e);
        }
        setIsDbReady(true);
      } catch (error) {
        console.error("❌ Error FATAL:", error);
        setErrorMsg("Error crítico de sistema.");
      }
    };
    prepareApp();
  }, []);

  // ✅ PANTALLA DE CARGA CON SKELETON (Tarea 8)
  if (!isDbReady || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        
        {/* Skeleton Header */}
        <View style={{width: '100%', marginBottom: 30, flexDirection:'row', justifyContent:'space-between'}}>
            <LuxurySkeleton width={180} height={30} />
            <LuxurySkeleton width={40} height={40} style={{borderRadius: 20}} />
        </View>

        {/* Skeleton Main Card */}
        <LuxurySkeleton width="100%" height={220} style={{borderRadius: 36, marginBottom: 20}} />

        {/* Skeleton Button */}
        <LuxurySkeleton width="100%" height={60} style={{borderRadius: 28, marginBottom: 30}} />

        {/* Skeleton Stats Grid */}
        <View style={{flexDirection: 'row', gap: 15}}>
             <LuxurySkeleton width="48%" height={120} style={{borderRadius: 26}} />
             <LuxurySkeleton width="48%" height={120} style={{borderRadius: 26}} />
        </View>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>
    );
  }

  return (
    <LanguageProvider>
      <LuxuryUIProvider> 
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <StatusBar style="light" backgroundColor={COLORS.background} />
          <Stack screenOptions={{ 
            headerShown: false, 
            animation: 'fade',
            contentStyle: { backgroundColor: COLORS.background }
          }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </View>
      </LuxuryUIProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, padding: 24, paddingTop: 80 },
  errorText: { color: COLORS.danger, marginTop: 20, textAlign: 'center', fontWeight: 'bold' },
});
