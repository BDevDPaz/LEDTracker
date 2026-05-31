import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';

// --- TIPOS ---
type ToastType = 'success' | 'error' | 'info';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface LuxuryContextProps {
  showToast: (msg: string, type?: ToastType) => void;
  showDialog: (options: DialogOptions) => void;
  
  // Controles de Reporte
  isWeeklyReportVisible: boolean;
  openWeeklyReport: () => void;
  closeWeeklyReport: () => void;
}

const LuxuryUIContext = createContext<LuxuryContextProps | undefined>(undefined);

export const LuxuryUIProvider = ({ children }: { children: ReactNode }) => {
  // Estado Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  
  // Estado Dialog (Modal de confirmación)
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  // Estado Reporte
  const [isWeeklyReportVisible, setIsWeeklyReportVisible] = useState(false);

  // --- LÓGICA TOAST ---
  const showToast = useCallback((msg: string, type: ToastType = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // --- LÓGICA REPORTE ---
  const openWeeklyReport = useCallback(() => setIsWeeklyReportVisible(true), []);
  const closeWeeklyReport = useCallback(() => setIsWeeklyReportVisible(false), []);

  // --- LÓGICA DIALOG ---
  const showDialog = useCallback((options: DialogOptions) => {
    setDialog(options);
  }, []);

  const handleDialogConfirm = () => {
    if (dialog?.onConfirm) dialog.onConfirm();
    setDialog(null);
  };

  const handleDialogCancel = () => {
    if (dialog?.onCancel) dialog.onCancel();
    setDialog(null);
  };

  return (
    <LuxuryUIContext.Provider value={{ 
      showToast, 
      showDialog, 
      isWeeklyReportVisible, 
      openWeeklyReport, 
      closeWeeklyReport 
    }}>
      {children}

      {/* RENDER TOAST */}
      {toast && (
        <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.toastContainer}>
          <View style={[styles.toast, styles[`toast_${toast.type}` as keyof typeof styles] as any]}>
            <Ionicons 
              name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'information-circle'} 
              size={24} 
              color="#FFF" 
            />
            <Text style={styles.toastText}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}

      {/* RENDER DIALOG (Modal Personalizado) */}
      <Modal visible={!!dialog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>{dialog?.title}</Text>
            <Text style={styles.dialogMessage}>{dialog?.message}</Text>
            
            <View style={styles.dialogButtons}>
              <TouchableOpacity onPress={handleDialogCancel} style={[styles.btn, styles.btnCancel]}>
                <Text style={styles.btnTextCancel}>{dialog?.cancelText || 'Cancelar'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleDialogConfirm} style={[styles.btn, styles.btnConfirm, dialog?.isDestructive && styles.btnDestructive]}>
                <Text style={styles.btnTextConfirm}>{dialog?.confirmText || 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </LuxuryUIContext.Provider>
  );
};

export const useLuxuryUI = () => {
  const context = useContext(LuxuryUIContext);
  if (!context) throw new Error('useLuxuryUI must be used within a LuxuryUIProvider');
  return context;
};

// ESTILOS
const styles = StyleSheet.create({
  toastContainer: { position: 'absolute', top: 60, left: 20, right: 20, alignItems: 'center', zIndex: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 10, width: '100%', shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  toast_success: { backgroundColor: COLORS.success || '#4CAF50' },
  toast_error: { backgroundColor: COLORS.danger || '#F44336' },
  toast_info: { backgroundColor: '#333' },
  toastText: { color: '#FFF', fontFamily: 'Montserrat_600SemiBold', fontSize: 13, flex: 1 },
  
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  dialogBox: { width: '85%', backgroundColor: '#111', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#333' },
  dialogTitle: { color: COLORS.gold, fontFamily: 'Montserrat_700Bold', fontSize: 18, marginBottom: 8, textAlign: 'center' },
  dialogMessage: { color: '#CCC', fontFamily: 'Montserrat_400Regular', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  dialogButtons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#222' },
  btnConfirm: { backgroundColor: COLORS.gold },
  btnDestructive: { backgroundColor: '#EF4444' },
  btnTextCancel: { color: '#FFF', fontFamily: 'Montserrat_600SemiBold' },
  btnTextConfirm: { color: '#000', fontFamily: 'Montserrat_700Bold' }
});
