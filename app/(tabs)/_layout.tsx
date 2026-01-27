import React from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../src/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 40, // ✅ SUBIDO PARA QUE NO LO TAPEN LOS BOTONES
          left: 24,   // ✅ MÁRGENES LATERALES AUMENTADOS
          right: 24,
          elevation: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 70,
        },
        tabBarBackground: () => (
          <BlurView 
            intensity={60} 
            tint="dark" 
            style={{ 
              flex: 1, 
              borderRadius: 35, 
              overflow: 'hidden',
              backgroundColor: 'rgba(10,10,10,0.85)', 
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
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4, shadowColor: COLORS.gold, shadowOpacity: 0.8, shadowRadius: 5 }} />}
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
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4, shadowColor: COLORS.gold, shadowOpacity: 0.8, shadowRadius: 5 }} />}
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
              {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 4, shadowColor: COLORS.gold, shadowOpacity: 0.8, shadowRadius: 5 }} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
