import { Petition, Snapshot } from './model';
import { scorePetition } from './rules';
import { petitionTags } from './tags';

/** Actions logged on this device. Signing, saving, volunteering and discussing come from the server. */
export const loggedSignals = ['detail', 'dwell', 'interested', 'skip', 'share'] as const;
export type SignalKind = (typeof loggedSignals)[number];
export interface Signal {
  petitionId: string;
  kind: SignalKind;
  at: number;
}

/**
 * How strongly each action says "more like this". Committing (signing, volunteering) says more
 * than looking (opening, reading for a while). Passing says "less like this".
 */
export const signalWeights = {
  sign: 5,
  volunteer: 4,
  interested: 3,
  save: 3,
  share: 3,
  discuss: 2,
  dwell: 1.5,
  detail: 1,
  skip: -2,
} as const;
type Action = keyof typeof signalWeights;
const pastTense: Record<Action, string> = {
  sign: 'signed',
  volunteer: 'volunteered for',
  interested: 'swiped right on',
  save: 'saved',
  share: 'shared',
  discuss: 'discussed',
  dwell: 'read',
  detail: 'opened',
  skip: 'passed on',
};

/** Logged actions fade: something read a fortnight ago counts half as much as something read today. */
const HALF_LIFE_MS = 14 * 86400000;
/** The most points behaviour can add to or take from the 0–100 base score. */
export const BEHAVIOR_POINTS = 60;
/** Weighted evidence at which behaviour gets half its full say. Before that, the base score leads. */
const CONFIDENCE_HALF = 8;
/** Once behaviour is steering, every fifth card is one the reader has shown no taste for either way. */
const EXPLORE_EVERY = 5;

/** What a petition is about, for matching: its hidden tags plus its topic and community. */
const features = (p: Petition) => [
  ...petitionTags(p),
  `topic:${p.topic}`,
  ...(p.communityId ? [`community:${p.communityId}`] : []),
];

interface Event {
  petition: Petition;
  action: Action;
  weight: number;
}
export interface Ranked {
  petition: Petition;
  score: number;
  /** Points behaviour added (or removed) on top of the base score. */
  behavior: number;
  reasons: string[];
}

/** The liked petition most like this one, so the card can say why it is here without naming tags. */
function because(p: Petition, f: string[], events: Event[]) {
  let best: { event: Event; overlap: number } | null = null;
  for (const event of events) {
    if (event.weight <= 0 || event.petition.id === p.id) continue;
    const g = features(event.petition);
    const overlap = g.filter((k) => f.includes(k)).length / new Set([...f, ...g]).size;
    if (
      !best ||
      overlap > best.overlap ||
      (overlap === best.overlap && event.weight > best.event.weight)
    )
      best = { event, overlap };
  }
  if (!best || best.overlap === 0) return 'Close to what you read and support';
  const title = best.event.petition.title;
  return `Like “${title.length > 44 ? `${title.slice(0, 43)}…` : title}”, which you ${pastTense[best.event.action]}`;
}

/**
 * The For You ranking: content-based filtering over implicit feedback.
 *
 * 1. Every action becomes a weighted, time-decayed vote for the features of the petition it was
 *    taken on. Summed, the votes are a taste profile: which tags, topics and communities this
 *    person leans toward or away from.
 * 2. Each candidate is scored by how well its features match that profile (cosine-style, so a
 *    petition with many tags does not win just by having many).
 * 3. The match is blended with the explainable base score (interests, city, communities,
 *    freshness, endorsements) by confidence: a new account sees the base score; the more someone
 *    does, the more their behaviour steers, up to ±60 points.
 * 4. A diversity pass stops three cards in a row sharing a topic or community, and an exploration
 *    slot keeps the feed from narrowing into a bubble.
 *
 * Switching personalization off in Profile drops every behavioural signal, leaving the base score.
 */
export function forYou(
  s: Pick<Snapshot, 'profile' | 'petitions' | 'signed' | 'saved' | 'volunteering'>,
  signals: Signal[] = [],
  now = Date.now(),
): Ranked[] {
  const byId = new Map(s.petitions.map((p) => [p.id, p]));
  const events: Event[] = [];
  const add = (id: string, action: Action, at = now) => {
    const petition = byId.get(id);
    if (petition)
      events.push({
        petition,
        action,
        weight: signalWeights[action] * 0.5 ** (Math.max(0, now - at) / HALF_LIFE_MS),
      });
  };
  if (s.profile?.useSigningHistory !== false) {
    const me = s.profile?.id;
    s.signed.forEach((id) => add(id, 'sign'));
    s.saved.forEach((id) => add(id, 'save'));
    s.volunteering.forEach((v) => add(v.petitionId, 'volunteer'));
    if (me)
      s.petitions
        .filter((p) => p.discussion.some((e) => !e.removed && e.authorId === me))
        .forEach((p) => add(p.id, 'discuss'));
    signals.forEach((x) => add(x.petitionId, x.kind, x.at));
  }
  const taste = new Map<string, number>();
  let evidence = 0;
  for (const e of events) {
    const f = features(e.petition);
    evidence += Math.abs(e.weight);
    for (const k of f) taste.set(k, (taste.get(k) ?? 0) + e.weight / Math.sqrt(f.length));
  }
  const confidence = evidence / (evidence + CONFIDENCE_HALF);
  const scored = s.petitions
    .filter((p) => p.status === 'active' && Date.parse(p.deadline) >= now)
    .map((p): Ranked => {
      const f = features(p);
      const match = f.reduce((sum, k) => sum + (taste.get(k) ?? 0), 0) / Math.sqrt(f.length);
      const behavior = BEHAVIOR_POINTS * confidence * Math.tanh(match / signalWeights.sign);
      const base = scorePetition(p, s.profile, now);
      return {
        petition: p,
        score: base.score + behavior,
        behavior,
        reasons: [...(behavior >= 5 ? [because(p, f, events)] : []), ...base.reasons],
      };
    })
    .sort((a, b) => b.score - a.score || a.petition.id.localeCompare(b.petition.id));
  const result: Ranked[] = [];
  while (scored.length) {
    const last = result.slice(-2).map((r) => r.petition);
    const explore = confidence > 0.25 && result.length % EXPLORE_EVERY === EXPLORE_EVERY - 1;
    let next = explore ? scored.findIndex((r) => Math.abs(r.behavior) < 2) : -1;
    if (next >= 0)
      scored[next] = {
        ...scored[next],
        reasons: ['Something different from your usual', ...scored[next].reasons],
      };
    else
      next = scored.findIndex(
        ({ petition: p }) =>
          last.length < 2 ||
          (last.some((q) => q.topic !== p.topic) &&
            last.some((q) => q.communityId !== p.communityId)),
      );
    result.push(scored.splice(Math.max(0, next), 1)[0]);
  }
  return result;
}
