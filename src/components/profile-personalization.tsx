import { useState } from 'react';
import { Text, View } from 'react-native';
import { Snapshot } from '../domain/model';
import { badgeProgress, profileSchema } from '../domain/personalization';
import { useCommand } from '../data/provider';
import { Button, Chip, Field, Icon, Notice, Panel, styles } from './ui';

export function ProfilePersonalization({ snapshot: s }: { snapshot: Snapshot }) {
  const p = s.profile!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [bio, setBio] = useState(p.bio ?? '');
  const [history, setHistory] = useState(p.useSigningHistory !== false);
  const [error, setError] = useState('');
  const m = useCommand();
  return (
    <>
      <Panel>
        {/* The identity panel above already carries the avatar, name, city and counts, so this
            card holds only what can change. */}
        <Text style={styles.h3}>How you appear</Text>
        <Text style={styles.small}>
          {p.bio || 'Add a line about what you are working on. Every small action tells a story.'}
        </Text>
        <Button
          title={editing ? 'Cancel editing' : 'Edit profile'}
          variant="secondary"
          onPress={() => {
            setName(p.name);
            setBio(p.bio ?? '');
            setHistory(p.useSigningHistory !== false);
            setError('');
            setEditing(!editing);
          }}
        />
        {editing && (
          <>
            <Field label="Display name" value={name} onChangeText={setName} maxLength={100} />
            <Field
              label="About you"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={280}
              placeholder="What changes would you like to see?"
            />
            <Text style={styles.muted}>
              {bio.length}/280 · Keep private identity and address details out of your bio.
            </Text>
            <Chip
              label="Personalize using petitions I signed"
              selected={history}
              onPress={() => setHistory(!history)}
            />
            <Text style={styles.muted}>
              Your signing history contributes at most 10% of ranking. This uses petition topics,
              never inferred political affiliation. Turn it off anytime.
            </Text>
            <Button
              title={m.isPending ? 'Saving profile…' : 'Save profile'}
              disabled={m.isPending}
              onPress={() => {
                const parsed = profileSchema.safeParse({
                  name,
                  bio,
                  useSigningHistory: history,
                });
                if (!parsed.success) {
                  setError(parsed.error.issues[0].message);
                  return;
                }
                m.mutate(
                  { type: 'profile', ...parsed.data },
                  { onSuccess: () => setEditing(false) },
                );
              }}
            />
            {!!error && <Notice error text={error} />}
            {m.error && <Notice error text={m.error.message} />}
          </>
        )}
      </Panel>
      <Panel>
        <View style={styles.row}>
          <Icon name="ribbon-outline" size={28} />
          <Text style={styles.h2}>Milestones that mean something</Text>
        </View>
        {badgeProgress(s).map((b) => (
          <View
            key={b.name}
            style={{
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: '#DFE5DD',
              paddingBottom: 16,
            }}
          >
            <View style={styles.between}>
              <Text style={styles.h3}>
                {b.earned ? '✦' : '○'} {b.name}
              </Text>
              <Chip label={b.earned ? 'Earned' : `${b.progress}/${b.target}`} />
            </View>
            <Text style={styles.muted}>{b.description}</Text>
          </View>
        ))}
        <Text style={styles.muted}>
          Badges recognize participation, not verified impact. Awards use confirmed activity; sample
          account awards are fictional.
        </Text>
      </Panel>
    </>
  );
}
