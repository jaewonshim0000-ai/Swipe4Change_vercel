import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isDemo, useBackend, useCommand } from '../data/provider';
import { Petition, Snapshot, Identity, identityLabels, verificationLabels } from '../domain/model';
import { CheckRow, OptionRow, SummaryRows } from './design-system';
import { publicName, signingStatus } from '../domain/rules';
import { Signatory, EncryptedVault } from '../domain/signatory';
import { SignatureReceipt, petitionDisclosure } from '../domain/signature-record';
import { decryptSignatory, encryptReceipt } from '../security/signature-vault';
import { SignaturePad } from './signature-pad';
import { Button, Chip, Confirm, Field, Notice, Panel, colors, fonts, styles, tokens } from './ui';

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
  const { adapter } = useBackend();
  const command = useCommand();
  // Keep the text that was opened, even when background queries refresh the petition.
  const [disclosure] = useState(() => petitionDisclosure(petition));
  const [identity, setIdentity] = useState<Identity>(
    petition.identities.includes('anonymous') ? 'anonymous' : petition.identities[0],
  );
  const [envelope, setEnvelope] = useState<EncryptedVault | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [key, setKey] = useState('');
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const lock = useCallback(() => {
    epoch.current += 1;
    setKey('');
    setSignatory(null);
    setConsent(false);
  }, []);
  useFocusEffect(useCallback(() => () => lock(), [lock]));
  useEffect(() => {
    let active = true;
    void adapter
      .vault()
      .then((value) => {
        if (active) {
          setEnvelope(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError('Could not load your vault. Close and reopen this form to retry.');
      });
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lock();
    });
    return () => {
      active = false;
      epoch.current += 1;
      listener.remove();
    };
  }, [adapter, lock]);
  useEffect(() => {
    if (!key && !signatory) return;
    const timer = setTimeout(lock, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [key, signatory, lock]);
  const eligibility = signingStatus(petition, snapshot, identity);
  const eligible = eligibility.message;
  async function unlock() {
    if (!envelope || !snapshot.profile) return;
    const operation = epoch.current;
    setBusy(true);
    setError('');
    try {
      const value = await decryptSignatory(snapshot.profile.id, key, envelope);
      if (operation === epoch.current) setSignatory(value);
    } catch (e) {
      if (operation === epoch.current)
        setError(e instanceof Error ? e.message : 'Could not unlock your vault.');
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setError('');
    if (eligible) {
      setError(eligible);
      return;
    }
    if (!signatory || !snapshot.profile || !consent) {
      setError(
        'Unlock your signature profile, review the full text, and confirm your details before signing.',
      );
      return;
    }
    const operation = epoch.current;
    setBusy(true);
    try {
      const encrypted = await encryptReceipt(snapshot.profile.id, key, {
        disclosure,
        signatory,
        confirmedAt: new Date().toISOString(),
      });
      if (operation !== epoch.current) return;
      // The recovery key and decrypted profile never enter the mutation cache or server request.
      await command.mutateAsync({
        type: 'sign',
        petitionId: petition.id,
        identity,
        submission: { disclosure, envelope: encrypted, consent: true },
      });
      lock();
      onRecorded();
    } catch (e) {
      if (operation === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Your signature could not be recorded. Please try again.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Confirm
      visible
      contentKey={step}
      title={
        [
          'Review the requirements',
          'Check your eligibility',
          'Choose your public identity',
          'Confirm your signature',
        ][step]
      }
      confirmLabel={step === 3 ? 'Confirm my signature' : 'Continue'}
      confirmDisabled={
        step === 1
          ? !!eligible || !signatory
          : step === 3
            ? !consent || !!eligible || !signatory
            : false
      }
      body="Read the complete text before giving consent. Your private signature record is encrypted separately from your public display name."
      pending={busy || command.isPending}
      onCancel={() => {
        lock();
        onCancel();
      }}
      onConfirm={() => {
        if (step < 3) {
          setConsent(false);
          setStep(step + 1);
        } else void submit();
      }}
    >
      <Text style={styles.label}>STEP {step + 1} OF 4</Text>
      {step > 0 && (
        <Button
          title="Previous step"
          variant="ghost"
          disabled={busy}
          onPress={() => {
            setConsent(false);
            setStep(step - 1);
          }}
        />
      )}
      {step === 0 && (
        <>
          <Text style={styles.h3}>{verificationLabels[petition.verification]}</Text>
          <Text style={styles.body}>
            {petition.verification === 'custom'
              ? petition.customRule
              : verificationExplanations[petition.verification]}
          </Text>
          <SummaryRows
            rows={[
              { label: 'Private check', value: verificationLabels[petition.verification] },
              { label: 'Organizer sees', value: 'Chosen public name and aggregate progress' },
              { label: 'Public sees', value: 'Only your chosen display name' },
              { label: 'Private record', value: 'Encrypted; contact and residence stay private' },
            ]}
          />
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
            ]}
          />
          <Text style={styles.micro}>
            Your signature is recorded against this exact wording. If the organizer revises the
            request later, your signature stays attached to the text you read here.
          </Text>
          <Notice text="This records support for review. It does not certify a voter-registration match, witness affidavit, official measure text, or legal qualification. Those require the responsible authority’s process." />
        </>
      )}
      {step === 1 && (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.h3}>
            {
              {
                eligible: 'Eligible under the configured rule',
                additional: 'Additional information needed',
                pending: 'Pending manager review',
                ineligible: 'Not eligible to sign this petition',
              }[eligibility.state]
            }
          </Text>
          {eligible && <Notice error text={eligible} />}
          {!eligible && (
            <Text style={styles.small}>
              Your eligibility check passed. Unlock your private record to continue.
              {isDemo ? ' This check is simulated in the demo.' : ''}
            </Text>
          )}
          {!loaded && !error && (
            <Text style={styles.small}>Loading your private signature vault…</Text>
          )}
          {loaded && !envelope && (
            <>
              <Notice text="Set up your private signature vault in Profile first, then return to this petition. Your printed name, registered residence and handwritten signature are required." />
              <Button
                title="Set up my signature profile"
                onPress={() => {
                  lock();
                  onCancel();
                  router.push('/(tabs)/profile');
                }}
              />
            </>
          )}
          {!!envelope && !signatory && (
            <>
              <Field
                label="Vault recovery key"
                value={key}
                onChangeText={setKey}
                secureTextEntry
                autoComplete="off"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Button
                title={busy ? 'Unlocking…' : 'Unlock my signature for review'}
                disabled={busy}
                onPress={() => {
                  void unlock();
                }}
              />
            </>
          )}
          {signatory && (
            <>
              <Text style={styles.h3}>Your private signatory record</Text>
              <Text style={styles.body}>
                {signatory.printedName}
                {'\n'}
                {signatory.residenceAddress}
                {'\n'}
                {signatory.jurisdiction}
              </Text>
              <SignaturePad value={signatory.signature} readonly onChange={() => {}} />
              <Text style={styles.muted}>
                Residence is self-attested. To correct these details, cancel and update your
                signature vault in Profile.
              </Text>
              <Button title="Lock private details" variant="ghost" disabled={busy} onPress={lock} />
            </>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <Text style={styles.h3}>How should your name appear?</Text>
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
      {step === 3 && (
        <>
          <SummaryRows
            rows={[
              { label: 'Petition', value: disclosure.title },
              { label: 'Eligibility method', value: verificationLabels[petition.verification] },
              {
                label: 'Public identity',
                value: publicName(snapshot.profile?.name ?? '', identity),
              },
            ]}
          />
          <Notice text="Only your chosen display name appears publicly or in a delivery packet. Your contact details and encrypted private record are not shown to organizers or the public." />
          <CheckRow
            label="I read the full text, confirm these are my own current details, and consent to this signature."
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
    'Counted publicly as an anonymous supporter and never named. Your account still owns the signature privately, so you can withdraw it.',
};

const verificationExplanations: Record<Petition['verification'], string> = {
  account:
    'We check that you are signed in. This prevents an unsigned guest from recording support.',
  email:
    'We check whether your authentication provider has approved your email. The organizer does not receive your email address.',
  community:
    'We check that you are an active member of this petition’s community. Your account and membership evidence stay private.',
  location:
    'We check for an approved location attestation. Your approximate feed city alone does not establish signing eligibility.',
  custom:
    'The organizer reviews the written eligibility rule. Do not submit contact details or private evidence in a review request.',
};

export function PrivateSignatureReceipt({ petitionId }: { petitionId: string }) {
  const { adapter } = useBackend();
  const [receipt, setReceipt] = useState<SignatureReceipt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    void adapter
      .receipt(petitionId)
      .then((value) => {
        if (active) {
          setReceipt(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load your receipt. Reopen this petition to retry.');
      });
    return () => {
      active = false;
    };
  }, [adapter, petitionId]);
  return (
    <Panel>
      <Text style={styles.h3}>Your private signature receipt</Text>
      {receipt && (
        <>
          <Text selectable style={styles.small}>
            Private reference: {receipt.id}
          </Text>
          <Chip
            label={
              receipt.status === 'accepted'
                ? 'ACCEPTED FOR QUALIFICATION'
                : receipt.status === 'rejected'
                  ? 'REVIEWED · NOT ACCEPTED'
                  : 'RECORDED · PENDING LEGAL REVIEW'
            }
          />
          <Text style={styles.muted}>
            Recorded {new Date(receipt.submittedAt).toLocaleString()}. Your encrypted signatory
            details are stored with this exact text. Updating or deleting your profile vault does
            not rewrite this receipt.
          </Text>
          {!!receipt.reviewNote && <Notice text={receipt.reviewNote} />}
          <Button
            title={expanded ? 'Hide the text I signed' : 'View the text I signed'}
            variant="secondary"
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <>
              <Text style={styles.h3}>{receipt.disclosure.title}</Text>
              <Text style={styles.body}>{receipt.disclosure.fullText}</Text>
              <Text style={styles.muted}>
                To: {receipt.disclosure.recipient}
                {'\n'}Location: {receipt.disclosure.approximateLocation}
              </Text>
            </>
          )}
        </>
      )}
      {loaded && !receipt && (
        <Notice text="This older support record has no encrypted signatory receipt and is not counted as accepted for legal qualification." />
      )}
      {!loaded && !error && <Text style={styles.muted}>Loading your receipt…</Text>}
      {!!error && <Notice error text={error} />}
    </Panel>
  );
}
