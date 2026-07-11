import * as Linking from 'expo-linking';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMadrasahClasses } from '@/features/content/queries';
import { useAppConfig } from '@/features/prayer-times/config';
import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { colors, radii, spacing } from '@/theme/tokens';

export default function MadrasahScreen() {
  const classes = useMadrasahClasses();
  const config = useAppConfig();
  const contact = config.data?.contact as { phone?: string } | undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionCard style={styles.first}>
        <Text style={styles.intro}>
          Wembley Central Masjid Madrassah offers beginner through advanced classes in various
          Islamic sciences.
        </Text>
      </SectionCard>

      <SectionCard>
        <CardTitle>Class Schedule</CardTitle>
        {classes.isPending && <ActivityIndicator color={colors.primary} />}
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cellName, styles.headText]}>Class</Text>
          <Text style={[styles.cell, styles.headText]}>Days</Text>
          <Text style={[styles.cellWide, styles.headText]}>Time</Text>
        </View>
        {classes.data?.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={styles.cellName}>{c.name}</Text>
            <Text style={styles.cell}>{c.days}</Text>
            <Text style={styles.cellWide}>{c.time_range}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard>
        <CardTitle>Enrolment</CardTitle>
        <Text style={styles.body}>
          New admissions are open. Please visit the Masjid office or contact us to register your
          child.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => contact?.phone && Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)}
        >
          <Text style={styles.buttonText}>Contact Us</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  first: { marginTop: spacing.lg },
  intro: { fontSize: 14, color: colors.text, lineHeight: 21 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },

  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headRow: { borderBottomWidth: 1 },
  headText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  cellName: { flex: 1.4, fontSize: 13, color: colors.text, fontWeight: '600' },
  cell: { flex: 1, fontSize: 13, color: colors.textSecondary },
  cellWide: { flex: 1.3, fontSize: 13, color: colors.textSecondary },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.85 },
});
