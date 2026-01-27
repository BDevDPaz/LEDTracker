// app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; 
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { getDB, insertWorkSession, updateSessionEndTime, getSettings } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { LocationService } from '../../src/services/LocationManager';
import { DailySetupModal } from '../../src/components/DailySetupModal';
import { LunchModal } from '../../src/components/LunchModal';
import { useLanguage } from '../../src/context/LanguageContext';

export default function HomeScreen() {
  const { t } = useLanguage();
  const router = useRouter(); // ✅ Necesario para limpiar la orden
  const params = useLocalSearchParams(); // ✅ Leemos los parámetros

  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [address, setAddress] = useState<string>('Cargando...');
  const [stats, setStats] = useState({ hours: 0, earnings: 0 });
  
  // Modales y Carga
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // ✅ Nuevo estado para evitar "trabe" visual

  // Cargar datos
  const loadData = async () => {
    try {
      const db = getDB();
      const settings = await getSettings();

      // Buscar sesión activa
      const session = await db.getFirstAsync<WorkSession>(
        "SELECT * FROM work_sessions WHERE status = 'active' OR status = 'travel' ORDER BY id DESC"
      );
      
      setActiveSession(session || null);
      
      if (session) {
        setAddress(session.address);
      } else {
        setAddress(t.status_inactive || "Fuera de Servicio");
      }

      calculateDailyStats(settings);

    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const calculateDailyStats = async (currentSettings: any) => {
    if (!currentSettings) return;
    const db = getDB();
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const sessions = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE start_time >= ?", 
      [startOfDay.getTime()]
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

    setStats({ 
      hours: parseFloat(hours.toFixed(2)), 
      earnings: parseFloat(earnings.toFixed(2)) 
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // ✅ CORRECCIÓN CRÍTICA: BUCLE INFINITO
  useEffect(() => {
    if (params.showSetup === 'true') {
      console.log("🔔 Notificación recibida: Abriendo modal...");
      setShowDailyModal(true);
      
      // 🔥 ESTO FALTABA: Borramos la orden inmediatamente
      router.setParams({ showSetup: undefined }); 
    }
  }, [params.showSetup]);

  // Acciones
  const handleStartDay = async (addr: string) => {
    setIsProcessing(true); // Mostramos spinner
    try {
      // 1. Permisos
      const perm = await LocationService.requestPermissions();
      if (!perm) {
        Alert.alert("Permiso Requerido", "Necesitamos acceso a tu ubicación.");
        setIsProcessing(false);
        return;
      }

      // 2. Obtener GPS
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      // 3. Guardar en DB
      await insertWorkSession({
        start_time: Date.now(),
        status: 'active',
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addr,
        location_confirmed: 1,
        is_manual_edit: 0,
        lunch_taken: 0,
        date_string: new Date().toISOString().split('T')[0]
      });

      // 4. Iniciar Rastreo
      await LocationService.startActiveTracking();
      
      // 5. Cerrar y Recargar
      setShowDailyModal(false);
      await loadData();

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo iniciar la sesión.");
    } finally {
      setIsProcessing(false); // Ocultamos spinner
    }
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    if (activeSession.lunch_taken === 0 && activeSession.status !== 'travel') {
        setShowLunchModal(true);
    } else {
        await completeSession();
    }
  };

  const completeSession = async (deductLunch = false) => {
     setIsProcessing(true);
     try {
       if (activeSession) {
         if (deductLunch) {
             const db = getDB();
             await db.runAsync("UPDATE work_sessions SET lunch_taken = 1 WHERE id = ?", [activeSession.id]);
         }
         await updateSessionEndTime(activeSession.id!, Date.now());
         await LocationService.stopMonitoring();
       }
       setShowLunchModal(false);
       await loadData();
       Alert.alert("Jornada Finalizada", "Horas registradas correctamente.");
     } catch (e) {
       console.error(e);
     } finally {
       setIsProcessing(false);
     }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF"/>}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
             <Text style={styles.greeting}>{t.header_title || "WorkTracker"}</Text>
             <Text style={styles.subGreeting}>{activeSession ? t.status_active : t.status_inactive}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowDailyModal(true)} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={32} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* TARJETA PRINCIPAL (ESTADO) */}
        <View style={[styles.card, activeSession ? styles.cardActive : styles.cardInactive]}>
           {isProcessing ? (
             <ActivityIndicator size="large" color="#FFF" style={{margin: 20}} />
           ) : (
             <>
               <Ionicons 
                 name={activeSession ? (activeSession.status==='travel' ? "car-sport" : "location") : "moon"} 
                 size={40} 
                 color="#FFF" 
                 style={{marginBottom: 10}}
               />
               <Text style={styles.addressText}>{address}</Text>
               {activeSession && (
                 <Text style={styles.timerText}>
                   {new Date(activeSession.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - En curso
                 </Text>
               )}
             </>
           )}
        </View>

        {/* BOTÓN DE ACCIÓN */}
        <TouchableOpacity 
          style={[
            activeSession ? styles.stopBtn : styles.startBtn,
            isProcessing && { opacity: 0.5 }
          ]} 
          onPress={activeSession ? handleClockOut : () => setShowDailyModal(true)}
          disabled={isProcessing}
        >
          <Text style={styles.btnText}>
            {activeSession ? t.btn_clock_out : t.btn_new_job}
          </Text>
        </TouchableOpacity>

        {/* ESTADÍSTICAS HOY */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_hours}</Text>
            <Text style={styles.statValue}>{stats.hours.toFixed(2)}h</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t.stats_earnings}</Text>
            <Text style={styles.statValue}>${stats.earnings.toFixed(2)}</Text>
          </View>
        </View>

        {/* MODALES */}
        <DailySetupModal 
          visible={showDailyModal} 
          onClose={() => {
            setShowDailyModal(false);
            router.setParams({ showSetup: undefined }); // Limpiar también al cerrar manual
          }}
          onStart={handleStartDay}
        />
        
        <LunchModal
          visible={showLunchModal}
          onConfirm={() => completeSession(true)}
          onCancel={() => completeSession(false)}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subGreeting: { fontSize: 14, color: '#AAA', marginTop: 2 },
  iconBtn: { padding: 5 },
  card: { padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, minHeight: 150, justifyContent: 'center' },
  cardActive: { backgroundColor: '#2E7D32' },
  cardInactive: { backgroundColor: '#1E1E1E' },
  addressText: { color: '#FFF', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 5 },
  timerText: { color: '#DDD', fontSize: 14 },
  startBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  stopBtn: { backgroundColor: '#D32F2F', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  statsContainer: { flexDirection: 'row', gap: 15 },
  statBox: { flex: 1, backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, alignItems: 'center' },
  statLabel: { color: '#AAA', fontSize: 12, marginBottom: 5 },
  statValue: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' }
});
