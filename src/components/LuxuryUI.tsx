// --- src/components/LuxuryUI.tsx ---
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ViewStyle } from 'react-native';
import type { StyleProp, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';
import { log } from '../utils/logger';

// --- TARJETA ---
export const LuxuryCard = ({ children, active, style }: { children: React.ReactNode, active?: boolean, style?: StyleProp<ViewStyle> }) => (
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

// --- MODAL WRAPPER ---
export const GlassModalWrapper = ({ visible, children }: { visible: boolean, children: React.ReactNode }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.modalContent}>
        {children}
      </View>
    </View>
  </Modal>
);

// --- EMPTY STATE ---
export const LuxuryEmptyState = ({ text, icon = "file-tray-outline" }: { text: string, icon?: any }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconBubble}>
      <Ionicons name={icon} size={32} color={COLORS.textSecondary} />
    </View>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

// --- SKELETON ---
export const LuxurySkeleton = ({ width, height, style }: { width: DimensionValue, height: DimensionValue, style?: ViewStyle }) => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.3, { duration: 800 })),
      -1,
      true
    );
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{ width, height, backgroundColor: '#333', borderRadius: 12 }, style, animatedStyle]} />
  );
};

// --- BOTÓN ---
interface LuxuryButtonProps {
  onPress: (e: any) => void;
  text: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'outline' | 'success' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const LuxuryButton = ({ onPress, text, icon, variant = 'primary', disabled, style, testID }: LuxuryButtonProps) => {
  let bgColors: readonly [string, string, ...string[]] = ['#D4AF37', '#8a7224']; // Gold (Primary)
  let textColor = '#000';
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'danger') {
    bgColors = ['#FF3B30', '#991B1B'];
    textColor = '#FFF';
  } else if (variant === 'outline') {
    bgColors = ['transparent', 'transparent'];
    textColor = '#AAA';
    borderColor = '#333';
    borderWidth = 1;
  } else if (variant === 'success') {
    bgColors = ['#22c55e', '#14532d'];
    textColor = '#000';
  } else if (variant === 'secondary') {
    bgColors = ['#333333', '#1A1A1A'];
    textColor = '#FFF';
  }

  const handlePress = (e: any) => {
    if (!disabled) {
      log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', `UI: Botón presionado [${text}]`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress(e);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={style}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={text}
    >
      <LinearGradient
        colors={disabled ? ['#333', '#111'] : bgColors}
        style={[styles.button, { borderColor, borderWidth }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[styles.buttonText, { color: disabled ? '#666' : textColor }]}>{text}</Text>
        {icon && <View style={styles.iconBubble}>{icon}</View>}
      </LinearGradient>
    </TouchableOpacity>
  );
};

// --- INPUT ---
interface LuxuryInputProps {
  label?: string;
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  [key: string]: any;
}

export const LuxuryInput = ({ label, icon, containerStyle, ...props }: LuxuryInputProps) => (
  <View style={[styles.inputGroup, containerStyle]}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={styles.inputWrapper}>
      {icon && <View style={styles.inputIconWrapper}>{icon}</View>}
      <TextInput
        style={styles.input}
        placeholderTextColor="#444"
        {...props}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  cardContainer: { borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 20 },
  cardActive: { borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  cardGradient: { padding: 24 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#111', borderRadius: 32, borderWidth: 1, borderColor: COLORS.border, padding: 30 },
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: 'Montserrat_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  iconBubble: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, opacity: 0.7 },
  emptyIconBubble: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  emptyText: { fontFamily: 'Montserrat_400Regular', color: '#666', fontSize: 14, letterSpacing: 1 },
  // Estilos Input
  inputGroup: { marginBottom: 16, width: '100%' },
  inputLabel: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, height: 50, paddingHorizontal: 16 },
  inputIconWrapper: { marginRight: 12 },
  input: { flex: 1, color: '#FFF', fontFamily: 'Montserrat_400Regular', fontSize: 14 },
});
