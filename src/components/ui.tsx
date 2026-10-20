import React from 'react';
import {
  ColorValue,
  ScrollViewProps,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { isDemo } from '../data/provider';
import { colors, fonts, gradient, gradients, shadows, styles } from './theme';
import { anim, kf } from './motion';
import { CircleButton, PillChip, Press, Screen, Sheet } from './kit';
import { Glyph } from './glyph';
export { colors, fonts, styles } from './theme';

export function Icon({
  name,
  size = 21,
  color = colors.accent,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const buttonTone = {
  primary: { bg: colors.dark, fg: colors.white, height: 54 },
  pale: { bg: colors.pale, fg: colors.dark, height: 48 },
  secondary: { bg: colors.white, fg: colors.ink, height: 52 },
  danger: { bg: colors.white, fg: colors.error, height: 52 },
  ghost: { bg: 'transparent', fg: colors.secondary, height: 46 },
};
/** The design's buttons: dark gradient primary, white outline, pale on dark, bare ghost. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  testID,
  style,
  color,
}: {
  title: string;
  onPress: () => void;
  variant?: keyof typeof buttonTone;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  testID?: string;
  /** Text colour override (ghost buttons on dark grounds). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = buttonTone[variant];
  const primary = variant === 'primary';
  // A disabled primary turns quiet grey, as in the design, rather than a faded dark button.
  const off = primary && disabled;
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      dim={!off}
      onPress={onPress}
      style={[
        {
          minHeight: t.height,
          maxWidth: '100%',
          paddingHorizontal: variant === 'ghost' ? 12 : 22,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: off ? colors.track : t.bg,
        },
        primary && !off ? [gradient(gradients.sign), shadows.button] : null,
        // White buttons get a hairline so they still read as buttons on white cards.
        t.bg === colors.white ? { borderWidth: 1, borderColor: colors.handle } : null,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={off ? colors.muted : (color ?? t.fg)} />}
      <Text
        style={{
          flexShrink: 1,
          textAlign: 'center',
          fontSize: primary ? 16 : 15,
          fontFamily: primary ? fonts.bold : fonts.semibold,
          color: off ? colors.muted : (color ?? t.fg),
        }}
      >
        {title}
      </Text>
    </Press>
  );
}

/** A selectable pill, or a small static tag when it has no action. */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  if (onPress) return <PillChip label={label} selected={selected} onPress={onPress} height={40} />;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.white,
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8C9086"
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 88, textAlignVertical: 'top', lineHeight: 22 },
          error ? { borderWidth: 1, borderColor: colors.error } : null,
          props.style,
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

/**
 * A generic screen in the design's language: round back button, eyebrow, serif title, then a
 * column of cards. Screens that have their own layout in the design use `Screen` directly.
 */
export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  back,
  action,
  bottomBar,
  onScroll,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  back?: boolean;
  action?: React.ReactNode;
  bottomBar?: React.ReactNode;
  onScroll?: ScrollViewProps['onScroll'];
}) {
  return (
    <Screen tabs={!back} enter={back ? 'slide' : 'fade'} onScroll={onScroll} footer={bottomBar}>
      <View style={{ gap: 14 }}>
        {back && (
          <CircleButton
            label="Back"
            light={false}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          >
            <Glyph name="back" size={19} weight={2} />
          </CircleButton>
        )}
        {(title || eyebrow) && (
          <View style={{ gap: 8 }}>
            {!!eyebrow && <Text style={styles.label}>{eyebrow}</Text>}
            {!!title && (
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            )}
            {!!subtitle && <Text style={[styles.muted, { fontSize: 13 }]}>{subtitle}</Text>}
            {action}
          </View>
        )}
        {children}
        <Text style={[styles.micro, { textAlign: 'center', paddingTop: 8 }]}>
          {isDemo
            ? 'Fictional sample data. Nothing here establishes legal validity.'
            : 'Your voice. Your community. Your choice.'}
        </Text>
      </View>
    </Screen>
  );
}

export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <View
      accessibilityRole={error ? 'alert' : 'text'}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: error ? colors.errorSoft : colors.soft,
        borderRadius: 20,
      }}
    >
      <Text style={error ? styles.error : [styles.muted, { color: colors.secondary }]}>{text}</Text>
    </View>
  );
}

function Skeleton({
  width = '100%',
  height,
  radius = 12,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.knob },
        anim(kf.fade, 850, { loop: true, alternate: true, ease: 'ease-in-out' }),
      ]}
    />
  );
}
export function Loading({ variant = 'feed' }: { variant?: 'feed' | 'detail' | 'form' }) {
  return (
    <Screen tabs={variant !== 'detail'}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Loading Swipe4Change"
        style={{ gap: 16 }}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={46} height={46} radius={23} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={22} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
        <Skeleton height={variant === 'form' ? 120 : 318} radius={30} />
        <Skeleton width="45%" height={22} />
        {[0, 1].map((n) => (
          <View
            key={n}
            style={{
              flexDirection: 'row',
              gap: 12,
              backgroundColor: colors.white,
              borderRadius: 24,
              padding: 10,
            }}
          >
            <Skeleton width={96} height={112} radius={18} />
            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="90%" height={18} />
              <Skeleton width="70%" height={18} />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: 24,
          paddingVertical: 32,
          paddingHorizontal: 22,
          alignItems: 'center',
          gap: 8,
        },
        anim(kf.pop, 400, { ease: 'ease' }),
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: 20,
          lineHeight: 26,
          color: colors.ink,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{body}</Text>
    </Animated.View>
  );
}

/** Confirmation before anything consequential, as a bottom sheet. */
export function Confirm({
  visible,
  title,
  body,
  onConfirm,
  onCancel,
  pending = false,
  children,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  contentKey,
}: {
  visible: boolean;
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  children?: React.ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  contentKey?: string | number;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} locked={pending}>
      <View key={contentKey} style={{ gap: 14 }}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 }]}
        >
          {title}
        </Text>
        <Text style={styles.muted}>{body}</Text>
        {children}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Button
            title="Cancel"
            variant="secondary"
            disabled={pending}
            onPress={onCancel}
            style={{ flex: 1 }}
          />
          <Button
            title={pending ? 'Saving…' : confirmLabel}
            disabled={pending || confirmDisabled}
            onPress={onConfirm}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
