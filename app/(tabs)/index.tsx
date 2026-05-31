// --- app/(tabs)/index.tsx ---
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

// Imports de Lógica
import { getDB, insertWorkSession, updateSessionEndTime, getSettings, updateSessionLunch, insertAuditLog } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { LocationService } from '../../src/services/LocationManager';
import { calculateSessionDuration, calculatePay } from '../../src/utils/payrollUtils';
import { log } from '../../src/utils/logger'; // ✅ Estándar de auditoría

// Componentes UI
import { DailySetupModal } from '../../src/components/DailySetupModal';
import { LunchModal } from '../../src/components/LunchModal';
import { useLanguage } from '../../src/context/LanguageContext';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton, GlassModalWrapper } from '../../src/components/LuxuryUI';
import { formatTime } from '../../src/utils/dateUtils';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { showToast } = useLuxuryUI();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Estados
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [address, setAddress] = useState<string>('Cargando...');
  const [stats, setStats] = useState({ hours: 0, earnings: 0 });

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupMode, setSetupMode] = useState<'start' | 'transit'>('start');
  const [showLunchModal, setShowLunchModal] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [easterEggCount, setEasterEggCount] = useState(0);
  const [showSpecialCard, setShowSpecialCard] = useState(false);
  const pulseAnim = useSharedValue(1);

  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1, true
    );

    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response?.notification?.request?.content?.data || {};

      if (data.action === 'OPEN_DAILY_SETUP') {
        setSetupMode('start');
        setShowSetupModal(true);
      } else if (data.action === 'GENERATE_REPORT_PROMPT') {
        router.push('/(tabs)/report');
      } else if (data.action === 'CHECKOUT_DECISION') {
        triggerCheckoutDecision();
      }
    });

    return () => subscription.remove();
  }, []);

  // Control de Parámetros (Navegación desde _layout)
  useEffect(() => {
    if (params.showSetup === 'true') {
      setSetupMode('start');
      setShowSetupModal(true);
      router.setParams({ showSetup: undefined });
    }

    if (params.showCheckoutPrompt === 'true') {
      triggerCheckoutDecision();
      router.setParams({ showCheckoutPrompt: undefined });
    }
  }, [params.showSetup, params.showCheckoutPrompt]);

  const calculateDailyStats = async (currentSettings: any) => {
    if (!currentSettings) return;
    const db = getDB();
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const sessions = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE start_time >= ?", [startOfDay.getTime()]
    );

    let totalHoursToday = 0;

    sessions.forEach(s => {
      if (s.status === 'pending_arrival') return;

      const end = s.end_time ? s.end_time : Date.now();
      const startPoint = s.actual_start_time || s.start_time;

      const durationMs = calculateSessionDuration(
        startPoint,
        end,
        s.lunch_taken,
        s.lunch_start,
        s.lunch_end
      );

      totalHoursToday += durationMs / (1000 * 60 * 60);
    });

    const { totalPay } = calculatePay(
      totalHoursToday,
      currentSettings.hourly_rate,
      currentSettings.overtime_multiplier
    );

    setStats({
      hours: parseFloat(totalHoursToday.toFixed(2)),
      earnings: parseFloat(totalPay.toFixed(2))
    });
  };

  const loadData = async () => {
    try {
      const db = getDB();

      const [settings, session] = await Promise.all([
        getSettings(),
        db.getFirstAsync<WorkSession>(
          "SELECT * FROM work_sessions WHERE status IN ('active', 'travel', 'pending_arrival') ORDER BY id DESC"
        )
      ]);

      setActiveSession(session || null);

      if (session) {
        if (session.status === 'pending_arrival') {
           setAddress(`Rumbo a: ${session.address}`);
        } else if (session.status === 'travel') {
           setAddress(`Tránsito a: ${session.address}`);
        } else {
           setAddress(session.address);
        }
      } else {
        setAddress(t.status_inactive || "Fuera de Servicio");
      }

      calculateDailyStats(settings);
    } catch (e) { log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando datos del HomeScreen', e); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleClockOut = async () => {
    if (!activeSession) return;
    if (activeSession.status === 'active' && activeSession.lunch_taken === 0) {
        setShowLunchModal(true);
    } else {
        await completeSession(0);
    }
  };

  const triggerCheckoutDecision = () => {
    log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', 'UI: Mostrando decisión de Checkout');
    Alert.alert(
      "📍 Saliste del Área de Trabajo",
      "¿Terminaste tu jornada o vas a otro sitio?",
      [
        {
          text: "Otro Trabajo",
          onPress: () => {
             log('NARANJA', 'MODOS_ESPECIALES', 'EVENT', 'Usuario seleccionó ir a otro trabajo (Travel Mode)');
             setSetupMode('transit');
             setShowSetupModal(true);
          }
        },
        {
          text: "Terminar Jornada",
          style: 'destructive',
          onPress: () => {
             log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Usuario seleccionó terminar la jornada');
             handleClockOut();
          }
        }
      ]
    );
  };

  const handleSetupSubmit = async (addrInput: string, clientInput: string, notesInput: string) => {
    setIsProcessing(true);
    try {
      const perm = await LocationService.requestPermissions();
      if (!perm) {
        log('AMARILLO', 'ADVERTENCIA', 'WARN', 'Permisos de ubicación denegados al configurar jornada');
        showToast("Se requiere ubicación", "error"); setIsProcessing(false); return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      const geocoded = await Location.geocodeAsync(addrInput);
      if (!geocoded || geocoded.length === 0) {
        log('AMARILLO', 'ADVERTENCIA', 'WARN', `No se encontró la dirección: ${addrInput}`);
        showToast("Dirección no encontrada", "error");
        setIsProcessing(false);
        return;
      }
      const target = geocoded[0];

      const db = getDB();
      const settings = await getSettings();
      const localDate = new Date();
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      if (setupMode === 'start') {
        await insertWorkSession({
          start_time: Date.now(),
          status: 'pending_arrival',
          latitude: 0,
          longitude: 0,
          target_latitude: target.latitude,
          target_longitude: target.longitude,
          setup_latitude: loc.coords.latitude,
          setup_longitude: loc.coords.longitude,
          address: addrInput,
          client_name: clientInput,
          manual_note: notesInput,
          location_confirmed: 0,
          is_manual_edit: 0,
          lunch_taken: 0,
          date_string: dateStr
        });

        await insertAuditLog(0, 'SETUP_START', `Inicio a: ${addrInput} | Cliente: ${clientInput}`);
        log('VERDE', 'OPERACION_EXITOSA', 'INFO', `Nueva sesión creada hacia: ${addrInput}`);

      } else {
        if (activeSession?.id) {
            await db.runAsync(
                `UPDATE work_sessions SET status = 'travel', address = ?, client_name = ?, manual_note = ?, target_latitude = ?, target_longitude = ? WHERE id = ?`,
                [addrInput, clientInput, notesInput, target.latitude, target.longitude, activeSession.id]
            );
            await insertAuditLog(activeSession.id, 'TRANSIT_START', `Tránsito a: ${addrInput} | Cliente: ${clientInput}`);
            log('NARANJA', 'MODOS_ESPECIALES', 'EVENT', `Sesión actualizada a Travel Mode hacia: ${addrInput}`);
        }
      }

      await LocationService.startMonitoringArrival(target.latitude, target.longitude, settings?.tolerance_radius || 200);

      setShowSetupModal(false);
      await loadData();
      showToast(setupMode === 'start' ? "Geocerca Activada" : "Tránsito iniciado", "success");

    } catch (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Fallo general configurando la jornada/tránsito', error);
      showToast("Error al configurar", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const completeSession = async (lunchMinutes: number) => {
     setIsProcessing(true);
     try {
       if (activeSession) {
         const now = Date.now();

         if (lunchMinutes > 0) {
             const startT = activeSession.actual_start_time || activeSession.start_time;
             const sessionDuration = now - startT;
             const lunchMidPoint = startT + (sessionDuration / 2);
             const lunchStart = lunchMidPoint - (lunchMinutes * 60 * 1000 / 2);
             const lunchEnd = lunchMidPoint + (lunchMinutes * 60 * 1000 / 2);
             await updateSessionLunch(activeSession.id!, lunchStart, lunchEnd);
         }

         await updateSessionEndTime(activeSession.id!, now);
         await LocationService.stopMonitoring();
         await insertAuditLog(activeSession.id!, 'MANUAL_CHECKOUT', 'Fin de jornada manual.');
         log('VERDE', 'OPERACION_EXITOSA', 'INFO', `Sesión completada exitosamente (ID: ${activeSession.id})`);
       }
       setShowLunchModal(false);
       await loadData();
       showToast("Jornada finalizada", "success");
     } catch (e) {
       log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al cerrar la sesión en la base de datos', e);
       showToast("Error al finalizar", "error");
     } finally { setIsProcessing(false); }
  };

  const getStatusIcon = () => {
    if (!activeSession) return "moon";
    if (activeSession.status === 'pending_arrival') return "navigate";
    if (activeSession.status === 'travel') return "car-sport";
    return "location";
  };

  const getStatusColor = () => {
    if (!activeSession) return COLORS.textSecondary;
    if (activeSession.status === 'pending_arrival') return '#f59e0b';
    if (activeSession.status === 'travel') return '#3b82f6';
    return COLORS.gold;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEasterEggTap = () => {
    const newCount = easterEggCount + 1;
    setEasterEggCount(newCount);
    if (newCount === 3) {
      log('BLANCO', 'SIN_CAMBIOS', 'DEBUG', 'Easter Egg del CEO activado en la UI');
      setShowSpecialCard(true);
      setEasterEggCount(0);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold}/>
      }>

        <View style={styles.header}>
          <View>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <Text style={styles.appTitle}>{t.header_title || "LED Tracker"}</Text>
                <TouchableOpacity
                   onPress={handleEasterEggTap}
                   activeOpacity={0.8}
                >
                   <Animated.View style={animatedIconStyle}>
                      <Ionicons name="flash" size={18} color={COLORS.gold} />
                   </Animated.View>
                </TouchableOpacity>
             </View>
             <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: activeSession ? (activeSession.status === 'active' ? COLORS.success : '#f59e0b') : '#666' }]} />
                <Text style={styles.statusText}>
                    {!activeSession ? t.status_inactive :
                     activeSession.status === 'pending_arrival' ? "ESPERANDO LLEGADA" :
                     activeSession.status === 'travel' ? "EN TRÁNSITO" :
                     t.status_active}
                </Text>
             </View>
          </View>
        </View>

        <LuxuryCard active={!!activeSession} style={{ minHeight: 220, justifyContent: 'center' }}>
           {isProcessing ? (
             <ActivityIndicator size="large" color={COLORS.gold} />
           ) : (
             <View style={{ alignItems: 'center' }}>
               <View style={[styles.iconBubble, activeSession && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                 <Ionicons
                   name={getStatusIcon()}
                   size={32}
                   color={getStatusColor()}
                 />
               </View>
               <Text style={styles.label}>
                   {activeSession?.status === 'pending_arrival' ? "DESTINO CONFIGURADO" : "UBICACIÓN ACTUAL"}
               </Text>
               <Text style={[styles.addressText, activeSession && { color: '#FFF' }]}>{address}</Text>

               {activeSession && activeSession.status !== 'pending_arrival' && (
                 <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={14} color={COLORS.gold} />
                    <Text style={styles.timerText}>
                      {formatTime(activeSession.actual_start_time || activeSession.start_time)} - En curso
                    </Text>
                 </View>
               )}

               {activeSession?.status === 'pending_arrival' && (
                 <Text style={{color: '#f59e0b', fontSize: 10, marginTop: 10, fontFamily: 'Montserrat_600SemiBold'}}>
                    Geocerca Activa • Check-in automático al llegar
                 </Text>
               )}
             </View>
           )}
        </LuxuryCard>

        <LuxuryButton
            text={activeSession ? t.btn_clock_out : t.btn_new_job}
            variant={activeSession ? 'danger' : 'primary'}
            onPress={activeSession ? handleClockOut : () => { setSetupMode('start'); setShowSetupModal(true); }}
            disabled={isProcessing}
            icon={<Ionicons name={activeSession ? "stop" : "play"} size={18} color={activeSession ? "#FFF" : "#000"} />}
        />

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_hours}</Text>
            <Text style={styles.statValue}>{stats.hours.toFixed(2)}h</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxGold]}>
            <Text style={[styles.statLabel, {color: COLORS.gold}]}>{t.stats_earnings}</Text>
            <Text style={[styles.statValue, {color: COLORS.gold}]}>${stats.earnings.toFixed(2)}</Text>
          </View>
        </View>

        <DailySetupModal
          visible={showSetupModal}
          onClose={() => { setShowSetupModal(false); router.setParams({ showSetup: undefined }); }}
          onStart={handleSetupSubmit}
          mode={setupMode}
        />

        <LunchModal
          visible={showLunchModal}
          onConfirm={completeSession}
          onCancel={() => setShowLunchModal(false)}
        />

        <GlassModalWrapper visible={showSpecialCard}>
           <View style={{alignItems: 'center', padding: 10}}>
              <Ionicons name="trophy" size={40} color={COLORS.gold} style={{marginBottom: 20}} />
              <Text style={styles.eggTitle}>LED Tracker Special Edition</Text>
              <Text style={styles.eggAuthor}>by BDevDPaz</Text>
              <View style={styles.eggDivider} />
              <Text style={styles.eggText}>
                Para uso restringido de{"\n"}
                <Text style={{color: '#FFF'}}>Alex León</Text>{"\n"}
                CEO de LEON&apos;S ELECTRICAL DESIGN
              </Text>
              <TouchableOpacity
                 onPress={() => setShowSpecialCard(false)}
                 style={{marginTop: 30}}
              >
                 <Text style={{color: COLORS.gold, fontSize: 12, fontFamily: 'Montserrat_700Bold'}}>CERRAR</Text>
              </TouchableOpacity>
           </View>
        </GlassModalWrapper>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  appTitle: { fontFamily: 'Montserrat_700Bold', fontSize: 28, color: '#FFF', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Montserrat_700Bold', fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2, textTransform: 'uppercase' },
  iconBubble: { padding: 16, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16 },
  label: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  addressText: { fontFamily: 'Montserrat_600SemiBold', color: COLORS.textSecondary, fontSize: 22, textAlign: 'center', marginBottom: 12 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceHighlight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  timerText: { fontFamily: 'Montserrat_600SemiBold', color: COLORS.gold, fontSize: 12 },
  statsContainer: { flexDirection: 'row', gap: 14 },
  statBox: { flex: 1, backgroundColor: COLORS.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statBoxGold: { borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(212,175,55,0.05)' },
  statLabel: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' },
  statValue: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 22 },
  eggTitle: { fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 18, textAlign: 'center', marginBottom: 5 },
  eggAuthor: { fontFamily: 'Montserrat_400Regular', color: '#FFF', fontSize: 12, textAlign: 'center', marginBottom: 20, letterSpacing: 1 },
  eggDivider: { height: 1, width: 50, backgroundColor: COLORS.border, marginBottom: 20 },
  eggText: { fontFamily: 'Montserrat_600SemiBold', color: '#AAA', fontSize: 10, textAlign: 'center', lineHeight: 18 }
});

