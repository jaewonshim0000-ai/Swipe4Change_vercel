import { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Petition } from '../domain/model';
import { daysLeft } from '../domain/discovery';
import { Bar, Confetti, Initials, Press, petitionImage } from './kit';
import { Glyph } from './glyph';
import { RippleRings } from './ripple';
import { Medal, badgeLook } from './badge-medal';
import { anim, kf } from './motion';
import { colors, fonts, gradient, gradients, heartTones } from './theme';

/** A wide heart (w × h) whose top dip is centred on cx, as drawn in the design. */
function heartPath(cx: number, top: number, w: number, h: number) {
  const X = (x: number) => (cx + (x - 100) * (w / 200)).toFixed(1);
  const Y = (y: number) => (top + y * (h / 178)).toFixed(1);
  return `M${X(100)} ${Y(178)} C${X(42)} ${Y(140)} ${X(0)} ${Y(104)} ${X(0)} ${Y(62)} C${X(0)} ${Y(26)} ${X(28)} ${Y(0)} ${X(60)} ${Y(0)} C${X(78)} ${Y(0)} ${X(92)} ${Y(10)} ${X(100)} ${Y(26)} C${X(108)} ${Y(10)} ${X(122)} ${Y(0)} ${X(140)} ${Y(0)} C${X(172)} ${Y(0)} ${X(200)} ${Y(26)} ${X(200)} ${Y(62)} C${X(200)} ${Y(104)} ${X(158)} ${Y(140)} ${X(100)} ${Y(178)}Z`;
}
const hearts = [
  { d: heartPath(300, 8, 640, 330), stops: heartTones[0] },
  { d: heartPath(300, 58, 460, 262), stops: heartTones[1] },
  { d: heartPath(300, 104, 300, 196), stops: heartTones[2] },
] as const;

const lowerFirst = (s: string) => {
  const t = s.replace(/\.$/, '');
  return `${/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t}.`;
};

/**
 * The full-screen "It's signed!" moment, shown only after the server confirms the signature:
 * nested hearts, your initials beside the petition's photo, the new count, then the ripple
 * invitation, any badges the signature earned, and the private-receipt note.
 */
export function Celebrate({
  petition: p,
  name,
  shownAs,
  badges,
  onClose,
  onShare,
}: {
  petition: Petition;
  name: string;
  /** The public name the signature appears under. */
  shownAs: string;
  /** Badges this signature earned, as the server recorded them. */
  badges: string[];
  onClose: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [now] = useState(Date.now);
  // Capped so the pale hearts stay behind the photos: on a wide screen they would cover the copy.
  const art = Math.min(Math.max(width * 1.5, 560), 660);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View
        accessibilityViewIsModal
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.dark, overflow: 'hidden' },
          gradient(gradients.celebrate),
          anim(kf.fade, 450, { ease: 'ease' }),
        ]}
      >
        <Svg
          pointerEvents="none"
          width={art}
          height={(art * 340) / 600}
          viewBox="0 0 600 340"
          style={{ position: 'absolute', top: insets.top - 30, left: (width - art) / 2 }}
          aria-hidden
        >
          <Defs>
            {hearts.map((h, i) => (
              <LinearGradient key={i} id={`heart-${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={h.stops[0]} />
                <Stop offset="1" stopColor={h.stops[1]} stopOpacity={h.stops[2]} />
              </LinearGradient>
            ))}
          </Defs>
          {hearts.map((h, i) => (
            <G key={i}>
              <Path
                d={h.d}
                fill={`url(#heart-${i})`}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={6}
              />
            </G>
          ))}
          <Path d="M420 40l7 22 22 7-22 7-7 22-7-22-22-7 22-7z" fill={colors.white} />
          <Path
            d="M384 104l5 16 16 5-16 5-5 16-5-16-16-5 16-5z"
            fill={colors.white}
            opacity={0.9}
          />
        </Svg>
        <View style={{ position: 'absolute', top: '30%', left: 0, right: 0 }}>
          <Confetti />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            paddingTop: insets.top + 72,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <Animated.View
            style={[{ flexDirection: 'row', marginTop: 24 }, anim(kf.in, 600, { delay: 150 })]}
          >
            <Initials
              text={
                name
                  ? name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                  : '✓'
              }
              size={128}
              ring={colors.pale}
              style={{ borderWidth: 5 }}
            />
            <View
              style={{
                width: 128,
                height: 128,
                marginLeft: -20,
                borderRadius: 999,
                borderWidth: 5,
                borderColor: colors.pale,
                overflow: 'hidden',
                backgroundColor: colors.pale,
              }}
            >
              <Image
                source={petitionImage(p)}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          </Animated.View>
          <Animated.View
            accessible
            accessibilityRole="header"
            accessibilityLabel="It’s signed!"
            // Below the photos, never over them: white on the pale circle and hearts is unreadable.
            style={[{ marginTop: 16 }, anim(kf.pop, 550, { delay: 300, ease: 'ease' })]}
          >
            <Text style={[titleStyle, { fontSize: 30, lineHeight: 34, marginLeft: 6 }]}>IT’S</Text>
            <Text style={[titleStyle, { fontSize: 64, lineHeight: 70, letterSpacing: -1 }]}>
              Signed!
            </Text>
          </Animated.View>
          <Animated.Text
            style={[
              {
                marginTop: 20,
                textAlign: 'center',
                fontFamily: fonts.bold,
                fontSize: 17,
                lineHeight: 25,
                color: colors.white,
              },
              anim(kf.in, 500, { delay: 450 }),
            ]}
          >
            You added your voice.
          </Animated.Text>
          <Animated.Text
            style={[
              {
                marginTop: 6,
                textAlign: 'center',
                fontFamily: fonts.medium,
                fontSize: 15,
                lineHeight: 22,
                color: colors.white,
              },
              anim(kf.in, 500, { delay: 480 }),
            ]}
          >
            Supporter #{p.count.toLocaleString()}, as {shownAs}, asking {p.recipient} to{' '}
            {lowerFirst(p.action)}
          </Animated.Text>
          <Animated.View
            style={[{ width: '100%', marginTop: 16 }, anim(kf.in, 500, { delay: 500 })]}
          >
            <Bar
              pct={(100 * p.count) / p.goal}
              tone="light"
              height={6}
              track="rgba(255,255,255,0.2)"
              label="Signature goal progress"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={meterText}>
                {p.count.toLocaleString()} of {p.goal.toLocaleString()} signatures
              </Text>
              <Text style={meterText}>{daysLeft(p, now)} days left</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={[
              glass,
              { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 28 },
              anim(kf.in, 500, { delay: 550 }),
            ]}
          >
            <RippleRings moving size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.white }}>
                Now start a ripple
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: fonts.body,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.onImage,
                }}
              >
                Everyone who signs through your link joins your ripple. Counts only, never names.
              </Text>
            </View>
          </Animated.View>
          {badges.map((b, i) => (
            <Animated.View
              key={b}
              style={[
                glass,
                { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
                anim(kf.in, 500, { delay: 600 + i * 80 }),
              ]}
            >
              <Animated.View style={anim(kf.float, 2400, { loop: true, ease: 'ease-in-out' })}>
                <Medal name={b} earned size={40} />
              </Animated.View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.white }}>
                Badge earned ·{' '}
                <Text style={{ fontFamily: fonts.bold, color: badgeLook(b).tone.soft }}>{b}</Text>
              </Text>
            </Animated.View>
          ))}
          <View style={{ marginTop: 'auto', paddingTop: 24, width: '100%', gap: 8 }}>
            <Press
              accessibilityLabel="Share my link"
              onPress={onShare}
              style={{
                minHeight: 56,
                borderRadius: 18,
                backgroundColor: colors.pale,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Glyph name="share" size={20} weight={2} color={colors.dark} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dark }}>
                Share my link
              </Text>
            </Press>
            <Press
              accessibilityLabel="Done"
              onPress={onClose}
              style={{
                minHeight: 48,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>
                Done
              </Text>
            </Press>
            <Text
              style={{
                textAlign: 'center',
                fontFamily: fonts.body,
                fontSize: 12,
                color: colors.onImage,
              }}
            >
              Private receipt saved to your profile. Withdraw any time.
            </Text>
          </View>
        </ScrollView>
        <Press
          accessibilityLabel="Close"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 12,
            width: 48,
            height: 48,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={30} weight={2.6} color={colors.white} />
        </Press>
      </Animated.View>
    </Modal>
  );
}

/** The design's sticker title: white italic on a hard dark drop shadow. */
const titleStyle = {
  fontFamily: fonts.sticker,
  color: colors.white,
  textShadowColor: 'rgba(10,10,10,1)',
  textShadowOffset: { width: 4, height: 5 },
  textShadowRadius: 0,
};
const meterText = { fontFamily: fonts.semibold, fontSize: 13, color: colors.white };
const glass = {
  width: '100%' as const,
  padding: 16,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.08)',
};
