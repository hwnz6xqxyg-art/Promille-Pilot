import React from 'react';
import { View, Text, FlatList, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDrinksStore } from '@/state/drinksStore';
import { DrinkListItem } from '@/components/DrinkListItem';
import { PrimaryButton } from '@/components/PrimaryButton';
import { currentLocale } from '@/i18n';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function LogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const drinks = useDrinksStore((s) => s.drinks);
  const removeDrink = useDrinksStore((s) => s.removeDrink);
  const resetSession = useDrinksStore((s) => s.resetSession);
  const locale = currentLocale();

  // Neueste zuerst.
  const ordered = [...drinks].sort((a, b) => b.timestamp - a.timestamp);

  function confirmReset() {
    Alert.alert(t('log.resetConfirmTitle'), t('log.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => resetSession() },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={ordered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('log.empty')}</Text>}
        renderItem={({ item }) => (
          <DrinkListItem drink={item} locale={locale} onDelete={() => removeDrink(item.id)} />
        )}
      />
      <View style={styles.footer}>
        <PrimaryButton title={t('log.addDrink')} onPress={() => router.push('/add-drink')} />
        {drinks.length > 0 ? (
          <PrimaryButton title={t('log.resetSession')} variant="secondary" onPress={confirmReset} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.xxl },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
