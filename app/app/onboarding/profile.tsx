import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '@/state/profileStore';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { parseDecimal } from '@/utils/number';
import { BETA_CONSERVATIVE, LIMIT_GENERAL, LIMIT_RELATIVE, LIMIT_NOVICE } from '@/engine/constants';
import type { Sex } from '@/engine/bac';

const LIMIT_OPTIONS = [LIMIT_NOVICE, LIMIT_RELATIVE, LIMIT_GENERAL];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const completeProfile = useProfileStore((s) => s.completeProfile);

  const [weight, setWeight] = useState(String(profile.weightKg ?? 80));
  const [height, setHeight] = useState(String(profile.heightCm ?? 180));
  const [age, setAge] = useState(profile.ageYears ? String(profile.ageYears) : '');
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [isNovice, setIsNovice] = useState(profile.isNovice);
  const [limit, setLimit] = useState<number>(profile.targetLimitPromille);

  const weightNum = parseDecimal(weight);
  const heightNum = parseDecimal(height);
  const valid = weightNum != null && weightNum > 0 && heightNum != null && heightNum > 0;
  const effectiveLimit = isNovice ? LIMIT_NOVICE : limit;

  function save() {
    if (!valid) return;
    const ageNum = parseDecimal(age);
    setProfile({
      weightKg: weightNum as number,
      heightCm: heightNum as number,
      ageYears: ageNum != null && ageNum > 0 ? ageNum : undefined,
      sex,
      isNovice,
      targetLimitPromille: effectiveLimit,
      distributionMode: 'seidl',
      eliminationRate: BETA_CONSERVATIVE,
    });
    completeProfile();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.title}>{t('profile.title')}</Text>
        <Text style={typography.bodyMuted}>{t('profile.subtitle')}</Text>

        <Field label={t('profile.weight')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix={t('units.kg')} />
        <Field label={t('profile.height')} value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix={t('units.cm')} />
        <Field label={t('profile.age')} value={age} onChangeText={setAge} keyboardType="number-pad" suffix={t('units.years')} />

        <View style={styles.group}>
          <Text style={typography.label}>{t('profile.sex')}</Text>
          <View style={styles.segment}>
            <SegOption label={t('profile.male')} active={sex === 'male'} onPress={() => setSex('male')} />
            <SegOption label={t('profile.female')} active={sex === 'female'} onPress={() => setSex('female')} />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={typography.body}>{t('profile.novice')}</Text>
            {isNovice ? <Text style={styles.hint}>{t('profile.noviceHint')}</Text> : null}
          </View>
          <Switch
            value={isNovice}
            onValueChange={setIsNovice}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <View style={styles.group}>
          <Text style={typography.label}>{t('profile.targetLimit')}</Text>
          <View style={styles.segment}>
            {LIMIT_OPTIONS.map((opt) => (
              <SegOption
                key={opt}
                label={opt === 0 ? t('profile.limit00') : opt === 0.3 ? t('profile.limit03') : t('profile.limit05')}
                active={effectiveLimit === opt}
                disabled={isNovice && opt !== 0}
                onPress={() => setLimit(opt)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t('profile.limitHint')}</Text>
        </View>

        <PrimaryButton title={t('profile.saveProfile')} onPress={save} disabled={!valid} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SegOption({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.segOption, active && styles.segOptionActive, disabled && styles.segOptionDisabled]}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  group: { gap: spacing.sm },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  segOptionActive: { borderColor: colors.primary, backgroundColor: 'rgba(76,141,255,0.15)' },
  segOptionDisabled: { opacity: 0.35 },
  segText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  segTextActive: { color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchLabel: { flex: 1, gap: 2 },
  hint: { ...typography.caption, color: colors.textMuted },
});
