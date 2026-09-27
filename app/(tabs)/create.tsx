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
import { plainLanguage, TARGET_GRADE } from '../../src/domain/plain-language';
import { levelLabels, suggestOffices } from '../../src/domain/recipients';
import { Steps } from '../../src/components/design-system';
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
const steps = [
  'Define the change',
  'Build the case',
  'Configure participation',
  'Review and publish',
];
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
  const [bodyUndo, setBodyUndo] = useState<string | null>(null);
  const [research, setResearch] = useState(false);
  const [previewMode, setPreviewMode] = useState<'card' | 'page'>('card');
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
      ['title', 'problem', 'action', 'recipient', 'city'],
      ['summary', 'topic', 'communityId', 'deadline', 'evidence'],
      ['verification', 'identities', 'customRule', 'goal'],
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
            onChangeText={field.onChange}
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
    deliveries: [],
    volunteerCount: 0,
    sampleVolunteers: 0,
    sampleCount: 0,
    saves: 0,
    sampleVelocity: 0,
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
      <Steps
        count={steps.length}
        current={step}
        numbered
        label={`STEP ${step + 1} OF ${steps.length} · ${steps[step].toUpperCase()}`}
      />
      {!!draftMessage && <Notice text={draftMessage} />}
      <View
        style={{
          gap: 24,
          width: '100%',
          alignSelf: 'center',
          flexDirection: width >= 1000 ? 'row' : 'column',
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
              {input('recipient', 'Who has the authority to act?')}
              {input('city', 'Where is it happening? City and state')}
            </>
          )}
          {step === 1 && (
            <>
              {input('summary', 'One-sentence summary', true)}
              <Text style={styles.small}>
                Make the outcome measurable: name the place, the requested change, and when it
                should happen.
              </Text>
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
              <View style={styles.row}>
                <Chip
                  label="Card preview"
                  selected={previewMode === 'card'}
                  onPress={() => setPreviewMode('card')}
                />
                <Chip
                  label="Detail preview"
                  selected={previewMode === 'page'}
                  onPress={() => setPreviewMode('page')}
                />
              </View>
              {previewMode === 'card' ? (
                <PetitionCard petition={preview} snapshot={q.data} preview />
              ) : (
                <View style={{ gap: 16 }}>
                  <Text style={styles.label}>
                    {draft.topic} · {draft.city}
                  </Text>
                  <Text style={styles.title}>{draft.title}</Text>
                  <Text style={styles.body}>{draft.action}</Text>
                  <Text style={styles.small}>To: {draft.recipient}</Text>
                  <Text style={styles.h3}>Why it matters</Text>
                  <Text style={styles.body}>{draft.problem}</Text>
                  <Text style={styles.h3}>Evidence and sources</Text>
                  {draft.evidence.length ? (
                    draft.evidence.map((e) => (
                      <Text key={e.url} style={styles.small}>
                        {e.label} · {e.url}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.small}>No sources supplied yet.</Text>
                  )}
                  <Text style={styles.small}>
                    {verificationLabels[draft.verification]} · Goal: {draft.goal} · Deadline:{' '}
                    {draft.deadline}
                  </Text>
                  <Text style={styles.small}>
                    Public identity choices:{' '}
                    {draft.identities.map((i) => identityLabels[i]).join(', ')}
                  </Text>
                </View>
              )}
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
        {
          <Panel style={{ backgroundColor: '#EEF2E5', width: width >= 1000 ? 340 : '100%' }}>
            <View style={styles.between}>
              <Text style={styles.h2}>Prototype writing assistant</Text>
              <Chip label="SIMULATED AI · LOCAL RULES" />
            </View>
            <Text style={styles.muted}>
              Uses local rules, not generative AI. This prototype rearranges only the words you
              supply. It does not invent facts or verify your claims. Everything stays editable.
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.accent }}>
              {analysis.score}
              <Text style={styles.muted}> / 100 completeness score</Text>
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
            {(() => {
              // Completeness says whether the fields are filled in. This says whether a neighbour
              // can read the result, which is a different question and usually the harder one.
              const clarity = plainLanguage(draft);
              if (!clarity.words) return null;
              const ok = clarity.grade > 0 && clarity.grade <= TARGET_GRADE;
              return (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.h3}>Can everyone read it?</Text>
                  <Text
                    style={{
                      fontSize: 26,
                      fontWeight: '800',
                      color: ok ? colors.accent : colors.orange,
                    }}
                  >
                    {clarity.grade ? `Grade ${clarity.grade}` : 'Too short to measure'}
                    <Text style={styles.muted}>
                      {clarity.grade ? `  ·  aim for ${TARGET_GRADE} or below` : ''}
                    </Text>
                  </Text>
                  {clarity.issues.length ? (
                    clarity.issues.map((issue) => (
                      <View key={issue.id + (issue.sample ?? '')} style={{ gap: 2 }}>
                        <Text style={styles.body}>
                          {issue.severity === 'warn' ? '!' : '·'} {issue.message}
                        </Text>
                        {!!issue.sample && <Text style={styles.small}>“{issue.sample}”</Text>}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>
                      Nothing to flag. Your ask is specific and reads plainly.
                    </Text>
                  )}
                  <Text style={styles.micro}>
                    Measured with Flesch–Kincaid and simple word checks on your own text. Nothing is
                    rewritten for you, and none of this blocks publishing.
                  </Text>
                  <View style={styles.divider} />
                </>
              );
            })()}
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
            <Text style={styles.small}>Suggested recipient category: {recipient.name}</Text>
            <Text style={styles.micro}>{recipient.explanation}</Text>
            <Button
              title={
                research
                  ? 'Hide recipient and research guidance'
                  : 'Recipient directory and research guidance'
              }
              variant="ghost"
              onPress={() => setResearch(!research)}
            />
            {research && (
              <>
                <Text style={styles.muted}>{recipient.explanation}</Text>
                <Text style={styles.h3}>Offices that handle this</Text>
                <Text style={styles.muted}>
                  Sending a request to the wrong office is the most common way a petition stalls.
                  These fictional offices are ranked by how well they match your topic and wording.
                </Text>
                {suggestOffices(draft.topic, `${draft.problem ?? ''} ${draft.action ?? ''}`)
                  .slice(0, 4)
                  .map((office) => (
                    <View key={office.id} style={{ gap: 4 }}>
                      <Chip
                        label={`${office.name} · ${levelLabels[office.level]}`}
                        selected={draft.recipient === office.name}
                        onPress={() =>
                          form.setValue('recipient', office.name, { shouldValidate: true })
                        }
                      />
                      <Text style={styles.small}>
                        Decides: {office.controls.slice(0, 2).join('; ')}. Does not decide:{' '}
                        {office.notResponsibleFor}
                      </Text>
                    </View>
                  ))}
                <Button
                  title="Browse the full directory"
                  variant="ghost"
                  icon="information-circle-outline"
                  onPress={() => router.push('/recipients')}
                />
                <Text style={styles.h3}>Explore a possible legal basis</Text>
                <Text style={styles.muted}>
                  Official research starting points, not a finding that a law applies or was
                  violated. Confirm jurisdiction, facts, and current local rules.
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
              </>
            )}
          </Panel>
        }
      </View>
      <Confirm
        visible={confirm}
        title="Ready to share your petition?"
        body="Your title, requested action, sources, and signing rules will become public. Please check that they are accurate and contain no private information."
        pending={command.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => publish(true)}
      >
        <Text style={styles.h3}>{draft.title}</Text>
        <Text style={styles.body}>{draft.action}</Text>
        <Text style={styles.small}>
          To: {draft.recipient} · {draft.city}
        </Text>
        <Text style={styles.small}>
          {verificationLabels[draft.verification]} ·{' '}
          {draft.identities.map((i) => identityLabels[i]).join(', ')}
        </Text>
        <Text style={styles.small}>
          Goal {draft.goal} · Deadline {draft.deadline} · {draft.evidence.length} sources
        </Text>
        {command.error && <Notice error text={command.error.message} />}
      </Confirm>
    </Page>
  );
}
