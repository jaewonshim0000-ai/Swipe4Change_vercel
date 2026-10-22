import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { PlusJakartaSans_400Regular_Italic } from '@expo-google-fonts/plus-jakarta-sans/400Regular_Italic';
import { PlusJakartaSans_800ExtraBold_Italic } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold_Italic';
import { useEffect, useRef } from 'react';
import { Providers, useSnapshot } from '../src/data/provider';
import { colors } from '../src/components/theme';
import { ToastHost, toast } from '../src/components/kit';

/**
 * Good news (a badge, a signature milestone) also pops up the moment it lands, not only in
 * Notifications. Whatever was already there when the account loaded stays in the inbox.
 */
function NewsToasts() {
  const q = useSnapshot();
  const seen = useRef<{ profile: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const profile = q.data?.profile?.id;
    const list = q.data?.notifications ?? [];
    if (!profile) return;
    const known = seen.current;
    if (known?.profile !== profile) {
      seen.current = { profile, ids: new Set(list.map((n) => n.id)) };
      return;
    }
    const fresh = list.filter((n) => !known.ids.has(n.id));
    fresh.forEach((n) => known.ids.add(n.id));
    const news = fresh.find((n) => n.kind === 'badge' || n.kind === 'milestone');
    if (news) toast(news.body);
  }, [q.data]);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular_Italic,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_800ExtraBold_Italic,
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading Swipe4Change" />
      </View>
    );
  return (
    <Providers>
      <StatusBar style="dark" />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: Platform.OS === 'web' ? undefined : 480,
            overflow: 'hidden',
          }}
        >
          {/* Screens run their own entrance animations from the design (slide or fade). */}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'none',
              contentStyle: { backgroundColor: colors.canvas },
            }}
          />
          <ToastHost />
          <NewsToasts />
        </View>
      </View>
    </Providers>
  );
}
