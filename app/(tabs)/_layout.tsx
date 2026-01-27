// app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { View, Platform, Alert } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur'; // Necesario para el efecto cristal
import * as Notifications from 'expo-notifications';
import { useLanguage } from '../../src/context/LanguageContext';
import { setupNotifications, scheduleDailyMorningNotification, snoozeNotification } from '../../src/services/Notifications';
import { insertWorkSession } from '../../src/database/db';
import { COLORS } from '../../src/constants/theme';

export default function TabLayout() {
  const { t } = useLanguage();
  const router = useRouter();

  // --- LÓGICA DE NEGOCIO INTACTA ---
  useEffect(() => {
    setupNotifications();
    scheduleDailyMorningNotification();
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const action = response.notification.request.content.data.action;
      if (action === 'OPEN_DAILY_SETUP') {
        router.push('/(tabs)?showSetup=true');
      }
      if (action === 'CHECKOUT_DECISION') {
        Alert.alert(t.alert_exit_title || "Salida Detectada", t.alert_exit_msg, [
            { text: t.btn_finished, style: "cancel" },
            { text: t.btn_moving, onPress: async () => {
                await insertWorkSession({ start_time: Date.now(), status: 'travel', address: t.transit_msg || "En Tránsito", latitude: 0, longitude: 0, location_confirmed: 0, is_manual_edit: 0, lunch_taken: 0, date_string: new Date().toISOString().split('T')[0] });
                await snoozeNotification(45);
                Alert.alert("Buen viaje", "Registrando tiempo de viaje.");
              }}
          ]);
      }
    });
    return () => subscription.remove();
  }, []);
  // --- FIN LÓGICA ---

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Ocultamos etiquetas para estilo minimalista
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 70,
        },
        tabBarBackground: () => (
          <BlurView 
            intensity={50} 
            tint="dark" 
            style={{ 
              flex: 1, 
              borderRadius: 35, 
              overflow: 'hidden',
              backgroundColor: 'rgba(17,17,17,0.9)', 
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
            }} 
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 15 : 0 }}>
              <Ionicons name="timer" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4 }} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 15 : 0 }}>
              <Ionicons name="calendar" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4 }} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', top: Platform.OS === 'ios' ? 15 : 0 }}>
              <Ionicons name="settings" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4 }} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
