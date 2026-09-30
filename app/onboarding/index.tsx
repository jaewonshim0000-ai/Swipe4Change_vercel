import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Topic, topics } from '../../src/domain/model';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Button, Notice, colors, fonts, styles } from '../../src/components/ui';
import { Press, Scrim, Screen, StepBars, toast, topicImage } from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { stag, transition } from '../../src/components/motion';

export default function Onboarding() {
  const q = useSnapshot();
  const command = useCommand();
  const [selected, setSelected] = useState<Topic[]>(q.data?.profile?.interests ?? []);
  const [city, setCity] = useState(q.data?.profile?.city ?? 'Riverton, CA');
  const first = q.data?.profile?.name.split(' ')[0];
  function complete(skip = false) {
    if (!skip && selected.length < 3) {
      toast('Choose at least three interests, or skip.');
      return;
    }
    command.mutate(
      { type: 'onboard', city, interests: skip ? [] : selected },
      { onSuccess: () => router.replace('/(tabs)') },
    );
  }
  return (
    <Screen tabs={false} enter="slide">
      <View style={{ marginBottom: 22 }}>
        <StepBars count={2} current={0} />
      </View>
      <Text style={styles.label}>{first ? `Hi ${first}` : 'Make yourself at home'}</Text>
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          { fontSize: 34, lineHeight: 36, letterSpacing: -1.3, marginTop: 10, marginBottom: 8 },
        ]}
      >
        What matters to you?
      </Text>
      <Text style={[styles.body, { color: colors.muted, marginBottom: 20 }]}>
        Pick at least three. We only use them to find your corner of the community.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {topics.map((t, i) => {
          const on = selected.includes(t);
          const wide = i === topics.length - 1 && topics.length % 2 === 1;
          return (
            <Animated.View
              key={t}
              style={[{ width: wide ? '100%' : '48.5%', flexGrow: 1 }, stag(i)]}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t}
                onPress={() => setSelected(on ? selected.filter((x) => x !== t) : [...selected, t])}
              >
                <Animated.View
                  style={[
                    {
                      height: 118,
                      borderRadius: 22,
                      overflow: 'hidden',
                      transform: [{ scale: on ? 1 : 0.97 }],
                      filter: on ? 'saturate(1)' : 'saturate(0.55)',
                    },
                    transition(['transform'], 250),
                  ]}
                >
                  <Image
                    source={topicImage(t)}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                  <Scrim stops="rgba(18,20,15,0) 30%, rgba(18,20,15,0.8) 100%" />
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? colors.white : 'rgba(255,255,255,0.3)',
                        transform: [{ scale: on ? 1 : 0.6 }],
                        opacity: on ? 1 : 0.7,
                      },
                      transition(['transform', 'opacity', 'backgroundColor'], 250),
                    ]}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dark }}>
                      ✓
                    </Text>
                  </Animated.View>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 12,
                      right: 12,
                      bottom: 11,
                      fontFamily: fonts.semibold,
                      fontSize: 14,
                      lineHeight: 17,
                      color: colors.white,
                    }}
                  >
                    {t}
                  </Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 22,
                        borderWidth: 3,
                        borderColor: on ? colors.dark : 'rgba(28,31,25,0)',
                      },
                      transition(['borderColor'], 250),
                    ]}
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <View
        style={{
          marginTop: 18,
          backgroundColor: colors.white,
          borderRadius: 22,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0px 10px 26px -16px rgba(32,38,26,0.35)',
        }}
      >
        <Glyph name="pin" size={18} color={colors.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>
            Approximate city and state
          </Text>
          <TextInput
            accessibilityLabel="Approximate city and state"
            value={city}
            onChangeText={setCity}
            style={{
              fontFamily: fonts.semibold,
              fontSize: 15,
              color: colors.ink,
              paddingTop: 3,
              paddingBottom: 0,
            }}
          />
        </View>
      </View>
      <Text style={[styles.micro, { fontSize: 11.5, paddingHorizontal: 6, paddingTop: 10 }]}>
        City-level only. Never a street address, GPS fix, or political affiliation.
      </Text>
      <Press
        accessibilityLabel={
          selected.length < 3 ? `Pick ${3 - selected.length} more` : 'Find my community'
        }
        disabled={command.isPending}
        onPress={() => complete()}
        style={{
          marginTop: 18,
          minHeight: 54,
          borderRadius: 999,
          backgroundColor: colors.dark,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: selected.length < 3 ? 0.4 : 1,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>
          {selected.length < 3 ? `Pick ${3 - selected.length} more` : 'Find my community →'}
        </Text>
      </Press>
      <Button
        title="Skip for now"
        variant="ghost"
        disabled={command.isPending}
        onPress={() => complete(true)}
        style={{ marginTop: 4 }}
      />
      {command.error && <Notice error text={command.error.message} />}
    </Screen>
  );
}
