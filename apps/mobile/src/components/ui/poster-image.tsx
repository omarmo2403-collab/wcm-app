import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import type { StyleProp } from 'react-native';

/**
 * Poster-aware image: measures the source once loaded and renders at its
 * real aspect ratio, so portrait event posters aren't chopped to a fixed
 * height. `minRatio` caps how tall a card may grow in list contexts
 * (e.g. 0.72 ≈ A4 portrait); pass 0 to always show the full image.
 */
export function PosterImage({
  uri,
  minRatio = 0,
  style,
  label,
}: {
  uri: string;
  minRatio?: number;
  style?: StyleProp<ImageStyle>;
  label?: string;
}) {
  const [ratio, setRatio] = useState(16 / 9);
  return (
    <Image
      source={uri}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) setRatio(width / height);
      }}
      style={[{ width: '100%', aspectRatio: Math.max(ratio, minRatio) }, style]}
      contentFit="cover"
      accessibilityLabel={label}
    />
  );
}
