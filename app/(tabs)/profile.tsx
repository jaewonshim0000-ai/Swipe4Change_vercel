import { AuthButtons } from '../../src/components/auth-buttons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isDemo, localAdapter, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { useReads } from '../../src/data/reads';
import { badgeDefinitions, badgeProgress } from '../../src/domain/personalization';
import { roleLabels } from '../../src/domain/model';
import { rippleTotal } from '../../src/domain/ripple';
import {
  Button,
  Confirm,
  Field,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';
import {
  Bar,
  Cover,
  Initials,
  PillChip,
  Press,
  Rail,
  Ring,
  Screen,
  Sheet,
  Switch,
  initialsOf,
  toast,
  petitionImage,
} from '../../src/components/kit';
import { anim, kf, stag } from '../../src/components/motion';
import { ProfileEditor } from '../../src/components/profile-personalization';
import { RippleSummary } from '../../src/components/ripple';
import { Medal, badgeLook } from '../../src/components/badge-medal';
import { Glyph } from '../../src/components/glyph';
import { useResponsiveLayout } from '../../src/components/responsive';
import { gradient, gradients, shadows, topicColors } from '../../src/components/theme';

type SheetName = 'drafts' | 'reports' | 'ripple' | 'profile' | null;
const statValue = { fontFamily: fonts.bold, fontSize: 24, color: colors.ink };
/** The design's section label. */
const sectionLabel = {
  fontFamily: fonts.bold,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  color: colors.muted,
  marginBottom: 14,
};

export default function Profile() {
  const q = useSnapshot();
  const { adapter, signOut, deleteAccount } = useBackend();
  const client = useQueryClient();
  const m = useCommand();
  const { read } = useReads(q.data?.profile?.id);
  const insets = useSafeAreaInsets();
  const { wide } = useResponsiveLayout();
  const [part, setPart] = useState('Created');
  const [panel, setPanel] = useState<SheetName>(null);
  const [reset, setReset] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingNow, setDeletingNow] = useState(false);
  const [typed, setTyped] = useState('');
  const [failing, setFailing] = useState(() => isDemo && localAdapter.failing);
  const [appeal, setAppeal] = useState('');
  const [withdrawReport, setWithdrawReport] = useState<string | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (!q.data?.profile)
    return (
      <Page title="Your voice has a home here." eyebrow="Profile">
        <Text style={styles.body}>
          Save causes, follow your signatures, and manage your petitions with an account.
        </Text>
        <AuthButtons />
      </Page>
    );
  const s = q.data;
  const p = s.profile!;
  const created = s.petitions.filter((x) => x.ownerId === p.id || x.collaborators.includes(p.id));
  const parts: Record<string, string[]> = {
    Created: created.map((x) => x.id),
    Signed: s.signed,
    Saved: s.saved,
    Volunteering: s.volunteering.map((v) => v.petitionId),
  };
  const list = s.petitions.filter((x) => parts[part].includes(x.id));
  const badges = [
    ...badgeProgress(s).map((b) => ({
      name: b.name,
      criteria: b.description,
      progress: b.progress,
      target: b.target,
      earned: b.earned,
    })),
    ...p.badges
      .filter((b) => !badgeDefinitions.some((d) => d.name === b))
      .map((b) => ({
        name: b,
        criteria: isDemo ? 'Fictional sample award.' : 'Awarded for your activity.',
        progress: 1,
        target: 1,
        earned: true,
      })),
  ].sort((a, b) => Number(b.earned) - Number(a.earned));
  const earnedCount = badges.filter((b) => b.earned).length;
  const unread = s.notifications.filter((n) => !read.includes(n.id)).length;
  const rows = [
    { label: 'Private drafts', value: s.drafts?.length ?? 0, onPress: () => setPanel('drafts') },
    { label: 'Your ripple', value: rippleTotal(s.ripple), onPress: () => setPanel('ripple') },
    { label: 'Reports and appeals', value: s.reports.length, onPress: () => setPanel('reports') },
    {
      label: 'Interests and location',
      value: p.interests.length,
      onPress: () => router.push('/onboarding'),
    },
    { label: 'Notifications', value: unread, onPress: () => router.push('/notifications') },
    { label: 'Profile and privacy', value: '', onPress: () => setPanel('profile') },
  ];
  async function logout() {
    try {
      await signOut();
      client.clear();
      router.replace('/(auth)/sign-in');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign-out failed.');
    }
  }
  const hero = (
    <Animated.View
      style={[
        {
          overflow: 'hidden',
          backgroundColor: colors.white,
          borderColor: colors.line,
          borderBottomWidth: 1,
        },
        wide ? { borderWidth: 1, borderRadius: 20 } : null,
        anim(kf.in, 500),
      ]}
    >
      <View
        style={[
          {
            height: (wide ? 0 : insets.top) + 248,
            paddingTop: (wide ? 0 : insets.top) + 6,
            paddingHorizontal: 8,
            alignItems: 'center',
          },
          gradient(gradients.hero),
          { backgroundColor: colors.pale },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Press
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            scale={0.94}
            onPress={() => router.push('/notifications')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="bell" size={24} weight={2} />
            {unread > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 11,
                  right: 11,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: colors.heart,
                  borderWidth: 2,
                  borderColor: colors.pale,
                }}
              />
            )}
          </Press>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: fonts.bold,
              fontSize: 20,
              lineHeight: 26,
              color: colors.ink,
            }}
          >
            {p.name}
          </Text>
          <Press
            accessibilityLabel="Profile and privacy settings"
            scale={0.94}
            onPress={() => setPanel('profile')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="gear" size={24} weight={2} />
          </Press>
        </View>
        <View
          style={{
            position: 'absolute',
            top: (wide ? 0 : insets.top) + 64,
            right: 20,
            height: 28,
            paddingHorizontal: 12,
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: colors.dark,
            transform: [{ skewX: '-12deg' }],
          }}
        >
          <Text
            style={{
              transform: [{ skewX: '12deg' }],
              fontFamily: fonts.sticker,
              fontSize: 12,
              letterSpacing: 1,
              color: colors.pale,
            }}
          >
            {(p.role
              ? roleLabels[p.role].label
              : created.length
                ? 'Organizer'
                : 'Supporter'
            ).toUpperCase()}
          </Text>
        </View>
        <Press
          accessibilityLabel={p.avatar ? 'Change your profile picture' : 'Add a profile picture'}
          scale={0.97}
          onPress={() => setPanel('profile')}
          style={{ position: 'absolute', bottom: 20 }}
        >
          <Ring ms={2800} inset={-10} color={colors.sage} />
          <Initials text={initialsOf(p.name)} uri={p.avatar} size={140} ring={colors.white} />
          <View
            style={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: colors.dark,
              borderWidth: 3,
              borderColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph
              name={p.avatar ? 'write' : 'create'}
              size={16}
              weight={2.4}
              color={colors.white}
            />
          </View>
        </Press>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: wide ? 22 : 4 }}>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: colors.muted,
          }}
        >
          {isDemo ? 'Fictional demo account' : 'Community member'} · {p.city}
        </Text>
        {!!p.bio && <Text style={[styles.body, { marginTop: 8 }]}>{p.bio}</Text>}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {[
            {
              value: (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {p.interests.slice(0, 3).map((t) => (
                    <View
                      key={t}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: topicColors[t].soft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{topicColors[t].emoji}</Text>
                    </View>
                  ))}
                  {!p.interests.length && <Text style={statValue}>0</Text>}
                </View>
              ),
              label: 'Topics',
              grow: 1.3,
            },
            {
              value: <Text style={statValue}>{p.joined.length}</Text>,
              label: p.joined.length === 1 ? 'Community' : 'Communities',
              grow: 1,
            },
            {
              value: <Text style={statValue}>{rippleTotal(s.ripple)}</Text>,
              label: 'Ripple',
              grow: 1,
            },
          ].map((x) => (
            <View key={x.label} style={{ flex: x.grow, minWidth: 0 }}>
              <View style={{ minHeight: 34, justifyContent: 'center' }}>{x.value}</View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  color: colors.muted,
                }}
              >
                {x.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
          <Button
            title="Edit profile"
            icon="create-outline"
            onPress={() => setPanel('profile')}
            style={{ flex: 1 }}
          />
          <Press
            accessibilityLabel="Interests and location"
            onPress={() => router.push('/onboarding')}
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.handle,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="pin" size={24} weight={2} />
          </Press>
        </View>
      </View>
    </Animated.View>
  );
  const body = (
    <View style={{ paddingHorizontal: wide ? 0 : 20 }}>
      <Text accessibilityRole="header" style={[sectionLabel, { marginTop: wide ? 4 : 36 }]}>
        Overview
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { e: '✍️', value: s.signed.length, label: 'Signatures' },
          { e: '📣', value: created.length, label: 'Petitions started' },
          { e: '🔖', value: s.saved.length, label: 'Saved' },
          { e: '🙋', value: s.volunteering.length, label: 'Volunteering' },
        ].map((x) => (
          <View
            key={x.label}
            style={[
              {
                flexGrow: 1,
                flexBasis: wide ? '22%' : '40%',
                backgroundColor: colors.white,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.line,
                paddingVertical: 14,
                paddingHorizontal: 16,
              },
              shadows.card,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>{x.e}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink }}>
                {x.value}
              </Text>
            </View>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonts.semibold,
                fontSize: 13,
                color: colors.muted,
              }}
            >
              {x.label}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 36,
          marginBottom: 14,
        }}
      >
        <Text accessibilityRole="header" style={sectionLabel}>
          Badges
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>
          {earnedCount} of {badges.length} earned
        </Text>
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
        {badges.map((b, i) => {
          const { tone } = badgeLook(b.name);
          return (
            <Animated.View
              key={b.name}
              accessible
              accessibilityLabel={`${b.name}. ${b.criteria} ${b.earned ? 'Earned.' : `${b.progress} of ${b.target}.`}`}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: colors.line,
                },
                stag(i),
              ]}
            >
              <Medal name={b.name} earned={b.earned} progress={b.progress / b.target} size={56} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text
                    style={{
                      flexShrink: 1,
                      fontFamily: fonts.bold,
                      fontSize: 16,
                      color: colors.ink,
                    }}
                  >
                    {b.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 12,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: b.earned ? tone.accent : colors.outline,
                    }}
                  >
                    {b.earned ? 'Earned' : 'Not yet'}
                  </Text>
                </View>
                <Text style={[styles.small, { marginTop: 2 }]}>{b.criteria}</Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <Bar pct={Math.max(4, (100 * b.progress) / b.target)} />
                  </View>
                  <Text
                    style={{
                      minWidth: 44,
                      textAlign: 'right',
                      fontFamily: fonts.semibold,
                      fontSize: 13,
                      color: colors.muted,
                    }}
                  >
                    {Math.min(b.progress, b.target)}/{b.target}
                  </Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>
      <Text style={[styles.micro, { marginTop: 8 }]}>
        Badges recognize participation, not verified impact.
      </Text>

      <Text accessibilityRole="header" style={[sectionLabel, { marginTop: 36 }]}>
        Activity
      </Text>
      <Rail gutter={wide ? 0 : 20}>
        {Object.keys(parts).map((c) => (
          <PillChip
            key={c}
            label={`${c} · ${parts[c].length}`}
            selected={part === c}
            onPress={() => setPart(c)}
          />
        ))}
      </Rail>
      <View
        style={[
          {
            marginTop: 12,
            backgroundColor: colors.white,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 16,
          },
          shadows.card,
        ]}
      >
        {list.map((x, i) => (
          <Animated.View key={x.id} style={stag(i)}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${x.title}`}
              onPress={() => router.push(`/petition/${x.id}`)}
              style={{
                paddingVertical: 12,
                flexDirection: 'row',
                gap: 14,
                alignItems: 'center',
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.line,
              }}
            >
              <Cover
                source={petitionImage(x)}
                style={{ width: 56, height: 56, borderRadius: 14 }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>
                  {x.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 13,
                    color: colors.muted,
                    marginTop: 2,
                  }}
                >
                  {x.count.toLocaleString()} of {x.goal.toLocaleString()} signed
                  {x.status !== 'active' ? ` · ${x.status}` : ''}
                </Text>
                <View style={{ marginTop: 8 }}>
                  <Bar pct={(100 * x.count) / x.goal} height={4} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
        {!list.length && (
          <Text
            style={{
              paddingVertical: 20,
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 21,
              color: colors.muted,
            }}
          >
            {part === 'Volunteering'
              ? 'Nothing here yet. Organizers see your name and the roles you pick.'
              : part === 'Saved'
                ? 'Nothing here yet. Saving a petition sends its updates to your inbox.'
                : 'Nothing here yet.'}
          </Text>
        )}
      </View>

      <Text accessibilityRole="header" style={[sectionLabel, { marginTop: 36 }]}>
        Settings
      </Text>
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
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={r.value !== '' ? `${r.label}, ${r.value}` : r.label}
            onPress={r.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              minHeight: 56,
              paddingHorizontal: 16,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: colors.line,
              backgroundColor: pressed ? colors.field : 'transparent',
            })}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
              {r.label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.muted }}>
                {r.value}
              </Text>
              <Glyph name="next" size={18} weight={2} color={colors.muted} />
            </View>
          </Pressable>
        ))}
      </View>

      {isDemo && (
        <>
          <Text style={[sectionLabel, { marginTop: 28 }]}>Demo controls</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: failing }}
            accessibilityLabel="Simulate next write failure"
            onPress={() => {
              localAdapter.simulateFailure(!failing);
              setFailing(!failing);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              backgroundColor: colors.white,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.line,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
                Simulate next write failure
              </Text>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                }}
              >
                See optimistic update and rollback
              </Text>
            </View>
            <Switch on={failing} />
          </Pressable>
          <Button
            title="Reset all local demo data"
            variant="danger"
            onPress={() => setReset(true)}
            style={{ marginTop: 10 }}
          />
        </>
      )}
      <Button
        title={isDemo ? 'Switch account' : 'Sign out'}
        variant="ghost"
        onPress={() => void logout()}
        style={{ marginTop: 10 }}
      />
      {deleteAccount && (
        <Button
          title="Delete account"
          variant="danger"
          onPress={() => setDeleting(true)}
          style={{ marginTop: 10 }}
        />
      )}
    </View>
  );
  return (
    <Screen top={false} gutter={wide ? 32 : 0} wide={wide}>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 32, paddingTop: 32, alignItems: 'flex-start' }}>
          <View style={{ width: 360 }}>{hero}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{body}</View>
        </View>
      ) : (
        <>
          {hero}
          {body}
        </>
      )}

      <Sheet visible={panel === 'profile'} onClose={() => setPanel(null)} locked={m.isPending}>
        <ProfileEditor key={p.id} snapshot={s} onDone={() => setPanel(null)} />
      </Sheet>
      <Sheet visible={panel === 'ripple'} onClose={() => setPanel(null)}>
        <RippleSummary snapshot={s} />
      </Sheet>
      <Sheet visible={panel === 'drafts'} onClose={() => setPanel(null)}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 29 }]}>
            Private drafts
          </Text>
          <Text style={styles.muted}>
            An unfinished idea is welcome here. Only you can see these drafts.
          </Text>
          {(s.drafts ?? []).map((d) => (
            <View
              key={d.id}
              style={{ backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 6 }}
            >
              <Text style={styles.cardTitle}>{d.draft.title || 'Untitled idea'}</Text>
              <Text style={styles.small}>
                Saved {new Date(d.updatedAt).toLocaleString()} · Step {d.step + 1} of 4
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title="Continue"
                  style={{ flex: 1, minHeight: 42 }}
                  onPress={() => {
                    setPanel(null);
                    router.push({ pathname: '/(tabs)/create', params: { draftId: d.id } });
                  }}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  style={{ flex: 1, minHeight: 42, backgroundColor: colors.quiet }}
                  onPress={() => setDeleteDraft(d.id)}
                />
              </View>
            </View>
          ))}
          <Button
            title="Start a new draft"
            variant="secondary"
            onPress={() => {
              setPanel(null);
              router.push({ pathname: '/(tabs)/create', params: { draftId: 'new' } });
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={panel === 'reports'} onClose={() => setPanel(null)} locked={m.isPending}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 29 }]}>
            Reports and appeals
          </Text>
          {s.reports.length ? (
            s.reports.map((r) => (
              <View
                key={r.id}
                style={{ backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 8 }}
              >
                <Text style={[styles.label, { fontSize: 11 }]}>{r.status}</Text>
                <Text style={styles.body}>{r.reason}</Text>
                {!!r.screening && (
                  <Text style={styles.small}>
                    {r.screening === 'flagged'
                      ? 'Automatic review: flagged. The petition is hidden while a person reviews it.'
                      : r.screening === 'clear'
                        ? 'Automatic review: no clear violation found. A person will review your report.'
                        : 'Automatic review: not finished yet. A person will review your report.'}
                  </Text>
                )}
                {r.appeal ? (
                  <Text style={styles.small}>Your appeal: {r.appeal}</Text>
                ) : (
                  <>
                    <Field
                      label="Appeal or additional context"
                      value={appeal}
                      onChangeText={setAppeal}
                      multiline
                    />
                    <Button
                      title="Submit appeal"
                      variant="secondary"
                      style={{ backgroundColor: colors.quiet }}
                      disabled={m.isPending || appeal.trim().length < 5}
                      onPress={() =>
                        m.mutate(
                          { type: 'appeal', reportId: r.id, body: appeal },
                          { onSuccess: () => setAppeal('') },
                        )
                      }
                    />
                  </>
                )}
                <Button
                  title="Withdraw this report"
                  variant="ghost"
                  disabled={m.isPending}
                  onPress={() => setWithdrawReport(r.id)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No reports on this account.</Text>
          )}
          <Text style={styles.micro}>
            Reports are reviewed by an AI model (Claude), with keyword rules as a fallback. The AI
            can be wrong, so a trusted person makes the final decision.
          </Text>
          {m.error && <Notice error text={m.error.message} />}
        </View>
      </Sheet>
      <Confirm
        visible={!!deleteDraft}
        title="Delete this private draft?"
        body="This removes the saved draft from your account."
        pending={m.isPending}
        confirmLabel="Delete"
        onCancel={() => setDeleteDraft(null)}
        onConfirm={() =>
          deleteDraft &&
          m.mutate(
            { type: 'deleteDraft', id: deleteDraft },
            { onSuccess: () => setDeleteDraft(null) },
          )
        }
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
      <Confirm
        visible={!!withdrawReport}
        title="Withdraw this report?"
        body="The report and any appeal you added are deleted. Nobody reviews it further. You can report the petition again later."
        pending={m.isPending}
        confirmLabel="Withdraw"
        onCancel={() => setWithdrawReport(null)}
        onConfirm={() =>
          withdrawReport &&
          m.mutate(
            { type: 'withdrawReport', reportId: withdrawReport },
            { onSuccess: () => setWithdrawReport(null) },
          )
        }
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
      {deleteAccount && (
        <Confirm
          visible={deleting}
          title="Delete your account?"
          body="Your signatures, saves, memberships, drafts, notifications and photos are deleted, and your petitions leave public view. Updates and posts you wrote stay public as “Deleted account”. This can’t be undone."
          pending={deletingNow}
          confirmLabel="Delete account"
          confirmDisabled={typed.trim() !== 'DELETE'}
          onCancel={() => {
            setDeleting(false);
            setTyped('');
          }}
          onConfirm={() => {
            setDeletingNow(true);
            void deleteAccount()
              .then(() => {
                client.clear();
                router.replace('/(tabs)');
                toast('Your account was deleted.');
              })
              .catch((e) => toast(e instanceof Error ? e.message : 'Deletion failed. Try again.'))
              .finally(() => {
                setDeletingNow(false);
                setDeleting(false);
                setTyped('');
              });
          }}
        >
          <Field
            label="Type DELETE to confirm"
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
          />
        </Confirm>
      )}
      <Confirm
        visible={reset}
        title="Reset this fictional community?"
        body="This removes locally created petitions, signatures, posts, and account preferences, then restores the sample data."
        confirmLabel="Reset"
        onCancel={() => setReset(false)}
        onConfirm={() => {
          void adapter
            .reset()
            .then(() => {
              client.clear();
              setReset(false);
              router.replace('/(auth)/sign-in');
            })
            .catch(() => toast('Reset failed. Try again.'));
        }}
      />
    </Screen>
  );
}
