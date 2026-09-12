import { Draft, Topic } from './model';

const departments: Record<Topic, string> = {
  'Safer streets': 'Public Works / Transportation Department',
  Environment: 'Environmental Services Department',
  Education: 'School District Board',
  'Public spaces': 'Parks and Recreation Department',
  Accessibility: 'ADA Coordinator / Accessibility Office',
};
export function suggestRecipient(d: Partial<Draft>) {
  const text = `${d.problem ?? ''} ${d.action ?? ''}`.toLowerCase();
  const department = /\b(bus|crosswalk|sidewalk|traffic|lighting|road)\b/.test(text)
    ? departments['Safer streets']
    : /\b(library|libraries)\b/.test(text)
      ? 'Library Board / Library Services'
      : /\b(school|classroom|curriculum|teacher)\b/.test(text)
        ? departments.Education
        : departments[d.topic ?? 'Safer streets'];
  return {
    name: `${d.city?.trim() ? `${d.city.trim()} — ` : ''}${department}`.slice(0, 150),
    explanation:
      'Assigned from your issue, topic, and city. Confirm that this office controls the requested action; no individual official is inferred.',
  };
}
export function writingSupport(d: Partial<Draft>) {
  const recipient = d.recipient?.trim() || suggestRecipient(d).name;
  const action = d.action?.trim();
  const problem = d.problem?.trim();
  return {
    body:
      problem && action
        ? `${problem}\n\nWe ask ${recipient} to ${action.charAt(0).toLowerCase()}${action.slice(1).replace(/[.!?]+$/, '')}.\n\nPlease publish a response explaining the next steps, the responsible office, and a proposed schedule${d.deadline ? ` by ${d.deadline}` : ''}.`
        : '',
    prompts: [
      !problem ? 'What did you observe, where, and who is affected?' : '',
      !action ? 'What specific change should the responsible office make?' : '',
      !d.evidence?.length
        ? 'Add a public report, policy, photo link, or firsthand account that supports your request.'
        : '',
      'Explain how the requested change would help and how neighbors could measure progress.',
    ].filter(Boolean),
    legal: legalResearch(d.topic ?? 'Safer streets'),
  };
}
export function legalResearch(topic: Topic) {
  const access = {
    title: 'ADA Title II: state and local government accessibility',
    url: 'https://www.ada.gov/topics/title-ii/',
    relevance:
      'A starting point when requesting access to public services or facilities. Applicability requires facts about the service and barrier.',
  };
  return topic === 'Environment'
    ? [
        {
          title: 'EPA: Clean Water Act overview',
          url: 'https://www.epa.gov/laws-regulations/summary-clean-water-act',
          relevance:
            'Relevant to certain water pollution and permitting issues, not every environmental request. Check the responsible authority and local rules.',
        },
      ]
    : topic === 'Accessibility' || topic === 'Public spaces' || topic === 'Safer streets'
      ? [access]
      : [
          {
            title: 'ADA Title II: public education and services',
            url: access.url,
            relevance:
              'May be relevant to accessibility in public education. This does not establish a legal basis for unrelated education proposals.',
          },
        ];
}
