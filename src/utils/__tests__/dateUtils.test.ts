import { formatTime, formatDate } from '../dateUtils';

describe('dateUtils', () => {
  // Fijamos una fecha base para que los tests no dependan de la hora actual
  // Usamos: 2026-01-28 14:30:00 (2:30 PM)
  const TEST_TIMESTAMP = new Date('2026-01-28T14:30:00').getTime();

  describe('formatTime', () => {
    it('debería formatear correctamente una hora PM', () => {
      // Nota: El resultado exacto depende de la configuración regional (locale) del sistema de test,
      // pero verificamos la estructura básica.
      const result = formatTime(TEST_TIMESTAMP);
      // Aceptamos variaciones como "02:30 PM" o "2:30 PM"
      expect(result).toMatch(/2:30/);
      expect(result).toMatch(/PM/);
    });

    it('debería manejar timestamps nulos o indefinidos controladamente', () => {
      // Si tu función soporta esto, añade el caso. Si no, TypeScript lo evitará.
      // Aquí asumimos que siempre recibe número, pero probamos el 0.
      const result = formatTime(0);
      // 1969-12-31 o 1970-01-01 dependiendo de la zona horaria
      expect(result).toContain(':'); 
    });
  });

  describe('formatDate', () => {
    it('debería mostrar la fecha en formato corto', () => {
      const result = formatDate(TEST_TIMESTAMP);
      // Esperamos algo como "Wed, Jan 28" o "mié, 28 ene" (dependiendo del locale 'es-US')
      // Verificamos que contenga el día y el mes
      expect(result).toContain('28');
    });
  });
});
