import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { isDemo, useBackend, useCommand } from '../data/provider';
import { Petition, Snapshot, Identity, identityLabels, verificationLabels } from '../domain/model';
import { CheckRow, OptionRow, SummaryRows } from './design-system';
import { publicName, signingStatus } from '../domain/rules';
import { SignaturePoint, SignatureReceipt, petitionDisclosure } from '../domain/signature-record';
import { SignaturePad } from './signature-pad';
import { forgetVia, recallVia } from './ripple';
import { Button, Confirm, Notice, Panel, colors, fonts, styles, tokens } from './ui';

const titles = ['Read what you’re signing', 'Choose how you appear', 'Sign it'];

export function SignatureConsent({
  petition,
  snapshot,
  onCancel,
  onRecorded,
}: {
  petition: Petition;
  snapshot: Snapshot;
  onCancel: () => void;
  onRecorded: () => void;
}) {
  const command = useCommand();
  // Keep the text that was opened, even when background queries refresh the petition.
  const [disclosure] = useState(() => petitionDisclosure(petition));
  const [identity, setIdentity] = useState<Identity>(
    petition.identities.includes('anonymous') ? 'anonymous' : petition.identities[0],
  );
  const [signature, setSignature] = useState<SignaturePoint[]>([]);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const eligibility = signingStatus(petition, snapshot, identity);
  const drawn = signature.length >= 8;
  async function submit() {
    setError('');
    try {
      // The share link this person arrived through, if any, credits whoever sent it.
      const via = await recallVia(petition.id);
      await command.mutateAsync({
        type: 'sign',
        petitionId: petition.id,
        identity,
        submission: { disclosure, signature, consent: true },
        ...(via ? { via } : {}),
      });
      void forgetVia(petition.id);
      onRecorded();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Your signature could not be recorded. Please try again.',
      );
    }
  }
  return (
    <Confirm
      visible
      contentKey={step}
      title={titles[step]}
      confirmLabel={step === 2 ? 'Confirm my signature' : 'Continue'}
      confirmDisabled={step === 0 ? !!eligibility.message : step === 2 ? !consent || !drawn : false}
      body={`Step ${step + 1} of 3`}
      pending={command.isPending}
      onCancel={onCancel}
      onConfirm={() => (step < 2 ? setStep(step + 1) : void submit())}
    >
      {step > 0 && (
        <Button
          title="Previous step"
          variant="ghost"
          disabled={command.isPending}
          onPress={() => setStep(step - 1)}
        />
      )}
      {step === 0 && (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.canvas,
              borderRadius: tokens.radius,
              padding: 18,
              gap: 12,
            }}
          >
            <Text style={styles.label}>PETITION TEXT · CREATOR SUPPLIED</Text>
            <Text style={[styles.h3, { fontFamily: fonts.heading }]}>{disclosure.title}</Text>
            <Text style={[styles.body, { fontSize: 14, lineHeight: 23 }]}>
              {disclosure.fullText}
            </Text>
          </View>
          <SummaryRows
            rows={[
              { label: 'Addressed to', value: disclosure.recipient },
              { label: 'Location', value: disclosure.approximateLocation },
              { label: 'Deadline', value: disclosure.deadline },
              { label: 'Who can sign', value: verificationLabels[petition.verification] },
            ]}
          />
          {eligibility.message ? (
            <Notice error text={eligibility.message} />
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.small}>
              ✓ You can sign this petition.{isDemo ? ' Eligibility is simulated in the demo.' : ''}
            </Text>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <Text style={styles.small}>
            Your account always owns the signature privately. This only changes the public supporter
            list.
          </Text>
          {petition.identities.map((i) => (
            <OptionRow
              key={i}
              label={publicName(snapshot.profile?.name ?? '', i)}
              note={`${identityLabels[i]} · ${identityNotes[i]}`}
              selected={identity === i}
              onPress={() => setIdentity(i)}
            />
          ))}
        </>
      )}
      {step === 2 && (
        <>
          <SignaturePad value={signature} onChange={setSignature} />
          <Text style={styles.micro}>
            Only you can see your drawn signature. Organizers and the public see “
            {publicName(snapshot.profile?.name ?? '', identity)}”.
          </Text>
          <CheckRow
            label="I read the full text and I’m signing it as myself."
            checked={consent}
            onPress={() => setConsent(!consent)}
          />
          {isDemo && (
            <Text style={styles.micro}>This demo signature is not filed with any government.</Text>
          )}
        </>
      )}
      {!!error && <Notice error text={error} />}
    </Confirm>
  );
}

/** What each public identity mode actually shows, in the words a signer needs at the moment. */
const identityNotes: Record<Identity, string> = {
  full_name:
    'Your full profile name appears on the public supporter list and in any packet the organizer delivers.',
  first_name_last_initial:
    'Shown as your first name and last initial, for example “Maya C.”, everywhere the supporter list appears.',
  anonymous:
    'Counted publicly as an anonymous supporter and never named. You can still withdraw it later.',
};

/** Your own signature and the exact text you signed. Nobody else can open this. */
export function MySignature({ petitionId }: { petitionId: string }) {
  const { adapter } = useBackend();
  const [receipt, setReceipt] = useState<SignatureReceipt | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    adapter
      .receipt(petitionId)
      .then((value) => active && setReceipt(value))
      .catch(() => active && setError('Unable to load your signature. Reopen this petition.'));
    return () => {
      active = false;
    };
  }, [adapter, petitionId]);
  if (error) return <Notice error text={error} />;
  if (!receipt) return null;
  return (
    <Panel>
      <Text style={styles.h3}>Your signature</Text>
      <SignaturePad value={receipt.signature} readonly onChange={() => {}} />
      <Text style={styles.micro}>
        Signed {new Date(receipt.signedAt).toLocaleString()}. Only you can see this. It stays
        attached to the text you read, even if the organizer revises the petition.
      </Text>
      <Button
        title={expanded ? 'Hide the text I signed' : 'View the text I signed'}
        variant="secondary"
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <Text style={styles.h3}>{receipt.disclosure.title}</Text>
          <Text style={styles.body}>{receipt.disclosure.fullText}</Text>
          <Text style={styles.muted}>To: {receipt.disclosure.recipient}</Text>
        </>
      )}
    </Panel>
  );
}
