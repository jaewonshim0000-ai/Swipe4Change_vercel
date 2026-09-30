import { Petition } from './model';
import { starterTags } from '../../supabase/functions/_shared/civic-rules';

/**
 * Hidden hashtags for the For You ranking, so a bus-stop bench filed under Accessibility and a
 * bus-stop lighting request filed under Safer streets are related, which a topic filter cannot see.
 *
 * An AI model writes each petition's tags (Petition.tags). Until it has, or when it cannot be
 * reached, these word-matching rules stand in, one per starter tag the model is steered toward.
 * Tags describe petitions, never people. They are never shown in the app.
 */
const vocabulary: Record<(typeof starterTags)[number], RegExp> = {
  lighting: /\b(light(s|ing)?|lit|dark(ness)?|after sunset|streetlights?)\b/,
  crossings: /\b(crosswalks?|crossings?|pedestrians?)\b/,
  cycling: /\b(bikes?|bicycles?|cycling|cyclists?)\b/,
  transit: /\b(bus(es)?|shelters?|transit|riders?)\b/,
  traffic: /\b(traffic|vehicles?|speeding|intersections?)\b/,
  students: /\b(students?|classes|homework)\b/,
  schools: /\b(schools?|school district|courtyard|classrooms?)\b/,
  campus: /\b(campus|college|dining halls?|university)\b/,
  families: /\b(children|kids|families|parents|youth)\b/,
  trees: /\b(trees?|shade|planting|canopy)\b/,
  gardens: /\b(gardens?|gardening)\b/,
  parks: /\b(parks?|playgrounds?|green space)\b/,
  recreation: /\b(recreation|courts?|basketball|sports?|playing)\b/,
  libraries: /\b(librar(y|ies)|study rooms?)\b/,
  study: /\b(study|studying|quiet place|read)\b/,
  evenings: /\b(evenings?|nights?|after class|winter|hours)\b/,
  water: /\b(water|refill|fountains?)\b/,
  waste: /\b(waste|compost(ing)?|recycl(e|ing)|food.scraps?|litter|trash)\b/,
  mobility: /\b(wheelchairs?|mobility|ramps?|accessible|step.free|benches?|stamina)\b/,
  sensory: /\b(sensory|noise|noisy|low.stimulation)\b/,
  maintenance: /\b(repairs?|maintenance|worn|broken|potholes?)\b/,
  seniors: /\b(seniors?|older adults|elderly)\b/,
  food: /\b(food|meals?|lunch|dining|groceries)\b/,
  health: /\b(health|clinics?|nurses?)\b/,
  housing: /\b(housing|rent|tenants?|landlords?)\b/,
};

// Snapshot objects keep their identity between refetches, so tagging runs once per petition.
const cache = new WeakMap<object, string[]>();

/** The model's tags when it has written them, otherwise the word-matching stand-in. */
export function petitionTags(
  p: Pick<Petition, 'title' | 'summary' | 'problem' | 'action' | 'recipient' | 'tags'>,
): string[] {
  if (p.tags?.length) return p.tags;
  const hit = cache.get(p);
  if (hit) return hit;
  const text = [p.title, p.summary, p.problem, p.action, p.recipient].join(' ').toLowerCase();
  const tags = starterTags.filter((tag) => vocabulary[tag].test(text));
  cache.set(p, tags);
  return tags;
}
