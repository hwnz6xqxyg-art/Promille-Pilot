import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

/** Schmales, dauerhaftes Sicherheits-Banner (nie ausblendbar). */
export function DisclaimerBanner() {
  const { t } = useTranslation();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{t('dashboard.disclaimerShort')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(227,179,65,0.12)',
    borderColor: 'rgba(227,179,65,0.35)',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icon: { fontSize: 14 },
  text: { flex: 1, color: colors.caution, fontSize: 13, fontWeight: '600' },
});
