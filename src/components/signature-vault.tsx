import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBackend, useCommand, isDemo } from '../data/provider';
import { EncryptedVault, SignaturePoint, signatorySchema } from '../domain/signatory';
import { decryptSignatory, encryptSignatory, generateVaultKey } from '../security/signature-vault';
import { SignaturePad } from './signature-pad';
import { Button, Chip, Confirm, Field, Notice, Panel, styles } from './ui';

export function SignatureVault({ ownerId }: { ownerId: string }) {
  const { adapter } = useBackend();
  const command = useCommand();
  const [envelope, setEnvelope] = useState<EncryptedVault | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [printedName, setPrintedName] = useState('');
  const [residenceAddress, setResidenceAddress] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [signature, setSignature] = useState<SignaturePoint[]>([]);
  const [attested, setAttested] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(false);
  const epoch = useRef(0);
  const lock = useCallback(() => {
    epoch.current += 1;
    setOpen(false);
    setCreating(false);
    setKey('');
    setKeySaved(false);
    setPrintedName('');
    setResidenceAddress('');
    setJurisdiction('');
    setSignature([]);
    setAttested(false);
  }, []);
  useEffect(() => {
    let active = true;
    void adapter
      .vault()
      .then((value) => {
        if (active) setEnvelope(value);
      })
      .catch(() => {
        if (active) setError('Unable to load your vault. Reopen Profile to retry.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adapter]);
  useFocusEffect(useCallback(() => () => lock(), [lock]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lock();
    });
    return () => listener.remove();
  }, [lock]);
  useEffect(() => {
    if (!open && !key) return;
    const timer = setTimeout(lock, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [open, key, lock]);
  async function unlock() {
    if (!envelope) return;
    setBusy(true);
    setError('');
    const operation = epoch.current;
    try {
      const value = await decryptSignatory(ownerId, key, envelope);
      if (epoch.current !== operation) return;
      setPrintedName(value.printedName);
      setResidenceAddress(value.residenceAddress);
      setJurisdiction(value.jurisdiction);
      setSignature(value.signature);
      setAttested(true);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock your vault.');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError('');
    const parsed = signatorySchema.safeParse({
      printedName,
      residenceAddress,
      jurisdiction,
      signature,
      residenceAttested: attested,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (creating && !keySaved) {
      setError('Save your recovery key before continuing.');
      return;
    }
    setBusy(true);
    const operation = epoch.current;
    try {
      const encrypted = await encryptSignatory(ownerId, key, parsed.data);
      if (epoch.current !== operation) return;
      await command.mutateAsync({ type: 'saveVault', envelope: encrypted });
      setEnvelope(encrypted);
      lock();
      setMessage(
        'Encrypted signature profile saved and locked. Residence is self-attested, not voter-roll verified.',
      );
    } catch {
      setError(
        'Could not save the encrypted vault. Your existing vault is unchanged. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <View style={styles.between}>
        <Text style={styles.h2}>Private signature vault</Text>
        <Chip label={open ? 'UNLOCKED' : envelope ? 'ENCRYPTED · LOCKED' : 'NOT SET UP'} />
      </View>
      <Text style={styles.muted}>
        Keep your printed legal name, registered residence, and signature together. Only encrypted
        data is saved. Your recovery key unlocks it; organizers cannot view it.
      </Text>
      <Notice
        text={
          isDemo
            ? 'Use fictional details only in this demo. A saved signature is not automatically a valid ballot signature. Your residence still needs verification by the responsible authority.'
            : 'A saved signature is not automatically a valid ballot signature. Your residence still needs verification by the responsible authority.'
        }
      />
      {!open && envelope && (
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
            title={busy ? 'Unlocking…' : 'Unlock my signature vault'}
            disabled={busy || loading}
            onPress={() => {
              void unlock();
            }}
          />
        </>
      )}
      {!open && !envelope && (
        <Button
          title="Set up signature vault"
          disabled={busy || loading || !!error}
          variant="secondary"
          onPress={() => {
            setBusy(true);
            setError('');
            const operation = epoch.current;
            void generateVaultKey()
              .then((value) => {
                if (epoch.current !== operation) return;
                setKey(value);
                setCreating(true);
                setOpen(true);
              })
              .catch(() =>
                setError(
                  'Encryption is unavailable. Use a secure HTTPS connection or a supported native build.',
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      )}
      {open && (
        <>
          {creating && (
            <>
              <Text style={styles.h3}>Save your recovery key</Text>
              <Field
                label="New vault recovery key — save privately"
                value={key}
                editable={false}
                multiline
                autoComplete="off"
              />
              <Text style={styles.muted}>
                Store this key in your password manager. It is never saved by the app. If you lose
                it, your encrypted signature cannot be recovered.
              </Text>
              <Chip
                label="I saved my recovery key privately"
                selected={keySaved}
                onPress={() => setKeySaved(!keySaved)}
              />
            </>
          )}
          <Field
            label="Printed legal name"
            value={printedName}
            onChangeText={setPrintedName}
            autoComplete="off"
          />
          <Field
            label="Residence address on voter registration"
            value={residenceAddress}
            onChangeText={setResidenceAddress}
            multiline
            autoComplete="off"
          />
          <Field
            label="Registration jurisdiction (city/county and state)"
            value={jurisdiction}
            onChangeText={setJurisdiction}
            autoComplete="off"
          />
          <SignaturePad value={signature} onChange={setSignature} />
          <Chip
            label="This matches my registered residence and is my own signature"
            selected={attested}
            onPress={() => setAttested(!attested)}
          />
          <Button
            title={busy ? 'Encrypting and saving…' : 'Encrypt and save signature profile'}
            disabled={busy}
            onPress={() => {
              void save();
            }}
          />
          <Button title="Lock and discard unsaved changes" variant="ghost" onPress={lock} />
          <Text style={styles.muted}>
            Locks when you leave this screen, background the app, or after five minutes. Saving does
            not sign any petition.
          </Text>
        </>
      )}
      {envelope && (
        <Button
          title="Delete encrypted signature profile"
          variant="ghost"
          onPress={() => setRemove(true)}
        />
      )}
      {!!error && <Notice error text={error} />}
      {!!message && <Notice text={message} />}
      <Confirm
        visible={remove}
        title="Delete your signature vault?"
        body="Your saved encrypted identity and signature will be removed. This does not withdraw signatures already submitted to a petition."
        pending={command.isPending}
        onCancel={() => setRemove(false)}
        onConfirm={() => {
          command.mutate(
            { type: 'deleteVault' },
            {
              onSuccess: () => {
                lock();
                setEnvelope(null);
                setRemove(false);
                setError('');
                setMessage('Your encrypted signature profile was deleted.');
              },
            },
          );
        }}
      >
        {command.error && <Notice error text="Could not delete the vault. Please try again." />}
      </Confirm>
    </Panel>
  );
}
