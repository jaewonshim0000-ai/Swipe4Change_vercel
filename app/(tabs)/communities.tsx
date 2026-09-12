import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Button, Chip, Icon, Loading, Notice, Page, Panel, styles } from '../../src/components/ui';
export default function Communities() {
  const q = useSnapshot();
  const m = useCommand();
  if (q.isPending) return <Loading />;
  if (!q.data)
    return (
      <Page>
        <Notice error text={q.error?.message ?? 'Unable to load communities.'} />
      </Page>
    );
  const s = q.data;
  return (
    <Page
      title="Good neighbors. Shared purpose."
      subtitle="Find a community, trade ideas, and make the next step together."
      eyebrow="YOU DON’T HAVE TO DO IT ALONE"
    >
      {s.communities.map((c) => (
        <Panel key={c.id}>
          <View style={styles.between}>
            <View style={styles.row}>
              <Icon name="people-outline" size={32} />
              <Text style={styles.h2}>{c.name}</Text>
            </View>
            <Chip label={c.topic} />
          </View>
          <Text style={styles.body}>{c.description}</Text>
          <Text style={styles.muted}>
            {c.city} · {c.members} fictional members
          </Text>
          <View style={styles.row}>
            <Button
              title={`Visit ${c.name}`}
              variant="secondary"
              onPress={() => router.push(`/community/${c.id}`)}
            />
            <Button
              title={s.profile?.joined.includes(c.id) ? 'Joined · leave' : 'Join community'}
              disabled={m.isPending}
              onPress={() =>
                s.profile
                  ? m.mutate({ type: 'join', communityId: c.id })
                  : router.push('/(auth)/sign-in')
              }
            />
          </View>
        </Panel>
      ))}
      {m.error && <Notice error text={m.error.message} />}
    </Page>
  );
}
