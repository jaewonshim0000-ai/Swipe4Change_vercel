import { Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Petition, Snapshot } from '../domain/model';
import { rippleTotal } from '../domain/ripple';
import { share } from './petition-card';
import { Ring } from './kit';
import { Button, colors, fonts, styles } from './ui';

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
export function RippleRings({ moving, size = 104 }: { moving: boolean; size?: number }) {
  const inner = size * 0.36;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.quiet,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.67,
          height: size * 0.67,
          borderRadius: size,
          backgroundColor: colors.pale,
          borderWidth: 1,
          borderColor: colors.sage,
        }}
      />
      {/* A wave only moves once something has actually spread; an empty ripple stays still. */}
      {moving && (
        <>
          <Ring />
          <Ring delay={1300} />
        </>
      )}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: size > 80 ? 12 : 9.5,
            color: colors.white,
          }}
        >
          You
        </Text>
      </View>
    </View>
  );
}

/** On a petition page: your ripple on this one petition, and the link that grows it. */
export function RipplePanel({
  petition: p,
  snapshot: s,
}: {
  petition: Petition;
  snapshot: Snapshot;
}) {
  if (!s.profile) return null;
  const mine = s.ripple?.petitions.find((r) => r.petitionId === p.id);
  const total = (mine?.direct ?? 0) + (mine?.further ?? 0);
  const signed = s.signed.includes(p.id);
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <RippleRings moving={signed && total > 0} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={[styles.label, { fontSize: 11, letterSpacing: 1.3 }]}>Your ripple</Text>
          <Text
            style={{ fontFamily: fonts.heading, fontSize: 18, lineHeight: 21, color: colors.ink }}
          >
            {!signed
              ? 'Sign first, then start a ripple'
              : total
                ? `${total} ${total === 1 ? 'person' : 'people'} signed because of you`
                : 'Start a ripple'}
          </Text>
          <Text style={[styles.small, { fontSize: 12 }]}>
            {!signed
              ? 'A ripple only credits people who stand behind the petition themselves.'
              : total
                ? `${mine?.direct ?? 0} through your link, ${mine?.further ?? 0} more through theirs. Counts only — never names.`
                : 'Share your link. Everyone who signs through it joins your ripple.'}
          </Text>
        </View>
      </View>
      {signed && p.status === 'active' && (
        <Button
          title="Share my link"
          variant="secondary"
          onPress={() => void share(p, s)}
          style={{ backgroundColor: colors.quiet }}
        />
      )}
    </View>
  );
}

/** On the profile: every ripple you have started, biggest first. */
export function RippleSummary({ snapshot: s }: { snapshot: Snapshot }) {
  const rows = [...(s.ripple?.petitions ?? [])].sort(
    (a, b) => b.direct + b.further - (a.direct + a.further),
  );
  const total = rippleTotal(s.ripple);
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <RippleRings moving={total > 0} size={88} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[styles.label, { fontSize: 11, letterSpacing: 1.3 }]}>Your ripple</Text>
          <Text
            style={{ fontFamily: fonts.display, fontSize: 27, lineHeight: 28, color: colors.ink }}
          >
            {total}
          </Text>
          <Text style={[styles.small, { fontSize: 12 }]}>
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
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderTopWidth: 1,
              borderTopColor: colors.canvas,
              paddingTop: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {petition.title}
              </Text>
              <Text style={[styles.small, { fontSize: 12 }]}>
                {r.direct} through you · {r.further} further
              </Text>
            </View>
            <Button
              title="Open"
              variant="ghost"
              onPress={() => router.push(`/petition/${r.petitionId}`)}
            />
          </View>
        );
      })}
      <Text style={styles.micro}>Counts only. Nobody who signed through you is named.</Text>
    </View>
  );
}
