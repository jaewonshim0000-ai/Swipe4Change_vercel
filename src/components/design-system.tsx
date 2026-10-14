import { Text, View } from 'react-native';
import { colors, fonts, styles } from './theme';

/** Label left, value right, on a quiet ground. Every "here is what you chose" block. */
export function SummaryRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View style={{ borderRadius: 20, backgroundColor: colors.quiet, padding: 14, gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label} style={[styles.between, { gap: 12 }]}>
          <Text style={[styles.small, { flexShrink: 1 }]}>{r.label}</Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              color: colors.ink,
              textAlign: 'right',
              flexShrink: 1,
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
