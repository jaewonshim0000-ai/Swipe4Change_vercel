import { ResponsiveGrid } from '../../src/components/responsive';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Topic, topics } from '../../src/domain/model';
import { backers, communitySchema } from '../../src/domain/rules';
import {
  Button,
  Field,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';
import {
  Cover,
  PillChip,
  Press,
  Scrim,
  Screen,
  Sheet,
  toast,
  topicImage,
} from '../../src/components/kit';
import { stag } from '../../src/components/motion';

export default function Communities() {
  const q = useSnapshot();
  const m = useCommand();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [topic, setTopic] = useState<Topic>('Safer streets');
  const [error, setError] = useState('');
  if (q.isPending) return <Loading />;
  if (!q.data)
    return (
      <Page>
        <Notice error text={q.error?.message ?? 'Unable to load communities.'} />
      </Page>
    );
  const s = q.data;
  function create() {
    const parsed = communitySchema.safeParse({ name, description, city, topic });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    m.mutate(
      { type: 'createCommunity', ...parsed.data },
      {
        onSuccess: (id) => {
          setCreating(false);
          setName('');
          setDescription('');
          setCity('');
          toast('New communities start with one member — you, as owner.');
          if (typeof id === 'string') router.push(`/community/${id}`);
        },
      },
    );
  }
  return (
    <Screen wide>
      <Text style={styles.label}>Communities</Text>
      <Text accessibilityRole="header" style={[styles.title, { marginTop: 8, marginBottom: 6 }]}>
        Your people, nearby.
      </Text>
      <Text style={[styles.muted, { fontSize: 13.5, lineHeight: 21, marginBottom: 16 }]}>
        Local groups in a fictional town. Members vote on which petitions their community backs, and
        some petitions only members can sign.
      </Text>
      <View style={{ gap: 14 }}>
        <ResponsiveGrid>
          {s.communities.map((c, i) => {
            const on = !!s.profile?.joined.includes(c.id);
            const live = s.petitions.filter((p) => p.status === 'active');
            const own = live.filter((p) => p.communityId === c.id);
            const membersOnly = own.filter((p) => p.verification === 'community').length;
            const backed = live.filter((p) => backers(p).includes(c.id)).length;
            return (
              <Animated.View key={c.id} style={stag(i)}>
                <View
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: 28,
                    overflow: 'hidden',
                    boxShadow: '0px 12px 28px -18px rgba(32,38,26,0.4)',
                  }}
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${c.name}`}
                    onPress={() => router.push(`/community/${c.id}`)}
                    style={{ height: 120 }}
                  >
                    <Cover source={topicImage(c.topic)} style={{ width: '100%', height: '100%' }} />
                    <Scrim stops="rgba(18,20,15,0) 20%, rgba(18,20,15,0.75) 100%" />
                    <Text
                      style={{
                        position: 'absolute',
                        left: 16,
                        right: 16,
                        bottom: 12,
                        fontFamily: fonts.heading,
                        fontSize: 20,
                        lineHeight: 24,
                        letterSpacing: -0.5,
                        color: colors.white,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                  <View
                    style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        lineHeight: 19.5,
                        color: colors.muted,
                      }}
                    >
                      {c.description}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{
                          flexShrink: 1,
                          fontFamily: fonts.medium,
                          fontSize: 12,
                          color: colors.secondary,
                        }}
                      >
                        {[
                          `${c.members} members`,
                          `${own.length} campaigns`,
                          membersOnly ? `${membersOnly} members-only` : '',
                          backed ? `${backed} backed` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <Press
                        accessibilityLabel={on ? `Leave ${c.name}` : `Join ${c.name}`}
                        disabled={m.isPending}
                        onPress={() =>
                          s.profile
                            ? m.mutate(
                                { type: 'join', communityId: c.id },
                                {
                                  onSuccess: () =>
                                    toast(on ? `Left ${c.name}.` : `Welcome to ${c.name}!`),
                                },
                              )
                            : router.push('/(auth)/sign-in')
                        }
                        style={{
                          minHeight: 40,
                          paddingHorizontal: 18,
                          borderRadius: 999,
                          justifyContent: 'center',
                          backgroundColor: on ? colors.soft : colors.dark,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 12.5,
                            color: on ? colors.accent : colors.white,
                          }}
                        >
                          {on ? '✓ Joined' : 'Join'}
                        </Text>
                      </Press>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </ResponsiveGrid>
        {m.error && !creating && <Notice error text={m.error.message} />}
        <Pressable
          accessibilityRole="button"
          onPress={() => (s.profile ? setCreating(true) : router.push('/(auth)/sign-in'))}
          style={{
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#B9BEAF',
            minHeight: 54,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.accent }}>
            + Create a community
          </Text>
        </Pressable>
      </View>
      <Sheet visible={creating} onClose={() => setCreating(false)} locked={m.isPending}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 26 }]}>
            Start a community
          </Text>
          <Text style={styles.muted}>
            You become the owner and first member. Owners and the moderators they appoint can remove
            posts. Keep the description free of private information.
          </Text>
          <Field label="Community name" value={name} onChangeText={setName} />
          <Field
            label="What this community is for"
            multiline
            value={description}
            onChangeText={setDescription}
          />
          <Field label="City and state" value={city} onChangeText={setCity} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
            Main topic
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {topics.map((t) => (
              <PillChip
                key={t}
                label={t}
                height={36}
                selected={topic === t}
                onPress={() => setTopic(t)}
              />
            ))}
          </View>
          {!!error && <Notice error text={error} />}
          {m.error && <Notice error text={m.error.message} />}
          <Button title="Create community" disabled={m.isPending} onPress={create} />
        </View>
      </Sheet>
    </Screen>
  );
}
