import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { FederalRule, daysLeft } from '../domain/federal';
import { Press, TopicPill } from './kit';
import { Glyph } from './glyph';
import { colors, fonts } from './ui';

export const closingLabel = (left: number) =>
  left === 0 ? 'Comments close today' : `${left} day${left === 1 ? '' : 's'} left to comment`;

/** Says which kind of item a card is wherever petitions and federal rules appear together. */
export function KindBadge({ kind }: { kind: 'petition' | 'federal' }) {
  const federal = kind === 'federal';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: federal ? colors.blue : colors.accent,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Glyph name={federal ? 'capitol' : 'check'} size={12} weight={2.2} color={colors.white} />
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 11,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          color: colors.white,
        }}
      >
        {federal ? 'Federal rule' : 'Petition'}
      </Text>
    </View>
  );
}

/** A real federal proposal. Deliberately plain: it is not a petition and cannot be signed here. */
export function FederalCard({
  rule: r,
  now,
  wide = false,
}: {
  rule: FederalRule;
  now: number;
  /** Fill the column (Explore's list) instead of a fixed rail width. */
  wide?: boolean;
}) {
  const left = daysLeft(r.closesOn, now);
  return (
    <Press
      accessibilityRole="link"
      accessibilityLabel={`Federal rule open for comment: ${r.title}. ${closingLabel(left)}.`}
      onPress={() => router.push(`/federal/${r.id}`)}
      style={{
        width: wide ? '100%' : 240,
        minHeight: wide ? 0 : 210,
        borderRadius: 24,
        backgroundColor: colors.white,
        padding: 16,
        gap: 10,
        boxShadow: '0px 16px 30px -20px rgba(32,38,26,0.35)',
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <KindBadge kind="federal" />
        <TopicPill topic={r.topic} soft />
      </View>
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
          fontSize: 13,
          color: left <= 7 ? colors.orange : colors.accent,
        }}
      >
        {closingLabel(left)}
      </Text>
    </Press>
  );
}
