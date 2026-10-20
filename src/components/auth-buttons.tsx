import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui';
import { colors } from './theme';

/** Log in and Sign up; `dark` for the desktop sidebar. */
export function AuthButtons({ dark = false }: { dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button
        title="Log in"
        variant="ghost"
        onPress={() => router.push('/(auth)/sign-in')}
        style={dark ? { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' } : undefined}
        color={dark ? colors.white : undefined}
      />
      <Button
        title="Sign up"
        variant={dark ? 'pale' : 'primary'}
        onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } })}
        style={dark ? { flex: 1 } : undefined}
      />
    </View>
  );
}
