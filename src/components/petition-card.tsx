import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  Pressable,
  Share,
  StyleSheet,
  Platform,
  GestureResponderHandlers,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Petition, Snapshot, Topic, verificationLabels } from '../domain/model';
import { scorePetition } from '../domain/rules';
import { useCommand } from '../data/provider';
import { Button, Chip, Icon, Notice, colors, fonts, styles, tokens } from './ui';
const topicImages: Record<Topic, React.ComponentProps<typeof Image>['source']> = {
  'Safer streets': require('../../assets/theme/safer-streets.jpg'),
  Environment: require('../../assets/theme/environment.jpg'),
  Education: require('../../assets/theme/education.jpg'),
  'Public spaces': require('../../assets/theme/public-spaces.jpg'),
  Accessibility: require('../../assets/theme/accessibility.jpg'),
};
export function TopicArt({ topic, large = false }: { topic: Topic; large?: boolean }) {
  return (
    <View style={{ height: large ? 280 : 184, backgroundColor: colors.pale, overflow: 'hidden' }}>
      <Image
        source={topicImages[topic]}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
        accessibilityLabel={`${topic} — illustrative theme image, not petition evidence`}
      />
      <View
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: colors.white,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Text style={[styles.label, { fontSize: 10, color: colors.secondary, letterSpacing: 0.5 }]}>
          {topic}
        </Text>
      </View>
      <Text
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          backgroundColor: '#121113CC',
          color: colors.white,
          fontFamily: fonts.medium,
          fontSize: 10,
          padding: 4,
          borderRadius: 4,
        }}
      >
        Illustrative image
      </Text>
    </View>
  );
}
export function Progress({ petition: p }: { petition: Petition }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.between}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>
          {p.count.toLocaleString()}{' '}
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
            signatures
          </Text>
        </Text>
        <Text style={styles.muted}>of {p.goal.toLocaleString()}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Signature goal progress"
        accessibilityValue={{
          min: 0,
          max: p.goal,
          now: Math.min(p.count, p.goal),
          text: `${p.count} of ${p.goal} signatures`,
        }}
        style={{ height: 7, backgroundColor: colors.pale, borderRadius: 8, overflow: 'hidden' }}
      >
        <View
          style={{
            width: `${Math.min(100, (100 * p.count) / p.goal)}%`,
            height: '100%',
            backgroundColor: colors.sage,
            borderRadius: 8,
          }}
        />
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>
        {p.sampleCount > 0
          ? `${p.sampleCount.toLocaleString()} fictional sample signatures · new signatures checked against eligibility`
          : 'Signatures checked against the configured eligibility rule'}
      </Text>
    </View>
  );
}
export async function sharePetition(p: Petition) {
  const url = `${Platform.OS === 'web' ? window.location.origin : 'swipe4change:/'}/petition/${p.id}`;
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    return 'Petition link copied. Share it with your community.';
  }
  await Share.share({ message: `${p.title} — Swipe4Change\n${url}` });
  return 'Share sheet opened.';
}
export function PetitionCard({
  petition: p,
  snapshot: s,
  showReason = false,
  preview = false,
  swipeHandlers,
}: {
  petition: Petition;
  snapshot: Snapshot;
  showReason?: boolean;
  preview?: boolean;
  swipeHandlers?: GestureResponderHandlers;
}) {
  const mutation = useCommand();
  const [shareError, setShareError] = useState('');
  const [now] = useState(Date.now);
  const saved = s.saved.includes(p.id);
  const community = s.communities.find((c) => c.id === p.communityId);
  const reasons = scorePetition(
    p,
    s.profile,
    now,
    s.petitions.filter((item) => s.signed.includes(item.id)),
  ).reasons;
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: tokens.radius,
        ...tokens.shadow,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {swipeHandlers ? (
        <View {...swipeHandlers} accessibilityLabel="Swipe artwork left to pass or right to review">
          <TopicArt topic={p.topic} />
        </View>
      ) : (
        <Pressable
          accessibilityRole={preview ? 'text' : 'link'}
          disabled={preview}
          accessibilityLabel={`View ${p.title}`}
          onPress={() => router.push(`/petition/${p.id}`)}
        >
          <TopicArt topic={p.topic} />
        </Pressable>
      )}
      <View style={{ padding: 20, gap: 16, flex: 1, justifyContent: 'space-between' }}>
        <View
          {...swipeHandlers}
          style={{ gap: 14, ...(swipeHandlers ? { userSelect: 'none' as const } : {}) }}
        >
          <View style={styles.between}>
            <Text style={[styles.label, { fontSize: 10 }]}>{p.topic}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>
              {community?.name}
            </Text>
          </View>
          {swipeHandlers ? (
            <Text accessibilityRole="header" style={[styles.h2, { fontSize: 23, lineHeight: 28 }]}>
              {p.title}
            </Text>
          ) : (
            <Pressable
              accessibilityRole={preview ? 'text' : 'link'}
              disabled={preview}
              onPress={() => router.push(`/petition/${p.id}`)}
            >
              <Text style={[styles.h2, { fontSize: 23, lineHeight: 28 }]}>{p.title}</Text>
            </Pressable>
          )}
          <Text numberOfLines={2} style={styles.muted}>
            {p.summary}
          </Text>
          <View style={{ gap: 6 }}>
            <View style={styles.row}>
              <Icon name="location-outline" size={14} />
              <Text
                style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, flexShrink: 1 }}
              >
                {p.city}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              To: {p.recipient}
            </Text>
          </View>
          <Progress petition={p} />
          <View style={styles.between}>
            <Chip label={verificationLabels[p.verification]} />
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              {Math.max(0, Math.ceil((Date.parse(p.deadline) - now) / 86400000))} days left
            </Text>
          </View>
          {showReason && reasons.length > 0 && (
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.accent }}>
              ↳ {reasons.slice(0, 2).join(' · ')}
            </Text>
          )}
        </View>
        {!preview && (
          <View
            style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }]}
          >
            <View style={{ flex: 1 }}>
              <Button
                title={s.signed.includes(p.id) ? 'Signed · view' : 'View & sign'}
                onPress={() => router.push(`/petition/${p.id}`)}
                variant="primary"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? `Unsave ${p.title}` : `Save ${p.title}`}
              disabled={mutation.isPending}
              onPress={() =>
                s.profile
                  ? mutation.mutate({ type: 'save', petitionId: p.id })
                  : router.push('/(auth)/sign-in')
              }
              style={card.icon}
            >
              <Icon name={saved ? 'bookmark' : 'bookmark-outline'} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${p.title}`}
              onPress={() => {
                void sharePetition(p)
                  .then(setShareError)
                  .catch(() =>
                    setShareError('Sharing is unavailable. Copy the address from your browser.'),
                  );
              }}
              style={card.icon}
            >
              <Icon name="share-outline" />
            </Pressable>
          </View>
        )}
        {mutation.error && <Notice error text={mutation.error.message} />}
        {!!shareError && <Notice text={shareError} />}
      </View>
    </View>
  );
}
const card = StyleSheet.create({
  icon: {
    minWidth: 44,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
