import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useProfileStore } from '@/state/profileStore';
import { colors } from '@/theme/colors';

/** Einstiegs-Route: entscheidet je nach Onboarding-Flags, wohin es geht. */
export default function Index() {
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const disclaimerAcceptedAt = useProfileStore((s) => s.disclaimerAcceptedAt);
  const ageConfirmed = useProfileStore((s) => s.ageConfirmed);
  const profileComplete = useProfileStore((s) => s.profileComplete);

  if (!hasHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!disclaimerAcceptedAt) return <Redirect href="/onboarding/disclaimer" />;
  if (!ageConfirmed) return <Redirect href="/onboarding/age-gate" />;
  if (!profileComplete) return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
