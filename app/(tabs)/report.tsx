import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton } from '../../src/components/ui/LuxuryUI';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { generateWeeklyReport, sendReportByEmail } from '../../src/services/ReportGenerator';
import { getSettings } from '../../src/database/db';

export default function ReportScreen() {
  const router = useRouter();
  const { showToast } = useLuxuryUI();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDownload = async () => {
    setIsProcessing(true);
    const path = await generateWeeklyReport(true);
    setIsProcessing(false);
    if (path) showToast(t.toast_geofence_active || 'Reporte generado', 'success');
  };

  const handleEmail = async () => {
    setIsProcessing(true);
    const settings = await getSettings();
    const pdfUri = await generateWeeklyReport(false);

    if (pdfUri && settings) {
        await sendReportByEmail(pdfUri, settings);
        showToast('Abriendo correo...', 'success');
    } else {
        showToast('Error al preparar correo', 'error');
    }
    setIsProcessing(false);
  };

  return (
    <SafeAreaView testID='report-screen' style={styles.container} edges={['top']}>
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
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={styles.iconBadge}>
            <Ionicons name='document-text' size={24} color={COLORS.gold} />
          </View>
        </View>
      </View>

      <ScrollView testID='report-scroll-view' contentContainerStyle={styles.scroll}>

        {/* HEADER TITLE */}
        <View style={{ marginBottom: 40 }}>
          <Text testID='report-title' style={styles.appTitle}>{t.report_title || 'REPORTE SEMANAL'}</Text>
          <Text testID='report-subtitle' style={styles.subTitle}>{t.report_subtitle || 'NÓMINA Y AUDITORÍA'}</Text>
        </View>

        {/* PREVIEW CARD */}
        <LuxuryCard style={styles.previewCard}>
            <View testID='report-preview-icon' style={styles.docContainer}>
                <Ionicons name='document-attach' size={60} color={COLORS.textSecondary} />
                <View style={styles.docLines}>
                    <View style={[styles.line, { width: 60 }]} />
                    <View style={[styles.line, { width: 40 }]} />
                    <View style={[styles.line, { width: 50 }]} />
                </View>
            </View>
            <Text testID='report-card-title' style={styles.cardTitle}>{t.card_ready_title || 'Listo para Generar'}</Text>
            <Text testID='report-card-desc' style={styles.cardDesc}>
                {t.card_ready_desc || 'Genera un PDF oficial con el desglose de horas regulares, horas extra (Overtime) y registros de auditoría GPS.'}
            </Text>
        </LuxuryCard>

        {/* BOTONES DE ACCIÓN */}
        <View style={styles.actions}>
            <LuxuryButton
                testID='report-download-button'
                text={t.btn_download_pdf || 'DESCARGAR PDF'}
                variant='primary'
                onPress={handleDownload}
                disabled={isProcessing}
                icon={<Ionicons name='download-outline' size={20} color='#000' />}
                style={{ marginBottom: 16 }}
            />

            <LuxuryButton
                testID='report-email-button'
                text={t.btn_send_email || 'ENVIAR POR EMAIL'}
                variant='success'
                onPress={handleEmail}
                disabled={isProcessing}
                icon={<Ionicons name='mail-outline' size={20} color='#FFF' />}
                style={{ marginBottom: 16 }}
            />
        </View>

        {isProcessing && (
            <ActivityIndicator testID='report-loading' size='large' color={COLORS.gold} style={{marginTop: 30}} />
        )}

        <Text testID='report-footer-note' style={styles.footerNote}>
            {t.report_footer_note || '* Al enviar, se abrirá tu aplicación de correo predeterminada con el reporte adjunto automáticamente.'}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16
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
  appTitle: { fontFamily: 'Montserrat_700Bold', fontSize: 28, color: '#FFF', letterSpacing: 1 },
  subTitle: { fontFamily: 'Montserrat_400Regular', fontSize: 10, color: COLORS.gold, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  iconBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center' },
  previewCard: { alignItems: 'center', paddingVertical: 40, marginBottom: 40 },
  docContainer: { flexDirection: 'row', marginBottom: 25, opacity: 0.9, alignItems: 'center' },
  docLines: { marginLeft: 15, gap: 8 },
  line: { height: 4, backgroundColor: COLORS.textSecondary, borderRadius: 2 },
  cardTitle: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 18, marginBottom: 12 },
  cardDesc: { fontFamily: 'Montserrat_400Regular', color: '#AAA', textAlign: 'center', fontSize: 13, paddingHorizontal: 10, lineHeight: 22 },
  actions: { width: '100%' },
  footerNote: { fontFamily: 'Montserrat_400Regular', color: '#555', textAlign: 'center', fontSize: 11, marginTop: 40, fontStyle: 'italic', paddingHorizontal: 20 }
});
