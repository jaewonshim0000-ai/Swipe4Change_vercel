import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Topic, topics } from '../../src/domain/model';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Button, Field, Notice, colors, fonts, styles } from '../../src/components/ui';
import { Press, Scrim, Screen, StepBars, toast, topicImage } from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { CitySheet } from '../../src/components/city-picker';
import { stag, transition } from '../../src/components/motion';
import { profileSchema } from '../../src/domain/personalization';

/** The name every new live account starts with until the person chooses their own. */
const placeholderName = 'Community member';

export default function Onboarding() {
  const q = useSnapshot();
  const command = useCommand();
  const [selected, setSelected] = useState<Topic[]>(q.data?.profile?.interests ?? []);
  const [city, setCity] = useState(q.data?.profile?.city ?? '');
  const [picking, setPicking] = useState(false);
  const profile = q.data?.profile;
  const [name, setName] = useState(profile?.name === placeholderName ? '' : (profile?.name ?? ''));
  const [agreed, setAgreed] = useState(false);
  const first = profile?.name === placeholderName ? undefined : profile?.name.split(' ')[0];
  async function complete(skip = false) {
    const chosen = profileSchema.shape.name.safeParse(name);
    if (!chosen.success) {
      toast('Add your name: at least two characters.');
      return;
    }
    if (!agreed) {
      toast('Confirm you’re 13 or older and agree to the Terms to continue.');
      return;
    }
    if (!skip && selected.length < 3) {
      toast('Choose at least three interests, or skip.');
      return;
    }
    if (!city) {
      setPicking(true);
      return;
    }
    try {
      if (profile && chosen.data !== profile.name)
        await command.mutateAsync({
          type: 'profile',
          name: chosen.data,
          bio: profile.bio ?? '',
          useSigningHistory: profile.useSigningHistory ?? true,
        });
      await command.mutateAsync({ type: 'onboard', city, interests: skip ? [] : selected });
      router.replace('/(tabs)');
    } catch {
      // command.error explains what went wrong below the buttons.
    }
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
                      borderRadius: 24,
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
                        borderRadius: 999,
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
                      fontSize: 14.5,
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
                        borderRadius: 24,
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Approximate city and state: ${city || 'not chosen'}. Change`}
        onPress={() => setPicking(true)}
        style={{
          marginTop: 18,
          backgroundColor: colors.white,
          borderRadius: 24,
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
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
            Approximate city and state
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14.5,
              color: city ? colors.ink : colors.muted,
              paddingTop: 3,
            }}
          >
            {city || 'Choose your city'}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.accent }}>
          Change
        </Text>
      </Pressable>
      <Text style={[styles.micro, { fontSize: 12, paddingHorizontal: 6, paddingTop: 10 }]}>
        Only your city and state are saved — never your exact location or political affiliation.
      </Text>
      <CitySheet visible={picking} onClose={() => setPicking(false)} onPick={setCity} />
      <View style={{ marginTop: 18, gap: 6 }}>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoComplete="name"
          placeholder="First and last name"
        />
        <Text style={[styles.micro, { fontSize: 12, paddingHorizontal: 6 }]}>
          Public on petitions, updates and posts you write. When you sign, you choose your full
          name, first name and initial, or anonymous.
        </Text>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        accessibilityLabel="I’m 13 or older and agree to the Terms and Privacy Policy"
        onPress={() => setAgreed(!agreed)}
        style={{
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 44,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: colors.dark,
            backgroundColor: agreed ? colors.dark : colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreed && (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>✓</Text>
          )}
        </View>
        <Text style={[styles.body, { flex: 1, fontSize: 14.5 }]}>
          I’m 13 or older and agree to the Terms and Privacy Policy
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/legal')}
        style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 36 }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.accent }}>
          Read the Terms and Privacy Policy ›
        </Text>
      </Pressable>
      <Press
        accessibilityLabel={
          selected.length < 3 ? `Pick ${3 - selected.length} more` : 'Find my community'
        }
        disabled={command.isPending}
        onPress={() => void complete()}
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>
          {selected.length < 3 ? `Pick ${3 - selected.length} more` : 'Find my community →'}
        </Text>
      </Press>
      <Button
        title="Skip for now"
        variant="ghost"
        disabled={command.isPending}
        onPress={() => void complete(true)}
        style={{ marginTop: 4 }}
      />
      {command.error && <Notice error text={command.error.message} />}
    </Screen>
  );
}
