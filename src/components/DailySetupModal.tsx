// src/components/DailySetupModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStart: (address: string) => void;
}

export default function DailySetupModal({ visible, onClose, onStart }: Props) {
  const { t } = useLanguage();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    if (!address) return;
    setLoading(true);
    // Pequeño delay para UX
    setTimeout(() => {
      onStart(address);
      setLoading(false);
      setAddress('');
    }, 500);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.title}>{t.daily_title}</Text>
          <TextInput 
            style={styles.input} 
            placeholder={t.daily_placeholder} 
            placeholderTextColor="#666"
            value={address}
            onChangeText={setAddress}
          />
          <View style={styles.row}>
            <TouchableOpacity onPress={onClose} style={styles.btnCancel}>
              <Text style={styles.txt}>{t.btn_cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleStart} style={styles.btnStart} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.txt}>{t.daily_btn_start}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  card: { margin: 20, backgroundColor: '#1E1E1E', padding: 25, borderRadius: 15 },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#333', color: '#FFF', padding: 15, borderRadius: 8, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 15, backgroundColor: '#333', borderRadius: 8, alignItems: 'center' },
  btnStart: { flex: 1, padding: 15, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center' },
  txt: { color: '#FFF', fontWeight: 'bold' }
});
