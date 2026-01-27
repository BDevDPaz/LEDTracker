import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { GlassModalWrapper, LuxuryButton } from './LuxuryUI';
import { COLORS } from '../constants/theme';

interface Props { visible: boolean; onClose: () => void; onStart: (address: string) => void; }

export function DailySetupModal({ visible, onClose, onStart }: Props) {
  const { t } = useLanguage();
  const [address, setAddress] = useState('');

  const handleStart = () => { if (address.trim().length > 0) { onStart(address); setAddress(''); } };

  return (
    <GlassModalWrapper visible={visible}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.daily_title || "Configuración Diaria"}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.label}>{t.daily_label || "¿Dónde trabajarás hoy?"}</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="map-outline" size={20} color={COLORS.gold} style={{marginRight: 10}}/>
        <TextInput
          style={styles.input}
          placeholder={t.daily_placeholder || "Ej: 5601 Balboa Blvd..."}
          placeholderTextColor="#444"
          value={address}
          onChangeText={setAddress}
          autoFocus
        />
      </View>

      <LuxuryButton text={t.daily_btn_start || "INICIAR JORNADA"} onPress={handleStart} />
    </GlassModalWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  // ✅ FUENTES APLICADAS:
  title: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 18, letterSpacing: 1 },
  closeBtn: { padding: 5 },
  label: { fontFamily: 'Montserrat_600SemiBold', color: COLORS.textSecondary, marginBottom: 12, fontSize: 12, letterSpacing: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 15, marginBottom: 24 },
  input: { fontFamily: 'Montserrat_400Regular', flex: 1, color: '#FFF', paddingVertical: 16, fontSize: 16 },
});
