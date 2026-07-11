import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import Stack from 'expo-router/stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { useAppConfig } from '@/features/prayer-times/config';
import { colors, radii, spacing } from '@/theme/tokens';

/** Name + address is geocoded by Google at click time — always the right pin,
 *  unlike hand-entered coordinates. */
export const DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=' +
  encodeURIComponent('Wembley Central Masjid, 35-37 Ealing Road, Wembley HA0 4AE');

export default function AboutScreen() {
  const config = useAppConfig();
  const contact = config.data?.contact as { address?: string } | undefined;
  const charityNo = typeof config.data?.charity_number === 'string' ? config.data.charity_number : '285630';

  return (
    <>
      <Stack.Screen options={{ title: 'About' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/brand/mark-white.png')}
            style={styles.heroMark}
            contentFit="contain"
          />
          <Text style={styles.heroTitle}>Wembley Central Masjid</Text>
          <Text style={styles.heroSub}>Registered Charity No. {charityNo}</Text>
        </View>

        <SectionCard>
          <Text style={styles.body}>
            Wembley Central Masjid is unique in that along with providing a beautiful sanctuary for
            worship, it also incorporates an educational institute. The Masjid serves as a community
            center for residents while the Madrassah offers beginner through advanced classes in
            various Islamic sciences.
          </Text>
        </SectionCard>

        <SectionCard>
          <CardTitle>Our Aspiration</CardTitle>
          <Text style={styles.body}>
            The time has come to raise up a new wave of learned Muslims who have been born, bred,
            and educated at home. Wembley Central Masjid aspires to prepare these future leaders to
            take on the challenges for generations to come.
          </Text>
        </SectionCard>

        <SectionCard>
          <CardTitle>Address</CardTitle>
          <Text style={styles.body}>{contact?.address ?? '35-37 Ealing Road, Wembley, Middlesex, HA0 4AE'}</Text>
          <Pressable style={styles.button} onPress={() => Linking.openURL(DIRECTIONS_URL)}>
            <MaterialCommunityIcons name="directions" size={16} color={colors.textOnPrimary} />
            <Text style={styles.buttonText}> Get Directions</Text>
          </Pressable>
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  hero: { backgroundColor: colors.primary, alignItems: 'center', padding: spacing.xl },
  heroMark: { width: 110, height: 58 },
  heroTitle: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  heroSub: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 2 },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
});
