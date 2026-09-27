import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, styles, tokens } from './theme';

/**
 * Shared pieces of the Swipe4Change mobile design.
 *
 * Each of these appears on three or more screens in the design file, so they live here rather than
 * being restyled per screen; anything appearing once stays in the screen that owns it. They import
 * tokens directly from `./theme` rather than from `./ui` so that `ui` can stay the layout layer
 * without the two files importing each other.
 */
function Glyph({
  name,
  size = 21,
  color = colors.accent,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
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

/** Progress through a multi-step flow. Numbered where the design numbers them, bars where not. */
export function Steps({
  count,
  current,
  numbered = false,
  label,
}: {
  count: number;
  /** Zero-based. */
  current: number;
  numbered?: boolean;
  label?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${current + 1} of ${count}`}
        accessibilityValue={{ min: 1, max: count, now: current + 1 }}
        style={{ flexDirection: 'row', gap: numbered ? 6 : 5, alignItems: 'center' }}
      >
        {Array.from({ length: count }, (_, i) => {
          const done = i <= current;
          return numbered ? (
            <View
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? colors.sage : colors.white,
                borderWidth: 1,
                borderColor: done ? colors.sage : colors.line,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 12,
                  color: done ? colors.ink : colors.outline,
                }}
              >
                {i + 1}
              </Text>
            </View>
          ) : (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: done ? colors.sage : colors.line,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A radio row: the choice with the explanation it needs, rather than a bare label. */
export function OptionRow({
  label,
  note,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={note ? `${label}. ${note}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
        minHeight: 44,
        padding: 14,
        borderRadius: tokens.radius,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.line,
        backgroundColor: selected ? colors.pale : colors.white,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: selected ? colors.accent : '#C5C8BD',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {selected && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink }}>
          {label}
        </Text>
        {!!note && <Text style={styles.small}>{note}</Text>}
      </View>
    </Pressable>
  );
}

/** A consent checkbox with its sentence. Never pre-ticked anywhere it is used. */
export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
        minHeight: 44,
        padding: 14,
        borderRadius: tokens.radius,
        borderWidth: 1,
        borderColor: checked ? colors.accent : colors.line,
        backgroundColor: checked ? colors.pale : colors.white,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: checked ? colors.accent : '#C5C8BD',
          backgroundColor: checked ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Glyph name="checkmark" size={13} color={colors.white} />}
      </View>
      <Text style={[styles.body, { flex: 1, fontSize: 14, lineHeight: 21 }]}>{label}</Text>
    </Pressable>
  );
}

/** Label left, value right, on a quiet ground. Every "here is what you chose" block. */
export function SummaryRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: tokens.radius,
        backgroundColor: colors.canvas,
        padding: 16,
        gap: 10,
      }}
    >
      {rows.map((r) => (
        <View key={r.label} style={[styles.between, { gap: 12 }]}>
          <Text style={[styles.small, { flexShrink: 1 }]}>{r.label}</Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              color: colors.ink,
              textAlign: 'right',
              flexShrink: 1,
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A row of figures: big serif number over a small caption. */
export function Stats({ items }: { items: { value: string | number; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((s) => (
        <View
          key={s.label}
          style={{
            flex: 1,
            minWidth: 110,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: tokens.radius,
            padding: 13,
            gap: 5,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              lineHeight: 24,
              letterSpacing: -0.6,
              color: colors.ink,
            }}
          >
            {s.value}
          </Text>
          <Text style={styles.micro}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Initials on a pale ground. Decorative: the name it stands for is always rendered beside it. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.pale,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: size / 3, color: colors.accent }}>
        {initials}
      </Text>
    </View>
  );
}

/** A settings row: what it is, where it stands, and a chevron to go and change it. */
export function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 54,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink, flexShrink: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {!!value && <Text style={styles.muted}>{value}</Text>}
        <Glyph name="chevron-forward" size={15} color={colors.outline} />
      </View>
    </Pressable>
  );
}

/** The small uppercase tag saying what kind of thing an entry is. */
export function KindBadge({ label }: { label: string }) {
  const tone = /question/i.test(label)
    ? { bg: '#E6EDF7', ink: '#405E82' }
    : /event|volunteer/i.test(label)
      ? { bg: '#F5EBD9', ink: '#755329' }
      : { bg: colors.primarySoft, ink: colors.primary };
  return (
    <View
      style={{
        backgroundColor: tone.bg,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: tone.ink,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** The end of a flow that worked. */
export function Success({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingTop: 20 }}>
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: colors.sage,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name="checkmark" size={32} color={colors.ink} />
      </View>
      <Text accessibilityRole="header" style={[styles.h2, { textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[styles.small, { textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

/** A card row in a list of things you can open: eyebrow, serif name, meta, and an action. */
export function ListCard({
  eyebrow,
  title,
  body,
  meta,
  onPress,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  meta?: string;
  onPress?: () => void;
  action?: React.ReactNode;
}) {
  const head = (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      {!!eyebrow && (
        <Text style={[styles.label, { fontSize: 10, letterSpacing: 1.2 }]}>{eyebrow}</Text>
      )}
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.heading,
          fontSize: 19,
          lineHeight: 24,
          letterSpacing: -0.5,
          color: colors.ink,
        }}
      >
        {title}
      </Text>
    </View>
  );
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: tokens.radius,
        padding: tokens.phone.cardPad,
        gap: 11,
        ...tokens.shadow,
      }}
    >
      <View style={[styles.between, { alignItems: 'flex-start' }]}>
        {onPress ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${title}`}
            onPress={onPress}
            style={{ flex: 1, minWidth: 0 }}
          >
            {head}
          </Pressable>
        ) : (
          head
        )}
        {action}
      </View>
      {!!body && <Text style={styles.small}>{body}</Text>}
      {!!meta && <Text style={styles.micro}>{meta}</Text>}
    </View>
  );
}
