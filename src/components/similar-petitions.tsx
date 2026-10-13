import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SimilarPetition } from '../domain/similar';
import { Cover, petitionImage } from './kit';
import { Glyph } from './glyph';
import { Button, colors, fonts, styles } from './ui';

/**
 * Open petitions that look like the one being written. Advisory only: it never blocks publishing,
 * and "Mine is different" hides these matches for the rest of the draft.
 */
export function SimilarPetitions({
  matches,
  onDismiss,
}: {
  matches: SimilarPetition[];
  onDismiss: () => void;
}) {
  if (!matches.length) return null;
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12 }}>
      <Text style={styles.label}>Already started?</Text>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {matches.length === 1
          ? 'A similar petition is already open'
          : `${matches.length} similar petitions are already open`}
      </Text>
      <Text style={styles.small}>
        Signing or helping with an existing petition keeps supporters together, instead of splitting
        them between several asks to the same office.
      </Text>
      {matches.map(({ petition: p, reasons }) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          accessibilityLabel={`Open ${p.title}. ${reasons.join(', ')}`}
          onPress={() => router.push(`/petition/${p.id}`)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            backgroundColor: colors.quiet,
            borderRadius: 18,
            padding: 8,
          }}
        >
          <Cover source={petitionImage(p)} style={{ width: 52, height: 52, borderRadius: 14 }} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              style={{ fontFamily: fonts.heading, fontSize: 14, lineHeight: 18, color: colors.ink }}
            >
              {p.title}
            </Text>
            <Text style={[styles.small, { fontSize: 11.5, lineHeight: 16 }]}>
              {p.count.toLocaleString()} of {p.goal.toLocaleString()} · to {p.recipient}
            </Text>
            <Text style={[styles.micro, { fontSize: 10.5, lineHeight: 15 }]}>
              {reasons.join(' · ')}
            </Text>
          </View>
          <Glyph name="next" size={18} color={colors.muted} />
        </Pressable>
      ))}
      <Button title="Mine is different, keep writing" variant="ghost" onPress={onDismiss} />
    </View>
  );
}
