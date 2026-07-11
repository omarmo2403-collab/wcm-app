import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

/** Prototype header: logo icon + logotype, centred (index.html .header-title) */
function BrandHeaderTitle() {
  return (
    <View style={headerStyles.wrap}>
      <Image
        source={require('../../../assets/brand/logo-icon.svg')}
        style={headerStyles.icon}
        contentFit="contain"
      />
      <Image
        source={require('../../../assets/brand/logo-text.svg')}
        style={headerStyles.text}
        contentFit="contain"
      />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 40, height: 40 },
  text: { width: 170, height: 13 },
});

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
          headerTitle: () => <BrandHeaderTitle />,
          headerTitleAlign: 'center',
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
