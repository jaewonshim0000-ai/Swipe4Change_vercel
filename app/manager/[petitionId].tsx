import { CirculatorAffidavit } from '../../src/components/circulator-affidavit';
import { QualificationEditor, QualificationChecklist } from '../../src/components/qualification';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isDemo, useBackend, useCommand, useSnapshot } from '../../src/data/provider';
import { canManage } from '../../src/domain/rules';
import {
  Identity,
  Verification,
  identityLabels,
  identityModes,
  verificationLabels,
  verificationModes,
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
import { Progress } from '../../src/components/petition-card';
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
  const [update, setUpdate] = useState('');
  const [editedTitle, setTitle] = useState<string | null>(null);
  const title = editedTitle ?? p?.title ?? '';
  const [editedAction, setAction] = useState<string | null>(null);
  const action = editedAction ?? p?.action ?? '';
  const [reason, setReason] = useState('');
  const [editedVerification, setVerification] = useState<Verification | null>(null);
  const verification = editedVerification ?? p?.verification ?? 'account';
  const [editedIdentities, setIdentities] = useState<Identity[] | null>(null);
  const identities = editedIdentities ?? p?.identities ?? [];
  const [editedCustomRule, setCustomRule] = useState<string | null>(null);
  const customRule = editedCustomRule ?? p?.customRule ?? '';
  const [response, setResponse] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<'edit' | 'closed' | 'successful' | 'publish' | null>(null);
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
  function confirmAction() {
    if (confirm === 'edit')
      m.mutate(
        { type: 'edit', petitionId, title, action, reason, verification, identities, customRule },
        {
          onSuccess: () => {
            setConfirm(null);
            setReason('');
            setMessage('Changes saved with a public edit-history entry.');
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
              ? 'This petition already has signatures. Signing rules are locked. Material title and action changes will be published with the original wording and your explanation.'
              : 'Before the first signature, you can change signing rules. Every material edit is recorded publicly.'
          }
        />
        <Field label="Petition title" value={title} onChangeText={setTitle} />
        <Field label="Requested action" multiline value={action} onChangeText={setAction} />
        {p.count === 0 && (
          <>
            <Text style={styles.h3}>Private verification requirement</Text>
            <View style={styles.row}>
              {verificationModes.map((v) => (
                <Chip
                  key={v}
                  label={verificationLabels[v]}
                  selected={verification === v}
                  onPress={() => setVerification(v)}
                />
              ))}
            </View>
            {verification === 'custom' && (
              <Field
                label="Custom eligibility rule"
                value={customRule}
                onChangeText={setCustomRule}
                multiline
              />
            )}
            <Text style={styles.h3}>Allowed public identities</Text>
            <View style={styles.row}>
              {identityModes.map((i) => (
                <Chip
                  key={i}
                  label={identityLabels[i]}
                  selected={identities.includes(i)}
                  onPress={() =>
                    setIdentities(
                      identities.includes(i)
                        ? identities.filter((x) => x !== i)
                        : [...identities, i],
                    )
                  }
                />
              ))}
            </View>
          </>
        )}
        <Field
          label="Public explanation for this edit"
          multiline
          value={reason}
          onChangeText={setReason}
        />
        <Button
          title="Review material changes"
          disabled={m.isPending || reason.trim().length < 5}
          onPress={() => setConfirm('edit')}
        />
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
              { type: 'response', petitionId, body: response, organization },
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
      {petition.status === 'active' && (
        <Panel>
          <Text style={styles.h2}>Close this chapter</Text>
          <Text style={styles.muted}>
            Closing stops new signatures. Marking success is your report of an outcome, not
            independent verification.
          </Text>
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
        </Panel>
      )}
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
            ? `New title: ${title}\nNew action: ${action}\nExplanation: ${reason}\nThe previous wording remains in public history.`
            : confirm === 'publish'
              ? 'This petition and its signing rules will be visible to the community.'
              : `The petition will be marked ${confirm}. New signatures will stop. This change will appear in edit history.`
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
