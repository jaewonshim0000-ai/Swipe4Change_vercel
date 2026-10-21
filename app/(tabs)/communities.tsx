import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { isDemo, useCommand, useSnapshot } from '../../src/data/provider';
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
import { Cover, PillChip, Press, Screen, Sheet, toast, topicImage } from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { stag } from '../../src/components/motion';
import { shadows, topicColors } from '../../src/components/theme';

export default function Communities() {
  const q = useSnapshot();
  const m = useCommand();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
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
  const term = search.trim().toLowerCase();
  const shown = s.communities.filter(
    (c) => !term || [c.name, c.description, c.city, c.topic].join(' ').toLowerCase().includes(term),
  );
  const live = s.petitions.filter((p) => p.status === 'active');
  const open = (id: string) => router.push(`/community/${id}`);
  return (
    <Screen gutter={12}>
      <View style={{ paddingHorizontal: 6, gap: 6, marginBottom: 14 }}>
        <Text style={styles.label}>Communities</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Your people, nearby.
        </Text>
        <Text style={styles.muted}>
          {isDemo ? 'Local groups in a fictional town.' : 'Local groups near you.'} Members vote on
          which petitions their community backs, and some petitions only members can sign.
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 48,
          paddingHorizontal: 16,
          marginBottom: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.white,
        }}
      >
        <Glyph name="search" size={20} weight={2} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search communities"
          value={search}
          onChangeText={setSearch}
          placeholder="Search communities"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.ink,
          }}
        />
      </View>
      <View
        style={[
          {
            backgroundColor: colors.white,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            overflow: 'hidden',
          },
          shadows.card,
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.label, { color: colors.muted, paddingTop: 20, paddingHorizontal: 16 }]}
        >
          {term ? 'Matching communities' : 'Recommended for you'}
        </Text>
        {shown.map((c, i) => {
          const on = !!s.profile?.joined.includes(c.id);
          const own = live.filter((p) => p.communityId === c.id);
          const membersOnly = own.filter((p) => p.verification === 'community').length;
          const backed = live.filter((p) => backers(p).includes(c.id)).length;
          const why = on
            ? 'You’re a member'
            : s.profile?.interests.includes(c.topic)
              ? `Matches your interest in ${c.topic}`
              : `Active in ${c.city.split(',')[0]}`;
          return (
            <Animated.View
              key={c.id}
              style={[
                {
                  flexDirection: 'row',
                  gap: 14,
                  padding: 16,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: colors.line,
                },
                stag(i),
              ]}
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Open ${c.name}`}
                onPress={() => open(c.id)}
              >
                <Cover
                  source={topicImage(c.topic)}
                  style={{ width: 56, height: 56, borderRadius: 999 }}
                />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pressable accessibilityRole="link" onPress={() => open(c.id)}>
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 17,
                      lineHeight: 22,
                      color: colors.ink,
                    }}
                  >
                    {c.name} {topicColors[c.topic].emoji}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 2,
                      fontFamily: fonts.body,
                      fontSize: 15,
                      lineHeight: 21,
                      color: colors.secondary,
                    }}
                  >
                    {c.description} · {c.members.toLocaleString()} members · {c.city}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Glyph name="trend" size={18} weight={2.2} color={colors.muted} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.body,
                      fontSize: 13,
                      lineHeight: 18,
                      color: colors.muted,
                    }}
                  >
                    {[
                      why,
                      `${own.length} campaigns`,
                      membersOnly ? `${membersOnly} for members only` : '',
                      backed ? `${backed} backed` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
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
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    height: 44,
                    marginTop: 12,
                    paddingLeft: 14,
                    paddingRight: 18,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? colors.handle : colors.sage,
                    backgroundColor: on ? colors.field : colors.soft,
                  }}
                >
                  <Glyph
                    name={on ? 'check' : 'create'}
                    size={18}
                    weight={2.6}
                    color={on ? colors.secondary : colors.accent}
                  />
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 15,
                      color: on ? colors.secondary : colors.accent,
                    }}
                  >
                    {on ? 'Joined' : 'Join'}
                  </Text>
                </Press>
              </View>
            </Animated.View>
          );
        })}
        {!shown.length && (
          <Text style={[styles.muted, { padding: 16 }]}>
            {search.trim()
              ? `No communities match “${search.trim()}”.`
              : 'No communities yet. Start the first one for your neighborhood.'}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => (s.profile ? setCreating(true) : router.push('/(auth)/sign-in'))}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 56,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: pressed ? colors.field : 'transparent',
          })}
        >
          <Glyph name="create" size={20} weight={2.2} color={colors.secondary} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.secondary }}>
            Create a community
          </Text>
        </Pressable>
      </View>
      {m.error && !creating && (
        <View style={{ marginTop: 12 }}>
          <Notice error text={m.error.message} />
        </View>
      )}
      <Sheet visible={creating} onClose={() => setCreating(false)} locked={m.isPending}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 29 }]}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {topics.map((t) => (
              <PillChip
                key={t}
                label={`${topicColors[t].emoji} ${t}`}
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
