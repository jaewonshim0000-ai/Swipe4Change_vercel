import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View, useWindowDimensions } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Draft,
  Identity,
  Petition,
  identityLabels,
  identityModes,
  topics,
  verificationLabels,
  verificationModes,
} from '../../src/domain/model';
import { analyzeDraft, draftSchema, evidenceSchema } from '../../src/domain/rules';
import { useCommand, useSnapshot } from '../../src/data/provider';
import {
  Button,
  Chip,
  Confirm,
  Field,
  Loading,
  Notice,
  Page,
  Panel,
  colors,
  styles,
} from '../../src/components/ui';
import { suggestRecipient, writingSupport } from '../../src/domain/writing-assistant';
import { PetitionCard } from '../../src/components/petition-card';
const blank: Draft = {
  title: '',
  summary: '',
  problem: '',
  action: '',
  recipient: '',
  topic: 'Safer streets',
  city: 'Riverton, CA',
  communityId: '10000000-0000-4000-8000-000000000001',
  goal: 1000,
  deadline: '2027-06-30',
  evidence: [],
  verification: 'account',
  identities: ['first_name_last_initial', 'anonymous'],
  customRule: '',
};
const steps = ['The idea', 'The details', 'Signing & privacy', 'Preview'];
export default function CreateRoute() {
  const q = useSnapshot();
  const params = useLocalSearchParams<{ draftId?: string }>();
  if (q.isPending) return <Loading />;
  return (
    <Create
      key={`${q.data?.profile?.id ?? 'guest'}-${params.draftId ?? ''}`}
      selectedDraftId={params.draftId}
    />
  );
}
function Create({ selectedDraftId }: { selectedDraftId?: string }) {
  const q = useSnapshot();
  const command = useCommand();
  const { width } = useWindowDimensions();
  const [id, setId] = useState(() =>
    selectedDraftId && selectedDraftId !== 'new' ? selectedDraftId : Crypto.randomUUID(),
  );
  const hydrated = useRef(false);
  const [initialSnapshot] = useState(q.data);
  const [ready, setReady] = useState(false);
  const [automaticRecipient, setAutomaticRecipient] = useState(
    !selectedDraftId || selectedDraftId === 'new',
  );
  const [bodyUndo, setBodyUndo] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [undo, setUndo] = useState<{ title: string; summary: string } | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const form = useForm<Draft>({
    resolver: zodResolver(draftSchema),
    defaultValues: blank,
    mode: 'onBlur',
  });
  const draft = useWatch({ control: form.control, compute: (values: Draft) => values });
  const analysis = analyzeDraft(draft);
  const support = writingSupport(draft);
  const recipient = suggestRecipient(draft);
  const draftKey = `lookaware.draft.${q.data?.profile?.id ?? 'guest'}`;
  useEffect(() => {
    if (!initialSnapshot?.profile || hydrated.current) return;
    hydrated.current = true;
    let active = true;
    const saved = initialSnapshot.drafts?.find((d) => d.id === selectedDraftId);
    if (saved) {
      form.reset({ ...blank, ...saved.draft });
      setStep(saved.step);
      setDraftMessage('Restored your private draft.');
      setReady(true);
    } else if (selectedDraftId && selectedDraftId !== 'new') {
      setDraftMessage('This draft is unavailable. Start a new draft from your profile.');
    } else if (selectedDraftId === 'new') {
      setReady(true);
    } else {
      void AsyncStorage.getItem(draftKey)
        .then((raw) => {
          if (!active) return;
          if (raw) {
            form.reset({ ...blank, ...JSON.parse(raw) });
            setAutomaticRecipient(false);
            setDraftMessage('Restored your on-device writing backup.');
          }
          setReady(true);
        })
        .catch(() => {
          if (active) {
            setReady(true);
            setDraftMessage('On-device backup unavailable. Use Save draft to keep your work.');
          }
        });
    }
    return () => {
      active = false;
    };
  }, [initialSnapshot, selectedDraftId, draftKey, form]);
  useEffect(() => {
    if (ready && automaticRecipient) form.setValue('recipient', recipient.name);
  }, [automaticRecipient, ready, recipient.name, form]);
  const backup = JSON.stringify(draft);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, backup).catch(() =>
        setDraftMessage('On-device backup unavailable. Use Save draft to keep your work.'),
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [backup, draftKey, ready]);
  function saveDraft() {
    command.mutate(
      { type: 'saveDraft', id, draft: form.getValues(), step },
      {
        onSuccess: () =>
          setDraftMessage('Draft saved privately. Continue it anytime from Profile.'),
      },
    );
  }
  async function next() {
    const fields: (keyof Draft)[][] = [
      ['title', 'problem', 'action', 'topic'],
      ['summary', 'recipient', 'city', 'communityId', 'goal', 'deadline', 'evidence'],
      ['verification', 'identities', 'customRule'],
    ];
    if (await form.trigger(fields[step])) {
      setStep(step + 1);
      await AsyncStorage.setItem(draftKey, JSON.stringify(form.getValues())).catch(() =>
        setDraftMessage('Draft backup unavailable. Keep this page open.'),
      );
    }
  }
  function input(
    name:
      'title' | 'summary' | 'problem' | 'action' | 'recipient' | 'city' | 'deadline' | 'customRule',
    label: string,
    multiline = false,
  ) {
    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field, fieldState }) => (
          <Field
            label={label}
            value={field.value}
            onChangeText={(value) => {
              if (name === 'recipient') setAutomaticRecipient(false);
              field.onChange(value);
            }}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            multiline={multiline}
          />
        )}
      />
    );
  }
  function publish(publish: boolean) {
    void form.handleSubmit((values) =>
      command.mutate(
        { type: 'create', draft: values, publish, draftId: id },
        {
          onSuccess: (id) => {
            setConfirm(false);
            setAutomaticRecipient(true);
            setId(Crypto.randomUUID());
            form.reset(blank);
            setStep(0);
            void AsyncStorage.removeItem(draftKey);
            router.push(`/petition/${id}`);
          },
        },
      ),
    )();
  }
  if (q.isPending) return <Loading />;
  if (!q.data?.profile)
    return (
      <Page title="Your idea belongs here.">
        <Button
          title="Sign in to start a petition"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </Page>
    );
  const preview: Petition = {
    ...draft,
    id: 'preview',
    ownerId: q.data.profile.id,
    creator: q.data.profile.name,
    collaborators: [],
    status: 'draft',
    count: 0,
    sampleCount: 0,
    saves: 0,
    recentSignatures: 0,
    createdAt: new Date().toISOString(),
    updates: [],
    edits: [],
    endorsements: [],
    discussion: [],
    responses: [],
  };
  return (
    <Page
      title="A small idea. A shared next step."
      subtitle="Make a clear, grounded request your neighbors can get behind."
      eyebrow="CREATE A PETITION"
    >
      <View style={styles.between}>
        <Text style={styles.muted}>
          Automatic on-device backup · Save draft to keep it in your account.
        </Text>
        <Button
          title={command.isPending ? 'Saving…' : 'Save draft'}
          icon="bookmark-outline"
          variant="secondary"
          disabled={!ready || command.isPending}
          onPress={saveDraft}
        />
      </View>
      <View style={styles.row}>
        {steps.map((name, i) => (
          <Chip key={name} label={`${i + 1}  ${name}`} selected={step === i} />
        ))}
      </View>
      {!!draftMessage && <Notice text={draftMessage} />}
      <View
        style={{
          gap: 24,
          width: '100%',
          alignSelf: 'center',
          flexDirection: width >= 1200 && step < 3 ? 'row' : 'column',
          alignItems: 'flex-start',
        }}
      >
        <Panel style={{ flex: 1, width: '100%' }}>
          <Text style={styles.h2}>{steps[step]}</Text>
          {step === 0 && (
            <>
              <Text style={styles.muted}>
                Start with a template, then make every word your own.
              </Text>
              <View style={styles.row}>
                <Button
                  title="Safer walk template"
                  variant="secondary"
                  onPress={() => {
                    form.setValue('title', 'Make the walk to campus safer');
                    form.setValue(
                      'problem',
                      'Describe the part of your walk that needs attention, and what you have observed.',
                    );
                    form.setValue('action', 'Assess lighting along the campus path');
                    form.setValue('topic', 'Safer streets');
                  }}
                />
                <Button title="Start blank" variant="ghost" onPress={() => form.reset(blank)} />
              </View>
              {input('title', 'Petition title')}
              {input('problem', 'What is the problem?', true)}
              {input('action', 'What specific action are you asking for?', true)}
              <Text style={styles.h3}>Topic</Text>
              <View style={styles.row}>
                {topics.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={draft.topic === t}
                    onPress={() => form.setValue('topic', t)}
                  />
                ))}
              </View>
            </>
          )}
          {step === 1 && (
            <>
              {input('recipient', 'Responsible recipient')}
              <Chip
                label="Automatically assign recipient"
                selected={automaticRecipient}
                onPress={() => setAutomaticRecipient(!automaticRecipient)}
              />
              <Text style={styles.muted}>{recipient.explanation}</Text>
              <Text style={styles.muted}>
                Recipient directory: school or campus administration · public works · parks and
                recreation · library services. Use a real name only when you have confirmed it.
              </Text>
              {input('summary', 'One-sentence summary', true)}
              {input('city', 'Approximate city and state')}
              <Text style={styles.h3}>Community</Text>
              <View style={styles.row}>
                {q.data.communities.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={draft.communityId === c.id}
                    onPress={() => form.setValue('communityId', c.id)}
                  />
                ))}
              </View>
              <Controller
                control={form.control}
                name="goal"
                render={({ field, fieldState }) => (
                  <Field
                    label="Signature goal"
                    keyboardType="number-pad"
                    value={String(field.value)}
                    onChangeText={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {input('deadline', 'Deadline (YYYY-MM-DD)')}
              <Text style={styles.h3}>Evidence & sources</Text>
              <Notice text="Sources are supplied by the creator and are not fact-checked by Swipe4Change. Add only material you can support. Do not upload private information." />
              {draft.evidence.map((e, i) => (
                <View key={`${e.url}-${i}`} style={styles.between}>
                  <Text style={[styles.muted, { flex: 1 }]}>{e.label}</Text>
                  <Button
                    title={`Remove source ${i + 1}`}
                    variant="ghost"
                    onPress={() =>
                      form.setValue(
                        'evidence',
                        draft.evidence.filter((_, n) => n !== i),
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
                    const evidence = evidenceSchema.parse([{ label: sourceLabel, url: sourceUrl }]);
                    form.setValue('evidence', [...draft.evidence, ...evidence]);
                    setSourceLabel('');
                    setSourceUrl('');
                    setSourceError('');
                  } catch {
                    setSourceError('Enter a descriptive label and a valid HTTPS URL.');
                  }
                }}
              />
              {!!sourceError && <Notice error text={sourceError} />}
            </>
          )}
          {step === 2 && (
            <>
              <Text style={styles.h3}>Private eligibility requirement</Text>
              <View style={styles.row}>
                {verificationModes.map((v) => (
                  <Chip
                    key={v}
                    label={verificationLabels[v]}
                    selected={draft.verification === v}
                    onPress={() => form.setValue('verification', v)}
                  />
                ))}
              </View>
              {draft.verification === 'custom' &&
                input('customRule', 'Describe the custom eligibility rule', true)}
              <Notice
                text={
                  draft.verification === 'location'
                    ? 'Location signatures require approval by a trusted administrator. Self-entered cities do not count as verification.'
                    : draft.verification === 'community'
                      ? 'Signers must be active members of your selected community.'
                      : 'Verification is checked privately. It never decides which name appears publicly.'
                }
              />
              <Text style={styles.h3}>Allowed public identities</Text>
              <Text style={styles.muted}>
                Select at least one. A privately verified signer can still appear anonymously.
              </Text>
              <View style={styles.row}>
                {identityModes.map((mode: Identity) => (
                  <Chip
                    key={mode}
                    label={identityLabels[mode]}
                    selected={draft.identities.includes(mode)}
                    onPress={() =>
                      form.setValue(
                        'identities',
                        draft.identities.includes(mode)
                          ? draft.identities.filter((m) => m !== mode)
                          : [...draft.identities, mode],
                      )
                    }
                  />
                ))}
              </View>
              {form.formState.errors.identities && (
                <Notice
                  error
                  text={
                    form.formState.errors.identities.message ?? 'Choose at least one identity mode.'
                  }
                />
              )}
              <Notice text="After the first signature, eligibility and identity options are locked. Later title or action edits require a public explanation and preserve the previous wording." />
            </>
          )}
          {step === 3 && (
            <>
              <Text style={styles.muted}>
                Review the exact content you will publish. Publishing makes this petition visible in
                the community feed.
              </Text>
              <View>
                <PetitionCard petition={preview} snapshot={q.data} preview />
              </View>
              <Text style={styles.h3}>The problem</Text>
              <Text style={styles.body}>{draft.problem}</Text>
              <Text style={styles.h3}>Requested action</Text>
              <Text style={styles.body}>{draft.action}</Text>
              <Text style={styles.muted}>
                Public choices: {draft.identities.map((i) => identityLabels[i]).join(', ')}.
                Sources: {draft.evidence.length}.
              </Text>
              <Notice text="After publishing, open Manage to configure all four legal requirements from the responsible authority. Signatures stay blocked until that setup is complete. Saving a draft lets you gather the documents first." />
              <Button
                title="Publish petition"
                onPress={() => setConfirm(true)}
                disabled={command.isPending}
              />
              <Button
                title="Save as private draft"
                variant="secondary"
                onPress={saveDraft}
                disabled={command.isPending}
              />
            </>
          )}
          {command.error && <Notice error text={command.error.message} />}
          <View style={styles.between}>
            {step > 0 ? (
              <Button title="Previous step" variant="ghost" onPress={() => setStep(step - 1)} />
            ) : (
              <View />
            )}
            {step < 3 && (
              <Button
                title="Continue"
                icon="arrow-forward"
                onPress={() => {
                  void next();
                }}
              />
            )}
          </View>
        </Panel>
        {step < 3 && (
          <Panel style={{ backgroundColor: '#EEF2E5', width: width >= 1200 ? 340 : '100%' }}>
            <View style={styles.between}>
              <Text style={styles.h2}>A little help getting clear</Text>
              <Chip label="SIMULATED AI · LOCAL RULES" />
            </View>
            <Text style={styles.muted}>
              This prototype rearranges only the words you supply. It does not invent facts or
              verify your claims. Everything stays editable.
            </Text>
            <Text style={styles.h3}>Let’s build your case</Text>
            {support.prompts.map((prompt) => (
              <Text key={prompt} style={styles.muted}>
                • {prompt}
              </Text>
            ))}
            <Button
              title="Structure my petition text"
              variant="secondary"
              disabled={!support.body || bodyUndo !== null}
              onPress={() => {
                setBodyUndo(draft.problem);
                form.setValue('problem', support.body);
              }}
            />
            {bodyUndo !== null && (
              <Button
                title="Undo structured text"
                variant="ghost"
                onPress={() => {
                  form.setValue('problem', bodyUndo);
                  setBodyUndo(null);
                }}
              />
            )}
            <Text style={styles.h3}>Explore a possible legal basis</Text>
            <Text style={styles.muted}>
              Official research starting points, not a finding that a law applies or was violated.
              Confirm jurisdiction, facts, and current local rules.
            </Text>
            {support.legal.map((source) => (
              <View key={source.url} style={{ gap: 8 }}>
                <Text style={styles.h3}>{source.title}</Text>
                <Text style={styles.muted}>{source.relevance}</Text>
                <Button
                  title="Read official guidance"
                  variant="ghost"
                  onPress={() => {
                    void Linking.openURL(source.url).catch(() =>
                      setDraftMessage('Could not open the source. Please try again.'),
                    );
                  }}
                />
                <Button
                  title="Add as research source"
                  variant="secondary"
                  disabled={draft.evidence.some((e) => e.url === source.url)}
                  onPress={() =>
                    form.setValue('evidence', [
                      ...draft.evidence,
                      { label: source.title, url: source.url },
                    ])
                  }
                />
              </View>
            ))}
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.accent }}>
              {analysis.score}
              <Text style={styles.muted}> / 100 completeness score</Text>
            </Text>
            {analysis.rubric.map((r) => (
              <Text key={r.label} style={styles.muted}>
                {r.met ? '✓' : '○'} {r.label} · {r.points} points
              </Text>
            ))}
            {!!analysis.title && <Text style={styles.body}>Suggested title: {analysis.title}</Text>}
            {!!analysis.summary && (
              <Text style={styles.body}>Suggested summary: {analysis.summary}</Text>
            )}
            <View style={styles.row}>
              <Button
                title="Apply editable suggestions"
                variant="secondary"
                disabled={!analysis.title}
                onPress={() => {
                  setUndo({ title: draft.title, summary: draft.summary });
                  form.setValue('title', analysis.title);
                  if (analysis.summary) form.setValue('summary', analysis.summary);
                }}
              />
              {undo && (
                <Button
                  title="Undo suggestions"
                  variant="ghost"
                  onPress={() => {
                    form.setValue('title', undo.title);
                    form.setValue('summary', undo.summary);
                    setUndo(null);
                  }}
                />
              )}
            </View>
          </Panel>
        )}
      </View>
      <Confirm
        visible={confirm}
        title="Ready to share your petition?"
        body="Your title, requested action, sources, and signing rules will become public. Please check that they are accurate and contain no private information."
        pending={command.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => publish(true)}
      >
        {command.error && <Notice error text={command.error.message} />}
      </Confirm>
    </Page>
  );
}
