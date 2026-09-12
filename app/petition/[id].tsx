import { QualificationChecklist } from '../../src/components/qualification';
import { useState } from 'react';
import { Linking, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { isDemo, useCommand, useSnapshot } from '../../src/data/provider';
import { identityLabels, verificationLabels } from '../../src/domain/model';
import { SignatureConsent, PrivateSignatureReceipt } from '../../src/components/signature-consent';
import {
  Button,
  Chip,
  Confirm,
  Empty,
  Field,
  Loading,
  Notice,
  Page,
  Panel,
  colors,
  styles,
} from '../../src/components/ui';
import { Progress, TopicArt, sharePetition } from '../../src/components/petition-card';
import { Entries, ManagerControl } from '../../src/components/entries';
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSnapshot();
  const mutation = useCommand();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('Overview');
  const [sign, setSign] = useState(false);
  const [notice, setNotice] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'question' | 'idea' | 'experience'>('question');
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const [statement, setStatement] = useState('');
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <Page back>
        <Notice error text={q.error.message} />
        <Button
          title="Retry"
          onPress={() => {
            void q.refetch();
          }}
        />
      </Page>
    );
  const s = q.data;
  const p = s.petitions.find((p) => p.id === id);
  if (!p)
    return (
      <Page back>
        <Empty title="Petition not found" body="This petition may be private or archived." />
      </Page>
    );
  const signed = s.signed.includes(p.id);
  const pendingSign = mutation.isPending && mutation.variables?.type === 'sign';
  return (
    <Page back>
      <View style={styles.between}>
        <View style={styles.row}>
          <Chip label={p.topic} />
          <Chip label={p.city} />
          <Chip label={p.status} />
        </View>
        <ManagerControl petition={p} profile={s.profile} />
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontSize: width < 600 ? 34 : 46, maxWidth: 900 }]}
      >
        {p.title}
      </Text>
      <Text style={[styles.body, { fontSize: 19, maxWidth: 900, lineHeight: 29 }]}>
        {p.summary}
      </Text>
      <Text style={styles.muted}>
        Started by {p.creator} · {s.communities.find((c) => c.id === p.communityId)?.name} ·{' '}
        {new Date(p.createdAt).toLocaleDateString()}
      </Text>
      {width < 900 && (
        <Button
          title={signed ? '✓ Signature recorded' : 'Sign this petition'}
          disabled={signed || mutation.isPending || p.status !== 'active'}
          onPress={() => {
            if (!s.profile) {
              router.push('/(auth)/sign-in');
              return;
            }
            setSign(true);
          }}
        />
      )}
      <View
        style={{
          flexDirection: width >= 900 ? 'row' : 'column',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, width: '100%', gap: 24 }}>
          <View style={{ borderRadius: 20, overflow: 'hidden' }}>
            <TopicArt topic={p.topic} large />
          </View>
          <View style={styles.row}>
            {[
              'Overview',
              'Legal requirements',
              'Updates',
              'Discussion',
              'History',
              'Endorsements',
              'Responses',
            ].map((t) => (
              <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} />
            ))}
          </View>
          <Panel>
            {tab === 'Legal requirements' && <QualificationChecklist petition={p} />}
            {tab === 'Overview' && (
              <>
                <Text style={styles.label}>THE CHANGE WE’RE ASKING FOR</Text>
                <Text style={styles.h2}>{p.action}</Text>
                <Text style={styles.muted}>To: {p.recipient}</Text>
                <View style={styles.divider} />
                <Text style={styles.h2}>Why it matters</Text>
                <Text style={styles.body}>{p.problem}</Text>
                <Text style={styles.h2}>Evidence & sources</Text>
                <Notice text="Creator-supplied sources. Swipe4Change does not fact-check these claims. Demo links are illustrative placeholders, not real evidence." />
                {p.evidence.length ? (
                  p.evidence.map((e) => (
                    <Button
                      key={e.url}
                      title={e.label}
                      variant="secondary"
                      icon="open-outline"
                      onPress={() => {
                        void Linking.openURL(e.url).catch(() =>
                          setNotice('Unable to open the source. Try again from a browser.'),
                        );
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.muted}>No supporting sources have been supplied yet.</Text>
                )}
                <Text style={styles.h2}>Milestones</Text>
                {[25, 50, 75, 100].map((n) => (
                  <Text key={n} style={styles.body}>
                    {p.count / p.goal >= n / 100 ? '✓' : '○'} {n}% of the signature goal ·{' '}
                    {Math.ceil((p.goal * n) / 100)} voices
                  </Text>
                ))}
                <Text style={styles.muted}>
                  Milestones describe signature progress, not verified policy outcomes.
                </Text>
              </>
            )}
            {tab === 'Updates' && (
              <>
                <Text style={styles.h2}>From the organizer</Text>
                <Entries entries={p.updates} empty="No updates yet" />
              </>
            )}
            {tab === 'History' && (
              <>
                <Notice text="Material edits keep their prior wording and explanation here. Signing rules cannot change after signatures exist." />
                <Entries entries={p.edits} empty="No edits yet" />
              </>
            )}
            {tab === 'Endorsements' && (
              <>
                <Text style={styles.h2}>Community support</Text>
                <Entries entries={p.endorsements} empty="No endorsements yet" />
                {s.profile &&
                  s.communities
                    .filter((c) => c.ownerId === s.profile?.id)
                    .map((c) => (
                      <Button
                        key={c.id}
                        title={`Endorse as ${c.name}`}
                        variant="secondary"
                        disabled={
                          mutation.isPending || p.endorsements.some((e) => e.author === c.name)
                        }
                        onPress={() =>
                          mutation.mutate(
                            { type: 'endorse', petitionId: p.id, communityId: c.id },
                            { onSuccess: () => setNotice('Community endorsement added.') },
                          )
                        }
                      />
                    ))}
              </>
            )}
            {tab === 'Responses' && (
              <>
                <Text style={styles.h2}>Responses from recipients</Text>
                <Notice text="Only a trusted verification process can assign verified status. In this demo, the verified example is entirely fictional." />
                {p.responses.length ? (
                  p.responses.map((r) => (
                    <View
                      key={r.id}
                      style={{
                        padding: 20,
                        borderRadius: 14,
                        backgroundColor: r.verification === 'verified' ? colors.pale : '#F5F5F1',
                        gap: 12,
                      }}
                    >
                      <Chip
                        label={
                          r.verification === 'verified'
                            ? isDemo || r.organization.includes('(fictional)')
                              ? 'VERIFIED · FICTIONAL SAMPLE'
                              : 'VERIFIED OFFICIAL RESPONSE'
                            : `${r.verification.toUpperCase()} · NOT AN OFFICIAL RESPONSE`
                        }
                      />
                      <Text style={styles.h3}>{r.organization}</Text>
                      <Text style={styles.body}>{r.body}</Text>
                      <Text style={styles.muted}>
                        {r.author} · {new Date(r.date).toLocaleDateString()}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No responses have been submitted.</Text>
                )}
              </>
            )}
            {tab === 'Discussion' && (
              <>
                <Text style={styles.h2}>A constructive conversation</Text>
                <Entries entries={p.discussion} empty="Start the conversation" />
                {s.profile ? (
                  <>
                    <View style={styles.row}>
                      {(['question', 'idea', 'experience'] as const).map((k) => (
                        <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
                      ))}
                    </View>
                    <Field
                      label="Your contribution"
                      multiline
                      value={body}
                      onChangeText={setBody}
                      placeholder="Share an idea, ask a question, or describe your experience."
                    />
                    <Button
                      title="Post contribution"
                      disabled={mutation.isPending || body.trim().length < 5}
                      onPress={() =>
                        mutation.mutate(
                          { type: 'discussion', petitionId: p.id, body, kind },
                          {
                            onSuccess: () => {
                              setBody('');
                              setNotice('Your contribution is posted.');
                            },
                          },
                        )
                      }
                    />
                  </>
                ) : (
                  <Button
                    title="Sign in to join the discussion"
                    onPress={() => router.push('/(auth)/sign-in')}
                  />
                )}
              </>
            )}
          </Panel>
        </View>
        <View style={{ width: width >= 900 ? 330 : '100%', gap: 20 }}>
          <Panel>
            <Text style={styles.label}>EVERY VOICE ADDS UP</Text>
            <Progress petition={p} />
            {!p.qualification?.details && (
              <Notice text="Signatures are paused until the organizer supplies all four legal requirements in Manage." />
            )}
            <Text style={styles.muted}>
              Deadline: {new Date(p.deadline + 'T12:00:00').toLocaleDateString()}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.h3}>{verificationLabels[p.verification]}</Text>
            <Text style={styles.muted}>
              {p.verification === 'custom'
                ? p.customRule
                : 'Eligibility is checked privately. Your contact details are never shown to the organizer or the public.'}
            </Text>
            <Text style={styles.muted}>
              Public choices: {p.identities.map((i) => identityLabels[i]).join(', ')}
            </Text>
            <Button
              title={
                pendingSign
                  ? 'Confirming signature…'
                  : signed
                    ? '✓ Signature recorded'
                    : p.status === 'draft'
                      ? 'Private draft'
                      : p.status !== 'active'
                        ? 'Signatures closed'
                        : 'Add my signature'
              }
              disabled={signed || mutation.isPending || p.status !== 'active'}
              onPress={() => {
                if (!s.profile) {
                  router.push('/(auth)/sign-in');
                  return;
                }
                setSign(true);
              }}
            />
            {pendingSign && (
              <Notice text="Awaiting confirmation. The progress change is temporary until the data layer accepts your signature." />
            )}
            <View style={styles.row}>
              <Button
                title={s.saved.includes(p.id) ? 'Saved' : 'Save'}
                icon="bookmark-outline"
                variant="secondary"
                disabled={mutation.isPending}
                onPress={() =>
                  s.profile
                    ? mutation.mutate({ type: 'save', petitionId: p.id })
                    : router.push('/(auth)/sign-in')
                }
              />
              <Button
                title="Share"
                icon="share-outline"
                variant="ghost"
                onPress={() => {
                  void sharePetition(p)
                    .then(setNotice)
                    .catch(() =>
                      setNotice('Sharing is unavailable. Copy this page’s browser address.'),
                    );
                }}
              />
            </View>
            {p.verification === 'community' &&
              s.profile &&
              !s.profile.joined.includes(p.communityId) && (
                <Button
                  title="Join the community"
                  variant="secondary"
                  onPress={() => mutation.mutate({ type: 'join', communityId: p.communityId })}
                />
              )}
            <Text style={{ fontSize: 12, color: colors.muted }}>
              One person. One signature. Your public identity is your choice.
            </Text>
          </Panel>
          {p.verification === 'custom' && s.profile && !s.customApprovals.includes(p.id) && (
            <Panel>
              <Text style={styles.h3}>Request eligibility review</Text>
              <Text style={styles.muted}>
                The organizer sees this statement and your abbreviated name. Do not include
                addresses, emails, or private evidence.
              </Text>
              <Field
                label="Non-sensitive eligibility statement"
                multiline
                value={statement}
                onChangeText={setStatement}
              />
              <Button
                title="Request review"
                disabled={mutation.isPending || statement.trim().length < 5}
                onPress={() =>
                  mutation.mutate(
                    { type: 'requestEligibility', petitionId: p.id, statement },
                    {
                      onSuccess: () => {
                        setStatement('');
                        setNotice(
                          'Review requested. An organizer can approve your eligibility in Manage.',
                        );
                      },
                    },
                  )
                }
              />
            </Panel>
          )}
          {signed && <PrivateSignatureReceipt key={s.profile?.id} petitionId={p.id} />}
          <Panel>
            <Text style={styles.h3}>Legal qualification</Text>
            <Text style={styles.body}>
              {p.recordedSignatures ?? 0} encrypted signatory records · {p.acceptedSignatures ?? 0}{' '}
              accepted for qualification
            </Text>
            <Text style={styles.muted}>
              Community support and fictional sample counts do not establish a statutory threshold
              or legal validity.
            </Text>
          </Panel>
          <Panel>
            <Text style={styles.h3}>Voices behind the progress</Text>
            {s.signatures
              .filter((x) => x.petitionId === p.id)
              .slice(-5)
              .map((x) => (
                <Text key={x.id} style={styles.body}>
                  ✓ {x.displayName}
                </Text>
              ))}
            <Text style={styles.muted}>
              {p.sampleCount > 0
                ? `${p.sampleCount} fictional sample supporters. New signatures show only the chosen public name.`
                : 'Your chosen public display name will appear here.'}
            </Text>
          </Panel>
          <Button
            title="Report a concern"
            variant="ghost"
            icon="flag-outline"
            onPress={() => (s.profile ? setReport(true) : router.push('/(auth)/sign-in'))}
          />
        </View>
      </View>
      {!!notice && <Notice text={notice} />}
      {mutation.error && <Notice error text={mutation.error.message} />}
      {sign && (
        <SignatureConsent
          petition={p}
          snapshot={s}
          onCancel={() => setSign(false)}
          onRecorded={() => {
            setSign(false);
            setNotice(
              'Your signature was recorded for review. This is not a certification of legal validity.',
            );
          }}
        />
      )}
      <Confirm
        visible={report}
        title="Report this petition"
        body="Describe your concern. Reports are visible only to you and trusted reviewers. Avoid including private information."
        pending={mutation.isPending}
        onCancel={() => setReport(false)}
        onConfirm={() =>
          mutation.mutate(
            { type: 'report', petitionId: p.id, reason },
            {
              onSuccess: () => {
                setReport(false);
                setReason('');
                setNotice('Report submitted. Follow its status or add an appeal from Profile.');
              },
            },
          )
        }
      >
        <Field label="Reason for reporting" multiline value={reason} onChangeText={setReason} />
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
    </Page>
  );
}
