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

/** Prototype header: logo icon + logotype, centred (index.html .header-title).
 *  Mark is a crisp crop of the high-res brand file (header-mark.png). */
function BrandHeaderTitle() {
  return (
    <View style={headerStyles.wrap}>
      <Image
        source={require('../../../assets/brand/header-mark.png')}
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
  // prototype .app-header: 56px bar, 40px mark; wordmark optically centred
  // on the skyline's building mass (its centre of gravity sits low because
  // of the thin minaret at the top)
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 11, height: 56 },
  icon: { width: 87, height: 46 },
  // wordmark midline dropped to the WCM-block row of the skyline
  text: { width: 216, height: 16.5, transform: [{ translateY: 7 }] },
});

export default function TabLayout() {
  return (
    <Tabs
      // prototype: the brand header is persistent across ALL tabs; screen
      // titles (.screen-title-bar) live inside each screen's content
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerStyle: { backgroundColor: colors.cardBackground },
        headerTitle: () => <BrandHeaderTitle />,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.screenBackground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Wembley Central Masjid', tabBarLabel: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Upcoming Events', tabBarLabel: 'Events', tabBarIcon: tabIcon('calendar') }}
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
