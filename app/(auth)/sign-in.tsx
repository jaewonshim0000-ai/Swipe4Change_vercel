import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Notice, colors, fonts } from '../../src/components/ui';
import { ClerkLogin } from '../../src/components/clerk-login';
import { Initials, KenBurns, Press, Scrim, gatheringImage } from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { anim, kf, stag } from '../../src/components/motion';
import { frost } from '../../src/components/theme';
import { isDemo, useBackend, useSnapshot } from '../../src/data/provider';
import { demoIds } from '../../src/data/seed';

const accounts = [
  {
    id: demoIds.maya,
    initials: 'MC',
    name: 'Maya Chen',
    role: 'Student organizer · Riverton, CA',
    bg: colors.pale,
    fg: colors.accent,
  },
  {
    id: demoIds.sam,
    initials: 'SR',
    name: 'Sam Rivera',
    role: 'Approved local resident · Riverton, CA',
    bg: '#E6EDF7',
    fg: '#405E82',
  },
  {
    id: demoIds.jordan,
    initials: 'JL',
    name: 'Jordan Lee',
    role: 'New member · Brookside, CA',
    bg: '#EDE6F4',
    fg: '#66517C',
  },
];

export default function Welcome() {
  const { adapter } = useBackend();
  const client = useQueryClient();
  const q = useSnapshot();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function login(id: string) {
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
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, overflow: 'hidden', minHeight: 300 }}>
        <KenBurns
          source={gatheringImage}
          ms={14000}
          label="Illustrative image of neighbors gathering"
        />
        <Scrim stops="rgba(18,20,15,0.35) 0%, rgba(18,20,15,0) 30%, rgba(18,20,15,0.55) 62%, rgba(18,20,15,0.92) 100%" />
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: Math.max(insets.top, 20) + 10,
              left: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            },
            anim(kf.fade, 800, { ease: 'ease' }),
          ]}
        >
          <View
            style={[
              {
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
              },
              frost(0.18),
            ]}
          >
            <Glyph name="leaf" size={17} color={colors.white} />
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 18,
              letterSpacing: -0.5,
              color: colors.white,
            }}
          >
            Swipe4Change ↗
          </Text>
        </Animated.View>
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: 26, gap: 12 }}>
          <Animated.Text
            style={[
              {
                fontFamily: fonts.semibold,
                fontSize: 11,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: colors.pale,
              },
              anim(kf.in, 700, { delay: 150 }),
            ]}
          >
            {isDemo ? 'Make yourself at home' : 'Notice something. Change something.'}
          </Animated.Text>
          <Animated.Text
            accessibilityRole="header"
            style={[
              {
                fontFamily: fonts.display,
                fontSize: 46,
                lineHeight: 46,
                letterSpacing: -2,
                color: colors.white,
              },
              anim(kf.in, 800, { delay: 250 }),
            ]}
          >
            Your voice starts somewhere.
          </Animated.Text>
          <Animated.Text
            style={[
              { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: '#E9EBE4' },
              anim(kf.in, 800, { delay: 380 }),
            ]}
          >
            See what people around you are asking for, then decide what you want to do next.
          </Animated.Text>
        </View>
      </View>
      <Animated.View
        style={[
          {
            backgroundColor: colors.canvas,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            marginTop: -8,
            paddingTop: 22,
            paddingHorizontal: 18,
            paddingBottom: 40 + insets.bottom,
            gap: 10,
          },
          anim(kf.sheet, 700, { delay: 200 }),
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 11,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: colors.muted,
            paddingHorizontal: 6,
            paddingBottom: 4,
          }}
        >
          {isDemo ? 'Choose a demo account' : 'Sign in to continue'}
        </Text>
        {isDemo ? (
          accounts.map((a, i) => (
            <Animated.View key={a.id} style={stag(i + 5)}>
              <Press
                accessibilityLabel={`Continue as ${a.name}, ${a.role}`}
                disabled={pending}
                onPress={() => void login(a.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  backgroundColor: colors.white,
                  borderRadius: 22,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  boxShadow: '0px 10px 26px -14px rgba(32,38,26,0.35)',
                }}
              >
                <Initials text={a.initials} size={46} bg={a.bg} fg={a.fg} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 15,
                      lineHeight: 19.5,
                      color: colors.ink,
                    }}
                  >
                    {a.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 12.5,
                      lineHeight: 17.5,
                      color: colors.muted,
                    }}
                  >
                    {a.role}
                  </Text>
                </View>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.dark,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Glyph name="next" size={15} weight={2.2} color={colors.white} />
                </View>
              </Press>
            </Animated.View>
          ))
        ) : q.data?.profile ? (
          <Button title="Continue to your feed" onPress={() => router.replace('/')} />
        ) : (
          <ClerkLogin />
        )}
        {!!error && <Notice error text={error} />}
        <Button
          title="Explore without an account"
          variant="ghost"
          onPress={() => router.replace('/(tabs)')}
        />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 11,
            lineHeight: 17,
            color: colors.outline,
            textAlign: 'center',
          }}
        >
          {isDemo
            ? 'All accounts, petitions and signatures are fictional. No legal validity is implied.'
            : 'Privacy is a choice. Ranking you can understand. No political profiling.'}
        </Text>
      </Animated.View>
    </View>
  );
}
