import { useState } from 'react';
import { Text, View } from 'react-native';
import { Snapshot } from '../domain/model';
import {
  badgeProgress,
  profileAccents,
  profileAvatars,
  profileSchema,
} from '../domain/personalization';
import { useCommand } from '../data/provider';
import { Button, Chip, Field, Icon, Notice, Panel, styles } from './ui';

const accents = { forest: '#176D54', ocean: '#236580', plum: '#74517E', sunset: '#97512D' };
const avatars = { leaf: '🌿', sun: '☀️', spark: '✨', mountain: '⛰️', flower: '🌼' };
export function ProfilePersonalization({ snapshot: s }: { snapshot: Snapshot }) {
  const p = s.profile!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [bio, setBio] = useState(p.bio ?? '');
  const [avatar, setAvatar] = useState(p.avatar ?? 'leaf');
  const [accent, setAccent] = useState(p.accent ?? 'forest');
  const [history, setHistory] = useState(p.useSigningHistory !== false);
  const [error, setError] = useState('');
  const m = useCommand();
  const color = accents[accent as keyof typeof accents] ?? accents.forest;
  return (
    <>
      <Panel style={{ borderTopWidth: 8, borderTopColor: color }}>
        <View style={styles.row}>
          <Text accessibilityLabel={`${avatar} profile avatar`} style={{ fontSize: 52 }}>
            {avatars[avatar as keyof typeof avatars] ?? avatars.leaf}
          </Text>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.h2}>{p.name}</Text>
            <Text style={styles.body}>{p.bio || 'Every small action tells your story.'}</Text>
            <Text style={styles.muted}>{p.city}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Chip label={`${s.signed.length} signed`} />
          <Chip
            label={`${s.petitions.filter((x) => x.ownerId === p.id && x.status !== 'draft').length} created`}
          />
          <Chip label={`${p.joined.length} communities`} />
        </View>
        <Button
          title={editing ? 'Cancel editing' : 'Edit profile'}
          variant="secondary"
          onPress={() => {
            setName(p.name);
            setBio(p.bio ?? '');
            setAvatar(p.avatar ?? 'leaf');
            setAccent(p.accent ?? 'forest');
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
            <Text style={styles.h3}>Choose your avatar</Text>
            <View style={styles.row}>
              {profileAvatars.map((a) => (
                <Chip
                  key={a}
                  label={`${avatars[a]} ${a}`}
                  selected={avatar === a}
                  onPress={() => setAvatar(a)}
                />
              ))}
            </View>
            <Text style={styles.h3}>Profile color</Text>
            <View style={styles.row}>
              {profileAccents.map((a) => (
                <Chip key={a} label={a} selected={accent === a} onPress={() => setAccent(a)} />
              ))}
            </View>
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
                  avatar,
                  accent,
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
