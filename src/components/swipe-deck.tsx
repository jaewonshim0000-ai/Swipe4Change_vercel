import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { backerNames, daysLeft, requirementLabel } from '../domain/discovery';
import { signingStatus } from '../domain/rules';
import {
  DeckItem,
  FederalRule,
  daysLeft as ruleDaysLeft,
  withFederalRules,
} from '../domain/federal';
import { recordSignal } from '../data/signals';
import { isExample } from '../data/provider';
import { share, useSave } from './petition-card';
import { Bar, Kicker, Press, Scrim, toast, petitionImage, topicImage } from './kit';
import { Glyph, GlyphName } from './glyph';
import { KindBadge } from './federal-card';
import { anim, haptic, kf, transition } from './motion';
import { colors, fonts, gradient, gradients, shadows } from './theme';

type Direction = 'pass' | 'support' | 'learn';
/** The design's release easing, `cubic-bezier(.2,.8,.2,1)` over 380ms. */
const release = { duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
/** A cancelled drag springs home with a slight overshoot instead of easing back. */
const snapBack = { damping: 15, stiffness: 190, mass: 0.9 };
/** Release speed, in points per millisecond, that commits a short drag. */
const FLICK = 0.6;
/** A petition card's three pages: the overview, the problem, the ask. */
const PAGES = 3;

/**
 * Which way a drag ended: far enough that way, or a quick flick that way. Null springs the card
 * back. Velocities are points per millisecond at release.
 */
export function swipeIntent(x: number, y: number, vx = 0, vy = 0): Direction | null {
  if (x > 100 || (x > 30 && vx > FLICK)) return 'support';
  if (x < -100 || (x < -30 && vx < -FLICK)) return 'pass';
  if (y < -90 || (y < -30 && vy < -FLICK && Math.abs(x) < 60)) return 'learn';
  return null;
}
const imageOf = (item: DeckItem) =>
  item.kind === 'petition' ? petitionImage(item.petition) : topicImage(item.rule.topic);
/** Petitions open their own page; federal rules open theirs, where commenting starts. */
const pageOf = (item: DeckItem) =>
  item.kind === 'petition' ? `/petition/${item.id}` : `/federal/${item.id}`;

/** Who can sign, in the few words the card's chip has room for, and whether you can. */
function eligibilityChip(p: Petition, s: Snapshot): { icon: GlyphName; text: string; ok: boolean } {
  const text = {
    account: 'Anyone can sign',
    email: 'Verified email',
    community: 'Members can sign',
    location: `${p.city.split(',')[0]} residents`,
    custom: 'Organizer review',
  }[p.verification];
  if (p.verification === 'custom') return { icon: 'clock', text, ok: false };
  if (!s.profile) return { icon: 'shield', text, ok: false };
  const ok = signingStatus(p, s, p.identities[0]).state === 'eligible';
  return { icon: ok ? 'shield' : 'lock', text, ok };
}

/** The design's outlined rubber stamp that fades in as the card heads one way. */
function Stamp({
  label,
  color,
  rotate,
  place,
  dx,
  dy,
  weight,
}: {
  label: string;
  color: string;
  rotate: number;
  place: ViewStyle;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  weight: (dx: number, dy: number) => number;
}) {
  const style = useAnimatedStyle(() => {
    const on = weight(dx.get(), dy.get());
    return { opacity: on, transform: [{ rotate: `${rotate}deg` }, { scale: 0.85 + 0.15 * on }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          zIndex: 4,
          top: 64,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 5,
          borderColor: color,
        },
        place,
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 40,
          lineHeight: 50,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/** The next card waiting behind, dimmed; it rises and brightens as the top card is dragged. */
function Behind({
  item,
  dx,
  dy,
}: {
  item: DeckItem;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
}) {
  const card = useAnimatedStyle(() => {
    const k = Math.min(1, Math.hypot(dx.get(), dy.get()) / 160);
    return { transform: [{ translateY: 10 - 10 * k }, { scale: 0.95 + 0.05 * k }] };
  });
  const shade = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.hypot(dx.get(), dy.get()) / 160),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 28, overflow: 'hidden', backgroundColor: colors.dark, zIndex: 1 },
        card,
      ]}
    >
      <Image source={imageOf(item)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, shade]}
      />
    </Animated.View>
  );
}

type ActionKind = 'undo' | 'pass' | 'save' | 'sign' | 'share';
const fills = {
  pass: [colors.heart, colors.heart],
  save: [colors.blue, colors.blue],
  sign: [colors.sage, colors.accent],
} as const;
/** The round action icons from the design, with their gradient fills. */
function ActionIcon({ kind }: { kind: ActionKind }) {
  if (kind === 'undo')
    return (
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
        <Path
          d="M3 4v6h6M3.5 15a8.5 8.5 0 1 0 2-8.8L3 10"
          stroke={colors.outline}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  if (kind === 'share')
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
        <Path
          d="M21.3 2.7 2.9 9.5c-.8.3-.8 1.4 0 1.7l7.2 2.7 2.7 7.2c.3.8 1.4.8 1.7 0l6.8-18.4c.3-.7-.4-1.3-1-1Z"
          fill={colors.muted}
        />
      </Svg>
    );
  const [a, b] = fills[kind];
  const paint = `url(#act-${kind})`;
  const size = kind === 'sign' ? 36 : kind === 'pass' ? 32 : 30;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Defs>
        <LinearGradient id={`act-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      {kind === 'pass' ? (
        <Path
          d="M5.5 5.5l13 13M18.5 5.5l-13 13"
          stroke={paint}
          strokeWidth={3.6}
          strokeLinecap="round"
        />
      ) : kind === 'save' ? (
        <Path
          d="M12 2.6l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 16.9l-5.6 2.9 1.1-6.2L3 9.2l6.2-.9z"
          fill={paint}
          stroke={paint}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M12 21s-7.6-4.6-9.7-9.4C.8 8.1 3 4.4 6.6 4c2-.2 3.9.8 5.4 2.7 1.5-1.9 3.4-2.9 5.4-2.7 3.6.4 5.8 4.1 4.3 7.6C19.6 16.4 12 21 12 21Z"
          fill={paint}
        />
      )}
    </Svg>
  );
}

/** One of the white round buttons floating at the foot of the card. */
function Action({
  kind,
  label,
  onPress,
  disabled = false,
  large = false,
  on = false,
}: {
  kind: ActionKind;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  large?: boolean;
  /** Saved: the star sits on a pale blue disc. */
  on?: boolean;
}) {
  const size = large ? 70 : 56;
  return (
    <Press
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: on }}
      disabled={disabled}
      scale={0.9}
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? colors.blueSoft : colors.white,
          borderWidth: 1,
          borderColor: on ? colors.blueLight : 'rgba(255,255,255,0.6)',
        },
        shadows.act,
      ]}
    >
      <ActionIcon kind={kind} />
    </Press>
  );
}

/** "684 of 1,000 · 18 days left" beside a short pale bar. */
function ProgressLine({ p, now }: { p: Petition; now: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <View style={{ width: 88 }}>
        <Bar
          pct={(100 * p.count) / p.goal}
          tone="light"
          height={6}
          label="Signature goal progress"
        />
      </View>
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.onImage }}
      >
        <Text style={{ fontFamily: fonts.bold, color: colors.white }}>
          {p.count.toLocaleString()}
        </Text>{' '}
        of {p.goal.toLocaleString()} · {daysLeft(p, now)} days left
      </Text>
    </View>
  );
}

const pageLabel = {
  fontFamily: fonts.bold,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  color: colors.pale,
  marginBottom: 6,
};
const metaRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  marginTop: 12,
};
const metaText = { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.onImage };

/** Web keyboard equivalents of the swipes, matching the desktop hint row. */
const keys: Record<string, Direction> = {
  ArrowLeft: 'pass',
  ArrowRight: 'support',
  ArrowUp: 'learn',
  Enter: 'learn',
};

export function SwipeDeck({
  petitions,
  rules = [],
  snapshot,
  reasons,
  hints = false,
}: {
  petitions: Petition[];
  /** Real federal proposals open for comment, mixed in as their own cards. */
  rules?: FederalRule[];
  snapshot: Snapshot;
  /** Why each petition is in the feed, keyed by id. */
  reasons?: Map<string, string[]>;
  /** The keyboard hint row under the deck (desktop). */
  hints?: boolean;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const origin = useRef({ x: 0, y: 0 });
  /** The latest drag sample, for release velocity, and the commit zone the drag is in. */
  const last = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0 });
  const zone = useRef<Direction | null>(null);
  const cardRef = useRef<View>(null);
  const infoRef = useRef<View>(null);
  const save = useSave(snapshot);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);
  const remaining = withFederalRules(petitions, rules).filter(
    (d) => !skipped.includes(d.id) && !(d.kind === 'petition' && snapshot.signed.includes(d.id)),
  );
  const current = remaining[0];
  const petition = current?.kind === 'petition' ? current.petition : undefined;
  const rule = current?.kind === 'federal' ? current.rule : undefined;
  // Each new card starts on its first page.
  const [shownId, setShownId] = useState(current?.id);
  if (current?.id !== shownId) {
    setShownId(current?.id);
    setPage(0);
  }
  const top = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.get() },
      { translateY: dy.get() },
      { rotate: `${dx.get() / 16}deg` },
    ],
  }));
  function settle(x: number, y: number) {
    dx.set(reduceMotion ? x : withTiming(x, release));
    dy.set(reduceMotion ? y : withTiming(y, release));
  }
  function springBack() {
    dx.set(reduceMotion ? 0 : withSpring(0, snapBack));
    dy.set(reduceMotion ? 0 : withSpring(0, snapBack));
  }
  function act(direction: Direction) {
    if (!current || busy) return;
    if (petition && !snapshot.profile && direction === 'support') {
      springBack();
      router.push('/(auth)/sign-in');
      return;
    }
    // Opening the petition logs its own signal there, so only the swipes are recorded here.
    if (petition && direction !== 'learn')
      void recordSignal(snapshot.profile, current.id, direction === 'pass' ? 'skip' : 'interested');
    const finish = () => {
      if (direction === 'pass') {
        setSkipped((ids) => [...ids, current.id]);
        toast('Passed. Nothing was signed.');
      }
      // Supporting opens the signing sheet: a swipe is intent, never a recorded signature.
      else if (direction === 'support' && petition) router.push(`/petition/${current.id}?sign=1`);
      else router.push(pageOf(current));
      dx.set(0);
      dy.set(0);
      setBusy(false);
    };
    if (reduceMotion) finish();
    else {
      setBusy(true);
      settle(
        direction === 'pass' ? -480 : direction === 'support' ? 480 : 0,
        direction === 'learn' ? -620 : 0,
      );
      setTimeout(finish, 300);
    }
  }
  const undo = () => setSkipped((ids) => ids.slice(0, -1));
  /** A tap on the photo steps through the pages (left half back, right half on); lower, it opens. */
  function tap(pageX: number, pageY: number) {
    if (!current) return;
    const card = cardRef.current;
    const info = infoRef.current;
    if (!petition || !card?.measure || !info?.measure) return router.push(pageOf(current));
    card.measure((_x, _y, width, _h, left) => {
      info.measure((_a, _b, _c, _d, _e, infoTop) => {
        if (pageY >= infoTop + 20) return router.push(pageOf(current));
        setPage((n) =>
          pageX - left > width / 2 ? Math.min(PAGES - 1, n + 1) : Math.max(0, n - 1),
        );
      });
    });
  }
  if (!current)
    return (
      <Animated.View
        style={[
          {
            flex: 1,
            minHeight: 360,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 32,
          },
          gradient(
            'radial-gradient(70% 50% at 50% 35%, rgba(228,230,195,0.9) 0%, rgba(228,230,195,0) 70%)',
          ),
          anim(kf.pop, 450, { ease: 'ease' }),
        ]}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 999,
            backgroundColor: colors.soft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="check" size={40} weight={2.4} color={colors.accent} />
        </View>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.bold,
            fontSize: 24,
            lineHeight: 30,
            color: colors.ink,
            marginTop: 8,
          }}
        >
          You’re all caught up
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 16,
            lineHeight: 24,
            color: colors.secondary,
            textAlign: 'center',
            maxWidth: 300,
            marginBottom: 8,
          }}
        >
          Signed petitions live in your profile. Browse Explore, or look again at the ones you
          passed.
        </Text>
        <Press
          accessibilityRole="link"
          accessibilityLabel="Explore more petitions"
          onPress={() => router.push('/(tabs)/explore')}
          style={[
            {
              minHeight: 56,
              paddingHorizontal: 24,
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.dark,
            },
            gradient(gradients.sign),
            shadows.button,
          ]}
        >
          <Glyph name="compass" size={20} color={colors.white} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>
            Explore more
          </Text>
        </Press>
        {!!skipped.length && (
          <Press
            accessibilityLabel="Revisit passed"
            onPress={() => setSkipped([])}
            style={{
              minHeight: 48,
              paddingHorizontal: 18,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Glyph name="refresh" size={18} color={colors.secondary} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.secondary }}>
              Revisit passed
            </Text>
          </Press>
        )}
      </Animated.View>
    );
  const saved = snapshot.saved.includes(current.id);
  const community = petition && snapshot.communities.find((c) => c.id === petition.communityId);
  const next = remaining[1];
  const signWord = rule ? 'Comment' : 'Sign';
  const chip = petition && eligibilityChip(petition, snapshot);
  const backed = petition ? backerNames(petition, snapshot.communities) : [];
  const reason = reasons?.get(current.id)?.[0];
  return (
    <View style={{ flex: 1, minHeight: 440 }}>
      <View style={{ flex: 1 }}>
        {next && <Behind key={next.id} item={next} dx={dx} dy={dy} />}
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 5 }, top]}>
          <View
            ref={cardRef}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              petition
                ? `${petition.title}. ${petition.action}. ${petition.city}, ${requirementLabel(petition, snapshot.communities)}. ${petition.count.toLocaleString()} of ${petition.goal.toLocaleString()} signatures, ${daysLeft(petition, now)} days left.`
                : `Federal proposal: ${rule!.title}. ${rule!.agency}. Open for comment, ${ruleDaysLeft(rule!.closesOn, now)} days left.`
            }
            accessibilityHint={`Swipe left to pass, right to ${signWord.toLowerCase()} or up to read. More actions are available.`}
            accessibilityActions={[
              { name: 'activate', label: 'Read' },
              { name: 'pass', label: 'Pass' },
              { name: 'sign', label: signWord },
              ...(petition ? [{ name: 'save', label: saved ? 'Unsave' : 'Save' }] : []),
            ]}
            onAccessibilityAction={(e) => {
              const name = e.nativeEvent.actionName;
              if (name === 'save') {
                if (petition) save(petition);
              } else act(name === 'pass' ? 'pass' : name === 'sign' ? 'support' : 'learn');
            }}
            {...(Platform.OS === 'web'
              ? ({
                  focusable: true,
                  onKeyDown: (e: { key: string; preventDefault: () => void }) => {
                    if (e.key === ' ' && petition) {
                      e.preventDefault();
                      setPage((n) => (n + 1) % PAGES);
                    } else if ((e.key === 'z' || e.key === 'Z') && skipped.length) undo();
                    if (!keys[e.key]) return;
                    e.preventDefault();
                    act(keys[e.key]);
                  },
                } as unknown as ViewProps)
              : null)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              last.current = { x: 0, y: 0, t: e.nativeEvent.timestamp, vx: 0, vy: 0 };
              zone.current = null;
            }}
            onResponderMove={(e) => {
              if (busy) return;
              const x = e.nativeEvent.pageX - origin.current.x;
              const y = e.nativeEvent.pageY - origin.current.y;
              const t = e.nativeEvent.timestamp;
              const dt = Math.max(1, t - last.current.t);
              last.current = {
                x,
                y,
                t,
                vx: (x - last.current.x) / dt,
                vy: (y - last.current.y) / dt,
              };
              // A tick each time the drag crosses into a commit zone, so letting go is no surprise.
              const into = swipeIntent(x, y);
              if (into !== zone.current) {
                if (into) haptic('tick');
                zone.current = into;
              }
              dx.set(x);
              dy.set(Math.min(40, y));
            }}
            onResponderRelease={(e) => {
              const x = e.nativeEvent.pageX - origin.current.x;
              const y = e.nativeEvent.pageY - origin.current.y;
              // A finger that stopped before lifting has no flick left in it.
              const moving = e.nativeEvent.timestamp - last.current.t < 80;
              const intent = swipeIntent(
                x,
                y,
                moving ? last.current.vx : 0,
                moving ? last.current.vy : 0,
              );
              if (intent) {
                if (intent !== zone.current) haptic('tick');
                act(intent);
              } else {
                springBack();
                if (Math.abs(x) < 6 && Math.abs(y) < 6)
                  tap(e.nativeEvent.pageX, e.nativeEvent.pageY);
              }
            }}
            onResponderTerminationRequest={() => false}
            onResponderTerminate={() => springBack()}
            style={[
              { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.dark },
              shadows.deck,
              Platform.OS === 'web'
                ? ({ cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle)
                : null,
            ]}
          >
            <Animated.Image
              source={imageOf(current)}
              resizeMode="cover"
              accessibilityLabel="Illustrative image, not petition evidence"
              style={[
                StyleSheet.absoluteFill,
                { width: '100%', height: '100%' },
                // Deeper pages draw the photo in, as the design does.
                { transform: [{ scale: 1 + page * 0.1 }, { translateY: -page * 12 }] },
                transition(['transform'], 600),
              ]}
            />
            <Scrim
              stops={
                page
                  ? 'rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.94) 72%, rgba(0,0,0,1) 100%'
                  : 'rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 36%, rgba(0,0,0,0.6) 58%, rgba(0,0,0,0.9) 82%, rgba(0,0,0,0.96) 100%'
              }
            />
            <View style={{ position: 'absolute', top: 14, left: 14, zIndex: 3 }}>
              <KindBadge
                kind={petition ? (isExample(petition.id) ? 'example' : 'petition') : 'federal'}
              />
            </View>
            {petition && (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  position: 'absolute',
                  zIndex: 3,
                  top: 20,
                  alignSelf: 'center',
                  width: 96,
                  flexDirection: 'row',
                  gap: 4,
                }}
              >
                {Array.from({ length: PAGES }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 4,
                      backgroundColor: i === page ? colors.white : 'rgba(255,255,255,0.35)',
                    }}
                  />
                ))}
              </View>
            )}
            <Stamp
              label={signWord}
              color={colors.pale}
              rotate={-16}
              place={{ left: 24 }}
              dx={dx}
              dy={dy}
              weight={(x) => {
                'worklet';
                return x > 20 ? Math.min(1, x / 110) : 0;
              }}
            />
            <Stamp
              label="Pass"
              color={colors.heartLight}
              rotate={16}
              place={{ right: 24 }}
              dx={dx}
              dy={dy}
              weight={(x) => {
                'worklet';
                return x < -20 ? Math.min(1, -x / 110) : 0;
              }}
            />
            <Stamp
              label="Read"
              color={colors.blueLight}
              rotate={-8}
              place={{ top: '38%', alignSelf: 'center' }}
              dx={dx}
              dy={dy}
              weight={(x, y) => {
                'worklet';
                return y < -30 && Math.abs(x) < 60 ? Math.min(1, -y / 120) : 0;
              }}
            />
            <View
              ref={infoRef}
              style={{
                position: 'absolute',
                zIndex: 2,
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 18,
                paddingBottom: 112,
              }}
            >
              {petition ? (
                <>
                  <View style={{ marginBottom: 6 }}>
                    <Kicker
                      light
                      topic={petition.topic}
                      text={`${community?.name ?? petition.city} · ${petition.topic}`}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                    <Text
                      accessibilityRole="header"
                      numberOfLines={page ? 2 : 3}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: fonts.bold,
                        fontSize: 30,
                        lineHeight: 34,
                        letterSpacing: -0.7,
                        color: colors.white,
                        textShadowColor: 'rgba(0,0,0,0.35)',
                        textShadowOffset: { width: 0, height: 2 },
                        textShadowRadius: 18,
                      }}
                    >
                      {petition.title}
                    </Text>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="Open full petition"
                      onPress={() => router.push(pageOf(current))}
                      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => ({
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: hovered ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.35)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.75)',
                      })}
                    >
                      <Glyph name="up" size={22} weight={2.4} color={colors.white} />
                    </Pressable>
                  </View>
                  <Animated.View key={page} style={anim(kf.tickA, 300)}>
                    {page === 0 && (
                      <>
                        <ProgressLine p={petition} now={now} />
                        {chip && (
                          <View
                            style={{
                              alignSelf: 'flex-start',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              height: 38,
                              marginTop: 12,
                              paddingHorizontal: 16,
                              borderRadius: 999,
                              backgroundColor: 'rgba(28,31,25,0.78)',
                            }}
                          >
                            <Glyph name={chip.icon} size={18} weight={2} color={colors.white} />
                            <Text
                              style={{
                                fontFamily: fonts.medium,
                                fontSize: 15,
                                color: colors.white,
                              }}
                            >
                              {chip.text}
                            </Text>
                            {chip.ok && (
                              <Glyph name="check" size={18} weight={3} color={colors.pale} />
                            )}
                          </View>
                        )}
                        {(!!backed.length || !!reason) && (
                          <Text
                            numberOfLines={2}
                            style={{
                              fontFamily: fonts.medium,
                              fontSize: 13,
                              lineHeight: 18,
                              color: colors.onDark,
                              marginTop: 10,
                            }}
                          >
                            {backed.length ? `★ Backed by ${backed.join(', ')}` : `✦ ${reason}`}
                          </Text>
                        )}
                      </>
                    )}
                    {page === 1 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={pageLabel}>The problem</Text>
                        <Text
                          numberOfLines={5}
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 16,
                            lineHeight: 24,
                            color: 'rgba(255,255,255,0.9)',
                          }}
                        >
                          {petition.problem}
                        </Text>
                        <View style={metaRow}>
                          <Glyph name="pin" size={18} color={colors.onImage} />
                          <Text numberOfLines={1} style={metaText}>
                            {petition.city}
                          </Text>
                        </View>
                      </View>
                    )}
                    {page === 2 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={pageLabel}>The ask</Text>
                        <Text
                          numberOfLines={4}
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 20,
                            lineHeight: 27,
                            color: colors.white,
                          }}
                        >
                          {petition.action}
                        </Text>
                        <View style={metaRow}>
                          <Glyph name="landmark" size={18} color={colors.onImage} />
                          <Text numberOfLines={1} style={metaText}>
                            To {petition.recipient}
                          </Text>
                        </View>
                        <ProgressLine p={petition} now={now} />
                      </View>
                    )}
                  </Animated.View>
                </>
              ) : (
                rule && (
                  <>
                    <View style={{ marginBottom: 6 }}>
                      <Kicker light topic={rule.topic} text={`${rule.agency} · ${rule.topic}`} />
                    </View>
                    <Text
                      accessibilityRole="header"
                      numberOfLines={4}
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 26,
                        lineHeight: 32,
                        letterSpacing: -0.5,
                        color: colors.white,
                      }}
                    >
                      {rule.title}
                    </Text>
                    {!!rule.summary && (
                      <Text
                        numberOfLines={3}
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 15,
                          lineHeight: 22,
                          color: colors.onImage,
                          marginTop: 8,
                        }}
                      >
                        {rule.summary}
                      </Text>
                    )}
                    <View style={metaRow}>
                      <Glyph name="clock" size={18} color={colors.onImage} />
                      <Text numberOfLines={1} style={metaText}>
                        {ruleDaysLeft(rule.closesOn, now)} days left · applies nationwide
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.medium,
                        fontSize: 13,
                        lineHeight: 18,
                        color: colors.onDark,
                        marginTop: 10,
                      }}
                    >
                      ✦ A real federal proposal. You comment on the official site, not here.
                    </Text>
                  </>
                )
              )}
            </View>
          </View>
        </Animated.View>
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            zIndex: 9,
            left: 0,
            right: 0,
            bottom: 20,
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            paddingHorizontal: 8,
          }}
        >
          <Action kind="undo" label="Undo last pass" disabled={!skipped.length} onPress={undo} />
          <Action kind="pass" label="Pass" large onPress={() => act('pass')} />
          {petition && (
            <Action
              kind="save"
              label={saved ? 'Unsave' : 'Save'}
              on={saved}
              onPress={() => save(petition)}
            />
          )}
          <Action kind="sign" label={signWord} large onPress={() => act('support')} />
          {petition && (
            <Action kind="share" label="Share" onPress={() => void share(petition, snapshot)} />
          )}
        </View>
      </View>
      {hints && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            paddingTop: 16,
          }}
        >
          {[
            ['←', 'Pass'],
            ['→', signWord],
            ['↑', 'Read'],
            ['Space', 'Next detail'],
            ['Z', 'Undo'],
          ].map(([k, l]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  minWidth: 24,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.handle,
                  backgroundColor: colors.white,
                  textAlign: 'center',
                  overflow: 'hidden',
                  fontFamily: fonts.semibold,
                  fontSize: 12,
                  color: colors.ink,
                }}
              >
                {k}
              </Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>
                {l}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
