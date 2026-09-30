import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Snapshot } from '../domain/model';
import { profileSchema } from '../domain/personalization';
import { isDemo, useCommand } from '../data/provider';
import { clearSignals } from '../data/signals';
import { Button, Field, Notice, colors, fonts, styles } from './ui';
import { Switch, toast } from './kit';

/** Name, bio and the activity-personalization switch, edited in the profile sheet. */
export function ProfileEditor({ snapshot: s, onDone }: { snapshot: Snapshot; onDone: () => void }) {
  const p = s.profile!;
  const [name, setName] = useState(p.name);
  const [bio, setBio] = useState(p.bio ?? '');
  const [history, setHistory] = useState(p.useSigningHistory !== false);
  const [error, setError] = useState('');
  const m = useCommand();
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 26 }]}>
        Profile and privacy
      </Text>
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
          borderRadius: 22,
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
            Personalize For You using my activity
          </Text>
          <Text style={[styles.small, { fontSize: 11.5, marginTop: 2 }]}>
            Signing, saving, swiping and reading can move a petition up to 60 points. Never
            political affiliation.
          </Text>
        </View>
        <Switch on={history} />
      </Pressable>
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
          const parsed = profileSchema.safeParse({ name, bio, useSigningHistory: history });
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
