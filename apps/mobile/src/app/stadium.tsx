import { MaterialCommunityIcons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { useEvents } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

export default function StadiumScreen() {
  const events = useEvents();
  const stadiumDays = (events.data ?? []).filter((e) => e.category === 'stadium');

  return (
    <>
      <Stack.Screen options={{ title: 'Stadium Event Days' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="soccer" size={42} color={colors.textOnPrimary} />
          <Text style={styles.heroTitle}>Wembley Stadium Event Days</Text>
          <Text style={styles.heroSub}>Parking information for Masjid visitors</Text>
        </View>

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
                  <View key={e.id} style={styles.dateChip}>
                    <Text style={styles.dateDay}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateFull}>
                      {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
            <Text style={styles.bold}>Use public transport</Text> where possible. Wembley Central
            station is a short walk away.{'\n\n'}
            <Text style={styles.bold}>Parking restrictions</Text> are enforced on surrounding
            streets. Check signage before parking.{'\n\n'}
            <Text style={styles.bold}>Allow extra time</Text> — roads around Ealing Road get very
            busy.
          </Text>
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  hero: { backgroundColor: '#0D47A1', alignItems: 'center', padding: spacing.xl },
  heroTitle: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },
  heroSub: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 2 },
  body: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 },
  bold: { fontWeight: '700', color: colors.text },
  datesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateChip: {
    backgroundColor: colors.screenBackground,
    borderRadius: radii.input,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dateDay: { fontSize: 12, color: colors.textSecondary },
  dateFull: { fontSize: 14, fontWeight: '700', color: colors.text },
});
