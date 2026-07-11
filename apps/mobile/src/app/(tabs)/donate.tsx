import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      {/* prototype .donate-card-icon: pale tint square, coloured glyph */}
      <View style={[styles.cardIcon, sponsor && styles.sponsorIcon]}>
        <MaterialCommunityIcons
          name={ICON[category.icon] ?? 'heart'}
          size={20}
          color={sponsor ? '#914BA1' : colors.primary}
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{category.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {category.description}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function DonateScreen() {
  const categories = useDonationCategories();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* prototype .donate-header: purple gradient, white glyph, centred */}
      <LinearGradient
        colors={['#914BA1', '#7B3F91']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <MaterialCommunityIcons name="hand-heart" size={40} color={colors.textOnPrimary} />
        <Text style={styles.headerTitle}>Support Your Masjid</Text>
        <Text style={styles.headerSub}>
          Your generosity keeps the Masjid running and supports the community
        </Text>
      </LinearGradient>

      {categories.isPending && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      {categories.data?.map((c) => <DonateCard key={c.id} category={c} />)}

      <Text style={styles.secureNote}>
        Donations are completed securely on the Masjid&apos;s website.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  pressed: { opacity: 0.85 },
  spinner: { marginTop: spacing.lg },

  header: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textOnPrimary, marginTop: 8 },
  headerSub: {
    fontSize: 13,
    color: colors.textOnPrimary,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
    lineHeight: 18,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: 16,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: 14,
  },
  // prototype .donate-card.sponsor: cream bg + soft cream border
  sponsorCard: { backgroundColor: '#FCF7EE', borderWidth: 1, borderColor: 'rgba(236,216,180,0.7)' },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(21,151,120,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorIcon: { backgroundColor: 'rgba(145,75,161,0.1)' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

  secureNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
