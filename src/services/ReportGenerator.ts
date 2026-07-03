import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSettings, getAllAsync, ensureDbReady } from '../database/db';
import escapeHtml from 'escape-html';
import { WorkSession, AppSettings, AuditLog } from '../types';
import { log } from '../utils/logger';
import dayjs from '../utils/dayjsSetup';
import { formatDate, formatTime } from '../utils/dateUtils';
import { calculatePay } from '../utils/payrollUtils';
import { getReportHtml } from './templates/ReportTemplate';
import { NotificationDispatcher } from './NotificationDispatcher';

const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

// ======================================================
// OPTIMIZATION CONSTANTS (Proposal 2)
// ======================================================

interface ReportGenerationOptions {
  shouldShare: boolean;
  customRange?: { start: number; end: number };
  paginate?: boolean;
}

// ======================================================
// DELIVERY GUARANTEE TYPES (Proposal 5)
// ======================================================

export interface PendingReportRecord {
  weekId: string;
  pdfUri: string;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
}

// ======================================================
// CORE GENERATION (Proposal 2)
// ======================================================

export const generateWeeklyReport = async (
  shouldShare: boolean = true,
  customRange?: { start: number; end: number }
): Promise<string | null> => {
  return generateWeeklyReportOptimized({ shouldShare, customRange });
};

export const generateWeeklyReportOptimized = async (
  options: ReportGenerationOptions
): Promise<string | null> => {
  try {
    const settings = await getSettings();
    if (!settings) throw new Error('No settings found');

    const now = dayjs();
    const startRange = options.customRange?.start ?? now.startOf('isoWeek').valueOf();
    const endRange = options.customRange?.end ?? now.endOf('isoWeek').valueOf();
    const rangeTitle = `${formatDate(startRange)} - ${formatDate(endRange)}`;

    const sessions = await getAllAsync<WorkSession>(
      "SELECT * FROM work_sessions WHERE start_time >= ? AND start_time <= ? AND status != 'deleted' ORDER BY start_time ASC",
      [startRange, endRange]
    );

    if (sessions.length === 0) {
      log('AMARILLO', 'ADVERTENCIA', 'WARN', 'No hay sesiones para el reporte semanal.');
      return null;
    }

    const sessionIds = sessions.map(s => s.id!);
    const logs = await getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs WHERE session_id IN (${sessionIds.join(',')}) OR (session_id IS NULL AND timestamp >= ? AND timestamp <= ?) ORDER BY timestamp ASC`,
      [startRange, endRange]
    );

    const autoCheckoutLogs = await getAllAsync<any>(
      `SELECT session_id FROM audit_logs WHERE action_type = 'AUTO_CHECKOUT_GPS' AND session_id IN (${sessionIds.join(',')})`
    );
    const autoCheckoutSessionIds = new Set(autoCheckoutLogs.map(l => l.session_id));

    let totalHours = 0;
    let totalOvertime = 0;
    let totalEarnings = 0;

    const rows = sessions.map(session => {
      const startTime = session.actual_start_time || session.start_time;
      const durationMs = (session.end_time || now.valueOf()) - startTime;
      const hours = durationMs / (1000 * 60 * 60);
      const { totalPay, overtimeHours } = calculatePay(
        hours,
        settings.hourly_rate,
        settings.overtime_multiplier
      );

      totalHours += hours;
      totalOvertime += overtimeHours;
      totalEarnings += totalPay;

      const fueAutoCheckout = autoCheckoutSessionIds.has(session.id!);

      return {
        date: formatDate(startTime),
        client: escapeHtml(session.client_name || 'General'),
        address: escapeHtml(session.address || ''),
        notes: escapeHtml(session.manual_note || ''),
        start: formatTime(startTime),
        end: session.end_time ? formatTime(session.end_time) : 'En curso',
        lunch: session.lunch_taken ? 'Sí' : 'No',
        total: hours.toFixed(2),
        pay: formatCurrency(totalPay),
        status: session.status,
        isGeofenceIn: Boolean(session.actual_start_time),
        isGeofenceOut: fueAutoCheckout,
        isManual: Boolean(session.is_manual_edit)
      };
    });

    const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const integrityHash = dayjs().valueOf().toString(16) + reportId.toLowerCase();

    const html = getReportHtml(
      settings,
      rows,
      logs,
      rangeTitle,
      totalHours,
      totalOvertime,
      totalEarnings,
      formatCurrency,
      formatTime,
      reportId,
      integrityHash
    );

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (options.shouldShare) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }

    return uri;
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error generando reporte optimizado', error);
    return null;
  }
};

// ======================================================
// DELIVERY GUARANTEE (Proposal 5)
// ======================================================

export const sendReportByEmail = async (pdfUri: string, settings: AppSettings, weekId?: string) => {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();

    if (isAvailable) {
      const result = await MailComposer.composeAsync({
        recipients: [settings.company_email],
        subject: `Nómina Semanal - ${settings.employee_name}`,
        body: `Hola,\n\nAdjunto encontrarás mi reporte de horas y actividades detallado.\n\nPeriodo finalizado.\n\nAtentamente,\n${settings.employee_name}`,
        attachments: [pdfUri]
      });

      if (result.status === MailComposer.MailComposerStatus.SENT && weekId) {
        await removePendingReport(weekId);
      }
    } else {
      await Sharing.shareAsync(pdfUri);
      if (weekId) await removePendingReport(weekId);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error al enviar reporte por email', error);
  }
};

export const checkAndDeliverPendingReports = async () => {
  try {
    const db = await ensureDbReady();
    const reports: PendingReportRecord[] = await db.getAllAsync<any>(
      "SELECT week_id as weekId, pdf_uri as pdfUri, created_at as createdAt, attempt_count as attemptCount, last_attempt_at as lastAttemptAt FROM report_queue WHERE status = 'pending'"
    );
    if (reports.length === 0) return;

    const now = dayjs().valueOf();

    for (const report of reports) {
      const age = now - report.createdAt;
      const hoursOld = age / (1000 * 60 * 60);

      if (hoursOld < 7 * 24) {
        const shouldRetry = !report.lastAttemptAt ||
                           (now - report.lastAttemptAt) > 6 * 60 * 60 * 1000;

        if (shouldRetry && report.attemptCount < 5) {
          const settings = await getSettings();
          if (settings) {
            log('AZUL', 'BACKGROUND_TASK', 'INFO', `Reintentando envío de reporte pendiente para ${report.weekId}...`);
            await sendReportByEmail(report.pdfUri, settings, report.weekId);

            await db.runAsync(
              "UPDATE report_queue SET attempt_count = attempt_count + 1, last_attempt_at = ? WHERE week_id = ?",
              [now, report.weekId]
            );
          }
        }
      } else {
        await db.runAsync("UPDATE report_queue SET status = 'failed' WHERE week_id = ?", [report.weekId]);
      }
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Pending reports check failed', error);
  }
};

export const trackPendingReport = async (weekId: string, pdfUri: string) => {
  try {
    const db = await ensureDbReady();
    await db.runAsync(
      "INSERT OR IGNORE INTO report_queue (week_id, pdf_uri, created_at) VALUES (?, ?, ?)",
      [weekId, pdfUri, dayjs().valueOf()]
    );
    log('AZUL', 'ESTADO_SISTEMA', 'DEBUG', `Reporte trackeado como pendiente en SQLite: ${weekId}`);
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failed to track pending report', error);
  }
};

const removePendingReport = async (weekId: string) => {
  try {
    const db = await ensureDbReady();
    await db.runAsync("UPDATE report_queue SET status = 'sent' WHERE week_id = ?", [weekId]);
    log('VERDE', 'OPERACION_EXITOSA', 'INFO', `Reporte marcado como enviado: ${weekId}`);
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failed to remove pending report', error);
  }
};

export const LAST_SUCCESSFUL_REPORT_KEY = 'LAST_SUCCESSFUL_REPORT_TIMESTAMP';

export const ensureWeeklyReportExists = async () => {
  const lastReport = await AsyncStorage.getItem(LAST_SUCCESSFUL_REPORT_KEY);
  const now = dayjs();
  const lastReportDate = lastReport ? dayjs(parseInt(lastReport, 10)) : null;

  if (!lastReportDate || !lastReportDate.isSame(now, 'week')) {
    log('AZUL', 'BACKGROUND_TASK', 'INFO', 'Verificando reporte semanal pendiente...');
    const pdfUri = await generateWeeklyReport(false);

    if (pdfUri) {
      const currentWeekId = now.startOf('isoWeek').format('YYYY-MM-DD');
      await trackPendingReport(currentWeekId, pdfUri);
      await AsyncStorage.setItem(LAST_SUCCESSFUL_REPORT_KEY, now.valueOf().toString());

      await NotificationDispatcher.dispatch('ON_PENDING_REPORT_REMINDER', {
        customBody: 'Toca para enviar tu nómina por correo.',
        data: { action: 'SHOW_REPORT_PROMPT', pdfUri, weekId: currentWeekId }
      });
      return true;
    }
  }
  return false;
};
