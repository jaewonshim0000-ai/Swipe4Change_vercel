import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Notice, colors, fonts } from '../../src/components/ui';
import { ClerkLogin } from '../../src/components/clerk-login';
import { Wordmark, betaNotice } from '../../src/components/wordmark';
import { isDemo, useBackend, useSnapshot } from '../../src/data/provider';
import { useResponsiveLayout } from '../../src/components/responsive';
import { demoIds } from '../../src/data/seed';

export default function Welcome() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { wide } = useResponsiveLayout();
  const signingUp = mode === 'sign-up';
  const { adapter } = useBackend();
  const client = useQueryClient();
  const q = useSnapshot();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function login(id: string) {
    setError('');
    setPending(true);
    try {
      await adapter.signIn(id);
      await client.invalidateQueries({ queryKey: ['snapshot'] });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: wide ? '5%' : 24,
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flex: 1, width: '100%', gap: wide ? 48 : 24 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Wordmark size={24} />
          <Button
            title="Back to browsing"
            variant="ghost"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'center' : 'stretch',
            gap: wide ? 64 : 24,
            paddingVertical: wide ? 32 : 0,
          }}
        >
          <View
            style={{
              flex: wide ? 1 : undefined,
              minWidth: 0,
              gap: wide ? 24 : 8,
              paddingTop: wide ? 0 : 24,
            }}
          >
            {wide && (
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  letterSpacing: 2,
                  color: colors.accent,
                }}
              >
                YOUR COMMUNITY. YOUR VOICE.
              </Text>
            )}
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: wide ? 56 : 32,
                lineHeight: wide ? 64 : 38,
                color: colors.ink,
              }}
            >
              {isDemo ? 'Try a demo account' : signingUp ? 'Join your community.' : 'Welcome back.'}
            </Text>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: wide ? 19 : 15,
                lineHeight: wide ? 30 : 23,
                color: colors.muted,
              }}
            >
              Browse freely. Create an account to sign petitions, save causes, and join the
              conversation.
            </Text>
          </View>
          <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 16 }}>
            {isDemo ? (
              <View style={{ gap: 12 }}>
                {[
                  { id: demoIds.maya, name: 'Maya Chen' },
                  { id: demoIds.sam, name: 'Sam Rivera' },
                  { id: demoIds.jordan, name: 'Jordan Lee' },
                ].map((account) => (
                  <Button
                    key={account.id}
                    title={`Continue as ${account.name}`}
                    disabled={pending}
                    onPress={() => void login(account.id)}
                  />
                ))}
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    lineHeight: 20,
                    color: colors.muted,
                  }}
                >
                  All demo accounts and signatures are fictional.
                </Text>
              </View>
            ) : q.data?.profile ? (
              <Button title="Continue to your feed" onPress={() => router.replace('/')} />
            ) : (
              <>
                <Notice text={betaNotice} />
                <ClerkLogin mode={signingUp ? 'sign-up' : 'sign-in'} />
              </>
            )}
            {!!error && <Notice error text={error} />}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
