import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDrinksStore } from '@/state/drinksStore';
import { useProfileStore } from '@/state/profileStore';
import { useNow } from '@/state/useNow';
import { currentBac, forecastThresholds, applicableLimit } from '@/engine/bac';
import { FORECAST_THRESHOLDS } from '@/engine/constants';
import { BacGauge } from '@/components/BacGauge';
import { ForecastCard } from '@/components/ForecastCard';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { currentLocale } from '@/i18n';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const now = useNow();
  const drinks = useDrinksStore((s) => s.drinks);
  const addDrink = useDrinksStore((s) => s.addDrink);
  const profile = useProfileStore((s) => s.profile);

  const locale = currentLocale();
  const limit = applicableLimit(profile);
  const bac = currentBac(drinks, profile, now);
  const forecasts = forecastThresholds(drinks, profile, FORECAST_THRESHOLDS, now);

  function quickBeer() {
    addDrink({ volumeMl: 500, abvPercent: 5, timestamp: Date.now(), label: t('dashboard.quickBeerLabel') });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DisclaimerBanner />
      <BacGauge bac={bac} limit={limit} locale={locale} />
      <ForecastCard forecasts={forecasts} hasDrinks={drinks.length > 0} now={now} locale={locale} />
      <PrimaryButton title={t('dashboard.quickBeer')} onPress={quickBeer} />
      <PrimaryButton title={t('dashboard.addDrink')} variant="secondary" onPress={() => router.push('/add-drink')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
});
