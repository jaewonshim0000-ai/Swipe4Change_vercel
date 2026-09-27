import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { isDemo, useCommand, useSnapshot } from '../../src/data/provider';
import { demoIds } from '../../src/data/seed';
import { Button, Empty, Loading, Notice, Page, Panel, styles } from '../../src/components/ui';
import { CommunityWorkspace } from '../../src/components/community-spaces';
import { Entries } from '../../src/components/entries';
import { Stats } from '../../src/components/design-system';
import { SectionHeader } from '../../src/components/civic-journey';
import { Grid } from '../../src/screens/feed';
export default function Community() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSnapshot();
  const m = useCommand();
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
  const joined = !!s.profile?.joined.includes(c.id);
  const owner = !!s.profile && c.ownerId === s.profile.id;
  const moderates = owner || (!!s.profile && c.moderators.includes(s.profile.id));
  return (
    <Page
      back
      title={c.name}
      subtitle={c.description}
      eyebrow={`${c.city} · ${c.members} members${c.sampleMembers > 0 ? ` (${c.sampleMembers} fictional sample)` : ''}`}
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
      <Panel>
        <Text style={styles.h3}>A shared purpose, with clear responsibilities</Text>
        <Text style={styles.small}>
          Members can contribute to public discussions. The owner and appointed moderators manage
          announcements and moderation. Private organizing spaces are available only to moderators.
        </Text>
        <Stats
          items={[
            { value: c.members, label: 'Members' },
            { value: c.moderators.length + 1, label: 'Owner and moderators' },
            {
              value: s.petitions.filter((p) => p.communityId === id && p.status === 'active')
                .length,
              label: 'Active petitions',
            },
          ]}
        />
        <Text style={styles.small}>
          Your role: {owner ? 'Owner' : moderates ? 'Moderator' : joined ? 'Member' : 'Visitor'}
        </Text>
      </Panel>
      <SectionHeader title="Active campaigns" />
      <Grid
        petitions={s.petitions.filter((p) => p.communityId === id && p.status === 'active')}
        snapshot={s}
      />
      <SectionHeader title="Recent organizer updates" />
      <Entries
        entries={s.petitions
          .filter((p) => p.communityId === id)
          .flatMap((p) => p.updates)
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
          .slice(0, 4)}
        empty="Updates will appear here"
      />
      <CommunityWorkspace
        community={c}
        petitions={s.petitions.filter((p) => p.communityId === id)}
        profile={s.profile}
        joined={joined}
        moderates={moderates}
      />
      {s.petitions.some(
        (p) => p.communityId === id && (p.status === 'closed' || p.status === 'successful'),
      ) && (
        <>
          <SectionHeader
            title="Completed campaigns"
            note="Organizer-reported outcomes; see each petition for evidence and responses."
          />
          <Grid
            petitions={s.petitions.filter(
              (p) => p.communityId === id && (p.status === 'closed' || p.status === 'successful'),
            )}
            snapshot={s}
          />
        </>
      )}
      {m.error && <Notice error text={m.error.message} />}
      {owner && isDemo && (
        <Panel>
          <Text style={styles.h2}>Moderators</Text>
          <Text style={styles.muted}>
            Moderators post announcements, share the organizer space, review reported posts and
            remove posts. Removal always leaves a visible note and the author is told. Moderators
            cannot edit petitions, signatures or memberships.
          </Text>
          <Notice text="The demo appoints moderators from the three sample accounts that have joined. Production needs a reviewed invitation flow rather than a picker of known users." />
          {Object.entries(demoIds)
            .filter(([, id]) => id !== s.profile?.id)
            .map(([name, id]) => {
              const isModerator = c.moderators.includes(id);
              const label = name[0].toUpperCase() + name.slice(1);
              return (
                <Button
                  key={id}
                  title={isModerator ? `${label} moderates · remove` : `Make ${label} a moderator`}
                  variant="secondary"
                  disabled={m.isPending}
                  onPress={() =>
                    m.mutate({
                      type: 'moderator',
                      communityId: c.id,
                      profileId: id,
                      grant: !isModerator,
                    })
                  }
                />
              );
            })}
          {m.error && <Notice error text={m.error.message} />}
        </Panel>
      )}
    </Page>
  );
}
