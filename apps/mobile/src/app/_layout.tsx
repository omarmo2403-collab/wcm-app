import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { AppErrorBoundary } from '@/components/error-boundary';
import { NotificationSync } from '@/features/notifications/notification-sync';
import { initSentry } from '@/lib/sentry';
import { colors } from '@/theme/tokens';

// crash reporting first — everything after this is covered
initSentry();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } },
});

export default function RootLayout() {
  // Splash is held by preventAutoHideAsync above; release it once the root
  // tree has mounted — nothing async gates first render.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // React Query's focus refetching is a no-op on native unless focusManager
  // is fed AppState — without this, tab screens that stay mounted (expo-router
  // keeps them alive) would show stale content for the app's whole lifetime.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotificationSync />
        {/* dark icons: every header in the app is white */}
        <StatusBar style="dark" />
      {/* prototype sub-screen header: white bar, green 15px title, dark arrow */}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cardBackground },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 15, color: colors.primary },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          // iOS labels the back button with the previous route's title, which
          // for the tab group is the raw folder name "(tabs)" — chevron only
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.screenBackground },
        }}
      >
        {/* title covers iOS's back-button long-press menu (never rendered as a header) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        </Stack>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
