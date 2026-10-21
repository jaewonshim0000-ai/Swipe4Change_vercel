import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, router } from 'expo-router';
import { Glyph, GlyphName } from '../../src/components/glyph';
import { blur, colors, fonts, shadows } from '../../src/components/theme';
import { AuthButtons } from '../../src/components/auth-buttons';
import { Wordmark } from '../../src/components/wordmark';
import { Initials, Press, initialsOf } from '../../src/components/kit';
import { isDemo, useBackend, useSnapshot } from '../../src/data/provider';
import { transition } from '../../src/components/motion';
import { useResponsiveLayout } from '../../src/components/responsive';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
const tabs: Record<string, { label: string; long?: string; icon: GlyphName }> = {
  index: { label: 'Home', icon: 'cards' },
  explore: { label: 'Explore', icon: 'compass' },
  create: { label: 'Create', icon: 'write' },
  communities: { label: 'Groups', long: 'Communities', icon: 'users' },
  profile: { label: 'Profile', icon: 'user' },
};
/** Below this width a desktop window gets the icon rail instead of the full sidebar. */
const RAIL = 1100;

function useGuest() {
  const { sessionKey } = useBackend();
  const q = useSnapshot();
  return { guest: isDemo ? !q.data?.profile : sessionKey === 'guest', profile: q.data?.profile };
}

/** Phones and tablets: the design's floating dark bar, icon over label, equal widths. */
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          width: '100%',
          maxWidth: 560,
          paddingHorizontal: 12,
          bottom: 12 + insets.bottom,
        },
      ]}
    >
      <View
        style={[
          {
            height: 68,
            borderRadius: 999,
            padding: 6,
            flexDirection: 'row',
            gap: 2,
            backgroundColor: colors.bar,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          },
          blur(20),
          shadows.float,
        ]}
      >
        {state.routes.map((route, i) => {
          const tab = tabs[route.name];
          if (!tab) return null;
          const on = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.long ?? tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!on && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              {({ pressed }) => (
                <Animated.View
                  style={[
                    {
                      flex: 1,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      backgroundColor: on
                        ? 'rgba(255,255,255,0.1)'
                        : pressed
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255,255,255,0)',
                    },
                    transition(['backgroundColor'], 200),
                  ]}
                >
                  <Glyph
                    name={tab.icon}
                    size={24}
                    weight={on ? 2.4 : 2}
                    color={on ? colors.pale : colors.tabIdle}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 12,
                      color: on ? colors.white : colors.tabIdle,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Animated.View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Desktop browsers: the design's dark sidebar, or an icon rail in narrow windows. */
function Sidebar({ state, navigation }: TabBarProps) {
  const { width } = useWindowDimensions();
  const { guest, profile } = useGuest();
  const rail = width < RAIL;
  const go = (name: string, focused: boolean) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name);
  };
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: rail ? 88 : 248,
        paddingVertical: rail ? 20 : 24,
        paddingHorizontal: rail ? 8 : 16,
        gap: 4,
        alignItems: rail ? 'center' : 'stretch',
        backgroundColor: colors.dark,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: rail ? 0 : 8,
          paddingBottom: rail ? 20 : 24,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: colors.pale,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="cards" size={20} weight={2.4} color={colors.dark} />
        </View>
        {!rail && <Wordmark size={18} color={colors.white} />}
      </View>
      {state.routes.map((route, i) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const on = state.index === i;
        const label = tab.long ?? tab.label;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => go(route.name, on)}
          >
            {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
              <Animated.View
                style={[
                  {
                    flexDirection: rail ? 'column' : 'row',
                    alignItems: 'center',
                    justifyContent: rail ? 'center' : 'flex-start',
                    gap: rail ? 4 : 14,
                    width: rail ? 72 : undefined,
                    height: rail ? 60 : 48,
                    paddingHorizontal: rail ? 0 : 14,
                    borderRadius: 14,
                    backgroundColor: on
                      ? 'rgba(255,255,255,0.1)'
                      : hovered || pressed
                        ? 'rgba(255,255,255,0.06)'
                        : 'transparent',
                  },
                  transition(['backgroundColor'], 150),
                ]}
              >
                <Glyph
                  name={tab.icon}
                  size={22}
                  weight={on ? 2.3 : 2}
                  color={on ? colors.pale : hovered ? colors.white : colors.onDark}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: rail ? 11 : 16,
                    color: on || hovered ? colors.white : colors.onDark,
                  }}
                >
                  {rail && label === 'Communities' ? tab.label : label}
                </Text>
              </Animated.View>
            )}
          </Pressable>
        );
      })}
      <Press
        accessibilityLabel="Start a petition"
        onPress={() => go('create', state.routes[state.index]?.name === 'create')}
        style={{
          marginTop: 20,
          alignSelf: rail ? 'center' : 'stretch',
          width: rail ? 56 : undefined,
          height: 56,
          borderRadius: 18,
          backgroundColor: colors.pale,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Glyph name="sparkle" size={20} weight={2} color={colors.dark} />
        {!rail && (
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dark }}>
            Start a petition
          </Text>
        )}
      </Press>
      <View style={{ marginTop: 'auto', alignSelf: 'stretch' }}>
        {guest || !profile ? (
          rail ? (
            <Press
              accessibilityLabel="Log in"
              onPress={() => router.push('/(auth)/sign-in')}
              style={{
                alignSelf: 'center',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="user" size={22} color={colors.white} />
            </Press>
          ) : (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.onDark,
                  paddingHorizontal: 8,
                }}
              >
                Sign in to sign, save and start petitions.
              </Text>
              <AuthButtons dark />
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            onPress={() => go('profile', state.routes[state.index]?.name === 'profile')}
          >
            {({ hovered }: { hovered?: boolean; pressed: boolean }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: rail ? 'center' : 'flex-start',
                  gap: 12,
                  padding: rail ? 6 : 10,
                  borderRadius: 16,
                  backgroundColor: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <Initials text={initialsOf(profile.name)} uri={profile.avatar} size={40} />
                {!rail && (
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}
                    >
                      {profile.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.body, fontSize: 12, color: colors.onDark }}
                    >
                      {profile.city || 'Choose your city'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function Layout() {
  const insets = useSafeAreaInsets();
  const { wide } = useResponsiveLayout();
  const { guest } = useGuest();
  return (
    <View style={{ flex: 1 }}>
      {/* Phones and tablets show sign-in on top; desktop keeps it in the sidebar. */}
      {guest && !wide && (
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
            <Wordmark size={20} />
            <AuthButtons />
          </View>
        </View>
      )}
      <Tabs
        tabBar={(props) => (wide ? <Sidebar {...props} /> : <TabBar {...props} />)}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarPosition: wide ? 'left' : 'bottom',
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
