import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

const ACTIONS = [
  { label: 'Donate', icon: 'hand-heart' as const, color: '#914BA1', route: '/donate' },
  { label: 'Events', icon: 'calendar-month' as const, color: '#2980B9', route: '/events' },
  { label: 'Qibla', icon: 'compass' as const, color: '#159778', route: '/qibla' },
  { label: 'Timetable', icon: 'clock-outline' as const, color: '#E67E22', route: '/prayer-times' },
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
  const { dismissedNoticeIds, dismissNotice } = useUi();

  const notice = (notices.data ?? []).find((n) => !dismissedNoticeIds.includes(n.id));
  if (!notice) return null;

  const open = () => {
    if (notice.action_type === 'screen' && notice.action_target) {
      router.push(notice.action_target.replace('/more', '') as never);
    } else if (notice.action_type === 'url' && notice.action_target) {
      WebBrowser.openBrowserAsync(notice.action_target);
    }
  };

  return (
    <Pressable style={({ pressed }) => [styles.notice, pressed && styles.pressed]} onPress={open}>
      <MaterialCommunityIcons name="car" size={16} color={colors.primaryPressed} />
      <Text style={styles.noticeText} numberOfLines={2}>
        {notice.message}
      </Text>
      <Pressable hitSlop={8} onPress={() => dismissNotice(notice.id)} accessibilityLabel="Dismiss notice">
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

/* ---------- Banner carousel (prototype .banners-section) ---------- */

function BannerCard({ banner, width }: { banner: Banner; width: number }) {
  const router = useRouter();
  const open = () => {
    if (banner.action_type === 'screen' && banner.action_target) {
      router.push(banner.action_target as never);
    } else if (banner.action_type === 'url' && banner.action_target) {
      WebBrowser.openBrowserAsync(banner.action_target);
    }
  };
  return (
    <Pressable style={[styles.banner, { width }]} onPress={open}>
      {banner.image_path && (
        <Image source={mediaUrl(banner.image_path)} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.bannerOverlay}>
        {banner.badge ? (
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
          </View>
        ) : null}
        <Text style={styles.bannerTitle}>{banner.title}</Text>
        {banner.subtitle ? <Text style={styles.bannerSub}>{banner.subtitle}</Text> : null}
        {banner.action_type !== 'none' && (
          <Text style={styles.bannerCta}>
            Learn more <Ionicons name="arrow-forward" size={12} color="#fff" />
          </Text>
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
        renderItem={({ item }) => <BannerCard banner={item} width={cardWidth} />}
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
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.text },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF6E5',
    borderColor: '#F2D8A7',
    borderWidth: 1,
    borderRadius: radii.input,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  noticeText: { flex: 1, fontSize: 12.5, color: colors.text, fontWeight: '600' },

  banner: {
    height: 140,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.primaryPressed,
    marginTop: spacing.lg,
  },
  bannerOverlay: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  bannerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bannerTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  bannerCta: { color: '#fff', fontSize: 12.5, fontWeight: '700', marginTop: 10 },
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
