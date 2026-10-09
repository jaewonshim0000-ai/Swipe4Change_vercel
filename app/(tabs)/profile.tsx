import { AuthButtons } from '../../src/components/auth-buttons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isDemo, localAdapter, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { useReads } from '../../src/data/reads';
import { badgeProgress } from '../../src/domain/personalization';
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

const glyphs: Record<string, string> = {
  'First voice': '✦',
  'Change starter': '↗',
  'Conversation starter': '❝',
  'Community builder': '◎',
  'Showing up': '★',
};
type SheetName = 'drafts' | 'reports' | 'ripple' | 'profile' | null;

export default function Profile() {
  const q = useSnapshot();
  const { adapter, signOut } = useBackend();
  const client = useQueryClient();
  const m = useCommand();
  const { read } = useReads(q.data?.profile?.id);
  const [part, setPart] = useState('Created');
  const [panel, setPanel] = useState<SheetName>(null);
  const [reset, setReset] = useState(false);
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
      .filter((b) => !(b in glyphs))
      .map((b) => ({
        name: b,
        criteria: isDemo ? 'Fictional sample award.' : 'Awarded for your activity.',
        progress: 1,
        target: 1,
        earned: true,
      })),
  ];
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
              <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.accent }}>
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
              style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 }}
            >
              {isDemo ? 'Fictional demo account' : 'Community member'} · {p.city}
            </Text>
          </View>
        </View>
        {!!p.bio && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 13.5,
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
                borderRadius: 16,
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
                  fontSize: 10.5,
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

      <Text accessibilityRole="header" style={[styles.h2, { marginTop: 24, marginBottom: 12 }]}>
        Badges
      </Text>
      <Rail gap={10} style={{ paddingBottom: 6 }}>
        {badges.map((b) => (
          <View
            key={b.name}
            accessible
            accessibilityLabel={`${b.name}. ${b.criteria} ${b.earned ? 'Earned.' : `${b.progress} of ${b.target}.`}`}
            style={[
              {
                width: 148,
                minHeight: 176,
                borderRadius: 22,
                padding: 14,
                gap: 6,
                backgroundColor: b.earned ? colors.white : colors.quiet,
              },
              b.earned ? { boxShadow: '0px 12px 26px -16px rgba(32,38,26,0.45)' } : null,
            ]}
          >
            <Animated.View
              style={[
                {
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  marginBottom: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: b.earned ? colors.dark : colors.knob,
                },
                b.earned ? anim(kf.float, 3000, { loop: true, ease: 'ease-in-out' }) : null,
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 17,
                  color: b.earned ? colors.pale : '#9A9E92',
                }}
              >
                {glyphs[b.name] ?? '◆'}
              </Text>
            </Animated.View>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 13.5,
                lineHeight: 17,
                color: colors.ink,
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
              }}
            >
              {b.criteria}
            </Text>
            <View
              style={{
                height: 4,
                borderRadius: 4,
                backgroundColor: colors.track,
                overflow: 'hidden',
                marginTop: 'auto',
              }}
            >
              <Animated.View
                style={[
                  {
                    width: `${Math.min(100, (100 * b.progress) / b.target)}%`,
                    height: '100%',
                    transformOrigin: 'left',
                    backgroundColor: b.earned ? colors.sage : '#B9BEAF',
                  },
                  anim(kf.grow, 1000),
                ]}
              />
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.accent }}>
              {b.earned ? 'Earned' : `${b.progress} of ${b.target}`}
            </Text>
          </View>
        ))}
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
                    fontSize: 14,
                    lineHeight: 18,
                    color: colors.ink,
                  }}
                >
                  {x.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11.5,
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
              fontSize: 10.5,
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
              borderRadius: 22,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
                Simulate next write failure
              </Text>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11.5,
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
            style={{ marginTop: 10, borderRadius: 22 }}
          />
        </>
      )}
      <Button
        title={isDemo ? 'Switch account' : 'Sign out'}
        variant="ghost"
        onPress={() => void logout()}
        style={{ marginTop: 10 }}
      />

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
                <Text style={[styles.label, { fontSize: 10 }]}>{r.status}</Text>
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
