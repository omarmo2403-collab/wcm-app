import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Stack from 'expo-router/stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { useEvents } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

/** "12" -> "12th", "1" -> "1st" (prototype date format: "12th April") */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? 'th'}`;
}

export default function StadiumScreen() {
  const events = useEvents();
  const stadiumDays = (events.data ?? []).filter((e) => e.category === 'stadium');

  return (
    <>
      <Stack.Screen options={{ title: 'Stadium Event Days' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* prototype .stadium-header: blue gradient, centred, football icon */}
        <LinearGradient
          colors={['#0D47A1', '#1565C0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <MaterialCommunityIcons name="soccer" size={42} color={colors.textOnPrimary} />
          <Text style={styles.heroTitle}>Wembley Stadium Event Days</Text>
          <Text style={styles.heroSub}>Parking information for Masjid visitors</Text>
        </LinearGradient>

        <SectionCard>
          <CardTitle>Parking Notice</CardTitle>
          <Text style={styles.body}>
            On Wembley Stadium event days, there are significant parking restrictions and increased
            traffic around the Masjid. Please plan your journey in advance and consider using public
            transport where possible.
          </Text>
        </SectionCard>

        <SectionCard>
          <CardTitle>Upcoming Event Days</CardTitle>
          {stadiumDays.length === 0 ? (
            <Text style={styles.body}>No stadium event days are currently listed.</Text>
          ) : (
            <View style={styles.datesWrap}>
              {stadiumDays.map((e) => {
                const d = new Date(e.starts_at);
                return (
                  <View key={e.id} style={styles.dateRow}>
                    <Text style={styles.dateDay}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateFull}>
                      {ordinal(d.getDate())} {d.toLocaleDateString('en-GB', { month: 'long' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard>
          <CardTitle>Tips</CardTitle>
          <Text style={styles.body}>
            <Text style={styles.bold}>Arrive early</Text> to secure parking near the Masjid.{'\n\n'}
            <Text style={styles.bold}>Use public transport</Text> where possible. Wembley Park
            station is a short walk away.{'\n\n'}
            <Text style={styles.bold}>Parking restrictions</Text> are enforced on surrounding
            streets. Check signage before parking.{'\n\n'}
            <Text style={styles.bold}>Allow extra time</Text> for your journey as roads around
            Ealing Road get very busy.
          </Text>
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  hero: { alignItems: 'center', padding: 24 },
  heroTitle: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  heroSub: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 6 },
  body: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 21 },
  bold: { fontWeight: '700', color: colors.text },

  // prototype .stadium-date rows: grey bg, weekday green, full date dark
  datesWrap: { gap: 6 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF0F5',
    borderRadius: radii.input,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateDay: { fontSize: 12, fontWeight: '700', color: colors.primary, minWidth: 30 },
  dateFull: { fontSize: 14, fontWeight: '500', color: colors.text },
});
