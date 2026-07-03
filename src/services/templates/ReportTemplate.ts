import escapeHtml from 'escape-html';
import { AppSettings, AuditLog } from '../../types';
import dayjs from '../../utils/dayjsSetup';

export const getReportHtml = (
  settings: AppSettings,
  rows: any[],
  logs: AuditLog[],
  rangeTitle: string,
  totalHours: number,
  totalOvertime: number,
  totalEarnings: number,
  formatCurrency: (v: number) => string,
  formatTime: (v: number) => string,
  reportId: string,
  integrityHash: string
) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.5; padding: 20px; }
            .header { border-bottom: 2px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px; display: flex; flex-direction: column; }
            .title { font-size: 24px; font-weight: bold; color: #000; letter-spacing: 1px; }
            .subtitle { font-size: 12px; color: #D4AF37; text-transform: uppercase; font-weight: bold; margin-top: 4px; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-col { flex: 1; }
            .info-label { font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
            .info-value { font-size: 13px; color: #000; font-weight: bold; }
            .stats-box { background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 20px; display: flex; justify-content: space-around; margin-bottom: 30px; }
            .stat-item { text-align: center; }
            .stat-num { font-size: 20px; font-weight: bold; color: #000; }
            .stat-desc { font-size: 10px; color: #666; text-transform: uppercase; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background: #f4f4f4; text-align: left; padding: 12px 10px; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 2px solid #ddd; }
            td { padding: 12px 10px; font-size: 11px; border-bottom: 1px solid #eee; vertical-align: top; }
            .row-active { background-color: #fff9e6; }
            .client-badge { display: inline-block; background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; margin-bottom: 4px; }
            .manual-badge { display: inline-block; background: #fff4f4; color: #c00; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #fcc; }
            .lunch-badge { color: #888; font-size: 9px; }
            .geo-badge-in { color: #2e7d32; font-size: 9px; font-weight: bold; display: block; margin-top: 4px; }
            .geo-badge-out { color: #d32f2f; font-size: 9px; font-weight: bold; display: block; margin-top: 4px; }
            .notes { display: block; font-style: italic; color: #666; margin-top: 5px; font-size: 10px; }
            .audit-section { margin-top: 40px; padding: 15px; background: #fffdf5; border: 1px solid #ffecb3; border-radius: 6px; }
            .audit-title { font-size: 12px; font-weight: bold; color: #856404; margin-bottom: 10px; text-transform: uppercase; }
            .log-item { font-size: 9px; color: #555; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.05); }
            .log-alert { color: #856404; background: rgba(255,193,7,0.05); padding: 4px 10px; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
            .sig-box { width: 45%; text-align: center; }
            .sig-line { border-top: 1px solid #333; margin-bottom: 10px; width: 100%; height: 1px; }
            .sig-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; }
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">WTracker</div>
            <div class="subtitle">Reporte Oficial de Nómina y Auditoría</div>
          </div>
          <div class="info-grid">
            <div class="info-col">
              <div class="info-label">Empleado</div>
              <div class="info-value">${escapeHtml(settings.employee_name || 'No especificado')}</div>
              <div class="info-label">ID Sistema</div>
              <div class="info-value">EMP-#${settings.id.toString().padStart(4, '0')}</div>
            </div>
            <div class="info-col" style="text-align: right;">
              <div class="info-label">Empresa</div>
              <div class="info-value">${escapeHtml(settings.employer_name || "WTracker Corp")}</div>
              <div class="info-label">Rango del Reporte</div>
              <div class="info-value">${rangeTitle}</div>
            </div>
          </div>
          <div class="stats-box">
            <div class="stat-item">
              <div class="stat-num">${totalHours.toFixed(2)}</div>
              <div class="stat-desc">Horas Totales</div>
            </div>
            <div class="stat-item">
              <div class="stat-num">${totalOvertime.toFixed(2)}</div>
              <div class="stat-desc">Horas Extra (OT)</div>
            </div>
            <div class="stat-item">
              <div class="stat-num" style="color: #D4AF37;">${formatCurrency(totalEarnings)}</div>
              <div class="stat-desc">Pago Estimado</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th width="15%">Fecha</th>
                <th width="40%">Actividad / Cliente</th>
                <th width="25%">Horario</th>
                <th width="10%">Hrs</th>
                <th width="10%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr class="${row.status === 'active' ? 'row-active' : ''}">
                  <td>
                    <strong>${row.date}</strong>
                    ${row.lunch === 'Sí' ? '<br><span class="lunch-badge">Lunch: -1h</span>' : ''}
                  </td>
                  <td>
                    ${row.client !== 'General' ? `<span class="client-badge">${row.client}</span>` : ''}
                    ${row.isManual ? '<span class="manual-badge">Editado</span>' : ''}
                    <br>
                    ${row.address}
                    ${row.notes ? `<span class="notes">"${row.notes}"</span>` : ''}
                  </td>
                  <td>
                    ${row.start} - ${row.end}
                    ${row.isGeofenceIn ? '<span class="geo-badge-in">✓ Auto Check-in (GPS)</span>' : ''}
                    ${row.isGeofenceOut ? '<span class="geo-badge-out">⚠ Auto Check-out (GPS)</span>' : ''}
                  </td>
                  <td><strong>${row.total}</strong></td>
                  <td>${row.pay}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signature-section">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Empleado</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Empleador</div>
            </div>
          </div>

          <div class="audit-section">
            <div class="audit-title">Registro de Eventos Críticos (GPS & Sistema)</div>
            ${logs.length === 0 ? '<div style="font-size:10px; color:#999;">Sin eventos registrados en este periodo.</div>' :
               logs.map(auditLog => `
                <div class="log-item ${auditLog.action_type.includes('AUTO') || auditLog.action_type.includes('EXIT') ? 'log-alert' : ''}">
                  <strong>${formatTime(auditLog.timestamp)}</strong> — <span style="font-weight:bold">[${auditLog.action_type}]</span> ${escapeHtml(auditLog.details)}
                </div>
              `).join('')}
          </div>
          <div class="footer">
            ID de Reporte: ${reportId}<br>
            Integridad: ${integrityHash}<br>
            Documento generado electrónicamente por WTracker App.<br>
            Certificado digitalmente: ${dayjs().format('YYYY-MM-DD HH:mm:ss Z')}
          </div>
        </body>
      </html>
    `;
}
