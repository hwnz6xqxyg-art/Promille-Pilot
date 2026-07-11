import React, { useState } from 'react';
import { View, Text, Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Field } from './Field';
import { PresetPicker } from './PresetPicker';
import { PrimaryButton } from './PrimaryButton';
import type { DrinkInput } from '@/state/drinksStore';
import type { DrinkPreset } from '@/presets/drinkPresets';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { parseDecimal } from '@/utils/number';
import { formatClock } from '@/utils/time';

interface Props {
  initial?: Partial<DrinkInput>;
  submitLabel: string;
  locale?: string;
  onSubmit: (input: DrinkInput) => void;
}

export function DrinkForm({ initial, submitLabel, locale = 'de-DE', onSubmit }: Props) {
  const { t } = useTranslation();
  const [volume, setVolume] = useState(initial?.volumeMl ? String(initial.volumeMl) : '500');
  const [abv, setAbv] = useState(initial?.abvPercent != null ? String(initial.abvPercent) : '5');
  const [label, setLabel] = useState<string | undefined>(initial?.label);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<Date>(initial?.timestamp ? new Date(initial.timestamp) : new Date());
  const [showPicker, setShowPicker] = useState(false);

  const volNum = parseDecimal(volume);
  const abvNum = parseDecimal(abv);
  const valid = volNum != null && volNum > 0 && abvNum != null && abvNum >= 0 && abvNum <= 100;

  function applyPreset(p: DrinkPreset) {
    setSelectedKey(p.key);
    setLabel(p.name);
    setVolume(String(p.volumeMl));
    setAbv(String(p.abvPercent));
  }

  function onTimeChange(_e: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (!selected) return;
    // Auf "heute" mit gewählter Uhrzeit; liegt das in der Zukunft, war es gestern.
    let ts = selected.getTime();
    if (ts > Date.now() + 60_000) ts -= 24 * 60 * 60 * 1000;
    setDate(new Date(ts));
  }

  function submit() {
    if (!valid) return;
    onSubmit({
      volumeMl: volNum as number,
      abvPercent: abvNum as number,
      timestamp: date.getTime(),
      label,
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={typography.label}>{t('addDrink.presets')}</Text>
      <PresetPicker selectedKey={selectedKey} onSelect={applyPreset} />

      <Field
        label={t('addDrink.volume')}
        value={volume}
        onChangeText={(v) => {
          setVolume(v);
          setSelectedKey(undefined);
        }}
        keyboardType="decimal-pad"
        suffix="ml"
      />
      <Field
        label={t('addDrink.abv')}
        value={abv}
        onChangeText={(v) => {
          setAbv(v);
          setSelectedKey(undefined);
        }}
        keyboardType="decimal-pad"
        suffix="%"
      />

      <View style={styles.timeRow}>
        <Text style={typography.label}>{t('addDrink.time')}</Text>
        <View style={styles.timeControls}>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={date}
              mode="time"
              display="compact"
              onChange={onTimeChange}
              themeVariant="dark"
            />
          ) : (
            <Pressable style={styles.timeButton} onPress={() => setShowPicker(true)}>
              <Text style={styles.timeButtonText}>{formatClock(date.getTime(), locale)}</Text>
            </Pressable>
          )}
          <Pressable style={styles.nowButton} onPress={() => setDate(new Date())}>
            <Text style={styles.nowButtonText}>{t('addDrink.now')}</Text>
          </Pressable>
        </View>
      </View>
      {showPicker && Platform.OS !== 'ios' ? (
        <DateTimePicker value={date} mode="time" display="default" onChange={onTimeChange} />
      ) : null}

      <PrimaryButton title={submitLabel} onPress={submit} disabled={!valid} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  timeRow: { gap: spacing.xs },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  timeButtonText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  nowButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(76,141,255,0.15)',
  },
  nowButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
