import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '@/state/profileStore';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function AgeGate() {
  const { t } = useTranslation();
  const router = useRouter();
  const confirmAge = useProfileStore((s) => s.confirmAge);

  function confirm() {
    confirmAge();
    router.replace('/onboarding/profile');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔞</Text>
        <Text style={[typography.title, styles.title]}>{t('ageGate.title')}</Text>
        <Text style={styles.body}>{t('ageGate.body')}</Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title={t('ageGate.confirm')} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 56 },
  title: { textAlign: 'center' },
  body: { ...typography.bodyMuted, textAlign: 'center' },
  footer: { padding: spacing.lg },
});
