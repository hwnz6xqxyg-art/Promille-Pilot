/** Zeit-Formatierung und -Helfer. */
import { MS_PER_HOUR, MS_PER_MINUTE } from '@/engine/constants';

/** "20:45" */
export function formatClock(ms: number, locale = 'de-DE'): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** "Sa, 20:45" */
export function formatDayTime(ms: number, locale = 'de-DE'): string {
  return new Date(ms).toLocaleString(locale, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Dauer als "2 h 15 min" / "45 min". Negative Werte werden auf 0 geklammert.
 */
export function formatDuration(ms: number, labels = { h: 'h', min: 'min' }): string {
  const clamped = Math.max(0, ms);
  const totalMin = Math.round(clamped / MS_PER_MINUTE);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h <= 0) return `${min} ${labels.min}`;
  if (min === 0) return `${h} ${labels.h}`;
  return `${h} ${labels.h} ${min} ${labels.min}`;
}

export { MS_PER_HOUR, MS_PER_MINUTE };
