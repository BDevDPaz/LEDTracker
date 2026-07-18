import {
  getActiveSession,
  getSettings,
  saveSession,
  updateSessionStatus,
  getHistory,
  saveSettings,
  deleteSession,
  insertAuditLog
} from '../database/db';
import { WorkSession, AppSettings, SessionStatus } from '../types';
import type { CheckoutAuditAction } from '../utils/logger';

export const sessionStoreAdapter = {
  getActiveSession: async (): Promise<WorkSession | null> => {
    return await getActiveSession();
  },

  getSettings: async (): Promise<AppSettings | null> => {
    return await getSettings();
  },

  saveSession: async (session: WorkSession) => {
    return await saveSession(session);
  },

  updateSessionStatus: async (
    id: number,
    status: SessionStatus,
    lunchMinutes: number = 0,
    checkoutAction?: CheckoutAuditAction
  ) => {
    return await updateSessionStatus(id, status, lunchMinutes, checkoutAction);
  },

  getHistory: async (): Promise<WorkSession[]> => {
    return await getHistory();
  },

  saveSettings: async (settings: AppSettings) => {
    return await saveSettings(settings);
  },

  deleteSession: async (id: number) => {
    return await deleteSession(id);
  },

  logAudit: async (sessionId: number, action: string, details: string) => {
    return await insertAuditLog(sessionId, action, details);
  }
};

