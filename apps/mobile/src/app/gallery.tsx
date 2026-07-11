import { Image } from 'expo-image';
import Stack from 'expo-router/stack';
import { FlatList, StyleSheet, useWindowDimensions } from 'react-native';

import { mediaUrl, useGallery } from '@/features/home/queries';
import { colors, radii, spacing } from '@/theme/tokens';

export default function GalleryScreen() {
  const gallery = useGallery();
  const { width } = useWindowDimensions();
  const size = (width - spacing.lg * 2 - spacing.md) / 2;

  return (
    <>
      <Stack.Screen options={{ title: 'Gallery' }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        columnWrapperStyle={{ gap: spacing.md }}
        numColumns={2}
        data={gallery.data ?? []}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Image
            source={mediaUrl(item.storage_path)}
            style={[styles.photo, { width: size, height: size * 0.75 }]}
            contentFit="cover"
            accessibilityLabel={item.caption ?? 'Masjid photo'}
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg, gap: spacing.md },
  photo: { borderRadius: radii.card },
});
