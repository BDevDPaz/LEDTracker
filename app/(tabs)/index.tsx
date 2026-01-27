import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'; // 👈 Agregado Alert
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; 
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

import { getDB, insertWorkSession, updateSessionEndTime, getSettings, updateSessionLunch } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { LocationService, createTransitSession } from '../../src/services/LocationManager';
import { DailySetupModal } from '../../src/components/DailySetupModal';
import { LunchModal } from '../../src/components/LunchModal';
import { useLanguage } from '../../src/context/LanguageContext';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { COLORS } from '../../src/constants/theme';
import { LuxuryCard, LuxuryButton, GlassModalWrapper } from '../../src/components/LuxuryUI';
import { formatTime } from '../../src/utils/dateUtils';
import { getDistanceFromLatLonInMeters } from '../../src/utils/geoUtils'; // 👈 Importamos tu utilidad

export default function HomeScreen() {
  const { t } = useLanguage();
  const { showToast } = useLuxuryUI();
  const router = useRouter(); 
  const params = useLocalSearchParams(); 

  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [address, setAddress] = useState<string>('Cargando...');
  const [stats, setStats] = useState({ hours: 0, earnings: 0 });
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 

  const [easterEggCount, setEasterEggCount] = useState(0);
  const [showSpecialCard, setShowSpecialCard] = useState(false);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true
    );

    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const actionId = response.actionIdentifier;
      // ✅ TU LÓGICA: Si tocan la notificación de la mañana, abrir el setup
      if (actionId === 'OPEN_DAILY_SETUP' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
         setShowDailyModal(true);
      } 
      else if (actionId === 'FINISH_DAY') {
        showToast("Jornada finalizada correctamente", "success");
        await loadData();
      } else if (actionId === 'TRANSIT') {
        try {
          await createTransitSession();
          showToast("Modo Tránsito Activado", "success");
          await loadData();
        } catch (e) { console.error(e); }
      }
    });
    return () => subscription.remove();
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const handleEasterEggTap = () => {
    const newCount = easterEggCount + 1;
    setEasterEggCount(newCount);
    if (newCount === 3) { setShowSpecialCard(true); setEasterEggCount(0); }
  };

  const loadData = async () => {
    try {
      const db = getDB();
      const settings = await getSettings();
      const session = await db.getFirstAsync<WorkSession>(
        "SELECT * FROM work_sessions WHERE status = 'active' OR status = 'travel' ORDER BY id DESC"
      );
      
      setActiveSession(session || null);
      setAddress(session ? session.address : (t.status_inactive || "Fuera de Servicio"));
      calculateDailyStats(settings);
    } catch (e) { console.error("Error loading data:", e); }
  };

  const calculateDailyStats = async (currentSettings: any) => {
    if (!currentSettings) return;
    const db = getDB();
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const sessions = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE start_time >= ?", [startOfDay.getTime()]
    );

    let totalMs = 0;
    sessions.forEach(s => {
      const end = s.end_time ? s.end_time : Date.now();
      let duration = end - s.start_time;
      if (s.lunch_taken) duration -= 3600000; 
      totalMs += Math.max(0, duration);
    });

    const hours = totalMs / (1000 * 60 * 60);
    const earnings = hours * currentSettings.hourly_rate;

    setStats({ hours: parseFloat(hours.toFixed(2)), earnings: parseFloat(earnings.toFixed(2)) });
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    if (params.showSetup === 'true') {
      setShowDailyModal(true);
      router.setParams({ showSetup: undefined }); 
    }
  }, [params.showSetup]);

  // 🔥 AQUÍ ESTÁ LA VALIDACIÓN QUE DISEÑASTE
  const handleStartDay = async (addrInput: string) => {
    setIsProcessing(true); 
    try {
      const perm = await LocationService.requestPermissions();
      if (!perm) { showToast("Se requiere ubicación", "error"); setIsProcessing(false); return; }
      
      // 1. Obtener GPS Real
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      // 2. 👮 EL POLICÍA: Validar coherencia (Geocoding)
      // Intentamos convertir lo que el usuario escribió en coordenadas
      try {
        const geocoded = await Location.geocodeAsync(addrInput);
        
        if (geocoded && geocoded.length > 0) {
          const target = geocoded[0];
          const dist = getDistanceFromLatLonInMeters(
            loc.coords.latitude, loc.coords.longitude,
            target.latitude, target.longitude
          );

          // Si la distancia es mayor a 2km entre lo que escribió y dónde está... ALERTA
          if (dist > 2000) {
             Alert.alert(
               "Ubicación Incorrecta 🛑",
               `Dices estar en "${addrInput}", pero el GPS te ubica a ${(dist/1000).toFixed(1)}km de ahí.\n\n¿Estás realmente en el sitio de trabajo?`,
               [
                 { text: "Corregir Dirección", style: "cancel", onPress: () => setIsProcessing(false) },
                 { text: "Iniciar de todas formas", style: "destructive", onPress: () => processStartSession(addrInput, loc) }
               ]
             );
             return; // Detenemos aquí si no confirma
          }
        }
      } catch (geoError) {
        console.log("Geocoding skip (address not found or API limits)", geoError);
        // Si no podemos geocodificar (ej. usuario escribe "Proyecto Alpha"), dejamos pasar confiando en el usuario
      }

      // Si pasa la validación, procesamos
      await processStartSession(addrInput, loc);

    } catch (error) { console.error(error); showToast("Error al iniciar", "error"); setIsProcessing(false); } 
  };

  // Función auxiliar para insertar en DB
  const processStartSession = async (addr: string, loc: Location.LocationObject) => {
      const localDate = new Date();
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      await insertWorkSession({
        start_time: Date.now(),
        status: 'active',
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addr,
        location_confirmed: 1,
        is_manual_edit: 0,
        lunch_taken: 0,
        date_string: dateStr
      });
      await LocationService.startActiveTracking();
      setShowDailyModal(false);
      await loadData();
      showToast("Jornada iniciada", "success");
      setIsProcessing(false);
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    if (activeSession.status !== 'travel' && activeSession.lunch_taken === 0) {
        setShowLunchModal(true);
    } else {
        await completeSession(0);
    }
  };

  const completeSession = async (lunchMinutes: number) => {
     setIsProcessing(true);
     try {
       if (activeSession) {
         const now = Date.now();
         if (lunchMinutes > 0) {
             const sessionDuration = now - activeSession.start_time;
             const lunchMidPoint = activeSession.start_time + (sessionDuration / 2);
             
             const lunchStart = lunchMidPoint - (lunchMinutes * 60 * 1000 / 2);
             const lunchEnd = lunchMidPoint + (lunchMinutes * 60 * 1000 / 2);
             
             await updateSessionLunch(activeSession.id!, lunchStart, lunchEnd);
         }
         await updateSessionEndTime(activeSession.id!, now);
         await LocationService.stopMonitoring();
       }
       setShowLunchModal(false);
       await loadData();
       showToast("Jornada finalizada", "success");
     } catch (e) { console.error(e); showToast("Error al finalizar", "error"); } 
     finally { setIsProcessing(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold}/>}>
        
        <View style={styles.header}>
          <View>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <Text style={styles.appTitle}>{t.header_title || "LED Tracker"}</Text>
                <TouchableOpacity onPress={handleEasterEggTap} activeOpacity={0.8}>
                   <Animated.View style={animatedIconStyle}>
                      <Ionicons name="flash" size={18} color={COLORS.gold} />
                   </Animated.View>
                </TouchableOpacity>
             </View>
             <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: activeSession ? COLORS.success : '#666' }]} />
                <Text style={styles.statusText}>{activeSession ? t.status_active : t.status_inactive}</Text>
             </View>
          </View>
        </View>

        <LuxuryCard active={!!activeSession} style={{ minHeight: 220, justifyContent: 'center' }}>
           {isProcessing ? (
             <ActivityIndicator size="large" color={COLORS.gold} />
           ) : (
             <View style={{ alignItems: 'center' }}>
               <View style={[styles.iconBubble, activeSession && { backgroundColor: COLORS.goldDim }]}>
                 <Ionicons 
                   name={activeSession ? (activeSession.status==='travel' ? "car-sport" : "location") : "moon"} 
                   size={32} 
                   color={activeSession ? COLORS.gold : COLORS.textSecondary} 
                 />
               </View>
               <Text style={styles.label}>UBICACIÓN ACTUAL</Text>
               <Text style={[styles.addressText, activeSession && { color: '#FFF' }]}>{address}</Text>
               
               {activeSession && (
                 <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={14} color={COLORS.gold} />
                    <Text style={styles.timerText}>
                      {formatTime(activeSession.start_time)} - En curso
                    </Text>
                 </View>
               )}
             </View>
           )}
        </LuxuryCard>

        <LuxuryButton 
            text={activeSession ? t.btn_clock_out : t.btn_new_job}
            variant={activeSession ? 'danger' : 'primary'}
            onPress={activeSession ? handleClockOut : () => setShowDailyModal(true)}
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
          visible={showDailyModal} 
          onClose={() => { setShowDailyModal(false); router.setParams({ showSetup: undefined }); }}
          onStart={handleStartDay}
        />
        
        <LunchModal
          visible={showLunchModal}
          onConfirm={completeSession}
          onCancel={() => setShowLunchModal(false)}
        />

        <GlassModalWrapper visible={showSpecialCard}>
           <View style={{alignItems: 'center', padding: 10}}>
              <Ionicons name="trophy" size={40} color={COLORS.gold} style={{marginBottom: 20}} />
              <Text style={{fontFamily: 'Montserrat_700Bold', color: COLORS.gold, fontSize: 18, textAlign: 'center', marginBottom: 5}}>LED Tracker Special Edition</Text>
              <Text style={{fontFamily: 'Montserrat_400Regular', color: '#FFF', fontSize: 12, textAlign: 'center', marginBottom: 20, letterSpacing: 1}}>by BDevDPaz</Text>
              <View style={{height: 1, width: 50, backgroundColor: COLORS.border, marginBottom: 20}} />
              <Text style={{fontFamily: 'Montserrat_600SemiBold', color: '#AAA', fontSize: 10, textAlign: 'center', lineHeight: 18}}>
                Para uso restringido de{"\n"}<Text style={{color: '#FFF'}}>Alex León</Text>{"\n"}CEO de LEON'S ELECTRICAL DESIGN
              </Text>
              <TouchableOpacity onPress={() => setShowSpecialCard(false)} style={{marginTop: 30}}>
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
  statValue: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 22 }
});
