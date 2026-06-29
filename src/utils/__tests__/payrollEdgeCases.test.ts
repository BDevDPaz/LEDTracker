import { calculatePayFromMinutes, calculateSessionMinutes } from '../payrollUtils';

describe('Payroll Edge Cases', () => {
  it('debería manejar turnos de exactamente 8 horas sin horas extra', () => {
    const minutes = 480; // 8 horas
    const result = calculatePayFromMinutes(minutes, 25);
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.totalPay).toBe(200);
  });

  it('debería calcular horas extra después de las 8 horas', () => {
    const minutes = 540; // 9 horas
    const result = calculatePayFromMinutes(minutes, 25);
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(60);
    // 8h * 25 + 1h * 25 * 1.5 = 200 + 37.5 = 237.5
    expect(result.totalPay).toBe(237.5);
  });

  it('debería descontar el almuerzo exacto si está presente', () => {
    const start = 1000000;
    const end = 2000000;
    const lStart = 1200000;
    const lEnd = 1300000; // 100000 ms = ~1.6min? No, use bigger numbers

    // 10 horas = 600 min
    const startMs = 0;
    const endMs = 10 * 60 * 60 * 1000;
    const lunchStartMs = 4 * 60 * 60 * 1000;
    const lunchEndMs = 5 * 60 * 60 * 1000; // 1 hora

    const minutes = calculateSessionMinutes(startMs, endMs, 1, lunchStartMs, lunchEndMs);
    expect(minutes).toBe(540); // 600 - 60
  });

  it('debería descontar almuerzo por defecto si pasa de 6 horas y no hay intervalo exacto', () => {
    const startMs = 0;
    const endMs = 7 * 60 * 60 * 1000; // 7 horas = 420 min
    const minutes = calculateSessionMinutes(startMs, endMs, 1, null, null);
    expect(minutes).toBe(360); // 420 - 60
  });
});
