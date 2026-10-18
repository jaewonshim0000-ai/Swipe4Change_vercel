import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Draft,
  identityLabels,
  identityModes,
  topics,
  verificationLabels,
} from '../../src/domain/model';
import { analyzeDraft, draftSchema, evidenceSchema } from '../../src/domain/rules';
import { plainLanguage, TARGET_GRADE } from '../../src/domain/plain-language';
import { suggestOffices } from '../../src/domain/recipients';
import { writingSupport } from '../../src/domain/writing-assistant';
import {
  isDemo,
  offeredVerifications,
  useBackend,
  useCommand,
  useSnapshot,
} from '../../src/data/provider';
import { OptionCard } from '../../src/components/signature-consent';
import {
  CircleButton,
  Cover,
  DrawnCheck,
  PillChip,
  Press,
  Rail,
  Scrim,
  Screen,
  Segmented,
  StepBars,
  TopicPill,
  toast,
  topicImage,
} from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { CityField } from '../../src/components/city-picker';
import { RecipientHelp } from '../../src/components/recipient-finder';
import { PhotoField, PhotoValue, savePhoto } from '../../src/components/photo-field';
import { DraftWriter } from '../../src/components/draft-writer';
import { heldMessage } from '../../src/components/held-notice';
import { SimilarPetitions } from '../../src/components/similar-petitions';
import { similarPetitions } from '../../src/domain/similar';
import { isSampleCity } from '../../src/data/civic-lookup';
import { anim, kf, reducedMotion } from '../../src/components/motion';
import {
  Button,
  Confirm,
  Field,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';

const DAY = 86400000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
// The demo starts in its fictional Riverton community; the live app starts empty and the person
// chooses (a live project has no fictional communities, so that default would always be refused).
const blank = (
  communityId = isDemo ? '10000000-0000-4000-8000-000000000001' : '',
  city = isDemo ? 'Riverton, CA' : '',
): Draft => ({
  title: '',
  summary: '',
  problem: '',
  action: '',
  recipient: '',
  topic: 'Safer streets',
  city,
  communityId,
  goal: 500,
  deadline: isoIn(45),
  evidence: [],
  verification: 'email',
  identities: ['full_name', 'first_name_last_initial', 'anonymous'],
  customRule: '',
});
const steps = [
  ['Define the change', 'One specific, checkable request — and who can actually make it.'],
  ['Build the case', 'What you noticed, and a labelled source if you have one.'],
  ['Configure participation', 'Who may sign, your goal, and how long it runs.'],
  ['Review and publish', 'Exactly what people will see on the deck.'],
];
const templates = [
  {
    label: 'Safer walk home',
    topic: 'Safer streets',
    action: 'Install pedestrian lighting along the route by March 2027',
    recipient: isDemo ? 'Riverton Public Works (fictional)' : '',
  },
  {
    label: 'Welcoming place',
    topic: 'Accessibility',
    action: 'Add an accessible entrance to the park',
    recipient: isDemo ? 'Riverton ADA Coordinator (fictional)' : '',
  },
  { label: 'Blank page', topic: 'Safer streets', action: '', recipient: '' },
] as const;
const eligibilityNotes = {
  account: 'Anyone signed in',
  email: 'Checked privately, never shown',
  community: 'Members of your community',
  location: 'Approved residents of the area',
  custom: 'You review short statements',
};
const flagLabels: Record<string, string> = {
  'A specific requested action': 'Specific action',
  'A responsible recipient': 'Recipient',
  'A clear problem': 'Problem',
  'An approximate location': 'Location',
  'A future deadline': 'Deadline',
  'At least one supplied source (not fact-checked)': 'Evidence',
  'A measurable signature goal': 'Goal',
};
const white = { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 14 };

export default function CreateRoute() {
  const q = useSnapshot();
  const params = useLocalSearchParams<{ draftId?: string; communityId?: string }>();
  if (q.isPending) return <Loading variant="form" />;
  return (
    <Create
      key={`${q.data?.profile?.id ?? 'guest'}-${params.draftId ?? ''}-${params.communityId ?? ''}`}
      selectedDraftId={params.draftId}
      communityId={params.communityId}
    />
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 169.6;
/** The assistant's 0–100 completeness score as a filling ring. */
function ScoreRing({ score }: { score: number }) {
  const offset = useSharedValue(RING);
  useEffect(() => {
    const target = RING * (1 - score / 100);
    offset.set(
      reducedMotion()
        ? target
        : withTiming(target, { duration: 700, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
    );
  }, [score, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Completeness score ${score} of 100`}
      style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={64}
        height={64}
        viewBox="0 0 64 64"
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={32} cy={32} r={27} fill="none" stroke={colors.canvas} strokeWidth={7} />
        <AnimatedCircle
          cx={32}
          cy={32}
          r={27}
          fill="none"
          stroke={colors.sage}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={RING}
          animatedProps={props}
        />
      </Svg>
      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>{score}</Text>
    </View>
  );
}

function Create({
  selectedDraftId,
  communityId,
}: {
  selectedDraftId?: string;
  /** Opened from a community page: a fresh draft for that community and its city. */
  communityId?: string;
}) {
  const q = useSnapshot();
  const command = useCommand();
  const { adapter } = useBackend();
  // Photos are attached after publishing; drafts keep their text only.
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [id, setId] = useState(() =>
    selectedDraftId && selectedDraftId !== 'new' ? selectedDraftId : Crypto.randomUUID(),
  );
  const hydrated = useRef(false);
  const [initialSnapshot] = useState(q.data);
  const [picked] = useState(() => initialSnapshot?.communities.find((c) => c.id === communityId));
  const home = picked?.id ?? initialSnapshot?.profile?.joined[0];
  const homeCity = picked?.city || initialSnapshot?.profile?.city || undefined;
  // A draft picked from Profile is already in the snapshot, so it restores on the first render.
  const [saved] = useState(() => initialSnapshot?.drafts?.find((d) => d.id === selectedDraftId));
  const [ready, setReady] = useState(!!saved || selectedDraftId === 'new' || !!picked);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [template, setTemplate] = useState('');
  const [preview, setPreview] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  /** Similar petitions the creator said differ from theirs, hidden for the rest of this draft. */
  const [different, setDifferent] = useState<string[]>([]);
  const [now] = useState(Date.now);
  const [undo, setUndo] = useState<{
    field: 'title' | 'summary' | 'problem';
    value: string;
  } | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [draftMessage, setDraftMessage] = useState(
    saved
      ? 'Restored your private draft.'
      : selectedDraftId && selectedDraftId !== 'new'
        ? 'This draft is unavailable. Start a new draft from your profile.'
        : picked
          ? `Starting a petition with ${picked.name}. You can change the community in step 2.`
          : '',
  );
  const form = useForm<Draft>({
    resolver: zodResolver(draftSchema),
    defaultValues: saved ? { ...blank(home, homeCity), ...saved.draft } : blank(home, homeCity),
    mode: 'onBlur',
  });
  const draft = useWatch({ control: form.control, compute: (values: Draft) => values });
  const analysis = analyzeDraft(draft);
  const clarity = plainLanguage(draft);
  const support = writingSupport(draft);
  const draftKey = `lookaware.draft.${q.data?.profile?.id ?? 'guest'}`;
  // Otherwise pick up the on-device backup of whatever was being written last.
  useEffect(() => {
    if (!initialSnapshot?.profile || hydrated.current || selectedDraftId || picked) return;
    hydrated.current = true;
    let active = true;
    void AsyncStorage.getItem(draftKey)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          form.reset({ ...blank(home, homeCity), ...JSON.parse(raw) });
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
    return () => {
      active = false;
    };
  }, [initialSnapshot, selectedDraftId, picked, draftKey, form, home, homeCity]);
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
          toast(`Draft saved privately at step ${step + 1}. Continue it from Profile.`),
      },
    );
  }
  async function next() {
    const fields: (keyof Draft)[][] = [
      ['title', 'action', 'recipient', 'city'],
      ['problem', 'summary', 'topic', 'communityId', 'evidence'],
      ['verification', 'identities', 'customRule', 'goal', 'deadline'],
    ];
    if (await form.trigger(fields[step])) {
      setStep(step + 1);
      await AsyncStorage.setItem(draftKey, JSON.stringify(form.getValues())).catch(() =>
        setDraftMessage('Draft backup unavailable. Keep this page open.'),
      );
    }
  }
  function input(
    name: 'title' | 'summary' | 'problem' | 'action' | 'recipient' | 'customRule',
    label: string,
    placeholder: string,
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
            placeholder={placeholder}
          />
        )}
      />
    );
  }
  function publish() {
    if (photo && photo.alt.trim().length < 5) {
      setConfirm(false);
      setStep(1);
      toast('Describe your photo for people using screen readers, or remove it.');
      return;
    }
    void form.handleSubmit((values) =>
      command.mutate(
        { type: 'create', draft: values, publish: true, draftId: id },
        {
          onSuccess: async (petitionId) => {
            setConfirm(false);
            setPublished(typeof petitionId === 'string' ? petitionId : '');
            void AsyncStorage.removeItem(draftKey);
            toast('Published. Your community can sign it now.');
            if (!photo || typeof petitionId !== 'string') return;
            try {
              await command.mutateAsync({
                type: 'photo',
                petitionId,
                photo: await savePhoto(adapter, photo),
              });
              setPhoto(null);
            } catch (e) {
              toast(
                `Published, but the photo was not added: ${e instanceof Error ? e.message : 'try again from Manage'}.`,
              );
            }
          },
        },
      ),
    )();
  }
  function startAnother() {
    setId(Crypto.randomUUID());
    form.reset(blank(home, homeCity));
    setPublished(null);
    setUndo(null);
    setTemplate('');
    setPhoto(null);
    setStep(0);
  }
  if (!q.data?.profile)
    return (
      <Page title="Your idea belongs here." eyebrow="Start a petition">
        <Button
          title="Sign in to start a petition"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </Page>
    );
  const days = Math.max(1, Math.ceil((Date.parse(draft.deadline) - now) / DAY) || 1);
  const scoreLabel =
    analysis.score >= 80
      ? 'Ready to share'
      : analysis.score >= 50
        ? 'Getting there'
        : 'Let’s build it up';
  const suggestions = (
    step === 0
      ? [
          {
            field: 'title' as const,
            label: 'Suggested title, built from your own fields',
            value: analysis.title,
          },
        ]
      : step === 1
        ? [
            {
              field: 'summary' as const,
              label: 'Suggested summary, built from your own fields',
              value: analysis.summary,
            },
            {
              field: 'problem' as const,
              label: 'Suggested structure for your petition text',
              value: support.body,
            },
          ]
        : []
  ).filter((x) => x.value && x.value !== draft[x.field]);
  const community = q.data.communities.find((c) => c.id === draft.communityId);
  const live = published ? q.data.petitions.find((p) => p.id === published) : undefined;
  const held = live ? heldMessage(live) : null;
  const unverified = !q.data.profile.emailVerified;
  const similar =
    published === null && (step === 0 || step === 3)
      ? similarPetitions(draft, q.data.petitions, now).filter(
          (m) => !different.includes(m.petition.id),
        )
      : [];
  const similarPanel = (
    <SimilarPetitions
      matches={similar}
      onDismiss={() => setDifferent([...different, ...similar.map((m) => m.petition.id)])}
    />
  );
  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Text style={styles.label}>Start a petition · {step + 1} of 4</Text>
        <Press
          accessibilityLabel="Save draft"
          disabled={!ready || command.isPending}
          onPress={saveDraft}
          style={{
            backgroundColor: colors.white,
            borderRadius: 999,
            minHeight: 36,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.dark }}>
            Save draft
          </Text>
        </Press>
      </View>
      <View style={{ marginTop: 14, marginBottom: 18 }}>
        <StepBars count={4} current={step} />
      </View>
      {!!draftMessage && (
        <View style={{ marginBottom: 12 }}>
          <Notice text={draftMessage} />
        </View>
      )}
      <Animated.View key={step} style={anim(step % 2 ? kf.tickA : kf.tickB, 450)}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { lineHeight: 32, marginBottom: 6 }]}
        >
          {steps[step][0]}
        </Text>
        <Text style={[styles.body, { fontSize: 14.5, color: colors.muted, marginBottom: 16 }]}>
          {steps[step][1]}
        </Text>
        {step === 0 && (
          <>
            <DraftWriter form={form} />
            <Rail style={{ marginBottom: 14 }}>
              {templates.map((t) => (
                <PillChip
                  key={t.label}
                  label={t.label}
                  selected={template === t.label}
                  onPress={() => {
                    setTemplate(t.label);
                    form.setValue('topic', t.topic);
                    form.setValue('action', t.action);
                    form.setValue('recipient', t.recipient);
                  }}
                />
              ))}
            </Rail>
            <View style={white}>
              {input('title', 'Petition title', 'A brighter walk home starts here')}
              {input(
                'action',
                'The exact change you’re asking for',
                'Install pedestrian lighting along the Eastbridge campus path by March 2027',
                true,
              )}
              <Controller
                control={form.control}
                name="city"
                render={({ field, fieldState }) => (
                  <CityField
                    label="Where is it happening?"
                    value={field.value}
                    onChange={(city) => form.setValue('city', city, { shouldValidate: true })}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {input('recipient', 'Who can make this change?', 'The office that can act on this')}
              {isSampleCity(draft.city) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 }}>
                  {suggestOffices(draft.topic, `${draft.problem} ${draft.action}`)
                    .slice(0, 3)
                    .map((o) => (
                      <PillChip
                        key={o.id}
                        label={o.name.replace(' (fictional)', '')}
                        height={32}
                        selected={draft.recipient === o.name}
                        onPress={() => form.setValue('recipient', o.name, { shouldValidate: true })}
                      />
                    ))}
                </View>
              )}
              <RecipientHelp
                draft={draft}
                onPick={(recipient) =>
                  form.setValue('recipient', recipient, { shouldValidate: true })
                }
              />
            </View>
            {!!similar.length && <View style={{ marginTop: 14 }}>{similarPanel}</View>}
          </>
        )}
        {step === 1 && (
          <View style={white}>
            {input(
              'problem',
              'The problem',
              'What have you noticed, and who does it affect?',
              true,
            )}
            {input(
              'summary',
              'One-sentence summary',
              'Students ask for a lighting plan for the campus path.',
              true,
            )}
            <PhotoField value={photo} onChange={setPhoto} disabled={command.isPending} />
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
                Topic
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {topics.map((t) => (
                  <PillChip
                    key={t}
                    label={t}
                    height={36}
                    selected={draft.topic === t}
                    onPress={() => form.setValue('topic', t)}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
                Community
              </Text>
              {q.data.communities.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {q.data.communities.map((c) => (
                    <PillChip
                      key={c.id}
                      label={c.name}
                      height={36}
                      selected={draft.communityId === c.id}
                      onPress={() => form.setValue('communityId', c.id, { shouldValidate: true })}
                    />
                  ))}
                </View>
              ) : (
                <>
                  <Notice text="There are no communities yet. Every petition belongs to one, so start a community for your town or cause, then come back here. What you have written stays on this device." />
                  <View style={styles.row}>
                    <Button
                      title="Start a community"
                      variant="secondary"
                      onPress={() =>
                        void AsyncStorage.setItem(draftKey, JSON.stringify(form.getValues()))
                          .catch(() => undefined)
                          .then(() => router.push('/(tabs)/communities'))
                      }
                    />
                  </View>
                </>
              )}
              {!!form.formState.errors.communityId && (
                <Text style={styles.error}>{form.formState.errors.communityId.message}</Text>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
                Evidence · labelled HTTPS link
              </Text>
              {draft.evidence.map((e, i) => (
                <View
                  key={`${e.url}-${i}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: colors.quiet,
                    borderRadius: 14,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Glyph name="link" size={15} weight={2} color={colors.accent} />
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}
                  >
                    {e.label}
                  </Text>
                  <Button
                    title="Remove"
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
              <Field
                label="Source label"
                value={sourceLabel}
                onChangeText={setSourceLabel}
                placeholder="Walk audit photos, 2026"
              />
              <Field
                label="Source HTTPS URL"
                value={sourceUrl}
                onChangeText={setSourceUrl}
                autoCapitalize="none"
                placeholder="https://…"
              />
              {!!sourceError && <Text style={styles.error}>{sourceError}</Text>}
              <Button
                title="Add source"
                variant="secondary"
                style={{ backgroundColor: colors.quiet }}
                onPress={() => {
                  try {
                    form.setValue('evidence', [
                      ...draft.evidence,
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
              <Text style={styles.micro}>
                Creator-supplied and not fact-checked. Add only what you can support; no private
                information.
              </Text>
            </View>
          </View>
        )}
        {step === 2 && (
          <View style={[white, { gap: 10 }]}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
              Who may sign
            </Text>
            {offeredVerifications.map((v) => (
              <OptionCard
                key={v}
                label={verificationLabels[v]}
                note={eligibilityNotes[v]}
                selected={draft.verification === v}
                onPress={() => form.setValue('verification', v)}
              />
            ))}
            {draft.verification === 'custom' &&
              input(
                'customRule',
                'Describe the custom eligibility rule',
                'Current Riverton students or staff',
                true,
              )}
            {draft.verification === 'location' && (
              <Text style={styles.micro}>
                Location signatures need approval by a trusted administrator. Self-entered cities do
                not count.
              </Text>
            )}
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 13,
                color: colors.secondary,
                marginTop: 6,
              }}
            >
              Public names signers may choose
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {identityModes.map((m) => (
                <PillChip
                  key={m}
                  label={identityLabels[m]}
                  height={36}
                  selected={draft.identities.includes(m)}
                  onPress={() =>
                    form.setValue(
                      'identities',
                      draft.identities.includes(m)
                        ? draft.identities.filter((x) => x !== m)
                        : [...draft.identities, m],
                    )
                  }
                />
              ))}
            </View>
            {form.formState.errors.identities && (
              <Text style={styles.error}>
                {form.formState.errors.identities.message ?? 'Choose at least one.'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Controller
                  control={form.control}
                  name="goal"
                  render={({ field, fieldState }) => (
                    <Field
                      label="Signature goal"
                      keyboardType="number-pad"
                      value={String(field.value)}
                      onChangeText={(v) => field.onChange(Number(v.replace(/\D/g, '')))}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Days to run"
                  keyboardType="number-pad"
                  value={String(days)}
                  onChangeText={(v) =>
                    form.setValue(
                      'deadline',
                      isoIn(Math.min(365, Math.max(1, Number(v.replace(/\D/g, '')) || 1))),
                    )
                  }
                  error={form.formState.errors.deadline?.message}
                />
              </View>
            </View>
            <Text style={[styles.micro, { fontSize: 12 }]}>
              Signing rules lock after the first signature. Closes {draft.deadline}.
            </Text>
          </View>
        )}
        {step === 3 && (
          <>
            {!!similar.length && <View style={{ marginBottom: 14 }}>{similarPanel}</View>}
            <View style={{ marginBottom: 12 }}>
              <Segmented
                options={['Card preview', 'Page preview']}
                value={preview}
                onChange={setPreview}
              />
            </View>
            {preview === 0 ? (
              <View
                style={{
                  height: 300,
                  borderRadius: 30,
                  overflow: 'hidden',
                  backgroundColor: colors.dark,
                  boxShadow: '0px 22px 40px -22px rgba(32,38,26,0.55)',
                }}
              >
                <Cover
                  source={photo ? { uri: photo.uri } : topicImage(draft.topic)}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <Scrim stops="rgba(18,20,15,0) 30%, rgba(18,20,15,0.9) 100%" />
                <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18, gap: 8 }}>
                  <TopicPill topic={draft.topic} />
                  <Text
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 24,
                      lineHeight: 27,
                      letterSpacing: -0.7,
                      color: colors.white,
                    }}
                  >
                    {draft.title || 'Untitled petition'}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 13,
                      lineHeight: 19.5,
                      color: colors.onImage,
                    }}
                  >
                    {draft.action || 'Add the exact change you are asking for.'}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.pale }}>
                    To {draft.recipient || 'no recipient yet'} · goal {draft.goal} · {days} days
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[white, { gap: 10 }]}>
                <Text style={styles.label}>
                  {draft.topic} · {draft.city} · {community?.name}
                </Text>
                <Text style={[styles.title, { fontSize: 27, lineHeight: 28 }]}>
                  {draft.title || 'Untitled petition'}
                </Text>
                <Text style={styles.body}>{draft.action}</Text>
                <Text style={styles.h3}>Why it matters</Text>
                <Text style={styles.body}>
                  {draft.problem || 'Describe the problem in step 2.'}
                </Text>
                <Text style={styles.h3}>Sources</Text>
                <Text style={styles.small}>
                  {draft.evidence.length
                    ? draft.evidence.map((e) => e.label).join(' · ')
                    : 'No sources supplied yet.'}
                </Text>
                <Text style={styles.small}>
                  {verificationLabels[draft.verification]} · Public names:{' '}
                  {draft.identities.map((i) => identityLabels[i]).join(', ')}
                </Text>
              </View>
            )}
            {published !== null && (
              <Animated.View
                style={[
                  {
                    marginTop: 14,
                    backgroundColor: colors.dark,
                    borderRadius: 24,
                    padding: 18,
                    flexDirection: 'row',
                    gap: 14,
                    alignItems: 'center',
                  },
                  anim(kf.pop, 500, { ease: 'ease' }),
                ]}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: colors.pale,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DrawnCheck size={22} color={colors.dark} delay={200} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>
                    {held ? 'Saved · not public yet' : 'Published · Change starter earned'}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.body,
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.onDark,
                    }}
                  >
                    {held ??
                      `Share it with ${community?.name ?? 'your community'}, then post updates from Manage.`}
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </Animated.View>

      <View style={[white, { marginTop: 14, gap: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ScoreRing score={analysis.score} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.label, { fontSize: 11, letterSpacing: 1.2 }]}>
              Writing check · local rules
            </Text>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14.5,
                lineHeight: 20,
                color: colors.ink,
                marginTop: 4,
              }}
            >
              {scoreLabel}
            </Text>
            <Text
              style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}
            >
              {clarity.words && clarity.grade
                ? `Reading grade ${clarity.grade} · target ${TARGET_GRADE} or below`
                : `Aim for reading grade ${TARGET_GRADE} or below`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {analysis.rubric.map((r) => (
            <Text
              key={r.label}
              style={{
                borderRadius: 999,
                overflow: 'hidden',
                paddingVertical: 5,
                paddingHorizontal: 10,
                fontFamily: fonts.semibold,
                fontSize: 11,
                backgroundColor: r.met ? colors.soft : colors.quiet,
                color: r.met ? colors.success : colors.muted,
              }}
            >
              {r.met ? '✓' : '○'} {flagLabels[r.label] ?? r.label}
            </Text>
          ))}
        </View>
        {!!clarity.issues[0] && (
          <Text style={[styles.small, { fontSize: 12 }]}>{clarity.issues[0].message}</Text>
        )}
        {suggestions.map((sg) => (
          <Animated.View
            key={sg.field}
            style={[
              { backgroundColor: colors.quiet, borderRadius: 14, padding: 12, gap: 8 },
              anim(kf.in, 350),
            ]}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              {sg.label}
            </Text>
            <Text
              numberOfLines={6}
              style={{
                fontFamily: fonts.heading,
                fontSize: 14.5,
                lineHeight: 19.5,
                color: colors.ink,
              }}
            >
              {sg.value}
            </Text>
            <Button
              title="Use this"
              style={{ alignSelf: 'flex-start', minHeight: 38 }}
              onPress={() => {
                setUndo({ field: sg.field, value: draft[sg.field] });
                form.setValue(sg.field, sg.value, { shouldValidate: true });
              }}
            />
          </Animated.View>
        ))}
        {undo && (
          <Button
            title="Undo suggestion"
            variant="secondary"
            style={{ alignSelf: 'flex-start', minHeight: 38, backgroundColor: colors.quiet }}
            onPress={() => {
              form.setValue(undo.field, undo.value);
              setUndo(null);
            }}
          />
        )}
        <Text style={[styles.micro, { fontSize: 11 }]}>
          Advisory only. This score and these tips use simple rules on your own words. The ✦ helpers
          use AI (Claude) and only suggest; nothing here checks your facts.
        </Text>
      </View>
      {step === 3 && unverified && published === null && (
        <View style={{ marginTop: 12 }}>
          <Notice text="Publishing needs a verified email address, which keeps spam accounts from flooding the app. Verify your email in your account, then publish. You can save this as a draft meanwhile." />
        </View>
      )}
      {command.error && (
        <View style={{ marginTop: 12 }}>
          <Notice error text={command.error.message} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {step > 0 && published === null && (
          <CircleButton
            label="Previous step"
            light={false}
            size={52}
            onPress={() => setStep(step - 1)}
          >
            <Glyph name="back" size={18} weight={2} />
          </CircleButton>
        )}
        {published !== null ? (
          <>
            <Button
              title="Start another"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={startAnother}
            />
            <Button
              title="View your petition"
              style={{ flex: 1.4 }}
              onPress={() => router.push(`/petition/${published}`)}
            />
          </>
        ) : (
          <Button
            title={
              step < 3
                ? 'Continue'
                : unverified
                  ? 'Verify your email to publish'
                  : 'Publish petition'
            }
            style={{ flex: 1 }}
            disabled={command.isPending || (step === 3 && unverified)}
            onPress={() => (step < 3 ? void next() : setConfirm(true))}
          />
        )}
      </View>
      <Confirm
        visible={confirm}
        title="Ready to share your petition?"
        body="Your title, requested action, sources, and signing rules will become public. Check that they are accurate and contain no private information."
        pending={command.isPending}
        confirmLabel="Publish"
        onCancel={() => setConfirm(false)}
        onConfirm={publish}
      >
        <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 6 }}>
          <Text style={styles.cardTitle}>{draft.title}</Text>
          <Text style={styles.small}>
            To {draft.recipient} · {draft.city}
          </Text>
          <Text style={styles.small}>
            {verificationLabels[draft.verification]} · goal {draft.goal} · closes {draft.deadline} ·{' '}
            {draft.evidence.length} sources
          </Text>
        </View>
        {command.error && <Notice error text={command.error.message} />}
      </Confirm>
    </Screen>
  );
}
