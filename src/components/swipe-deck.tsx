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
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { backerNames, daysLeft, milestoneLabel, requirementLabel } from '../domain/discovery';
import {
  DeckItem,
  FederalRule,
  daysLeft as ruleDaysLeft,
  withFederalRules,
} from '../domain/federal';
import { recordSignal } from '../data/signals';
import { useSave } from './petition-card';
import { Bar, GlassPill, Press, Scrim, TopicPill, toast, petitionImage, topicImage } from './kit';
import { Glyph } from './glyph';
import { KindBadge } from './federal-card';
import { anim, kf } from './motion';
import { colors, fonts } from './theme';

type Direction = 'pass' | 'support' | 'learn';
/** The design's release easing, `cubic-bezier(.2,.8,.2,1)` over 380ms. */
const release = { duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
const imageOf = (item: DeckItem) =>
  item.kind === 'petition' ? petitionImage(item.petition) : topicImage(item.rule.topic);
/** Petitions open their own page; federal rules open theirs, where commenting starts. */
const pageOf = (item: DeckItem) =>
  item.kind === 'petition' ? `/petition/${item.id}` : `/federal/${item.id}`;

/** The rubber stamp that fades in as the card heads one way. */
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
    return { opacity: on, transform: [{ rotate: `${rotate}deg` }, { scale: 0.8 + 0.2 * on }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 70,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: color,
          backgroundColor: 'rgba(255,255,255,0.92)',
        },
        place,
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 16,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/** One of the two cards resting behind the top card; they rise as it is dragged away. */
function Behind({
  item,
  depth,
  dx,
  dy,
}: {
  item: DeckItem;
  depth: 1 | 2;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const prog = Math.min(1, Math.hypot(dx.get(), dy.get()) / 160);
    return {
      opacity: depth === 2 ? 0.6 + 0.4 * prog : 1,
      transform: [
        { translateY: depth * 16 - 16 * prog },
        { scale: 1 - depth * 0.055 + 0.055 * prog },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: colors.dark,
          transformOrigin: '50% 100%',
          zIndex: 3 - depth,
        },
        style,
      ]}
    >
      <Image source={imageOf(item)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,20,15,0.25)' }]} />
    </Animated.View>
  );
}

/** Web keyboard equivalents of the swipes, matching the on-screen hint. */
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
}: {
  petitions: Petition[];
  /** Real federal proposals open for comment, mixed in as their own cards. */
  rules?: FederalRule[];
  snapshot: Snapshot;
  /** Why each petition is in the feed, keyed by id. */
  reasons?: Map<string, string[]>;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const origin = useRef({ x: 0, y: 0 });
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
  const top = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.get() },
      { translateY: dy.get() },
      { rotate: `${dx.get() / 18}deg` },
    ],
  }));
  function settle(x: number, y: number) {
    dx.set(reduceMotion ? x : withTiming(x, release));
    dy.set(reduceMotion ? y : withTiming(y, release));
  }
  function act(direction: Direction) {
    if (!current || busy) return;
    if (petition && !snapshot.profile && direction === 'support') {
      settle(0, 0);
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
  if (!current)
    return (
      <Animated.View
        style={[
          {
            minHeight: 300,
            borderRadius: 30,
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 28,
          },
          anim(kf.pop, 450, { ease: 'ease' }),
        ]}
      >
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.heading, fontSize: 21, lineHeight: 26, color: colors.ink }}
        >
          You’re all caught up
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 13,
            lineHeight: 20,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          Signed petitions live in your profile. Want another look at the ones you passed?
        </Text>
        {!!skipped.length && (
          <Press
            accessibilityLabel="Revisit passed"
            onPress={() => setSkipped([])}
            style={{
              backgroundColor: colors.dark,
              minHeight: 46,
              paddingHorizontal: 20,
              borderRadius: 999,
              justifyContent: 'center',
              marginTop: 6,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>
              Revisit passed
            </Text>
          </Press>
        )}
        <Press
          accessibilityRole="link"
          accessibilityLabel="Explore more petitions"
          onPress={() => router.push('/(tabs)/explore')}
          style={{
            backgroundColor: colors.soft,
            minHeight: 46,
            paddingHorizontal: 20,
            borderRadius: 999,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
            Explore more →
          </Text>
        </Press>
      </Animated.View>
    );
  const saved = snapshot.saved.includes(current.id);
  const community = petition && snapshot.communities.find((c) => c.id === petition.communityId);
  const behind = remaining.slice(1, 3);
  const signWord = rule ? 'Comment' : 'Sign';
  return (
    <View>
      <View style={{ height: 452 }}>
        {behind
          .map((d, i) => <Behind key={d.id} item={d} depth={(i + 1) as 1 | 2} dx={dx} dy={dy} />)
          .reverse()}
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 5 }, top]}>
          {/* No buttons under the card: screen readers get these as actions, and the web
              keyboard gets the arrow keys from the hint below. */}
          <View
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
            }}
            onResponderMove={(e) => {
              if (busy) return;
              dx.set(e.nativeEvent.pageX - origin.current.x);
              dy.set(Math.min(40, e.nativeEvent.pageY - origin.current.y));
            }}
            onResponderRelease={(e) => {
              const x = e.nativeEvent.pageX - origin.current.x;
              const y = e.nativeEvent.pageY - origin.current.y;
              if (x > 100) act('support');
              else if (x < -100) act('pass');
              else if (y < -90) act('learn');
              else {
                settle(0, 0);
                if (Math.abs(x) < 6 && Math.abs(y) < 6) router.push(pageOf(current));
              }
            }}
            onResponderTerminationRequest={() => false}
            onResponderTerminate={() => settle(0, 0)}
            style={[
              {
                flex: 1,
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: colors.dark,
                boxShadow: '0px 24px 44px -24px rgba(32,38,26,0.6)',
              },
              Platform.OS === 'web'
                ? ({ cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle)
                : null,
            ]}
          >
            <Image
              source={imageOf(current)}
              resizeMode="cover"
              accessibilityLabel="Illustrative theme image, not petition evidence"
              style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
            />
            <Scrim stops="rgba(18,20,15,0.3) 0%, rgba(18,20,15,0) 24%, rgba(18,20,15,0.55) 50%, rgba(18,20,15,0.94) 100%" />
            <View
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                right: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <GlassPill
                text={petition ? (community?.name ?? petition.city) : 'Open for comment'}
              />
              <GlassPill
                text={`${petition ? daysLeft(petition, now) : ruleDaysLeft(rule!.closesOn, now)} days left`}
              />
            </View>
            <Stamp
              label={signWord}
              color={colors.success}
              rotate={-12}
              place={{ left: 22 }}
              dx={dx}
              dy={dy}
              weight={(x) => {
                'worklet';
                return x > 20 ? Math.min(1, x / 100) : 0;
              }}
            />
            <Stamp
              label="Pass"
              color={colors.heart}
              rotate={12}
              place={{ right: 22 }}
              dx={dx}
              dy={dy}
              weight={(x) => {
                'worklet';
                return x < -20 ? Math.min(1, -x / 100) : 0;
              }}
            />
            <Stamp
              label="Read"
              color={colors.blue}
              rotate={0}
              place={{ left: '50%', marginLeft: -40, top: 110 }}
              dx={dx}
              dy={dy}
              weight={(x, y) => {
                'worklet';
                return y < -30 && Math.abs(x) < 60 ? Math.min(1, -y / 110) : 0;
              }}
            />
            <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, gap: 9 }}>
              {petition ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <KindBadge kind="petition" />
                    <TopicPill topic={petition.topic} />
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 27,
                      lineHeight: 30,
                      letterSpacing: -0.9,
                      color: colors.white,
                    }}
                  >
                    {petition.title}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 13,
                      lineHeight: 19.5,
                      color: colors.onImage,
                    }}
                  >
                    {petition.action}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Glyph name="pin" size={12} weight={2} color={colors.pale} />
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontFamily: fonts.body,
                        fontSize: 12,
                        color: colors.onImage,
                      }}
                    >
                      {petition.city} · {requirementLabel(petition, snapshot.communities)}
                    </Text>
                  </View>
                  <View style={{ marginTop: 2 }}>
                    <Bar
                      pct={(100 * petition.count) / petition.goal}
                      tone="light"
                      label="Signature goal progress"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.white }}>
                      {petition.count.toLocaleString()} of {petition.goal.toLocaleString()}
                    </Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.pale }}>
                      {milestoneLabel(petition)}
                    </Text>
                  </View>
                  {backerNames(petition, snapshot.communities).length > 0 && (
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}
                    >
                      ★ Backed by {backerNames(petition, snapshot.communities).join(', ')}
                    </Text>
                  )}
                </>
              ) : (
                rule && (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <KindBadge kind="federal" />
                      <TopicPill topic={rule.topic} />
                    </View>
                    <Text
                      accessibilityRole="header"
                      numberOfLines={4}
                      style={{
                        fontFamily: fonts.heading,
                        fontSize: 24,
                        lineHeight: 28,
                        letterSpacing: -0.8,
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
                          fontSize: 13,
                          lineHeight: 19.5,
                          color: colors.onImage,
                        }}
                      >
                        {rule.summary}
                      </Text>
                    )}
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 12,
                        lineHeight: 17,
                        color: colors.onImage,
                      }}
                    >
                      {rule.agency} · applies nationwide
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 12,
                        lineHeight: 16,
                        color: colors.onDark,
                      }}
                    >
                      ✦ A real federal proposal. You comment on the official site, not here.
                    </Text>
                  </>
                )
              )}
              {!!reasons?.get(current.id)?.[0] && (
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 12,
                    lineHeight: 16,
                    color: colors.onDark,
                    paddingTop: 2,
                  }}
                >
                  ✦ {reasons.get(current.id)?.[0]}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          minHeight: 36,
          // Clears the cards behind, which peek out up to 32pt below the top card.
          paddingTop: 44,
        }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.outline }}>
          ← pass · ↑ read · {signWord.toLowerCase()} →
        </Text>
        {!!skipped.length && (
          <Animated.View style={anim(kf.pop, 300, { ease: 'ease' })}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo last pass"
              onPress={() => setSkipped((ids) => ids.slice(0, -1))}
              style={{
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.accent }}>
                ↺ Undo
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
