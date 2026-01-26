// src/components/LunchModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getDB } from '../database/db';
import { useLanguage } from '../context/LanguageContext';
import { WorkSession } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  session: WorkSession | null;
  onUpdate: () => void;
}

export default function LunchModal({ visible, onClose, session, onUpdate }: Props) {
  const { t } = useLanguage();

  if (!session) return null;

  const handleLunch = async (taken: boolean) => {
    try {
      const db = getDB();
      // 1. Actualizar la sesión (1 = Tomó lunch, 0 = No)
      await db.runAsync(
        "UPDATE work_sessions SET lunch_taken = ? WHERE id = ?",
        [taken ? 1 : 0, session.id]
      );

      // 2. Registrar en Auditoría (Solo si dice SÍ)
      if (taken) {
        await db.runAsync(
          "INSERT INTO audit_logs (session_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)",
          [session.id!, 'LUNCH', 'log_lunch_taken', Date.now()]
        );
        Alert.alert(t.header_title, t.lunch_sub);
      }

      onUpdate(); // Refrescar pantalla principal
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Database Error");
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.emoji}>🍔</Text>
          <Text style={styles.title}>{t.lunch_title}</Text>
          <Text style={styles.msg}>{t.lunch_msg}</Text>
          <Text style={styles.subMsg}>{t.lunch_sub}</Text>

          <View style={styles.btnRow}>
            {/* Botón NO */}
            <TouchableOpacity style={styles.noBtn} onPress={() => handleLunch(false)}>
              <Text style={styles.btnText}>{t.lunch_no}</Text>
            </TouchableOpacity>
            
            {/* Botón SÍ */}
            <TouchableOpacity style={styles.yesBtn} onPress={() => handleLunch(true)}>
              <Text style={styles.btnText}>{t.lunch_yes}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalView: { 
    margin: 20, 
    backgroundColor: '#1E1E1E', 
    borderRadius: 20, 
    padding: 25, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#333',
    elevation: 5 
  },
  emoji: { fontSize: 40, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  msg: { color: '#DDD', fontSize: 16, textAlign: 'center' },
  subMsg: { color: '#AAA', fontSize: 12, marginBottom: 20, fontStyle: 'italic' },
  
  btnRow: { flexDirection: 'row', gap: 15, width: '100%' },
  
  noBtn: { 
    flex: 1, 
    padding: 15, 
    backgroundColor: '#3A1515', // Rojo oscuro
    borderRadius: 10, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5c1e1e'
  },
  yesBtn: { 
    flex: 1, 
    padding: 15, 
    backgroundColor: '#1C2C1E', // Verde oscuro
    borderRadius: 10, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#2e5c33' 
  },
  
  btnText: { color: '#FFF', fontWeight: 'bold' }
});
