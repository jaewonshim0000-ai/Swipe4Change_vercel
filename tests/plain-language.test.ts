import {
  TARGET_GRADE,
  gradeLevel,
  hasMeasurableDetail,
  passiveClauses,
  plainLanguage,
  syllables,
  vagueTermsIn,
} from '../src/domain/plain-language';

test('syllable estimates are close enough to grade text', () => {
  expect(syllables('cat')).toBe(1);
  expect(syllables('lighting')).toBe(2);
  expect(syllables('assessment')).toBe(3);
  expect(syllables('accessibility')).toBe(6);
  // The silent-e correction is the one that matters most for common words.
  expect(syllables('make')).toBe(1);
  expect(syllables('')).toBe(0);
});

test('a grade level separates plain writing from bureaucratic writing', () => {
  const plain =
    'The path has no lights. Students walk home in the dark. We want three lights on it by March.';
  const dense =
    'Notwithstanding the aforementioned infrastructural deficiencies, the municipality should undertake a comprehensive illumination feasibility determination in accordance with established procedural requirements.';
  expect(gradeLevel(plain)).toBeLessThan(TARGET_GRADE);
  expect(gradeLevel(dense)).toBeGreaterThan(TARGET_GRADE);
  // Too short to judge honestly, so it reports nothing rather than a wrong number.
  expect(gradeLevel('Fix it.')).toBe(0);
});

test('passive clauses are found, including irregular participles', () => {
  expect(passiveClauses('The lighting will be improved next year.')).toEqual(['be improved']);
  expect(passiveClauses('A decision was made by the board.')).toEqual(['was made']);
  expect(passiveClauses('The council installed three lights.')).toEqual([]);
});

test('vague asks and unmeasurable asks are both flagged', () => {
  expect(vagueTermsIn('We want the city to improve safety')).toEqual(['improve']);
  expect(vagueTermsIn('Install three lights on the Eastbridge path')).toEqual([]);
  expect(hasMeasurableDetail('Install three lights by March 2027')).toBe(true);
  expect(hasMeasurableDetail('Make the path safer')).toBe(false);
});

test('a clear, specific petition draws no warnings', () => {
  const result = plainLanguage({
    title: 'A brighter walk home',
    summary: 'We are asking for three new lights on the Eastbridge path before winter.',
    problem:
      'The path has no lights between the campus gate and the bus stop. Students walk it after dark all winter.',
    action: 'Install 3 street lights on the Eastbridge path by March 2027.',
  });
  expect(result.grade).toBeLessThanOrEqual(TARGET_GRADE);
  expect(result.issues.filter((i) => i.severity === 'warn')).toEqual([]);
});

test('a vague, dense petition is told exactly what is wrong', () => {
  const result = plainLanguage({
    title:
      'A petition regarding the improvement of pedestrian infrastructure within our municipality and its surrounding districts',
    problem:
      'Notwithstanding the aforementioned infrastructural deficiencies which have been identified by numerous stakeholders over an extended duration, the pedestrian thoroughfare remains inadequately illuminated during hours of darkness and therefore constitutes an ongoing concern.',
    action: 'Improve safety.',
  });
  const ids = result.issues.map((i) => i.id);
  expect(ids).toContain('grade');
  expect(ids).toContain('vague-action');
  expect(ids).toContain('unmeasurable');
  expect(ids).toContain('long-sentence');
  expect(ids).toContain('long-title');
  expect(ids).toContain('passive');
});

test('the checker never rewrites or blocks, it only reports', () => {
  const draft = { action: 'Improve things.', problem: 'It is bad.' };
  const before = JSON.stringify(draft);
  plainLanguage(draft);
  expect(JSON.stringify(draft)).toBe(before);
});
