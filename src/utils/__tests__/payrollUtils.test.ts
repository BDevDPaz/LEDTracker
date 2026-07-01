import { calculateSessionDuration, calculatePay, validateSession } from '../payrollUtils';

describe('payrollUtils', () => {
  // ==========================================
  // PRUEBAS DE DURACIÓN DE SESIÓN
  // ==========================================
  describe('calculateSessionDuration', () => {
    it('debe calcular la duración correctamente sin almuerzo', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 12, 0, 0);
      const duration = calculateSessionDuration(start, end, 0);
      expect(duration).toBe(14400000);
    });

    it('debe descontar 1 hora si tomó almuerzo y supera el umbral de 6 horas', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 16, 0, 0); // 8 horas
      const duration = calculateSessionDuration(start, end, 1);
      expect(duration).toBe(25200000); // 7 horas en ms
    });

    it('NO debe descontar 1 hora si tomó almuerzo pero NO supera el umbral de 6 horas', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 12, 0, 0); // 4 horas
      const duration = calculateSessionDuration(start, end, 1);
      expect(duration).toBe(14400000); // Sigue siendo 4 horas
    });

    it('debe descontar el tiempo exacto si se proporcionan inicio y fin de almuerzo', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 17, 0, 0);
      const lunchStart = Date.UTC(2026, 4, 30, 12, 0, 0);
      const lunchEnd = Date.UTC(2026, 4, 30, 12, 30, 0);
      const duration = calculateSessionDuration(start, end, 1, lunchStart, lunchEnd);
      expect(duration).toBe(30600000);
    });

    it('no debe retornar tiempos negativos si el fin es anterior al inicio', () => {
      const start = Date.UTC(2026, 4, 30, 10, 0, 0);
      const end = Date.UTC(2026, 4, 30, 8, 0, 0);
      const duration = calculateSessionDuration(start, end, 0);
      expect(duration).toBe(0);
    });
  });

  // ==========================================
  // PRUEBAS DE VALIDACIÓN
  // ==========================================
  describe('validateSession', () => {
    const MS_PER_HOUR = 3600000;

    it('debe validar una sesión correcta', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 16, 0, 0);
      expect(validateSession(start, end)).toBeNull();
    });

    it('debe rechazar fin anterior al inicio', () => {
      const start = Date.UTC(2026, 4, 30, 10, 0, 0);
      const end = Date.UTC(2026, 4, 30, 8, 0, 0);
      expect(validateSession(start, end)).toBe("La hora de finalización no puede ser anterior a la de inicio");
    });

    it('debe rechazar turnos de más de 16 horas', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = start + 17 * MS_PER_HOUR;
      expect(validateSession(start, end)).toBe("La duración del turno excede el límite permitido (16 horas)");
    });

    it('debe rechazar almuerzo fuera del turno', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 16, 0, 0);
      const lStart = Date.UTC(2026, 4, 30, 7, 0, 0);
      const lEnd = Date.UTC(2026, 4, 30, 8, 0, 0);
      expect(validateSession(start, end, lStart, lEnd)).toBe("El tiempo de almuerzo debe estar dentro del rango del turno");
    });

    it('debe rechazar almuerzo con fin anterior a inicio', () => {
      const start = Date.UTC(2026, 4, 30, 8, 0, 0);
      const end = Date.UTC(2026, 4, 30, 16, 0, 0);
      const lStart = Date.UTC(2026, 4, 30, 13, 0, 0);
      const lEnd = Date.UTC(2026, 4, 30, 12, 0, 0);
      expect(validateSession(start, end, lStart, lEnd)).toBe("La hora de fin del almuerzo no puede ser anterior a la de inicio");
    });

    it('debe rechazar almuerzo que excede la duración del turno', () => {
        const start = Date.UTC(2026, 4, 30, 8, 0, 0);
        const end = Date.UTC(2026, 4, 30, 9, 0, 0);
        const lStart = Date.UTC(2026, 4, 30, 8, 0, 0);
        const lEnd = Date.UTC(2026, 4, 30, 9, 30, 0); // Excede fin turno
        // Aquí la validación de rango saltará primero si está bien implementada
        expect(validateSession(start, end, lStart, lEnd)).toBe("El tiempo de almuerzo debe estar dentro del rango del turno");
    });
  });

  // ==========================================
  // PRUEBAS DE CÁLCULO DE NÓMINA (PAYROLL)
  // ==========================================
  describe('calculatePay', () => {
    it('debe calcular el pago de una jornada regular (≤ 8 horas)', () => {
      const result = calculatePay(5, 20);
      expect(result.regularHours).toBe(5);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBe(100);
    });

    it('debe calcular el pago con horas extra (> 8 horas) usando multiplicador por defecto', () => {
      const result = calculatePay(10, 20);
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      expect(result.totalPay).toBe(220);
    });

    it('debe calcular el pago con horas extra usando un multiplicador personalizado', () => {
      const result = calculatePay(10, 20, 2.0);
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      expect(result.totalPay).toBe(240);
    });

    it('debe manejar jornadas de exactamente 8 horas sin aplicar horas extra', () => {
      const result = calculatePay(8, 25);
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBe(200);
    });
  });
});
