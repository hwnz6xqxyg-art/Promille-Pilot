import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { DRINK_PRESETS, DrinkPreset } from '@/presets/drinkPresets';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  selectedKey?: string;
  onSelect: (preset: DrinkPreset) => void;
}

export function PresetPicker({ selectedKey, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {DRINK_PRESETS.map((p) => {
        const active = p.key === selectedKey;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(p)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={styles.emoji}>{p.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{p.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 84,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(76,141,255,0.15)' },
  emoji: { fontSize: 22 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  labelActive: { color: colors.text },
});
