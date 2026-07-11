import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatPromille } from '@/utils/format';

interface Props {
  bac: number;
  limit: number;
  locale?: string;
}

/** Großer, live aktualisierter Promille-Wert mit Statusfarbe. */
export function BacGauge({ bac, limit, locale = 'de-DE' }: Props) {
  const { t } = useTranslation();
  const over = bac > limit + 1e-6;
  const statusColor = over ? colors.danger : bac > 1e-6 ? colors.caution : colors.safe;

  return (
    <View style={[styles.card, { borderColor: statusColor }]}>
      <Text style={styles.caption}>{t('dashboard.estimatedNow')}</Text>
      <Text style={[styles.value, { color: statusColor }]} accessibilityLabel={formatPromille(bac, locale)}>
        {formatPromille(bac, locale)}
      </Text>
      <View style={[styles.badge, { backgroundColor: over ? 'rgba(248,81,73,0.15)' : 'rgba(63,185,80,0.15)' }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>
          {over ? t('dashboard.aboveLimit') : t('dashboard.belowLimit')}
        </Text>
      </View>
      <Text style={styles.limit}>
        {t('dashboard.limitLabel', { limit: formatPromille(limit, locale) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  caption: { color: colors.textMuted, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 60, fontWeight: '800', letterSpacing: -1 },
  badge: { borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  badgeText: { fontSize: 14, fontWeight: '700' },
  limit: { color: colors.textMuted, fontSize: 14 },
});
