import { Text, View } from 'react-native';
import { Command, Entry, Petition, Profile } from '../domain/model';
import { canManage } from '../domain/rules';
import { Button, Empty, styles } from './ui';
import { KindBadge } from './design-system';
import { router } from 'expo-router';
export function Entries({
  entries,
  empty = 'No posts yet.',
  onRemove,
  canRemove,
  pending = false,
}: {
  entries: Entry[];
  empty?: string;
  /** Supplied where a viewer may retract a post. Removal leaves a visible tombstone, never a gap. */
  onRemove?: (entry: Entry) => void;
  canRemove?: (entry: Entry) => boolean;
  pending?: boolean;
}) {
  return entries.length ? (
    <View style={{ gap: 20 }}>
      {entries.map((e) => (
        <View
          key={e.id}
          style={{ gap: 7, borderBottomWidth: 1, borderBottomColor: '#DFE5DD', paddingBottom: 16 }}
        >
          <View style={{ alignSelf: 'flex-start' }}>
            <KindBadge label={e.kind} />
          </View>
          <Text style={e.removed ? styles.muted : styles.body}>{e.body}</Text>
          <Text style={styles.muted}>
            {e.author} · {new Date(e.date).toLocaleDateString()}
          </Text>
          {!e.removed && onRemove && canRemove?.(e) && (
            <Button
              title="Remove this post"
              variant="ghost"
              disabled={pending}
              onPress={() => onRemove(e)}
            />
          )}
        </View>
      ))}
    </View>
  ) : (
    <Empty title={empty} body="The next chapter is still being written." />
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
    <Button
      title="Manage petition"
      icon="settings-outline"
      variant="secondary"
      onPress={() => router.push(`/manager/${petition.id}`)}
    />
  ) : null;
}
