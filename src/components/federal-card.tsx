import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { FederalRule, daysLeft } from '../domain/federal';
import { Press, TopicPill } from './kit';
import { colors, fonts } from './ui';

export const closingLabel = (left: number) =>
  left === 0 ? 'Comments close today' : `${left} day${left === 1 ? '' : 's'} left to comment`;

/** A real federal proposal. Deliberately plain: it is not a petition and cannot be signed here. */
export function FederalCard({ rule: r, now }: { rule: FederalRule; now: number }) {
  const left = daysLeft(r.closesOn, now);
  return (
    <Press
      accessibilityRole="link"
      accessibilityLabel={`Federal rule open for comment: ${r.title}. ${closingLabel(left)}.`}
      onPress={() => router.push(`/federal/${r.id}`)}
      style={{
        width: 240,
        minHeight: 210,
        borderRadius: 26,
        backgroundColor: colors.white,
        padding: 16,
        gap: 10,
        boxShadow: '0px 16px 30px -20px rgba(32,38,26,0.35)',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 10.5,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: colors.muted,
        }}
      >
        Federal rule · open for comment
      </Text>
      <TopicPill topic={r.topic} soft />
      <Text
        numberOfLines={4}
        style={{
          fontFamily: fonts.heading,
          fontSize: 16,
          lineHeight: 20,
          letterSpacing: -0.3,
          color: colors.ink,
        }}
      >
        {r.title}
      </Text>
      <View style={{ flex: 1 }} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
        {r.agency}
      </Text>
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 12.5,
          color: left <= 7 ? colors.orange : colors.accent,
        }}
      >
        {closingLabel(left)}
      </Text>
    </Press>
  );
}
