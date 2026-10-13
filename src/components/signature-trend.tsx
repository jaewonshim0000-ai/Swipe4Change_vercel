import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  TREND_DAYS,
  TrendCount,
  TrendDay,
  trendDays,
  trendSourceLabels,
  trendSources,
  trendSummary,
} from '../domain/trend';
import { colors, fonts, series, styles } from './theme';

const DAY = 86400000;
const HEIGHT = 112;
const dayName = (daysAgo: number, now: number) =>
  daysAgo === 0
    ? 'Today'
    : new Date(now - daysAgo * DAY).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
const breakdown = (d: TrendDay) =>
  trendSources
    .filter((s) => d[s])
    .map((s) => `${d[s]} ${trendSourceLabels[s].toLowerCase()}`)
    .join(' · ');
const plural = (n: number) => `${n} signature${n === 1 ? '' : 's'}`;

/**
 * Real signatures per day for the last two weeks, stacked by where they came from, so an
 * organizer can see momentum stall and which outreach worked. Tap a day for its breakdown.
 */
export function SignatureTrend({
  counts,
  sampleCount,
  now,
}: {
  counts: TrendCount[];
  sampleCount: number;
  now: number;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const days = trendDays(counts);
  const { thisWeek, lastWeek, bySource } = trendSummary(days);
  const max = Math.max(...days.map((d) => d.total));
  const day = days.find((d) => d.daysAgo === picked);
  const samples =
    sampleCount > 0
      ? ` The ${sampleCount.toLocaleString()} fictional sample signatures have no dates, so they are not shown.`
      : '';
  if (!max)
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.h3}>Signatures, last {TREND_DAYS} days</Text>
        <Text style={styles.small}>
          No real signatures in the last two weeks yet. An organizer update or a post in your
          community usually gets people signing again.{samples}
        </Text>
      </View>
    );
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.h3}>Signatures, last {TREND_DAYS} days</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.secondary }}
      >
        {day
          ? `${dayName(day.daysAgo, now)} · ${plural(day.total)}${day.total ? ` — ${breakdown(day)}` : ''}`
          : `${thisWeek} this week · ${lastWeek} the week before`}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {trendSources.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 4, backgroundColor: series[i] }} />
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.secondary }}>
              {trendSourceLabels[s]} {bySource[s]}
            </Text>
          </View>
        ))}
      </View>
      <View>
        <Text style={[styles.micro, { textAlign: 'right' }]}>Busiest day: {plural(max)}</Text>
        <View
          style={{
            height: HEIGHT,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          {days.map((d) => (
            <Pressable
              key={d.daysAgo}
              accessibilityRole="button"
              accessibilityState={{ selected: picked === d.daysAgo }}
              accessibilityLabel={`${dayName(d.daysAgo, now)}: ${plural(d.total)}${d.total ? `, ${breakdown(d)}` : ''}`}
              onPress={() => setPicked(picked === d.daysAgo ? null : d.daysAgo)}
              style={{
                flex: 1,
                height: '100%',
                justifyContent: 'flex-end',
                alignItems: 'center',
                opacity: picked === null || picked === d.daysAgo ? 1 : 0.35,
              }}
            >
              {/* Top to bottom in legend order, with 2px of surface between segments. */}
              <View style={{ width: '100%', maxWidth: 24, gap: 2 }}>
                {trendSources
                  .map((s, i) => ({ s, i }))
                  .filter(({ s }) => d[s])
                  .map(({ s, i }, n) => (
                    <View
                      key={s}
                      style={{
                        height: Math.max(3, ((HEIGHT - 8) * d[s]) / max),
                        backgroundColor: series[i],
                        borderTopLeftRadius: n === 0 ? 4 : 0,
                        borderTopRightRadius: n === 0 ? 4 : 0,
                      }}
                    />
                  ))}
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={styles.micro}>{dayName(TREND_DAYS - 1, now)}</Text>
          <Text style={styles.micro}>Today</Text>
        </View>
      </View>
      <Text style={styles.small}>
        Share links count signers who arrived through a supporter’s link. Community members are
        signers who belong to this petition’s community. Counts only: you never see who signed how.
        {samples}
      </Text>
    </View>
  );
}
