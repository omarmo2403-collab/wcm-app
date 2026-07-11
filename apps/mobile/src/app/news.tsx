import Stack from 'expo-router/stack';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/theme/tokens';

const newsSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  published_at: z.string().nullable(),
});

function useNews() {
  return useQuery({
    queryKey: ['news'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('id,title,body,published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data.map((r) => newsSchema.parse(r));
    },
  });
}

export default function NewsScreen() {
  const news = useNews();
  return (
    <>
      <Stack.Screen options={{ title: 'Latest News' }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={news.data ?? []}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          news.isPending ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : news.isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Couldn&apos;t load news</Text>
              <Text style={styles.emptyText}>Check your connection and pull to refresh.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No news yet</Text>
              <Text style={styles.emptyText}>Updates from the Masjid will appear here.</Text>
            </View>
          )
        }
        refreshing={news.isRefetching}
        onRefresh={() => news.refetch()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            {item.published_at && (
              <Text style={styles.date}>
                {new Date(item.published_at).toLocaleDateString('en-GB', {
                  timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            )}
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: spacing.xs },
  date: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
