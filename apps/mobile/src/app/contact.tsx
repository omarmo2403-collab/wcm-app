import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Stack from 'expo-router/stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppConfig } from '@/features/prayer-times/config';
import { colors, radii, spacing } from '@/theme/tokens';

export default function ContactScreen() {
  const config = useAppConfig();
  const contact = config.data?.contact as
    | { phone?: string; email?: string; address?: string }
    | undefined;

  const rows = [
    {
      icon: 'call' as const,
      label: 'Phone',
      value: contact?.phone ?? '020 8900 9673',
      action: () => Linking.openURL(`tel:${(contact?.phone ?? '02089009673').replace(/\s/g, '')}`),
    },
    {
      icon: 'mail' as const,
      label: 'Email',
      value: contact?.email ?? 'wembleycentralmasjid@gmail.com',
      action: () => Linking.openURL(`mailto:${contact?.email ?? 'wembleycentralmasjid@gmail.com'}`),
    },
    {
      icon: 'location' as const,
      label: 'Address',
      value: contact?.address ?? '35-37 Ealing Road, Wembley, Middlesex, HA0 4AE',
      action: () =>
        Linking.openURL('https://www.google.com/maps/search/?api=1&query=Wembley+Central+Masjid'),
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Contact Us' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {rows.map((r) => (
          <Pressable
            key={r.label}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={r.action}
            accessibilityLabel={`${r.label}: ${r.value}`}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={r.icon} size={20} color={colors.textOnPrimary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value}>{r.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  pressed: { opacity: 0.85 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  value: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
