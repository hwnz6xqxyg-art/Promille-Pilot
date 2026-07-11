import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ThresholdForecast } from '@/engine/bac';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatPromille } from '@/utils/format';
import { formatClock, formatDuration } from '@/utils/time';

interface Props {
  forecasts: ThresholdForecast[];
  hasDrinks: boolean;
  now: number;
  locale?: string;
}

/**
 * Zeigt für mehrere Grenzwerte gleichzeitig, ab wann man darunter liegt
 * ("unter 0,5 ‰ ab HH:MM · in Xh Ymin"). Bewusst vorsichtig – nie "du darfst fahren".
 */
export function ForecastCard({ forecasts, hasDrinks, now, locale = 'de-DE' }: Props) {
  const { t } = useTranslation();

  if (!hasDrinks) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>{t('dashboard.noForecast')}</Text>
        <Text style={styles.advice}>{t('dashboard.driveNeverAdvice')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('dashboard.thresholdTitle')}</Text>
      {forecasts.map((f) => (
        <View key={f.limit} style={styles.row}>
          <Text style={styles.rowLimit}>{t('dashboard.belowAt', { limit: formatPromille(f.limit, locale) })}</Text>
          {f.alreadyBelow ? (
            <Text style={styles.reached}>✓ {t('dashboard.thresholdReached')}</Text>
          ) : f.time != null ? (
            <Text style={styles.rowValue}>
              <Text style={styles.time}>{formatClock(f.time, locale)}</Text>
              <Text style={styles.dur}>
                {'  · ' + t('dashboard.soberInLabel', { duration: formatDuration(f.time - now, { h: t('units.h'), min: t('units.min') }) })}
              </Text>
            </Text>
          ) : (
            <Text style={styles.dash}>{t('dashboard.thresholdRising')}</Text>
          )}
        </View>
      ))}
      <Text style={styles.advice}>{t('dashboard.driveNeverAdvice')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  rowLimit: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  time: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dur: { color: colors.textMuted, fontSize: 13 },
  reached: { color: colors.safe, fontSize: 15, fontWeight: '700' },
  dash: { color: colors.textMuted, fontSize: 16 },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  advice: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm, lineHeight: 17 },
});
