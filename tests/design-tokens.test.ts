import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { radii, typeScale } from '../src/components/theme';

// Screens style inline, so this keeps every size, radius and colour on the shared theme.
const root = join(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
const sources = [...files(join(root, 'app')), ...files(join(root, 'src'))].map((path) => ({
  path: path.slice(root.length + 1),
  text: readFileSync(path, 'utf8'),
}));

test.each([
  ['fontSize', typeScale],
  ['borderRadius', radii],
])('every inline %s is on the theme scale', (prop, scale) => {
  const off = sources.flatMap(({ path, text }) =>
    [...text.matchAll(new RegExp(`\\b${prop}: (\\d+(?:\\.\\d+)?)\\b`, 'g'))]
      .filter((m) => !scale.includes(Number(m[1])))
      .map((m) => `${path}: ${m[0]}`),
  );
  expect(off).toEqual([]);
});

test('colours are named in the theme, not hard-coded in screens', () => {
  const off = sources
    .filter(({ path }) => !path.endsWith('theme.ts'))
    .flatMap(({ path, text }) => (text.match(/'#[0-9a-f]{3,8}'/gi) ?? []).map((c) => `${path}: ${c}`));
  expect(off).toEqual([]);
});
