// app/(tabs)/index.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';

import { useLanguage } from '../../src/context/LanguageContext';
import { getDB, insertWorkSession, updateSessionEndTime, getSettings } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { getDistanceFromLatLonInMeters } from '../../src/utils/geoUtils';
import { LocationService } from '../../src/services/LocationManager';
import DailySetupModal from '../../src/components/DailySetupModal';
import LunchModal from '../../src/components/LunchModal';

export default function HomeScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const [session, setSession] = useState<WorkSession | null>(null);
  const [stats, setStats] = useState({ hours: '0.00', earnings: '0.00' });
  const [modalVisible, setModalVisible] = useState(false);
  const [lunchVisible, setLunchVisible] = useState(false);

  // ✅ Abrir modal si viene desde notificación
  useEffect(() => {
    if (params.showSetup === 'true') {
      setModalVisible(true);
    }
  }, [params]);

  useFocusEffect(useCallback(() => { refreshData(); }, []));

  const refreshData = async () => {
    const db = getDB();
    // ✅ Buscar sesión activa o en tránsito
    const current = await db.getFirstAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE (status = 'active' OR status = 'travel') ORDER BY id DESC LIMIT 1"
    );
    setSession(current || null);

    // ✅ Calcular stats del día (incluye travel)
    const today = new Date().toISOString().split('T')[0];
    const sessions = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE date_string = ? AND status != 'deleted'",
      [today]
    );
    const settings = await getSettings();

    let totalMs = 0;
    sessions.forEach(s => {
      const start = s.start_time;
      const end = s.end_time || Date.now();
      let dur = end - start;
      if (s.lunch_taken === 1) dur -= 3600000;
      totalMs += Math.max(0, dur);
    });

    const hours = totalMs / (1000 * 60 * 60);
    setStats({
      hours: hours.toFixed(2),
      earnings: (hours * (settings?.hourly_rate || 0)).toFixed(2)
    });
  };

  const handleStartWork = async (address: string) => {
    const ok = await LocationService.requestPermissions();
    if (!ok) return Alert.alert("Error", "Permisos requeridos.");

    const userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const geocoded = await Location.geocodeAsync(address);
    if (!geocoded.length) return Alert.alert("Error", "Dirección no encontrada.");

    const dist = getDistanceFromLatLonInMeters(
      userLoc.coords.latitude, userLoc.coords.longitude,
      geocoded[0].latitude, geocoded[0].longitude
    );
    const settings = await getSettings();
    const tolerance = settings?.tolerance_radius || 50;
    if (dist > tolerance) return Alert.alert(t.err_out_of_range, `${t.msg_out_of_range}: ${dist.toFixed(0)}m`);

    // ✅ Insert cierra cualquier sesión previa (active o travel)
    await insertWorkSession({
      start_time: Date.now(),
      status: 'active',
      address,
      latitude: userLoc.coords.latitude,
      longitude: userLoc.coords.longitude,
      location_confirmed: 1,
      is_manual_edit: 0,
      lunch_taken: 0,
      date_string: new Date().toISOString().split('T')[0]
    });

    await LocationService.startActiveTracking();
    setModalVisible(false);
    refreshData();
  };

  const handleStopWork = async () => {
    if (!session?.id) return;
    await updateSessionEndTime(session.id, Date.now());
    await LocationService.stopMonitoring();
    refreshData();
  };

  const isTravel = session?.status === 'travel';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}><Text style={styles.title}>{t.header_title}</Text></View>

        {/* ✅ Tarjeta dinámica */}
        <View style={[styles.card, session ? (isTravel ? styles.travelCard : styles.active) : styles.inactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.statusLabel}>
              {session ? (isTravel ? t.status_travel : t.status_active) : t.status_inactive}
            </Text>
            {session && !isTravel && (
              session.lunch_taken === 1 ? (
                <View style={styles.lunchBadge}><Text style={styles.lunchText}>{t.status_lunch_taken}</Text></View>
              ) : (
                <TouchableOpacity onPress={() => setLunchVisible(true)} style={styles.lunchBtn}><Text style={{fontSize:20}}>🍔</Text></TouchableOpacity>
              )
            )}
          </View>

          {session ? (
            <>
              <Text style={styles.address}>{session.address}</Text>
              <Text style={styles.time}>In: {new Date(session.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
              {isTravel ? (
                <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}>
                  <Text style={styles.btnText}>📍 LLEGUÉ AL SITIO</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.stopBtn} onPress={handleStopWork}>
                  <Text style={styles.btnText}>{t.btn_clock_out}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.placeholder}>{t.no_activity}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statLabel}>{t.stats_hours}</Text><Text style={styles.statValue}>{stats.hours}h</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>{t.stats_earnings}</Text><Text style={styles.statValue}>${stats.earnings}</Text></View>
        </View>

        {!session && (
          <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}><Text style={styles.btnText}>{t.btn_new_job}</Text></TouchableOpacity>
        )}
      </ScrollView>

      {/* Modales */}
      <DailySetupModal visible={modalVisible} onClose={() => setModalVisible(false)} onStart={handleStartWork} />
      <LunchModal visible={lunchVisible} onClose={() => setLunchVisible(false)} session={session} onUpdate={refreshData} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  card: { margin: 20, padding: 20, borderRadius: 15, borderWidth: 1 },
  active: { backgroundColor: '#1C2C1E', borderColor: '#4CAF50' },
  inactive: { backgroundColor: '#1E1E1E', borderColor: '#333' },
  travelCard: { backgroundColor: '#2C1E00', borderColor: '#FFD700' }, // ✅ Color especial para viaje
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusLabel: { color: '#AAA', fontWeight: 'bold' },
  lunchBtn: { backgroundColor: '#333', padding: 5, borderRadius: 20, borderWidth: 1, borderColor: '#555' },
  lunchBadge: { backgroundColor: '#1C2C1E', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth:1, borderColor:'#2e5c33' },
  lunchText: { color: '#4CAF50', fontWeight:'bold', fontSize: 12 },
  address: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  time: { color: '#888', marginBottom: 15 },
  placeholder: { color: '#666', fontStyle: 'italic' },
  stopBtn: { backgroundColor: '#B71C1C', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  startBtn: { backgroundColor: '#007AFF', margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20 },
  statBox: { backgroundColor: '#1E1E1E', width: '48%', padding: 15, borderRadius: 12, alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 12 },
  statValue: { color: '#FFF', fontSize: 22, fontWeight: 'bold' }
});
