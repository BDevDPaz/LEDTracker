import { calculatePay, calculateSessionDuration } from '../payrollUtils';

describe('Logica de Nómina (payrollUtils)', () => {

  // --- PRUEBAS DE CÁLCULO DE DINERO ---
  describe('calculatePay', () => {
    const RATE = 20; // $20 por hora
    const MULTIPLIER = 1.5; // 1.5x Overtime

    it('Calcula jornada normal (8 horas)', () => {
      // 8h * $20 = $160
      const result = calculatePay(8, RATE, MULTIPLIER);
      expect(result.totalPay).toBe(160);
      expect(result.overtimeHours).toBe(0);
    });

    it('Calcula jornada con horas extra (10 horas)', () => {
      // 8h Regulares ($160) + 2h Extra ($20 * 1.5 * 2 = $60) = $220
      const result = calculatePay(10, RATE, MULTIPLIER);
      expect(result.totalPay).toBe(220);
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
    });

    it('Calcula jornada corta (4.5 horas)', () => {
      // 4.5h * $20 = $90
      const result = calculatePay(4.5, RATE, MULTIPLIER);
      expect(result.totalPay).toBe(90);
    });
  });

  // --- PRUEBAS DE DURACIÓN ---
  describe('calculateSessionDuration', () => {
    it('Calcula duración simple sin almuerzo', () => {
      const start = 1000;
      const end = 5000;
      // 4000ms de diferencia
      expect(calculateSessionDuration(start, end, 0)).toBe(4000);
    });

    it('Descuenta 1 hora estándar de almuerzo', () => {
      const start = new Date('2026-01-01T08:00:00').getTime(); // 8:00 AM
      const end = new Date('2026-01-01T17:00:00').getTime();   // 5:00 PM (9 horas total)
      
      // 9 horas total - 1 hora lunch = 8 horas (28,800,000 ms)
      const duration = calculateSessionDuration(start, end, 1);
      const hours = duration / (1000 * 60 * 60);
      
      expect(hours).toBe(8);
    });
  });

});
