import { CirculatorAffidavit } from '../../src/components/circulator-affidavit';
import { QualificationEditor, QualificationChecklist } from '../../src/components/qualification';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isDemo, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { canManage, changedFields, describeEdit, evidenceSchema } from '../../src/domain/rules';
import {
  Draft,
  EditPatch,
  EditableField,
  Identity,
  Verification,
  fieldLabels,
  identityLabels,
  identityModes,
  verificationLabels,
  verificationModes,
  volunteerRoleLabels,
  deliveryMethods,
  deliveryMethodLabels,
} from '../../src/domain/model';
import { demoIds } from '../../src/data/seed';
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
import { Entries } from '../../src/components/entries';
import { SummaryRows } from '../../src/components/design-system';
import { Progress } from '../../src/components/petition-card';
import { ResponseCheckEditor } from '../../src/components/response-comparison';
export default function Manager() {
  const { petitionId } = useLocalSearchParams<{ petitionId: string }>();
  const q = useSnapshot();
  const { adapter } = useBackend();
  const m = useCommand();
  const p = q.data?.petitions.find((p) => p.id === petitionId);
  const allowed = p && canManage(p, q.data?.profile ?? null);
  const requests = useQuery({
    queryKey: ['requests', petitionId],
    queryFn: () => adapter.requests(petitionId),
    enabled: !!allowed,
  });
  const volunteers = useQuery({
    queryKey: ['volunteers', petitionId],
    queryFn: () => adapter.volunteers(petitionId),
    enabled: !!allowed,
  });
  const [method, setMethod] = useState<(typeof deliveryMethods)[number]>('email');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [update, setUpdate] = useState('');
  const [reason, setReason] = useState('');
  // One patch of pending revisions rather than a state hook per field, so every editable field
  // of a published petition can be revised through the same validated path.
  const [edited, setEdited] = useState<EditPatch>({});
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [response, setResponse] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<
    'edit' | 'closed' | 'successful' | 'archived' | 'publish' | null
  >(null);
  if (q.isPending) return <Loading />;
  if (!p || !allowed)
    return (
      <Page back title="Organizer access required">
        <Notice
          error
          text="Only the owner or an authorized collaborator can manage this petition."
        />
      </Page>
    );
  const petition = p;
  const value = <K extends EditableField>(key: K): Draft[K] =>
    (edited[key] ?? petition[key]) as Draft[K];
  const set = <K extends EditableField>(key: K, next: Draft[K]) =>
    setEdited((current) => ({ ...current, [key]: next }));
  const changed = changedFields(petition, edited);
  const preview = { ...petition, ...edited } as Draft;
  function confirmAction() {
    if (confirm === 'edit')
      m.mutate(
        { type: 'edit', petitionId, patch: edited, reason },
        {
          onSuccess: () => {
            setConfirm(null);
            setReason('');
            setEdited({});
            setMessage('Changes saved with a public edit-history entry. Signers were notified.');
          },
        },
      );
    else if (confirm === 'publish')
      m.mutate(
        { type: 'publish', petitionId },
        {
          onSuccess: () => {
            setConfirm(null);
            setMessage('Your petition is now public.');
          },
        },
      );
    else if (confirm)
      m.mutate(
        { type: 'close', petitionId, status: confirm },
        {
          onSuccess: () => {
            setConfirm(null);
            setMessage('Petition status updated with a public history entry.');
          },
        },
      );
  }
  return (
    <Page back title="Keep the momentum going." subtitle={p.title} eyebrow="ORGANIZER WORKSPACE">
      <Panel>
        <View style={styles.between}>
          <Text style={styles.h2}>Your petition at a glance</Text>
          <Chip label={p.status} />
        </View>
        <Progress petition={p} />
        <Text style={styles.muted}>
          {p.updates.length} updates · {p.discussion.length} discussion posts ·{' '}
          {p.endorsements.length} endorsements
        </Text>
        {p.status === 'draft' && (
          <Button title="Publish saved draft" onPress={() => setConfirm('publish')} />
        )}
      </Panel>
      <Panel>
        <Text style={styles.h2}>Send it to the recipient</Text>
        <Text style={styles.muted}>
          A petition nobody sends is a dead end. Read the exact document that goes to {p.recipient},
          then record when and how you sent it. The packet freezes the signature count and the
          public names at that moment, so the record says what was actually sent.
        </Text>
        <Button
          title="Preview the delivery packet"
          icon="document-text-outline"
          variant="secondary"
          onPress={() => router.push(`/packet/${p.id}`)}
        />
        {p.deliveries.length > 0 &&
          p.deliveries.map((d) => (
            <View key={d.id} style={{ gap: 4 }}>
              <Text style={styles.h3}>
                {deliveryMethodLabels[d.method]} · {new Date(d.deliveredAt).toLocaleDateString()}
              </Text>
              <SummaryRows
                rows={[
                  { label: 'Sent to', value: d.recipient },
                  { label: 'Signatures at the time', value: d.signatureCount.toLocaleString() },
                  { label: 'Sent by', value: d.deliveredBy },
                  { label: 'Where it went', value: d.note },
                ]}
              />
              <Button
                title="Open the delivered packet"
                variant="ghost"
                onPress={() => router.push(`/packet/${p.id}?delivery=${d.id}`)}
              />
              <View style={styles.divider} />
            </View>
          ))}
        {p.status === 'draft' ? (
          <Notice text="Publish the petition before recording a delivery." />
        ) : (
          <>
            <Text style={styles.label}>HOW DID YOU SEND IT?</Text>
            <View style={styles.row}>
              {deliveryMethods.map((x) => (
                <Chip
                  key={x}
                  label={deliveryMethodLabels[x]}
                  selected={method === x}
                  onPress={() => setMethod(x)}
                />
              ))}
            </View>
            <Field
              label="Where exactly did it go?"
              multiline
              value={deliveryNote}
              onChangeText={setDeliveryNote}
              placeholder="publicworks@riverton.example, reference PW-2026-114"
            />
            <Button
              title="Record this delivery"
              disabled={m.isPending || deliveryNote.trim().length < 5}
              onPress={() =>
                m.mutate(
                  { type: 'deliver', petitionId: p.id, method, note: deliveryNote },
                  {
                    onSuccess: () => {
                      setDeliveryNote('');
                      setMessage('Delivery recorded. Everyone following this petition was told.');
                    },
                  },
                )
              }
            />
          </>
        )}
      </Panel>
      <Panel>
        <Text style={styles.h2}>People offering help</Text>
        <Text style={styles.muted}>
          {p.sampleVolunteers > 0
            ? `${p.sampleVolunteers} fictional sample volunteers are included in the count on the petition page. `
            : ''}
          Volunteers chose to introduce themselves to you. You see a name, the roles they picked and
          their note — never an email address, phone number or address.
        </Text>
        {volunteers.isPending ? (
          <Text style={styles.muted}>Loading offers…</Text>
        ) : volunteers.error ? (
          <Notice error text={volunteers.error.message} />
        ) : volunteers.data?.length ? (
          volunteers.data.map((v) => (
            <View key={v.id} style={{ gap: 4 }}>
              <Text style={styles.h3}>{v.name}</Text>
              <Text style={styles.muted}>
                {v.roles.map((r) => volunteerRoleLabels[r]).join(' · ')} ·{' '}
                {new Date(v.date).toLocaleDateString()}
              </Text>
              {!!v.note && <Text style={styles.body}>{v.note}</Text>}
              <View style={styles.divider} />
            </View>
          ))
        ) : (
          <Text style={styles.muted}>
            No one has offered yet. An organizer update asking for specific help is the usual
            prompt.
          </Text>
        )}
        <Notice text="Swipe4Change has no volunteer messaging channel. Coordinate through a community post or an organizer update so the conversation stays visible to everyone involved." />
      </Panel>
      <QualificationChecklist petition={p} />
      <QualificationEditor key={p.id} petition={p} />
      {q.data?.profile && (
        <CirculatorAffidavit
          key={q.data.profile.id}
          ownerId={q.data.profile.id}
          petition={p}
          signatures={q.data.signatures.filter((record) => record.petitionId === p.id)}
        />
      )}
      {!!message && <Notice text={message} />}
      {m.error && <Notice error text={m.error.message} />}
      <Panel>
        <Text style={styles.h2}>Share an update</Text>
        <Field label="What changed?" multiline value={update} onChangeText={setUpdate} />
        <Button
          title="Post organizer update"
          disabled={m.isPending || update.trim().length < 5}
          onPress={() =>
            m.mutate(
              { type: 'update', petitionId, body: update },
              {
                onSuccess: () => {
                  setUpdate('');
                  setMessage('Your update is live.');
                },
              },
            )
          }
        />
        <Entries entries={p.updates} empty="Your first update belongs here" />
      </Panel>
      <Panel>
        <Text style={styles.h2}>Edit transparently</Text>
        <Notice
          text={
            p.count > 0
              ? 'This petition already has signatures, so signing rules are locked. Every other field can still be revised: the original wording, your explanation, and the change are published in public history, and everyone who signed or saved it is notified. Topic and community cannot change, because they define the audience this petition was signed into.'
              : 'Before the first signature you can also change signing rules. Every material edit is recorded publicly. Topic and community are fixed after publishing.'
          }
        />
        <Field
          label="Petition title"
          value={value('title')}
          onChangeText={(v) => set('title', v)}
        />
        <Field
          label="One-sentence summary"
          multiline
          value={value('summary')}
          onChangeText={(v) => set('summary', v)}
        />
        <Field
          label="The problem"
          multiline
          value={value('problem')}
          onChangeText={(v) => set('problem', v)}
        />
        <Field
          label="Requested action"
          multiline
          value={value('action')}
          onChangeText={(v) => set('action', v)}
        />
        <Field
          label="Intended recipient"
          value={value('recipient')}
          onChangeText={(v) => set('recipient', v)}
        />
        <Field
          label="Approximate location (city, state)"
          value={value('city')}
          onChangeText={(v) => set('city', v)}
        />
        <Field
          label="Signature goal"
          keyboardType="number-pad"
          value={String(value('goal'))}
          onChangeText={(v) => set('goal', Number(v.replace(/[^0-9]/g, '')) || 0)}
        />
        <Field
          label="Deadline (YYYY-MM-DD)"
          value={value('deadline')}
          onChangeText={(v) => set('deadline', v)}
        />
        <Text style={styles.h3}>Evidence & sources</Text>
        <Notice text="Sources are supplied by you and are not fact-checked by Swipe4Change. Adding or removing one is recorded in public edit history." />
        {value('evidence').map((e, i) => (
          <View key={`${e.url}-${i}`} style={styles.between}>
            <Text style={[styles.muted, { flex: 1 }]}>{e.label}</Text>
            <Button
              title={`Remove source ${i + 1}`}
              variant="ghost"
              onPress={() =>
                set(
                  'evidence',
                  value('evidence').filter((_, n) => n !== i),
                )
              }
            />
          </View>
        ))}
        <Field label="Source label" value={sourceLabel} onChangeText={setSourceLabel} />
        <Field
          label="Source HTTPS URL"
          value={sourceUrl}
          onChangeText={setSourceUrl}
          autoCapitalize="none"
        />
        <Button
          title="Add supplied source"
          variant="secondary"
          onPress={() => {
            try {
              set('evidence', [
                ...value('evidence'),
                ...evidenceSchema.parse([{ label: sourceLabel, url: sourceUrl }]),
              ]);
              setSourceLabel('');
              setSourceUrl('');
              setSourceError('');
            } catch {
              setSourceError('Enter a descriptive label and a valid HTTPS URL.');
            }
          }}
        />
        {!!sourceError && <Notice error text={sourceError} />}
        {p.count === 0 && (
          <>
            <Text style={styles.h3}>Private verification requirement</Text>
            <View style={styles.row}>
              {verificationModes.map((v) => (
                <Chip
                  key={v}
                  label={verificationLabels[v]}
                  selected={value('verification') === v}
                  onPress={() => set('verification', v as Verification)}
                />
              ))}
            </View>
            {value('verification') === 'custom' && (
              <Field
                label="Custom eligibility rule"
                value={value('customRule')}
                onChangeText={(v) => set('customRule', v)}
                multiline
              />
            )}
            <Text style={styles.h3}>Allowed public identities</Text>
            <View style={styles.row}>
              {identityModes.map((i) => (
                <Chip
                  key={i}
                  label={identityLabels[i]}
                  selected={value('identities').includes(i)}
                  onPress={() =>
                    set(
                      'identities',
                      value('identities').includes(i)
                        ? value('identities').filter((x: Identity) => x !== i)
                        : [...value('identities'), i],
                    )
                  }
                />
              ))}
            </View>
          </>
        )}
        <Text style={styles.muted}>
          {changed.length
            ? `Pending changes: ${changed.map((f) => fieldLabels[f]).join(', ')}.`
            : 'No pending changes.'}
        </Text>
        <Field
          label="Public explanation for this edit"
          multiline
          value={reason}
          onChangeText={setReason}
        />
        <View style={styles.row}>
          <Button
            title="Review material changes"
            disabled={m.isPending || reason.trim().length < 5 || changed.length === 0}
            onPress={() => setConfirm('edit')}
          />
          {changed.length > 0 && (
            <Button title="Discard pending changes" variant="ghost" onPress={() => setEdited({})} />
          )}
        </View>
        <Entries entries={p.edits} empty="No changes recorded" />
      </Panel>
      {p.verification === 'custom' && (
        <Panel>
          <Text style={styles.h2}>Eligibility requests</Text>
          <Notice text="Review only the stated custom criterion. You cannot sign for another person. Approval permits the user to sign privately in any allowed public identity mode." />
          {requests.error && <Notice error text={requests.error.message} />}
          {requests.data?.length ? (
            requests.data.map((r) => (
              <View key={r.id} style={{ gap: 12 }}>
                <Text style={styles.h3}>
                  {r.name} · {r.status}
                </Text>
                <Text style={styles.body}>{r.statement}</Text>
                {r.status === 'pending' && (
                  <View style={styles.row}>
                    <Button
                      title={`Approve ${r.name}`}
                      disabled={m.isPending}
                      onPress={() =>
                        m.mutate({
                          type: 'reviewEligibility',
                          petitionId,
                          requestId: r.id,
                          approved: true,
                        })
                      }
                    />
                    <Button
                      title={`Decline ${r.name}`}
                      variant="secondary"
                      disabled={m.isPending}
                      onPress={() =>
                        m.mutate({
                          type: 'reviewEligibility',
                          petitionId,
                          requestId: r.id,
                          approved: false,
                        })
                      }
                    />
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No eligibility requests yet.</Text>
          )}
        </Panel>
      )}
      <Panel>
        <Text style={styles.h2}>A response worth preserving</Text>
        <Notice text="Record a supplied response as unverified. Organizers cannot grant official verification. A trusted administrator must independently verify the respondent before official styling is enabled." />
        <Field
          label="Responding organization"
          value={organization}
          onChangeText={setOrganization}
        />
        <Field label="Supplied response" multiline value={response} onChangeText={setResponse} />
        <Button
          title="Record unverified response"
          disabled={m.isPending || response.trim().length < 5 || organization.trim().length < 5}
          variant="secondary"
          onPress={() =>
            m.mutate(
              {
                type: 'response',
                petitionId,
                body: response,
                organization,
                // A response answers the most recent hand-off, when there is one to answer.
                ...(p.deliveries[0] ? { deliveryId: p.deliveries[0].id } : {}),
              },
              {
                onSuccess: () => {
                  setResponse('');
                  setOrganization('');
                  setMessage('Response recorded with an explicit unverified label.');
                },
              },
            )
          }
        />
      </Panel>
      <ResponseCheckEditor petition={p} />
      {isDemo && q.data?.profile?.id === p.ownerId && (
        <Panel>
          <Text style={styles.h2}>Work together</Text>
          <Text style={styles.muted}>
            Collaborators can edit and post updates. They cannot change signatures or award
            verification.
          </Text>
          {Object.entries(demoIds)
            .filter(([, id]) => id !== q.data?.profile?.id)
            .map(([name, id]) => (
              <Button
                key={id}
                title={
                  p.collaborators.includes(id)
                    ? `${name} is a collaborator`
                    : `Add ${name} as collaborator`
                }
                variant="secondary"
                disabled={m.isPending || p.collaborators.includes(id)}
                onPress={() => m.mutate({ type: 'collaborator', petitionId, profileId: id })}
              />
            ))}
        </Panel>
      )}
      <Panel>
        <Text style={styles.h2}>Close this chapter</Text>
        <Text style={styles.muted}>
          Closing stops new signatures. Marking success is your report of an outcome, not
          independent verification. Everyone who signed or saved this petition is notified.
        </Text>
        {petition.status === 'active' ? (
          <View style={styles.row}>
            <Button
              title="Close petition"
              variant="secondary"
              onPress={() => setConfirm('closed')}
            />
            <Button
              title="Mark successful"
              variant="secondary"
              onPress={() => setConfirm('successful')}
            />
          </View>
        ) : (
          <Text style={styles.muted}>This petition is {petition.status}.</Text>
        )}
        {petition.ownerId === q.data?.profile?.id &&
          ['draft', 'closed', 'successful'].includes(petition.status) && (
            <>
              <Notice text="Archiving removes this petition from every feed, search result and profile, including for people who signed it. Close it publicly first so its supporters know why." />
              <Button
                title="Archive permanently"
                variant="secondary"
                onPress={() => setConfirm('archived')}
              />
            </>
          )}
      </Panel>
      <Confirm
        visible={confirm !== null}
        title={
          confirm === 'edit'
            ? 'Publish a material edit?'
            : confirm === 'publish'
              ? 'Publish this draft?'
              : 'Change petition status?'
        }
        body={
          confirm === 'edit'
            ? `${describeEdit(petition, preview, changed)}\n\nExplanation: ${reason}\n\nThe previous wording remains in public history and everyone who signed or saved this petition is notified.`
            : confirm === 'publish'
              ? 'This petition and its signing rules will be visible to the community.'
              : confirm === 'archived'
                ? 'This petition will be removed from every feed, search result and profile, including for people who signed it. Their private signature records are kept. This cannot be undone here.'
                : `The petition will be marked ${confirm}. New signatures will stop, this change will appear in edit history, and its supporters will be notified.`
        }
        onCancel={() => setConfirm(null)}
        onConfirm={confirmAction}
        pending={m.isPending}
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
    </Page>
  );
}
