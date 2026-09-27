import React from 'react';
import { Text, View } from 'react-native';
import { useSnapshot } from '../src/data/provider';
import {
  Empty,
  Icon,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
  tokens,
} from '../src/components/ui';

/**
 * What each kind of notification is called and what it looks like. Keyed by the `kind` the data
 * layer writes; anything unrecognised falls back to a neutral bell rather than disappearing.
 */
const kinds: Record<string, { title: string; icon: React.ComponentProps<typeof Icon>['name'] }> = {
  signature: { title: 'Signature', icon: 'create-outline' },
  update: { title: 'Organizer update', icon: 'megaphone-outline' },
  edit: { title: 'Petition revised', icon: 'pencil-outline' },
  response: { title: 'Response recorded', icon: 'mail-open-outline' },
  delivery: { title: 'Delivered', icon: 'send-outline' },
  milestone: { title: 'Milestone', icon: 'trophy-outline' },
  endorsement: { title: 'Endorsement', icon: 'ribbon-outline' },
  discussion: { title: 'Discussion', icon: 'chatbubbles-outline' },
  eligibility: { title: 'Eligibility', icon: 'key-outline' },
  volunteer: { title: 'Volunteer', icon: 'hand-left-outline' },
  moderation: { title: 'Moderation', icon: 'shield-outline' },
  close: { title: 'Petition closed', icon: 'flag-outline' },
  status: { title: 'Petition status', icon: 'flag-outline' },
  ripple: { title: 'Your ripple grew', icon: 'water-outline' },
};

export default function Notifications() {
  const q = useSnapshot();
  if (q.isPending) return <Loading />;
  const items = q.data?.notifications ?? [];
  return (
    <Page
      back
      title="Your community, keeping you posted."
      subtitle="What happened on the petitions you saved, signed, or organize."
      eyebrow="NOTIFICATIONS"
    >
      <Notice text="Petitions you save, sign or volunteer for send their updates here. In-app only in this demo." />
      {q.error ? (
        <Notice error text={q.error.message} />
      ) : items.length ? (
        items.map((n) => {
          const kind = kinds[n.kind] ?? { title: 'Notice', icon: 'notifications-outline' as const };
          return (
            <View
              key={n.id}
              style={{
                flexDirection: 'row',
                gap: 12,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: tokens.radius,
                padding: 15,
                ...tokens.shadow,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.pale,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={kind.icon} size={18} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
                  {kind.title}
                </Text>
                <Text style={styles.small}>{n.body}</Text>
                <Text style={styles.micro}>{new Date(n.date).toLocaleString()}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Empty
          title="You’re all caught up"
          body="Save a petition to hear when its organizer posts an update, delivers it, or receives a response."
        />
      )}
    </Page>
  );
}
