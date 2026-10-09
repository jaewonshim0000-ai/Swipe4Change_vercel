import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useCommand, useSnapshot } from '../data/provider';
import { useReads } from '../data/reads';
import { useSignals } from '../data/signals';
import { Petition, Snapshot, topics, verificationLabels, verificationModes } from '../domain/model';
import { trendingScore } from '../domain/rules';
import { forYou } from '../domain/for-you';
import { sameCity } from '../domain/location';
import {
  DiscoveryFilters,
  ago,
  emptyFilters,
  matchesDiscovery,
  milestoneLabel,
  nextMilestone,
} from '../domain/discovery';
import { governmentLevels, levelLabels } from '../domain/recipients';
import { ResponsiveGrid } from '../components/responsive';
import { SwipeDeck } from '../components/swipe-deck';
import { CollectionCard, PetitionRow, useSave } from '../components/petition-card';
import {
  Bar,
  Cover,
  Heart,
  Initials,
  KenBurns,
  LiveDot,
  PillChip,
  Press,
  Rail,
  Ring,
  Scrim,
  Screen,
  Sheet,
  TopicPill,
  initialsOf,
  toast,
  petitionImage,
  topicImage,
} from '../components/kit';
import { Glyph } from '../components/glyph';
import { CitySheet } from '../components/city-picker';
import { anim, kf } from '../components/motion';
import { Button, Empty, Loading, Notice, Page, colors, fonts, styles } from '../components/ui';
import { frost, topicColors } from '../components/theme';

export function Feed({ explore = false }: { explore?: boolean }) {
  const q = useSnapshot();
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <Page>
        <Notice error text={q.error.message} />
        <Button title="Retry feed" onPress={() => void q.refetch()} />
      </Page>
    );
  return explore ? <Explore snapshot={q.data} /> : <Home snapshot={q.data} />;
}

const sectionTitle = {
  fontFamily: fonts.display,
  fontSize: 21,
  lineHeight: 24,
  letterSpacing: -0.6,
  color: colors.ink,
};
const note = {
  fontFamily: fonts.body,
  fontSize: 12.5,
  lineHeight: 18,
  color: colors.muted,
  marginTop: 3,
};
const shortTitle = (t: string) => t.split(' ').slice(0, 4).join(' ');

/** Real, recent activity for the live ticker: endorsements, discussion, signatures, milestones. */
function tickerLines(s: Snapshot, now: number) {
  const byId = new Map(s.petitions.map((p) => [p.id, p]));
  const verbs: Record<string, string> = {
    question: 'asked a question on',
    idea: 'shared an idea on',
    experience: 'shared an experience on',
  };
  const posts = s.petitions
    .flatMap((p) => [
      ...p.endorsements.map((e) => ({ p, e, verb: 'endorsed' })),
      ...p.discussion
        .filter((e) => !e.removed)
        .map((e) => ({ p, e, verb: verbs[e.kind] ?? 'posted on' })),
    ])
    .sort((a, b) => Date.parse(b.e.date) - Date.parse(a.e.date))
    .slice(0, 4)
    .map(({ p, e, verb }) => `${e.author} ${verb} “${shortTitle(p.title)}” · ${ago(e.date, now)}`);
  const signed = s.signatures
    .slice(-3)
    .reverse()
    .flatMap((x) => {
      const p = byId.get(x.petitionId);
      return p ? [`${x.displayName} signed “${shortTitle(p.title)}”`] : [];
    });
  const milestones = s.petitions
    .filter((p) => p.status === 'active' && p.count >= p.goal / 2 && p.count < p.goal)
    .slice(0, 2)
    .map(
      (p) =>
        `“${shortTitle(p.title)}” passed ${Math.floor((20 * p.count) / p.goal) * 5}% of its goal`,
    );
  const lines: string[] = [];
  for (let i = 0; i < 4; i++)
    [posts[i], signed[i], milestones[i]].forEach((l) => l && lines.push(l));
  return lines;
}

function Ticker({ lines }: { lines: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3400);
    return () => clearInterval(id);
  }, []);
  if (!lines.length) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.white,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        overflow: 'hidden',
        boxShadow: '0px 6px 18px -12px rgba(32,38,26,0.3)',
      }}
    >
      <LiveDot />
      <Animated.Text
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        style={[
          {
            flex: 1,
            minWidth: 0,
            fontFamily: fonts.medium,
            fontSize: 12.5,
            color: colors.secondary,
          },
          anim(tick % 2 ? kf.tickA : kf.tickB, 500),
        ]}
      >
        {lines[tick % lines.length]}
      </Animated.Text>
    </View>
  );
}

function Spotlight({ petition: p, snapshot: s }: { petition: Petition; snapshot: Snapshot }) {
  const save = useSave(s);
  const [now] = useState(Date.now);
  const update = [...p.updates]
    .filter((u) => !u.removed)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const community = s.communities.find((c) => c.id === p.communityId);
  return (
    <Press
      accessibilityRole="link"
      accessibilityLabel={`Local spotlight: ${p.title}`}
      scale={0.985}
      onPress={() => router.push(`/petition/${p.id}`)}
      style={{
        height: 318,
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: colors.dark,
        boxShadow: '0px 22px 40px -22px rgba(32,38,26,0.55)',
      }}
    >
      <KenBurns
        source={petitionImage(p)}
        label="Illustrative theme image, not petition evidence"
      />
      <Scrim stops="rgba(18,20,15,0.25) 0%, rgba(18,20,15,0) 28%, rgba(18,20,15,0.5) 55%, rgba(18,20,15,0.9) 100%" />
      <View
        style={[
          {
            position: 'absolute',
            top: 14,
            left: 14,
            borderRadius: 999,
            paddingVertical: 7,
            paddingHorizontal: 12,
          },
          frost(),
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 10.5,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            color: colors.white,
          }}
        >
          Local spotlight
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.saved.includes(p.id) ? 'Unsave petition' : 'Save petition'}
        onPress={(e) => {
          e.stopPropagation();
          save(p);
        }}
        style={[
          {
            position: 'absolute',
            top: 12,
            right: 12,
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
          },
          frost(0.22),
        ]}
      >
        <Heart on={s.saved.includes(p.id)} />
      </Pressable>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16, gap: 9 }}>
        <TopicPill topic={p.topic} />
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 25,
            lineHeight: 28,
            letterSpacing: -0.8,
            color: colors.white,
          }}
        >
          {p.title}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: '#E9EBE4' }}
        >
          ↳{' '}
          {update
            ? `${update.body} · ${ago(update.date, now)}`
            : `Organized by ${community?.name ?? p.creator}`}
        </Text>
        <View style={{ marginTop: 3 }}>
          <Bar pct={(100 * p.count) / p.goal} tone="light" label="Signature goal progress" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.white }}>
            {p.count.toLocaleString()} of {p.goal.toLocaleString()}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.pale }}>
            {milestoneLabel(p)}
          </Text>
        </View>
      </View>
    </Press>
  );
}

const recipe = [
  { label: 'Your interests', pct: 35, note: 'Topics you picked, plus what you sign and save' },
  { label: 'Approximate city', pct: 30, note: 'City and state only — never an address' },
  { label: 'Communities you joined', pct: 20, note: 'Groups you chose, not groups we guessed' },
  { label: 'Freshness and activity', pct: 10, note: 'Recent updates and new signatures' },
  { label: 'Endorsements', pct: 5, note: 'Capped, so one loud community can’t dominate' },
];
function WhySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.display,
          fontSize: 24,
          lineHeight: 26,
          letterSpacing: -0.7,
          color: colors.ink,
        }}
      >
        Why these petitions?
      </Text>
      <Text style={[styles.muted, { marginTop: 6, marginBottom: 14 }]}>
        The whole recipe. No political profiling, ever.
      </Text>
      {recipe.map((r, i) => (
        <View key={r.label} style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink }}>
              {r.label}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink }}>
              {r.pct}%
            </Text>
          </View>
          <View
            style={{
              height: 8,
              borderRadius: 8,
              backgroundColor: colors.track,
              overflow: 'hidden',
              marginTop: 7,
            }}
          >
            <Animated.View
              style={[
                {
                  width: `${(r.pct / 35) * 100}%`,
                  height: '100%',
                  borderRadius: 8,
                  transformOrigin: 'left',
                  backgroundColor: i === 0 ? colors.dark : colors.sage,
                },
                anim(kf.grow, 900, { delay: 150 + i * 100 }),
              ]}
            />
          </View>
          <Text style={[styles.small, { fontSize: 11.5, marginTop: 5 }]}>{r.note}</Text>
        </View>
      ))}
      <Text
        style={[
          styles.small,
          {
            fontSize: 12,
            backgroundColor: colors.white,
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginTop: 8,
          },
        ]}
      >
        On top: what you sign, save and read nudges cards up to 60 points, fading over two weeks.
        Every fifth card is something different. An AI model tags petitions from their public
        wording; nothing about you is sent to it. Turn activity personalization off in Profile.
      </Text>
      <Button title="Got it" onPress={onClose} style={{ marginTop: 14 }} />
    </Sheet>
  );
}

/** Home is the swipe deck. Every other way of finding petitions lives in Explore. */
function Home({ snapshot: s }: { snapshot: Snapshot }) {
  const [now] = useState(Date.now);
  const [why, setWhy] = useState(false);
  const [picking, setPicking] = useState(false);
  const command = useCommand();
  const { read } = useReads(s.profile?.id);
  const feed = forYou(s, useSignals(s.profile), now);
  const ranked = feed.map((r) => r.petition);
  const reasons = new Map(feed.map((r) => [r.petition.id, r.reasons]));
  const local = ranked.filter((p) => sameCity(p.city, s.profile?.city));
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const unread = s.notifications.filter((n) => !read.includes(n.id)).length;
  function moveTo(city: string) {
    if (!s.profile) return;
    command.mutate(
      { type: 'onboard', interests: s.profile.interests, city },
      { onSuccess: () => toast(`Showing causes near ${city}`) },
    );
  }
  return (
    <Screen wide>
      <Animated.View
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, anim(kf.in, 500)]}
      >
        <Press
          accessibilityLabel="Profile"
          scale={0.94}
          onPress={() => router.push(s.profile ? '/(tabs)/profile' : '/(auth)/sign-in')}
          style={{ borderRadius: 23, boxShadow: '0px 6px 16px -8px rgba(32,38,26,0.4)' }}
        >
          <Initials
            text={s.profile ? initialsOf(s.profile.name) : '?'}
            size={46}
            ring={colors.white}
          />
        </Press>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.display,
              fontSize: 24,
              lineHeight: 26,
              letterSpacing: -0.8,
              color: colors.ink,
            }}
          >
            {greeting}
            {s.profile ? `, ${s.profile.name.split(' ')[0]}` : ''}.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change location"
            onPress={() => (s.profile ? setPicking(true) : router.push('/(auth)/sign-in'))}
            style={{ paddingTop: 3, flexDirection: 'row', gap: 4 }}
          >
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }}
            >
              {s.profile?.city
                ? `${local.length} active causes near ${s.profile.city.split(',')[0]}`
                : 'Choose your approximate location'}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent }}>
              · Change
            </Text>
          </Pressable>
        </View>
        <Press
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          scale={0.94}
          onPress={() => router.push('/notifications')}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0px 6px 16px -8px rgba(32,38,26,0.35)',
          }}
        >
          <Glyph name="bell" size={20} weight={1.7} />
          {unread > 0 && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 8,
                  right: 9,
                  minWidth: 17,
                  height: 17,
                  borderRadius: 9,
                  backgroundColor: colors.orange,
                  borderWidth: 2,
                  borderColor: colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                },
                anim(kf.pop, 400, { ease: 'ease' }),
              ]}
            >
              <Text
                style={{ fontFamily: fonts.bold, fontSize: 9, lineHeight: 11, color: colors.white }}
              >
                {unread}
              </Text>
            </Animated.View>
          )}
        </Press>
      </Animated.View>
      <View
        style={{
          paddingTop: 22,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: 23,
            lineHeight: 25,
            letterSpacing: -0.7,
            color: colors.ink,
          }}
        >
          For you
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setWhy(true)} style={{ padding: 4 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent }}>
            Why these?
          </Text>
        </Pressable>
      </View>
      <View style={{ width: '100%', maxWidth: 540, alignSelf: 'center' }}>
        <SwipeDeck petitions={ranked} snapshot={s} reasons={reasons} />
      </View>
      <Text style={[styles.micro, { textAlign: 'center', paddingTop: 18, paddingHorizontal: 10 }]}>
        Fictional sample data. Nothing here establishes legal validity.
      </Text>
      <CitySheet visible={picking} onClose={() => setPicking(false)} onPick={moveTo} />
      <WhySheet visible={why} onClose={() => setWhy(false)} />
    </Screen>
  );
}

/** The community and creation invitations at the foot of Explore. */
function KeepGoing({ snapshot: s }: { snapshot: Snapshot }) {
  const community = s.communities.find((c) => s.profile?.joined.includes(c.id)) ?? s.communities[0];
  const communityPetitions = s.petitions.filter(
    (p) => p.communityId === community?.id && p.status === 'active',
  );
  const latest = communityPetitions
    .flatMap((p) => p.updates)
    .filter((u) => !u.removed)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  return (
    <View style={{ paddingTop: 22 }}>
      <Text accessibilityRole="header" style={[sectionTitle, { marginBottom: 12 }]}>
        Keep the conversation going
      </Text>
      {community && (
        <Press
          accessibilityRole="link"
          accessibilityLabel={`Open ${community.name}`}
          onPress={() => router.push(`/community/${community.id}`)}
          style={{
            backgroundColor: colors.white,
            borderRadius: 26,
            padding: 16,
            flexDirection: 'row',
            gap: 14,
            alignItems: 'center',
            boxShadow: '0px 10px 26px -16px rgba(32,38,26,0.35)',
          }}
        >
          <View style={{ width: 58, height: 58 }}>
            <Ring />
            <Cover
              source={topicImage(community.topic)}
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                right: 6,
                bottom: 6,
                borderRadius: 23,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                lineHeight: 19.5,
                color: colors.ink,
              }}
            >
              {community.name}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fonts.body,
                fontSize: 12.5,
                lineHeight: 18,
                color: colors.muted,
              }}
            >
              {communityPetitions.length} active campaigns ·{' '}
              {latest ? latest.body : 'Bring a question or an idea'}
            </Text>
          </View>
          <Glyph name="next" size={16} weight={2} />
        </Press>
      )}
      <View
        style={{
          marginTop: 14,
          backgroundColor: colors.dark,
          borderRadius: 28,
          padding: 22,
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', right: -40, top: -40, width: 150, height: 150 }}>
          <Ring color="rgba(228,230,195,0.25)" width={1} ms={3400} />
        </View>
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 21,
            lineHeight: 25,
            letterSpacing: -0.5,
            color: colors.white,
            maxWidth: 260,
          }}
        >
          What would you change on your way home?
        </Text>
        <Text
          style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5, color: colors.onDark }}
        >
          Turn one specific concern into a request your community can act on.
        </Text>
        <Button
          title="Start a petition →"
          variant="pale"
          onPress={() => router.push('/(tabs)/create')}
          style={{ alignSelf: 'flex-start', marginTop: 4, minHeight: 44 }}
        />
      </View>
      <Text style={[styles.micro, { textAlign: 'center', paddingTop: 18, paddingHorizontal: 10 }]}>
        Fictional sample data. Nothing here establishes legal validity.
      </Text>
    </View>
  );
}

function Explore({ snapshot: s }: { snapshot: Snapshot }) {
  const [now] = useState(Date.now);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(emptyFilters);
  const [draft, setDraft] = useState<DiscoveryFilters | null>(null);
  const signals = useSignals(s.profile);
  const ranked = forYou(s, signals, now).map((r) => r.petition);
  const results = (f: DiscoveryFilters) =>
    ranked.filter((p) => matchesDiscovery(p, s, search, f, now));
  const list = results(filters);
  const count = [filters.requirement, filters.level, filters.community].filter(Boolean).length;
  const city = s.profile?.city ?? '';
  const quick = [
    {
      label: 'Near you',
      on: !!filters.location,
      toggle: () => setFilters({ ...filters, location: filters.location ? '' : city }),
    },
    {
      label: 'Updated this week',
      on: filters.updated,
      toggle: () => setFilters({ ...filters, updated: !filters.updated }),
    },
    {
      label: 'Ending within 30 days',
      on: filters.endingSoon,
      toggle: () => setFilters({ ...filters, endingSoon: !filters.endingSoon }),
    },
  ].filter((c) => c.label !== 'Near you' || city);
  const groups: {
    label: string;
    key: 'requirement' | 'level' | 'community';
    options: [string, string][];
  }[] = [
    {
      label: 'Signing requirement',
      key: 'requirement',
      options: verificationModes.map((v) => [v, verificationLabels[v]]),
    },
    {
      label: 'Level of government',
      key: 'level',
      options: governmentLevels.map((l) => [l, levelLabels[l]]),
    },
    { label: 'Community', key: 'community', options: s.communities.map((c) => [c.id, c.name]) },
  ];
  const q = search.trim();
  // Browsing with no search or filters shows the curated sections; searching shows only results.
  const browsing =
    !q &&
    (Object.keys(emptyFilters) as (keyof DiscoveryFilters)[]).every(
      (k) => filters[k] === emptyFilters[k],
    );
  const local = ranked.filter((p) => sameCity(p.city, city));
  const flagship =
    ranked.find((p) => p.action.includes('Eastbridge campus')) ?? local[0] ?? ranked[0];
  const collections = [
    { title: 'Near you', note: 'Approximate city matches only.', items: local },
    {
      title: 'A milestone within reach',
      note: 'Signature progress, not policy outcomes.',
      items: [...ranked]
        .filter((p) => nextMilestone(p))
        .sort((a, b) => nextMilestone(a)!.remaining - nextMilestone(b)!.remaining),
    },
    {
      title: 'Gaining momentum',
      note: 'Seven-day signatures, saves and discussion. Small samples discounted.',
      items: [...ranked].sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, 5),
    },
  ];
  return (
    <Screen wide>
      <Text style={styles.label}>Explore</Text>
      <Text accessibilityRole="header" style={[styles.title, { marginTop: 8, marginBottom: 14 }]}>
        Find your next cause.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.white,
            borderRadius: 999,
            paddingHorizontal: 16,
            minHeight: 52,
            boxShadow: '0px 8px 22px -14px rgba(32,38,26,0.35)',
          }}
        >
          <Glyph name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Search petitions"
            value={search}
            onChangeText={setSearch}
            placeholder="Try lighting, Riverton, a community…"
            placeholderTextColor="#8C9086"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: fonts.body,
              fontSize: 15,
              color: colors.ink,
              paddingVertical: 12,
            }}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch('')}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.canvas,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.muted }}>×</Text>
            </Pressable>
          )}
        </View>
        <Press
          accessibilityLabel={count ? `Filters, ${count} active` : 'Filters'}
          scale={0.94}
          onPress={() => setDraft(filters)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.dark,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="filters" size={19} color={colors.white} />
          {count > 0 && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 19,
                  height: 19,
                  borderRadius: 10,
                  backgroundColor: colors.pale,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                anim(kf.pop, 300, { ease: 'ease' }),
              ]}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.dark }}>
                {count}
              </Text>
            </Animated.View>
          )}
        </Press>
      </View>
      <Rail style={{ paddingTop: 14, paddingBottom: 4 }}>
        {(['', ...topics] as const).map((t) => (
          <PillChip
            key={t || 'all'}
            label={t || 'All topics'}
            selected={filters.topic === t}
            onPress={() => setFilters({ ...filters, topic: t })}
          />
        ))}
      </Rail>
      <Rail style={{ paddingTop: 8, paddingBottom: 6 }}>
        {quick.map((c) => (
          <PillChip
            key={c.label}
            label={c.label}
            selected={c.on}
            onPress={c.toggle}
            height={34}
            outline
          />
        ))}
      </Rail>
      {browsing && (
        <>
          <Animated.View style={[{ paddingTop: 14 }, anim(kf.in, 500, { delay: 60 })]}>
            <Ticker lines={tickerLines(s, now)} />
          </Animated.View>
          {flagship && (
            <Animated.View style={[{ paddingTop: 16 }, anim(kf.in, 600, { delay: 120 })]}>
              <Spotlight petition={flagship} snapshot={s} />
            </Animated.View>
          )}
          {collections.map(
            (c) =>
              c.items.length > 0 && (
                <View key={c.title} style={{ paddingTop: 28 }}>
                  <View style={{ paddingBottom: 12 }}>
                    <Text accessibilityRole="header" style={sectionTitle}>
                      {c.title}
                    </Text>
                    <Text style={note}>{c.note}</Text>
                  </View>
                  <Rail gap={12} style={{ paddingBottom: 12 }}>
                    {c.items.slice(0, 6).map((p) => (
                      <CollectionCard
                        key={p.id}
                        petition={p}
                        badge={
                          sameCity(p.city, city)
                            ? 'Near you'
                            : (s.communities.find((x) => x.id === p.communityId)?.name ?? p.city)
                        }
                      />
                    ))}
                  </Rail>
                </View>
              ),
          )}
          <Text accessibilityRole="header" style={[sectionTitle, { paddingTop: 22 }]}>
            All petitions
          </Text>
        </>
      )}
      <Text
        accessibilityLiveRegion="polite"
        style={{
          paddingVertical: 10,
          fontFamily: fonts.medium,
          fontSize: 12.5,
          color: colors.muted,
        }}
      >
        {list.length} {browsing ? 'active' : 'matching'} petition{list.length === 1 ? '' : 's'}
      </Text>
      <ResponsiveGrid>
        {list.map((p, i) => (
          <PetitionRow
            key={p.id}
            petition={p}
            snapshot={s}
            index={i}
            match={
              q
                ? `Matches “${q}”`
                : sameCity(p.city, city)
                  ? `Near you · ${p.city}`
                  : s.profile?.interests.includes(p.topic)
                    ? 'One of your interests'
                    : `Active in ${s.communities.find((c) => c.id === p.communityId)?.name ?? p.city}`
            }
          />
        ))}
        {!list.length && (
          <View style={{ gap: 12 }}>
            <Empty
              title="Nothing matches yet"
              body="Try a place like Brookside or a word like lighting."
            />
            <Button
              title="Clear search and filters"
              onPress={() => {
                setSearch('');
                setFilters(emptyFilters);
              }}
            />
          </View>
        )}
      </ResponsiveGrid>
      <View style={{ paddingTop: 26 }}>
        <Text accessibilityRole="header" style={[sectionTitle, { marginBottom: 12 }]}>
          Find your people
        </Text>
        <Rail gap={10} style={{ paddingBottom: 8 }}>
          {s.communities.map((c) => (
            <Press
              key={c.id}
              accessibilityRole="link"
              accessibilityLabel={`Open ${c.name}`}
              onPress={() => router.push(`/community/${c.id}`)}
              style={{
                width: 168,
                backgroundColor: colors.white,
                borderRadius: 22,
                padding: 14,
                gap: 6,
                boxShadow: '0px 10px 24px -16px rgba(32,38,26,0.35)',
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: topicColors[c.topic].soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 16,
                    color: topicColors[c.topic].accent,
                  }}
                >
                  {c.name[0]}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  lineHeight: 17.5,
                  color: colors.ink,
                }}
              >
                {c.name}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>
                {c.members} members
              </Text>
            </Press>
          ))}
        </Rail>
      </View>
      <KeepGoing snapshot={s} />
      <Sheet visible={!!draft} onClose={() => setDraft(null)}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: 24,
            lineHeight: 26,
            letterSpacing: -0.7,
            color: colors.ink,
            marginBottom: 12,
          }}
        >
          Filters
        </Text>
        {draft &&
          groups.map((g) => (
            <View key={g.key} style={{ paddingTop: 8, paddingBottom: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  color: colors.secondary,
                  marginBottom: 8,
                }}
              >
                {g.label}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {g.options.map(([value, label]) => (
                  <PillChip
                    key={value}
                    label={label}
                    height={36}
                    selected={draft[g.key] === value}
                    onPress={() =>
                      setDraft({ ...draft, [g.key]: draft[g.key] === value ? '' : value })
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button
            title="Clear"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() =>
              draft && setDraft({ ...draft, requirement: '', level: '', community: '' })
            }
          />
          <Button
            title={`Show ${draft ? results(draft).length : 0} petitions`}
            style={{ flex: 2 }}
            onPress={() => {
              if (draft) setFilters(draft);
              setDraft(null);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
