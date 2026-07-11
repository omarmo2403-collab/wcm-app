import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenTitle } from '@/components/ui/section-card';
import { colors, radii, spacing } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

// mirrors prototype #screen-more list exactly (order and items);
// Stadium info stays reachable via the home notice strip
const ITEMS: { icon: IconName; label: string; slug: string }[] = [
  { icon: 'business-outline', label: 'About the Masjid', slug: 'about' },
  { icon: 'newspaper-outline', label: 'Latest News', slug: 'news' },
  { icon: 'compass-outline', label: 'Qibla Direction', slug: 'qibla' },
  { icon: 'call-outline', label: 'Contact Us', slug: 'contact' },
  { icon: 'notifications-outline', label: 'Notifications', slug: 'notifications' },
  { icon: 'ribbon-outline', label: 'Our Services', slug: 'services' },
  { icon: 'videocam-outline', label: '360° Virtual Tour', slug: 'tour' },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle>More</ScreenTitle>
      <View style={styles.menu}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.slug}
            style={({ pressed }) => [
              styles.item,
              i < ITEMS.length - 1 && styles.itemBorder,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              const routes: Record<string, string> = {
                notifications: '/notification-settings',
                about: '/about',
                news: '/news',
                qibla: '/qibla',
                contact: '/contact',
                services: '/services',
              };
              const route = routes[item.slug];
              if (route) router.push(route as never);
              else router.push({ pathname: '/coming-soon', params: { title: item.label } });
            }}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={17} color={colors.primary} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg, paddingTop: spacing.sm },
  menu: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#EFF0F5' },
  // prototype .more-item icon: 36px pale mint square, radius 10
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(21,151,120,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  pressed: { backgroundColor: colors.screenBackground },
});
