import { AccessibilityInfo, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  css,
  cubicBezier,
  type CSSKeyframesRule,
  type CSSTransitionProperty,
} from 'react-native-reanimated';

/**
 * The design's CSS keyframes (s4In, s4Slide, …) as Reanimated CSS animations, so timings and
 * easing carry over one-to-one. Every helper returns nothing when the system asks for reduced
 * motion, so content simply appears in its final state.
 */
export const EASE = cubicBezier(0.2, 0.8, 0.2, 1);
export const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);

let reduced = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((value) => {
    reduced = value;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
  reduced = value;
});
export const reducedMotion = () => reduced;

/**
 * A short vibration on phones: a tick as a swipe crosses its commit line, a tap on save, and a
 * success buzz once a signature is confirmed. The web has no haptics, so it does nothing there.
 */
export function haptic(kind: 'tick' | 'tap' | 'success') {
  if (Platform.OS === 'web') return;
  void Promise.resolve(
    kind === 'tick'
      ? Haptics.selectionAsync()
      : kind === 'tap'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  ).catch(() => undefined);
}

const rise = (y: number) => ({
  from: { opacity: 0, transform: [{ translateY: y }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});
export const kf = {
  in: css.keyframes(rise(16)),
  /** Two identical keyframes: alternating between them restarts the animation on each step. */
  tickA: css.keyframes(rise(8)),
  tickB: css.keyframes({ ...rise(8), from: { opacity: 0.001, transform: [{ translateY: 8 }] } }),
  slide: css.keyframes({
    from: { opacity: 0, transform: [{ translateX: 28 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }] },
  }),
  fade: css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
  sheet: css.keyframes({
    from: { transform: [{ translateY: '100%' }] },
    to: { transform: [{ translateY: 0 }] },
  }),
  grow: css.keyframes({ from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } }),
  ken: css.keyframes({
    from: { transform: [{ scale: 1.02 }, { translateX: 0 }, { translateY: 0 }] },
    to: { transform: [{ scale: 1.12 }, { translateX: '-1.5%' }, { translateY: '-1%' }] },
  }),
  ring: css.keyframes({
    '0%': { transform: [{ scale: 0.36 }], opacity: 0.75 },
    '100%': { transform: [{ scale: 1 }], opacity: 0 },
  }),
  /** The live dot's halo, drawn as a ring that swells and fades. */
  dot: css.keyframes({
    '0%': { transform: [{ scale: 1 }], opacity: 0.6 },
    '60%': { transform: [{ scale: 2.75 }], opacity: 0 },
    '100%': { transform: [{ scale: 2.75 }], opacity: 0 },
  }),
  heart: css.keyframes({
    '0%': { transform: [{ scale: 1 }] },
    '35%': { transform: [{ scale: 1.35 }] },
    '70%': { transform: [{ scale: 0.92 }] },
    '100%': { transform: [{ scale: 1 }] },
  }),
  pop: css.keyframes({
    '0%': { opacity: 0, transform: [{ scale: 0.6 }] },
    '60%': { transform: [{ scale: 1.08 }] },
    '100%': { opacity: 1, transform: [{ scale: 1 }] },
  }),
  toast: css.keyframes({
    '0%': { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.96 }] },
    '10%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    '88%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    '100%': { opacity: 0, transform: [{ translateY: 10 }, { scale: 1 }] },
  }),
  float: css.keyframes({
    '0%': { transform: [{ translateY: 0 }] },
    '50%': { transform: [{ translateY: -4 }] },
    '100%': { transform: [{ translateY: 0 }] },
  }),
};

type Options = {
  delay?: number;
  ease?: ReturnType<typeof cubicBezier> | 'ease' | 'ease-in-out' | 'linear';
  loop?: boolean;
  alternate?: boolean;
};
/** `animation: <name> <ms> <ease> <delay> both`, or nothing under reduced motion. */
export function anim(name: CSSKeyframesRule, ms: number, o: Options = {}) {
  if (reduced) return {};
  return {
    animationName: name,
    animationDuration: ms,
    animationDelay: o.delay ?? 0,
    animationTimingFunction: o.ease ?? EASE,
    animationFillMode: 'both' as const,
    animationIterationCount: o.loop ? ('infinite' as const) : 1,
    animationDirection: o.alternate ? ('alternate' as const) : ('normal' as const),
  };
}
/** The design's list stagger: each item rises 55ms after the one before, capped at eight. */
export const stag = (i: number, name: CSSKeyframesRule = kf.in) =>
  anim(name, 500, { delay: Math.min(i, 8) * 55 });
/** `transition: <props> <ms> <ease>`. */
export function transition(
  props: Extract<CSSTransitionProperty, unknown[]>,
  ms: number,
  ease = EASE,
) {
  if (reduced) return {};
  return {
    transitionProperty: props,
    transitionDuration: ms,
    transitionTimingFunction: ease,
  };
}
