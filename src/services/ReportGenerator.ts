import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { getDB, getSettings, getAllAsync } from '../database/db';
import { WorkSession, AppSettings, AuditLog } from '../types';

// Helper para fechas y monedas
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('es-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`;
};

/**
 * Genera el reporte semanal en PDF con auditoría completa.
 * @param shouldShare Si es true, abre el diálogo de compartir inmediatamente.
 * @param customRange (Opcional) Rango de fechas específico.
 */
export const generateWeeklyReport = async (shouldShare: boolean = true, customRange?: { start: number, end: number }): Promise<string | null> => {
  try {
    const db = getDB();
    const settings = await getSettings();
    
    if (!settings) {
      console.error("No settings found");
      return null;
    }

    // 1. Determinar Rango de Fechas
    let startTs: number, endTs: number;
    let rangeTitle = "";

    if (customRange) {
      startTs = customRange.start;
      endTs = customRange.end;
      rangeTitle = `${formatDate(startTs)} - ${formatDate(endTs)}`;
    } else {
      // Por defecto: Semana actual (Ajuste a Domingo)
      const now = new Date();
      const day = now.getDay(); 
      const diff = now.getDate() - day; 
      const start = new Date(now);
      start.setDate(diff);
      start.setHours(0,0,0,0);
      
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23,59,59,999);
      
      startTs = start.getTime();
      endTs = end.getTime();
      rangeTitle = "Semana Actual";
    }

    // 2. Obtener Datos (Sesiones y Logs)
    // ✅ Seleccionamos los nuevos campos: client_name, manual_note, actual_start_time
    const sessions = await getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions 
       WHERE start_time >= ? AND start_time <= ? 
       ORDER BY start_time ASC`,
      [startTs, endTs]
    );

    // ✅ Logs de auditoría para validar eventos automáticos
    const logs = await getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs 
       WHERE timestamp >= ? AND timestamp <= ? 
       ORDER BY timestamp DESC`,
      [startTs, endTs]
    );

    // 3. Cálculos Financieros
    let totalHours = 0;
    let totalOvertime = 0;
    let totalEarnings = 0;

    const rows = sessions.map(session => {
      // Lógica de Auditoría: Usamos la hora GPS (actual_start_time) si existe.
      // Si no, usamos la de configuración (start_time).
      const startTime = session.actual_start_time || session.start_time;
      const endTime = session.end_time || Date.now();
      
      // Cálculo de Duración
      let durationMs = endTime - startTime;
      
      // Descuento de Almuerzo
      if (session.lunch_taken && session.lunch_end && session.lunch_start) {
         durationMs -= (session.lunch_end - session.lunch_start);
      } else if (session.lunch_taken) {
         durationMs -= 3600000; // 1h default si no hay registro exacto
      }

      // Evitar negativos (por si acaso)
      durationMs = Math.max(0, durationMs);
      const hours = durationMs / (1000 * 60 * 60);
      
      // Cálculo Overtime (Simplificado: >8h diario)
      let regHours = hours;
      let otHours = 0;
      
      if (hours > 8) {
        regHours = 8;
        otHours = hours - 8;
      }

      const pay = (regHours * settings.hourly_rate) + (otHours * settings.hourly_rate * settings.overtime_multiplier);
      
      totalHours += hours;
      totalOvertime += otHours;
      totalEarnings += pay;

      return {
        date: formatDate(startTime),
        client: session.client_name || 'General', // ✅ Mostrar Cliente
        address: session.address,
        notes: session.manual_note || '',         // ✅ Mostrar Notas
        start: formatTime(startTime),
        end: session.end_time ? formatTime(session.end_time) : 'En curso',
        lunch: session.lunch_taken ? 'Sí' : 'No',
        total: hours.toFixed(2),
        pay: formatCurrency(pay),
        status: session.status,
        // ✅ Indicador de confianza: ¿Fue check-in automático?
        isGeofence: session.actual_start_time ? true : false 
      };
    });

    // 4. Construcción del HTML (Diseño Luxury)
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; }
            .title { font-size: 26px; font-weight: 800; color: #000; letter-spacing: 2px; text-transform: uppercase; }
            .subtitle { font-size: 11px; color: #D4AF37; text-transform: uppercase; margin-top: 5px; letter-spacing: 1px; }
            
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8f8f8; padding: 15px; border-radius: 8px; }
            .info-col { width: 48%; }
            .info-label { font-size: 9px; color: #999; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
            .info-value { font-size: 13px; color: #000; font-weight: 600; margin-bottom: 10px; }

            .stats-box { display: flex; justify-content: space-between; margin-bottom: 30px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
            .stat-item { flex: 1; text-align: center; padding: 15px; border-right: 1px solid #eee; }
            .stat-item:last-child { border-right: none; background: #fffcf2; }
            .stat-num { font-size: 22px; font-weight: bold; color: #000; }
            .stat-desc { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 5px; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 11px; }
            th { text-align: left; border-bottom: 2px solid #000; padding: 10px; text-transform: uppercase; font-size: 9px; color: #666; }
            td { border-bottom: 1px solid #eee; padding: 12px 10px; vertical-align: top; }
            .row-active { background-color: #fff8e1; }
            
            .client-badge { background: #000; color: #fff; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-bottom: 4px; }
            .notes { font-style: italic; color: #666; font-size: 10px; display: block; margin-top: 4px; }
            .geo-badge { color: #2ecc71; font-size: 9px; font-weight: bold; display: block; margin-top: 2px; }
            .lunch-badge { color: #e67e22; font-size: 9px; }

            .audit-section { margin-top: 20px; border-top: 3px solid #eee; padding-top: 20px; page-break-inside: avoid; }
            .audit-title { font-size: 12px; font-weight: bold; color: #000; text-transform: uppercase; margin-bottom: 15px; }
            .log-item { font-size: 9px; color: #555; margin-bottom: 6px; border-left: 2px solid #ddd; padding-left: 10px; }
            .log-alert { border-left-color: #D4AF37; color: #000; background: #fffcf0; padding: 5px 10px; }
            
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">LED TRACKER</div>
            <div class="subtitle">Reporte Oficial de Nómina y Auditoría</div>
          </div>

          <div class="info-grid">
            <div class="info-col">
              <div class="info-label">Empleado</div>
              <div class="info-value">${settings.employee_name || 'No especificado'}</div>
              <div class="info-label">ID Sistema</div>
              <div class="info-value">EMP-#${settings.id.toString().padStart(4, '0')}</div>
            </div>
            <div class="info-col" style="text-align: right;">
              <div class="info-label">Empresa</div>
              <div class="info-value">${settings.employer_name || 'LEON\'S ELECTRICAL DESIGN'}</div>
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
                    ${row.client !== 'General' ? `<span class="client-badge">${row.client}</span><br>` : ''}
                    ${row.address}
                    ${row.notes ? `<span class="notes">"${row.notes}"</span>` : ''}
                  </td>
                  <td>
                    ${row.start} - ${row.end}
                    ${row.isGeofence ? '<span class="geo-badge">✓ Auto Check-in (GPS)</span>' : ''}
                  </td>
                  <td><strong>${row.total}</strong></td>
                  <td>${row.pay}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="audit-section">
            <div class="audit-title">Registro de Eventos Críticos (GPS & Sistema)</div>
            ${logs.length === 0 ? '<div style="font-size:10px; color:#999;">Sin eventos registrados en este periodo.</div>' : 
              logs.map(log => `
                <div class="log-item ${log.action_type.includes('AUTO') || log.action_type.includes('EXIT') ? 'log-alert' : ''}">
                  <strong>${formatTime(log.timestamp)}</strong> — <span style="font-weight:bold">[${log.action_type}]</span> ${log.details}
                </div>
              `).join('')
            }
          </div>

          <div class="footer">
            Documento generado electrónicamente por LED Tracker App.<br>
            Certificado digitalmente: ${new Date().toISOString()}
          </div>
        </body>
      </html>
    `;

    // 5. Generar y Compartir
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false
    });

    if (shouldShare) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }

    return uri;

  } catch (error) {
    console.error("Error generating report:", error);
    return null;
  }
};

/**
 * Prepara el correo con el PDF adjunto.
 */
export const sendReportByEmail = async (pdfUri: string, settings: AppSettings) => {
  const isAvailable = await MailComposer.isAvailableAsync();
  
  if (isAvailable) {
    await MailComposer.composeAsync({
      recipients: [settings.company_email],
      subject: `Nómina Semanal - ${settings.employee_name}`,
      body: `Hola,\n\nAdjunto encontrarás mi reporte de horas y actividades detallado.\n\nPeriodo finalizado.\n\nAtentamente,\n${settings.employee_name}`,
      attachments: [pdfUri]
    });
  } else {
    await Sharing.shareAsync(pdfUri);
  }
};
