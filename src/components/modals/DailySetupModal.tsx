// --- src/components/DailySetupModal.tsx ---
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { LuxuryButton, LuxuryInput, GlassModalWrapper } from '../ui/LuxuryUI';
import { log } from '../../utils/logger';
import { useLanguage } from '../../context/LanguageContext';

interface DailySetupModalProps {
  visible: boolean;
  onClose: () => void;
  onStart: (address: string, client: string, notes: string) => void;
  mode?: 'start' | 'transit';
}

export const DailySetupModal = ({ visible, onClose, onStart, mode = 'start' }: DailySetupModalProps) => {
  const { t } = useLanguage();
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [notes, setNotes] = useState('');

  const handleStart = () => {
    if (address.trim()) {
      if (mode === 'start') {
        log('VERDE', 'OPERACION_EXITOSA', 'INFO', `Nueva jornada configurada. Destino: ${address}`);
      } else {
        log('NARANJA', 'MODOS_ESPECIALES', 'EVENT', `Travel Mode (Trayecto) iniciado hacia: ${address}`);
      }

      onStart(address, client, notes);

      // Limpieza
      setAddress('');
      setClient('');
      setNotes('');
    }
  };

  const handleCancel = () => {
    log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', `Setup Modal cancelado (Modo: ${mode})`);
    onClose();
  };

  const title = mode === 'start' ? t.modal_title_start : t.modal_title_transit;
  const subtitle = mode === 'start' ? t.modal_subtitle_start : t.modal_subtitle_transit;
  const btnText = mode === 'start' ? t.btn_activate_geofence : t.btn_start_transit;
  const iconName = mode === 'start' ? "navigate-circle" : "car-sport";

  return (
    <GlassModalWrapper visible={visible}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.iconHeader}>
             <Ionicons name={iconName} size={40} color={COLORS.gold} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* INPUT DIRECCIÓN */}
          <LuxuryInput
            icon={<Ionicons name="location-sharp" size={20} color={COLORS.textSecondary} />}
            placeholder={t.input_address}
            value={address}
            onChangeText={setAddress}
            autoFocus={true}
          />

          {/* INPUT CLIENTE (Opcional) */}
          <LuxuryInput
            icon={<Ionicons name="person" size={20} color={COLORS.textSecondary} />}
            placeholder={t.input_client}
            value={client}
            onChangeText={setClient}
          />

          {/* INPUT NOTAS (Opcional) */}
          <LuxuryInput
            icon={<Ionicons name="document-text" size={20} color={COLORS.textSecondary} />}
            placeholder={t.input_notes}
            value={notes}
            onChangeText={setNotes}
          />

          <View style={styles.buttonRow}>
             <LuxuryButton
                text={t.btn_cancel}
                variant="secondary"
                onPress={handleCancel}
                style={{flex: 1, marginRight: 10}}
             />
             <LuxuryButton
                text={btnText}
                variant="primary"
                onPress={handleStart}
                disabled={!address.trim()}
                style={{flex: 1}}
             />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </GlassModalWrapper>
  );
};

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  iconHeader: { marginBottom: 16, padding: 10, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 50 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 20, color: '#FFF', letterSpacing: 1, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontFamily: 'Montserrat_400Regular', fontSize: 12, color: '#AAA', marginBottom: 24, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', width: '100%', marginTop: 10 }
});
