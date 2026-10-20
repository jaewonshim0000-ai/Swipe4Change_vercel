import { readingFrame } from '../../src/components/responsive';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { isDemo, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { demoIds } from '../../src/data/seed';
import { backers } from '../../src/domain/rules';
import {
  Button,
  Empty,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';
import { CircleButton, KenBurns, Press, Scrim, toast, topicImage } from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { CommunityWorkspace } from '../../src/components/community-spaces';
import { PetitionRow } from '../../src/components/petition-card';
import { anim, kf } from '../../src/components/motion';

export default function Community() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSnapshot();
  const m = useCommand();
  const { adapter } = useBackend();
  const insets = useSafeAreaInsets();
  const posts = useQuery({ queryKey: ['posts', id], queryFn: () => adapter.communityPosts(id) });
  if (q.isPending) return <Loading variant="detail" />;
  const s = q.data;
  const c = s?.communities.find((x) => x.id === id);
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
  const petitions = s.petitions.filter((p) => p.communityId === id);
  const active = petitions.filter((p) => p.status === 'active');
  const open = s.petitions.filter((p) => p.status === 'active');
  const sections = [
    {
      title: 'Members-only petitions',
      note: joined
        ? 'Only members of this community can sign these.'
        : 'Only members can sign these. Join to add your name.',
      list: active.filter((p) => p.verification === 'community'),
    },
    {
      title: 'Up for a vote',
      note: joined
        ? `Members are deciding whether ${c.name} backs these. Open one to vote.`
        : `Members are deciding whether ${c.name} backs these.`,
      list: open.filter((p) => p.backing.some((b) => b.communityId === c.id && !b.backedAt)),
    },
    {
      title: `Backed by ${c.name}`,
      note: 'Members voted to back these. The backing goes into each packet sent to the recipient.',
      list: open.filter((p) => backers(p).includes(c.id)),
    },
    {
      title: 'Active campaigns',
      note: '',
      list: active.filter((p) => p.verification !== 'community'),
    },
  ];
  const completed = petitions.filter((p) => p.status === 'closed' || p.status === 'successful');
  const events = (posts.data ?? []).filter((p) => p.kind === 'event' && !p.removed).length;
  return (
    <Animated.View
      style={[readingFrame, { flex: 1, backgroundColor: colors.canvas }, anim(kf.slide, 420)]}
    >
      <StatusBar style="light" />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        <View style={{ height: 250, overflow: 'hidden', backgroundColor: colors.dark }}>
          <KenBurns source={topicImage(c.topic)} />
          <Scrim stops="rgba(18,20,15,0.35) 0%, rgba(18,20,15,0) 35%, rgba(18,20,15,0.85) 100%" />
          <View style={{ position: 'absolute', top: Math.max(insets.top, 12) + 4, left: 16 }}>
            <CircleButton
              label="Back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/communities')
              }
            >
              <Glyph name="back" size={19} weight={2} />
            </CircleButton>
          </View>
          <View style={{ position: 'absolute', left: 18, right: 18, bottom: 40 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: colors.pale,
              }}
            >
              {c.topic} · {c.city}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: 30,
                lineHeight: 36,
                letterSpacing: -0.6,
                color: colors.white,
                marginTop: 6,
              }}
            >
              {c.name}
            </Text>
          </View>
        </View>
        <View
          style={{
            marginTop: -26,
            backgroundColor: colors.canvas,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 18,
            paddingHorizontal: 18,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 15,
              lineHeight: 22.5,
              color: colors.secondary,
            }}
          >
            {c.description}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {[
              {
                value: c.members,
                label: c.sampleMembers > 0 ? `Members (${c.sampleMembers} sample)` : 'Members',
              },
              { value: active.length, label: 'Campaigns' },
              { value: events, label: 'Events' },
            ].map((x) => (
              <View
                key={x.label}
                style={{ flex: 1, backgroundColor: colors.white, borderRadius: 20, padding: 12 }}
              >
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 20,
                    lineHeight: 24,
                    color: colors.ink,
                  }}
                >
                  {x.value}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11,
                    color: colors.muted,
                    marginTop: 4,
                  }}
                >
                  {x.label}
                </Text>
              </View>
            ))}
          </View>
          <Press
            accessibilityLabel={joined ? `Leave ${c.name}` : 'Join community'}
            disabled={m.isPending}
            onPress={() =>
              s.profile
                ? m.mutate(
                    { type: 'join', communityId: c.id },
                    {
                      onSuccess: () => toast(joined ? `Left ${c.name}.` : `Welcome to ${c.name}!`),
                    },
                  )
                : router.push('/(auth)/sign-in')
            }
            style={{
              marginTop: 14,
              minHeight: 50,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: joined ? colors.soft : colors.dark,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                color: joined ? colors.accent : colors.white,
              }}
            >
              {joined ? '✓ Member' : 'Join community'}
            </Text>
          </Press>
          <Text style={[styles.micro, { textAlign: 'center', marginTop: 8 }]}>
            Your role: {owner ? 'Owner' : moderates ? 'Moderator' : joined ? 'Member' : 'Visitor'} ·
            the owner and moderators run announcements and moderation
          </Text>
          <Button
            title="Start a petition here"
            icon="add"
            variant="secondary"
            style={{ marginTop: 10 }}
            onPress={() =>
              router.push({ pathname: '/(tabs)/create', params: { communityId: c.id } })
            }
          />
          {m.error && <Notice error text={m.error.message} />}
          <CommunityWorkspace
            community={c}
            petitions={petitions}
            profile={s.profile}
            joined={joined}
            moderates={moderates}
          />
          {sections.map(
            (x) =>
              x.list.length > 0 && (
                <View key={x.title} style={{ gap: 12, marginTop: 24 }}>
                  <Text accessibilityRole="header" style={styles.h2}>
                    {x.title}
                  </Text>
                  {!!x.note && <Text style={styles.small}>{x.note}</Text>}
                  {x.list.map((p, i) => (
                    <PetitionRow key={p.id} petition={p} snapshot={s} index={i} />
                  ))}
                </View>
              ),
          )}
          {completed.length > 0 && (
            <View style={{ gap: 12, marginTop: 24 }}>
              <Text accessibilityRole="header" style={styles.h2}>
                Completed campaigns
              </Text>
              <Text style={styles.small}>
                Organizer-reported outcomes; see each petition for evidence and responses.
              </Text>
              {completed.map((p, i) => (
                <PetitionRow key={p.id} petition={p} snapshot={s} index={i} />
              ))}
            </View>
          )}
          {owner && isDemo && (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: 24,
                padding: 18,
                gap: 10,
                marginTop: 24,
              }}
            >
              <Text style={styles.h3}>Moderators</Text>
              <Text style={styles.small}>
                Moderators post announcements, share the organizer space, review reported posts and
                remove posts. Removal always leaves a visible note. Moderators cannot edit
                petitions, signatures or memberships.
              </Text>
              <Notice text="The demo appoints moderators from the sample accounts. Production needs a reviewed invitation flow." />
              {Object.entries(demoIds)
                .filter(([, pid]) => pid !== s.profile?.id)
                .map(([name, pid]) => {
                  const isModerator = c.moderators.includes(pid);
                  const label = name[0].toUpperCase() + name.slice(1);
                  return (
                    <Button
                      key={pid}
                      title={
                        isModerator ? `${label} moderates · remove` : `Make ${label} a moderator`
                      }
                      variant="secondary"
                      disabled={m.isPending}
                      style={{ backgroundColor: colors.quiet }}
                      onPress={() =>
                        m.mutate({
                          type: 'moderator',
                          communityId: c.id,
                          profileId: pid,
                          grant: !isModerator,
                        })
                      }
                    />
                  );
                })}
            </View>
          )}
          <Text style={[styles.micro, { textAlign: 'center', paddingTop: 18 }]}>
            {isDemo
              ? 'Fictional demo community. Posts and events are sample data and carry no official weight.'
              : 'Posts are written by members and carry no official weight.'}
          </Text>
        </View>
      </Animated.ScrollView>
    </Animated.View>
  );
}
