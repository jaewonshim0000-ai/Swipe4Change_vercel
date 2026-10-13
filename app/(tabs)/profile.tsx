import { AuthButtons } from '../../src/components/auth-buttons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isDemo, localAdapter, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { useReads } from '../../src/data/reads';
import { badgeDefinitions, badgeProgress } from '../../src/domain/personalization';
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
  Cover,
  PillChip,
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
import { shadows } from '../../src/components/theme';

type SheetName = 'drafts' | 'reports' | 'ripple' | 'profile' | null;

export default function Profile() {
  const q = useSnapshot();
  const { adapter, signOut, deleteAccount } = useBackend();
  const client = useQueryClient();
  const m = useCommand();
  const { read } = useReads(q.data?.profile?.id);
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
  return (
    <Screen>
      <Animated.View
        style={[
          {
            backgroundColor: colors.white,
            borderRadius: 30,
            padding: 20,
            boxShadow: '0px 14px 30px -20px rgba(32,38,26,0.45)',
          },
          anim(kf.in, 500),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 72, height: 72 }}>
            <Ring ms={2800} />
            <View
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                right: 6,
                bottom: 6,
                borderRadius: 30,
                backgroundColor: colors.pale,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 21, color: colors.accent }}>
                {initialsOf(p.name)}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                lineHeight: 26,
                letterSpacing: -0.7,
                color: colors.ink,
              }}
            >
              {p.name}
            </Text>
            <Text
              style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 3 }}
            >
              {isDemo ? 'Fictional demo account' : 'Community member'} · {p.city}
            </Text>
          </View>
        </View>
        {!!p.bio && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 21,
              color: colors.secondary,
              marginTop: 12,
            }}
          >
            {p.bio}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {[
            { value: created.length, label: 'Started' },
            { value: s.signed.length, label: 'Signed' },
            { value: rippleTotal(s.ripple), label: 'Ripple' },
            { value: p.joined.length, label: 'Groups' },
          ].map((x) => (
            <View
              key={x.label}
              style={{
                flex: 1,
                backgroundColor: colors.quiet,
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 8,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 21,
                  lineHeight: 23,
                  color: colors.ink,
                }}
              >
                {x.value}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 11,
                  color: colors.muted,
                  marginTop: 4,
                }}
              >
                {x.label}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 24,
          marginBottom: 12,
        }}
      >
        <Text accessibilityRole="header" style={styles.h2}>
          Badges
        </Text>
        <Text style={styles.small}>
          {earnedCount} of {badges.length} earned
        </Text>
      </View>
      <Rail gap={10} style={{ paddingBottom: 6 }}>
        {badges.map((b, i) => {
          const { tone } = badgeLook(b.name);
          return (
            <Animated.View
              key={b.name}
              accessible
              accessibilityLabel={`${b.name}. ${b.criteria} ${b.earned ? 'Earned.' : `${b.progress} of ${b.target}.`}`}
              style={[
                {
                  width: 148,
                  minHeight: 196,
                  borderRadius: 24,
                  padding: 14,
                  paddingTop: 16,
                  gap: 6,
                  alignItems: 'center',
                  backgroundColor: b.earned ? colors.white : colors.quiet,
                },
                b.earned ? shadows.raised : null,
                stag(i),
              ]}
            >
              <Animated.View
                style={[
                  { marginBottom: 6 },
                  b.earned ? anim(kf.float, 3000, { loop: true, ease: 'ease-in-out' }) : null,
                ]}
              >
                <Medal name={b.name} earned={b.earned} progress={b.progress / b.target} />
              </Animated.View>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  lineHeight: 17,
                  color: b.earned ? colors.ink : colors.secondary,
                  textAlign: 'center',
                }}
              >
                {b.name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11,
                  lineHeight: 15.5,
                  color: colors.muted,
                  textAlign: 'center',
                }}
              >
                {b.criteria}
              </Text>
              <View
                style={{
                  marginTop: 'auto',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  backgroundColor: b.earned ? tone.soft : colors.white,
                }}
              >
                {b.earned && <Glyph name="check" size={12} color={tone.accent} weight={2.6} />}
                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 11,
                    color: b.earned ? tone.accent : colors.muted,
                  }}
                >
                  {b.earned ? 'Earned' : `${b.progress} of ${b.target}`}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </Rail>
      <Text style={[styles.micro, { marginTop: 4 }]}>
        Badges recognize participation, not verified impact.
      </Text>

      <Rail style={{ marginTop: 20 }}>
        {Object.keys(parts).map((c) => (
          <PillChip
            key={c}
            label={`${c} · ${parts[c].length}`}
            height={36}
            selected={part === c}
            onPress={() => setPart(c)}
          />
        ))}
      </Rail>
      <View style={{ gap: 10, marginTop: 12 }}>
        {list.map((x, i) => (
          <Animated.View key={x.id} style={stag(i)}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${x.title}`}
              onPress={() => router.push(`/petition/${x.id}`)}
              style={{
                backgroundColor: colors.white,
                borderRadius: 20,
                padding: 8,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <Cover
                source={petitionImage(x)}
                style={{ width: 56, height: 56, borderRadius: 14 }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 14.5,
                    lineHeight: 18,
                    color: colors.ink,
                  }}
                >
                  {x.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 12,
                    color: colors.muted,
                    marginTop: 3,
                  }}
                >
                  {x.count.toLocaleString()} of {x.goal.toLocaleString()}
                  {x.status !== 'active' ? ` · ${x.status}` : ''}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
        {!list.length && (
          <Text
            style={{
              backgroundColor: colors.white,
              borderRadius: 20,
              padding: 18,
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 19.5,
              color: colors.muted,
              textAlign: 'center',
              overflow: 'hidden',
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

      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          marginTop: 20,
          overflow: 'hidden',
        }}
      >
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={r.value !== '' ? `${r.label}, ${r.value}` : r.label}
            onPress={r.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              minHeight: 54,
              paddingHorizontal: 16,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: colors.canvas,
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink }}>
              {r.label}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
              {r.value} ›
            </Text>
          </Pressable>
        ))}
      </View>

      {isDemo && (
        <>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 11,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
              color: colors.muted,
              marginTop: 22,
              marginBottom: 10,
              marginHorizontal: 4,
            }}
          >
            Demo controls
          </Text>
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
              borderRadius: 24,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink }}>
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
            style={{ marginTop: 10, borderRadius: 24 }}
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
          style={{ marginTop: 10, borderRadius: 24 }}
        />
      )}

      <Sheet visible={panel === 'profile'} onClose={() => setPanel(null)} locked={m.isPending}>
        <ProfileEditor key={p.id} snapshot={s} onDone={() => setPanel(null)} />
      </Sheet>
      <Sheet visible={panel === 'ripple'} onClose={() => setPanel(null)}>
        <RippleSummary snapshot={s} />
      </Sheet>
      <Sheet visible={panel === 'drafts'} onClose={() => setPanel(null)}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 26 }]}>
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
          <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 26 }]}>
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
