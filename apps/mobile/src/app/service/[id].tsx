import { MaterialCommunityIcons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/ui/section-card';
import { useServices } from '../services';
import { colors, spacing } from '@/theme/tokens';

const ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  heart: 'heart',
  'hand-holding-usd': 'hand-coin',
  moon: 'moon-waning-crescent',
  'door-open': 'door-open',
  school: 'school',
};

/** Service detail — content mirrors wembleycentralmasjid.co.uk service pages,
 *  editable by staff in the admin Services section. */
export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const services = useServices();
  const service = services.data?.find((s) => s.id === id);

  if (!service) {
    return (
      <>
        <Stack.Screen options={{ title: 'Service' }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Service not found.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: service.title }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <MaterialCommunityIcons
            name={ICON[service.icon] ?? 'star'}
            size={40}
            color={colors.textOnPrimary}
          />
          <Text style={styles.heroTitle}>{service.title}</Text>
          <Text style={styles.heroSub}>{service.description}</Text>
        </View>
        <SectionCard>
          <Text style={styles.body}>{service.body}</Text>
        </SectionCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textSecondary, fontSize: 14 },
  hero: { backgroundColor: colors.primary, alignItems: 'center', padding: 24 },
  heroTitle: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700', marginTop: 8 },
  heroSub: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 4, textAlign: 'center' },
  body: { fontSize: 14, color: colors.text, lineHeight: 22 },
});
