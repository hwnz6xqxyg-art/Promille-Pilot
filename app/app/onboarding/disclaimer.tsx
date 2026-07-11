import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '@/state/profileStore';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function Disclaimer() {
  const { t } = useTranslation();
  const router = useRouter();
  const acceptDisclaimer = useProfileStore((s) => s.acceptDisclaimer);

  function accept() {
    acceptDisclaimer(Date.now());
    router.replace('/onboarding/age-gate');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.warn}>⚠️</Text>
        <Text style={[typography.title, styles.title]}>{t('disclaimer.title')}</Text>
        <Text style={styles.body}>{t('disclaimer.body')}</Text>
        <Text style={styles.legal}>{t('legal.notMedical')}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton title={t('disclaimer.accept')} onPress={accept} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  warn: { fontSize: 48, textAlign: 'center' },
  title: { textAlign: 'center' },
  body: { ...typography.body, lineHeight: 24, color: colors.text },
  legal: { ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
  footer: { padding: spacing.lg },
});
