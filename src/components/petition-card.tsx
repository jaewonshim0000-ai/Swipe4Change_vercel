import React, { useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { daysLeft, milestoneLabel } from '../domain/discovery';
import { isExample, useCommand } from '../data/provider';
import { recordSignal } from '../data/signals';
import { Bar, Cover, GlassPill, Kicker, SaveMark, Press, toast, petitionImage } from './kit';
import { Glyph } from './glyph';
import { haptic, stag } from './motion';
import { blur, colors, fonts, gradient, shadows, topicColors } from './theme';

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

/** A petition as a white list row: thumbnail, kicker, title, progress and its numbers. */
export function PetitionRow({
  petition: p,
  snapshot: s,
  index = 0,
}: {
  petition: Petition;
  snapshot: Snapshot;
  index?: number;
}) {
  const [now] = useState(Date.now);
  const community = s.communities.find((c) => c.id === p.communityId);
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
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          },
          shadows.card,
        ]}
      >
        <Cover source={petitionImage(p)} style={{ width: 64, height: 64, borderRadius: 14 }} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Kicker
            topic={p.topic}
            text={`${isExample(p.id) ? 'Example · ' : ''}${community?.name ?? p.city} · ${p.topic}`}
            small
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>
            {p.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}
          >
            {p.count.toLocaleString()} of {p.goal.toLocaleString()} signed · {daysLeft(p, now)} days
            left
          </Text>
          <View style={{ marginTop: 4 }}>
            <Bar pct={(100 * p.count) / p.goal} height={4} label="Signature goal progress" />
          </View>
        </View>
        <Glyph name="next" size={20} color={colors.muted} />
      </Press>
    </Animated.View>
  );
}

/**
 * The design's photo tile: status flag, title, progress and one line of numbers on the photo.
 * `note` says why it is here ("Near you"); `badge` labels a tile with no status flag of its own.
 */
export function PetitionTile({
  petition: p,
  snapshot: s,
  note,
  badge,
  width,
  index = 0,
}: {
  petition: Petition;
  snapshot: Snapshot;
  note?: string;
  badge?: string;
  /** Fixed width in a rail; omitted, the tile fills its grid cell. */
  width?: number;
  index?: number;
}) {
  const save = useSave(s);
  const [now] = useState(Date.now);
  const saved = s.saved.includes(p.id);
  const left = daysLeft(p, now);
  const flag = s.signed.includes(p.id)
    ? 'signed'
    : s.profile && p.ownerId === s.profile.id
      ? 'Yours'
      : isExample(p.id)
        ? 'Example'
        : left <= 30
          ? `${left} days left`
          : badge;
  return (
    <Animated.View style={[{ width }, stag(index)]}>
      <Press
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${p.count.toLocaleString()} signed`}
        accessibilityHint={note}
        scale={0.98}
        onPress={() => router.push(`/petition/${p.id}`)}
        style={[
          {
            aspectRatio: 4 / 5,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: colors.track,
          },
          shadows.card,
        ]}
      >
        <Cover
          source={petitionImage(p)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 46,
            flexDirection: 'row',
          }}
        >
          {flag === 'signed' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderRadius: 999,
                paddingHorizontal: 9,
                paddingVertical: 4,
                backgroundColor: colors.pale,
              }}
            >
              <Glyph name="check" size={12} weight={3.2} color={colors.dark} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.dark }}>
                Signed
              </Text>
            </View>
          ) : (
            !!flag && <GlassPill text={flag} style={{ fontSize: 11 }} />
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Unsave ${p.title}` : `Save ${p.title}`}
          hitSlop={6}
          onPress={(e) => {
            e.stopPropagation();
            save(p);
          }}
          style={[
            {
              position: 'absolute',
              top: 6,
              right: 6,
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.45)',
            },
            blur(8),
          ]}
        >
          <SaveMark on={saved} size={18} />
        </Pressable>
        <View
          style={[
            { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, paddingTop: 40 },
            gradient('linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.82))'),
          ]}
        >
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fonts.semibold,
              fontSize: 14,
              lineHeight: 18,
              color: colors.white,
            }}
          >
            {p.title}
          </Text>
          <View style={{ marginTop: 8 }}>
            <Bar pct={(100 * p.count) / p.goal} tone="light" height={4} />
          </View>
          <Text
            numberOfLines={1}
            style={{ marginTop: 6, fontFamily: fonts.medium, fontSize: 12, color: colors.onImage }}
          >
            {topicColors[p.topic].emoji} {p.count.toLocaleString()} signed
            {note ? ` · ${note}` : ` · ${p.city.split(',')[0]}`}
          </Text>
        </View>
      </Press>
    </Animated.View>
  );
}

/** Tiles in even columns: two on phones, three on small tablets, as many 200pt columns as fit wider. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const gap = width >= 760 ? 12 : 8;
  const cols = width >= 760 ? Math.floor((width + gap) / (200 + gap)) : width >= 600 ? 3 : 2;
  const cell = width ? (width - gap * (cols - 1)) / cols : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {!!cell &&
        React.Children.toArray(children).map((child, i) => (
          <View key={React.isValidElement(child) ? (child.key ?? i) : i} style={{ width: cell }}>
            {child}
          </View>
        ))}
    </View>
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
            lineHeight: 41,
            letterSpacing: -0.6,
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
