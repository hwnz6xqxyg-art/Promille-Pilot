import React from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDrinksStore } from '@/state/drinksStore';
import { DrinkForm } from '@/components/DrinkForm';
import { currentLocale } from '@/i18n';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export default function AddDrink() {
  const { t } = useTranslation();
  const router = useRouter();
  const addDrink = useDrinksStore((s) => s.addDrink);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('addDrink.titleAdd'), headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DrinkForm
          submitLabel={t('addDrink.save')}
          locale={currentLocale()}
          onSubmit={(input) => {
            addDrink(input);
            router.back();
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
});
