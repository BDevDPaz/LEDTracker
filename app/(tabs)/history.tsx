// app/(tabs)/history.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Modal, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '../../src/context/LanguageContext';
import { getDB, deleteWorkSession, updateWorkSessionManual } from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { generateWeeklyReport } from '../../src/services/ReportGenerator';

export default function HistoryScreen() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  
  // ✅ LO NUEVO: Estado para el Modal de Edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editNote, setEditNote] = useState('');
  
  // Usamos strings para editar horas (HH:MM)
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    const db = getDB();
    const res = await db.getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE status != 'deleted' ORDER BY start_time DESC LIMIT 50"
    );
    setSessions(res);
  };

  // --- ACCIONES ---

  const handleDelete = (id: number) => {
    Alert.alert(
      t.btn_delete || "Eliminar", 
      "¿Seguro que deseas eliminar este registro?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: 'destructive', 
          onPress: async () => {
            await deleteWorkSession(id);
            loadHistory();
          } 
        }
      ]
    );
  };

  const openEdit = (item: WorkSession) => {
    setSelectedSession(item);
    setEditNote(item.manual_note || '');
    
    // Convertimos Timestamp a "HH:mm" para editar fácil
    const dIn = new Date(item.start_time);
    setEditTimeIn(`${pad(dIn.getHours())}:${pad(dIn.getMinutes())}`);

    if (item.end_time) {
      const dOut = new Date(item.end_time);
      setEditTimeOut(`${pad(dOut.getHours())}:${pad(dOut.getMinutes())}`);
    } else {
      setEditTimeOut('');
    }

    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedSession || !selectedSession.id) return;

    // Convertir string HH:mm de vuelta a Timestamp
    const baseDate = new Date(selectedSession.start_time); 
    
    // Parsear Entrada
    const [hIn, mIn] = editTimeIn.split(':').map(Number);
    const newStart = new Date(baseDate);
    newStart.setHours(hIn || 0, mIn || 0);

    // Parsear Salida (si existe)
    let newEnd = null;
    if (editTimeOut) {
      const [hOut, mOut] = editTimeOut.split(':').map(Number);
      newEnd = new Date(baseDate);
      newEnd.setHours(hOut || 0, mOut || 0);
    }

    await updateWorkSessionManual(
      selectedSession.id, 
      newStart.getTime(), 
      newEnd ? newEnd.getTime() : null, 
      editNote
    );

    setEditModalVisible(false);
    loadHistory();
  };

  const pad = (n: number) => n < 10 ? '0'+n : n;

  // --- RENDER ---

  const renderItem = ({ item }: { item: WorkSession }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => openEdit(item)} // ✅ Tocar para editar
      onLongPress={() => handleDelete(item.id!)} // ✅ Mantener para borrar
    >
      <View style={styles.row}>
        <Text style={styles.date}>{new Date(item.start_time).toLocaleDateString()}</Text>
        <View style={{flexDirection:'row', gap:5}}>
          {item.is_manual_edit === 1 && <Text style={{color:'orange'}}>✎</Text>}
          <Text style={[styles.status, {color: item.status==='active'?'#4CAF50':'#AAA'}]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.address}>{item.address}</Text>
      <Text style={styles.time}>
        {new Date(item.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
        {' ➔ '}
        {item.end_time ? new Date(item.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
      </Text>
      <Text style={styles.hint}>Toca para editar • Mantén para borrar</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{t.history_title}</Text>
        <TouchableOpacity style={styles.pdfBtn} onPress={() => generateWeeklyReport(true)}>
          <Text style={styles.pdfText}>📄 PDF</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>{t.no_activity}</Text>}
      />

      {/* MODAL DE EDICIÓN SIMPLE */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Registro</Text>
            
            <Text style={styles.label}>Hora Entrada (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeIn} 
              onChangeText={setEditTimeIn} 
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Hora Salida (HH:MM)</Text>
            <TextInput 
              style={styles.input} 
              value={editTimeOut} 
              onChangeText={setEditTimeOut} 
              placeholder="En progreso..."
              placeholderTextColor="#666"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Nota de Auditoría (Obligatorio)</Text>
            <TextInput 
              style={styles.input} 
              value={editNote} 
              onChangeText={setEditNote} 
              placeholder="Razón del cambio..."
              placeholderTextColor="#666"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.btnCancel}>
                <Text style={{color:'white'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={styles.btnSave}>
                <Text style={{color:'white', fontWeight:'bold'}}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  pdfBtn: { backgroundColor: '#FFD700', padding: 8, borderRadius: 8 },
  pdfText: { fontWeight: 'bold', color: '#000' },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth:1, borderColor:'#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  date: { color: '#AAA', fontWeight:'bold' },
  status: { fontSize: 10, fontWeight:'bold' },
  address: { color: '#FFF', fontSize: 16, marginBottom: 5 },
  time: { color: '#888' },
  empty: { color: '#666', textAlign: 'center', marginTop: 50 },
  hint: { color: '#444', fontSize: 10, marginTop: 10, fontStyle:'italic', textAlign:'right' },
  
  // Modal Styles
  modalCenter: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalCard: { backgroundColor: '#222', padding: 20, borderRadius: 15 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign:'center' },
  label: { color: '#AAA', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#333', color: 'white', padding: 10, borderRadius: 8, fontSize: 16 },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 10 },
  btnCancel: { flex: 1, padding: 15, backgroundColor: '#444', borderRadius: 8, alignItems:'center' },
  btnSave: { flex: 1, padding: 15, backgroundColor: '#007AFF', borderRadius: 8, alignItems:'center' }
});
