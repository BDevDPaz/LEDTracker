// src/services/ReportGenerator.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getDB, getSettings } from '../database/db';
import { WorkSession, AuditLog } from '../types';
import { translations } from '../utils/i18n';

export const generateWeeklyReport = async (
  shouldShare = true,
  customRange?: { start: number; end: number }
): Promise<string | null> => {
  try {
    const db = getDB();
    const settings = await getSettings();
    if (!settings) return null;

    const t = translations[settings.language];
    const multiplier = settings.overtime_multiplier || 1.5;
    const rate = settings.hourly_rate || 0;

    let startTs: number;
    let endTs: number;

    if (customRange) {
      startTs = customRange.start;
      endTs = customRange.end;
    } else {
      const now = new Date();
      const day = now.getDay(); 
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      monday.setHours(0,0,0,0);
      
      startTs = monday.getTime();
      endTs = Date.now();
    }

    const sessions = await db.getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions 
       WHERE start_time >= ? AND (end_time <= ? OR end_time IS NULL) 
       AND status != 'deleted' 
       ORDER BY start_time ASC`,
      [startTs, endTs]
    );

    const auditLogs = await db.getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs WHERE timestamp >= ? ORDER BY timestamp ASC`,
      [startTs]
    );

    if (sessions.length === 0 && auditLogs.length === 0 && !shouldShare) return null;

    // ✅ MEJORA 1: Agrupar por fecha sortable (YYYY-MM-DD)
    const days: { [key: string]: WorkSession[] } = {};
    sessions.forEach(s => {
      const d = new Date(s.start_time);
      // Formato ISO local para garantizar orden correcto: 2026-01-25
      const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push(s);
    });

    let rows = '';
    let totalWeeklyReg = 0;
    let totalWeeklyOT = 0;

    // ✅ MEJORA 2: Ordenar claves cronológicamente
    const sortedDates = Object.keys(days).sort();

    for (const dateKey of sortedDates) {
      const daySessions = days[dateKey];
      let dayMs = 0;

      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();

        if (s.lunch_start && s.lunch_end) {
            ms -= (s.lunch_end - s.lunch_start);
        } else if (s.lunch_taken) {
            ms -= 3600000;
        }
        dayMs += Math.max(0, ms);
      });

      const dayHours = dayMs / (1000 * 60 * 60);
      let reg = dayHours;
      let ot = 0;

      if (dayHours > 8) {
        reg = 8;
        ot = dayHours - 8;
      }

      totalWeeklyReg += reg;
      totalWeeklyOT += ot;

      daySessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date();
        let ms = end.getTime() - start.getTime();
        
        let lunchInfo = '';
        if (s.lunch_start && s.lunch_end) {
             ms -= (s.lunch_end - s.lunch_start);
             const lMin = Math.round((s.lunch_end - s.lunch_start)/60000);
             lunchInfo = `<br/><span style="font-size:9px; color:#555">Lunch: ${lMin}m</span>`;
        } else if (s.lunch_taken) {
             ms -= 3600000;
             lunchInfo = `<br/><span style="font-size:9px; color:#555">Lunch: 60m</span>`;
        }
        
        const hours = ms / (1000 * 60 * 60);
        const isTravel = s.status === 'travel';
        const locText = isTravel ? `🚗 ${t.status_travel || 'En Tránsito'}` : s.address;
        const noteHtml = s.is_manual_edit ? `<br/><span style="color:red; font-size:10px;">⚠️ EDIT: ${s.manual_note}</span>` : '';

        rows += `
          <tr>
            <td>${start.toLocaleDateString()}</td>
            <td>${locText}</td>
            <td>${start.toLocaleTimeString()}</td>
            <td>${s.end_time ? end.toLocaleTimeString() : 'Active'} ${noteHtml} ${lunchInfo}</td>
            <td>${hours.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    if (totalWeeklyReg > 40) {
        const excess = totalWeeklyReg - 40;
        totalWeeklyReg = 40;
        totalWeeklyOT += excess;
    }

    const totalMoney = (totalWeeklyReg * rate) + (totalWeeklyOT * rate * multiplier);

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
          <p>Range: ${new Date(startTs).toLocaleDateString()} - ${new Date(endTs).toLocaleDateString()}</p>

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
            <div class="total-row"><span>Reg. Hours (Max 40/wk):</span> <span>${totalWeeklyReg.toFixed(2)}</span></div>
            <div class="total-row"><span>Overtime (${multiplier}x):</span> <span>${totalWeeklyOT.toFixed(2)}</span></div>
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
