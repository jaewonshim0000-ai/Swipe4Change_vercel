import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  View,
  Image,
  Text,
  Pressable,
  Share,
  StyleSheet,
  Platform,
  GestureResponderHandlers,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Petition, Snapshot, Topic, verificationLabels } from '../domain/model';
import { scorePetition } from '../domain/rules';
import { topicColors } from './theme';
import { useCommand } from '../data/provider';
import { Button, Icon, Notice, colors, fonts, styles, tokens } from './ui';
const topicImages: Record<Topic, React.ComponentProps<typeof Image>['source']> = {
  'Safer streets': require('../../assets/theme/safer-streets.jpg'),
  Environment: require('../../assets/theme/environment.jpg'),
  Education: require('../../assets/theme/education.jpg'),
  'Public spaces': require('../../assets/theme/public-spaces.jpg'),
  Accessibility: require('../../assets/theme/accessibility.jpg'),
};
export function TopicArt({ topic, large = false }: { topic: Topic; large?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        height: large ? (width < 600 ? 200 : 280) : tokens.phone.deckImage,
        backgroundColor: colors.pale,
        overflow: 'hidden',
      }}
    >
      <Image
        source={topicImages[topic]}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
        accessibilityLabel={`${topic} — illustrative theme image, not petition evidence`}
      />
      <View
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: topicColors[topic].soft,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Text style={[styles.label, { fontSize: 10, color: colors.secondary, letterSpacing: 0.5 }]}>
          {topic}
        </Text>
      </View>
      <Text
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          backgroundColor: '#121113CC',
          color: colors.white,
          fontFamily: fonts.medium,
          fontSize: 10,
          padding: 4,
          borderRadius: 4,
        }}
      >
        Illustrative image
      </Text>
    </View>
  );
}
export function Progress({
  petition: p,
  compact = false,
  animateFrom,
}: {
  petition: Petition;
  /** Cards drop the sample-count footnote; the detail page carries the full disclosure. */
  compact?: boolean;
  /** Supplied only by the receipt after the adapter confirms a signature. */
  animateFrom?: number;
}) {
  const percent = Math.min(100, Math.max(0, (100 * p.count) / p.goal));
  const [progress] = useState(() => new Animated.Value(percent));
  useEffect(() => {
    if (animateFrom === undefined) return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active) return;
        if (reduced) progress.setValue(percent);
        else {
          progress.setValue(Math.max(0, (100 * animateFrom) / p.goal));
          Animated.timing(progress, {
            toValue: percent,
            duration: 280,
            useNativeDriver: false,
          }).start();
        }
      })
      .catch(() => {
        if (active) progress.setValue(percent);
      });
    return () => {
      active = false;
      progress.stopAnimation();
    };
  }, [animateFrom, p.goal, percent, progress]);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.between}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>
          {p.count.toLocaleString()}{' '}
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
            signatures
          </Text>
        </Text>
        <Text style={styles.muted}>of {p.goal.toLocaleString()}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Signature goal progress"
        accessibilityValue={{
          min: 0,
          max: p.goal,
          now: Math.min(p.count, p.goal),
          text: `${p.count} of ${p.goal} signatures`,
        }}
        style={{ height: 7, backgroundColor: colors.pale, borderRadius: 8, overflow: 'hidden' }}
      >
        <Animated.View
          style={{
            width:
              animateFrom === undefined
                ? `${percent}%`
                : progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
            height: '100%',
            backgroundColor: topicColors[p.topic].accent,
            borderRadius: 8,
          }}
        />
      </View>
      {!compact && (
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>
          {p.sampleCount > 0
            ? `${p.sampleCount.toLocaleString()} sample signatures · new signatures checked against eligibility`
            : 'Signatures checked against the configured eligibility rule'}
        </Text>
      )}
    </View>
  );
}
/**
 * Once you have signed, your share link carries your ripple code, so everyone who signs through it
 * joins your ripple. Before that it is a plain link: a ripple only credits people who signed.
 */
export async function sharePetition(p: Petition, s: Snapshot) {
  const via = s.ripple && s.signed.includes(p.id) ? `?via=${s.ripple.code}` : '';
  const url = `${Platform.OS === 'web' ? window.location.origin : 'swipe4change:/'}/petition/${p.id}${via}`;
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    return via
      ? 'Your link is copied. Everyone who signs through it joins your ripple.'
      : 'Petition link copied. Share it with your community.';
  }
  await Share.share({ message: `${p.title} — Swipe4Change\n${url}` });
  return 'Share sheet opened.';
}
export function PetitionCard({
  petition: p,
  snapshot: s,
  showReason = false,
  preview = false,
  swipeHandlers,
}: {
  petition: Petition;
  snapshot: Snapshot;
  showReason?: boolean;
  preview?: boolean;
  swipeHandlers?: GestureResponderHandlers;
}) {
  const mutation = useCommand();
  const [shareError, setShareError] = useState('');
  const [now] = useState(Date.now);
  const saved = s.saved.includes(p.id);
  const community = s.communities.find((c) => c.id === p.communityId);
  const reasons = scorePetition(
    p,
    s.profile,
    now,
    s.petitions.filter((item) => s.signed.includes(item.id)),
  ).reasons;
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: tokens.featureRadius,
        ...tokens.shadow,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {swipeHandlers ? (
        <View
          {...swipeHandlers}
          accessibilityLabel="Swipe artwork left to pass, right to support or up to read more"
        >
          <TopicArt topic={p.topic} />
        </View>
      ) : (
        <Pressable
          accessibilityRole={preview ? 'text' : 'link'}
          disabled={preview}
          accessibilityLabel={`View ${p.title}`}
          onPress={() => router.push(`/petition/${p.id}`)}
        >
          <TopicArt topic={p.topic} />
        </Pressable>
      )}
      <View
        style={{
          padding: tokens.phone.cardPad,
          gap: 16,
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <View
          {...swipeHandlers}
          style={{
            gap: tokens.phone.cardGap,
            ...(swipeHandlers ? { userSelect: 'none' as const } : {}),
          }}
        >
          <View style={styles.between}>
            <Text style={[styles.label, { fontSize: 10 }]}>{p.topic}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>
              {community?.name}
            </Text>
          </View>
          {swipeHandlers ? (
            <Text accessibilityRole="header" style={[styles.h2, { fontSize: 23, lineHeight: 28 }]}>
              {p.title}
            </Text>
          ) : (
            <Pressable
              accessibilityRole={preview ? 'text' : 'link'}
              disabled={preview}
              onPress={() => router.push(`/petition/${p.id}`)}
            >
              <Text style={[styles.h2, { fontSize: 23, lineHeight: 28 }]}>{p.title}</Text>
            </Pressable>
          )}
          <Text numberOfLines={2} style={styles.small}>
            {p.summary}
          </Text>
          <View style={[styles.row, { gap: 6, flexWrap: 'nowrap' }]}>
            <Icon name="location-outline" size={13} />
            <Text
              numberOfLines={2}
              style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, flexShrink: 1 }}
            >
              {p.city} · To: {p.recipient}
            </Text>
          </View>
          <Progress petition={p} compact />
          <View style={[styles.between, { gap: 8 }]}>
            <Text style={[styles.micro, { flexShrink: 1 }]}>
              {verificationLabels[p.verification]}
            </Text>
            <Text style={styles.micro}>
              {Math.max(0, Math.ceil((Date.parse(p.deadline) - now) / 86400000))} days left
            </Text>
          </View>
          {showReason && reasons.length > 0 && (
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.accent }}>
              ↳ {reasons.slice(0, 2).join(' · ')}
            </Text>
          )}
        </View>
        {!preview && !swipeHandlers && (
          <View
            style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }]}
          >
            <View style={{ flex: 1 }}>
              <Button
                title={s.signed.includes(p.id) ? 'Signed · view' : 'View & sign'}
                onPress={() => router.push(`/petition/${p.id}`)}
                variant="primary"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? `Unsave ${p.title}` : `Save ${p.title}`}
              disabled={mutation.isPending}
              onPress={() =>
                s.profile
                  ? mutation.mutate({ type: 'save', petitionId: p.id })
                  : router.push('/(auth)/sign-in')
              }
              style={card.icon}
            >
              <Icon name={saved ? 'bookmark' : 'bookmark-outline'} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${p.title}`}
              onPress={() => {
                void sharePetition(p, s)
                  .then(setShareError)
                  .catch(() =>
                    setShareError('Sharing is unavailable. Copy the address from your browser.'),
                  );
              }}
              style={card.icon}
            >
              <Icon name="share-outline" />
            </Pressable>
          </View>
        )}
        {mutation.error && <Notice error text={mutation.error.message} />}
        {!!shareError && <Notice text={shareError} />}
      </View>
    </View>
  );
}
const card = StyleSheet.create({
  icon: {
    minWidth: 44,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
});

/**
 * Explore's list row: a horizontal card that fits five or six results on a phone screen where the
 * full card fits one. Same information hierarchy, image reduced to a colour cue.
 */
export function PetitionRow({
  petition: p,
  snapshot: s,
}: {
  petition: Petition;
  snapshot: Snapshot;
}) {
  const mutation = useCommand();
  const [now] = useState(Date.now);
  const saved = s.saved.includes(p.id);
  const days = Math.max(0, Math.ceil((Date.parse(p.deadline) - now) / 86400000));
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${p.title}`}
      onPress={() => router.push(`/petition/${p.id}`)}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: tokens.radius,
        overflow: 'hidden',
        ...tokens.shadow,
      }}
    >
      {/* The image column takes its height from the text beside it, so the image fills absolutely
          rather than contributing its own intrinsic height to the row. */}
      <View style={{ width: 98, backgroundColor: colors.pale, overflow: 'hidden' }}>
        <Image
          source={topicImages[p.topic]}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`${p.topic} — illustrative theme image, not petition evidence`}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, padding: 14, gap: 7 }}>
        <Text style={[styles.label, { fontSize: 10, letterSpacing: 1.2 }]}>{p.topic}</Text>
        <Text style={styles.cardTitle}>{p.title}</Text>
        <Text numberOfLines={2} style={styles.small}>
          {p.summary}
        </Text>
        <Text style={styles.micro}>To: {p.recipient}</Text>
        <Text style={styles.micro}>{verificationLabels[p.verification]}</Text>
        <Text style={styles.micro}>
          {p.city} · {days} days left
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Signature goal progress"
          accessibilityValue={{ min: 0, max: p.goal, now: Math.min(p.count, p.goal) }}
          style={{ height: 6, backgroundColor: colors.pale, borderRadius: 6, overflow: 'hidden' }}
        >
          <View
            style={{
              width: `${Math.min(100, (100 * p.count) / p.goal)}%`,
              height: '100%',
              backgroundColor: topicColors[p.topic].accent,
            }}
          />
        </View>
        <View style={[styles.between, { gap: 8 }]}>
          <Text style={styles.micro}>
            {p.count.toLocaleString()} of {p.goal.toLocaleString()}
            {p.sampleCount > 0 ? ' · sample counts' : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? `Unsave ${p.title}` : `Save ${p.title}`}
            disabled={mutation.isPending}
            hitSlop={12}
            onPress={(event) => {
              event.stopPropagation();
              if (s.profile) mutation.mutate({ type: 'save', petitionId: p.id });
              else router.push('/(auth)/sign-in');
            }}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={18} />
          </Pressable>
        </View>
        {mutation.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutation.error.message}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
