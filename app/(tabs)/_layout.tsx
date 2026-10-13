import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Glyph, GlyphName } from '../../src/components/glyph';
import { colors, fonts } from '../../src/components/theme';
import { AuthButtons } from '../../src/components/auth-buttons';
import { isDemo, useBackend, useSnapshot } from '../../src/data/provider';
import { transition } from '../../src/components/motion';

import { useResponsiveLayout } from '../../src/components/responsive';

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
  const { wide } = useResponsiveLayout();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: wide ? 32 : 16,
        right: wide ? 32 : 16,
        bottom: wide ? Math.max(insets.bottom, 16) : Math.max(insets.bottom - 8, 16) + 10,
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
      {wide && (
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 24,
            color: colors.white,
            paddingHorizontal: 20,
            flex: 1,
          }}
        >
          Swipe4Change
        </Text>
      )}
      {state.routes.map((route, i) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const on = state.index === i;
        return (
          <Animated.View
            key={route.key}
            style={[
              {
                flex: wide ? undefined : on ? 2.1 : 1,
                width: wide ? (route.name === 'communities' ? 154 : 116) : undefined,
                height: 52,
                minWidth: 0,
              },
              transition(['flex'], 450),
            ]}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={wide && route.name === 'communities' ? 'Communities' : tab.label}
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
                      fontSize: 13,
                      color: on ? colors.dark : colors.tabIdle,
                      maxWidth: wide || on ? 110 : 0,
                      opacity: wide || on ? 1 : 0,
                    },
                    transition(['maxWidth', 'opacity'], 450),
                  ]}
                >
                  {wide && route.name === 'communities' ? 'Communities' : tab.label}
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
  const { sessionKey } = useBackend();
  const q = useSnapshot();
  const insets = useSafeAreaInsets();
  const guest = isDemo ? !q.data?.profile : sessionKey === 'guest';
  return (
    <View style={{ flex: 1 }}>
      {guest && (
        <View
          style={{
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 12,
            paddingHorizontal: 20,
            backgroundColor: colors.canvas,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 1164,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 21, color: colors.ink }}>
              Swipe4Change
            </Text>
            <AuthButtons />
          </View>
        </View>
      )}
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: {
            backgroundColor: colors.canvas,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
        <Tabs.Screen name="create" options={{ title: 'Create' }} />
        <Tabs.Screen name="communities" options={{ title: 'Communities' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </View>
  );
}
