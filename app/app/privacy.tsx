import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('privacy.title'), headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      <Text style={styles.body}>{t('privacy.body')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
  body: { ...typography.body, lineHeight: 24 },
});
