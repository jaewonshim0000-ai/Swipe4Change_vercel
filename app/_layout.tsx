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
import { Providers } from '../src/data/provider';
import { colors } from '../src/components/theme';
import { ToastHost } from '../src/components/kit';

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
        </View>
      </View>
    </Providers>
  );
}
