// --- src/feedback/useLogFeedback.ts ---
import { useEffect } from 'react';
import { useLuxuryUI } from '../context/LuxuryUIContext';
import { setFeedbackEmitter, type FeedbackPayload } from './logBridge';

export const useLogFeedback = () => {
  const { showToast, showDialog } = useLuxuryUI();

  useEffect(() => {
    const emitter = (payload: FeedbackPayload) => {
      if (payload.kind === 'toast') {
        showToast(payload.message, payload.tone);
        return;
      }

      if (payload.kind === 'dialog') {
        showDialog({
          title: payload.title || 'Atención',
          message: payload.message,
          confirmText: 'OK',
          isDestructive: payload.destructive,
          onConfirm: () => {},
        });
      }
    };

    setFeedbackEmitter(emitter);

    return () => {
      setFeedbackEmitter(null);
    };
  }, [showToast, showDialog]);
};

