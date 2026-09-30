import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui';

export function AuthButtons() {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button title="Log in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} />
      <Button
        title="Sign up"
        onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } })}
      />
    </View>
  );
}
