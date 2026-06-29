import { calculateDuration, calculateSessionMinutes, calculatePayFromMinutes } from '../payrollUtils';

describe('Payroll Precision Engine', () => {
  describe('calculateDuration (Midnight Crossing)', () => {
    it('should calculate duration within the same day', () => {
      // 8:00 AM to 4:00 PM
      expect(calculateDuration(8 * 60, 16 * 60)).toBe(8 * 60);
    });

    it('should calculate duration across midnight', () => {
      // 10:00 PM to 6:00 AM
      // 22:00 -> 06:00
      expect(calculateDuration(22 * 60, 6 * 60)).toBe(8 * 60);
    });

    it('should calculate short midnight crossing', () => {
      // 11:00 PM to 1:00 AM
      expect(calculateDuration(23 * 60, 1 * 60)).toBe(2 * 60);
    });
  });

  describe('calculateSessionMinutes (Break Deduction)', () => {
    const hourMs = 3600000;
    const start = 1717142400000; // Some Monday 00:00

    it('should NOT deduct break if workday <= 6 hours', () => {
      const end = start + (6 * hourMs);
      expect(calculateSessionMinutes(start, end, 1)).toBe(6 * 60);
    });

    it('should deduct 1 hour if workday > 6 hours and no exact lunch provided', () => {
      const end = start + (7 * hourMs);
      expect(calculateSessionMinutes(start, end, 1)).toBe(6 * 60);
    });

    it('should deduct exact lunch if provided', () => {
      const end = start + (8 * hourMs);
      const lStart = start + (4 * hourMs);
      const lEnd = start + (4.5 * hourMs); // 30 min break
      expect(calculateSessionMinutes(start, end, 1, lStart, lEnd)).toBe(7.5 * 60);
    });

    it('should not deduct lunch if lunchTaken is false', () => {
      const end = start + (8 * hourMs);
      expect(calculateSessionMinutes(start, end, 0)).toBe(8 * 60);
    });

    it('should validate break is within shift range', () => {
        const end = start + (8 * hourMs);
        const lStart = start - hourMs; // Before shift
        const lEnd = start + hourMs;
        expect(calculateSessionMinutes(start, end, 1, lStart, lEnd)).toBe(8 * 60 - 60); // Falls back to default if lStart is out of range?
        // Wait, my implementation says: if (lStartMin >= startMin && lEndMin <= endMin)
        // So if it's out of range, it skips deduction and checks the "else if"
    });
  });

  describe('calculatePayFromMinutes (California Rules)', () => {
    it('should calculate regular pay for 8 hours', () => {
      const result = calculatePayFromMinutes(8 * 60, 20);
      expect(result.regularMinutes).toBe(8 * 60);
      expect(result.overtimeMinutes).toBe(0);
      expect(result.totalPay).toBe(160);
    });

    it('should calculate overtime for > 8 hours', () => {
      const result = calculatePayFromMinutes(10 * 60, 20);
      expect(result.regularMinutes).toBe(8 * 60);
      expect(result.overtimeMinutes).toBe(2 * 60);
      // 160 + 2 * (20 * 1.5) = 160 + 60 = 220
      expect(result.totalPay).toBe(220);
    });
  });
});
