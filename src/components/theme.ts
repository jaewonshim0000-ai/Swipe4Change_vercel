import { Platform, StyleSheet, ViewStyle } from 'react-native';

// Tokens from the Swipe4Change v2 mobile design (design/…/Swipe4Change v2.dc.html). Sage is a
// surface accent; dark olive is its readable text companion (white on sage fails contrast).
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
  secondary: '#222725',
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
  /** Near-black olive: primary buttons, the tab bar, dark cards. */
  dark: '#1C1F19',
  soft: '#EAF0E3',
  /** Progress track, knob track, idle step bar, input fill, quiet card fill. */
  track: '#E6E9DF',
  knob: '#E0E3D9',
  idle: '#D3D7CB',
  field: '#F2F3EE',
  quiet: '#F4F5F0',
  handle: '#CDD1C5',
  radio: '#C5C8BD',
  sheet: '#F7F8F4',
  tabIdle: '#9EA393',
  onDark: '#C9CEBF',
  onImage: '#E1E4DA',
  heart: '#B4492F',
  heartLight: '#FFB4A2',
  blue: '#405E82',
};
export const topicColors = {
  'Safer streets': { accent: '#755329', soft: '#F5EBD9' },
  Environment: { accent: '#3D6546', soft: '#E5EFE2' },
  Education: { accent: '#405E82', soft: '#E6EDF7' },
  'Public spaces': { accent: '#78504F', soft: '#F4E5E2' },
  Accessibility: { accent: '#66517C', soft: '#EDE6F4' },
};
/**
 * Chart series in fixed order (never cycled). Checked with the dataviz palette validator: every
 * pair stays apart under colour-blindness simulation, and each clears 3:1 on white.
 */
export const series = ['#2a78d6', '#e0602e', '#14966b'] as const;
export const fonts = {
  body: 'WorkSans_400Regular',
  medium: 'WorkSans_500Medium',
  semibold: 'WorkSans_600SemiBold',
  bold: 'WorkSans_700Bold',
  heading: 'Newsreader_600SemiBold',
  display: 'Newsreader_700Bold',
  italic: 'Newsreader_400Regular_Italic',
};
/** The design's soft drop shadows, as CSS box-shadow strings (supported on web and native). */
export const shadows = {
  card: { boxShadow: '0px 10px 26px -16px rgba(32,38,26,0.35)' },
  raised: { boxShadow: '0px 12px 28px -18px rgba(32,38,26,0.4)' },
  hero: { boxShadow: '0px 22px 40px -22px rgba(32,38,26,0.55)' },
  deck: { boxShadow: '0px 24px 44px -24px rgba(32,38,26,0.6)' },
  button: { boxShadow: '0px 6px 16px -8px rgba(32,38,26,0.35)' },
  float: { boxShadow: '0px 18px 36px -12px rgba(18,20,15,0.55)' },
  small: { boxShadow: '0px 8px 20px -16px rgba(32,38,26,0.4)' },
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
/** Frosted glass pill over imagery. */
export const frost = (alpha = 0.2): ViewStyle => ({
  backgroundColor: `rgba(255,255,255,${alpha})`,
  ...cssOnly({ backdropFilter: 'blur(14px)' }),
});
/** A top-to-bottom image scrim, given the design's gradient stops. */
export const scrim = (stops: string) => gradient(`linear-gradient(180deg, ${stops})`);

export const tokens = {
  space: [0, 8, 16, 24, 32, 40, 48],
  radius: 16,
  featureRadius: 24,
  font: { body: 16, small: 14, title: 40, hero: 56 },
  phone: { gutter: 18, cardPad: 18, cardGap: 11, deckImage: 156 },
  shadow: shadows.card,
};
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 46,
    color: colors.ink,
    letterSpacing: -2,
  },
  /** Screen titles: "Find your next cause." */
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: colors.ink,
    letterSpacing: -1.1,
  },
  /** Section titles: "For you", "Badges". */
  h2: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  /** Card titles: "Milestones", "Discussion". */
  h3: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22.5, color: colors.ink },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 19.5,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 23, color: colors.secondary },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  micro: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: colors.outline },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.5,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  input: {
    fontFamily: fonts.body,
    borderRadius: 14,
    padding: 13,
    minHeight: 48,
    fontSize: 15.5,
    color: colors.ink,
    backgroundColor: colors.field,
  },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.error },
  divider: { height: 1, backgroundColor: colors.canvas },
});
