import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Glyph, GlyphName } from './glyph';
import { colors, topicColors } from './theme';

type Look = { icon: GlyphName; tone: { accent: string; soft: string } };
const civic = { accent: colors.accent, soft: colors.soft };
// Badge tones reuse the topic palette, whose accents already pass contrast on white and on soft.
const looks: Record<string, Look> = {
  'First voice': { icon: 'pen', tone: topicColors.Education },
  'Showing up': { icon: 'calendar', tone: topicColors['Safer streets'] },
  'Community builder': { icon: 'communities', tone: topicColors.Environment },
  'Change starter': { icon: 'flag', tone: topicColors['Public spaces'] },
  'Conversation starter': { icon: 'chat', tone: topicColors.Accessibility },
  'Steady voice': { icon: 'trend', tone: topicColors.Education },
  'Wide lens': { icon: 'compass', tone: topicColors['Safer streets'] },
  'Keeping watch': { icon: 'bookmark', tone: topicColors.Environment },
  'Helping hand': { icon: 'hand', tone: topicColors['Public spaces'] },
  'Ripple maker': { icon: 'share', tone: topicColors.Accessibility },
  'Goal getter': { icon: 'sparkle', tone: civic },
  'Local voice': { icon: 'pin', tone: civic },
  'Community starter': { icon: 'home', tone: civic },
};
export const badgeLook = (name: string): Look => looks[name] ?? { icon: 'star', tone: civic };

const R = 27;
const RING = 2 * Math.PI * R;
/** A seal with 16 shallow scallops around a radius-27 circle, centered in a 64×64 box. */
const SEAL = (() => {
  const n = 16;
  const at = (i: number) => {
    const a = (2 * Math.PI * i) / n;
    return `${(32 + R * Math.cos(a)).toFixed(2)} ${(32 + R * Math.sin(a)).toFixed(2)}`;
  };
  const bump = (1.25 * R * Math.sin(Math.PI / n)).toFixed(2);
  let d = `M${at(0)}`;
  for (let i = 1; i <= n; i++) d += `A${bump} ${bump} 0 0 1 ${at(i)}`;
  return `${d}Z`;
})();

/**
 * A badge's medal. Earned: a scalloped seal in the badge's tone with a check. Not yet earned: a
 * grey icon inside a ring that fills with `progress` (0–1). Decorative; the card carries the label.
 */
export function Medal({
  name,
  earned,
  progress = 0,
  size = 64,
}: {
  name: string;
  earned: boolean;
  progress?: number;
  size?: number;
}) {
  const { icon, tone } = badgeLook(name);
  const tick = Math.round(size * 0.34);
  return (
    <View
      aria-hidden
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        {earned ? (
          <>
            <Path d={SEAL} fill={tone.soft} stroke={tone.accent} strokeOpacity={0.25} />
            <Circle cx={32} cy={32} r={20.5} fill={tone.accent} />
            <Circle
              cx={32}
              cy={32}
              r={17}
              fill="none"
              stroke={colors.white}
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
          </>
        ) : (
          <>
            <Circle cx={32} cy={32} r={R} fill="none" stroke={colors.idle} strokeWidth={4} />
            {progress > 0 && (
              <Circle
                cx={32}
                cy={32}
                r={R}
                fill="none"
                stroke={tone.accent}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${RING * Math.min(1, progress)} ${RING}`}
              />
            )}
            <Circle cx={32} cy={32} r={20.5} fill={colors.white} />
          </>
        )}
      </Svg>
      {/* Its own layer: on the web a positioned Svg paints over unpositioned siblings. */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Glyph
          name={icon}
          size={Math.round(size * 0.34)}
          color={earned ? colors.white : colors.tabIdle}
          weight={2}
        />
      </View>
      {earned && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: tick,
            height: tick,
            borderRadius: tick / 2,
            borderWidth: 2,
            borderColor: colors.white,
            backgroundColor: colors.dark,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="check" size={Math.round(tick * 0.6)} color={colors.pale} weight={3} />
        </View>
      )}
    </View>
  );
}
