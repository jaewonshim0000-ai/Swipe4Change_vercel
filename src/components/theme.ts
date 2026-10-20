import { Platform, StyleSheet, ViewStyle } from 'react-native';

// Tokens from the Swipe4Change v3 design (design/swipe4change-v3/index.html): one visual system
// in the original palette. Light sage canvas, near-black olive for primary buttons, the tab bar and
// the sidebar, one olive-sage accent, and muted semantic colours (terracotta = pass and alerts,
// slate blue = saved and read). White on sage fails contrast, so dark olive carries text.
export const colors = {
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  inkMuted: '#5D6259',
  primary: '#1C1F19',
  primaryPressed: '#000000',
  primarySoft: '#EAF0E3',
  border: '#DDE0D5',
  focus: '#385D88',
  success: '#326544',
  warning: '#805C24',
  ink: '#121113',
  /** The design's text-2: body copy and secondary labels. */
  secondary: '#3E423A',
  muted: '#5D6259',
  accent: '#526344',
  sage: '#899878',
  pale: '#E4E6C3',
  canvas: '#EEF0E9',
  line: '#DDE0D5',
  outline: '#75786F',
  white: '#FFFFFF',
  orange: '#8B6B37',
  error: '#BA1A1A',
  /** Near-black olive: primary buttons, the tab bar, the sidebar, dark cards. */
  dark: '#1C1F19',
  soft: '#EAF0E3',
  /** Progress track, knob track, idle step bar, input fill, quiet card fill. */
  track: '#E6E9DF',
  knob: '#E0E3D9',
  idle: '#D3D7CB',
  field: '#F2F3EE',
  quiet: '#F4F5F0',
  /** The design's line-2: input borders, outline buttons, the sheet handle. */
  handle: '#CDD1C5',
  radio: '#C5C8BD',
  sheet: '#F7F8F4',
  tabIdle: '#9EA393',
  onDark: '#C9CEBF',
  onImage: '#E1E4DA',
  /** Muted track and unselected outline. */
  stone: '#B9BEAF',
  placeholder: '#8C9086',
  /** "Sign here" behind the signature pad. */
  watermark: '#A9AE9F',
  errorSoft: '#FBEDEA',
  warnSoft: '#FBF6EC',
  warnLine: '#E8D6B5',
  /** Toast text on the dark toast. */
  onDarkBright: '#F7F7F2',
  /** Terracotta: pass, alerts and unread badges. */
  heart: '#B4492F',
  heartLight: '#FFB4A2',
  /** Slate blue: saved and read. */
  blue: '#405E82',
  blueLight: '#B9CDE6',
  blueSoft: '#E6EDF7',
  /** The tab bar's frosted near-black. */
  bar: 'rgba(28,31,25,0.95)',
};
/** Topic tones: `accent` is readable text on `soft`; `emoji` marks the topic in chips and tiles. */
export const topicColors = {
  'Safer streets': { accent: '#755329', soft: '#F5EBD9', emoji: '🚸' },
  Environment: { accent: '#3D6546', soft: '#E5EFE2', emoji: '🌳' },
  Education: { accent: '#405E82', soft: '#E6EDF7', emoji: '📚' },
  'Public spaces': { accent: '#78504F', soft: '#F4E5E2', emoji: '🏞️' },
  Accessibility: { accent: '#66517C', soft: '#EDE6F4', emoji: '♿' },
};
/**
 * Chart series in fixed order (never cycled). Checked with the dataviz palette validator: every
 * pair stays apart under colour-blindness simulation, and each clears 3:1 on white.
 */
export const series = ['#2a78d6', '#e0602e', '#14966b'] as const;
/** Plus Jakarta Sans throughout, as in the design. */
export const fonts = {
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_800ExtraBold',
  heading: 'PlusJakartaSans_800ExtraBold',
  display: 'PlusJakartaSans_800ExtraBold',
  italic: 'PlusJakartaSans_400Regular_Italic',
  /** The "It's signed!" sticker title and the profile ribbon. */
  sticker: 'PlusJakartaSans_800ExtraBold_Italic',
};
/** The design's soft drop shadows, as CSS box-shadow strings (supported on web and native). */
export const shadows = {
  card: { boxShadow: '0px 10px 26px -16px rgba(32,38,26,0.35)' },
  raised: { boxShadow: '0px 12px 28px -18px rgba(32,38,26,0.4)' },
  hero: { boxShadow: '0px 22px 40px -22px rgba(32,38,26,0.55)' },
  deck: { boxShadow: '0px 24px 44px -24px rgba(32,38,26,0.6)' },
  button: { boxShadow: '0px 12px 26px -14px rgba(32,38,26,0.6)' },
  float: { boxShadow: '0px 18px 36px -12px rgba(18,20,15,0.55)' },
  small: { boxShadow: '0px 8px 20px -16px rgba(32,38,26,0.4)' },
  /** The round swipe actions sitting on the card's photo. */
  act: { boxShadow: '0px 10px 24px -10px rgba(18,20,15,0.6)' },
} satisfies Record<string, ViewStyle>;

/**
 * CSS-only effects React Native's style types do not list (gradients, backdrop blur). Web gets the
 * CSS property; native gets RN's gradient support and simply skips the blur.
 */
function cssOnly(web: Record<string, string>, native: ViewStyle = {}): ViewStyle {
  return Platform.OS === 'web' ? (web as unknown as ViewStyle) : native;
}
export const gradient = (css: string) =>
  cssOnly({ backgroundImage: css }, { experimental_backgroundImage: css });
/** Web-only blur behind translucent bars; native shows the plain translucent colour. */
export const blur = (px: number) => cssOnly({ backdropFilter: `blur(${px}px)` });
/** Frosted glass pill over imagery. */
export const frost = (alpha = 0.2): ViewStyle => ({
  backgroundColor: `rgba(255,255,255,${alpha})`,
  ...blur(14),
});
/** A top-to-bottom image scrim, given the design's gradient stops. */
export const scrim = (stops: string) => gradient(`linear-gradient(180deg, ${stops})`);
/** The design's named gradients. */
export const gradients = {
  /** Primary buttons: near-black olive with a faint top light. */
  sign: 'linear-gradient(180deg, #2b3027 0%, #1c1f19 100%)',
  /** Progress fill on light grounds. */
  bar: 'linear-gradient(90deg, #899878, #526344)',
  /** Progress fill on photos and dark grounds. */
  barLight: 'linear-gradient(90deg, #f4f5e4, #e4e6c3)',
  /** The pale glow at the top of Write and the empty deck. */
  glow: 'radial-gradient(90% 60% at 50% -12%, rgba(228,230,195,0.95), rgba(228,230,195,0) 70%)',
  /** The AI card's border. */
  ai: 'linear-gradient(120deg, #e4e6c3, #899878 50%, #526344)',
  /** Behind the "It's signed!" celebration. */
  celebrate:
    'linear-gradient(180deg, #8c9b7b 0%, #6b7d5c 28%, #3e4a34 56%, #252a20 80%, #1c1f19 100%)',
  /** Profile hero. */
  hero: 'radial-gradient(60% 70% at 50% 100%, rgba(137,152,120,0.45), rgba(137,152,120,0) 72%), linear-gradient(180deg, #e4e6c3 0%, #eaf0e3 100%)',
};

/** Every font size in the app; inline sizes must be one of these (tests/design-tokens.test.ts). */
export const typeScale: readonly number[] = [
  11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 34, 40, 64,
];
/** Corner radii: ticks, chips, inputs, buttons, cards, sheets, the deck, and 999 for pills. */
export const radii: readonly number[] = [4, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 999];

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  stack: { gap: 16 },
  /** The design's card: white, hairline border, soft shadow. */
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: colors.ink,
    letterSpacing: -1,
  },
  /** Screen titles: "Find your next cause." */
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    letterSpacing: -0.7,
  },
  /** Section titles: "For you", "Badges". */
  h2: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  /** Card titles: "Milestones", "Discussion". */
  h3: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.ink },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.secondary },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted },
  micro: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.outline },
  /** The design's one eyebrow: 12px, extra bold, tracked, uppercase. */
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  input: {
    fontFamily: fonts.body,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.handle,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 50,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.field,
  },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.error },
  divider: { height: 1, backgroundColor: colors.line },
});
/** The celebration's three nested hearts: top colour, bottom colour, bottom opacity. */
export const heartTones = [
  ['#B7C3A3', '#899878', 0.15],
  ['#D2D9BE', '#A3B090', 0.35],
  ['#ECEDD3', '#C5CDAE', 0.6],
] as const;
