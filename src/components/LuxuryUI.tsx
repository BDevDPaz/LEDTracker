import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'; // ✅ Importamos Haptics
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated'; // ✅ Para Skeletons
import { COLORS } from '../constants/theme';

export const LuxuryCard = ({ children, active, style }: any) => (
  <View style={[styles.cardContainer, style, active && styles.cardActive]}>
    <LinearGradient
      colors={active ? ['#1A1A1A', '#000000'] : ['#0A0A0A', '#050505']}
      style={styles.cardGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {children}
    </LinearGradient>
  </View>
);

export const GlassModalWrapper = ({ visible, children }: any) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.modalContent}>
        {children}
      </View>
    </View>
  </Modal>
);

// ✅ COMPONENTE NUEVO: EMPTY STATE (Tarea 6)
export const LuxuryEmptyState = ({ text, icon = "file-tray-outline" }: any) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconBubble}>
      <Ionicons name={icon} size={32} color={COLORS.textSecondary} />
    </View>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

// ✅ COMPONENTE NUEVO: SKELETON (Tarea 8)
export const LuxurySkeleton = ({ width, height, style }: any) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.3, { duration: 800 })),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ width, height, backgroundColor: '#333', borderRadius: 12 }, style, animatedStyle]} />
  );
};

export const LuxuryButton = ({ onPress, text, icon, variant = 'primary', disabled }: any) => {
  const bgColors = variant === 'danger' ? ['#FF3B30', '#991B1B'] : ['#D4AF37', '#8a7224'];
  const textColor = variant === 'danger' ? '#FFF' : '#000';
  
  const handlePress = (e: any) => {
    if (!disabled) {
      // ✅ IMPLEMENTACIÓN TAREA 7: Vibración al pulsar
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress(e);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.8}>
      <LinearGradient
        colors={disabled ? ['#333', '#111'] : bgColors}
        style={styles.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[styles.buttonText, { color: disabled ? '#666' : textColor }]}>{text}</Text>
        {icon && <View style={styles.iconBubble}>{icon}</View>}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: { borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 16 },
  cardActive: { borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  cardGradient: { padding: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#111', borderRadius: 32, borderWidth: 1, borderColor: COLORS.border, padding: 24 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  buttonText: { fontFamily: 'Montserrat_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  iconBubble: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 6 },
  
  // Empty State Styles
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, opacity: 0.7 },
  emptyIconBubble: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  emptyText: { fontFamily: 'Montserrat_400Regular', color: '#666', fontSize: 14, letterSpacing: 1 },
});
