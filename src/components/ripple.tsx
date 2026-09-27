import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Petition, Snapshot } from '../domain/model';
import { rippleTotal } from '../domain/ripple';
import { sharePetition } from './petition-card';
import { Button, Panel, colors, fonts, styles } from './ui';

/*
 * Arriving through someone's link and signing later still credits them, so the code is kept per
 * petition until a signature uses it. Storage failures only cost the attribution, never the
 * signature, so every call swallows them.
 */
const viaKey = (petitionId: string) => `swipe4change.via.${petitionId}`;
export const rememberVia = (petitionId: string, code: string) =>
  AsyncStorage.setItem(viaKey(petitionId), code).catch(() => undefined);
export const recallVia = (petitionId: string) =>
  AsyncStorage.getItem(viaKey(petitionId)).catch(() => null);
export const forgetVia = (petitionId: string) =>
  AsyncStorage.removeItem(viaKey(petitionId)).catch(() => undefined);

/** You at the centre, the people you brought, and the people they brought. */
export function RippleRings({
  direct,
  further,
  size = 132,
}: {
  direct: number;
  further: number;
  size?: number;
}) {
  const [wave] = useState(() => new Animated.Value(0));
  const [still, setStill] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => active && setStill(reduced))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  // A wave only moves once something has actually spread; an empty ripple stays still.
  const moving = !still && direct > 0;
  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, wave]);
  const ring = (scale: number, fill: string, border: string) => ({
    position: 'absolute' as const,
    width: size * scale,
    height: size * scale,
    borderRadius: (size * scale) / 2,
    backgroundColor: fill,
    borderWidth: 1,
    borderColor: border,
  });
  return (
    <View
      accessible
      accessibilityLabel={`${direct} signed through your link, ${further} more through theirs`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={ring(1, further ? colors.canvas : colors.white, colors.line)} />
      <View style={ring(0.68, direct ? colors.pale : colors.canvas, colors.sage)} />
      {moving && (
        <Animated.View
          style={[
            ring(1, 'transparent', colors.sage),
            {
              borderWidth: 2,
              opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [
                { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.36, 1] }) },
              ],
            },
          ]}
        />
      )}
      <View
        style={[
          ring(0.36, colors.accent, colors.accent),
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>You</Text>
      </View>
    </View>
  );
}

function Legend({ direct, further }: { direct: number; further: number }) {
  const line = (value: number, text: string, dot: string) => (
    <View style={[styles.row, { gap: 8, flexWrap: 'nowrap' }]}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
      <Text style={[styles.small, { flex: 1 }]}>
        <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{value}</Text> {text}
      </Text>
    </View>
  );
  return (
    <View style={{ flex: 1, minWidth: 150, gap: 8 }}>
      {line(direct, 'signed through your link', colors.sage)}
      {line(further, 'more through theirs', colors.line)}
    </View>
  );
}

/** On a petition page: your ripple on this one petition, and the link that grows it. */
export function RipplePanel({
  petition: p,
  snapshot: s,
  onMessage,
}: {
  petition: Petition;
  snapshot: Snapshot;
  onMessage: (text: string) => void;
}) {
  if (!s.profile) return null;
  const mine = s.ripple?.petitions.find((r) => r.petitionId === p.id);
  const direct = mine?.direct ?? 0;
  const further = mine?.further ?? 0;
  const signed = s.signed.includes(p.id);
  return (
    <Panel>
      <Text style={styles.label}>YOUR RIPPLE</Text>
      <Text style={styles.h3}>
        {!signed
          ? 'Sign first, then start a ripple'
          : direct
            ? `${direct + further} ${direct + further === 1 ? 'person' : 'people'} signed because of you`
            : 'Start a ripple'}
      </Text>
      <View style={[styles.row, { gap: 16, alignItems: 'center' }]}>
        <RippleRings direct={direct} further={further} size={112} />
        <Legend direct={direct} further={further} />
      </View>
      <Text style={styles.small}>
        {signed
          ? 'Share your link. Everyone who signs through it joins your ripple, and so does everyone they bring in.'
          : 'Your link starts counting once you have signed. A ripple only credits people who stand behind the petition themselves.'}
      </Text>
      {signed && p.status === 'active' && (
        <Button
          title="Share my link"
          icon="share-outline"
          onPress={() => {
            void sharePetition(p, s)
              .then(onMessage)
              .catch(() => onMessage('Sharing is unavailable. Try again.'));
          }}
        />
      )}
      <Text style={styles.micro}>
        Counts only. Swipe4Change never tells you who signed through your link.
      </Text>
    </Panel>
  );
}

/** On the profile: every ripple you have started, biggest first. */
export function RippleSummary({ snapshot: s }: { snapshot: Snapshot }) {
  const rows = [...(s.ripple?.petitions ?? [])].sort(
    (a, b) => b.direct + b.further - (a.direct + a.further),
  );
  const direct = rows.reduce((n, r) => n + r.direct, 0);
  const further = rows.reduce((n, r) => n + r.further, 0);
  const total = rippleTotal(s.ripple);
  return (
    <Panel>
      <Text style={styles.label}>YOUR RIPPLE</Text>
      <View style={[styles.row, { gap: 16, alignItems: 'center' }]}>
        <RippleRings direct={direct} further={further} />
        <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
          <Text style={[styles.h2, { fontSize: 30, lineHeight: 34 }]}>{total}</Text>
          <Text style={styles.small}>
            {total
              ? `${total === 1 ? 'person has' : 'people have'} signed because of you, across ${rows.length} ${rows.length === 1 ? 'petition' : 'petitions'}.`
              : 'No ripple yet. Sign a petition, share your link, and watch it spread.'}
          </Text>
        </View>
      </View>
      {rows.map((r) => {
        const petition = s.petitions.find((p) => p.id === r.petitionId);
        if (!petition) return null;
        return (
          <View
            key={r.petitionId}
            style={{ gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}
          >
            <Text numberOfLines={2} style={styles.cardTitle}>
              {petition.title}
            </Text>
            <View style={styles.between}>
              <Text style={styles.small}>
                {r.direct} through you · {r.further} further
              </Text>
              <Button
                title="Open"
                variant="ghost"
                onPress={() => router.push(`/petition/${r.petitionId}`)}
              />
            </View>
          </View>
        );
      })}
      <Text style={styles.micro}>Counts only. Nobody who signed through you is named.</Text>
    </Panel>
  );
}
