import { Community, Petition, Profile, Topic, Verification } from '../domain/model';
import { recipientDirectory } from '../domain/recipients';
export const demoIds = {
  maya: '00000000-0000-4000-8000-000000000001',
  sam: '00000000-0000-4000-8000-000000000002',
  jordan: '00000000-0000-4000-8000-000000000003',
};
export const communityId = (i: number) => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const petitionId = (i: number) => `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const seedCommunityList: Omit<Community, 'moderators' | 'sampleMembers'>[] = [
  {
    id: communityId(1),
    name: 'Riverton students',
    description: 'Small changes. Safer journeys. A space for students shaping our fictional town.',
    city: 'Riverton, CA',
    topic: 'Safer streets',
    members: 248,
    ownerId: demoIds.maya,
  },
  {
    id: communityId(2),
    name: 'Greener together',
    description: 'Neighbors making room for trees, cleaner air, and a more resilient community.',
    city: 'Riverton, CA',
    topic: 'Environment',
    members: 186,
    ownerId: demoIds.sam,
  },
  {
    id: communityId(3),
    name: 'Open doors collective',
    description: 'Better access to learning and public places, for everyone.',
    city: 'Riverton, CA',
    topic: 'Accessibility',
    members: 124,
    ownerId: demoIds.jordan,
  },
  {
    id: communityId(4),
    name: 'Brookside neighbors',
    description: 'Libraries, parks, and the places that bring us together.',
    city: 'Brookside, CA',
    topic: 'Public spaces',
    members: 312,
    ownerId: demoIds.sam,
  },
];
/** Fictional starting communities. Members may create their own on top of these. */
export const communities: Community[] = seedCommunityList.map((c) => ({
  ...c,
  sampleMembers: c.members,
  moderators: [],
}));
export const seedCommunities = (): Community[] =>
  communities.map((c) => ({ ...c, moderators: [] }));
export function seedProfiles(): Profile[] {
  return [
    {
      id: demoIds.maya,
      name: 'Maya Chen',
      city: 'Riverton, CA',
      interests: ['Safer streets', 'Environment', 'Education'],
      joined: [communityId(1)],
      onboarded: false,
      emailVerified: true,
      locationApproved: false,
      badges: ['Community starter', 'Change starter'],
      bio: 'Student organizer working toward a brighter walk home from Eastbridge.',
    },
    {
      id: demoIds.sam,
      name: 'Sam Rivera',
      city: 'Riverton, CA',
      interests: ['Environment', 'Public spaces', 'Accessibility'],
      joined: [communityId(1), communityId(2), communityId(4)],
      onboarded: false,
      emailVerified: true,
      locationApproved: true,
      badges: ['Local voice', 'Community builder', 'Change starter'],
    },
    {
      id: demoIds.jordan,
      name: 'Jordan Lee',
      city: 'Brookside, CA',
      interests: ['Education', 'Accessibility', 'Safer streets'],
      joined: [communityId(1), communityId(3)],
      onboarded: false,
      emailVerified: false,
      locationApproved: false,
      badges: ['Community builder'],
    },
  ];
}
/**
 * Fictional backing votes: two Riverton students members already said yes to the raised
 * crosswalk, so one more yes from a member backs it in the demo.
 */
export const seedVotes = [demoIds.sam, demoIds.jordan].map((userId) => ({
  petitionId: petitionId(6),
  communityId: communityId(1),
  userId,
  support: true,
}));
const stories: [string, string, Topic, number, Verification, number, number][] = [
  [
    'A brighter walk home starts here',
    'Install pedestrian lighting along the Eastbridge campus path',
    'Safer streets',
    1,
    'email',
    684,
    1000,
  ],
  [
    'More shade. Cooler school days.',
    'Plant shade trees around the Riverton school courtyard',
    'Environment',
    2,
    'account',
    328,
    500,
  ],
  [
    'Keep the library open after class',
    'Extend the Brookside library study hours to 7 pm',
    'Education',
    4,
    'account',
    412,
    750,
  ],
  [
    'A park that welcomes every body',
    'Add an accessible entrance to Willow Park',
    'Accessibility',
    3,
    'community',
    237,
    400,
  ],
  [
    'Make room for a neighborhood garden',
    'Check who owns the Oak Street lot and publish a feasible community-garden plan',
    'Public spaces',
    4,
    'location',
    156,
    300,
  ],
  [
    'Safer crossings for smaller footsteps',
    'Add a raised crosswalk near Eastbridge School',
    'Safer streets',
    1,
    'community',
    521,
    800,
  ],
  [
    'Refill, reuse, repeat',
    'Install water refill stations at Riverton recreation centers',
    'Environment',
    2,
    'account',
    189,
    500,
  ],
  [
    'A quiet place to learn',
    'Create a sensory-friendly study room at the town library',
    'Education',
    3,
    'email',
    88,
    200,
  ],
  [
    'Our bus stops need a seat',
    'Add accessible benches at Brookside bus stops',
    'Accessibility',
    4,
    'account',
    304,
    500,
  ],
  [
    'Bring the courts back to life',
    'Repair the basketball courts at Cedar Commons',
    'Public spaces',
    4,
    'custom',
    143,
    250,
  ],
  [
    'Bike to school with confidence',
    'Pilot a protected bike lane along College Avenue',
    'Safer streets',
    1,
    'location',
    391,
    600,
  ],
  [
    'Less waste at lunchtime',
    'Pilot a food-scrap collection program in campus dining halls',
    'Environment',
    2,
    'custom',
    76,
    200,
  ],
  [
    'A cooler wait for the bus',
    'Assess shaded shelters at Brookside bus stops',
    'Safer streets',
    4,
    'account',
    0,
    350,
  ],
  [
    'Give broken things a second life',
    'Pilot a monthly repair cafe at a Riverton recreation center',
    'Environment',
    2,
    'account',
    0,
    200,
  ],
  [
    'More ways to learn after the bell',
    'Pilot free after-school homework sessions at Brookside library',
    'Education',
    4,
    'email',
    0,
    300,
  ],
  [
    'A clearer route for everyone',
    'Audit step-free routes to Riverton recreation centers',
    'Accessibility',
    3,
    'account',
    0,
    250,
  ],
  [
    'A place to pause on Main Street',
    'Assess public seating along Brookside Main Street',
    'Public spaces',
    4,
    'account',
    0,
    300,
  ],
  [
    'Be ready when the unexpected happens',
    'Publish a family emergency-preparedness workshop schedule',
    'Education',
    1,
    'email',
    0,
    400,
  ],
  [
    'Rainwater has somewhere to go',
    'Assess rain gardens at Riverton recreation centers',
    'Environment',
    2,
    'account',
    0,
    250,
  ],
  [
    'Borrow the tools to try something new',
    'Pilot a tool and equipment lending shelf at Brookside library',
    'Education',
    4,
    'account',
    0,
    200,
  ],
  [
    'Playtime with a quieter corner',
    'Assess a quiet play area at Willow Park',
    'Accessibility',
    3,
    'email',
    0,
    350,
  ],
  [
    'Know when the courts are open',
    'Publish a maintenance and access calendar for Cedar Commons',
    'Public spaces',
    4,
    'account',
    0,
    150,
  ],
];
/** Concrete sample cases, with the fictional office that can actually decide each request. */
const storyCases: { summary: string; problem: string; recipientId: string }[] = [
  {
    summary:
      'Light the public path from the Eastbridge campus gate to the bus stop before winter evening classes.',
    problem:
      'Evening classes finish after sunset, but the public path from the Eastbridge campus gate to the bus shelter has gaps between lights. Students want to see the route clearly and wait for the bus without standing in the dark. The student path audit illustrates the concern; it is sample evidence, not a measured safety study.',
    recipientId: 'public-works',
  },
  {
    summary:
      'Plant shade trees around the Riverton school courtyard and publish a maintenance plan.',
    problem:
      'Students use the school courtyard for breaks and outdoor activities, but the seating area has little shade. The request asks the district to assess suitable planting sites and explain how new trees would be cared for.',
    recipientId: 'school-board',
  },
  {
    summary: 'Keep the Brookside public library open until 7 pm on school nights.',
    problem:
      'Students who need a quiet place after class cannot use the Brookside library once it closes for the day. An evening-hours pilot would give them a predictable place to study; staffing and costs need a public review.',
    recipientId: 'brookside-library',
  },
  {
    summary: 'Create an accessible entrance to Willow Park and publish a route plan.',
    problem:
      'The current route into Willow Park is difficult for visitors using mobility devices. Residents are asking the parks department to assess the entrance, choose an accessible route and share when improvements could be made.',
    recipientId: 'parks',
  },
  {
    summary: 'Check ownership of the Oak Street lot before proposing a neighborhood garden there.',
    problem:
      'Neighbors have suggested the Oak Street lot for a shared garden, but its ownership and suitability have not been established. A public feasibility review would show whether a garden is possible and who must approve it.',
    recipientId: 'brookside-parks',
  },
  {
    summary: 'Assess a raised crosswalk near Eastbridge School and publish the street design.',
    problem:
      'Families cross the public street near Eastbridge School at busy arrival and dismissal times. They want the city to review a raised crossing and explain what design would make the route clearer for children.',
    recipientId: 'public-works',
  },
  {
    summary: 'Install water refill stations at Riverton recreation centers.',
    problem:
      'Visitors to recreation centers need a dependable way to refill water bottles during activities. The request asks the parks department to identify suitable sites, costs and a maintenance schedule.',
    recipientId: 'parks',
  },
  {
    summary: 'Make a sensory-friendly study room available at the Riverton public library.',
    problem:
      'A shared library room can be noisy for residents who need a lower-stimulation place to read or study. The library board can assess an existing room and publish hours and access guidelines.',
    recipientId: 'library-board',
  },
  {
    summary: 'Add accessible benches at Brookside bus stops with long waits.',
    problem:
      'Some Brookside stops lack a place to sit while waiting for a bus. Riders with limited stamina need the city to assess clear sidewalk space and choose bench sites that preserve accessible travel paths.',
    recipientId: 'brookside-public-works',
  },
  {
    summary: 'Repair the Cedar Commons basketball courts and share a reopening plan.',
    problem:
      'Neighbors want to use the Cedar Commons courts, but worn playing surfaces need a maintenance assessment. Brookside Parks can inspect the site and publish a repair schedule and reopening criteria.',
    recipientId: 'brookside-parks',
  },
  {
    summary: 'Pilot a protected bike lane on College Avenue and publish the traffic review.',
    problem:
      'Students biking on College Avenue share space with turning vehicles. They want the city to study a protected lane, consult people who use the street and publish a pilot design.',
    recipientId: 'public-works',
  },
  {
    summary: 'Test food-scrap collection in Eastbridge campus dining halls.',
    problem:
      'Campus dining produces food scraps that students would like to keep out of general waste. A limited collection pilot could measure participation and the work required before any campuswide rollout.',
    recipientId: 'campus-facilities',
  },
  {
    summary: 'Assess shaded shelters at Brookside bus stops and publish site options.',
    problem:
      'Riders waiting at exposed stops have asked for shade. This fictional proposal asks the city to review clear pedestrian space, shelter locations and maintenance before choosing a pilot.',
    recipientId: 'brookside-public-works',
  },
  {
    summary:
      'Pilot a monthly repair cafe at a Riverton recreation center and share a public review.',
    problem:
      'Residents would like a place to learn basic repairs instead of discarding household items. This fictional proposal requests a supervised pilot with clear safety guidance and an equipment plan.',
    recipientId: 'parks',
  },
  {
    summary: 'Pilot free after-school homework sessions at Brookside library.',
    problem:
      'Families have suggested a structured space for homework support after school. This fictional request asks the library to assess staffing, safeguarding and available study space before starting a pilot.',
    recipientId: 'brookside-library',
  },
  {
    summary: 'Audit step-free routes to Riverton recreation centers and share a public review.',
    problem:
      'Visitors using mobility devices need clear information about entrances and pathways. This fictional proposal asks parks staff to inspect routes and publish an accessible improvement checklist.',
    recipientId: 'parks',
  },
  {
    summary: 'Assess public seating along Brookside Main Street and share a public review.',
    problem:
      'Neighbors have suggested more resting places along Main Street. This fictional request asks the city to identify seating locations that preserve sidewalk access and share maintenance responsibilities.',
    recipientId: 'brookside-public-works',
  },
  {
    summary: 'Publish a family emergency-preparedness workshop schedule.',
    problem:
      'Families want practical guidance for school emergency planning. This fictional request asks the district to consult caregivers, review accessible materials and offer preparedness workshops.',
    recipientId: 'school-board',
  },
  {
    summary: 'Assess rain gardens at Riverton recreation centers and share a public review.',
    problem:
      'Neighbors would like to understand whether planted drainage areas could suit public recreation sites. This fictional request asks parks staff for a site assessment, cost estimate and maintenance plan.',
    recipientId: 'parks',
  },
  {
    summary: 'Pilot a tool and equipment lending shelf at Brookside library.',
    problem:
      'Residents have suggested sharing basic equipment through the library. This fictional proposal asks the board to consult users and review storage, training and safe lending policies.',
    recipientId: 'brookside-library',
  },
  {
    summary: 'Assess a quiet play area at Willow Park and share a public review.',
    problem:
      'Families would like lower-stimulation options alongside active play spaces. This fictional request asks parks staff to consult disabled residents and assess a quiet area with clear access routes.',
    recipientId: 'parks',
  },
  {
    summary: 'Publish a maintenance and access calendar for Cedar Commons.',
    problem:
      'Neighbors want predictable information about court closures and maintenance. This fictional proposal asks parks staff to publish an accessible calendar and explain how residents can report problems.',
    recipientId: 'brookside-parks',
  },
];
export function seedPetitions(): Petition[] {
  return stories.map((s, i) => {
    const [title, action, topic, c, verification, count, goal] = s;
    const caseFile = storyCases[i];
    if (!caseFile) throw new Error(`Missing fictional case for ${title}`);
    const office = recipientDirectory.find((candidate) => candidate.id === caseFile.recipientId);
    if (!office) throw new Error(`Missing fictional recipient for ${title}`);
    const date = new Date(Date.now() - (i + 1) * 86400000).toISOString();
    const petition: Petition = {
      id: petitionId(i + 1),
      ownerId: i === 0 ? demoIds.maya : demoIds.sam,
      creator: i === 0 ? 'Maya Chen' : 'Sam Rivera',
      collaborators: [],
      title,
      summary: caseFile.summary,
      problem: caseFile.problem,
      action:
        i === 0
          ? 'Assess the public path from the Eastbridge campus gate to the bus shelter and publish a pedestrian-lighting plan before winter evening classes.'
          : action,
      recipient: office.name,
      topic,
      city: c === 4 ? 'Brookside, CA' : 'Riverton, CA',
      communityId: communityId(c),
      goal,
      // One shared deadline made every card read the same countdown and left Explore's "Ending
      // soon" section with nothing to sort. Spread them 18–300 days out, deterministically.
      deadline: new Date(Date.now() + (18 + ((i * 47) % 300)) * 86400000)
        .toISOString()
        .slice(0, 10),
      evidence:
        i === 0
          ? [
              {
                label: 'Sample student path audit — illustrative evidence',
                url: 'https://example.org/student-path-audit',
              },
            ]
          : [],
      verification,
      identities:
        i % 3 === 0
          ? ['full_name', 'first_name_last_initial', 'anonymous']
          : i % 3 === 1
            ? ['first_name_last_initial', 'anonymous']
            : ['full_name', 'anonymous'],
      customRule:
        verification === 'custom'
          ? 'Regular users of this public facility may request organizer review. Do not submit private documents.'
          : '',
      status: 'active',
      count,
      sampleCount: count,
      viaShares: 0,
      saves: i < 12 ? 28 + i * 3 : 0,
      deliveries:
        i === 0
          ? [
              {
                id: '30000000-0000-4000-8000-000000000001',
                petitionId: petitionId(1),
                recipient: 'Riverton Public Works (fictional)',
                method: 'in_person',
                deliveredBy: 'Maya Chen',
                deliveredAt: date,
                note: 'Sample hand-off of the student path audit at a community listening session.',
                signatureCount: 500,
                signatories: [],
              },
            ]
          : [],
      volunteerCount: i < 12 ? 4 + (i % 5) : 0,
      sampleVolunteers: i < 12 ? 4 + (i % 5) : 0,
      sampleVelocity: i < 12 ? Math.max(2, 42 - i * 3) : 0,
      recentSignatures: i < 12 ? Math.max(2, 42 - i * 3) : 0,
      createdAt: date,
      updates:
        i === 0
          ? [
              {
                id: 'u1',
                body: 'We shared the student path audit and 500 sample signatures at the listening session. Next milestone: 750 voices. We are asking for a published lighting plan before winter evening classes.',
                author: 'Maya Chen',
                date,
                kind: 'update',
              },
            ]
          : [],
      edits:
        i === 0
          ? [
              {
                id: 'e1',
                body: 'Clarified the requested action: lighting assessment and a public implementation plan. No eligibility rules changed.',
                author: 'Maya Chen',
                date,
                kind: 'edit',
              },
            ]
          : [],
      endorsements:
        i === 0
          ? [
              {
                id: 'en1',
                body: 'Riverton students supports this proposal. Sample community endorsement.',
                author: 'Riverton students',
                date,
                kind: 'endorsement',
              },
            ]
          : [],
      // The flagship's sample endorsement predates voting, so it carries no tally.
      backing:
        i === 0
          ? [{ communityId: communityId(1), yes: 0, no: 0, backedAt: date }]
          : i === 5
            ? [{ communityId: communityId(1), yes: seedVotes.length, no: 0 }]
            : [],
      discussion:
        i === 0
          ? [
              {
                id: 'd1',
                body: 'Could the assessment also consider the stretch beside the bus shelter?',
                author: 'Sam R.',
                date,
                kind: 'question',
              },
            ]
          : [],
      responses:
        i === 0
          ? [
              {
                id: 'r1',
                deliveryId: '30000000-0000-4000-8000-000000000001',
                body: 'We will include the campus path in our next lighting review and invite student input. This is a fictional response for demonstration only.',
                author: 'Avery Park (fictional)',
                organization: 'Riverton Public Works (fictional)',
                date,
                kind: 'response',
                verification: 'verified',
              },
            ]
          : [],
    };
    return petition;
  });
}
