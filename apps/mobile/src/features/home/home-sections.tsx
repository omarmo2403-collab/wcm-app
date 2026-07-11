import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';
import { mediaUrl, useBanners, useGallery, useNotices, type Banner } from './queries';
import { useUi } from '@/stores/ui';

/* ---------- Quick actions (prototype .quick-actions) ---------- */

// prototype: .donate-icon --purple, .events-icon --green, .qibla-icon #2980B9, .scholar-icon #E67E22
const ACTIONS = [
  { label: 'Donate', icon: 'hand-heart' as const, color: '#914BA1', route: '/donate' },
  { label: 'Events', icon: 'calendar-month' as const, color: '#159778', route: '/events' },
  { label: 'Qibla', icon: 'compass' as const, color: '#2980B9', route: '/qibla' },
  { label: 'Scholar', icon: 'help-circle' as const, color: '#E67E22', route: '/ask-scholar' },
];

export function QuickActions() {
  const router = useRouter();
  return (
    <View style={styles.actionsRow}>
      {ACTIONS.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={() => router.push(a.route as never)}
          accessibilityLabel={a.label}
        >
          <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
            <MaterialCommunityIcons name={a.icon} size={22} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- Notice strip (prototype .notice-strip) ---------- */

export function NoticeStrip() {
  const notices = useNotices();
  const router = useRouter();
  const { dismissedNoticeIds } = useUi();

  const notice = (notices.data ?? []).find((n) => !dismissedNoticeIds.includes(n.id));
  if (!notice) return null;

  const open = () => {
    if (notice.action_type === 'screen' && notice.action_target) {
      router.push(notice.action_target.replace('/more', '') as never);
    } else if (notice.action_type === 'url' && notice.action_target) {
      WebBrowser.openBrowserAsync(notice.action_target);
    }
  };

  // prototype .notice-strip: amber left accent + chevron link, no dismiss
  return (
    <Pressable style={({ pressed }) => [styles.notice, pressed && styles.pressed]} onPress={open}>
      <MaterialCommunityIcons name="car" size={16} color="#F9A825" />
      <Text style={styles.noticeText} numberOfLines={2}>
        {notice.message}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

/* ---------- Banner carousel (prototype .banners-section) ---------- */

// prototype gradients: .banner-sponsor / .banner-events / .banner-madrasah / .banner-scholar
const BANNER_GRADIENTS: Record<string, [string, string, string]> = {
  sponsor: ['#1B5E20', '#2E7D32', '#159778'],
  events: ['#0D47A1', '#1565C0', '#1976D2'],
  madrasah: ['#4A148C', '#6A1B9A', '#914BA1'],
  scholar: ['#E65100', '#EF6C00', '#F57C00'],
};
const CTA_LABELS: Record<string, string> = {
  sponsor: 'Donate Now',
  events: 'View Events',
  madrasah: 'Learn More',
  scholar: 'Ask Now',
};
function bannerTheme(banner: Banner, index: number): string {
  const t = (banner.action_target ?? '').toLowerCase();
  if (t.includes('donate')) return 'sponsor';
  if (t.includes('madrasah')) return 'madrasah';
  if (t.includes('scholar')) return 'scholar';
  if (t.includes('event')) return 'events';
  return ['sponsor', 'madrasah', 'scholar'][index % 3] as string;
}

function BannerCard({ banner, width, index }: { banner: Banner; width: number; index: number }) {
  const router = useRouter();
  const open = () => {
    if (banner.action_type === 'screen' && banner.action_target) {
      router.push(banner.action_target as never);
    } else if (banner.action_type === 'url' && banner.action_target) {
      WebBrowser.openBrowserAsync(banner.action_target);
    }
  };
  const theme = bannerTheme(banner, index);
  return (
    <Pressable style={[styles.banner, { width }]} onPress={open}>
      <LinearGradient
        colors={BANNER_GRADIENTS[theme] ?? BANNER_GRADIENTS.sponsor!}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {banner.image_path && (
        <Image source={mediaUrl(banner.image_path)} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.bannerOverlay}>
        {banner.badge ? (
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>{banner.badge.toUpperCase()}</Text>
          </View>
        ) : null}
        <Text style={styles.bannerTitle}>{banner.title}</Text>
        {banner.subtitle ? <Text style={styles.bannerSub}>{banner.subtitle}</Text> : null}
        {banner.action_type !== 'none' && (
          <View style={styles.bannerCtaPill}>
            <Text style={styles.bannerCta}>
              {CTA_LABELS[theme] ?? 'Learn More'} <Ionicons name="arrow-forward" size={11} color="#fff" />
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function BannerCarousel() {
  const banners = useBanners();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const cardWidth = width - spacing.lg * 2;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (typeof first === 'number') setIndex(first);
  });

  if (!banners.data || banners.data.length === 0) return null;

  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={banners.data}
        keyExtractor={(b) => b.id}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        onViewableItemsChanged={onViewable.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => <BannerCard banner={item} width={cardWidth} index={index} />}
      />
      <View style={styles.dots}>
        {banners.data.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/* ---------- Gallery preview (prototype .gallery-section) ---------- */

export function GalleryPreview() {
  const gallery = useGallery();
  const router = useRouter();
  if (!gallery.data || gallery.data.length === 0) return null;

  return (
    <View style={styles.gallerySection}>
      <View style={styles.galleryHeader}>
        <Text style={styles.galleryTitle}>Gallery</Text>
        <Pressable onPress={() => router.push('/gallery' as never)} accessibilityLabel="See all photos">
          <Text style={styles.seeAll}>
            See All <Ionicons name="chevron-forward" size={12} color={colors.primary} />
          </Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={gallery.data}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <Image source={mediaUrl(item.storage_path)} style={styles.galleryPhoto} contentFit="cover" />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  action: { alignItems: 'center', width: 76 },
  // prototype .quick-icon: 48x48, radius 14 (squircle, not circle)
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  actionLabel: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },

  // prototype: #FFF8E1 bg, 3px #F9A825 left border, radius-sm, 12px text
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderLeftColor: '#F9A825',
    borderLeftWidth: 3,
    borderRadius: radii.input,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.text },

  // prototype .banner-img: min-height 160, content bottom-aligned, CTA pill
  banner: {
    minHeight: 160,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  bannerOverlay: { flex: 1, padding: 18, justifyContent: 'flex-end' },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  bannerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 4, marginBottom: 10 },
  bannerCtaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  bannerCta: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },

  gallerySection: { marginTop: spacing.xl, marginBottom: spacing.lg },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  galleryTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  galleryPhoto: { width: 150, height: 110, borderRadius: radii.card },
});
