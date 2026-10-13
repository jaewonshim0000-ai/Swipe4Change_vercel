import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Image,
  ImageProps,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  css,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import type { PetitionPhoto, Topic } from '../domain/model';
import { useResponsiveLayout, webLayout } from './responsive';
import { colors, fonts, frost, gradient, topicColors } from './theme';
import { EASE_IN_OUT, anim, kf, reducedMotion, transition } from './motion';

const images: Record<Topic, ImageProps['source']> = {
  'Safer streets': require('../../assets/theme/safer-streets.jpg'),
  Environment: require('../../assets/theme/environment.jpg'),
  Education: require('../../assets/theme/education.jpg'),
  'Public spaces': require('../../assets/theme/public-spaces.jpg'),
  Accessibility: require('../../assets/theme/accessibility.jpg'),
};
export const topicImage = (topic: Topic) => images[topic];
/** The organizer's photo when there is one, otherwise the topic's stock image. */
export const petitionImage = (p: { topic: Topic; photo?: PetitionPhoto }): ImageProps['source'] =>
  p.photo ? { uri: p.photo.url } : images[p.topic];
export const gatheringImage: ImageProps['source'] = require('../../assets/theme/civic-gathering.jpg');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** A pressable that shrinks slightly while held (`style-active="transform:scale(.97)"`). */
export function Press({
  scale = 0.97,
  style,
  children,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  scale?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [down, setDown] = useState(false);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...props}
      onPressIn={(e) => {
        setDown(true);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setDown(false);
        props.onPressOut?.(e);
      }}
      style={[
        style,
        { transform: [{ scale: down ? scale : 1 }] },
        transition(['transform', 'backgroundColor', 'borderColor', 'opacity'], 200),
        props.disabled ? { opacity: 0.4 } : null,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Full-bleed gradient overlay for imagery. */
export function Scrim({ stops }: { stops: string }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, gradient(`linear-gradient(180deg, ${stops})`)]}
    />
  );
}

/** Slow Ken Burns drift on hero imagery. */
export function KenBurns({
  source,
  label,
  ms = 16000,
}: {
  source: ImageProps['source'];
  label?: string;
  ms?: number;
}) {
  return (
    <Animated.Image
      source={source}
      resizeMode="cover"
      accessibilityLabel={label}
      style={[
        StyleSheet.absoluteFill,
        { width: '100%', height: '100%' },
        anim(kf.ken, ms, { ease: EASE_IN_OUT, loop: true, alternate: true }),
      ]}
    />
  );
}

export function Cover({
  source,
  style,
}: {
  source: ImageProps['source'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.dark }, style]}>
      <Image source={source} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

/** Topic pill: `solid` on imagery, `soft` inside white cards. */
export function TopicPill({ topic, soft = false }: { topic: Topic; soft?: boolean }) {
  const t = topicColors[topic];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.soft,
        borderRadius: 999,
        paddingHorizontal: soft ? 10 : 11,
        paddingVertical: soft ? 4 : 5,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.semibold,
          fontSize: soft ? 10 : 10.5,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: t.accent,
        }}
      >
        {topic}
      </Text>
    </View>
  );
}

/** Frosted label over imagery ("Local spotlight", "12 days left"). */
export function GlassPill({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={[{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }, frost()]}>
      <Text style={[{ fontFamily: fonts.medium, fontSize: 12, color: colors.white }, style]}>
        {text}
      </Text>
    </View>
  );
}

/** Progress bar that grows in from the left and eases to new values. */
export function Bar({
  pct,
  tone = 'sage',
  height = 6,
  track,
  label,
}: {
  pct: number;
  tone?: 'sage' | 'light' | 'big' | 'muted';
  height?: number;
  track?: string;
  label?: string;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(width) }}
      style={{
        height,
        borderRadius: height,
        overflow: 'hidden',
        backgroundColor: track ?? (tone === 'light' ? 'rgba(255,255,255,0.25)' : colors.track),
      }}
    >
      <Animated.View
        style={[
          {
            width: `${width}%`,
            height: '100%',
            borderRadius: 8,
            transformOrigin: 'left',
            backgroundColor:
              tone === 'light' ? colors.pale : tone === 'muted' ? colors.stone : colors.sage,
          },
          tone === 'big'
            ? gradient(`linear-gradient(90deg, ${colors.sage}, ${colors.accent})`)
            : null,
          anim(kf.grow, 1100),
          transition(['width'], 600),
        ]}
      />
    </View>
  );
}

/** ♥ / ♡, with a little pulse the moment something is saved. */
export function Heart({
  on,
  dark = false,
  size = 18,
}: {
  on: boolean;
  dark?: boolean;
  size?: number;
}) {
  const mounted = useRef(false);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(on && mounted.current);
    mounted.current = true;
  }, [on]);
  return (
    <Animated.Text
      style={[
        {
          fontSize: size,
          lineHeight: size + 2,
          color: on ? (dark ? colors.heart : colors.heartLight) : dark ? colors.dark : colors.white,
        },
        pulse ? anim(kf.heart, 450, { ease: 'ease' }) : null,
      ]}
    >
      {on ? '♥' : '♡'}
    </Animated.Text>
  );
}

/** Round icon button on imagery or canvas (back, share, save). */
export function CircleButton({
  label,
  onPress,
  children,
  size = 44,
  light = true,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
  light?: boolean;
}) {
  return (
    <Press
      accessibilityLabel={label}
      onPress={onPress}
      scale={0.94}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: light ? 'rgba(255,255,255,0.92)' : colors.white,
        },
        light ? { boxShadow: '0px 6px 16px -8px rgba(0,0,0,0.4)' } : null,
      ]}
    >
      {children}
    </Press>
  );
}

export function Initials({
  text,
  size = 36,
  bg = colors.pale,
  fg = colors.accent,
  ring,
  style,
}: {
  text: string;
  size?: number;
  bg?: string;
  fg?: string;
  ring?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ring ? { borderWidth: 2, borderColor: ring } : null,
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: Math.round(size / 3.1), color: fg }}>
        {text}
      </Text>
    </View>
  );
}
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** A ring that swells outward and fades, on repeat (the design's s4Ring). */
export function Ring({
  color = colors.sage,
  ms = 2600,
  delay = 0,
  width = 2,
  inset = 0,
}: {
  color?: string;
  ms?: number;
  delay?: number;
  width?: number;
  inset?: number;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: 999,
          borderWidth: width,
          borderColor: color,
        },
        anim(kf.ring, ms, { delay, loop: true, ease: 'ease' }),
      ]}
    />
  );
}

/** A small status dot with a breathing halo. */
export function LiveDot({ color = colors.sage, size = 8 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size, backgroundColor: color },
          anim(kf.dot, 1800, { loop: true, ease: 'ease' }),
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }]} />
    </View>
  );
}

/** The design's pill chip: dark when selected, white otherwise; `outline` for quick filters. */
export function PillChip({
  label,
  selected,
  onPress,
  height = 40,
  outline = false,
  capitalize = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  height?: number;
  outline?: boolean;
  capitalize?: boolean;
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        {
          minHeight: Math.max(height, 32),
          paddingHorizontal: height <= 32 ? 12 : 16,
          borderRadius: 999,
          justifyContent: 'center',
          flexShrink: 0,
        },
        outline
          ? {
              backgroundColor: selected ? colors.pale : 'transparent',
              borderWidth: 1,
              borderColor: selected ? colors.sage : colors.handle,
            }
          : {
              backgroundColor: selected ? colors.dark : colors.white,
              // The hairline keeps an unselected chip visible on white cards as well as the canvas.
              borderWidth: 1,
              borderColor: selected ? colors.dark : colors.line,
              boxShadow: selected
                ? '0px 8px 18px -10px rgba(18,20,15,0.6)'
                : '0px 4px 12px -10px rgba(32,38,26,0.4)',
            },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.semibold,
          fontSize: height <= 32 ? 11.5 : 12.5,
          color: selected && !outline ? colors.white : colors.secondary,
          textTransform: capitalize ? 'capitalize' : 'none',
        }}
      >
        {label}
      </Text>
    </Press>
  );
}

/** Horizontal chip / card rail that bleeds to the screen edges. */
export function Rail({
  children,
  gap = 8,
  gutter = 18,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  gutter?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ScrollView>(null);
  useMouseDrag(ref);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -gutter, flexGrow: 0 }, style]}
      contentContainerStyle={{ gap, paddingHorizontal: gutter }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Touch screens and trackpads already slide a horizontal rail, but on the web a mouse cannot: the
 * wheel scrolls the page and dragging does nothing. This lets a mouse drag the rail, and stops a
 * drag from also opening the card it ends on.
 */
function useMouseDrag(ref: React.RefObject<ScrollView | null>) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (
      ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null
    )?.getScrollableNode?.();
    if (!node) return;
    node.style.cursor = 'grab';
    let start: { x: number; left: number } | null = null;
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      start = { x: e.clientX, left: node.scrollLeft };
      dragged = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > 6) dragged = true;
      if (dragged) node.scrollLeft = start.left - dx;
    };
    const up = () => {
      start = null;
    };
    const click = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };
    // Images are natively draggable in browsers, which would hijack the drag.
    const nativeDrag = (e: DragEvent) => e.preventDefault();
    node.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    node.addEventListener('click', click, true);
    node.addEventListener('dragstart', nativeDrag);
    return () => {
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      node.removeEventListener('click', click, true);
      node.removeEventListener('dragstart', nativeDrag);
    };
  }, [ref]);
}

/** Segmented control with a sliding dark knob. */
export function Segmented({
  options,
  value,
  onChange,
  itemWidth,
}: {
  options: string[];
  value: number;
  onChange: (index: number) => void;
  /** Fixed-width items (Home's Swipe/Cards). Omit to share the full width equally. */
  itemWidth?: number;
}) {
  const pad = itemWidth ? 3 : 4;
  const [measured, setMeasured] = useState(0);
  const w = itemWidth ?? (measured - pad * 2) / options.length;
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.knob,
        borderRadius: 999,
        padding: pad,
        alignSelf: itemWidth ? 'flex-end' : 'stretch',
      }}
    >
      {w > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: pad,
              bottom: pad,
              left: pad,
              width: w,
              borderRadius: 999,
              backgroundColor: colors.dark,
              transform: [{ translateX: value * w }],
            },
            transition(['transform'], itemWidth ? 350 : 380),
          ]}
        />
      )}
      {options.map((o, i) => (
        <Pressable
          key={o}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === i }}
          accessibilityLabel={o}
          onPress={() => onChange(i)}
          style={{
            width: itemWidth,
            flex: itemWidth ? undefined : 1,
            height: itemWidth ? 34 : 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.Text
            style={[
              {
                fontFamily: fonts.semibold,
                fontSize: itemWidth ? 12 : 13,
                color: value === i ? colors.white : colors.muted,
              },
              transition(['all'], 300),
            ]}
          >
            {o}
          </Animated.Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Thin segmented progress bars for multi-step flows. */
export function StepBars({ count, current }: { count: number; current: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: current + 1 }}
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            backgroundColor: colors.idle,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              { height: '100%', width: i <= current ? '100%' : '0%', backgroundColor: colors.dark },
              transition(['width'], 500),
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/** Radio indicator: a dark ring filled with a white inset when on. */
export function Radio({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        marginTop: 1,
        borderWidth: 2,
        borderColor: on ? colors.dark : colors.radio,
        backgroundColor: on ? colors.dark : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && (
        <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: colors.white }} />
      )}
    </View>
  );
}

/** Bottom sheet over a dimmed scrim, sliding up from the bottom edge. */
export function Sheet({
  visible,
  onClose,
  children,
  locked = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** While a write is pending the sheet cannot be dismissed. */
  locked?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { wide } = useResponsiveLayout();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!locked) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(18,20,15,0.45)' },
            anim(kf.fade, 300, { ease: 'ease' }),
          ]}
        >
          <Pressable
            accessibilityLabel="Close"
            style={{ flex: 1 }}
            onPress={() => {
              if (!locked) onClose();
            }}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: wide ? 560 : 480,
              borderRadius: wide ? 30 : undefined,
              maxHeight: '88%',
              backgroundColor: colors.sheet,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingTop: 10,
            },
            anim(kf.sheet, 450),
          ]}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.handle,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 + insets.bottom }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Scrolling screen body with the design's top inset, bottom clearance and entrance. */
export function Screen({
  children,
  tabs = true,
  gutter = 18,
  enter = 'fade',
  top = true,
  onScroll,
  footer,
  wide = false,
  fill = false,
}: {
  children: React.ReactNode;
  /** Wider canvas for discovery grids on desktop browsers. */
  wide?: boolean;
  /** Stretch content to the screen's height, so a `flex: 1` child can center itself. */
  fill?: boolean;
  /** Leaves room for the floating tab bar (or a floating action bar). */
  tabs?: boolean;
  gutter?: number;
  enter?: 'fade' | 'slide';
  /** False for screens whose hero image runs under the status bar. */
  top?: boolean;
  onScroll?: ScrollViewProps['onScroll'];
  /** Floating content over the scroll view, such as the petition sign bar. */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { wide: desktop } = useResponsiveLayout();
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          width: '100%',
          alignSelf: 'center',
          maxWidth:
            Platform.OS === 'web'
              ? wide
                ? webLayout.browseWidth
                : webLayout.readingWidth
              : undefined,
          backgroundColor: colors.canvas,
        },
        enter === 'slide' ? anim(kf.slide, 420) : anim(kf.fade, 350, { ease: 'ease' }),
      ]}
    >
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: fill ? 1 : undefined,
          paddingTop: top ? (insets.top > 0 ? insets.top + 6 : 28) : 0,
          paddingBottom: (tabs ? 120 : 60) + insets.bottom,
          paddingHorizontal: desktop && gutter > 0 ? 32 : gutter,
        }}
      >
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}

/* ---------- Toast: one transient message at a time, shown above the tab bar. ---------- */
let current: { id: number; text: string } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function toast(text: string) {
  current = { id: Date.now(), text };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2600);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const barRoutes = ['/', '/explore', '/create', '/communities', '/profile'];
export function ToastHost() {
  const t = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (!t) return null;
  const aboveBar = barRoutes.includes(path) || path.startsWith('/petition/');
  return (
    <Animated.View
      key={t.id}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          width: '90%',
          maxWidth: 520,
          bottom: (aboveBar ? 108 : 34) + insets.bottom,
          zIndex: 90,
          backgroundColor: colors.dark,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 13,
          boxShadow: '0px 16px 32px -12px rgba(18,20,15,0.55)',
        },
        anim(kf.toast, 2600, { ease: 'ease' }),
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 13,
          lineHeight: 19,
          color: colors.onDarkBright,
        }}
      >
        {t.text}
      </Text>
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** A check mark that draws itself in (the design's s4Draw). */
export function DrawnCheck({
  size = 36,
  color = colors.white,
  delay = 350,
}: {
  size?: number;
  color?: string;
  delay?: number;
}) {
  const offset = useSharedValue(reducedMotion() ? 0 : 40);
  useEffect(() => {
    offset.set(
      withDelay(delay, withTiming(0, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })),
    );
  }, [delay, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <AnimatedPath
        d="m5 13 4.5 4.5L19 7"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={40}
        animatedProps={props}
      />
    </Svg>
  );
}

const confettiColors = [
  colors.sage,
  colors.pale,
  topicColors['Safer streets'].accent,
  topicColors.Education.accent,
  topicColors.Accessibility.accent,
  topicColors.Environment.accent,
  colors.orange,
];
const pieces = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = 62 + (i % 3) * 18;
  return {
    w: i % 2 ? 7 : 10,
    color: confettiColors[i % 7],
    keyframes: css.keyframes({
      from: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.3 }],
      },
      to: {
        opacity: 0,
        transform: [
          { translateX: Math.round(Math.cos(a) * d) },
          { translateY: Math.round(Math.sin(a) * d) },
          { rotate: `${(i * 47) % 360}deg` },
          { scale: 1 },
        ],
      },
    }),
  };
});
/** Sixteen paper scraps bursting outward from the centre (the design's s4Burst). */
export function Confetti() {
  if (reducedMotion()) return null;
  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: p.w,
              height: p.w * 0.6,
              marginLeft: -p.w / 2,
              borderRadius: 4,
              backgroundColor: p.color,
            },
            anim(p.keyframes, 1000, { delay: 250 }),
          ]}
        />
      ))}
    </>
  );
}

/** The design's toggle: a dark track when on, with a sliding white thumb. */
export function Switch({ on }: { on: boolean }) {
  return (
    <Animated.View
      style={[
        {
          width: 50,
          height: 30,
          borderRadius: 999,
          padding: 3,
          backgroundColor: on ? colors.dark : colors.idle,
        },
        transition(['backgroundColor'], 250),
      ]}
    >
      <Animated.View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: colors.white,
            boxShadow: '0px 1px 4px rgba(0,0,0,0.25)',
            transform: [{ translateX: on ? 20 : 0 }],
          },
          transition(['transform'], 300),
        ]}
      />
    </Animated.View>
  );
}
