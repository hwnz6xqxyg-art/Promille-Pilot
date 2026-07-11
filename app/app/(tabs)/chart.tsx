import React from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrinksStore } from '@/state/drinksStore';
import { useProfileStore } from '@/state/profileStore';
import { useNow } from '@/state/useNow';
import { simulate, applicableLimit } from '@/engine/bac';
import { BacChart } from '@/components/BacChart';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { currentLocale } from '@/i18n';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function ChartScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const now = useNow();
  const drinks = useDrinksStore((s) => s.drinks);
  const profile = useProfileStore((s) => s.profile);
  const locale = currentLocale();

  const limit = applicableLimit(profile);
  const sim = simulate(drinks, profile);
  const chartWidth = width - spacing.lg * 2;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DisclaimerBanner />
      {sim.points.length < 2 ? (
        <Text style={styles.empty}>{t('chart.empty')}</Text>
      ) : (
        <View style={styles.card}>
          <BacChart
            points={sim.points}
            limit={limit}
            now={now}
            peakBac={sim.peakBac}
            width={chartWidth}
            height={260}
            locale={locale}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  empty: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.xxl },
});
