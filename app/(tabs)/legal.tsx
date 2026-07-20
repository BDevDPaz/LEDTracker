import React, { memo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton } from '../../src/components/ui/LuxuryUI';

function LegalScreenComponent() {
  const router = useRouter();
  const [gpsStatus, setGpsStatus] = useState('Checking...');
  const [notifStatus, setNotifStatus] = useState('Checking...');

  const checkPermissions = useCallback(async (isMountedRef: { current: boolean }) => {
      const { status: locStatus } = await Location.getForegroundPermissionsAsync();
      const { status: bgLocStatus } = await Location.getBackgroundPermissionsAsync();

      if (isMountedRef.current) {
        setGpsStatus(
        locStatus === 'granted' && bgLocStatus === 'granted'
          ? 'CONCEDIDO'
          : 'LIMITADO'
      );
      }

      const { status: nStatus } = await Notifications.getPermissionsAsync();
      if (isMountedRef.current) {
        setNotifStatus(nStatus === 'granted' ? 'CONCEDIDO' : 'DENEGADO');
      }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };
    void checkPermissions(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, [checkPermissions]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver al Inicio"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gold} />
          <Text style={styles.backText}>INICIO</Text>
        </TouchableOpacity>

        <Text style={styles.header}>LEGAL & SOPORTE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <LuxuryCard>
          <Text style={styles.sectionTitle}>ESTADO DE PERMISOS</Text>

          <View style={styles.permRow}>
            <Ionicons
              name="location"
              size={20}
              color={gpsStatus === 'CONCEDIDO' ? COLORS.success : '#FF3B30'}
            />
            <Text style={styles.permText}>GPS (Siempre): {gpsStatus}</Text>
          </View>

          <View style={styles.permRow}>
            <Ionicons
              name="notifications"
              size={20}
              color={notifStatus === 'CONCEDIDO' ? COLORS.success : '#FF3B30'}
            />
            <Text style={styles.permText}>Notificaciones: {notifStatus}</Text>
          </View>
        </LuxuryCard>

        <LuxuryCard>
          <Text style={styles.sectionTitle}>SOPORTE TÉCNICO</Text>
          <Text style={styles.bodyText}>
            Si experimentas problemas con el rastreo en segundo plano o el cálculo de
            nómina, contacta a nuestro equipo.
          </Text>

          <LuxuryButton
            text="CONTACTAR SOPORTE"
            onPress={() => Linking.openURL('mailto:support@wtracker.com')}
            variant="outline"
            style={styles.supportButton}
          />
        </LuxuryCard>

        <LuxuryCard>
          <Text style={styles.sectionTitle}>CRÉDITOS & LICENCIA</Text>
          <Text style={styles.bodyText}>WTracker Professional Edition</Text>
          <Text style={styles.bodyText}>
            Developer: <Text style={styles.highlightText}>BDevDPaz</Text>
          </Text>
          <Text style={styles.bodyText}>Versión: 1.0.0 (Luxury Glass Dark)</Text>
          <Text style={styles.bodyText}>© 2026 Todos los derechos reservados.</Text>
        </LuxuryCard>

        <LuxuryCard>
          <Text style={styles.sectionTitle}>AVISO LEGAL</Text>
          <Text style={styles.legalText}>
            WTracker utiliza servicios de ubicación en segundo plano para garantizar la
            precisión de los registros de entrada y salida del lugar de trabajo. Los datos se
            almacenan localmente encriptados y solo se transmiten cuando el usuario decide
            generar y enviar un reporte. Al utilizar esta aplicación, usted acepta el monitoreo
            de su ubicación durante las horas de jornada configuradas para fines de auditoría
            y nómina.
          </Text>
        </LuxuryCard>

        <View style={styles.scrollFooterSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backText: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 10,
    letterSpacing: 1,
  },
  header: {
    fontFamily: 'Montserrat_300Light',
    fontSize: 24,
    color: '#FFF',
  },
  scroll: {
    padding: 24,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.gold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  permText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFF',
    fontSize: 14,
  },
  bodyText: {
    fontFamily: 'Montserrat_400Regular',
    color: '#AAA',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  legalText: {
    fontFamily: 'Montserrat_400Regular',
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  supportButton: {
    marginTop: 16,
  },
  highlightText: {
    color: COLORS.gold,
  },
  scrollFooterSpacer: {
    height: 100,
  },
});

export default memo(LegalScreenComponent);
