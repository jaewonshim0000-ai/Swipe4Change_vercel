import { Community, Petition, Profile, Topic, Verification } from '../domain/model';
export const demoIds = {
  maya: '00000000-0000-4000-8000-000000000001',
  sam: '00000000-0000-4000-8000-000000000002',
  jordan: '00000000-0000-4000-8000-000000000003',
};
export const communityId = (i: number) => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const petitionId = (i: number) => `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const communities: Community[] = [
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
      badges: ['Community starter'],
    },
    {
      id: demoIds.sam,
      name: 'Sam Rivera',
      city: 'Riverton, CA',
      interests: ['Environment', 'Public spaces', 'Accessibility'],
      joined: [communityId(2), communityId(4)],
      onboarded: false,
      emailVerified: true,
      locationApproved: true,
      badges: ['Local voice'],
    },
    {
      id: demoIds.jordan,
      name: 'Jordan Lee',
      city: 'Brookside, CA',
      interests: ['Education', 'Accessibility', 'Safer streets'],
      joined: [communityId(3)],
      onboarded: false,
      emailVerified: false,
      locationApproved: false,
      badges: [],
    },
  ];
}
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
    'Create a community garden at the unused Oak Street lot',
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
    3,
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
];
export function seedPetitions(): Petition[] {
  return stories.map((s, i) => {
    const [title, action, topic, c, verification, count, goal] = s;
    const date = new Date(Date.now() - (i + 1) * 86400000).toISOString();
    const petition: Petition = {
      id: petitionId(i + 1),
      ownerId: i === 0 ? demoIds.maya : demoIds.sam,
      creator: i === 0 ? 'Maya Chen' : 'Sam Rivera',
      collaborators: [],
      title,
      summary: `A practical change for a more welcoming neighborhood. Help us ${action.charAt(0).toLowerCase()}${action.slice(1)}.`,
      problem:
        i === 0
          ? 'The path between Eastbridge campus and the bus stop has long gaps between lights. Students describe feeling uncomfortable walking home after evening activities. This fictional petition asks for a lighting assessment and a public implementation plan.'
          : 'Neighbors have identified a shared need in this fictional community. We are asking the responsible department to review this proposal with residents and publish a practical next step.',
      action,
      recipient:
        i === 0 ? 'Riverton Public Works (fictional)' : 'Community Services Office (fictional)',
      topic,
      city: c === 4 ? 'Brookside, CA' : 'Riverton, CA',
      communityId: communityId(c),
      goal,
      deadline: '2027-06-30',
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
      saves: 28 + i * 3,
      recentSignatures: Math.max(2, 42 - i * 3),
      createdAt: date,
      updates:
        i === 0
          ? [
              {
                id: 'u1',
                body: 'We reached our halfway milestone. Next: share the student path audit at the community listening session. All events in this demo are fictional.',
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
    petition.qualification = {
      details: {
        jurisdiction: petition.city + ' (fictional)',
        authority: 'Sample Election Office (fictional)',
        measureId: `DEMO-${i + 1}`,
        officialTitle: petition.title,
        officialText: `${petition.problem}\n\nRequested action\n${petition.action}`,
        sourceUrl: 'https://example.org/fictional-petition-requirements',
        statutoryRule: `Fictional demonstration threshold: ${goal} accepted signatures. This sample number is not a statement of actual law.`,
        statutoryThreshold: goal,
        circulatorDeclaration:
          'Fictional sample declaration: I personally witnessed each selected signer execute their signature and affirm the accuracy of this collection record. This text is not a jurisdiction-approved affidavit.',
        notarization: 'required',
      },
      status: 'pending',
      reviewNote: 'Fictional sample requirements. No authority has approved this measure.',
      affidavitCount: 0,
      acceptedAffidavits: 0,
    };
    return petition;
  });
}
