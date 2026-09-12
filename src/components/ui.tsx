import React from 'react';
import {
  ActivityIndicator,
  ColorValue,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { isDemo } from '../data/provider';
import { colors, fonts, styles, tokens } from './theme';
export { colors, fonts, styles, tokens } from './theme';
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
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        maxWidth: '100%',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: tokens.radius,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor:
          variant === 'primary'
            ? colors.sage
            : variant === 'danger'
              ? colors.error
              : variant === 'secondary'
                ? colors.white
                : 'transparent',
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.line,
      })}
    >
      {icon && (
        <Icon name={icon} size={18} color={variant === 'danger' ? colors.white : colors.ink} />
      )}
      <Text
        style={{
          flexShrink: 1,
          textAlign: 'center',
          fontSize: 14,
          fontFamily: fonts.semibold,
          color: variant === 'danger' ? colors.white : colors.ink,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{
        maxWidth: '100%',
        minHeight: onPress ? 44 : 28,
        paddingVertical: onPress ? 12 : 5,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.line,
        backgroundColor: selected ? colors.pale : colors.white,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: selected ? colors.ink : colors.muted,
          fontSize: 13,
          fontFamily: fonts.semibold,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.body, { fontFamily: fonts.semibold }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 110, textAlignVertical: 'top' },
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
export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  back,
  action,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <View
            style={[
              styles.between,
              {
                width: '100%',
                maxWidth: 1280,
                alignSelf: 'center',
                paddingHorizontal: width < 600 ? 16 : 32,
                paddingVertical: 16,
              },
            ]}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Swipe4Change home"
              onPress={() => router.push('/(tabs)')}
              style={[styles.row, { flexShrink: 1, flexWrap: 'nowrap', minHeight: 44, gap: 8 }]}
            >
              <View
                style={{ backgroundColor: colors.pale, borderRadius: tokens.radius, padding: 9 }}
              >
                <Icon name="leaf-outline" color={colors.accent} size={24} />
              </View>
              <Text
                style={{
                  fontSize: width < 600 ? 21 : 24,
                  fontFamily: fonts.display,
                  letterSpacing: -1,
                  color: colors.ink,
                  flexShrink: 1,
                }}
              >
                Swipe4Change<Text style={{ color: colors.accent }}>↗</Text>
              </Text>
            </Pressable>
            {width >= 1000 && (
              <View style={[styles.row, { gap: 24 }]}>
                {(
                  [
                    ['Browse petitions', '/(tabs)', '/'],
                    ['Explore', '/(tabs)/explore', '/explore'],
                    ['Communities', '/(tabs)/communities', '/communities'],
                  ] as const
                ).map(([label, href, path]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="link"
                    accessibilityState={{ selected: pathname === path }}
                    onPress={() => router.push(href)}
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      borderBottomWidth: pathname === path ? 2 : 0,
                      borderBottomColor: colors.sage,
                    }}
                  >
                    <Text
                      style={[
                        styles.muted,
                        {
                          fontFamily: fonts.semibold,
                          color: pathname === path ? colors.accent : colors.secondary,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={[styles.row, { gap: width < 600 ? 4 : 12 }]}>
              {width >= 760 && (
                <Button title="Start a petition" onPress={() => router.push('/(tabs)/create')} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={() => router.push('/notifications')}
                style={{ padding: 12 }}
              >
                <Icon name="notifications-outline" color={colors.secondary} />
              </Pressable>
              {width >= 600 && (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Your profile"
                  onPress={() => router.push('/(tabs)/profile')}
                  style={{ padding: 12, backgroundColor: colors.canvas, borderRadius: 12 }}
                >
                  <Icon name="person-outline" color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
        <View
          style={{
            width: '100%',
            maxWidth: 1280,
            alignSelf: 'center',
            padding: width < 600 ? 16 : 32,
            gap: 24,
          }}
        >
          {back && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                title="Back"
                icon="arrow-back"
                variant="ghost"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              />
            </View>
          )}
          {title && (
            <View
              style={[
                styles.between,
                { marginTop: 8 },
                width < 600 && { flexDirection: 'column', alignItems: 'stretch' },
              ]}
            >
              <View style={{ gap: 8, flex: 1 }}>
                {eyebrow && <Text style={styles.label}>{eyebrow}</Text>}
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.title,
                    { fontSize: width < 600 ? 28 : 40, lineHeight: width < 600 ? 36 : 48 },
                  ]}
                >
                  {title}
                </Text>
                {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
              </View>
              {action}
            </View>
          )}
          {children}
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 16, fontSize: 12 }]}>
            {isDemo
              ? 'A fictional community. Real possibilities. All accounts, signatures, organizations, and responses are sample data.'
              : 'Your voice. Your community. Your choice.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <View
      accessibilityRole={error ? 'alert' : 'text'}
      style={{ padding: 16, backgroundColor: error ? '#FFF0EF' : colors.pale, borderRadius: 12 }}
    >
      <Text style={error ? styles.error : styles.muted}>{text}</Text>
    </View>
  );
}
export function Loading() {
  return (
    <Page>
      <ActivityIndicator accessibilityLabel="Loading Swipe4Change" color={colors.accent} />
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          accessibilityLabel="Loading petition"
          style={[styles.card, { height: 160, backgroundColor: colors.pale }]}
        />
      ))}
    </Page>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={[styles.card, { alignItems: 'center', padding: 40 }]}>
      <Icon name="leaf-outline" size={32} />
      <Text style={styles.h2}>{title}</Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}
export function Confirm({
  visible,
  title,
  body,
  onConfirm,
  onCancel,
  pending = false,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#121113AA',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          style={[styles.card, { width: '100%', maxWidth: 520, maxHeight: '90%' }]}
        >
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <Text accessibilityRole="header" style={styles.h2}>
              {title}
            </Text>
            <Text style={styles.body}>{body}</Text>
            {children}
            <Button
              title={pending ? 'Saving…' : 'Confirm'}
              disabled={pending}
              onPress={onConfirm}
            />
            <Button title="Cancel" variant="ghost" disabled={pending} onPress={onCancel} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { width } = useWindowDimensions();
  return <View style={[styles.card, { padding: width < 600 ? 16 : 24 }, style]}>{children}</View>;
}
