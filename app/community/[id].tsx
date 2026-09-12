import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Notice,
  Page,
  Panel,
  styles,
} from '../../src/components/ui';
import { Entries } from '../../src/components/entries';
import { Grid } from '../../src/screens/feed';
export default function Community() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adapter } = useBackend();
  const q = useSnapshot();
  const posts = useQuery({ queryKey: ['posts', id], queryFn: () => adapter.communityPosts(id) });
  const m = useCommand();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'question' | 'idea' | 'experience'>('idea');
  if (q.isPending) return <Loading />;
  const s = q.data;
  const c = s?.communities.find((c) => c.id === id);
  if (!s || !c)
    return (
      <Page back>
        <Empty
          title="Community not found"
          body="Return to community discovery to find your people."
        />
      </Page>
    );
  const joined = s.profile?.joined.includes(c.id);
  return (
    <Page
      back
      title={c.name}
      subtitle={c.description}
      eyebrow={`${c.city} · ${c.members} sample members`}
      action={
        <Button
          title={joined ? 'Joined · leave' : 'Join community'}
          disabled={m.isPending}
          onPress={() =>
            s.profile
              ? m.mutate({ type: 'join', communityId: c.id })
              : router.push('/(auth)/sign-in')
          }
        />
      }
    >
      <Text style={styles.h2}>Ideas becoming action</Text>
      <Grid
        petitions={s.petitions.filter((p) => p.communityId === id && p.status === 'active')}
        snapshot={s}
      />
      <Panel>
        <Text style={styles.h2}>The neighborhood conversation</Text>
        {posts.isPending ? (
          <Text style={styles.muted}>Loading conversation…</Text>
        ) : posts.error ? (
          <Notice error text={posts.error.message} />
        ) : (
          <Entries entries={posts.data ?? []} empty="Make the first introduction" />
        )}
        {joined ? (
          <>
            <View style={styles.row}>
              {(['question', 'idea', 'experience'] as const).map((k) => (
                <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
            <Field label="Community contribution" multiline value={body} onChangeText={setBody} />
            <Button
              title="Post to community"
              disabled={m.isPending || body.trim().length < 5}
              onPress={() =>
                m.mutate(
                  { type: 'communityPost', communityId: c.id, body, kind },
                  { onSuccess: () => setBody('') },
                )
              }
            />
          </>
        ) : (
          <Notice text="Join this community to contribute to the conversation." />
        )}
        {m.error && <Notice error text={m.error.message} />}
      </Panel>
    </Page>
  );
}
