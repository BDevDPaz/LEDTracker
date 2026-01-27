import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { GlassModalWrapper, LuxuryButton } from './LuxuryUI';
import { COLORS } from '../constants/theme';

interface Props { visible: boolean; onConfirm: () => void; onCancel: () => void; }

export function LunchModal({ visible, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();

  return (
    <GlassModalWrapper visible={visible}>
      <View style={{alignItems: 'center', marginBottom: 20}}>
        <View style={styles.iconBubble}>
          <Ionicons name="cafe-outline" size={32} color={COLORS.gold} />
        </View>
        <Text style={styles.title}>{t.lunch_title || "Descanso"}</Text>
        <Text style={styles.msg}>{t.lunch_msg || "¿Deseas deducir 1h de almuerzo?"}</Text>
      </View>

      <View style={{ gap: 10 }}>
        <LuxuryButton text={t.lunch_yes || "SÍ, DEDUCIR (-1H)"} onPress={onConfirm} variant="success" />
        <LuxuryButton text={t.lunch_no || "NO, OMITIR"} onPress={onCancel} disabled={true} /> 
      </View>
    </GlassModalWrapper>
  );
}

const styles = StyleSheet.create({
  iconBubble: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.goldDim, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  // ✅ FUENTES APLICADAS:
  title: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 20, marginBottom: 8 },
  msg: { fontFamily: 'Montserrat_400Regular', color: COLORS.textSecondary, textAlign: 'center', fontSize: 14 },
});
