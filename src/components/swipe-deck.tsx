import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Petition, Snapshot } from '../domain/model';
import { PetitionCard } from './petition-card';
import { Button, Empty, colors, styles } from './ui';

export function SwipeDeck({ petitions, snapshot }: { petitions: Petition[]; snapshot: Snapshot }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [position] = useState(() => new Animated.Value(0));
  const origin = useRef({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const current = petitions.find((p) => !skipped.includes(p.id) && !snapshot.signed.includes(p.id));
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);
  function act(direction: 'skip' | 'review') {
    if (!current || busy) return;
    setBusy(true);
    const finish = () => {
      if (direction === 'skip') setSkipped((ids) => [...ids, current.id]);
      else router.push(`/petition/${current.id}`);
      position.setValue(0);
      setBusy(false);
    };
    if (reduceMotion) finish();
    else
      Animated.timing(position, {
        toValue: direction === 'skip' ? -360 : 360,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start(finish);
  }
  return (
    <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 }}>
      <View style={styles.between}>
        <Text style={styles.label}>DISCOVER YOUR NEXT CAUSE</Text>
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {
            petitions.filter((p) => !skipped.includes(p.id) && !snapshot.signed.includes(p.id))
              .length
          }{' '}
          to explore
        </Text>
      </View>
      {current ? (
        <>
          <View style={{ paddingTop: 12 }}>
            <View
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                top: 0,
                left: 16,
                right: 16,
                height: 120,
                borderRadius: 8,
                backgroundColor: colors.pale,
                transform: [{ rotate: '-2deg' }],
              }}
            />
            <Animated.View
              style={{
                transform: [
                  { translateX: position },
                  {
                    rotate: position.interpolate({
                      inputRange: [-300, 0, 300],
                      outputRange: ['-6deg', '0deg', '6deg'],
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
                  },
                  onResponderMove: (event) => {
                    const dx = event.nativeEvent.pageX - origin.current.x;
                    const dy = event.nativeEvent.pageY - origin.current.y;
                    if (Math.abs(dx) > Math.abs(dy) * 1.5 && !busy) position.setValue(dx);
                  },
                  onResponderRelease: (event) => {
                    const dx = event.nativeEvent.pageX - origin.current.x;
                    const dy = event.nativeEvent.pageY - origin.current.y;
                    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.5)
                      act(dx > 0 ? 'review' : 'skip');
                    else {
                      position.setValue(0);
                      if (Math.abs(dx) < 10 && Math.abs(dy) < 10)
                        router.push(`/petition/${current.id}`);
                    }
                  },
                  onResponderTerminationRequest: () => true,
                  onResponderTerminate: () => position.setValue(0),
                }}
              />
            </Animated.View>
          </View>
          <View style={[styles.row, { justifyContent: 'center' }]}>
            <Button
              title="Pass"
              icon="close-outline"
              variant="secondary"
              onPress={() => act('skip')}
            />
            <Button title="Review petition" icon="arrow-forward" onPress={() => act('review')} />
          </View>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Swipe left to pass · right to review. Signing always needs your confirmation.
          </Text>
        </>
      ) : (
        <Empty
          title="You’re all caught up"
          body="Choose another interest or revisit petitions you passed. Your signed petitions are in your profile."
        />
      )}
      {!!skipped.length && (
        <Button
          title="Undo last pass"
          variant="ghost"
          onPress={() => setSkipped((ids) => ids.slice(0, -1))}
        />
      )}
      {!current && !!skipped.length && (
        <Button
          title="Revisit passed petitions"
          variant="secondary"
          onPress={() => setSkipped([])}
        />
      )}
      <View style={{ height: 1, backgroundColor: colors.line }} />
    </View>
  );
}
