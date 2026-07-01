// src/feedback/feedbackAnalytics.ts
import { LogCategory, LogSeverity } from '../types';
import { log } from '../utils/logger';

export interface FeedbackEvent {
  timestamp: number;
  kind: 'toast' | 'dialog';
  tone: 'success' | 'error' | 'info';
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  wasThrottled: boolean;
  wasDeduped: boolean;
  displayDurationMs?: number;
}

const feedbackEvents: FeedbackEvent[] = [];

export const recordFeedbackEvent = (event: FeedbackEvent) => {
  feedbackEvents.push(event);

  if (feedbackEvents.length > 1000) {
    feedbackEvents.shift();
  }

  if (feedbackEvents.length % 50 === 0) {
    const stats = getFeedbackStats();
    log('AZUL', 'ESTADO_SISTEMA', 'DEBUG', `Feedback stats: ${JSON.stringify(stats)}`);
  }
};

export const getFeedbackStats = () => {
  const stats = {
    totalFeedback: feedbackEvents.length,
    byKind: { toast: 0, dialog: 0 },
    byTone: { success: 0, error: 0, info: 0 },
    byCategory: {} as Record<string, number>,
    throttledCount: 0,
    dedupedCount: 0,
  };

  for (const event of feedbackEvents) {
    stats.byKind[event.kind]++;
    stats.byTone[event.tone]++;
    stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
    if (event.wasThrottled) stats.throttledCount++;
    if (event.wasDeduped) stats.dedupedCount++;
  }

  return stats;
};
