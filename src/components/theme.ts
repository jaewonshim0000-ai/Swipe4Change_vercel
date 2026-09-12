import { Platform, StyleSheet } from 'react-native';

// Adapted from the supplied LookAware reference. Sage is a surface accent;
// dark olive is its readable text companion (white on sage fails normal-text contrast).
export const colors = {
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
  radius: 8,
  font: { body: 16, small: 14, title: 40, hero: 56 },
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
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 48,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  h3: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.secondary },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.2,
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
