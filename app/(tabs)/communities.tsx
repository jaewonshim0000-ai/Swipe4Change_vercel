import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Topic, topics } from '../../src/domain/model';
import { communitySchema } from '../../src/domain/rules';
import { Button, Chip, Field, Loading, Notice, Page, Panel, styles } from '../../src/components/ui';
import { CommunityCard, SectionHeader } from '../../src/components/civic-journey';
export default function Communities() {
  const q = useSnapshot();
  const m = useCommand();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [topic, setTopic] = useState<Topic>('Safer streets');
  const [error, setError] = useState('');
  if (q.isPending) return <Loading />;
  if (!q.data)
    return (
      <Page>
        <Notice error text={q.error?.message ?? 'Unable to load communities.'} />
      </Page>
    );
  const s = q.data;
  function create() {
    const parsed = communitySchema.safeParse({ name, description, city, topic });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    m.mutate(
      { type: 'createCommunity', ...parsed.data },
      {
        onSuccess: (id) => {
          setCreating(false);
          setName('');
          setDescription('');
          setCity('');
          if (typeof id === 'string') router.push(`/community/${id}`);
        },
      },
    );
  }
  return (
    <Page
      title="Good neighbors. Shared purpose."
      subtitle="Find a community, trade ideas, and make the next step together."
      eyebrow="YOU DON’T HAVE TO DO IT ALONE"
    >
      {[true, false].map((joined) => {
        const communities = s.communities.filter(
          (c) => !!s.profile?.joined.includes(c.id) === joined,
        );
        if (!communities.length) return null;
        return (
          <View key={String(joined)} style={{ gap: 16 }}>
            <SectionHeader
              title={joined ? 'Your communities' : 'Discover a shared purpose'}
              note={
                joined
                  ? 'Pick up the conversation where you left it.'
                  : 'Find the people working on the places you care about.'
              }
            />
            {communities.map((c) => (
              <CommunityCard
                key={c.id}
                community={c}
                snapshot={s}
                action={
                  <Button
                    title={joined ? 'Joined' : 'Join'}
                    variant="secondary"
                    disabled={m.isPending}
                    onPress={() =>
                      s.profile
                        ? m.mutate({ type: 'join', communityId: c.id })
                        : router.push('/(auth)/sign-in')
                    }
                  />
                }
              />
            ))}
          </View>
        );
      })}
      <Panel>
        <View style={styles.between}>
          <Text style={styles.h2}>Start your own</Text>
          <Button
            title={creating ? 'Cancel' : 'Create a community'}
            variant={creating ? 'ghost' : 'secondary'}
            onPress={() => (s.profile ? setCreating(!creating) : router.push('/(auth)/sign-in'))}
          />
        </View>
        {creating ? (
          <>
            <Notice text="You become the owner and first member. Owners and the moderators they appoint can remove posts in their community. Keep the description free of private information." />
            <Field label="Community name" value={name} onChangeText={setName} />
            <Field
              label="What this community is for"
              multiline
              value={description}
              onChangeText={setDescription}
            />
            <Field label="City and state" value={city} onChangeText={setCity} />
            <Text style={styles.h3}>Main topic</Text>
            <View style={styles.row}>
              {topics.map((t) => (
                <Chip key={t} label={t} selected={topic === t} onPress={() => setTopic(t)} />
              ))}
            </View>
            {!!error && <Notice error text={error} />}
            {m.error && <Notice error text={m.error.message} />}
            <Button title="Create community" disabled={m.isPending} onPress={create} />
          </>
        ) : (
          <Text style={styles.muted}>
            Gather the people who care about the same corner of your town.
          </Text>
        )}
      </Panel>
      {m.error && !creating && <Notice error text={m.error.message} />}
    </Page>
  );
}
