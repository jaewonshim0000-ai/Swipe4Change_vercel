import { useEffect, useState } from 'react';
import { Linking, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { isDemo, useCommand, useSnapshot } from '../../src/data/provider';
import {
  Entry,
  VolunteerRole,
  deliveryMethodLabels,
  identityLabels,
  verificationLabels,
  volunteerRoleLabels,
  volunteerRoles,
} from '../../src/domain/model';
import { SignatureConsent, MySignature } from '../../src/components/signature-consent';
import { RipplePanel, rememberVia } from '../../src/components/ripple';
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
import { Entries, ManagerControl, entryRemover } from '../../src/components/entries';
import { milestones, reachedMilestones } from '../../src/domain/rules';
import { MilestoneNote, StickyActionBar } from '../../src/components/civic-journey';
import { findOffice, levelLabels } from '../../src/domain/recipients';
export default function Detail() {
  // `?sign=1` lets the Home deck's Support action land straight in the signing sheet.
  // `?via=` is a supporter's ripple code from the link they shared.
  const {
    id,
    sign: signParam,
    volunteer: volunteerParam,
    via,
  } = useLocalSearchParams<{
    id: string;
    sign?: string;
    volunteer?: string;
    via?: string;
  }>();
  const q = useSnapshot();
  const mutation = useCommand();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('Story');
  const [ctaEnd, setCtaEnd] = useState(0);
  const [pastCta, setPastCta] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [sign, setSign] = useState(signParam === '1');
  // `?volunteer=1` lets the Home deck's Volunteer action open the offer form directly.
  const [offering, setOffering] = useState(volunteerParam === '1');
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [helpNote, setHelpNote] = useState('');
  const [notice, setNotice] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'question' | 'idea' | 'experience'>('question');
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const [statement, setStatement] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [removing, setRemoving] = useState<{
    scope: 'discussion' | 'update' | 'response';
    entry: Entry;
  } | null>(null);
  useEffect(() => {
    if (via) void rememberVia(id, via);
  }, [id, via]);
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
  const myOffer = s.volunteering.find((v) => v.petitionId === p.id);
  const pendingSign = mutation.isPending && mutation.variables?.type === 'sign';
  return (
    <Page
      back
      onScroll={(event) => setPastCta(ctaEnd > 0 && event.nativeEvent.contentOffset.y > ctaEnd)}
      bottomBar={
        width < 900 && pastCta && !signed && !sign && p.status === 'active' ? (
          <StickyActionBar
            petition={p}
            onPress={() => (s.profile ? setSign(true) : router.push('/(auth)/sign-in'))}
          />
        ) : undefined
      }
    >
      {!!via && !signed && (
        <Notice text="Shared with you by someone who signed it. If you sign too, you join their ripple." />
      )}
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
        style={[
          styles.title,
          { maxWidth: 900 },
          width < 600
            ? { fontSize: 34, lineHeight: 36, letterSpacing: -1.4 }
            : { fontSize: 46, lineHeight: 50, letterSpacing: -1.4 },
        ]}
      >
        {p.title}
      </Text>
      <Text
        style={[styles.body, { maxWidth: 900 }, width >= 600 && { fontSize: 19, lineHeight: 29 }]}
      >
        {p.action}
      </Text>
      <Text style={styles.muted}>
        Started by {p.creator} · {s.communities.find((c) => c.id === p.communityId)?.name} ·{' '}
        {new Date(p.createdAt).toLocaleDateString()}
      </Text>
      <Text style={styles.body}>To: {p.recipient}</Text>
      <View style={{ maxWidth: 650, gap: 12 }}>
        <Progress petition={p} compact />
        <MilestoneNote petition={p} />
      </View>
      {width < 900 && (
        <View
          onLayout={(event) =>
            setCtaEnd(event.nativeEvent.layout.y + event.nativeEvent.layout.height + 100)
          }
        >
          <Button
            title={signed ? 'Signature recorded' : 'Review and sign'}
            disabled={signed || mutation.isPending || p.status !== 'active'}
            onPress={() => {
              if (!s.profile) {
                router.push('/(auth)/sign-in');
                return;
              }
              setSign(true);
            }}
          />
        </View>
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
            void sharePetition(p, s)
              .then(setNotice)
              .catch(() => setNotice('Sharing is unavailable. Copy this page’s browser address.'));
          }}
        />
      </View>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        Saving sends this petition’s updates to your inbox. So does signing it.
      </Text>
      <View
        style={{
          flexDirection: width >= 900 ? 'row' : 'column',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, width: '100%', gap: 24 }}>
          <View style={{ borderRadius: width < 600 ? 16 : 20, overflow: 'hidden' }}>
            <TopicArt topic={p.topic} large />
          </View>
          <View style={styles.row}>
            {['Story', 'Progress', 'Activity'].map((t) => (
              <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} />
            ))}
          </View>
          <Panel>
            {tab === 'Story' && (
              <>
                <Text style={styles.label}>THE CHANGE WE’RE ASKING FOR</Text>
                <Text style={styles.h2}>{p.action}</Text>
                <Text style={styles.muted}>To: {p.recipient}</Text>
                {(() => {
                  // Knowing which office decides a thing is most of the battle, so say so here
                  // rather than making the reader go and look it up.
                  const office = findOffice(p.recipient);
                  return office ? (
                    <>
                      <Text style={styles.small}>
                        {levelLabels[office.level]} level · usually publishes a response in about{' '}
                        {office.responseDays} days
                      </Text>
                      <Button
                        title="What this office controls"
                        variant="ghost"
                        icon="information-circle-outline"
                        onPress={() => router.push('/recipients')}
                      />
                    </>
                  ) : null;
                })()}
                <View style={styles.divider} />
                <Text style={styles.h2}>Why it matters</Text>
                <Text style={styles.body}>{p.problem}</Text>
                <Text style={styles.h2}>Evidence & sources</Text>
                <Text style={styles.small}>
                  {p.sampleCount > 0
                    ? 'Illustrative evidence · sample source links'
                    : 'Creator-supplied sources · independently review the claims'}
                </Text>
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
              </>
            )}
            {tab === 'Activity' && (
              <>
                <Text style={styles.h2}>From the organizer</Text>
                <Entries
                  entries={p.updates}
                  empty="No updates yet"
                  pending={mutation.isPending}
                  canRemove={entryRemover('update', s.profile, p)}
                  onRemove={(entry) => setRemoving({ scope: 'update', entry })}
                />
              </>
            )}
            {tab === 'Activity' && (
              <>
                <Text style={styles.h2}>A constructive conversation</Text>
                <Entries
                  entries={p.discussion}
                  empty="Start the conversation"
                  pending={mutation.isPending}
                  canRemove={entryRemover('discussion', s.profile, p)}
                  onRemove={(entry) => setRemoving({ scope: 'discussion', entry })}
                />
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
            {tab === 'Activity' && (
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
            {tab === 'Activity' && (
              <>
                <Notice text="Material edits keep their prior wording and explanation here. Signing rules cannot change after signatures exist." />
                <Entries entries={p.edits} empty="No edits yet" />
              </>
            )}
            {tab === 'Progress' && (
              <>
                <Text style={styles.h2}>Milestones</Text>
                {milestones.map((n) => (
                  <Text key={n} style={styles.body}>
                    {reachedMilestones(p.count, p.goal).includes(n) ? '✓' : '○'} {n}% of the
                    signature goal · {Math.ceil((p.goal * n) / 100)} voices
                  </Text>
                ))}
                <Text style={styles.muted}>
                  Milestones describe signature progress, not verified policy outcomes.
                </Text>
                {p.deliveries.length > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.h2}>Delivered</Text>
                    {p.deliveries.map((d) => (
                      <View key={d.id} style={{ gap: 4 }}>
                        <Text style={styles.body}>
                          Sent to {d.recipient} on {new Date(d.deliveredAt).toLocaleDateString()} by{' '}
                          {d.deliveredBy} · {deliveryMethodLabels[d.method]}
                        </Text>
                        <Text style={styles.muted}>
                          {d.signatureCount.toLocaleString()} signatures at the time of delivery.{' '}
                          {d.note}
                        </Text>
                        <Button
                          title="Read the document that was sent"
                          variant="secondary"
                          icon="document-text-outline"
                          onPress={() => router.push(`/packet/${p.id}?delivery=${d.id}`)}
                        />
                        {p.responses
                          .filter((r) => r.deliveryId === d.id)
                          .map((r) => (
                            <Text key={r.id} style={styles.small}>
                              Answered by {r.organization} on{' '}
                              {new Date(r.date).toLocaleDateString()}.
                            </Text>
                          ))}
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.small}>
                    Not yet delivered. The organizer records the hand-off here once this petition
                    reaches {p.recipient}.
                  </Text>
                )}

                <Text style={styles.h2}>Responses from recipients</Text>

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
                      {!r.removed && entryRemover('response', s.profile, p)(r) && (
                        <Button
                          title="Retract this response"
                          variant="ghost"
                          disabled={mutation.isPending}
                          onPress={() => setRemoving({ scope: 'response', entry: r })}
                        />
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No responses have been submitted.</Text>
                )}
              </>
            )}
          </Panel>
        </View>
        <View style={{ width: width >= 900 ? 330 : '100%', gap: 20 }}>
          <Panel>
            <Text style={styles.label}>EVERY VOICE ADDS UP</Text>
            <Progress petition={p} />
            {p.viaShares > 0 && (
              <Text style={styles.small}>
                {p.viaShares.toLocaleString()} signed because a supporter shared it
              </Text>
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
                        : 'Review and sign'
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
          <Panel>
            <Text style={styles.label}>MORE THAN A SIGNATURE</Text>
            <Text style={styles.h3}>
              {p.volunteerCount} {p.volunteerCount === 1 ? 'person has' : 'people have'} offered to
              help
            </Text>
            <Text style={styles.muted}>
              {p.sampleVolunteers > 0 ? `${p.sampleVolunteers} fictional sample volunteers. ` : ''}
              Organizers see your profile name and the roles you pick. Swipe4Change never collects
              or shows your contact details.
            </Text>
            {myOffer && !offering ? (
              <>
                <Notice
                  text={`You offered: ${myOffer.roles.map((r) => volunteerRoleLabels[r]).join(', ')}.`}
                />
                <View style={styles.row}>
                  <Button
                    title="Change my offer"
                    variant="secondary"
                    onPress={() => {
                      setRoles(myOffer.roles);
                      setHelpNote(myOffer.note);
                      setOffering(true);
                    }}
                  />
                  <Button
                    title="Step back"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onPress={() =>
                      mutation.mutate({
                        type: 'volunteer',
                        petitionId: p.id,
                        roles: [],
                        note: '',
                      })
                    }
                  />
                </View>
              </>
            ) : offering ? (
              <>
                <Text style={styles.muted}>Pick the help you can realistically give.</Text>
                <View style={styles.row}>
                  {volunteerRoles.map((r) => (
                    <Chip
                      key={r}
                      label={volunteerRoleLabels[r]}
                      selected={roles.includes(r)}
                      onPress={() =>
                        setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])
                      }
                    />
                  ))}
                </View>
                <Field
                  label="Anything the organizer should know (optional)"
                  multiline
                  value={helpNote}
                  onChangeText={setHelpNote}
                  placeholder="When you are free, skills you bring, questions you have…"
                />
                <Button
                  title={myOffer ? 'Update my offer' : 'Offer to help'}
                  disabled={mutation.isPending || roles.length === 0}
                  onPress={() =>
                    mutation.mutate(
                      { type: 'volunteer', petitionId: p.id, roles, note: helpNote },
                      {
                        onSuccess: () => {
                          setOffering(false);
                          setNotice('Your offer reached the organizers.');
                        },
                      },
                    )
                  }
                />
                <Button title="Cancel" variant="ghost" onPress={() => setOffering(false)} />
              </>
            ) : (
              <Button
                title="Volunteer"
                variant="secondary"
                icon="hand-left-outline"
                disabled={p.status !== 'active'}
                onPress={() => (s.profile ? setOffering(true) : router.push('/(auth)/sign-in'))}
              />
            )}
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
          <RipplePanel petition={p} snapshot={s} onMessage={setNotice} />
          {signed && (
            <>
              <MySignature key={s.profile?.id} petitionId={p.id} />
              <Panel>
                <Text style={styles.h3}>Change your mind</Text>
                <Text style={styles.muted}>
                  You can withdraw your signature at any time. It stops being counted, your public
                  name is removed from the supporter list, and your drawn signature is deleted.
                </Text>
                <Button
                  title="Withdraw my signature"
                  variant="ghost"
                  disabled={mutation.isPending}
                  onPress={() => setWithdraw(true)}
                />
              </Panel>
            </>
          )}
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
            setReceipt(true);
            setNotice('Your signature is recorded.');
          }}
        />
      )}
      <Confirm
        visible={receipt && signed}
        title="Your signature is recorded"
        body="Your voice has been added, and this petition’s updates will reach your inbox."
        confirmLabel="Back to the petition"
        onConfirm={() => setReceipt(false)}
        onCancel={() => setReceipt(false)}
      >
        <Progress petition={p} animateFrom={p.count - 1} />
        <MilestoneNote petition={p} />
        <Text style={styles.h3}>Now start a ripple</Text>
        <Text style={styles.small}>
          Share your link. Everyone who signs through it joins your ripple, and so does everyone
          they bring in. You will see the count grow, never the names.
        </Text>
        <Button
          title="Share my link"
          icon="share-outline"
          onPress={() => {
            void sharePetition(p, s)
              .then(setNotice)
              .catch(() => setNotice('Sharing is unavailable. Try again.'));
          }}
        />
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
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
      <Confirm
        visible={withdraw}
        title="Withdraw your signature?"
        body={`Your signature on “${p.title}” will stop being counted, your public name will be removed from the supporter list, and your drawn signature will be deleted. You can sign again later.`}
        pending={mutation.isPending}
        onCancel={() => setWithdraw(false)}
        onConfirm={() =>
          mutation.mutate(
            { type: 'withdraw', petitionId: p.id },
            {
              onSuccess: () => {
                setWithdraw(false);
                setNotice('Your signature was withdrawn and your drawn signature deleted.');
              },
            },
          )
        }
      >
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
      <Confirm
        visible={removing !== null}
        title="Remove this post?"
        body="The post is replaced with a visible note saying it was removed, so the thread stays honest. This cannot be undone."
        pending={mutation.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          mutation.mutate(
            {
              type: 'removeEntry',
              scope: removing.scope,
              entryId: removing.entry.id,
              petitionId: p.id,
            },
            {
              onSuccess: () => {
                setRemoving(null);
                setNotice('The post was removed.');
              },
            },
          )
        }
      >
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
    </Page>
  );
}
