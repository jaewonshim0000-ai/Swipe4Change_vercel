import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSnapshot } from '../src/data/provider';
import { useReads } from '../src/data/reads';
import { Empty, Loading, Notice, colors, fonts, styles } from '../src/components/ui';
import { CircleButton, LiveDot, Screen } from '../src/components/kit';
import { Glyph } from '../src/components/glyph';
import { kf, stag, transition } from '../src/components/motion';

/**
 * What each kind of notification is called and its glyph. Keyed by the `kind` the data layer
 * writes; anything unrecognised falls back to a neutral notice rather than disappearing.
 */
const kinds: Record<string, { title: string; glyph: string }> = {
  signature: { title: 'Signature confirmed', glyph: '✓' },
  update: { title: 'Organizer update', glyph: '↗' },
  edit: { title: 'Petition revised', glyph: '✎' },
  response: { title: 'Response recorded', glyph: '✉' },
  delivery: { title: 'Delivered', glyph: '➤' },
  milestone: { title: 'Milestone crossed', glyph: '◆' },
  endorsement: { title: 'Endorsement', glyph: '★' },
  discussion: { title: 'New discussion contribution', glyph: '❝' },
  eligibility: { title: 'Eligibility', glyph: '⚿' },
  volunteer: { title: 'Volunteer', glyph: '✋' },
  moderation: { title: 'Moderation', glyph: '⚑' },
  close: { title: 'Petition closed', glyph: '⚑' },
  status: { title: 'Petition status', glyph: '⚑' },
  ripple: { title: 'Your ripple grew', glyph: '◎' },
};

export default function Notifications() {
  const q = useSnapshot();
  const { read, markRead } = useReads(q.data?.profile?.id);
  if (q.isPending) return <Loading />;
  const items = q.data?.notifications ?? [];
  return (
    <Screen tabs={false} enter="slide">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CircleButton
          label="Back"
          light={false}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Glyph name="back" size={19} weight={2} />
        </CircleButton>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontFamily: fonts.display,
            fontSize: 24,
            lineHeight: 26,
            letterSpacing: -0.7,
            color: colors.ink,
          }}
        >
          Notifications
        </Text>
        {items.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => markRead(items.map((n) => n.id))}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent }}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>
      <View style={{ gap: 10, marginTop: 16 }}>
        {q.error ? (
          <Notice error text={q.error.message} />
        ) : items.length ? (
          items.map((n, i) => {
            const kind = kinds[n.kind] ?? { title: 'Notice', glyph: '•' };
            const done = read.includes(n.id);
            return (
              <Animated.View key={n.id} style={stag(i, kf.slide)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${done ? '' : 'Unread. '}${kind.title}. ${n.body}`}
                  onPress={() => markRead([n.id])}
                >
                  <Animated.View
                    style={[
                      {
                        flexDirection: 'row',
                        gap: 12,
                        alignItems: 'flex-start',
                        borderRadius: 22,
                        padding: 14,
                        backgroundColor: done ? '#F6F7F3' : colors.white,
                      },
                      done ? null : { boxShadow: '0px 10px 24px -16px rgba(32,38,26,0.4)' },
                      transition(['backgroundColor'], 300),
                    ]}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: done ? colors.track : colors.dark,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.semibold,
                          fontSize: 15,
                          color: done ? colors.muted : colors.pale,
                        }}
                      >
                        {kind.glyph}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text
                        style={{
                          fontFamily: fonts.semibold,
                          fontSize: 13.5,
                          lineHeight: 18,
                          color: colors.ink,
                        }}
                      >
                        {kind.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 12.5,
                          lineHeight: 19,
                          color: colors.muted,
                        }}
                      >
                        {n.body}
                      </Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.outline }}>
                        {new Date(n.date).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ marginTop: 6 }}>{!done && <LiveDot size={9} />}</View>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            );
          })
        ) : (
          <Empty
            title="You’re all caught up"
            body="Save a petition to hear when its organizer posts an update, delivers it, or receives a response."
          />
        )}
      </View>
      <Text style={[styles.micro, { textAlign: 'center', paddingTop: 18 }]}>
        Petitions you save, sign or volunteer for send their updates here. In-app only in this demo.
      </Text>
    </Screen>
  );
}
