import { MaterialCommunityIcons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { ScreenTitle } from '@/components/ui/section-card';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/theme/tokens';

const serviceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  body: z.string(),
});

const ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  heart: 'heart',
  'hand-holding-usd': 'hand-coin',
  moon: 'moon-waning-crescent',
  'door-open': 'door-open',
  school: 'school',
};

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id,title,description,icon,body')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => serviceSchema.parse(r));
    },
  });
}

export default function ServicesScreen() {
  const services = useServices();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Services' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle>Our Services</ScreenTitle>
        {services.isPending && <ActivityIndicator color={colors.primary} />}
        <View style={styles.grid}>
          {services.data?.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => s.body && router.push(`/service/${s.id}` as never)}
              accessibilityLabel={`${s.title} — details`}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons
                  name={ICON[s.icon] ?? 'star'}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.desc}>{s.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  pressed: { opacity: 0.8 },
  content: { padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // prototype .service-card: cream tile; .service-icon: pale mint square
  card: {
    width: '47.5%',
    backgroundColor: '#FCF7EE',
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(21,151,120,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
