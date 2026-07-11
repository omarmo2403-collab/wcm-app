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

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/theme/tokens';
import { mediaUrl, useBanners, useGallery, useNotices, type Banner } from './queries';
import { useUi } from '@/stores/ui';

/* ---------- Quick actions (prototype .quick-actions) ---------- */

// three actions — Timetable removed (the widget's monthly button sits just above)
const ACTIONS = [
  { label: 'Donate', icon: 'hand-heart' as const, color: '#914BA1', route: '/donate' },
  { label: 'Events', icon: 'calendar-month' as const, color: '#159778', route: '/events' },
  { label: 'Qibla', icon: 'compass' as const, color: '#2980B9', route: '/qibla' },
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

  // amber gradient alert banner — deliberately prominent (Omar, 12 Jul 2026)
  return (
    <Pressable style={({ pressed }) => [styles.notice, pressed && styles.pressed]} onPress={open}>
      <LinearGradient
        colors={['#F9A825', '#F57C00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.noticeIcon}>
        <MaterialCommunityIcons name="car" size={19} color="#E65100" />
      </View>
      <View style={styles.noticeBody}>
        <Text style={styles.noticeLabel}>NOTICE</Text>
        <Text style={styles.noticeText} numberOfLines={2}>
          {notice.message}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </Pressable>
  );
}

/* ---------- Latest news strip (admin News section -> Home) ---------- */

const newsPreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  published_at: z.string().nullable(),
});

function useLatestNews() {
  return useQuery({
    queryKey: ['news_latest'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('id,title,body,published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      return data.map((r) => newsPreviewSchema.parse(r));
    },
  });
}

export function NewsStrip() {
  const news = useLatestNews();
  const router = useRouter();
  if (!news.data || news.data.length === 0) return null;

  return (
    <View style={styles.newsSection}>
      <View style={styles.newsHeader}>
        <Text style={styles.newsHeading}>Latest News</Text>
        <Pressable onPress={() => router.push('/news' as never)} accessibilityLabel="All news">
          <Text style={styles.newsSeeAll}>
            See All <Ionicons name="chevron-forward" size={12} color={colors.primary} />
          </Text>
        </Pressable>
      </View>
      {news.data.map((n) => (
        <Pressable
          key={n.id}
          style={({ pressed }) => [styles.newsCard, pressed && styles.pressed]}
          onPress={() => router.push('/news' as never)}
        >
          <View style={styles.newsIcon}>
            <Ionicons name="newspaper" size={16} color={colors.primary} />
          </View>
          <View style={styles.newsInfo}>
            <Text style={styles.newsTitle} numberOfLines={1}>
              {n.title}
            </Text>
            <Text style={styles.newsBody} numberOfLines={2}>
              {n.body}
            </Text>
            {n.published_at ? (
              <Text style={styles.newsDate}>
                {new Date(n.published_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'Europe/London',
                })}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- Banner carousel (prototype .banners-section) ---------- */

// prototype gradients: .banner-sponsor / .banner-events / .banner-madrasah / .banner-scholar
const BANNER_GRADIENTS: Record<string, [string, string, string]> = {
  sponsor: ['#1B5E20', '#2E7D32', '#159778'],
  events: ['#0D47A1', '#1565C0', '#1976D2'],
  madrasah: ['#4A148C', '#6A1B9A', '#914BA1'],
};
const CTA_LABELS: Record<string, string> = {
  sponsor: 'Donate Now',
  events: 'View Events',
  madrasah: 'Learn More',
};
function bannerTheme(banner: Banner, index: number): string {
  const t = (banner.action_target ?? '').toLowerCase();
  if (t.includes('donate')) return 'sponsor';
  if (t.includes('madrasah')) return 'madrasah';
  if (t.includes('event')) return 'events';
  return ['sponsor', 'madrasah', 'events'][index % 3] as string;
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
    justifyContent: 'space-evenly',
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

  // amber gradient alert banner: white icon chip, NOTICE label, white text
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: '#E65100',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBody: { flex: 1 },
  noticeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
  },
  noticeText: { fontSize: 13.5, fontWeight: '700', color: '#fff', marginTop: 1, lineHeight: 18 },

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

  newsSection: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  newsHeading: { fontSize: 17, fontWeight: '700', color: colors.text },
  newsSeeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  newsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: 12,
    marginBottom: spacing.sm,
  },
  newsIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(21,151,120,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsInfo: { flex: 1 },
  newsTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  newsBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 1 },
  newsDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

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
