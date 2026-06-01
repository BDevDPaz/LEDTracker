// --- app/(tabs)/history.tsx ---
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getDB,
  deleteWorkSession,
  updateWorkSessionManual,
  getSettings,
  checkSessionOverlap,
  getWeeklyStats,
} from '../../src/database/db';
import { WorkSession } from '../../src/types';
import { generateWeeklyReport } from '../../src/services/ReportGenerator';
import { COLORS } from '../../src/constants/theme';
import {
  GlassModalWrapper,
  LuxuryButton,
  LuxuryEmptyState,
} from '../../src/components/LuxuryUI';
import { useLuxuryUI } from '../../src/context/LuxuryUIContext';
import { formatTime, formatDate } from '../../src/utils/dateUtils';
import { log } from '../../src/utils/logger';
import dayjs from '../../src/utils/dayjsSetup';

export default function HistoryScreen() {
  const { showToast, showDialog } = useLuxuryUI();

  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [estEarnings, setEstEarnings] = useState(0);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const db = getDB();

      const [settings, res] = await Promise.all([
        getSettings(),
        db.getAllAsync<WorkSession>(
          "SELECT * FROM work_sessions WHERE status != 'deleted' ORDER BY start_time DESC LIMIT 50"
        ),
      ]);

      const hourlyRate = settings?.hourly_rate || 0;
      setSessions(res);

      // ✅ Cálculo determinista e inmutable usando dayjs (Lunes a las 00:00:00)
      const mondayTs = dayjs().startOf('isoWeek').valueOf();
      const tMs = await getWeeklyStats(mondayTs, dayjs().valueOf());
      const tHours = tMs / (1000 * 60 * 60);

      setTotalHours(tHours);
      setEstEarnings(tHours * hourlyRate);
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al cargar el historial', e);
    }
  };

  const formatTimeInput = (text: string, setter: (t: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 4) return;

    if (cleaned.length > 2) {
      setter(`${cleaned.slice(0, 2)}:${cleaned.slice(2)}`);
    } else {
      setter(cleaned);
    }
  };

  const handleDelete = (id: number) => {
    showDialog({
      title: 'ELIMINAR',
      message: '¿Eliminar registro permanentemente?',
      confirmText: 'ELIMINAR',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteWorkSession(id);
          log('ROJO', 'ACCION_DESTRUCTIVA', 'ERROR', `Registro eliminado manualmente ID: ${id}`);
          showToast('Registro eliminado', 'success');
          void loadHistory();
        } catch (e) {
          log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al borrar registro', e);
        }
      },
    });
  };

  const openEdit = (item: WorkSession) => {
    setSelectedSession(item);
    setEditNote(item.manual_note || '');

    // ✅ Formateo seguro de tiempos extraídos
    setEditTimeIn(dayjs(item.start_time).format('HH:mm'));
    setEditTimeOut(item.end_time ? dayjs(item.end_time).format('HH:mm') : '');

    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedSession || !selectedSession.id) return;

    if (editTimeIn.length < 5) {
      showToast('Formato HH:MM inválido', 'error');
      return;
    }

    // ✅ Inyección de horas de forma inmutable, preservando la fecha real de la sesión
    const hIn = Number(editTimeIn.substring(0, 2));
    const mIn = Number(editTimeIn.substring(3, 5));
    const newStart = dayjs(selectedSession.start_time)
      .hour(hIn)
      .minute(mIn)
      .second(0)
      .millisecond(0);

    let newEnd = null;
    if (editTimeOut && editTimeOut.length === 5) {
      const hOut = Number(editTimeOut.substring(0, 2));
      const mOut = Number(editTimeOut.substring(3, 5));
      newEnd = dayjs(selectedSession.start_time)
        .hour(hOut)
        .minute(mOut)
        .second(0)
        .millisecond(0);
    }

    const hasOverlap = await checkSessionOverlap(
      newStart.valueOf(),
      newEnd ? newEnd.valueOf() : 0,
      selectedSession.id
    );

    if (hasOverlap) {
      log(
        'AMARILLO',
        'ADVERTENCIA',
        'WARN',
        'Horario choca con otra sesión. Revisa la hora e inténtalo nuevamente.'
      );
      return;
    }

    try {
      await updateWorkSessionManual(
        selectedSession.id,
        newStart.valueOf(),
        newEnd ? newEnd.valueOf() : null,
        editNote
      );

      log(
        'AMARILLO',
        'CONFIG_MODIFICADA',
        'WARN',
        `Registro modificado manualmente ID: ${selectedSession.id}`
      );
      setEditModalVisible(false);
      showToast('Cambios guardados', 'success');
      void loadHistory();
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error editando registro', e);
    }
  };

  const renderItem = ({ item }: { item: WorkSession }) => (
    <TouchableOpacity
      testID={`history-record-${item.id}`}
      style={styles.card}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item.id!)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.date}>{formatDate(item.start_time)}</Text>
          <View style={styles.statusBadge}>
            {item.is_manual_edit === 1 && (
              <Ionicons name="pencil" size={12} color={COLORS.gold} style={{ marginRight: 6 }} />
            )}
            <View
              style={[
                styles.dot,
                { backgroundColor: item.status === 'active' ? COLORS.success : '#666' },
              ]}
            />
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
    <SafeAreaView testID="history-screen" style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>HISTORIAL</Text>
          <Text style={styles.subHeader}>
            ESTA SEMANA: <Text style={{ color: '#FFF' }}>{totalHours.toFixed(1)}h</Text> •{' '}
            <Text style={{ color: COLORS.gold }}>${estEarnings.toFixed(0)}</Text>
          </Text>
        </View>

        <TouchableOpacity
          testID="history-pdf-button"
          style={styles.pdfBtn}
          onPress={() => {
            log('VERDE', 'OPERACION_EXITOSA', 'INFO', 'Generando reporte en PDF manualmente');
            void generateWeeklyReport(true);
          }}
        >
          <Ionicons name="document-text" size={16} color="#000" />
          <Text style={styles.pdfText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        testID="history-list"
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        ListEmptyComponent={<LuxuryEmptyState text="No hay actividad reciente" icon="time-outline" />}
        showsVerticalScrollIndicator={false}
      />

      <GlassModalWrapper visible={editModalVisible}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>EDITAR REGISTRO</Text>
          <TouchableOpacity
            testID="history-edit-close"
            onPress={() => setEditModalVisible(false)}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>ENTRADA (HH:MM)</Text>
          <TextInput
            testID="history-edit-time-in"
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
            testID="history-edit-time-out"
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
          <TextInput
            testID="history-edit-note"
            style={styles.input}
            value={editNote}
            onChangeText={setEditNote}
            placeholder="Razón del cambio..."
            placeholderTextColor="#333"
          />
        </View>

        <View style={{ gap: 4, marginTop: 10 }}>
          <View testID="history-save-wrapper">
            <LuxuryButton text="GUARDAR CAMBIOS" onPress={saveEdit} />
          </View>
          <View testID="history-cancel-wrapper">
            <LuxuryButton
              text="CANCELAR"
              onPress={() => setEditModalVisible(false)}
              variant="outline"
            />
          </View>
        </View>
      </GlassModalWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 24,
    paddingBottom: 10,
  },
  header: { fontFamily: 'Montserrat_300Light', fontSize: 32, color: '#FFF' },
  subHeader: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: 6,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
  },
  pdfText: { fontFamily: 'Montserrat_700Bold', color: '#000', fontSize: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardContent: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  date: { fontFamily: 'Montserrat_400Regular', color: COLORS.textSecondary, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  address: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFF',
    fontSize: 16,
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceHighlight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  time: { fontFamily: 'Montserrat_400Regular', color: '#DDD', fontSize: 13 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: '#FFF',
    fontSize: 18,
    letterSpacing: 1,
  },
  closeBtn: { padding: 5 },
  inputGroup: { marginBottom: 16 },
  label: {
    fontFamily: 'Montserrat_700Bold',
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    fontFamily: 'Montserrat_400Regular',
    backgroundColor: '#000',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

