import { Text, View } from 'react-native';
import { Entry, Petition, Profile } from '../domain/model';
import { canManage } from '../domain/rules';
import { Button, Empty, styles } from './ui';
import { router } from 'expo-router';
export function Entries({
  entries,
  empty = 'No posts yet.',
}: {
  entries: Entry[];
  empty?: string;
}) {
  return entries.length ? (
    <View style={{ gap: 20 }}>
      {entries.map((e) => (
        <View
          key={e.id}
          style={{ gap: 7, borderBottomWidth: 1, borderBottomColor: '#DFE5DD', paddingBottom: 16 }}
        >
          <Text style={styles.label}>{e.kind}</Text>
          <Text style={styles.body}>{e.body}</Text>
          <Text style={styles.muted}>
            {e.author} · {new Date(e.date).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </View>
  ) : (
    <Empty title={empty} body="The next chapter is still being written." />
  );
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
