import { Petition, Snapshot, Topic, Verification } from './model';
import { findOffice, GovernmentLevel } from './recipients';

export function nextMilestone(p: Pick<Petition, 'count' | 'goal'>) {
  const target = [25, 50, 75, 100]
    .map((n) => Math.ceil((p.goal * n) / 100))
    .find((n) => n > p.count);
  return target ? { target, remaining: target - p.count } : null;
}

export const lastActivity = (p: Petition) =>
  Math.max(
    Date.parse(p.createdAt),
    ...[...p.updates, ...p.edits]
      .filter((e) => !e.removed)
      .map((e) => Date.parse(e.date))
      .filter(Number.isFinite),
  );

export interface DiscoveryFilters {
  topic: Topic | '';
  location: string;
  requirement: Verification | '';
  level: GovernmentLevel | '';
  community: string;
  endingSoon: boolean;
  updated: boolean;
}
export const emptyFilters: DiscoveryFilters = {
  topic: '',
  location: '',
  requirement: '',
  level: '',
  community: '',
  endingSoon: false,
  updated: false,
};

export function matchesDiscovery(
  p: Petition,
  s: Snapshot,
  search: string,
  f: DiscoveryFilters,
  now: number,
) {
  const community = s.communities.find((c) => c.id === p.communityId);
  const query = search.trim().toLowerCase();
  const text =
    `${p.title} ${p.summary} ${p.problem} ${p.action} ${p.recipient} ${p.city} ${p.topic} ${p.creator} ${community?.name ?? ''}`.toLowerCase();
  const days = (Date.parse(p.deadline + 'T23:59:59') - now) / 86400000;
  return (
    p.status === 'active' &&
    (!query || text.includes(query)) &&
    (!f.topic || p.topic === f.topic) &&
    (!f.location.trim() || p.city.toLowerCase().includes(f.location.trim().toLowerCase())) &&
    (!f.requirement || p.verification === f.requirement) &&
    (!f.level || findOffice(p.recipient)?.level === f.level) &&
    (!f.community || p.communityId === f.community) &&
    (!f.endingSoon || (days >= 0 && days <= 30)) &&
    (!f.updated ||
      p.updates.some(
        (u) => !u.removed && Date.parse(u.date) <= now && now - Date.parse(u.date) <= 7 * 86400000,
      ))
  );
}

export function matchReason(p: Petition, s: Snapshot, topic?: string) {
  const reasons = [p.city === s.profile?.city ? `Near ${p.city}` : p.city];
  if (topic === p.topic || s.profile?.interests.includes(p.topic))
    reasons.push(`Matches ${p.topic}`);
  if (s.profile?.joined.includes(p.communityId)) reasons.push('From your community');
  const update = [...p.updates]
    .filter((u) => !u.removed)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  if (update) reasons.push(`Updated ${new Date(update.date).toLocaleDateString()}`);
  return reasons.join(' · ');
}

/** "316 to 75%": signatures still needed for the next quarter mark of the goal. */
export function milestoneLabel(p: Pick<Petition, 'count' | 'goal'>) {
  const pct = [25, 50, 75, 100].find((n) => (100 * p.count) / p.goal < n);
  return pct
    ? `${(Math.ceil((p.goal * pct) / 100) - p.count).toLocaleString()} to ${pct}%`
    : 'Goal reached';
}

export const daysLeft = (p: Pick<Petition, 'deadline'>, now: number) =>
  Math.max(0, Math.ceil((Date.parse(p.deadline + 'T23:59:59') - now) / 86400000));

/** "2d ago", "3h ago", "just now" — the ticker's and cards' relative times. */
export function ago(date: string, now: number) {
  const mins = Math.max(0, Math.round((now - Date.parse(date)) / 60000));
  if (!Number.isFinite(mins) || mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
