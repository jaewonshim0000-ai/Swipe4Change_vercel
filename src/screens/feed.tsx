import { useState } from 'react';
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSnapshot } from '../data/provider';
import { Petition, Snapshot, topics, verificationLabels, verificationModes } from '../domain/model';
import { rankFeed, trendingScore } from '../domain/rules';
import {
  DiscoveryFilters,
  emptyFilters,
  lastActivity,
  matchesDiscovery,
  matchReason,
  nextMilestone,
} from '../domain/discovery';
import { governmentLevels, levelLabels } from '../domain/recipients';
import { FeedRecipe } from '../components/discovery-editorial';
import { SwipeDeck } from '../components/swipe-deck';
import { PetitionCard, PetitionRow } from '../components/petition-card';
import {
  CommunityCard,
  PetitionCollection,
  PetitionHero,
  SectionHeader,
} from '../components/civic-journey';
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
  colors,
} from '../components/ui';
export function Grid({ petitions, snapshot }: { petitions: Petition[]; snapshot: Snapshot }) {
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const columns = containerWidth >= 1000 ? 3 : containerWidth >= 650 ? 2 : 1;
  const cardWidth = containerWidth
    ? (containerWidth - 24 * (columns - 1)) / columns
    : Math.min(width - 32, 400);
  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, width: '100%' }}
    >
      {petitions.map((p) => (
        <View key={p.id} style={{ width: cardWidth, minWidth: 0 }}>
          <PetitionCard petition={p} snapshot={snapshot} showReason />
        </View>
      ))}
    </View>
  );
}

export function Feed({ explore = false }: { explore?: boolean }) {
  const q = useSnapshot();
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <Page>
        <Notice error text={q.error.message} />
        <Button
          title="Retry feed"
          onPress={() => {
            void q.refetch();
          }}
        />
      </Page>
    );
  return explore ? <Explore snapshot={q.data} /> : <Home snapshot={q.data} />;
}
function Home({ snapshot: s }: { snapshot: Snapshot }) {
  const [now] = useState(Date.now);
  const [why, setWhy] = useState(false);
  const [cards, setCards] = useState(false);
  const ranked = rankFeed(s.petitions, s.profile, now, s.signed);
  const local = ranked.filter((p) => p.city === s.profile?.city);
  const flagship =
    ranked.find((p) => p.action.includes('Eastbridge campus')) ?? local[0] ?? ranked[0];
  const joined = s.communities.filter((c) => s.profile?.joined.includes(c.id));
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <Page>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.label}>YOUR COMMUNITY, IN MOTION</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {greeting}
            {s.profile ? `, ${s.profile.name.split(' ')[0]}` : ''}.
          </Text>
          <Text style={styles.body}>
            {s.profile?.city
              ? `${local.length} active causes near ${s.profile.city}.`
              : 'A small local change can start with you.'}
          </Text>
          <Text style={styles.small}>{s.profile?.city ?? 'Choose your approximate location'}</Text>
        </View>
        <Button
          title="Change location"
          variant="ghost"
          onPress={() => router.push(s.profile ? '/onboarding' : '/(auth)/sign-in')}
        />
      </View>
      {flagship ? (
        <PetitionHero petition={flagship} snapshot={s} />
      ) : (
        <Empty
          title="Your next cause is taking shape"
          body="Start a petition or explore your communities."
        />
      )}
      <SectionHeader
        title="For you"
        note="A place to get curious. Read the request, then decide."
        action={
          <Button
            title={cards ? 'Swipe view' : 'Card view'}
            variant="ghost"
            onPress={() => setCards(!cards)}
          />
        }
      />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button title="Why these petitions?" variant="ghost" onPress={() => setWhy(!why)} />
      </View>
      {why && <FeedRecipe />}
      {cards ? (
        <Grid petitions={ranked.slice(0, 6)} snapshot={s} />
      ) : (
        <SwipeDeck petitions={ranked} snapshot={s} />
      )}
      <PetitionCollection
        title="Near you"
        note="The places you share. Approximate city matches only."
        petitions={local}
      />
      <PetitionCollection
        title="Recently updated"
        note="See what happened after people added their voices."
        petitions={[...ranked]
          .filter((p) => p.updates.some((u) => !u.removed))
          .sort((a, b) => lastActivity(b) - lastActivity(a))}
      />
      <PetitionCollection
        title="A milestone within reach"
        note="Progress toward signature goals, not policy outcomes."
        petitions={[...ranked]
          .filter((p) => nextMilestone(p))
          .sort((a, b) => nextMilestone(a)!.remaining - nextMilestone(b)!.remaining)}
      />
      <PetitionCollection
        title="From your communities"
        petitions={ranked.filter((p) => s.profile?.joined.includes(p.communityId))}
      />
      <PetitionCollection
        title="Gaining momentum"
        note="Recent signature activity, saves, discussion and freshness. Small samples are discounted."
        petitions={[...ranked].sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, 3)}
      />
      <SectionHeader
        title="Keep the conversation going"
        note="Community participation continues after a signature."
      />
      {(joined.length ? joined : s.communities.slice(0, 1)).slice(0, 2).map((c) => (
        <CommunityCard key={c.id} community={c} snapshot={s} />
      ))}
      <Panel style={{ backgroundColor: colors.primarySoft }}>
        <Text style={styles.h2}>What would you change on your way home?</Text>
        <Text style={styles.body}>
          Turn one specific concern into a request your community can act on.
        </Text>
        <Button title="Start a petition" onPress={() => router.push('/(tabs)/create')} />
      </Panel>
    </Page>
  );
}
function Explore({ snapshot: s }: { snapshot: Snapshot }) {
  const [now] = useState(Date.now);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(emptyFilters);
  const [draft, setDraft] = useState<DiscoveryFilters>(emptyFilters);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState('Relevant');
  const filtered = rankFeed(s.petitions, s.profile, now, s.signed).filter((p) =>
    matchesDiscovery(p, s, search, filters, now),
  );
  if (sort === 'Recently updated') filtered.sort((a, b) => lastActivity(b) - lastActivity(a));
  if (sort === 'Ending soon')
    filtered.sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  if (sort === 'Saved')
    filtered.splice(0, filtered.length, ...filtered.filter((p) => s.saved.includes(p.id)));
  const count = Object.values(filters).filter(Boolean).length;
  return (
    <Page
      title="Find your next cause."
      subtitle="Search a request, a place, or the people organizing it."
      eyebrow="EXPLORE"
    >
      <Field
        label="Search petitions"
        value={search}
        onChangeText={setSearch}
        placeholder="Try lighting, Riverton, or a community…"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Chip
          label="All topics"
          selected={!filters.topic}
          onPress={() => setFilters({ ...filters, topic: '' })}
        />
        {topics.map((t) => (
          <Chip
            key={t}
            label={t}
            selected={filters.topic === t}
            onPress={() => setFilters({ ...filters, topic: t })}
          />
        ))}
      </ScrollView>
      <View style={styles.between}>
        <Button
          title={`Filters${count ? ` (${count})` : ''}`}
          variant="secondary"
          icon="options-outline"
          onPress={() => {
            setDraft(filters);
            setOpen(true);
          }}
        />
        {!!count && (
          <Button title="Clear filters" variant="ghost" onPress={() => setFilters(emptyFilters)} />
        )}
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          {filtered.length} matching petitions
        </Text>
      </View>
      {!search && !count && (
        <View style={styles.row}>
          {s.profile?.city && (
            <Chip
              label="Near you"
              onPress={() => setFilters({ ...emptyFilters, location: s.profile!.city })}
            />
          )}
          <Chip
            label="Updated this week"
            onPress={() => setFilters({ ...emptyFilters, updated: true })}
          />
          <Chip
            label="Ending within 30 days"
            onPress={() => setFilters({ ...emptyFilters, endingSoon: true })}
          />
        </View>
      )}
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 8 }}
        showsHorizontalScrollIndicator={false}
      >
        {['Relevant', 'Recently updated', 'Ending soon', 'Saved'].map((value) => (
          <Chip
            key={value}
            label={value}
            selected={sort === value}
            onPress={() => setSort(value)}
          />
        ))}
      </ScrollView>
      {filtered.map((p) => (
        <View key={p.id} style={{ gap: 8 }}>
          <PetitionRow petition={p} snapshot={s} />
          <Text style={[styles.small, { color: colors.accent }]}>
            {matchReason(p, s, filters.topic)}
          </Text>
        </View>
      ))}
      {!filtered.length && (
        <Empty
          title="No causes match yet"
          body="Try a broader location, clear a filter, or search for another topic."
        />
      )}
      {!filtered.length && (
        <Button
          title="Reset search and filters"
          variant="secondary"
          onPress={() => {
            setSearch('');
            setFilters(emptyFilters);
            setSort('Relevant');
          }}
        />
      )}
      <SectionHeader title="Find your people" />
      {s.communities
        .filter(
          (c) =>
            !search.trim() ||
            `${c.name} ${c.topic} ${c.city}`.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .slice(0, 4)
        .map((c) => (
          <CommunityCard key={c.id} community={c} snapshot={s} />
        ))}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#12111399',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              width: '100%',
              maxWidth: 680,
              maxHeight: '90%',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
              <SectionHeader
                title="Make the search yours"
                action={
                  <Button title="Cancel filters" variant="ghost" onPress={() => setOpen(false)} />
                }
              />
              <Field
                label="Approximate city or state"
                value={draft.location}
                onChangeText={(location) => setDraft({ ...draft, location })}
              />
              <Text style={styles.h3}>Signing requirement</Text>
              <View style={styles.row}>
                <Chip
                  label="Any requirement"
                  selected={!draft.requirement}
                  onPress={() => setDraft({ ...draft, requirement: '' })}
                />
                {verificationModes.map((v) => (
                  <Chip
                    key={v}
                    label={verificationLabels[v]}
                    selected={draft.requirement === v}
                    onPress={() => setDraft({ ...draft, requirement: v })}
                  />
                ))}
              </View>
              <Text style={styles.h3}>Recipient level</Text>
              <View style={styles.row}>
                <Chip
                  label="Any level"
                  selected={!draft.level}
                  onPress={() => setDraft({ ...draft, level: '' })}
                />
                {governmentLevels.map((v) => (
                  <Chip
                    key={v}
                    label={levelLabels[v]}
                    selected={draft.level === v}
                    onPress={() => setDraft({ ...draft, level: v })}
                  />
                ))}
              </View>
              <Text style={styles.h3}>Community</Text>
              <View style={styles.row}>
                <Chip
                  label="Any community"
                  selected={!draft.community}
                  onPress={() => setDraft({ ...draft, community: '' })}
                />
                {s.communities.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={draft.community === c.id}
                    onPress={() => setDraft({ ...draft, community: c.id })}
                  />
                ))}
              </View>
              <View style={styles.row}>
                <Chip
                  label="Ends within 30 days"
                  selected={draft.endingSoon}
                  onPress={() => setDraft({ ...draft, endingSoon: !draft.endingSoon })}
                />
                <Chip
                  label="Updated this week"
                  selected={draft.updated}
                  onPress={() => setDraft({ ...draft, updated: !draft.updated })}
                />
              </View>
              <Button
                title="Show matching petitions"
                onPress={() => {
                  setFilters(draft);
                  setOpen(false);
                }}
              />
              <Button
                title="Reset filters"
                variant="ghost"
                onPress={() => setDraft(emptyFilters)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Page>
  );
}
