import { useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { daysLeft, milestoneLabel } from '../domain/discovery';
import { useCommand } from '../data/provider';
import { recordSignal } from '../data/signals';
import { Bar, Cover, GlassPill, Heart, Press, Scrim, TopicPill, toast, petitionImage } from './kit';
import { haptic, stag } from './motion';
import { colors, fonts } from './theme';

/**
 * A petition's link. Once you have signed, it carries your ripple code, so everyone who signs
 * through it joins your ripple. Before that it is a plain link: a ripple only credits signers.
 */
export function petitionLink(p: Petition, s: Snapshot, origin: string) {
  const via = s.ripple && s.signed.includes(p.id) ? `?via=${s.ripple.code}` : '';
  return `${origin}/petition/${p.id}${via}`;
}

export async function sharePetition(p: Petition, s: Snapshot) {
  void recordSignal(s.profile, p.id, 'share');
  const url = petitionLink(p, s, Platform.OS === 'web' ? window.location.origin : 'swipe4change:/');
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    return url.includes('?via=')
      ? 'Link copied — it carries your private ripple code.'
      : 'Petition link copied. Share it with your community.';
  }
  await Share.share({ message: `${p.title} — Swipe4Change\n${url}` });
  return 'Share sheet opened.';
}
/** Share, reporting the outcome as a toast. */
export const share = (p: Petition, s: Snapshot) =>
  sharePetition(p, s)
    .then(toast)
    .catch(() => toast('Sharing is unavailable. Copy the address from your browser.'));

/** Save or unsave with an optimistic heart; a rejected write rolls back and says so. */
export function useSave(s: Snapshot) {
  const mutation = useCommand();
  return (p: Petition) => {
    if (!s.profile) {
      router.push('/(auth)/sign-in');
      return;
    }
    const was = s.saved.includes(p.id);
    haptic('tap');
    mutation.mutate(
      { type: 'save', petitionId: p.id },
      {
        onSuccess: () => toast(was ? 'Removed from saved.' : 'Saved — you’ll follow its updates.'),
        onError: () => toast('Save failed and rolled back. Tap again to retry.'),
      },
    );
  };
}

const cardShadow = { boxShadow: '0px 10px 26px -16px rgba(32,38,26,0.35)' };

/**
 * A petition as a white list row: thumbnail, topic, title, progress. `detail` adds the save heart,
 * why it matched, and days left (Explore); without it the row is the compact feed version.
 */
export function PetitionRow({
  petition: p,
  snapshot: s,
  index = 0,
  match,
}: {
  petition: Petition;
  snapshot: Snapshot;
  index?: number;
  /** Explore's "why this matched" line. Its presence switches on the detailed layout. */
  match?: string;
}) {
  const save = useSave(s);
  const [now] = useState(Date.now);
  const detail = match !== undefined;
  const saved = s.saved.includes(p.id);
  return (
    <Animated.View style={stag(index)}>
      <Press
        accessibilityRole="link"
        accessibilityLabel={`View ${p.title}`}
        scale={0.98}
        onPress={() => router.push(`/petition/${p.id}`)}
        style={[
          {
            backgroundColor: colors.white,
            borderRadius: 24,
            padding: 10,
            flexDirection: 'row',
            gap: 12,
          },
          cardShadow,
        ]}
      >
        <Cover
          source={petitionImage(p)}
          style={{ width: detail ? 98 : 96, height: detail ? 122 : 112, borderRadius: 20 }}
        />
        <View
          style={{ flex: 1, minWidth: 0, gap: 6, paddingVertical: 4, paddingRight: detail ? 2 : 4 }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View style={{ flexShrink: 1 }}>
              <TopicPill topic={p.topic} soft />
            </View>
            {detail && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? `Unsave ${p.title}` : `Save ${p.title}`}
                hitSlop={6}
                onPress={(e) => {
                  e.stopPropagation();
                  save(p);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: colors.field,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Heart on={saved} dark size={16} />
              </Pressable>
            )}
          </View>
          <Text
            style={{
              fontFamily: fonts.heading,
              fontSize: 16,
              lineHeight: 19.5,
              letterSpacing: -0.3,
              color: colors.ink,
            }}
          >
            {p.title}
          </Text>
          {detail && (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 16,
                color: colors.accent,
              }}
            >
              ✦ {match}
            </Text>
          )}
          <View style={{ marginTop: 'auto', gap: 6 }}>
            <Bar pct={(100 * p.count) / p.goal} height={5} label="Signature goal progress" />
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}
            >
              {p.count.toLocaleString()} of {p.goal.toLocaleString()} ·{' '}
              {detail ? `${daysLeft(p, now)}d left` : p.city}
            </Text>
          </View>
        </View>
      </Press>
    </Animated.View>
  );
}

/** The tall image card in Home's horizontal collections. */
export function CollectionCard({ petition: p, badge }: { petition: Petition; badge: string }) {
  return (
    <Press
      accessibilityRole="link"
      accessibilityLabel={`View ${p.title}`}
      onPress={() => router.push(`/petition/${p.id}`)}
      style={{
        width: 206,
        height: 252,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: colors.dark,
        boxShadow: '0px 16px 30px -20px rgba(32,38,26,0.55)',
      }}
    >
      <Cover
        source={petitionImage(p)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Scrim stops="rgba(18,20,15,0) 30%, rgba(18,20,15,0.88) 100%" />
      <View style={{ position: 'absolute', top: 12, left: 12 }}>
        <GlassPill text={badge} style={{ fontFamily: fonts.semibold, fontSize: 11 }} />
      </View>
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, gap: 7 }}>
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 18,
            lineHeight: 20,
            letterSpacing: -0.4,
            color: colors.white,
          }}
        >
          {p.title}
        </Text>
        <Bar pct={(100 * p.count) / p.goal} tone="light" height={4} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.onImage }}>
          {p.count.toLocaleString()} of {p.goal.toLocaleString()}
        </Text>
      </View>
    </Press>
  );
}

/** The big count, the goal bar and what the next milestone needs. */
export function Progress({
  petition: p,
  shown,
}: {
  petition: Petition;
  /** Count-up value while animating. */ shown?: number;
}) {
  const [now] = useState(Date.now);
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 34,
            lineHeight: 34,
            letterSpacing: -1,
            color: colors.ink,
          }}
        >
          {(shown ?? p.count).toLocaleString()}
          <Text
            style={{ fontFamily: fonts.body, fontSize: 13, letterSpacing: 0, color: colors.muted }}
          >
            {' '}
            signatures
          </Text>
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>
          of {p.goal.toLocaleString()}
        </Text>
      </View>
      <Bar
        pct={(100 * p.count) / p.goal}
        tone="big"
        height={9}
        label={`${p.count} of ${p.goal} signatures`}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.accent }}>
          {milestoneLabel(p)}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>
          {daysLeft(p, now)} days left
        </Text>
      </View>
    </View>
  );
}
