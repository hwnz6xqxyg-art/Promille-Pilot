import React from 'react';
import { View, Text, Pressable, Alert, ScrollView, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '@/state/profileStore';
import { useDrinksStore } from '@/state/drinksStore';
import i18n, { setLanguage } from '@/i18n';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const resetAll = useProfileStore((s) => s.resetAll);
  const resetSession = useDrinksStore((s) => s.resetSession);
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de';

  function confirmResetAll() {
    Alert.alert(t('settings.resetAllConfirmTitle'), t('settings.resetAllConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          resetSession();
          resetAll();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Row label={t('settings.editProfile')} onPress={() => router.push('/onboarding/profile')} />
      <Row label={t('settings.methodology')} onPress={() => router.push('/methodology')} />
      <Row label={t('settings.privacy')} onPress={() => router.push('/privacy')} />

      <View style={styles.group}>
        <Text style={typography.label}>{t('settings.language')}</Text>
        <View style={styles.segment}>
          <LangOption label="Deutsch" active={lang === 'de'} onPress={() => setLanguage('de')} />
          <LangOption label="English" active={lang === 'en'} onPress={() => setLanguage('en')} />
        </View>
      </View>

      <Row label={t('settings.resetAll')} danger onPress={confirmResetAll} />

      <Text style={styles.version}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
      </Text>
      <Text style={styles.legal}>{t('legal.notMedical')}</Text>
    </ScrollView>
  );
}

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowText, danger && { color: colors.danger }]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function LangOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.langOption, active && styles.langOptionActive]}>
      <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.bg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  rowText: { ...typography.body, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 22 },
  group: { gap: spacing.sm, marginTop: spacing.sm },
  segment: { flexDirection: 'row', gap: spacing.sm },
  langOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  langOptionActive: { borderColor: colors.primary, backgroundColor: 'rgba(76,141,255,0.15)' },
  langText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  langTextActive: { color: colors.text },
  version: { ...typography.caption, textAlign: 'center', marginTop: spacing.lg },
  legal: { ...typography.caption, textAlign: 'center' },
});
