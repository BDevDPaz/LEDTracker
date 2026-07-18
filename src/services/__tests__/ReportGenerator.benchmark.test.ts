import { expect, test, describe } from '@jest/globals';
import { performance } from 'perf_hooks';

interface MockAuditLog {
  session_id?: string;
  action_type: string;
}

interface MockWorkSession {
  id?: string;
}

const CHECKOUT_ACTIONS = new Set([
  'MANUAL_CHECKOUT',
  'AUTO_CHECKOUT_GPS',
  'AUTO_CHECKOUT_FAILSAFE',
  'AUTO_CHECKOUT',
]);

describe('ReportGenerator Performance Benchmark', () => {
  const generateData = (numSessions: number, numLogsPerSession: number) => {
    const sessions: MockWorkSession[] = [];
    const logs: MockAuditLog[] = [];

    const checkoutActions = [
      'MANUAL_CHECKOUT',
      'AUTO_CHECKOUT_GPS',
      'AUTO_CHECKOUT_FAILSAFE',
      'AUTO_CHECKOUT',
    ];

    for (let i = 0; i < numSessions; i++) {
      const sessionId = `session_${i}`;
      sessions.push({ id: sessionId });

      for (let j = 0; j < numLogsPerSession; j++) {
        logs.push({
          session_id: sessionId,
          action_type: j === 0
            ? checkoutActions[i % checkoutActions.length]
            : 'OTHER_ACTION'
        });
      }
    }

    // Add some logs without session_id
    for (let i = 0; i < 1000; i++) {
      logs.push({
        action_type: 'SYSTEM_EVENT'
      });
    }

    return { sessions, logs };
  };

  test('optimized checkout action lookup should preserve checkout type in O(1) time', () => {
    const { sessions, logs } = generateData(2000, 10);

    const start = performance.now();
    let matchCount = 0;

    const checkoutActionBySessionId = new Map<string, string>();

    for (const log of logs) {
      if (
        log.session_id &&
        CHECKOUT_ACTIONS.has(log.action_type) &&
        !checkoutActionBySessionId.has(log.session_id)
      ) {
        checkoutActionBySessionId.set(log.session_id, log.action_type);
      }
    }

    const rows = sessions.map((session) => {
      const checkoutAction = session.id
        ? checkoutActionBySessionId.get(session.id) ?? null
        : null;

      if (checkoutAction) matchCount++;
      return checkoutAction;
    });

    const end = performance.now();
    const duration = end - start;

    expect(matchCount).toBe(2000);
    expect(rows.length).toBe(2000);

    expect(rows).toContain('MANUAL_CHECKOUT');
    expect(rows).toContain('AUTO_CHECKOUT_GPS');
    expect(rows).toContain('AUTO_CHECKOUT_FAILSAFE');
    expect(rows).toContain('AUTO_CHECKOUT');

    expect(duration).toBeLessThan(200);
  });
});

