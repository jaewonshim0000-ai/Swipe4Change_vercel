import { Topic } from './model';

/**
 * A directory of the offices a local request can reasonably go to.
 *
 * Most people know what they want changed and have no idea who decides it — a crosswalk is Public
 * Works, not the mayor; a school crossing guard may be the district rather than the city. Sending a
 * request to the wrong office is the most common way a real petition dies quietly.
 *
 * Every office below is FICTIONAL, invented for this demo. The point is the shape of the
 * information — level of government, what the office actually controls, how long it usually takes —
 * not the specific bodies. A real deployment would load its own jurisdiction's directory here, and
 * `responseDays` would have to come from that jurisdiction's published service standards rather
 * than from an app's guess.
 */
export const governmentLevels = ['city', 'county', 'state', 'school', 'campus'] as const;
export type GovernmentLevel = (typeof governmentLevels)[number];
export const levelLabels: Record<GovernmentLevel, string> = {
  city: 'City',
  county: 'County',
  state: 'State',
  school: 'School district',
  campus: 'Campus',
};
export interface RecipientOffice {
  id: string;
  name: string;
  level: GovernmentLevel;
  /** What this office can actually decide. Written so a reader can rule it in or out. */
  controls: string[];
  /** What it cannot decide, and who can instead. The half people usually get wrong. */
  notResponsibleFor: string;
  topics: Topic[];
  /** Typical published turnaround in this fictional town. */
  responseDays: number;
}
export const recipientDirectory: RecipientOffice[] = [
  {
    id: 'public-works',
    name: 'Riverton Public Works (fictional)',
    level: 'city',
    controls: [
      'Street lighting on city-owned roads and paths',
      'Crosswalks, sidewalks and curb ramps',
      'Traffic calming and signage',
      'Pothole and pavement repair',
    ],
    notResponsibleFor:
      'Roads inside a school or campus boundary, and state highways running through town. Those belong to the school district and the state transportation department.',
    topics: ['Safer streets', 'Accessibility'],
    responseDays: 21,
  },
  {
    id: 'transportation-safety',
    name: 'Riverton Transportation Safety Board (fictional)',
    level: 'city',
    controls: [
      'Speed limit reviews',
      'School zone boundaries and hours',
      'Requests for a formal traffic study',
    ],
    notResponsibleFor:
      'Building the change once it is approved. A completed study goes to Public Works to carry out.',
    topics: ['Safer streets'],
    responseDays: 45,
  },
  {
    id: 'parks',
    name: 'Riverton Parks and Recreation (fictional)',
    level: 'city',
    controls: [
      'Park hours, benches, lighting and play equipment',
      'Public restroom provision in parks',
      'Community garden plots and field bookings',
    ],
    notResponsibleFor:
      'Land the city does not own. A vacant lot usually belongs to the county assessor’s office or a private owner.',
    topics: ['Public spaces', 'Environment'],
    responseDays: 30,
  },
  {
    id: 'environmental-services',
    name: 'Riverton Environmental Services (fictional)',
    level: 'city',
    controls: [
      'Recycling and waste collection',
      'Storm drain maintenance',
      'Street tree planting and removal permits',
    ],
    notResponsibleFor:
      'Water quality standards and industrial permits, which are set at state level.',
    topics: ['Environment'],
    responseDays: 30,
  },
  {
    id: 'county-health',
    name: 'Brookside County Environmental Health (fictional)',
    level: 'county',
    controls: [
      'Water testing and public health inspections',
      'Air quality complaints',
      'Mosquito and vector control',
    ],
    notResponsibleFor:
      'Anything inside city limits that the city has its own ordinance for. Check the city first.',
    topics: ['Environment', 'Public spaces'],
    responseDays: 40,
  },
  {
    id: 'school-board',
    name: 'Riverton Unified School Board (fictional)',
    level: 'school',
    controls: [
      'School facilities, grounds and lighting',
      'Crossing guards at district schools',
      'Curriculum and calendar decisions',
      'Library hours at school libraries',
    ],
    notResponsibleFor:
      'Public roads outside the school boundary, even directly outside the gate. That is Public Works.',
    topics: ['Education', 'Safer streets', 'Accessibility'],
    responseDays: 35,
  },
  {
    id: 'library-board',
    name: 'Riverton Library Board (fictional)',
    level: 'city',
    controls: [
      'Public library opening hours and staffing',
      'Study space and public computer provision',
      'Branch programming',
    ],
    notResponsibleFor: 'School libraries, which the school district runs.',
    topics: ['Education', 'Public spaces'],
    responseDays: 28,
  },
  {
    id: 'brookside-library',
    name: 'Brookside Library Board (fictional)',
    level: 'city',
    controls: ['Public library hours and staffing', 'Study space in Brookside library branches'],
    notResponsibleFor: 'School libraries, which are managed by the school district.',
    topics: ['Education', 'Public spaces'],
    responseDays: 28,
  },
  {
    id: 'brookside-parks',
    name: 'Brookside Parks and Recreation (fictional)',
    level: 'city',
    controls: ['City park facilities and courts', 'Community garden feasibility on city land'],
    notResponsibleFor: 'Privately owned land and public streets. Ownership must be checked first.',
    topics: ['Public spaces', 'Accessibility'],
    responseDays: 30,
  },
  {
    id: 'brookside-public-works',
    name: 'Brookside Public Works (fictional)',
    level: 'city',
    controls: ['Public bus stop fixtures', 'Accessible sidewalks and street furniture'],
    notResponsibleFor: 'Bus schedules and vehicles, which are managed by the transit agency.',
    topics: ['Accessibility', 'Safer streets'],
    responseDays: 30,
  },
  {
    id: 'ada-coordinator',
    name: 'Riverton ADA Coordinator (fictional)',
    level: 'city',
    controls: [
      'Accessibility of city services, buildings and meetings',
      'Curb ramp and accessible parking complaints',
      'Formal accessibility grievances',
    ],
    notResponsibleFor:
      'Private businesses. A private premises complaint goes to a different process entirely.',
    topics: ['Accessibility', 'Public spaces'],
    responseDays: 21,
  },
  {
    id: 'campus-facilities',
    name: 'Eastbridge Campus Facilities (fictional)',
    level: 'campus',
    controls: [
      'Paths, lighting and buildings inside the campus boundary',
      'Campus dining and waste operations',
      'Campus shuttle routes and stops',
      'Bicycle parking on campus',
    ],
    notResponsibleFor: 'The public street the campus sits on, which belongs to the city.',
    topics: ['Safer streets', 'Education', 'Accessibility'],
    responseDays: 25,
  },
  {
    id: 'state-transportation',
    name: 'State Transportation District 4 (fictional)',
    level: 'state',
    controls: [
      'State highways and their crossings',
      'Highway signage and lighting',
      'Interchange and on-ramp design',
    ],
    notResponsibleFor:
      'City-maintained residential streets, even where they meet a highway. Start with the city.',
    topics: ['Safer streets'],
    responseDays: 60,
  },
];

/** Exact-name lookup, so a petition can show its recipient's level without storing a new field. */
export function findOffice(recipient: string): RecipientOffice | undefined {
  const name = recipient.trim().toLowerCase();
  return recipientDirectory.find((o) => o.name.toLowerCase() === name);
}

/**
 * Offices worth considering for a topic, most relevant first. Deterministic and explainable: a
 * topic match ranks above a keyword match, and nothing is hidden from the reader.
 */
export function suggestOffices(topic: Topic | undefined, text = ''): RecipientOffice[] {
  const haystack = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    'school-board': ['school', 'classroom', 'teacher', 'crossing guard', 'district'],
    'library-board': ['library', 'libraries', 'study space'],
    'campus-facilities': ['campus', 'quad', 'dorm', 'shuttle'],
    'state-transportation': ['highway', 'freeway', 'interchange', 'on-ramp'],
    'county-health': ['water quality', 'mosquito', 'air quality'],
    'ada-coordinator': ['wheelchair', 'accessible', 'ramp', 'accessibility'],
    parks: ['park', 'playground', 'bench', 'restroom'],
    'public-works': ['crosswalk', 'sidewalk', 'lighting', 'pothole', 'traffic', 'street'],
    'environmental-services': ['recycling', 'waste', 'storm drain', 'tree'],
  };
  return [...recipientDirectory]
    .map((office) => ({
      office,
      score:
        (topic && office.topics.includes(topic) ? 2 : 0) +
        ((keywords[office.id] ?? []).some((k) => haystack.includes(k)) ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.office);
}
