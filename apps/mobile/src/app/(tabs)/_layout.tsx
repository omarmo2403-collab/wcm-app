import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerStyle: { backgroundColor: colors.cardBackground },
        headerTitleStyle: { color: colors.primary, fontWeight: '700' },
        headerShadowVisible: true,
        sceneStyle: { backgroundColor: colors.screenBackground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wembley Central Masjid',
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="donate"
        options={{ title: 'Donate', tabBarIcon: tabIcon('heart') }}
      />
      <Tabs.Screen
        name="madrasah"
        options={{ title: 'Madrasah', tabBarIcon: tabIcon('book') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal') }}
      />
    </Tabs>
  );
}
