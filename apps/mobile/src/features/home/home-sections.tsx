import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';


import { colors, radii, spacing } from '@/theme/tokens';
import { mediaUrl, useBanners, useHomeMedia, useNotices, type Banner, type MediaItem } from './queries';
import { useUi } from '@/stores/ui';

/** Open an external link. YouTube (and any https link) goes through the OS so
 *  the right APP opens — MIUI's browser mishandles the in-app custom tab that
 *  WebBrowser uses, which left video taps doing nothing. Scheme-less pastes
 *  from the admin ("www.youtube.com/…") are normalised too. */
export function openExternal(url: string): void {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(href).catch(() =>
    WebBrowser.openBrowserAsync(href).catch(() => {}),
  );
}

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
      openExternal(notice.action_target);
    }
  };

  // amber gradient alert banner — deliberately prominent (Omar, 12 Jul 2026)
  return (
    <Pressable
      style={({ pressed }) => [styles.notice, pressed && styles.pressed]}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Notice: ${notice.message}`}
    >
      <LinearGradient
        colors={['#F9A825', '#F57C00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.noticeIcon}>
        <MaterialCommunityIcons
          name={(notice.icon as 'car') || 'alert-circle-outline'}
          size={19}
          color="#E65100"
        />
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

/** youtu.be/xyz | youtube.com/watch?v=xyz -> video id (null for other URLs) */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{6,})/);
  return m?.[1] ?? null;
}

function BannerCard({ banner, width, index }: { banner: Banner; width: number; index: number }) {
  const router = useRouter();
  const open = () => {
    if (banner.video_url) {
      openExternal(banner.video_url);
    } else if (banner.action_type === 'screen' && banner.action_target) {
      router.push(banner.action_target as never);
    } else if (banner.action_type === 'url' && banner.action_target) {
      openExternal(banner.action_target);
    }
  };

  // VIDEO banner: YouTube thumbnail (or poster image) + play button
  if (banner.video_url) {
    const yt = youtubeId(banner.video_url);
    const thumb = banner.image_path
      ? mediaUrl(banner.image_path)
      : yt
        ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg`
        : null;
    return (
      <Pressable
        style={[styles.banner, styles.mediaBanner, { width }]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={banner.title ? `Play video: ${banner.title}` : 'Play video'}
      >
        {thumb ? (
          <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={['#1B1B1B', '#444']} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.playScrim}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
          </View>
          {banner.title ? (
            <Text style={styles.mediaCaption} numberOfLines={1}>
              {banner.title}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // POSTER banner: the uploaded image IS the content (e.g. event posters)
  if (banner.image_path) {
    return (
      <Pressable
        style={[styles.banner, styles.mediaBanner, { width }]}
        onPress={open}
        accessibilityLabel={banner.title || 'Announcement poster'}
      >
        <Image
          source={mediaUrl(banner.image_path)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Pressable>
    );
  }

  // TEXT banner: prototype gradient card
  const theme = bannerTheme(banner, index);
  return (
    <Pressable style={[styles.banner, { width }]} onPress={open}>
      <LinearGradient
        colors={BANNER_GRADIENTS[theme] ?? BANNER_GRADIENTS.sponsor!}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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

/* ---------- Photos & videos strip (admin "Home Media", below banners) ---------- */

function MediaCard({ item, onOpenPhoto }: { item: MediaItem; onOpenPhoto: () => void }) {
  const yt = item.video_url ? youtubeId(item.video_url) : null;
  const thumb = item.storage_path
    ? mediaUrl(item.storage_path)
    : yt
      ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg`
      : null;
  const open = () => {
    // videos play in the YouTube app / player; photos open in-app
    if (item.video_url) openExternal(item.video_url);
    else if (item.storage_path) onOpenPhoto();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.mediaCard, pressed && styles.pressed]}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={item.caption || (item.video_url ? 'Play video' : 'View photo')}
    >
      {thumb ? (
        <Image source={thumb} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={['#1B1B1B', '#444']} style={StyleSheet.absoluteFill} />
      )}
      {item.video_url ? (
        <View style={styles.mediaPlayBadge}>
          <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      ) : null}
      {item.caption ? (
        <View style={styles.mediaCaptionBar}>
          <Text style={styles.mediaCaptionText} numberOfLines={1}>
            {item.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function MediaStrip() {
  const media = useHomeMedia();
  const { width } = useWindowDimensions();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (!media.data || media.data.length === 0) return null;

  // photos open in the in-app viewer; swiping pages through photos only
  const photos = media.data.filter((m) => !m.video_url && m.storage_path);

  return (
    <View style={styles.mediaSection}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={media.data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            onOpenPhoto={() => setViewerIndex(Math.max(0, photos.findIndex((p) => p.id === item.id)))}
          />
        )}
      />

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerBackdrop}>
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={photos}
            keyExtractor={(m) => m.id}
            initialScrollIndex={viewerIndex ?? 0}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => (
              <View style={{ width, flex: 1, justifyContent: 'center' }}>
                <Image
                  source={mediaUrl(item.storage_path!)}
                  style={styles.viewerImage}
                  contentFit="contain"
                />
                {item.caption ? <Text style={styles.viewerCaption}>{item.caption}</Text> : null}
              </View>
            )}
          />
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerIndex(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  mediaSection: { marginTop: spacing.md, marginBottom: spacing.sm },
  mediaCard: {
    width: 190,
    height: 116,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  mediaPlayBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCaptionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaCaptionText: { color: '#fff', fontSize: 11.5, fontWeight: '600' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerImage: { width: '100%', height: '78%' },
  viewerCaption: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  // poster/video banners: taller media card, image is the content
  mediaBanner: { height: 220, backgroundColor: '#1B1B1B' },
  playScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(230,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCaption: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
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
