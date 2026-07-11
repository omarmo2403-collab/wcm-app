import { Ionicons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

export default function ComingSoonScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: title ?? 'Coming soon' }} />
      <View style={styles.screen}>
        <Ionicons name="construct-outline" size={44} color={colors.textMuted} />
        <Text style={styles.title}>{title ?? 'This section'}</Text>
        <Text style={styles.text}>is being built and arrives in an upcoming update.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
