import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ✅ CORRECTO: Exportación con nombre
export function LunchModal({ visible, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Ionicons name="fast-food-outline" size={50} color="#FFD700" style={{marginBottom:15}} />
          
          <Text style={styles.title}>{t.lunch_title || "Hora de Almuerzo"}</Text>
          <Text style={styles.msg}>{t.lunch_msg || "¿Vas a tomar tu descanso hoy?"}</Text>
          <Text style={styles.subMsg}>{t.lunch_sub || "(Se descontará 1 hora)"}</Text>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btnNo} onPress={onCancel}>
              <Text style={styles.btnTextNo}>{t.lunch_no || "NO"}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnYes} onPress={onConfirm}>
              <Text style={styles.btnTextYes}>{t.lunch_yes || "SÍ, DESCONTAR"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 25, alignItems:'center' },
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  msg: { color: '#DDD', fontSize: 16, textAlign:'center' },
  subMsg: { color: '#AAA', fontSize: 12, marginBottom: 25, fontStyle:'italic' },
  row: { flexDirection:'row', gap: 15, width:'100%' },
  btnNo: { flex:1, backgroundColor:'#333', padding: 15, borderRadius: 10, alignItems:'center' },
  btnYes: { flex:1, backgroundColor:'#2E7D32', padding: 15, borderRadius: 10, alignItems:'center' },
  btnTextNo: { color: '#FFF' },
  btnTextYes: { color: '#FFF', fontWeight:'bold' }
});
