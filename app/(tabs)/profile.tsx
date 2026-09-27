import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isDemo, localAdapter, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import {
  Button,
  Chip,
  Confirm,
  Field,
  Loading,
  Notice,
  Page,
  Panel,
  styles,
} from '../../src/components/ui';
import { Avatar, Stats } from '../../src/components/design-system';
import { ProfilePersonalization } from '../../src/components/profile-personalization';
import { RippleSummary } from '../../src/components/ripple';
import { CommunityCard, SectionHeader } from '../../src/components/civic-journey';
import { reachedMilestones } from '../../src/domain/rules';
import { rippleTotal } from '../../src/domain/ripple';
import { Grid } from '../../src/screens/feed';
export default function Profile() {
  const q = useSnapshot();
  const { adapter, signOut } = useBackend();
  const client = useQueryClient();
  const m = useCommand();
  const [settings, setSettings] = useState(false);
  const [filter, setFilter] = useState('Created');
  const [message, setMessage] = useState('');
  const [reset, setReset] = useState(false);
  const [appeal, setAppeal] = useState('');
  const [withdrawReport, setWithdrawReport] = useState<string | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (!q.data?.profile)
    return (
      <Page title="Your voice has a home here.">
        <Button
          title="Sign in or choose a demo account"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </Page>
    );
  const s = q.data;
  const p = s.profile!;
  const petitions = s.petitions.filter((x) =>
    filter === 'Created'
      ? x.ownerId === p.id || x.collaborators.includes(p.id)
      : filter === 'Signed'
        ? s.signed.includes(x.id)
        : filter === 'Volunteering'
          ? s.volunteering.some((v) => v.petitionId === x.id)
          : s.saved.includes(x.id),
  );
  async function logout() {
    try {
      await signOut();
      client.clear();
      router.replace('/(auth)/sign-in');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Sign-out failed.');
    }
  }
  return (
    // The identity panel below is the header; a Page title would only repeat the name above it.
    <Page>
      <Panel>
        <View style={[styles.row, { gap: 15, flexWrap: 'nowrap' }]}>
          <Avatar name={p.name} size={66} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text accessibilityRole="header" style={[styles.h2, { fontSize: 24, lineHeight: 27 }]}>
              {p.name}
            </Text>
            <Text style={styles.small}>
              {p.city} · {isDemo ? 'Fictional demo account' : 'Community member'}
            </Text>
          </View>
        </View>
        {!!p.bio && <Text style={styles.body}>{p.bio}</Text>}
        <Stats
          items={[
            {
              value: s.petitions.filter((x) => x.ownerId === p.id || x.collaborators.includes(p.id))
                .length,
              label: 'Started',
            },
            { value: s.signed.length, label: 'Signed' },
            { value: rippleTotal(s.ripple), label: 'Ripple' },
            { value: p.joined.length, label: 'Communities' },
          ]}
        />
        {p.badges.length > 0 && (
          <>
            <Text style={styles.label}>BADGES</Text>
            <View style={styles.row}>
              {p.badges.map((b) => (
                <Chip key={b} label={b} />
              ))}
            </View>
          </>
        )}
        <Button
          title="Sign out / switch account"
          variant="secondary"
          onPress={() => {
            void logout();
          }}
        />
      </Panel>
      <RippleSummary snapshot={s} />
      <SectionHeader
        title="Your participation"
        note={`${s.petitions.filter((x) => s.signed.includes(x.id) && reachedMilestones(x.count, x.goal).length > 0).length} supported petitions have reached a signature milestone. This does not establish a policy outcome.`}
      />
      <View style={styles.row}>
        {['Created', 'Signed', 'Saved', 'Volunteering'].map((x) => (
          <Chip key={x} label={x} selected={filter === x} onPress={() => setFilter(x)} />
        ))}
      </View>
      {petitions.length ? (
        <Grid petitions={petitions} snapshot={s} />
      ) : (
        <Notice
          text={
            filter === 'Volunteering'
              ? 'You have not offered to help with a petition yet. Organizers see your name and the roles you pick.'
              : filter === 'Saved'
                ? 'Nothing saved yet. Saving a petition sends its updates to your inbox.'
                : `No ${filter.toLowerCase()} petitions yet. Explore a petition or start your own.`
          }
        />
      )}
      <SectionHeader title="Your communities" />
      {s.communities
        .filter((c) => p.joined.includes(c.id))
        .map((c) => (
          <CommunityCard key={c.id} community={c} snapshot={s} />
        ))}
      <Panel>
        <View style={styles.between}>
          <Text style={styles.h2}>Your drafts</Text>
          <Chip label={`${s.drafts?.length ?? 0} private drafts`} />
        </View>
        <Text style={styles.muted}>
          An unfinished idea is welcome here. Only you can see these drafts.
        </Text>
        {(s.drafts ?? []).map((d) => (
          <View key={d.id} style={{ gap: 8 }}>
            <Text style={styles.h3}>{d.draft.title || 'Untitled idea'}</Text>
            <Text style={styles.muted}>
              Saved {new Date(d.updatedAt).toLocaleString()} · Step {d.step + 1} of 4
            </Text>
            <View style={styles.row}>
              <Button
                title={`Continue ${d.draft.title || 'untitled draft'}`}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/(tabs)/create', params: { draftId: d.id } })
                }
              />
              <Button title="Delete draft" variant="ghost" onPress={() => setDeleteDraft(d.id)} />
            </View>
          </View>
        ))}
        <Button
          title="Start a new draft"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: '/(tabs)/create', params: { draftId: 'new' } })}
        />
      </Panel>
      <Confirm
        visible={!!deleteDraft}
        title="Delete this private draft?"
        body="This removes the saved draft from your account."
        pending={m.isPending}
        onCancel={() => setDeleteDraft(null)}
        onConfirm={() => {
          if (deleteDraft)
            m.mutate(
              { type: 'deleteDraft', id: deleteDraft },
              { onSuccess: () => setDeleteDraft(null) },
            );
        }}
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
      <SectionHeader title="Privacy and preferences" />
      <Button
        title={settings ? 'Hide personal settings' : 'Edit profile appearance and interests'}
        variant="secondary"
        onPress={() => setSettings(!settings)}
      />
      {settings && <ProfilePersonalization key={p.id} snapshot={s} />}
      <Panel>
        <Text style={styles.h2}>Make this space yours</Text>
        <Text style={styles.muted}>Interests: {p.interests.join(', ') || 'Not selected'}</Text>
        <Button
          title="Edit interests and approximate location"
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />
        <Text style={styles.muted}>
          Email verification: {p.emailVerified ? 'approved' : 'not approved'}
          {isDemo ? ' (simulated)' : ''}. Location approval:{' '}
          {p.locationApproved ? 'approved' : 'not approved'}
          {isDemo ? ' (simulated)' : ''}. These private checks are separate from your public
          signature name.
        </Text>
      </Panel>
      {s.reports.length > 0 && (
        <Panel>
          <Text style={styles.h2}>Your reports & appeals</Text>
          {s.reports.map((r) => (
            <View key={r.id} style={{ gap: 12 }}>
              <Chip label={r.status} />
              <Text style={styles.body}>{r.reason}</Text>
              {r.appeal ? (
                <Text style={styles.muted}>Your appeal: {r.appeal}</Text>
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
                    disabled={m.isPending || appeal.trim().length < 5}
                    variant="secondary"
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
          ))}
          <Notice text="The local demo records reports and appeals but does not have a live moderation team. A report stays open until a trusted reviewer decides it; you can withdraw your own at any time. Production review requires trusted server-side administration." />
        </Panel>
      )}
      {isDemo && (
        <Panel>
          <Text style={styles.h2}>Demo controls</Text>
          <Text style={styles.muted}>
            Try a rejected write to see optimistic rollback. Or reset the fictional community to its
            starting state.
          </Text>
          <Button
            title="Simulate next write failure"
            variant="secondary"
            onPress={() => {
              localAdapter.simulateFailure();
              setMessage(
                'The next save, sign, or other write will fail once. Its optimistic change will be rolled back.',
              );
            }}
          />
          <Button
            title="Reset all local demo data"
            variant="ghost"
            onPress={() => setReset(true)}
          />
        </Panel>
      )}
      {!!message && <Notice text={message} />}
      {m.error && <Notice error text={m.error.message} />}
      <Confirm
        visible={!!withdrawReport}
        title="Withdraw this report?"
        body="The report and any appeal you added are deleted. Nobody reviews it further. You can report the petition again later."
        pending={m.isPending}
        onCancel={() => setWithdrawReport(null)}
        onConfirm={() => {
          if (withdrawReport)
            m.mutate(
              { type: 'withdrawReport', reportId: withdrawReport },
              { onSuccess: () => setWithdrawReport(null) },
            );
        }}
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
      <Confirm
        visible={reset}
        title="Reset this fictional community?"
        body="This removes locally created petitions, signatures, posts, and account preferences, then restores the sample data."
        onCancel={() => setReset(false)}
        onConfirm={() => {
          void adapter
            .reset()
            .then(() => {
              client.clear();
              setReset(false);
              router.replace('/(auth)/sign-in');
            })
            .catch(() => setMessage('Reset failed. Try again.'));
        }}
      />
    </Page>
  );
}
