import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useBackend, useCommand } from '../data/provider';
import { Petition, PublicSignature } from '../domain/model';
import { Affidavit, affidavitPayloadSchema } from '../domain/affidavit';
import { Signatory } from '../domain/signatory';
import { decryptSignatory, encryptAffidavit } from '../security/signature-vault';
import { Button, Chip, Confirm, Field, Notice, Panel, styles } from './ui';
import { SignaturePad } from './signature-pad';
export function CirculatorAffidavit({
  petition,
  signatures,
  ownerId,
}: {
  petition: Petition;
  signatures: PublicSignature[];
  ownerId: string;
}) {
  const { adapter } = useBackend();
  const m = useCommand();
  const [items, setItems] = useState<Affidavit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [recordPage, setRecordPage] = useState(0);
  const [key, setKey] = useState('');
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [sheetReference, setSheetReference] = useState('');
  const [notaryReference, setNotaryReference] = useState('');
  const [witnessed, setWitnessed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const lock = useCallback(() => {
    epoch.current += 1;
    setKey('');
    setSignatory(null);
    setSheetReference('');
    setNotaryReference('');
    setWitnessed(false);
  }, []);
  useFocusEffect(useCallback(() => () => lock(), [lock]));
  useEffect(() => {
    let active = true;
    void adapter
      .affidavits(petition.id)
      .then((values) => {
        if (active) setItems(values);
      })
      .catch(() => {
        if (active) setError('Could not load your affidavits. Reopen Manage to retry.');
      });
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lock();
    });
    return () => {
      active = false;
      epoch.current += 1;
      listener.remove();
    };
  }, [adapter, petition.id, lock]);
  useEffect(() => {
    if (!key && !signatory) return;
    const timer = setTimeout(lock, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [key, signatory, lock]);
  const details = petition.qualification?.details;
  async function unlock() {
    setBusy(true);
    setError('');
    const operation = epoch.current;
    try {
      const envelope = await adapter.vault();
      if (!envelope) throw new Error('Set up your private signature vault in Profile first.');
      const value = await decryptSignatory(ownerId, key, envelope);
      if (operation === epoch.current) setSignatory(value);
    } catch (e) {
      if (operation === epoch.current)
        setError(e instanceof Error ? e.message : 'Could not unlock your signature.');
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!details || !signatory) {
      setError('Unlock your private signature before submitting.');
      return;
    }
    const input = {
      context: {
        id: randomUUID(),
        petitionId: petition.id,
        signatureIds: selected,
        declaration: details.circulatorDeclaration,
        witnessed,
        notarizationProvided: details.notarization === 'required' || !!notaryReference,
      },
      signatory,
      sheetReference,
      notaryReference,
      signedAt: new Date().toISOString(),
    };
    const parsed = affidavitPayloadSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    const operation = epoch.current;
    try {
      const envelope = await encryptAffidavit(ownerId, key, parsed.data);
      if (operation !== epoch.current) return;
      await m.mutateAsync({
        type: 'affidavit',
        petitionId: petition.id,
        submission: { ...parsed.data.context, envelope },
      });
      lock();
      setOpen(false);
      setSelected([]);
      setMessage(
        'Affidavit submitted as pending review. It is not yet accepted or certified as notarized.',
      );
      setItems(await adapter.affidavits(petition.id));
    } catch (e) {
      if (operation === epoch.current)
        setError(e instanceof Error ? e.message : 'Could not submit the affidavit.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <Text style={styles.h2}>Circulator affidavits</Text>
      <Text style={styles.muted}>
        The collector signs a declaration covering specific records. Their private signature and
        document references are encrypted. A trusted reviewer must inspect the underlying witnessed
        signature sheets and any required notarial record.
      </Text>
      {!details && (
        <Notice text="Configure the petition’s exact legal requirements before submitting a circulator affidavit." />
      )}
      <Button
        title="Prepare my circulator affidavit"
        variant="secondary"
        disabled={!details}
        onPress={() => {
          setError('');
          setOpen(true);
        }}
      />
      {items.map((item) => (
        <View key={item.id} style={{ gap: 8 }}>
          <Chip label={`YOUR AFFIDAVIT · ${item.status.toUpperCase()}`} />
          <Text style={styles.muted}>
            {item.signatureIds.length} signature records ·{' '}
            {new Date(item.submittedAt).toLocaleDateString()}
          </Text>
          {!!item.reviewNote && <Notice text={item.reviewNote} />}
        </View>
      ))}
      {!!message && <Notice text={message} />}
      {!open && !!error && <Notice error text={error} />}
      <Confirm
        visible={open}
        title="Sign a circulator affidavit"
        body="Only attest to signatures you personally witnessed being executed. Seeing an online support count or reusing a saved signature does not prove witnessing or notarization. Use fictional records only in demo mode."
        pending={busy || m.isPending}
        onCancel={() => {
          lock();
          setOpen(false);
        }}
        onConfirm={() => {
          void submit();
        }}
      >
        <Text style={styles.h3}>Required declaration</Text>
        <Text style={styles.body}>{details?.circulatorDeclaration}</Text>
        <Text style={styles.h3}>Select the records your declaration covers</Text>
        {signatures.length ? (
          signatures
            .slice(0, 200)
            .map((record) => (
              <Chip
                key={record.id}
                label={`${record.displayName} · ${record.id.slice(-8)}`}
                selected={selected.includes(record.id)}
                onPress={() =>
                  setSelected(
                    selected.includes(record.id)
                      ? selected.filter((id) => id !== record.id)
                      : [...selected, record.id],
                  )
                }
              />
            ))
        ) : (
          <Text style={styles.muted}>No new signature records yet.</Text>
        )}
        {signatures.length > 200 && (
          <View style={styles.row}>
            <Button
              title="Previous records (clears selection)"
              variant="ghost"
              disabled={recordPage === 0}
              onPress={() => {
                setSelected([]);
                setRecordPage(recordPage - 1);
              }}
            />
            <Button
              title="Next records (clears selection)"
              variant="ghost"
              disabled={(recordPage + 1) * 200 >= signatures.length}
              onPress={() => {
                setSelected([]);
                setRecordPage(recordPage + 1);
              }}
            />
          </View>
        )}
        <Field
          label="Private signed-sheet or collection record reference"
          value={sheetReference}
          onChangeText={setSheetReference}
          autoComplete="off"
        />
        <Field
          label={
            details?.notarization === 'required'
              ? 'Private notarized document reference (required)'
              : 'Private notarial document reference (if applicable)'
          }
          value={notaryReference}
          onChangeText={setNotaryReference}
          autoComplete="off"
        />
        {!signatory && (
          <>
            <Field
              label="Circulator vault recovery key"
              value={key}
              onChangeText={setKey}
              secureTextEntry
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Button
              title="Unlock my circulator signature"
              disabled={busy}
              onPress={() => {
                void unlock();
              }}
            />
          </>
        )}
        {signatory && (
          <>
            <Text style={styles.body}>{signatory.printedName}</Text>
            <SignaturePad value={signatory.signature} readonly onChange={() => {}} />
          </>
        )}
        <Chip
          label="I personally witnessed these signatures and affirm the complete declaration above"
          selected={witnessed}
          onPress={() => setWitnessed(!witnessed)}
        />
        {!!error && <Notice error text={error} />}
      </Confirm>
    </Panel>
  );
}
