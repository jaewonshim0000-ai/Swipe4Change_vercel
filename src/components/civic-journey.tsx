import React from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Community, Petition, Snapshot } from '../domain/model';
import { nextMilestone } from '../domain/discovery';
import { topicColors } from './theme';
import { Button, Chip, colors, fonts, styles, tokens } from './ui';
import { Progress, TopicArt } from './petition-card';
import { Avatar } from './design-system';

export function SectionHeader({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.between}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text accessibilityRole="header" style={styles.h2}>
          {title}
        </Text>
        {!!note && <Text style={styles.small}>{note}</Text>}
      </View>
      {action}
    </View>
  );
}

export function MilestoneNote({ petition }: { petition: Petition }) {
  const next = nextMilestone(petition);
  return (
    <Text style={[styles.small, { color: colors.accent }]}>
      {next
        ? `${next.remaining.toLocaleString()} more to the next milestone · ${next.target.toLocaleString()} signatures`
        : 'Signature goal reached · follow the next steps'}
    </Text>
  );
}

export function PetitionHero({
  petition: p,
  snapshot: s,
}: {
  petition: Petition;
  snapshot: Snapshot;
}) {
  const { width } = useWindowDimensions();
  const community = s.communities.find((c) => c.id === p.communityId);
  const update = p.updates.find((u) => !u.removed);
  return (
    <View
      style={{
        backgroundColor: topicColors[p.topic].soft,
        borderRadius: tokens.featureRadius,
        overflow: 'hidden',
        ...tokens.shadow,
      }}
    >
      <View style={{ flexDirection: width >= 900 ? 'row' : 'column' }}>
        <View style={{ flex: width >= 900 ? 1 : undefined }}>
          <TopicArt topic={p.topic} large />
        </View>
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
          <Text style={[styles.label, { color: topicColors[p.topic].accent }]}>
            LOCAL SPOTLIGHT · {p.city}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {p.title}
          </Text>
          <Text style={styles.body}>{p.action}</Text>
          <Text style={styles.small}>To: {p.recipient}</Text>
          <Progress petition={p} compact />
          <MilestoneNote petition={p} />
          <Text numberOfLines={2} style={styles.small}>
            {update
              ? `Latest update: ${update.body}`
              : `Organized by ${community?.name ?? p.creator}`}
          </Text>
          <Button
            title="Understand this petition"
            icon="arrow-forward"
            onPress={() => router.push(`/petition/${p.id}`)}
          />
        </View>
      </View>
    </View>
  );
}

export function PetitionCollection({
  title,
  note,
  petitions,
}: {
  title: string;
  note?: string;
  petitions: Petition[];
}) {
  const { width } = useWindowDimensions();
  if (!petitions.length) return null;
  return (
    <View style={{ gap: 16 }}>
      <SectionHeader title={title} note={note} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
      >
        {petitions.slice(0, 6).map((p) => (
          <View
            key={p.id}
            style={{
              width: Math.min(300, width - 56),
              borderRadius: 16,
              padding: 20,
              gap: 12,
              backgroundColor: topicColors[p.topic].soft,
            }}
          >
            <Text style={[styles.label, { color: topicColors[p.topic].accent }]}>{p.topic}</Text>
            <Text accessibilityRole="header" style={styles.h3}>
              {p.title}
            </Text>
            <Text numberOfLines={2} style={styles.small}>
              {p.action}
            </Text>
            <Text style={styles.micro}>
              {p.city} · To: {p.recipient}
            </Text>
            <Progress petition={p} compact />
            <View style={{ marginTop: 'auto' }}>
              <Button
                title="Read petition"
                variant="secondary"
                onPress={() => router.push(`/petition/${p.id}`)}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function CommunityCard({
  community: c,
  snapshot: s,
  action,
}: {
  community: Community;
  snapshot: Snapshot;
  action?: React.ReactNode;
}) {
  const petitions = s.petitions.filter((p) => p.communityId === c.id && p.status === 'active');
  const updates = petitions
    .flatMap((p) => p.updates)
    .filter((u) => !u.removed)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        ...tokens.shadow,
      }}
    >
      <View style={{ backgroundColor: topicColors[c.topic].soft, padding: 20, gap: 12 }}>
        <View style={styles.between}>
          <Avatar name={c.name} />
          <Chip label={c.topic} />
        </View>
        <Text accessibilityRole="header" style={styles.h2}>
          {c.name}
        </Text>
        <Text style={styles.small}>{c.city}</Text>
      </View>
      <View style={{ padding: 20, gap: 16 }}>
        <Text style={styles.body}>{c.description}</Text>
        <Text style={styles.small}>
          {c.members} members · {petitions.length} active petitions
        </Text>
        <Text numberOfLines={2} style={styles.small}>
          {updates[0] ? `Latest: ${updates[0].body}` : 'Bring a question or share your next idea.'}
        </Text>
        <View style={styles.between}>
          <Button
            title="Visit community"
            variant="secondary"
            onPress={() => router.push(`/community/${c.id}`)}
          />
          {action}
        </View>
      </View>
    </View>
  );
}

export function StickyActionBar({
  petition,
  onPress,
}: {
  petition: Petition;
  onPress: () => void;
}) {
  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}
    >
      <View style={[styles.between, { padding: 16 }]}>
        <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>
          {petition.count.toLocaleString()} of {petition.goal.toLocaleString()}
        </Text>
        <Button title="Review and sign" onPress={onPress} />
      </View>
    </SafeAreaView>
  );
}
