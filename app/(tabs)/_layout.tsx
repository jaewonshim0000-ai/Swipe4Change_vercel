import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Glyph, GlyphName } from '../../src/components/glyph';
import { colors, fonts } from '../../src/components/theme';
import { transition } from '../../src/components/motion';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
const tabs: Record<string, { label: string; icon: GlyphName }> = {
  index: { label: 'Home', icon: 'home' },
  explore: { label: 'Explore', icon: 'explore' },
  create: { label: 'Create', icon: 'create' },
  communities: { label: 'Groups', icon: 'communities' },
  profile: { label: 'Profile', icon: 'profile' },
};

/** The design's floating pill: the active tab widens to a white capsule and shows its label. */
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom - 8, 16) + 10,
        height: 66,
        borderRadius: 999,
        padding: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.dark,
        boxShadow: '0px 18px 36px -12px rgba(18,20,15,0.55)',
      }}
    >
      {state.routes.map((route, i) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const on = state.index === i;
        return (
          <Animated.View
            key={route.key}
            style={[{ flex: on ? 2.1 : 1, height: 52, minWidth: 0 }, transition(['flex'], 450)]}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!on && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1 }}
            >
              <Animated.View
                style={[
                  {
                    flex: 1,
                    borderRadius: 999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    overflow: 'hidden',
                    backgroundColor: on ? colors.white : 'rgba(255,255,255,0)',
                  },
                  transition(['backgroundColor'], 300),
                ]}
              >
                <Glyph
                  name={tab.icon}
                  size={tab.icon === 'create' ? 22 : 21}
                  weight={tab.icon === 'create' ? 1.9 : 1.8}
                  color={on ? colors.dark : colors.tabIdle}
                />
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    {
                      fontFamily: fonts.semibold,
                      fontSize: 12.5,
                      color: colors.dark,
                      maxWidth: on ? 90 : 0,
                      opacity: on ? 1 : 0,
                    },
                    transition(['maxWidth', 'opacity'], 450),
                  ]}
                >
                  {tab.label}
                </Animated.Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function Layout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="communities" options={{ title: 'Communities' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
