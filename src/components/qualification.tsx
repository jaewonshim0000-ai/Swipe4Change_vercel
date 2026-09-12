import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Petition } from '../domain/model';
import {
  QualificationDetails,
  qualificationChecklist,
  qualificationSchema,
} from '../domain/qualification';
import { useCommand } from '../data/provider';
import { Button, Chip, Confirm, Field, Notice, Panel, styles } from './ui';

export function QualificationChecklist({ petition }: { petition: Petition }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const q = petition.qualification;
  return (
    <Panel>
      <Text style={styles.h2}>Four required legal checks</Text>
      <Text style={styles.muted}>
        All four are mandatory for legal qualification. Support counts and participation badges do
        not certify eligibility or ballot access.
      </Text>
      {qualificationChecklist(petition).map((item) => (
        <View key={item.title} style={{ gap: 8 }}>
          <Text style={styles.h3}>
            {item.ready ? '✓' : '○'} {item.title}
          </Text>
          <Text style={styles.muted}>{item.detail}</Text>
        </View>
      ))}
      {q?.details && (
        <>
          <Text style={styles.body}>
            {q.details.jurisdiction} · {q.details.authority}
            {'\n'}Measure: {q.details.measureId}
          </Text>
          <Button
            title={
              expanded ? 'Hide supplied legal requirements' : 'Read supplied legal requirements'
            }
            variant="secondary"
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <>
              <Text style={styles.h3}>{q.details.officialTitle}</Text>
              <Text style={styles.body}>{q.details.officialText}</Text>
              <Text style={styles.h3}>Threshold rule</Text>
              <Text style={styles.body}>{q.details.statutoryRule}</Text>
              <Text style={styles.h3}>Required circulator declaration</Text>
              <Text style={styles.body}>{q.details.circulatorDeclaration}</Text>
              <Button
                title="Open authority source"
                variant="secondary"
                onPress={() => {
                  void Linking.openURL(q.details!.sourceUrl).catch(() =>
                    setError('Could not open the source. Please try again.'),
                  );
                }}
              />
            </>
          )}
        </>
      )}
      {!!q?.reviewNote && <Notice text={q.reviewNote} />}
      {!!error && <Notice error text={error} />}
    </Panel>
  );
}
export function QualificationEditor({ petition }: { petition: Petition }) {
  const m = useCommand();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState<QualificationDetails>(
    () =>
      petition.qualification?.details ?? {
        jurisdiction: '',
        authority: '',
        measureId: '',
        officialTitle: petition.title,
        officialText: `${petition.problem}\n\nRequested action\n${petition.action}`,
        sourceUrl: '',
        statutoryRule: '',
        statutoryThreshold: 0,
        circulatorDeclaration: '',
        notarization: 'required',
      },
  );
  const locked = (petition.recordedSignatures ?? 0) > 0;
  function field(
    key: Exclude<keyof QualificationDetails, 'statutoryThreshold' | 'notarization'>,
    label: string,
    multiline = false,
  ) {
    return (
      <Field
        label={label}
        value={details[key]}
        multiline={multiline}
        onChangeText={(value) => setDetails({ ...details, [key]: value })}
      />
    );
  }
  return (
    <Panel>
      <Text style={styles.h2}>Legal qualification setup</Text>
      <Notice
        text={
          locked
            ? 'Legal requirements are locked because signatory records exist. A new measure or different official text needs a new petition; existing consent cannot be repurposed.'
            : 'Copy the exact requirements from the responsible authority. The suggested petition wording below is not approved official text. Every submission remains pending independent review.'
        }
      />
      {!locked && (
        <Button
          title={open ? 'Hide legal setup' : 'Configure all four legal requirements'}
          variant="secondary"
          onPress={() => setOpen(!open)}
        />
      )}
      {open && !locked && (
        <>
          {field('jurisdiction', 'Exact registration jurisdiction')}
          {field('authority', 'Responsible election or petition authority')}
          {field('measureId', 'Official measure or filing reference')}
          {field('officialTitle', 'Official title — copy from approved document')}
          {field('officialText', 'Complete official text — shown to every signer', true)}
          {field('sourceUrl', 'Authority source URL (HTTPS)')}
          {field(
            'statutoryRule',
            'Exact statutory rule, percentage, denominator and reference',
            true,
          )}
          <Field
            label="Exact number of valid signatures required by the authority"
            value={details.statutoryThreshold ? String(details.statutoryThreshold) : ''}
            keyboardType="number-pad"
            onChangeText={(value) => setDetails({ ...details, statutoryThreshold: Number(value) })}
          />
          <Text style={styles.muted}>
            Enter the authority’s exact count, including its rounding rule. This is separate from
            your community support goal.
          </Text>
          {field('circulatorDeclaration', 'Exact required circulator affidavit wording', true)}
          <Text style={styles.h3}>Notarization required by the applicable rule</Text>
          <View style={styles.row}>
            {(['required', 'not_required'] as const).map((value) => (
              <Chip
                key={value}
                label={value === 'required' ? 'Required' : 'Not required by this rule'}
                selected={details.notarization === value}
                onPress={() => setDetails({ ...details, notarization: value })}
              />
            ))}
          </View>
          <Text style={styles.muted}>
            Every signer must supply a private printed name, signature and registered residence.
            Review must establish a registration match; a self-attestation is insufficient for
            acceptance.
          </Text>
          <Field
            label="Public explanation for this submission"
            multiline
            value={reason}
            onChangeText={setReason}
          />
          <Button
            title="Review legal requirements submission"
            onPress={() => {
              const parsed = qualificationSchema.safeParse(details);
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
              if (reason.trim().length < 5) {
                setError('Explain the source of these requirements.');
                return;
              }
              setError('');
              setConfirm(true);
            }}
          />
        </>
      )}
      {!!error && <Notice error text={error} />}
      {!!message && <Notice text={message} />}
      <Confirm
        visible={confirm}
        title="Submit legal requirements for review?"
        body={`${details.officialTitle}\n${details.jurisdiction} · ${details.authority}\n${details.statutoryThreshold} valid signatures required.\nNotarization: ${details.notarization === 'required' ? 'Required' : 'Not required under the supplied rule'}.\nThis does not grant official approval.`}
        pending={m.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          m.mutate(
            { type: 'qualification', petitionId: petition.id, details, reason },
            {
              onSuccess: () => {
                setConfirm(false);
                setOpen(false);
                setMessage('Requirements saved as pending review, with a public history entry.');
              },
            },
          )
        }
      >
        {m.error && <Notice error text={m.error.message} />}
      </Confirm>
    </Panel>
  );
}
