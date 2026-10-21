import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Profile, ProfileRole, Snapshot, profileRoles, roleLabels } from '../domain/model';
import { profileSchema } from '../domain/personalization';
import { isDemo, useCommand } from '../data/provider';
import { clearSignals } from '../data/signals';
import { pickPhoto } from '../data/photos';
import { OptionCard } from './signature-consent';
import { Button, Field, Notice, colors, fonts, styles } from './ui';
import { Initials, Switch, initialsOf, toast } from './kit';

/**
 * The profile picture: taken or chosen on the device, shrunk to 320 px and stripped of metadata
 * there, then saved at once. Only its owner ever receives it.
 */
function AvatarField({ profile: p }: { profile: Profile }) {
  const m = useCommand();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function choose(source: 'camera' | 'library') {
    setError('');
    setWorking(true);
    try {
      const picked = await pickPhoto(source, 320);
      if (picked) await m.mutateAsync({ type: 'avatar', avatar: picked.uri });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture could not be used.');
    } finally {
      setWorking(false);
    }
  }
  const busy = working || m.isPending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Initials text={initialsOf(p.name)} uri={p.avatar} size={72} />
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Platform.OS !== 'web' && (
            <Button
              title="Take photo"
              variant="secondary"
              disabled={busy}
              onPress={() => void choose('camera')}
            />
          )}
          <Button
            title={working ? 'Preparing…' : p.avatar ? 'Change picture' : 'Add a picture'}
            variant="secondary"
            disabled={busy}
            onPress={() => void choose('library')}
          />
          {!!p.avatar && (
            <Button
              title="Remove"
              variant="ghost"
              disabled={busy}
              onPress={() => m.mutate({ type: 'avatar', avatar: null })}
            />
          )}
        </View>
        <Text style={styles.micro}>
          Only you see your picture. It is resized and its location data removed on your device.
        </Text>
        {!!error && <Notice error text={error} />}
      </View>
    </View>
  );
}

/** How someone takes part. It only picks their welcome tutorial; everyone can do everything. */
export function RolePicker({
  value,
  onChange,
}: {
  value: ProfileRole | undefined;
  onChange: (role: ProfileRole) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {profileRoles.map((r) => (
        <OptionCard
          key={r}
          label={roleLabels[r].label}
          note={roleLabels[r].note}
          selected={value === r}
          onPress={() => onChange(r)}
        />
      ))}
    </View>
  );
}

/** Picture, name, bio, role and the activity-personalization switch, edited in the profile sheet. */
export function ProfileEditor({ snapshot: s, onDone }: { snapshot: Snapshot; onDone: () => void }) {
  const p = s.profile!;
  const [name, setName] = useState(p.name);
  const [bio, setBio] = useState(p.bio ?? '');
  const [history, setHistory] = useState(p.useSigningHistory !== false);
  const [role, setRole] = useState(p.role);
  const [error, setError] = useState('');
  const m = useCommand();
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 29 }]}>
        Profile and privacy
      </Text>
      <AvatarField profile={p} />
      <Field label="Display name" value={name} onChangeText={setName} maxLength={100} />
      <Field
        label="About you"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={280}
        placeholder="What changes would you like to see?"
      />
      <Text style={styles.micro}>
        {bio.length}/280 · Keep private identity and address details out of your bio.
      </Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: history }}
        onPress={() => setHistory(!history)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.white,
          borderRadius: 24,
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
            Personalize For You using my activity
          </Text>
          <Text style={[styles.small, { fontSize: 12, marginTop: 2 }]}>
            Signing, saving, swiping and reading can move a petition up to 60 points. Never
            political affiliation.
          </Text>
        </View>
        <Switch on={history} />
      </Pressable>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
        How you take part
      </Text>
      <RolePicker value={role} onChange={setRole} />
      <Text style={styles.micro}>
        This only changes your welcome tour. Everyone can start, sign and share petitions and join
        communities.
      </Text>
      <Button
        title="Replay the welcome tour"
        variant="ghost"
        onPress={() => {
          onDone();
          router.push('/tutorial');
        }}
      />
      <Button
        title="Clear my reading and swiping history"
        variant="ghost"
        onPress={() => void clearSignals(p).then(() => toast('Cleared from this device.'))}
      />
      <Text style={styles.micro}>
        Email verification: {p.emailVerified ? 'approved' : 'not approved'}
        {isDemo ? ' (simulated)' : ''}. Location approval:{' '}
        {p.locationApproved ? 'approved' : 'not approved'}
        {isDemo ? ' (simulated)' : ''}. These private checks are separate from your public signature
        name.
      </Text>
      {!!error && <Notice error text={error} />}
      {m.error && <Notice error text={m.error.message} />}
      <Button
        title={m.isPending ? 'Saving profile…' : 'Save profile'}
        disabled={m.isPending}
        onPress={() => {
          const parsed = profileSchema.safeParse({
            name,
            bio,
            useSigningHistory: history,
            ...(role ? { role } : {}),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          m.mutate({ type: 'profile', ...parsed.data }, { onSuccess: onDone });
        }}
      />
    </View>
  );
}
