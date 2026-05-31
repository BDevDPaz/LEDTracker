// --- src/utils/__tests__/payrollUtils.test.ts ---
import { calculateSessionDuration, calculatePay } from '../payrollUtils';

describe('payrollUtils', () => {

  // ==========================================
  // PRUEBAS DE DURACIÓN DE SESIÓN
  // ==========================================
  describe('calculateSessionDuration', () => {
    
    it('debe calcular la duración correctamente sin almuerzo', () => {
      const start = new Date('2026-05-30T08:00:00Z').getTime();
      const end = new Date('2026-05-30T12:00:00Z').getTime(); // 4 horas exactas

      const duration = calculateSessionDuration(start, end, 0);

      // 4 horas = 4 * 60 * 60 * 1000 = 14400000 milisegundos
      expect(duration).toBe(14400000);
    });

    it('debe descontar 1 hora por defecto si tomó almuerzo pero no hay tiempos exactos', () => {
      const start = new Date('2026-05-30T08:00:00Z').getTime();
      const end = new Date('2026-05-30T16:00:00Z').getTime(); // 8 horas totales

      const duration = calculateSessionDuration(start, end, 1);

      // 8 horas - 1 hora default = 7 horas (25200000 ms)
      expect(duration).toBe(25200000);
    });

    it('debe descontar el tiempo exacto si se proporcionan inicio y fin de almuerzo', () => {
      const start = new Date('2026-05-30T08:00:00Z').getTime();
      const end = new Date('2026-05-30T17:00:00Z').getTime(); // 9 horas totales
      
      const lunchStart = new Date('2026-05-30T12:00:00Z').getTime();
      const lunchEnd = new Date('2026-05-30T12:30:00Z').getTime(); // 30 min de almuerzo

      const duration = calculateSessionDuration(start, end, 1, lunchStart, lunchEnd);

      // 9 horas - 30 min = 8.5 horas (30600000 ms)
      expect(duration).toBe(30600000);
    });

    it('no debe retornar tiempos negativos si el almuerzo es mayor que la sesión (failsafe)', () => {
      const start = new Date('2026-05-30T08:00:00Z').getTime();
      const end = new Date('2026-05-30T08:30:00Z').getTime(); // 30 min totales

      // Intentamos descontar la hora por defecto (1h) de una sesión de media hora
      const duration = calculateSessionDuration(start, end, 1);

      expect(duration).toBe(0);
    });
  });

  // ==========================================
  // PRUEBAS DE CÁLCULO DE NÓMINA (PAYROLL)
  // ==========================================
  describe('calculatePay', () => {

    it('debe calcular el pago de una jornada regular (≤ 8 horas)', () => {
      const result = calculatePay(5, 20); // 5 horas a $20/hr, multiplier default 1.5

      expect(result.regularHours).toBe(5);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBe(100); // 5 * 20 = 100
    });

    it('debe calcular el pago con horas extra (> 8 horas) usando multiplicador por defecto', () => {
      const result = calculatePay(10, 20); // 10 horas totales a $20/hr

      expect(result.regularHours).toBe(8); // 8 horas base
      expect(result.overtimeHours).toBe(2); // 2 horas extra
      
      // Regular: 8 * 20 = 160
      // Overtime: 2 * (20 * 1.5) = 60
      // Total: 220
      expect(result.totalPay).toBe(220);
    });

    it('debe calcular el pago con horas extra usando un multiplicador personalizado', () => {
      const result = calculatePay(10, 20, 2.0); // Multiplicador al doble (x2.0)

      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      
      // Regular: 8 * 20 = 160
      // Overtime: 2 * (20 * 2.0) = 80
      // Total: 240
      expect(result.totalPay).toBe(240);
    });

    it('debe manejar jornadas de exactamente 8 horas sin aplicar horas extra', () => {
      const result = calculatePay(8, 25); // 8 horas a $25/hr

      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBe(200); // 8 * 25 = 200
    });
  });
});

