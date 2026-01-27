import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';

// Tipos
type ToastType = 'success' | 'error' | 'info';
interface DialogOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface UIContextType {
  showToast: (msg: string, type?: ToastType) => void;
  showDialog: (opts: DialogOptions) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const LuxuryUIProvider = ({ children }: { children: ReactNode }) => {
  // Estado Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({ msg: '', type: 'info', visible: false });
  
  // Estado Dialog
  const [dialog, setDialog] = useState<DialogOptions & { visible: boolean }>({ 
    visible: false, title: '', message: '', onConfirm: () => {} 
  });

  const showToast = (msg: string, type: ToastType = 'info') => {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const showDialog = (opts: DialogOptions) => {
    setDialog({ ...opts, visible: true });
  };

  const handleConfirm = () => {
    dialog.onConfirm();
    setDialog(prev => ({ ...prev, visible: false }));
  };

  return (
    <UIContext.Provider value={{ showToast, showDialog }}>
      {children}
      
      {/* RENDER TOAST */}
      {toast.visible && (
        <View style={styles.toastContainer}>
          <BlurView intensity={20} tint="dark" style={[styles.toast, toast.type === 'error' ? styles.borderError : styles.borderGold]}>
            <Ionicons 
              name={toast.type === 'success' ? "checkmark-circle" : toast.type === 'error' ? "alert-circle" : "information-circle"} 
              size={24} 
              color={toast.type === 'error' ? COLORS.danger : COLORS.gold} 
            />
            <Text style={styles.toastText}>{toast.msg}</Text>
          </BlurView>
        </View>
      )}

      {/* RENDER DIALOG (CONFIRMATION) */}
      <Modal visible={dialog.visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMsg}>{dialog.message}</Text>
            
            <View style={styles.dialogButtons}>
              <TouchableOpacity 
                style={styles.btnCancel} 
                onPress={() => {
                  if(dialog.onCancel) dialog.onCancel();
                  setDialog(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.btnTextCancel}>{dialog.cancelText || "CANCELAR"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btnConfirm, dialog.isDestructive && { backgroundColor: COLORS.danger }]} 
                onPress={handleConfirm}
              >
                <Text style={styles.btnTextConfirm}>{dialog.confirmText || "CONFIRMAR"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </UIContext.Provider>
  );
};

export const useLuxuryUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useLuxuryUI must be used within LuxuryUIProvider");
  return context;
};

const styles = StyleSheet.create({
  // Toast Styles
  toastContainer: { position: 'absolute', top: 60, left: 20, right: 20, alignItems: 'center', zIndex: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.9)', borderWidth: 1, width: '100%', maxWidth: 400, overflow: 'hidden' },
  borderGold: { borderColor: COLORS.gold },
  borderError: { borderColor: COLORS.danger },
  toastText: { color: '#FFF', fontFamily: 'Montserrat_600SemiBold', fontSize: 13, flex: 1 },

  // Dialog Styles
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: 'rgba(0,0,0,0.6)' },
  dialogCard: { width: '100%', backgroundColor: '#111', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  dialogTitle: { color: '#FFF', fontFamily: 'Montserrat_700Bold', fontSize: 18, marginBottom: 10, textAlign: 'center', letterSpacing: 1 },
  dialogMsg: { color: '#AAA', fontFamily: 'Montserrat_400Regular', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  dialogButtons: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  btnConfirm: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.gold, alignItems: 'center' },
  btnTextCancel: { color: '#888', fontFamily: 'Montserrat_700Bold', fontSize: 11 },
  btnTextConfirm: { color: '#000', fontFamily: 'Montserrat_700Bold', fontSize: 11 },
});
