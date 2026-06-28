// --- src/components/LunchModal.tsx ---
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { GlassModalWrapper, LuxuryButton, LuxuryInput } from './LuxuryUI';
import { COLORS } from '../constants/theme';
import { log } from '../utils/logger';

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
        <View style={styles.iconHeader}>
          <Ionicons name="restaurant-outline" size={40} color={COLORS.gold} />
        </View>
        <Text style={styles.title}>{t.lunch_title || "Registro de Almuerzo"}</Text>
        <Text style={styles.msg}>{t.lunch_subtitle || "Deducción automática de tiempo"}</Text>

        <LuxuryInput
          containerStyle={styles.inputContainer}
          style={styles.input}
          value={durationStr}
          onChangeText={setDurationStr}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          textAlign="center"
        />
        <Text style={styles.suffix}>minutos</Text>
      </View>

      <View style={{ gap: 8 }}>
        <LuxuryButton text={t.btn_save || "CONFIRMAR"} onPress={handleConfirm} variant="success" />
        <LuxuryButton text={t.lunch_no || "NO TOMÉ ALMUERZO"} onPress={handleNoLunch} variant="secondary" />
        <LuxuryButton text={t.btn_cancel || "CANCELAR"} onPress={handleCancel} variant="outline" />
      </View>
    </GlassModalWrapper>
  );
}

const styles = StyleSheet.create({
  iconHeader: { marginBottom: 16, padding: 10, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 50 },
  title: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 20, marginBottom: 5, textAlign: 'center' },
  msg: { fontFamily: 'Montserrat_400Regular', color: '#AAA', fontSize: 12, marginBottom: 24, textAlign: 'center' },
  inputContainer: { width: 120, alignSelf: 'center' },
  input: { fontSize: 24, fontFamily: 'Montserrat_700Bold', color: COLORS.gold, textAlign: 'center' },
  suffix: { color: COLORS.textSecondary, fontSize: 10, fontFamily: 'Montserrat_600SemiBold', textTransform: 'uppercase', letterSpacing: 1, marginTop: -10, marginBottom: 10 }
});
