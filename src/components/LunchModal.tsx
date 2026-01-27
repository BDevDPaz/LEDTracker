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
      <View style={{alignItems: 'center', marginBottom: 24}}>
        <View style={styles.iconBubble}>
          <Ionicons name="fast-food-outline" size={32} color={COLORS.gold} />
        </View>
        <Text style={styles.title}>{t.lunch_title || "Descanso"}</Text>
        <Text style={styles.msg}>{t.lunch_msg || "¿Deseas deducir 1h de almuerzo?"}</Text>
      </View>

      <View style={{ gap: 4 }}>
        <LuxuryButton text={t.lunch_yes || "SÍ, DEDUCIR (-1H)"} onPress={onConfirm} variant="success" />
        {/* ✅ AHORA ES CLICKEABLE (Outline) */}
        <LuxuryButton text={t.lunch_no || "NO, OMITIR"} onPress={onCancel} variant="outline" />
      </View>
    </GlassModalWrapper>
  );
}

const styles = StyleSheet.create({
  iconBubble: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.goldDim, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  title: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 20, marginBottom: 10, letterSpacing: 0.5 },
  msg: { fontFamily: 'Montserrat_400Regular', color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
