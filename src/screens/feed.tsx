import { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSnapshot } from '../data/provider';
import { Petition, Snapshot, topics } from '../domain/model';
import { rankFeed, trendingScore } from '../domain/rules';
import { DiscoveryHero, DiscoveryFooter } from '../components/discovery-editorial';
import { SwipeDeck } from '../components/swipe-deck';
import { PetitionCard } from '../components/petition-card';
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Notice,
  Page,
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
  const { width } = useWindowDimensions();
  const [now] = useState(Date.now);
  const [topic, setTopic] = useState('All topics');
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState(false);
  const [sort, setSort] = useState('For you');
  const [why, setWhy] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'swipe' | null>(null);
  const showGrid =
    explore || sort === 'Saved' || (viewMode ?? (width >= 760 ? 'grid' : 'swipe')) === 'grid';
  const [requirement, setRequirement] = useState('Any requirement');
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
  const s = q.data;
  let petitions = rankFeed(s.petitions, s.profile, now, s.signed).filter(
    (p) =>
      (topic === 'All topics' || p.topic === topic) &&
      (!local || p.city === s.profile?.city) &&
      `${p.title} ${p.summary} ${p.recipient} ${p.city}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (requirement === 'Any requirement' || p.verification === requirement),
  );
  if (sort === 'Trending')
    petitions = petitions.sort((a, b) => trendingScore(b) - trendingScore(a));
  if (sort === 'Saved') petitions = petitions.filter((p) => s.saved.includes(p.id));
  return (
    <Page
      title={explore ? 'Find a cause that feels close to home.' : undefined}
      subtitle={
        explore
          ? 'Search your community’s petitions, explore a topic, and choose your next step.'
          : undefined
      }
      eyebrow={explore ? 'EXPLORE WHAT MATTERS' : undefined}
    >
      {!explore && <DiscoveryHero snapshot={s} />}
      <View style={[styles.between, { paddingTop: 16 }]}>
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            {explore ? 'LOOK A LITTLE CLOSER' : 'YOUR NEXT SMALL ACT'}
          </Text>
          <Text
            accessibilityRole="header"
            style={[
              styles.h2,
              { fontSize: width < 600 ? 28 : 36, lineHeight: width < 600 ? 36 : 44 },
            ]}
          >
            {sort === 'Saved' ? 'Your saved petitions' : 'Browse active petitions'}
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {petitions.length} {petitions.length === 1 ? 'petition' : 'petitions'} to explore
        </Text>
      </View>
      <Field
        label="Search petitions"
        value={search}
        onChangeText={setSearch}
        placeholder="Search a cause, recipient, or city…"
      />
      <View style={styles.between}>
        <View style={styles.row}>
          {['For you', 'Trending', 'Saved'].map((x) => (
            <Chip key={x} label={x} selected={sort === x} onPress={() => setSort(x)} />
          ))}
        </View>
        <Button
          title={width < 600 ? 'Why?' : 'Why these?'}
          icon={width < 600 ? undefined : 'options-outline'}
          variant="ghost"
          onPress={() => setWhy(!why)}
        />
      </View>
      {why && (
        <Notice text="Our transparent recipe: 35% interests (25% selected topics + up to 10% topics you previously signed when history is enabled), 30% matching city, 20% joined communities, 10% recent activity, and 5% endorsements. Turn signing history off in Profile. Swiping never signs a petition. We vary topics and communities to broaden the first page. Trending uses capped recent signatures, saves, discussion, and freshness. Demo activity is fictional. We never infer political affiliation." />
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { flexWrap: 'nowrap', paddingBottom: 4 }]}
      >
        <View style={[styles.row, { flexWrap: 'nowrap' }]}>
          {['All topics', ...topics].map((t) => (
            <Chip key={t} label={t} selected={topic === t} onPress={() => setTopic(t)} />
          ))}
          {s.profile && <Chip label="Near me" selected={local} onPress={() => setLocal(!local)} />}
        </View>
      </ScrollView>
      {explore && (
        <View style={styles.row}>
          {['Any requirement', 'account', 'email', 'community', 'location', 'custom'].map((x) => (
            <Chip
              key={x}
              label={x}
              selected={requirement === x}
              onPress={() => setRequirement(x)}
            />
          ))}
        </View>
      )}
      {!explore && sort !== 'Saved' && (
        <View
          style={[styles.row, { paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }]}
        >
          <Chip label="Card view" selected={showGrid} onPress={() => setViewMode('grid')} />
          <Chip label="Swipe view" selected={!showGrid} onPress={() => setViewMode('swipe')} />
        </View>
      )}
      {petitions.length ? (
        showGrid ? (
          <Grid petitions={petitions} snapshot={s} />
        ) : (
          <SwipeDeck
            key={`${s.profile?.id}-${topic}-${sort}-${local}`}
            petitions={petitions}
            snapshot={s}
          />
        )
      ) : (
        <Empty
          title="A little quiet here"
          body="Try another topic, clear your search, or save a petition to find it here."
        />
      )}
      {!explore && <DiscoveryFooter snapshot={s} />}
    </Page>
  );
}
