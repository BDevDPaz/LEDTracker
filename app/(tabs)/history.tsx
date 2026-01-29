import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
// ✅ FIX 4: Import correcto de SafeAreaView
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../src/context/LanguageContext';
import { getDB, deleteWorkSession, updateWorkSessionManual, getSettings, checkSessionOverlap } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { generateWeeklyReport } from '../../src/services/ReportGenerator';
import { COLORS } from '../../src/constants/theme';
import { GlassModalWrapper, LuxuryButton, LuxuryEmptyState } from '../../src/components/LuxuryUI';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { formatTime, formatDate } from '../../src/utils/dateUtils';

export default function HistoryScreen() {
  const { t } = useLanguage();
  // ✅ Ahora 'showDialog' funcionará perfectamente gracias al fix en Context
  const { showToast, showDialog } = useLuxuryUI();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [estEarnings, setEstEarnings] = useState(0);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const loadHistory = async () => {
    const db = getDB();
    const settings = await getSettings();
    const rate = settings?.hourly_rate || 0;

    const res = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status != 'deleted' ORDER BY start_time DESC LIMIT 50"
    );
    setSessions(res);
    calculateWeeklyTotals(res, rate);
  };

  const calculateWeeklyTotals = (allSessions: WorkSession[], rate: number) => {
    const now = new Date();
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0,0,0,0);

    let tMs = 0;
    allSessions.forEach(s => {
      if (s.start_time >= monday.getTime()) {
        const end = s.end_time || Date.now();
        let dur = end - s.start_time;
        if (s.lunch_taken) dur -= 3600000;
        tMs += Math.max(0, dur);
      }
    });

    const tHours = tMs / (1000 * 60 * 60);
    setTotalHours(tHours);
    setEstEarnings(tHours * rate);
  }

  const formatTimeInput = (text: string, setter: (t: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 4) return;
    if (cleaned.length > 2) {
      setter(`${cleaned.slice(0,2)}:${cleaned.slice(2)}`);
    } else {
      setter(cleaned);
    }
  };

  const handleDelete = (id: number) => {
    showDialog({
      title: t.btn_delete || "ELIMINAR",
      message: "¿Eliminar registro permanentemente?",
      confirmText: "ELIMINAR",
      isDestructive: true,
      onConfirm: async () => {
        await deleteWorkSession(id);
        showToast("Registro eliminado", "success");
        loadHistory();
      }
    });
  };

  const openEdit = (item: WorkSession) => {
    setSelectedSession(item);
    setEditNote(item.manual_note || '');
    const dIn = new Date(item.start_time);
    setEditTimeIn(`${pad(dIn.getHours())}:${pad(dIn.getMinutes())}`);
    if (item.end_time) {
      const dOut = new Date(item.end_time);
      setEditTimeOut(`${pad(dOut.getHours())}:${pad(dOut.getMinutes())}`);
    } else { setEditTimeOut(''); }
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedSession || !selectedSession.id) return;
    if (editTimeIn.length < 5) { showToast("Formato HH:MM inválido", "error"); return; }

    const baseDate = new Date(selectedSession.start_time); 
    const [hIn, mIn] = editTimeIn.split(':').map(Number);
    const newStart = new Date(baseDate);
    newStart.setHours(hIn || 0, mIn || 0);
    
    let newEnd = null;
    if (editTimeOut && editTimeOut.length === 5) {
      const [hOut, mOut] = editTimeOut.split(':').map(Number);
      newEnd = new Date(baseDate);
      newEnd.setHours(hOut || 0, mOut || 0);
    }

    const hasOverlap = await checkSessionOverlap(
        newStart.getTime(), 
        newEnd ? newEnd.getTime() : 0, 
        selectedSession.id
    );

    if (hasOverlap) {
        showToast("Error: Horario choca con otra sesión", "error");
        return;
    }
    
    await updateWorkSessionManual(selectedSession.id, newStart.getTime(), newEnd ? newEnd.getTime() : null, editNote);
    setEditModalVisible(false);
    showToast("Cambios guardados", "success");
    loadHistory();
  };

  const pad = (n: number) => n < 10 ? '0'+n : n;

  const renderItem = ({ item }: { item: WorkSession }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item.id!)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.date}>{formatDate(item.start_time)}</Text>
          <View style={styles.statusBadge}>
            {item.is_manual_edit === 1 && <Ionicons name="pencil" size={12} color={COLORS.gold} style={{marginRight: 6}} />}
            <View style={[styles.dot, { backgroundColor: item.status==='active' ? COLORS.success : '#666' }]} />
          </View>
        </View>
        <Text style={styles.address}>{item.address}</Text>
        <View style={styles.timeContainer}>
           <Text style={styles.time}>{formatTime(item.start_time)}</Text>
           <Ionicons name="arrow-forward" size={12} color={COLORS.gold} />
           <Text style={styles.time}>{item.end_time ? formatTime(item.end_time) : '...'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>{t.history_title}</Text>
          <Text style={styles.subHeader}>
            ESTA SEMANA: <Text style={{color: '#FFF'}}>{totalHours.toFixed(1)}h</Text> • <Text style={{color: COLORS.gold}}>${estEarnings.toFixed(0)}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.pdfBtn} onPress={() => generateWeeklyReport(true)}>
          <Ionicons name="document-text" size={16} color="#000" />
          <Text style={styles.pdfText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        ListEmptyComponent={<LuxuryEmptyState text={t.no_activity || "No hay actividad reciente"} icon="time-outline" />}
        showsVerticalScrollIndicator={false}
      />

      <GlassModalWrapper visible={editModalVisible}>
         <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>EDITAR REGISTRO</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
         </View>
         
         <View style={styles.inputGroup}>
            <Text style={styles.label}>ENTRADA (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeIn} 
              onChangeText={(t) => formatTimeInput(t, setEditTimeIn)} 
              keyboardType="number-pad"
              maxLength={5}
              placeholder="00:00"
              placeholderTextColor="#333"
            />
         </View>
         <View style={styles.inputGroup}>
            <Text style={styles.label}>SALIDA (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeOut} 
              onChangeText={(t) => formatTimeInput(t, setEditTimeOut)} 
              placeholder="En progreso..." 
              placeholderTextColor="#333" 
              keyboardType="number-pad"
              maxLength={5}
            />
         </View>
         <View style={styles.inputGroup}>
            <Text style={styles.label}>NOTA AUDITORÍA</Text>
            <TextInput style={styles.input} value={editNote} onChangeText={setEditNote} placeholder="Razón del cambio..." placeholderTextColor="#333"/>
         </View>
         
         <View style={{ gap: 4, marginTop: 10 }}>
            <LuxuryButton text="GUARDAR CAMBIOS" onPress={saveEdit} />
            <LuxuryButton text="CANCELAR" onPress={() => setEditModalVisible(false)} variant="outline" />
         </View>
      </GlassModalWrapper>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', padding: 24, paddingBottom: 10 },
  header: { fontFamily: 'Montserrat_300Light', fontSize: 32, color: '#FFF' },
  subHeader: { fontFamily: 'Montserrat_700Bold', fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1, marginTop: 6 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, shadowColor: COLORS.gold, shadowOpacity: 0.4, shadowRadius: 8 },
  pdfText: { fontFamily: 'Montserrat_700Bold', color: '#000', fontSize: 10 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardContent: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  date: { fontFamily: 'Montserrat_400Regular', color: COLORS.textSecondary, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  address: { fontFamily: 'Montserrat_600SemiBold', color: '#FFF', fontSize: 16, marginBottom: 12 },
  timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surfaceHighlight, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  time: { fontFamily: 'Montserrat_400Regular', color: '#DDD', fontSize: 13 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Montserrat_700Bold', color: '#FFF', fontSize: 18, letterSpacing: 1 },
  closeBtn: { padding: 5 },
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: 'Montserrat_700Bold', color: COLORS.textSecondary, fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  input: { fontFamily: 'Montserrat_400Regular', backgroundColor: '#000', color: 'white', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
});
