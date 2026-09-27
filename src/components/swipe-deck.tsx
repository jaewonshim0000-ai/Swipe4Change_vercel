import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { useCommand } from '../data/provider';
import { PetitionCard, sharePetition } from './petition-card';
import { Button, Icon, Notice, Toast, colors, fonts, styles, tokens } from './ui';

/** Drag distance that commits a swipe, and the tilt the card takes on the way. */
const COMMIT = 90;
const TILT_SPAN = 260;
const TILT_DEG = TILT_SPAN / 26;

/** Directions the deck understands, and what each one means. */
const gestures = {
  support: { label: 'Interested', color: colors.accent, side: 'left', rotate: '8deg' },
  pass: { label: 'Not for me', color: colors.error, side: 'right', rotate: '-8deg' },
  learn: { label: 'Read petition', color: colors.orange, side: 'center', rotate: '0deg' },
} as const;
type Direction = keyof typeof gestures;

/** The stamp that fades in as you drag, mirroring the direction the card is heading. */
function DragBadge({
  direction,
  progress,
}: {
  direction: Direction;
  progress: Animated.AnimatedInterpolation<number>;
}) {
  const g = gestures[direction];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 14,
        ...(g.side === 'center'
          ? { alignSelf: 'center' }
          : g.side === 'left'
            ? { left: 12 }
            : { right: 12 }),
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: g.color,
        backgroundColor: colors.white,
        transform: [{ rotate: g.rotate }],
        opacity: progress,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 13,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: g.color,
        }}
      >
        {g.label}
      </Text>
    </Animated.View>
  );
}

function DeckAction({
  label,
  icon,
  onPress,
  tone = 'plain',
  disabled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  tone?: 'plain' | 'selected' | 'primary';
  disabled?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 5, width: 68 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: tone === 'primary' ? 0 : 1,
          borderColor: colors.line,
          backgroundColor:
            tone === 'primary' ? colors.sage : tone === 'selected' ? colors.pale : colors.white,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        })}
      >
        <Icon
          name={icon}
          size={21}
          color={tone === 'primary' ? colors.ink : tone === 'plain' ? colors.muted : colors.accent}
        />
      </Pressable>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export function SwipeDeck({ petitions, snapshot }: { petitions: Petition[]; snapshot: Snapshot }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [x] = useState(() => new Animated.Value(0));
  const [y] = useState(() => new Animated.Value(0));
  const origin = useRef({ x: 0, y: 0 });
  const axis = useRef<'x' | 'y' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const mutation = useCommand();
  const [showHelp, setShowHelp] = useState(false);
  const helpKey = `swipe4change.swipe-help.${snapshot.profile?.id ?? 'guest'}`;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(helpKey)
      .then((value) => {
        if (active) setShowHelp(value !== 'seen');
      })
      .catch(() => {
        if (active) setShowHelp(true);
      });
    return () => {
      active = false;
    };
  }, [helpKey]);
  const remaining = petitions.filter(
    (p) => !skipped.includes(p.id) && !snapshot.signed.includes(p.id),
  );
  const current = remaining[0];
  const saved = !!current && snapshot.saved.includes(current.id);
  const following = !!current && snapshot.following.includes(current.id);
  const volunteered = !!current && snapshot.volunteering.some((v) => v.petitionId === current.id);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);
  function reset() {
    x.setValue(0);
    y.setValue(0);
    axis.current = null;
  }
  function act(direction: Direction) {
    if (!current || busy) return;
    if (!snapshot.profile && direction === 'support') {
      router.push('/(auth)/sign-in');
      reset();
      return;
    }
    setBusy(true);
    const finish = () => {
      if (direction === 'pass') setSkipped((ids) => [...ids, current.id]);
      // Supporting opens the signing sheet: a swipe is intent, never a recorded signature.
      else if (direction === 'support') router.push(`/petition/${current.id}?sign=1`);
      else router.push(`/petition/${current.id}`);
      reset();
      setBusy(false);
    };
    if (reduceMotion) finish();
    else
      Animated.timing(direction === 'learn' ? y : x, {
        toValue: direction === 'pass' ? -360 : direction === 'support' ? 360 : -360,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start(finish);
  }
  function toggle(type: 'save' | 'follow', on: boolean) {
    if (!current) return;
    if (!snapshot.profile) {
      router.push('/(auth)/sign-in');
      return;
    }
    const messages = {
      save: on ? 'Removed from saved.' : 'Saved to read later.',
      follow: on ? 'Unfollowed. No more updates.' : 'Following. Updates reach your inbox.',
    };
    mutation.mutate(
      { type, petitionId: current.id },
      { onSuccess: () => setToast(messages[type]) },
    );
  }
  return (
    <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12 }}>
      <View style={styles.between}>
        <Text style={styles.label}>DISCOVER YOUR NEXT CAUSE</Text>
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          {remaining.length} to explore
        </Text>
      </View>
      {showHelp && (
        <View
          style={{ backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16, gap: 8 }}
        >
          <Text style={styles.h3}>A swipe is just a starting point.</Text>
          <Text style={styles.small}>
            Left: Not for me. Right: Interested. Up: Read the petition. Interested opens a review;
            only your explicit confirmation records a signature. The buttons do the same things.
          </Text>
          <Button
            title="Got it"
            variant="ghost"
            onPress={() => {
              setShowHelp(false);
              void AsyncStorage.setItem(helpKey, 'seen').catch(() => undefined);
            }}
          />
        </View>
      )}
      {current ? (
        <>
          <View style={{ paddingTop: 8 }}>
            {/* Two resting cards hint at the depth of the stack. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 8,
                left: 14,
                right: 14,
                height: 110,
                borderRadius: tokens.radius,
                backgroundColor: colors.pale,
                transform: [{ rotate: '-2deg' }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 4,
                left: 8,
                right: 8,
                height: 110,
                borderRadius: tokens.radius,
                backgroundColor: '#EFF0DC',
                borderWidth: 1,
                borderColor: colors.line,
              }}
            />
            <Animated.View
              style={{
                position: 'relative',
                transform: [
                  { translateX: x },
                  { translateY: y },
                  {
                    rotate: x.interpolate({
                      inputRange: [-TILT_SPAN, 0, TILT_SPAN],
                      outputRange: [`-${TILT_DEG}deg`, '0deg', `${TILT_DEG}deg`],
                    }),
                  },
                ],
              }}
            >
              <PetitionCard
                key={current.id}
                petition={current}
                snapshot={snapshot}
                showReason
                swipeHandlers={{
                  onStartShouldSetResponderCapture: () => true,
                  onStartShouldSetResponder: () => true,
                  onResponderGrant: (event) => {
                    origin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
                    axis.current = null;
                  },
                  onResponderMove: (event) => {
                    if (busy) return;
                    const dx = event.nativeEvent.pageX - origin.current.x;
                    const dy = event.nativeEvent.pageY - origin.current.y;
                    // Lock to whichever axis the drag commits to first, so a diagonal wobble
                    // cannot fire "learn more" while the reader is aiming at "support".
                    if (!axis.current && Math.abs(dx) + Math.abs(dy) > 12)
                      axis.current = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x';
                    if (axis.current === 'x') x.setValue(dx);
                    else if (axis.current === 'y') y.setValue(Math.min(0, dy));
                  },
                  onResponderRelease: (event) => {
                    const dx = event.nativeEvent.pageX - origin.current.x;
                    const dy = event.nativeEvent.pageY - origin.current.y;
                    // The release delta decides. The axis captured during the drag only keeps the
                    // card from jumping mid-gesture, so a release without moves still commits.
                    const settled = axis.current ?? (Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x');
                    if (settled === 'y' && dy < -COMMIT) act('learn');
                    else if (settled === 'x' && dx > COMMIT) act('support');
                    else if (settled === 'x' && dx < -COMMIT) act('pass');
                    else {
                      reset();
                      if (Math.abs(dx) < 10 && Math.abs(dy) < 10)
                        router.push(`/petition/${current.id}`);
                    }
                  },
                  onResponderTerminationRequest: () => true,
                  onResponderTerminate: reset,
                }}
              />
              <DragBadge
                direction="pass"
                progress={x.interpolate({
                  inputRange: [-COMMIT, -20, 0],
                  outputRange: [1, 0, 0],
                  extrapolate: 'clamp',
                })}
              />
              <DragBadge
                direction="support"
                progress={x.interpolate({
                  inputRange: [0, 20, COMMIT],
                  outputRange: [0, 0, 1],
                  extrapolate: 'clamp',
                })}
              />
              <DragBadge
                direction="learn"
                progress={y.interpolate({
                  inputRange: [-COMMIT, -20, 0],
                  outputRange: [1, 0, 0],
                  extrapolate: 'clamp',
                })}
              />
            </Animated.View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
              paddingTop: 14,
            }}
          >
            <DeckAction label="Not for me" icon="close" onPress={() => act('pass')} />
            <DeckAction
              label="Read petition"
              icon="arrow-up"
              tone="selected"
              onPress={() => act('learn')}
            />
            <DeckAction
              label="Save"
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              tone={saved ? 'selected' : 'plain'}
              disabled={mutation.isPending}
              onPress={() => toggle('save', saved)}
            />
            <DeckAction
              label="Interested"
              icon="checkmark"
              tone="primary"
              onPress={() => act('support')}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
              paddingTop: 2,
            }}
          >
            <Button
              title={following ? 'Following' : 'Follow'}
              icon={following ? 'notifications' : 'notifications-outline'}
              variant="ghost"
              disabled={mutation.isPending}
              onPress={() => toggle('follow', following)}
            />
            <Button
              title={volunteered ? 'Helping' : 'Volunteer'}
              icon="hand-left-outline"
              variant="ghost"
              onPress={() =>
                snapshot.profile
                  ? router.push(`/petition/${current.id}?volunteer=1`)
                  : router.push('/(auth)/sign-in')
              }
            />
            <Button
              title="Share"
              icon="share-outline"
              variant="ghost"
              onPress={() => {
                void sharePetition(current)
                  .then(setToast)
                  .catch(() =>
                    setToast('Sharing is unavailable. Copy the address from your browser.'),
                  );
              }}
            />
          </View>
        </>
      ) : (
        <View
          style={[styles.card, { alignItems: 'center', padding: 34, gap: 12, marginBottom: 10 }]}
        >
          <Icon name="leaf-outline" size={30} />
          <Text accessibilityRole="header" style={styles.h3}>
            You’re all caught up
          </Text>
          <Text style={[styles.small, { textAlign: 'center' }]}>
            Choose another interest or revisit petitions you passed. Signed petitions live in your
            profile.
          </Text>
          {!!skipped.length && (
            <Button
              title="Revisit passed petitions"
              variant="secondary"
              onPress={() => setSkipped([])}
            />
          )}
        </View>
      )}
      {!!skipped.length && current && (
        <Button
          title="Undo last pass"
          variant="ghost"
          onPress={() => setSkipped((ids) => ids.slice(0, -1))}
        />
      )}
      {mutation.error && <Notice error text={mutation.error.message} />}
      <Toast text={toast} onDone={() => setToast('')} />
    </View>
  );
}
