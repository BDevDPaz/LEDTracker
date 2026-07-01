import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';
import { ToastType, ToastPriority, ToastItem } from '../types';

export interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isDestructive?: boolean;
}

interface LuxuryUIContextType {
  showToast: (msg: string, type?: ToastType, priority?: ToastPriority) => void;
  showDialog: (options: DialogOptions) => void;
  isWeeklyReportVisible: boolean;
  openWeeklyReport: () => void;
  closeWeeklyReport: () => void;
}

const DEFAULT_TOAST_DURATION_MS = 3000;
const MAX_TOAST_QUEUE_SIZE = 3;
const TOAST_DUPLICATE_WINDOW_MS = 2000;
const DIALOG_DUPLICATE_WINDOW_MS = 1000;

const LuxuryUIContext = createContext<LuxuryUIContextType | undefined>(undefined);

function createToastKey(msg: string, type: string) {
  return `${type}::${msg.trim().toLowerCase()}`;
}

function createDialogKey(options: DialogOptions) {
  return `${options.title.trim()}::${options.message.trim()}`;
}

export const LuxuryUIProvider = memo(({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [isWeeklyReportVisible, setIsWeeklyReportVisible] = useState(false);
  const toastQueueRef = useRef<ToastItem[]>([]);
  const dialogQueueRef = useRef<DialogOptions[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastRef = useRef<{ key: string; timestamp: number } | null>(null);
  const lastDialogRef = useRef<{ key: string; timestamp: number } | null>(null);

  const flushNextToast = useCallback(() => {
    if (toastQueueRef.current.length === 0) {
      setToast(null);
      return;
    }
    const next = toastQueueRef.current.shift() || null;
    setToast(next);
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'info', priority: ToastPriority = 'normal') => {
    const normalizedMsg = msg.trim();
    if (!normalizedMsg) return;
    const key = createToastKey(normalizedMsg, type);
    const now = dayjs().valueOf();
    if (lastToastRef.current && lastToastRef.current.key === key && now - lastToastRef.current.timestamp < TOAST_DUPLICATE_WINDOW_MS) return;
    if (toast && createToastKey(toast.msg, toast.type) === key) return;
    if (toastQueueRef.current.some((item) => createToastKey(item.msg, item.type) === key)) return;

    const item: ToastItem = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, msg: normalizedMsg, type, durationMs: DEFAULT_TOAST_DURATION_MS, priority };
    lastToastRef.current = { key, timestamp: now };

    if (!toast) {
      setToast(item);
      return;
    }

    const queue = toastQueueRef.current;
    if (priority === 'high') {
      queue.unshift(item);
    } else if (priority === 'low' && queue.length >= MAX_TOAST_QUEUE_SIZE) {
      return;
    } else {
      if (queue.length >= MAX_TOAST_QUEUE_SIZE) queue.shift();
      queue.push(item);
    }
  }, [toast]);

  useEffect(() => {
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
    if (!toast) return;
    toastTimerRef.current = setTimeout(() => { setToast(null); }, toast.durationMs);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toast]);

  useEffect(() => { if (!toast) flushNextToast(); }, [toast, flushNextToast]);

  const flushNextDialog = useCallback(() => {
    if (dialogQueueRef.current.length === 0) { setDialog(null); return; }
    const next = dialogQueueRef.current.shift() || null;
    setDialog(next);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    const key = createDialogKey(options);
    const now = dayjs().valueOf();
    if (lastDialogRef.current && lastDialogRef.current.key === key && now - lastDialogRef.current.timestamp < DIALOG_DUPLICATE_WINDOW_MS) return;
    if (dialog && createDialogKey(dialog) === key) return;
    if (dialogQueueRef.current.some((item) => createDialogKey(item) === key)) return;
    lastDialogRef.current = { key, timestamp: now };
    if (!dialog) { setDialog(options); return; }
    dialogQueueRef.current.push(options);
  }, [dialog]);

  const handleDialogConfirm = () => {
    const current = dialog;
    setDialog(null);
    try { current?.onConfirm?.(); } finally { flushNextDialog(); }
  };

  const handleDialogCancel = () => {
    const current = dialog;
    setDialog(null);
    try { current?.onCancel?.(); } finally { flushNextDialog(); }
  };

  const openWeeklyReport = useCallback(() => setIsWeeklyReportVisible(true), []);
  const closeWeeklyReport = useCallback(() => setIsWeeklyReportVisible(false), []);

  return (
    <LuxuryUIContext.Provider value={{ showToast, showDialog, isWeeklyReportVisible, openWeeklyReport, closeWeeklyReport }}>
      {children}
      {toast && (
        <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.toastContainer} pointerEvents="none">
          <View style={[styles.toast, toast.type === 'success' ? styles.toast_success : toast.type === 'error' ? styles.toast_error : styles.toast_info]}>
            <Ionicons name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'information-circle'} size={24} color="#FFF" />
            <Text style={styles.toastText}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
      <Modal visible={!!dialog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>{dialog?.title}</Text>
            <Text style={styles.dialogMessage}>{dialog?.message}</Text>
            <div style={styles.dialogButtons}>
              <TouchableOpacity onPress={handleDialogCancel} style={[styles.btn, styles.btnCancel]}>
                <Text style={styles.btnTextCancel}>{dialog?.cancelText || 'Cancelar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDialogConfirm} style={[styles.btn, styles.btnConfirm, dialog?.isDestructive && styles.btnDestructive]}>
                <Text style={styles.btnTextConfirm}>{dialog?.confirmText || 'Confirmar'}</Text>
              </TouchableOpacity>
            </div>
          </View>
        </View>
      </Modal>
    </LuxuryUIContext.Provider>
  );
});

LuxuryUIProvider.displayName = 'LuxuryUIProvider';
export const useLuxuryUI = () => {
  const context = useContext(LuxuryUIContext);
  if (!context) throw new Error('useLuxuryUI must be used within a LuxuryUIProvider');
  return context;
};

const styles = StyleSheet.create({
  toastContainer: { position: 'absolute', top: 60, left: 20, right: 20, alignItems: 'center', zIndex: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 10, width: '100%', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
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
  btnTextConfirm: { color: '#000', fontFamily: 'Montserrat_700Bold' },
});
