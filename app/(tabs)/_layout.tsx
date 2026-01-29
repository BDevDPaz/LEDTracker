import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// ✅ Ruta ajustada (dos niveles atrás)
import { COLORS } from '../../src/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="dark" style={styles.blurContainer} />
        ),
      }}
    >
      {/* 1. HOME */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name="timer" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      
      {/* 2. REPORTE */}
      <Tabs.Screen
        name="report"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name="document-text" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />

      {/* 3. HISTORIAL */}
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name="calendar" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      
      {/* 4. SETTINGS */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name="settings" size={24} color={focused ? COLORS.gold : '#666'} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 30,
    left: '10%', right: '10%',
    height: 64,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
  },
  blurContainer: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,15,15,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconWrapper: {
    alignItems: 'center', justifyContent: 'center',
    top: Platform.OS === 'ios' ? 15 : 0,
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.gold, marginTop: 4,
    shadowColor: COLORS.gold, shadowOpacity: 1, shadowRadius: 5,
  }
});
