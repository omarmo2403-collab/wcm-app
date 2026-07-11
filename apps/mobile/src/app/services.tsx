import { MaterialCommunityIcons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/theme/tokens';

const serviceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
});

const ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  heart: 'heart',
  'hand-holding-usd': 'hand-coin',
  moon: 'moon-waning-crescent',
  'door-open': 'door-open',
  school: 'school',
};

function useServices() {
  return useQuery({
    queryKey: ['services'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id,title,description,icon')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => serviceSchema.parse(r));
    },
  });
}

export default function ServicesScreen() {
  const services = useServices();
  return (
    <>
      <Stack.Screen options={{ title: 'Our Services' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {services.isPending && <ActivityIndicator color={colors.primary} />}
        <View style={styles.grid}>
          {services.data?.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons
                  name={ICON[s.icon] ?? 'star'}
                  size={24}
                  color={colors.textOnPrimary}
                />
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.desc}>{s.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '47.5%',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
