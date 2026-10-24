import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { GlassModalWrapper, LuxuryButton } from '../ui/LuxuryUI';

interface PostWorkModalProps {
  visible: boolean;
  siteLabel?: string;
  /** "Terminar jornada": cierra el día (sin más sitios pendientes). */
  onEndDay: () => void;
  /** "Nuevo trabajo": abre DailySetupModal (se permite la misma dirección). */
  onNewJob: () => void;
}

export const PostWorkModal = memo(({ visible, siteLabel, onEndDay, onNewJob }: PostWorkModalProps) => (
  <GlassModalWrapper visible={visible}>
    <View testID='post-work-modal' style={styles.inner}>
      <Ionicons name='flag' size={40} color={COLORS.gold} style={styles.icon} />
      <Text style={styles.title}>Salida registrada</Text>
      <Text style={styles.subtitle}>
        {siteLabel
          ? `Tu sesión en ${siteLabel} se cerró automáticamente. ¿Qué deseas hacer?`
          : 'Tu sesión se cerró automáticamente. ¿Qué deseas hacer?'}
      </Text>
      <View style={styles.buttonRow}>
        <LuxuryButton
          testID='post-work-end-day'
          text='Terminar jornada'
          variant='secondary'
          onPress={onEndDay}
          style={{ flex: 1, marginRight: 10 }}
        />
        <LuxuryButton
          testID='post-work-new-job'
          text='Nuevo trabajo'
          variant='primary'
          onPress={onNewJob}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  </GlassModalWrapper>
));

PostWorkModal.displayName = 'PostWorkModal';

const styles = StyleSheet.create({
  inner: { padding: 24, alignItems: 'center' },
  icon: { marginBottom: 12 },
  title: { color: COLORS.gold, fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', width: '100%' },
});
