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

        {/* the masjid building — same photo as the website's About page */}
        <Image
          source={require('../../assets/images/masjid-photo.jpeg')}
          style={styles.masjidPhoto}
          contentFit="cover"
          accessibilityLabel="Wembley Central Masjid building on Ealing Road"
        />

        {/* copy from wembleycentralmasjid.co.uk/about-us/ */}
        <SectionCard>
          <CardTitle>Our History</CardTitle>
          <Text style={styles.body}>
            Wembley Central Masjid was initiated by the elders of our community in the early 1980s,
            who shared a concern and commitment for the spiritual and educative needs of local
            Muslims. The committee purchased its first site on Harrowdene Road in 1985 — a
            three-storey house with space for 400 worshippers that faithfully served the growing
            community for eight years.
            {'\n\n'}
            The current building — an old church built in 1904 to the design of Thomas Collcutt and
            Stanley Hemp, and listed Grade II in 1993 — was purchased and lovingly restored by the
            community, with an ablution area, tearoom and library added. After a fire damaged the
            Masjid hall in 2003, the community rallied to fund a £500,000 rebuild within two years,
            adding a new first floor. With the new extension in place, the Masjid can now
            accommodate 1,250 worshippers.
          </Text>
        </SectionCard>

        <SectionCard>
          <CardTitle>Our Vision</CardTitle>
          <Text style={styles.body}>
            The vision of Wembley Central Masjid is to preserve, implement, and disseminate Islamic
            knowledge, as well as nurturing and preparing our future leaders through sound,
            traditional understanding and learning. The Masjid is unique in that along with
            providing a beautiful sanctuary for worship, it also incorporates an educational
            institute — serving as a community centre while the Madrassah offers beginner through
            advanced classes in various Islamic sciences. We are grateful to Allah to have a number
            of young, British-born, qualified Islamic scholars on our staff.
          </Text>
        </SectionCard>

        <SectionCard>
          <CardTitle>Our Aspiration</CardTitle>
          <Text style={styles.body}>
            The time has come to raise up a new wave of learned Muslims who have been born, bred,
            and educated at home — a wave that will duly fill the sacred posts of Imams and
            Scholars, and address the Islamic legal and social challenges unique to this land.
            Wembley Central Masjid aspires to prepare these future leaders for generations to come.
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
  masjidPhoto: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 200,
    borderRadius: radii.card,
    backgroundColor: colors.border,
  },
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
