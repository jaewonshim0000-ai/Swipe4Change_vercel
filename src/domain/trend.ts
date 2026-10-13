/**
 * Where a real signature came from, for the organizer's trend chart. A share link wins over
 * community membership: it is the more specific channel, and each signature counts once.
 */
export const trendSources = ['link', 'community', 'other'] as const;
export type TrendSource = (typeof trendSources)[number];
export const trendSourceLabels: Record<TrendSource, string> = {
  link: 'Share links',
  community: 'Community members',
  other: 'Everyone else',
};
export const TREND_DAYS = 14;
const DAY = 86400000;

/**
 * Real signatures in one day by source. Day 0 is the last 24 hours, so no time zone is involved.
 * Organizer-only and aggregated: per-day counts reveal nothing an organizer refreshing the total
 * could not already see, and no signer or exact time ever leaves the server.
 */
export interface TrendCount {
  daysAgo: number;
  source: TrendSource;
  count: number;
}

/** Buckets private signing times into day counts. The hosted SQL does the same in the database. */
export function countTrend(
  signatures: { signedAt?: string; source: TrendSource }[],
  now: number,
): TrendCount[] {
  const counts = new Map<string, TrendCount>();
  for (const s of signatures) {
    const daysAgo = Math.floor((now - Date.parse(s.signedAt ?? '')) / DAY);
    if (!(daysAgo >= 0 && daysAgo < TREND_DAYS)) continue;
    const key = `${daysAgo}:${s.source}`;
    const c = counts.get(key) ?? { daysAgo, source: s.source, count: 0 };
    c.count += 1;
    counts.set(key, c);
  }
  return [...counts.values()];
}

export type TrendDay = Record<TrendSource, number> & { daysAgo: number; total: number };

/** One entry per day, oldest first, with empty days filled in. */
export function trendDays(counts: TrendCount[]): TrendDay[] {
  return Array.from({ length: TREND_DAYS }, (_, i) => {
    const daysAgo = TREND_DAYS - 1 - i;
    const day = { daysAgo, link: 0, community: 0, other: 0, total: 0 };
    for (const c of counts.filter((c) => c.daysAgo === daysAgo)) {
      day[c.source] += c.count;
      day.total += c.count;
    }
    return day;
  });
}

/** The last seven days against the seven before, and each source's share of the fortnight. */
export function trendSummary(days: TrendDay[]) {
  const sum = (from: number, to: number) =>
    days.filter((d) => d.daysAgo >= from && d.daysAgo < to).reduce((n, d) => n + d.total, 0);
  const bySource = Object.fromEntries(
    trendSources.map((s) => [s, days.reduce((n, d) => n + d[s], 0)]),
  ) as Record<TrendSource, number>;
  return { thisWeek: sum(0, 7), lastWeek: sum(7, 14), bySource };
}
