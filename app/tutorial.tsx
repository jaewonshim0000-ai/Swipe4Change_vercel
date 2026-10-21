import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { ProfileRole, roleLabels } from '../src/domain/model';
import { useSnapshot } from '../src/data/provider';
import { Press, Screen, StepBars } from '../src/components/kit';
import { Glyph, GlyphName } from '../src/components/glyph';
import { anim, kf } from '../src/components/motion';
import { gradient, gradients } from '../src/components/theme';
import { Button, colors, fonts, styles } from '../src/components/ui';

type Href = '/(tabs)' | '/(tabs)/create' | '/(tabs)/communities';
/**
 * The welcome tour after onboarding, written for the way someone said they want to take part.
 * Only the tour differs: every role can do everything in the app.
 */
const tours: Record<
  ProfileRole,
  { slides: { icon: GlyphName; title: string; body: string }[]; cta: string; href: Href }
> = {
  organizer: {
    slides: [
      {
        icon: 'write',
        title: 'Start with one clear ask',
        body: 'Tap Create and answer one short question at a time, or describe the problem in your own words and let AI draft it. Nothing is public until you publish.',
      },
      {
        icon: 'landmark',
        title: 'Send it to who can say yes',
        body: 'Name the office that can make the change. The recipient finder suggests offices; you always choose.',
      },
      {
        icon: 'trend',
        title: 'Share it and keep people posted',
        body: 'Share your link, post updates from Manage, and deliver the signatures when you reach your goal.',
      },
    ],
    cta: 'Start a petition',
    href: '/(tabs)/create',
  },
  supporter: {
    slides: [
      {
        icon: 'cards',
        title: 'Swipe through causes near you',
        body: 'Swipe right to sign (you review it first), left to pass, and up to read the whole petition. The bookmark saves one for later.',
      },
      {
        icon: 'shield',
        title: 'You choose how your name appears',
        body: 'Sign with your full name, your first name and initial, or anonymously. Your email and address are never shown.',
      },
      {
        icon: 'compass',
        title: 'Search, filter and follow',
        body: 'Explore by topic or place. Petitions you save send you their updates.',
      },
    ],
    cta: 'Find causes',
    href: '/(tabs)',
  },
  community: {
    slides: [
      {
        icon: 'users',
        title: 'Join or start a local group',
        body: 'Groups gather neighbors around a town or cause. Start one if yours doesn’t exist yet.',
      },
      {
        icon: 'check',
        title: 'Back petitions together',
        body: 'Members vote privately on which petitions their community backs, and the backing goes into the packet sent to the recipient.',
      },
      {
        icon: 'sparkle',
        title: 'Keep the conversation going',
        body: 'Post questions and ideas, plan events, and invite neighbors to sign.',
      },
    ],
    cta: 'Explore groups',
    href: '/(tabs)/communities',
  },
};

export default function Tutorial() {
  const q = useSnapshot();
  const role = q.data?.profile?.role ?? 'supporter';
  const tour = tours[role];
  const [i, setI] = useState(0);
  const slide = tour.slides[i];
  const last = i === tour.slides.length - 1;
  return (
    <Screen tabs={false} enter="slide" fill>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <StepBars count={tour.slides.length} current={i} />
        </View>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Skip the tour"
          onPress={() => router.replace(tour.href)}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>Skip</Text>
        </Press>
      </View>
      <Animated.View
        key={i}
        style={[{ flex: 1, justifyContent: 'center', gap: 16 }, anim(kf.tickA, 450)]}
      >
        <View
          style={[
            {
              width: 112,
              height: 112,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.pale,
              marginBottom: 8,
            },
            gradient(gradients.hero),
          ]}
        >
          <Glyph name={slide.icon} size={44} weight={2} color={colors.dark} />
        </View>
        <Text style={styles.label}>
          {roleLabels[role].label} tour · {i + 1} of {tour.slides.length}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.bold,
            fontSize: 30,
            lineHeight: 37,
            letterSpacing: -0.5,
            color: colors.ink,
          }}
        >
          {slide.title}
        </Text>
        <Text style={[styles.muted, { fontSize: 17, lineHeight: 26 }]}>{slide.body}</Text>
        {last && (
          <Text style={[styles.micro, { fontSize: 13, lineHeight: 19 }]}>
            Whatever you picked, you can do all of it: start, sign and share petitions, and join
            groups. Replay this tour from Profile.
          </Text>
        )}
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        {i > 0 && (
          <Button
            title="Back"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setI(i - 1)}
          />
        )}
        <Button
          title={last ? tour.cta : 'Next'}
          style={{ flex: 2 }}
          onPress={() => (last ? router.replace(tour.href) : setI(i + 1))}
        />
      </View>
    </Screen>
  );
}
