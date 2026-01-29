import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { LuxuryButton } from './LuxuryUI';

interface DailySetupModalProps {
  visible: boolean;
  onClose: () => void;
  // ✅ Actualizamos la firma de la función para recibir 3 datos
  onStart: (address: string, client: string, notes: string) => void;
  mode?: 'start' | 'transit';
}

export const DailySetupModal = ({ visible, onClose, onStart, mode = 'start' }: DailySetupModalProps) => {
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [notes, setNotes] = useState('');
  
  const handleStart = () => {
    if (address.trim()) {
      onStart(address, client, notes);
      // Limpieza
      setAddress('');
      setClient('');
      setNotes('');
    }
  };

  const title = mode === 'start' ? "INICIAR JORNADA" : "NUEVO DESTINO";
  const subtitle = mode === 'start' ? "Configura tu primer ubicación" : "Rumbo al siguiente trabajo";
  const btnText = mode === 'start' ? "ACTIVAR GEOCERCA" : "INICIAR TRAYECTO";
  const icon = mode === 'start' ? "navigate-circle" : "car-sport";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <BlurView intensity={40} tint="dark" style={styles.container}>
          <View style={styles.content}>
            
            <View style={styles.iconHeader}>
               <Ionicons name={icon} size={40} color={COLORS.gold} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {/* INPUT DIRECCIÓN */}
            <View style={styles.inputContainer}>
              <Ionicons name="location-sharp" size={20} color={COLORS.textSecondary} style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                placeholder="Dirección del trabajo"
                placeholderTextColor="#666"
                value={address}
                onChangeText={setAddress}
                autoFocus={true}
              />
            </View>

            {/* INPUT CLIENTE (Opcional) */}
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color={COLORS.textSecondary} style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                placeholder="Cliente (Opcional)"
                placeholderTextColor="#666"
                value={client}
                onChangeText={setClient}
              />
            </View>

            {/* INPUT NOTAS (Opcional) */}
            <View style={styles.inputContainer}>
              <Ionicons name="document-text" size={20} color={COLORS.textSecondary} style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                placeholder="Notas (Opcional)"
                placeholderTextColor="#666"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={styles.buttonRow}>
               <LuxuryButton 
                  text="CANCELAR" 
                  variant="secondary" 
                  onPress={onClose} 
                  style={{flex: 1, marginRight: 10}} 
               />
               <LuxuryButton 
                  text={btnText} 
                  variant="primary" 
                  onPress={handleStart} 
                  disabled={!address.trim()}
                  style={{flex: 1}} 
               />
            </View>

          </View>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  content: { width: '85%', backgroundColor: '#1A1A1A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  iconHeader: { marginBottom: 16, padding: 10, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 50 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 20, color: '#FFF', letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontFamily: 'Montserrat_400Regular', fontSize: 12, color: '#AAA', marginBottom: 24 },
  
  // inputContainer genérico para todos
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 12, borderWidth: 1, borderColor: '#333', width: '100%' },
  input: { flex: 1, color: '#FFF', fontFamily: 'Montserrat_400Regular' },
  buttonRow: { flexDirection: 'row', width: '100%', marginTop: 10 }
});
