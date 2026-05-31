// --- src/components/LunchModal.tsx ---
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { GlassModalWrapper, LuxuryButton } from './LuxuryUI';
import { COLORS } from '../constants/theme';
import { log } from '../utils/logger'; // ✅ Importando logger

interface Props {
    visible: boolean;
    onConfirm: (minutes: number) => void;
    onCancel: () => void;
}

export function LunchModal({ visible, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();
  const [durationStr, setDurationStr] = useState('60');

  const handleConfirm = () => {
      const minutes = parseInt(durationStr) || 0;
      log('NARANJA', 'MODOS_ESPECIALES', 'EVENT', `Descanso de almuerzo confirmado: ${minutes} min`);
      onConfirm(minutes);
  };

  const handleNoLunch = () => {
      log('BLANCO', 'SIN_CAMBIOS', 'INFO', 'Jornada a punto de finalizar. Usuario indicó que no tomó almuerzo.');
      onConfirm(0);
  };

  const handleCancel = () => {
      log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', 'Lunch Modal cancelado por el usuario.');
      onCancel();
  };

  return (
    <GlassModalWrapper visible={visible}>
      <View style={{alignItems: 'center', marginBottom: 20}}>
        <Ionicons name="restaurant-outline" size={40} color={COLORS.gold} style={{marginBottom:10}} />
        <Text style={styles.title}>{t.lunch_title || "Registro de Almuerzo"}</Text>
        <Text style={styles.msg}>Ingresa duración (minutos):</Text>

        <View style={styles.inputContainer}>
            <TextInput
                style={styles.input}
                value={durationStr}
                onChangeText={setDurationStr}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
            />
            <Text style={styles.suffix}>min</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <LuxuryButton text="CONFIRMAR" onPress={handleConfirm} variant="success" />
        <LuxuryButton text="NO TOMÉ ALMUERZO" onPress={handleNoLunch} variant="secondary" />
        <LuxuryButton text="CANCELAR" onPress={handleCancel} variant="outline" />
      </View>
    </GlassModalWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 18, marginBottom: 5 },
  msg: { fontFamily: 'Montserrat_400Regular', color: '#AAA', fontSize: 12, marginBottom: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.gold },
  input: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat_700Bold', width: 60, textAlign: 'center' },
  suffix: { color: COLORS.gold, fontSize: 14, fontFamily: 'Montserrat_600SemiBold' }
});

