// --- app/(tabs)/report.tsx ---
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton } from '../../src/components/LuxuryUI';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { generateWeeklyReport, sendReportByEmail } from '../../src/services/ReportGenerator';
import { getSettings } from '../../src/database/db';

export default function ReportScreen() {
  const { showToast } = useLuxuryUI();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDownload = async () => {
    setIsProcessing(true);
    // true = compartir/descargar
    const path = await generateWeeklyReport(true);
    setIsProcessing(false);
    if (path) showToast("Reporte generado", "success");
  };

  const handleEmail = async () => {
    setIsProcessing(true);
    const settings = await getSettings();
    // false = solo generar URI para adjuntar
    const pdfUri = await generateWeeklyReport(false);

    if (pdfUri && settings) {
        await sendReportByEmail(pdfUri, settings);
        showToast("Abriendo correo...", "success");
    } else {
        showToast("Error al preparar correo", "error");
    }
    setIsProcessing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* HEADER */}
        <View style={styles.header}>
            <View>
              <Text style={styles.appTitle}>REPORTE SEMANAL</Text>
              <Text style={styles.subTitle}>NÓMINA Y AUDITORÍA</Text>
            </View>
            <View style={styles.iconBadge}>
               <Ionicons name="document-text" size={28} color={COLORS.gold} />
            </View>
        </View>

        {/* PREVIEW CARD */}
        <LuxuryCard style={styles.previewCard}>
            <View style={styles.docContainer}>
                <Ionicons name="document-attach" size={60} color={COLORS.textSecondary} />
                <View style={styles.docLines}>
                    <View style={[styles.line, { width: 60 }]} />
                    <View style={[styles.line, { width: 40 }]} />
                    <View style={[styles.line, { width: 50 }]} />
                </View>
            </View>
            <Text style={styles.cardTitle}>Listo para Generar</Text>
            <Text style={styles.cardDesc}>
                Genera un PDF oficial con el desglose de horas regulares, horas extra (Overtime) y registros de auditoría GPS.
            </Text>
        </LuxuryCard>

        {/* BOTONES DE ACCIÓN */}
        <View style={styles.actions}>
            <LuxuryButton
                text="DESCARGAR PDF"
                variant="primary"
                onPress={handleDownload}
                disabled={isProcessing}
                icon={<Ionicons name="download-outline" size={20} color="#000" />}
            />

            <View style={{height: 20}} />

            <LuxuryButton
                text="ENVIAR A ALEX LEÓN"
                variant="success"
                onPress={handleEmail}
                disabled={isProcessing}
                icon={<Ionicons name="mail-outline" size={20} color="#FFF" />}
            />
        </View>

        {isProcessing && (
            <ActivityIndicator size="large" color={COLORS.gold} style={{marginTop: 30}} />
        )}

        <Text style={styles.footerNote}>
            * Al enviar, se abrirá tu aplicación de correo predeterminada con el reporte adjunto automáticamente.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, marginTop: 10 },
  appTitle: { fontFamily: 'Montserrat_700Bold', fontSize: 24, color: '#FFF', letterSpacing: 1 },
  subTitle: { fontFamily: 'Montserrat_400Regular', fontSize: 10, color: COLORS.gold, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  iconBadge: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center' },
  previewCard: { alignItems: 'center', paddingVertical: 40, marginBottom: 40 },
  docContainer: { flexDirection: 'row', marginBottom: 25, opacity: 0.9, alignItems: 'center' },
  docLines: { marginLeft: 15, gap: 8 },
  line: { height: 4, backgroundColor: COLORS.textSecondary, borderRadius: 2 },
  cardTitle: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 18, marginBottom: 12 },
  cardDesc: { fontFamily: 'Montserrat_400Regular', color: '#AAA', textAlign: 'center', fontSize: 13, paddingHorizontal: 10, lineHeight: 22 },
  actions: { width: '100%' },
  footerNote: { fontFamily: 'Montserrat_400Regular', color: '#555', textAlign: 'center', fontSize: 11, marginTop: 40, fontStyle: 'italic', paddingHorizontal: 20 }
});

