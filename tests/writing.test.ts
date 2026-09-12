import { suggestRecipient, writingSupport } from '../src/domain/writing-assistant';

test('recipient assignment follows the issue and never invents an official', () => {
  expect(
    suggestRecipient({ topic: 'Environment', action: 'Repair the crosswalk', city: 'Example, CA' })
      .name,
  ).toBe('Example, CA — Public Works / Transportation Department');
  expect(suggestRecipient({ topic: 'Education' }).name).toBe('School District Board');
});
test('empty input prompts the writer instead of inventing a story', () => {
  expect(writingSupport({}).body).toBe('');
  expect(writingSupport({}).prompts.length).toBeGreaterThan(2);
});
test('structured text retains supplied observations and labels legal research applicability', () => {
  const support = writingSupport({
    topic: 'Accessibility',
    problem: 'Our library entrance has steps.',
    action: 'Assess an accessible entrance',
    recipient: 'Library board',
  });
  expect(support.body).toContain('Our library entrance has steps.');
  expect(support.body).toContain('Library board');
  expect(support.body).not.toMatch(/violat|illegal|verified/);
  expect(support.legal[0].url).toBe('https://www.ada.gov/topics/title-ii/');
});
