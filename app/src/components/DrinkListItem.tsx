import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Drink } from '@/engine/bac';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatAbv, formatVolume } from '@/utils/format';
import { formatClock } from '@/utils/time';

interface Props {
  drink: Drink;
  locale?: string;
  onPress?: () => void;
  onDelete: () => void;
}

export function DrinkListItem({ drink, locale = 'de-DE', onPress, onDelete }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.left}>
        <Text style={styles.title}>{drink.label ?? formatVolume(drink.volumeMl, locale)}</Text>
        <Text style={styles.sub}>
          {formatVolume(drink.volumeMl, locale)} · {formatAbv(drink.abvPercent, locale)} ·{' '}
          {t('log.atTime', { time: formatClock(drink.timestamp, locale) })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
        onPress={onDelete}
        hitSlop={8}
        style={styles.delete}
      >
        <Text style={styles.deleteText}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  left: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 13 },
  delete: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  deleteText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
});
