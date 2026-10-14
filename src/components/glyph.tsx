import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from './theme';

/** Line icons drawn in the design (24×24, round caps). A circle is `[cx, cy, r]`. */
const shapes = {
  leaf: [
    'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
    'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
  ],
  next: ['m9 6 6 6-6 6'],
  back: ['m14 6-6 6 6 6'],
  pin: ['M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z', [12, 10, 2.5]],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  search: [[11, 11, 7], 'm20 20-3.6-3.6'],
  filters: ['M4 7h10M18 7h2M4 17h4M12 17h8', [16, 7, 2], [10, 17, 2]],
  share: ['M12 15V3', 'm8 7 4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  link: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  up: ['M12 19V5', 'm5 12 7-7 7 7'],
  check: ['m5 13 4.5 4.5L19 7'],
  home: ['m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 21v-7h6v7'],
  explore: [[12, 12, 9], 'm15.5 8.5-2 5.5-5.5 2 2-5.5z'],
  create: ['M12 5v14M5 12h14'],
  communities: [
    [9, 8, 3.2],
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    [17.5, 9.5, 2.6],
    'M17 14.5c2.6 0 4.5 1.9 4.5 4.5',
  ],
  profile: [[12, 8, 3.6], 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  capitol: ['M12 3 3 8h18Z', 'M6 11v6M10 11v6M14 11v6M18 11v6', 'M4 20h16'],
  pen: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z', 'm13.5 6.5 4 4', 'M14 20h6'],
  calendar: [
    'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
    'M4 10h16M8 3v4M16 3v4',
    'm9 15 2 2 4-4',
  ],
  flag: ['M5 21V4', 'M5 4h11l-2 4.5 2 4.5H5'],
  chat: ['M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4A8 8 0 1 1 20 11.5Z'],
  star: ['m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z'],
  // A raised hand (Lucide "hand", ISC licence).
  hand: [
    'M18 11V6a2 2 0 0 0-4 0',
    'M14 10V4a2 2 0 0 0-4 0v2',
    'M10 10.5V6a2 2 0 0 0-4 0v8',
    'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ],
} satisfies Record<string, (string | [number, number, number])[]>;
export type GlyphName = keyof typeof shapes;

export function Glyph({
  name,
  size = 20,
  color = colors.dark,
  weight = 1.8,
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {shapes[name].map((s, i) =>
        typeof s === 'string' ? (
          <Path key={i} d={s} />
        ) : (
          <Circle key={i} cx={s[0]} cy={s[1]} r={s[2]} />
        ),
      )}
    </Svg>
  );
}
