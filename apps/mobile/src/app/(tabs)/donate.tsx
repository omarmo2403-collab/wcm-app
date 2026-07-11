import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDonationCategories, type DonationCategory } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

/** prototype icon slugs → MaterialCommunityIcons */
const ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'balance-scale': 'scale-balance',
  heart: 'heart',
  star: 'star',
  mosque: 'mosque',
};

function DonateCard({ category }: { category: DonationCategory }) {
  const sponsor = category.slug === 'sponsor';
  return (
    <Pressable
      style={({ pressed }) => [styles.card, sponsor && styles.sponsorCard, pressed && styles.pressed]}
      onPress={() => WebBrowser.openBrowserAsync(category.url)}
    >
      <View style={[styles.cardIcon, sponsor && styles.sponsorIcon]}>
        <MaterialCommunityIcons
          name={ICON[category.icon] ?? 'heart'}
          size={22}
          color={colors.textOnPrimary}
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{category.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {category.slug === 'sponsor'
            ? 'Just 30p a day. Become one of 1,000 sponsors.'
            : category.description}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export default function DonateScreen() {
  const categories = useDonationCategories();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="hand-heart" size={30} color={colors.textOnPrimary} />
        </View>
        <Text style={styles.headerTitle}>Support Your Masjid</Text>
        <Text style={styles.headerSub}>
          Your generosity keeps the Masjid running and supports the community
        </Text>
      </View>

      {categories.isPending && <ActivityIndicator color={colors.primary} />}
      {categories.data?.map((c) => <DonateCard key={c.id} category={c} />)}

      <Text style={styles.secureNote}>
        Donations are completed securely on the Masjid&apos;s website.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  pressed: { opacity: 0.85 },

  header: { alignItems: 'center', paddingVertical: spacing.lg },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  headerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
    lineHeight: 18,
  },

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
  sponsorCard: { borderWidth: 1, borderColor: colors.accent },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorIcon: { backgroundColor: colors.accent },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

  secureNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
