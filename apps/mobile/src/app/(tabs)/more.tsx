import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { icon: IconName; label: string; slug: string }[] = [
  { icon: 'business-outline', label: 'About the Masjid', slug: 'about' },
  { icon: 'newspaper-outline', label: 'Latest News', slug: 'news' },
  { icon: 'compass-outline', label: 'Qibla Direction', slug: 'qibla' },
  { icon: 'call-outline', label: 'Contact Us', slug: 'contact' },
  { icon: 'notifications-outline', label: 'Notifications', slug: 'notifications' },
  { icon: 'ribbon-outline', label: 'Our Services', slug: 'services' },
  { icon: 'videocam-outline', label: '360° Virtual Tour', slug: 'tour' },
  { icon: 'car-outline', label: 'Stadium Event Days', slug: 'stadium' },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
                stadium: '/stadium',
              };
              const route = routes[item.slug];
              if (route) router.push(route as never);
              else router.push({ pathname: '/coming-soon', params: { title: item.label } });
            }}
          >
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  menu: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  pressed: { backgroundColor: colors.screenBackground },
});
