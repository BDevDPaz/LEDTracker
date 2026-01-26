// src/services/ReportGenerator.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy'; // ✅ Legacy para moveAsync
import { getDB, getSettings } from '../database/db';
import { WorkSession, AuditLog } from '../types';
import { translations } from '../utils/i18n';

export const generateWeeklyReport = async (shouldShare = true): Promise<string | null> => {
  try {
    const db = getDB();
    const settings = await getSettings();
    if (!settings) return null;

    const t = translations[settings.language];
    const multiplier = settings.overtime_multiplier || 1.5;
    const rate = settings.hourly_rate || 0;

    // ✅ Últimos 7 días
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 7);
    const pastTs = past.getTime();

    // ✅ Sesiones y Auditoría
    const sessions = await db.getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions WHERE start_time >= ? AND status != 'deleted' ORDER BY start_time ASC`,
      [pastTs]
    );
    const auditLogs = await db.getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs WHERE timestamp >= ? ORDER BY timestamp ASC`,
      [pastTs]
    );

    if (sessions.length === 0 && auditLogs.length === 0 && !shouldShare) return null;

    // ✅ Agrupar por día
    const days: { [key: string]: WorkSession[] } = {};
    sessions.forEach(s => {
      const dateKey = new Date(s.start_time).toDateString();
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push(s);
    });

    let rows = '';
    let totalRegHours = 0;
    let totalOTHours = 0;

    // ✅ Calcular horas regulares y extras por día
    for (const dateKey in days) {
      const daySessions = days[dateKey];
      let dayMs = 0;

      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();
        if (s.lunch_taken) ms -= 3600000;
        dayMs += Math.max(0, ms);
      });

      const dayHours = dayMs / (1000 * 60 * 60);
      let reg = dayHours;
      let ot = 0;
      if (dayHours > 8) {
        reg = 8;
        ot = dayHours - 8;
      }

      totalRegHours += reg;
      totalOTHours += ot;

      // ✅ Filas HTML por sesión
      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();
        if (s.lunch_taken) ms -= 3600000;
        const hours = ms / (1000 * 60 * 60);

        const isTravel = s.status === 'travel';
        const locText = isTravel ? `🚗 ${t.status_travel || 'En Tránsito'}` : s.address;
        const noteHtml = s.is_manual_edit ? `<br/><span style="color:red; font-size:10px;">⚠️ EDIT: ${s.manual_note}</span>` : '';

        rows += `
          <tr>
            <td>${start.toLocaleDateString()}</td>
            <td>${locText}</td>
            <td>${start.toLocaleTimeString()}</td>
            <td>${s.end_time ? end.toLocaleTimeString() : 'Active'} ${noteHtml}</td>
            <td>${hours.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    // ✅ Cálculo de dinero
    const totalMoney = (totalRegHours * rate) + (totalOTHours * rate * multiplier);

    // ✅ Auditoría
    let auditRows = '';
    if (auditLogs.length > 0) {
      auditLogs.forEach(log => {
        const date = new Date(log.timestamp);
        let color = '#333';
        if (log.action_type === 'DELETED') color = 'red';
        if (log.action_type === 'MODIFIED') color = 'orange';
        auditRows += `
          <tr>
            <td>${date.toLocaleString()}</td>
            <td style="color:${color}; font-weight:bold;">${log.action_type}</td>
            <td>${log.details}</td>
          </tr>`;
      });
    } else {
      auditRows = `<tr><td colspan="3" style="text-align:center; font-style:italic;">No modifications recorded.</td></tr>`;
    }

    // ✅ HTML Final
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 5px; }
            h3 { margin-top: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-box { margin-top: 20px; border: 2px solid #333; padding: 10px; width: 60%; margin-left: auto; background-color: #f9f9f9; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
            .grand-total { font-weight: bold; font-size: 18px; border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;}
            .section-title { margin-top: 40px; border-bottom: 2px solid #333; padding-bottom: 5px; font-size: 16px; font-weight: bold; }
            .disclaimer { font-size: 10px; color: #666; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${settings.employer_name}</h1>
          <h3>${t.pdf_employee}: ${settings.employee_name}</h3>
          <p>Email: ${settings.company_email}</p>

          <h4>${t.pdf_title}</h4>
          <table>
            <tr>
              <th>${t.col_date}</th>
              <th>${t.col_loc}</th>
              <th>${t.col_in}</th>
              <th>${t.col_out}</th>
              <th>Hrs</th>
            </tr>
            ${rows}
          </table>

          <div class="total-box">
            <div class="total-row"><span>Reg. Hours:</span> <span>${totalRegHours.toFixed(2)}</span></div>
            <div class="total-row"><span>Overtime (${multiplier}x):</span> <span>${totalOTHours.toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>EST. PAY:</span> <span>$${totalMoney.toFixed(2)}</span></div>
          </div>

          <div class="section-title">${t.pdf_audit_title}</div>
          <p class="disclaimer">${t.pdf_audit_msg}</p>
          <table>
            <tr>
              <th>${t.col_ts}</th>
              <th>${t.col_action}</th>
              <th>${t.col_details}</th>
            </tr>
            ${auditRows}
          </table>
        </body>
      </html>
    `;

    // ✅ Generar PDF y renombrar
    const { uri } = await Print.printToFileAsync({ html });
    const safeName = (settings.employee_name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${safeName}_Report_${dateStr}.pdf`;
    const newPath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.moveAsync({ from: uri, to: newPath });

    if (shouldShare) {
      await Sharing.shareAsync(newPath, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: fileName });
    }

    return newPath;

  } catch (error) {
    console.error("Report Gen Error:", error);
    return null;
  }
};
