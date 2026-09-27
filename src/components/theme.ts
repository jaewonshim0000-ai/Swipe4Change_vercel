import { Platform, StyleSheet } from 'react-native';

// Adapted from the supplied LookAware reference. Sage is a surface accent;
// dark olive is its readable text companion (white on sage fails normal-text contrast).
export const colors = {
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  inkMuted: '#5D6259',
  primary: '#526344',
  primaryPressed: '#3D4B32',
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
  canvas: '#F7F7F2',
  line: '#DDE0D5',
  outline: '#75786F',
  white: '#FFFFFF',
  orange: '#8B6B37',
  error: '#BA1A1A',
};
export const topicColors = {
  'Safer streets': { accent: '#755329', soft: '#F5EBD9' },
  Environment: { accent: '#3D6546', soft: '#E5EFE2' },
  Education: { accent: '#405E82', soft: '#E6EDF7' },
  'Public spaces': { accent: '#78504F', soft: '#F4E5E2' },
  Accessibility: { accent: '#66517C', soft: '#EDE6F4' },
};
export const fonts = {
  body: 'WorkSans_400Regular',
  medium: 'WorkSans_500Medium',
  semibold: 'WorkSans_600SemiBold',
  bold: 'WorkSans_700Bold',
  heading: 'Newsreader_600SemiBold',
  display: 'Newsreader_700Bold',
  italic: 'Newsreader_400Regular_Italic',
};
export const tokens = {
  space: [0, 8, 16, 24, 32, 40, 48],
  radius: 16,
  featureRadius: 24,
  font: { body: 16, small: 14, title: 40, hero: 56 },
  // Phone-first metrics from the Swipe4Change mobile design. Screen padding is tighter than the
  // 8-point desktop rhythm because a 402pt-wide frame cannot afford 24-32pt gutters.
  phone: { gutter: 18, cardPad: 18, cardGap: 11, deckImage: 156 },
  shadow: Platform.select({
    web: { boxShadow: '0px 3px 12px rgba(18, 17, 19, 0.045)' },
    default: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.045,
      shadowRadius: 12,
      elevation: 2,
    },
  }),
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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: tokens.radius,
    padding: 24,
    gap: 16,
    ...tokens.shadow,
  },
  // Editorial scale: the larger the type, the tighter the tracking and leading. Sizes below are
  // the phone values from the mobile design; Page steps the title up at tablet/desktop widths.
  hero: {
    fontFamily: fonts.display,
    fontSize: 50,
    lineHeight: 49,
    color: colors.ink,
    letterSpacing: -2.2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 35,
    color: colors.ink,
    letterSpacing: -1.1,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 23,
    lineHeight: 27,
    color: colors.ink,
    letterSpacing: -0.7,
  },
  h3: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 27, color: colors.ink },
  /** Card and list-row headings — the small end of the serif scale. */
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26, color: colors.secondary },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted },
  /** Dense supporting copy inside cards, where 14pt would crowd the layout. */
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.muted },
  micro: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.outline },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  input: {
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: '#C5C8BD',
    borderRadius: tokens.radius,
    padding: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.error },
  divider: { height: 1, backgroundColor: colors.line },
});
