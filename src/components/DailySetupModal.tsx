import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStart: (address: string) => void;
}

// ✅ CORRECTO: Exportación con nombre
export function DailySetupModal({ visible, onClose, onStart }: Props) {
  const { t } = useLanguage();
  const [address, setAddress] = useState('');

  const handleStart = () => {
    if (address.trim().length > 0) {
      onStart(address);
      setAddress(''); 
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color="#AAA" />
          </TouchableOpacity>

          <Text style={styles.title}>{t.daily_title || "Configuración Diaria"}</Text>
          <Text style={styles.label}>{t.daily_label || "¿Dónde trabajarás hoy?"}</Text>
          
          <TextInput
            style={styles.input}
            placeholder={t.daily_placeholder || "Ej: 5601 Balboa Blvd..."}
            placeholderTextColor="#666"
            value={address}
            onChangeText={setAddress}
            autoFocus
          />

          <TouchableOpacity style={styles.btnStart} onPress={handleStart}>
            <Text style={styles.btnText}>{t.daily_btn_start || "Iniciar Jornada"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 25 },
  closeIcon: { alignSelf: 'flex-end', padding: 5 },
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#AAA', marginBottom: 10 },
  input: { backgroundColor: '#333', color: '#FFF', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 20 },
  btnStart: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});
