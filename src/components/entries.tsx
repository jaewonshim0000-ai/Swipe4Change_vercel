import { Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { Command, Entry, Petition, Profile } from '../domain/model';
import { canManage } from '../domain/rules';
import { Initials, Press, initialsOf } from './kit';
import { Glyph } from './glyph';
import { stag } from './motion';
import { colors, fonts, styles } from './theme';

/** The design's post row: initials, author, kind badge, body, date. */
export function Post({
  entry: e,
  index = 0,
  onRemove,
  avatar,
}: {
  entry: Entry;
  index?: number;
  onRemove?: () => void;
  /** Overrides the author's initials (event day, update arrow). */
  avatar?: string;
}) {
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: 11, paddingTop: 4 }, stag(index)]}>
      <Initials text={avatar ?? initialsOf(e.author)} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
            {e.author}
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: colors.accent,
              backgroundColor: colors.soft,
              paddingVertical: 3,
              paddingHorizontal: 7,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            {e.kind}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: e.removed ? fonts.italic : fonts.body,
            fontSize: 13,
            lineHeight: 21,
            color: e.removed ? colors.muted : colors.secondary,
          }}
        >
          {e.body}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.outline }}>
            {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
          {!e.removed && onRemove && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this post"
              hitSlop={10}
              onPress={onRemove}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.error }}>
                Remove
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export function Entries({
  entries,
  empty = 'No posts yet.',
  onRemove,
  canRemove,
}: {
  entries: Entry[];
  empty?: string;
  /** Supplied where a viewer may retract a post. Removal leaves a visible tombstone, never a gap. */
  onRemove?: (entry: Entry) => void;
  canRemove?: (entry: Entry) => boolean;
  pending?: boolean;
}) {
  return entries.length ? (
    <View style={{ gap: 14 }}>
      {entries.map((e, i) => (
        <Post
          key={e.id}
          entry={e}
          index={i}
          onRemove={onRemove && canRemove?.(e) ? () => onRemove(e) : undefined}
        />
      ))}
    </View>
  ) : (
    <Text style={styles.muted}>{empty}</Text>
  );
}
/**
 * Who may retract a post. The author may remove their own; a petition's managers may remove
 * anything published on their petition. Organizer updates and recorded responses speak for the
 * petition, so only managers may retract those.
 */
export function entryRemover(
  scope: Extract<Command, { type: 'removeEntry' }>['scope'],
  profile: Profile | null,
  petition?: Petition,
) {
  return (entry: Entry) =>
    !!profile &&
    ((scope === 'discussion' && entry.authorId === profile.id) ||
      (!!petition && canManage(petition, profile)));
}
export function ManagerControl({
  petition,
  profile,
}: {
  petition: Petition;
  profile: Profile | null;
}) {
  return canManage(petition, profile) ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Manage petition"
      onPress={() => router.push(`/manager/${petition.id}`)}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.dark,
        borderRadius: 999,
        paddingHorizontal: 14,
        minHeight: 36,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>
        Manage petition
      </Text>
    </Pressable>
  ) : null;
}

/** Text box with the round send button that darkens once there is something to post. */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  pending,
  bare = false,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
  pending: boolean;
  /** Sits inside its own white card, so the box itself stays transparent. */
  bare?: boolean;
}) {
  const ready = value.trim().length >= 5 && !pending;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <TextInput
        accessibilityLabel="Your contribution"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8C9086"
        multiline
        style={{
          flex: 1,
          borderRadius: 20,
          paddingVertical: 12,
          paddingHorizontal: 14,
          minHeight: 48,
          maxHeight: 140,
          fontFamily: fonts.body,
          fontSize: 15,
          lineHeight: 20,
          color: colors.ink,
          backgroundColor: bare ? 'transparent' : colors.field,
        }}
      />
      <Press
        accessibilityLabel="Post"
        accessibilityState={{ disabled: !ready }}
        onPress={() => ready && onSubmit()}
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? colors.dark : colors.idle,
        }}
      >
        <Glyph name="up" size={17} weight={2} color={colors.white} />
      </Press>
    </View>
  );
}
