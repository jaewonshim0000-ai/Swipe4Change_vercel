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
  isExample,
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
  Kicker,
  GlassPill,
  Bar,
  toast,
  topicImage,
} from '../../src/components/kit';
import { Glyph, GlyphName } from '../../src/components/glyph';
import { CityField } from '../../src/components/city-picker';
import { RecipientHelp } from '../../src/components/recipient-finder';
import { PhotoField, PhotoValue, savePhoto } from '../../src/components/photo-field';
import { DraftWriter } from '../../src/components/draft-writer';
import { heldMessage } from '../../src/components/held-notice';
import { SimilarPetitions } from '../../src/components/similar-petitions';
import { similarPetitions } from '../../src/domain/similar';
import { isSampleCity } from '../../src/data/civic-lookup';
import { anim, kf, reducedMotion, transition } from '../../src/components/motion';
import { useResponsiveLayout } from '../../src/components/responsive';
import { gradient, gradients, shadows, topicColors } from '../../src/components/theme';
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
/**
 * Phones ask one question per screen (the v3 design's Write flow); desktop keeps the four steps.
 * `step` is the desktop step that holds the same fields, so saved drafts resume in either layout.
 */
const questions: {
  key: string;
  step: number;
  q: string;
  hint: string;
  fields: (keyof Draft)[];
  example?: string;
}[] = [
  {
    key: 'title',
    step: 0,
    q: 'What should we call your petition?',
    hint: 'Short and specific works best: what changes, and where.',
    fields: ['title'],
    example: 'A brighter walk home from the Eastbridge bus stop',
  },
  {
    key: 'problem',
    step: 1,
    q: 'What’s the problem you’ve noticed?',
    hint: 'Who is affected, where and when. Stick to what you know first-hand.',
    fields: ['problem'],
    example:
      'Evening classes end after sunset, and the path from the campus gate to the bus shelter has long gaps between lights.',
  },
  {
    key: 'action',
    step: 0,
    q: 'What exactly should change?',
    hint: 'One clear request someone can say yes to.',
    fields: ['action'],
    example:
      'Assess the path and publish a pedestrian-lighting plan before winter evening classes.',
  },
  {
    key: 'city',
    step: 0,
    q: 'Where is this happening?',
    hint: 'An approximate place is enough. Never share a home address.',
    fields: ['city'],
  },
  {
    key: 'topic',
    step: 1,
    q: 'Which topic fits best?',
    hint: 'Topics help neighbors who care about this find it.',
    fields: ['topic'],
  },
  {
    key: 'community',
    step: 1,
    q: 'Which community is it for?',
    hint: 'Every petition belongs to a community. Its members can back it.',
    fields: ['communityId'],
  },
  {
    key: 'recipient',
    step: 0,
    q: 'Who has the power to make this change?',
    hint: 'Name the office or official. Suggestions only; you choose.',
    fields: ['recipient'],
  },
  {
    key: 'summary',
    step: 1,
    q: 'Sum it up in one sentence.',
    hint: 'This line sits under your title on every card.',
    fields: ['summary'],
    example: 'Students ask for a lighting plan for the campus path.',
  },
  {
    key: 'backing',
    step: 1,
    q: 'Anything to back it up?',
    hint: 'Optional. A labelled link or a photo helps people trust your request.',
    fields: ['evidence'],
  },
  {
    key: 'goal',
    step: 2,
    q: 'How many signatures would make it count?',
    hint: 'Pick a goal you can reach, and how long it runs.',
    fields: ['goal', 'deadline'],
  },
  {
    key: 'verify',
    step: 2,
    q: 'Who should be able to sign?',
    hint: 'Stricter rules make each signature count for more, but fewer people can sign.',
    fields: ['verification', 'customRule'],
  },
  {
    key: 'identities',
    step: 2,
    q: 'How can signers appear publicly?',
    hint: 'Signers pick one of the names you allow. Choose at least one.',
    fields: ['identities'],
  },
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
/** The design's question block: a white card with a hairline border. */
const white = {
  backgroundColor: colors.white,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.line,
  padding: 20,
  gap: 16,
  ...shadows.card,
};
/** A one-question screen's question, in the design's large type. */
const questionTitle = {
  fontFamily: fonts.bold,
  fontSize: 28,
  lineHeight: 35,
  letterSpacing: -0.5,
  color: colors.ink,
};

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
        <Circle cx={32} cy={32} r={27} fill="none" stroke={colors.track} strokeWidth={7} />
        <AnimatedCircle
          cx={32}
          cy={32}
          r={27}
          fill="none"
          stroke={score >= 80 ? colors.accent : score >= 50 ? colors.orange : colors.heart}
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

/** The phone start screen's choices: an icon orb, a bold title, one line and a chevron. */
function StartChoice({
  icon,
  title,
  body,
  ai = false,
  onPress,
}: {
  icon: GlyphName;
  title: string;
  body: string;
  ai?: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={[
        { borderRadius: 20, padding: ai ? 1.5 : 1, backgroundColor: colors.line },
        ai && gradient(gradients.ai),
        shadows.card,
      ]}
    >
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        scale={0.98}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: colors.white,
          borderRadius: 18,
          padding: 16,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: colors.soft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name={icon} size={24} weight={2} color={colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.ink }}>{title}</Text>
          <Text
            style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted }}
          >
            {body}
          </Text>
        </View>
        <Glyph name="next" size={20} color={colors.muted} />
      </Press>
    </View>
  );
}

/** A quick-pick tile for the goal and run-time questions. */
function Tile({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${sub}`}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: '40%',
        minHeight: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? colors.dark : colors.line,
        backgroundColor: selected ? colors.soft : colors.white,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{label}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{sub}</Text>
    </Press>
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
  const { wide } = useResponsiveLayout();
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
  // Phones: the start screen, the AI writer, one question at a time, then the review.
  const [stage, setStage] = useState<'intro' | 'ai' | 'q' | 'review'>(
    saved ? (saved.step >= 3 ? 'review' : 'q') : 'intro',
  );
  const [question, setQuestion] = useState(() =>
    Math.max(
      0,
      questions.findIndex((x) => x.step === saved?.step),
    ),
  );
  const [showExample, setShowExample] = useState(false);
  /** Editing one answer from the review returns to the review. */
  const [backToReview, setBackToReview] = useState(false);
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
          ? `Starting a petition with ${picked.name}. You can change the community before publishing.`
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
  const current = questions[question];
  /** The desktop step this place in the flow belongs to, which is what a saved draft records. */
  const atStep = wide ? step : stage === 'review' ? 3 : stage === 'q' ? current.step : 0;
  function saveDraft() {
    command.mutate(
      { type: 'saveDraft', id, draft: form.getValues(), step: atStep },
      { onSuccess: () => toast('Draft saved privately. Continue it from Profile.') },
    );
  }
  function keepBackup() {
    return AsyncStorage.setItem(draftKey, JSON.stringify(form.getValues())).catch(() =>
      setDraftMessage('Draft backup unavailable. Keep this page open.'),
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
      await keepBackup();
    }
  }
  function ask(index: number) {
    setShowExample(false);
    setQuestion(index);
    setStage('q');
  }
  async function nextQuestion() {
    if (!(await form.trigger(current.fields))) return;
    if (backToReview || question === questions.length - 1) {
      setBackToReview(false);
      setStage('review');
    } else ask(question + 1);
    await keepBackup();
  }
  function applyTemplate(t: (typeof templates)[number]) {
    setTemplate(t.label);
    form.setValue('topic', t.topic);
    form.setValue('action', t.action);
    form.setValue('recipient', t.recipient);
  }
  function input(
    name: 'title' | 'summary' | 'problem' | 'action' | 'recipient' | 'customRule',
    label: string,
    placeholder: string,
    multiline = false,
    big = false,
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
            style={big ? { fontSize: 18, lineHeight: 26 } : undefined}
          />
        )}
      />
    );
  }
  function publish() {
    if (photo && photo.alt.trim().length < 5) {
      setConfirm(false);
      setStep(1);
      ask(questions.findIndex((x) => x.key === 'backing'));
      toast('Describe your photo for people using screen readers, or remove it.');
      return;
    }
    void form.handleSubmit(
      (values) =>
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
      // An answer that fails the checks: open the question (or step) it belongs to.
      (errors) => {
        setConfirm(false);
        const index = questions.findIndex((x) => x.fields.some((f) => f in errors));
        if (index < 0) return;
        setStep(questions[index].step);
        ask(index);
        toast('Answer this question before publishing.');
      },
    )();
  }
  function startAnother() {
    setId(Crypto.randomUUID());
    form.reset(blank(home, homeCity));
    setPublished(null);
    setUndo(null);
    setTemplate('');
    setPhoto(null);
    setDraftMessage('');
    setStep(0);
    setQuestion(0);
    setStage('intro');
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
  const suggestions = [
    {
      field: 'title' as const,
      label: 'Suggested title, built from your own fields',
      value: analysis.title,
    },
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
  ].filter(
    (x) =>
      x.value &&
      x.value !== draft[x.field] &&
      (wide
        ? step === 0
          ? x.field === 'title'
          : step === 1 && x.field !== 'title'
        : stage === 'q' && x.field === current.key),
  );
  const community = q.data.communities.find((c) => c.id === draft.communityId);
  // Real petitions never go into the fictional example communities.
  const choices = q.data.communities.filter((c) => !isExample(c.id));
  const live = published ? q.data.petitions.find((p) => p.id === published) : undefined;
  const held = live ? heldMessage(live) : null;
  const unverified = !q.data.profile.emailVerified;
  const showSimilar =
    published === null &&
    (wide
      ? step === 0 || step === 3
      : stage === 'review' || (stage === 'q' && ['title', 'action'].includes(current.key)));
  const similar = showSimilar
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

  const saveButton = (
    <Press
      accessibilityLabel="Save draft"
      disabled={!ready || command.isPending}
      onPress={saveDraft}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.handle,
        borderRadius: 999,
        minHeight: 44,
        paddingHorizontal: 16,
      }}
    >
      <Glyph name="bookmark" size={16} weight={2} color={colors.dark} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.dark }}>
        Save draft
      </Text>
    </Press>
  );
  const progress = (done: number, label: string) => (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        height: 4,
        borderRadius: 4,
        marginTop: 14,
        marginBottom: 24,
        backgroundColor: colors.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          { height: '100%', width: `${done * 100}%`, backgroundColor: colors.sage },
          gradient(gradients.bar),
          transition(['width'], 400),
        ]}
      />
    </View>
  );
  const message = !!draftMessage && (
    <View style={{ marginBottom: 12 }}>
      <Notice text={draftMessage} />
    </View>
  );
  const cityField = (
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
  );
  const recipientFields = (
    <>
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
        onPick={(recipient) => form.setValue('recipient', recipient, { shouldValidate: true })}
      />
    </>
  );
  const noCommunity = (
    <>
      <Notice text="There are no communities yet. Every petition belongs to one, so start a community for your town or cause, then come back here. What you have written stays on this device." />
      <View style={styles.row}>
        <Button
          title="Start a community"
          variant="secondary"
          onPress={() => void keepBackup().then(() => router.push('/(tabs)/communities'))}
        />
      </View>
    </>
  );
  const communityError = !!form.formState.errors.communityId && (
    <Text style={styles.error}>{form.formState.errors.communityId.message}</Text>
  );
  const evidenceFields = (
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
  );
  const photoField = <PhotoField value={photo} onChange={setPhoto} disabled={command.isPending} />;
  const verificationFields = (
    <>
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
          Location signatures need approval by a trusted administrator. Self-entered cities do not
          count.
        </Text>
      )}
    </>
  );
  const identityFields = (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {identityModes.map((m) => (
          <PillChip
            key={m}
            label={identityLabels[m]}
            height={wide ? 36 : 44}
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
    </>
  );
  const goalField = (label: string) => (
    <Controller
      control={form.control}
      name="goal"
      render={({ field, fieldState }) => (
        <Field
          label={label}
          keyboardType="number-pad"
          value={String(field.value)}
          onChangeText={(v) => field.onChange(Number(v.replace(/\D/g, '')))}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const setDays = (n: number) => form.setValue('deadline', isoIn(Math.min(365, Math.max(1, n))));
  const daysField = (
    <Field
      label="Days to run"
      keyboardType="number-pad"
      value={String(days)}
      onChangeText={(v) => setDays(Number(v.replace(/\D/g, '')) || 1)}
      error={form.formState.errors.deadline?.message}
    />
  );
  const lockNote = (
    <Text style={[styles.micro, { fontSize: 12 }]}>
      Signing rules lock after the first signature. Closes {draft.deadline}.
    </Text>
  );
  const previewBlock = (
    <>
      <View style={{ marginBottom: 12 }}>
        <Segmented
          options={['Card preview', 'Page preview']}
          value={preview}
          onChange={setPreview}
        />
      </View>
      {preview === 0 ? (
        <View
          style={[
            {
              aspectRatio: 3 / 3.6,
              maxHeight: 460,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: colors.dark,
              borderWidth: 1,
              borderColor: colors.line,
            },
            shadows.deck,
          ]}
        >
          <Cover
            source={photo ? { uri: photo.uri } : topicImage(draft.topic)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Scrim stops="rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,1) 100%" />
          {!photo && (
            <View style={{ position: 'absolute', top: 12, left: 12 }}>
              <GlassPill text="Illustrative photo · add your own" style={{ fontSize: 11 }} />
            </View>
          )}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 6 }}>
            <Kicker light topic={draft.topic} text={`${draft.topic} · ${draft.city}`} />
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.4,
                color: colors.white,
              }}
            >
              {draft.title || 'Your petition title'}
            </Text>
            <Text
              numberOfLines={3}
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 19,
                color: colors.onImage,
              }}
            >
              {draft.action || 'Add the exact change you are asking for.'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <View style={{ width: 88 }}>
                <Bar pct={0} tone="light" height={6} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.onImage }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.white }}>0</Text> of{' '}
                {draft.goal.toLocaleString()} · {days} days
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Glyph name="landmark" size={16} color={colors.onImage} />
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.onImage,
                }}
              >
                To {draft.recipient || 'no recipient yet'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[white, { gap: 10 }]}>
          <Text style={styles.label}>
            {draft.topic} · {draft.city} · {community?.name}
          </Text>
          <Text style={[styles.title, { fontSize: 28, lineHeight: 34 }]}>
            {draft.title || 'Untitled petition'}
          </Text>
          <Text style={styles.body}>{draft.action}</Text>
          <Text style={styles.h3}>Why it matters</Text>
          <Text style={styles.body}>{draft.problem || 'Describe the problem first.'}</Text>
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
    </>
  );
  const publishedPanel = published !== null && (
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>
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
  );
  const suggestionCards = (
    <>
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
              fontSize: 15,
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
    </>
  );
  const writingCheck = (
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
              fontSize: 15,
              lineHeight: 20,
              color: colors.ink,
              marginTop: 4,
            }}
          >
            {scoreLabel}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}>
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
      {suggestionCards}
      <Text style={[styles.micro, { fontSize: 11 }]}>
        Advisory only. This score and these tips use simple rules on your own words. The ✦ helpers
        use AI (Claude) and only suggest; nothing here checks your facts.
      </Text>
    </View>
  );
  const notices = (
    <>
      {atStep === 3 && unverified && published === null && (
        <View style={{ marginTop: 12 }}>
          <Notice text="Publishing needs a verified email address, which keeps spam accounts from flooding the app. Verify your email in your account, then publish. You can save this as a draft meanwhile." />
        </View>
      )}
      {command.error && (
        <View style={{ marginTop: 12 }}>
          <Notice error text={command.error.message} />
        </View>
      )}
    </>
  );
  const publishButton = (
    <Button
      title={unverified ? 'Verify your email to publish' : 'Publish petition'}
      style={{ flex: 1 }}
      disabled={command.isPending || unverified}
      onPress={() => setConfirm(true)}
    />
  );
  const afterPublish = (
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
  );
  const publishConfirm = (
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
  );

  if (!wide) {
    // The phone header: back, where you are, and Save draft.
    const header = (where: string, onBack?: () => void) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        {onBack && (
          <CircleButton label="Back" light={false} onPress={onBack}>
            <Glyph name="back" size={18} weight={2} />
          </CircleButton>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>Start a petition</Text>
          <Text
            style={{ marginTop: 2, fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}
          >
            {where}
          </Text>
        </View>
        {saveButton}
      </View>
    );
    if (stage === 'intro') {
      const started = !!(draft.title || draft.problem || draft.action);
      return (
        <Screen key="intro">
          <Animated.View style={[{ gap: 14 }, anim(kf.in, 450)]}>
            <Text style={styles.label}>Start a petition</Text>
            <Text accessibilityRole="header" style={questionTitle}>
              What would you like to change?
            </Text>
            <Text style={[styles.muted, { fontSize: 16, lineHeight: 24 }]}>
              Answer {questions.length} short questions, one at a time. Every answer stays editable
              until you publish.
            </Text>
            {message}
            {started && (
              <StartChoice
                icon="clock"
                title="Continue your draft"
                body="Pick up where you left off and review your answers."
                onPress={() => setStage('review')}
              />
            )}
            <StartChoice
              ai
              icon="sparkle"
              title="Draft it with AI"
              body="Describe the problem in your own words. AI turns it into a first draft and never adds facts, numbers or names."
              onPress={() => setStage('ai')}
            />
            <StartChoice
              icon="write"
              title="Write it myself"
              body="Answer each question yourself, with an example for the written ones."
              onPress={() => ask(0)}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Or start from a template</Text>
            <Rail>
              {templates
                .filter((t) => t.action)
                .map((t) => (
                  <PillChip
                    key={t.label}
                    label={t.label}
                    selected={template === t.label}
                    onPress={() => {
                      applyTemplate(t);
                      ask(0);
                    }}
                  />
                ))}
            </Rail>
          </Animated.View>
        </Screen>
      );
    }
    if (stage === 'ai')
      return (
        <Screen key="ai">
          {header('Draft it with AI', () => setStage('intro'))}
          <View style={{ height: 20 }} />
          <DraftWriter form={form} />
          <Button title="Go to the questions" variant="secondary" onPress={() => ask(0)} />
        </Screen>
      );
    if (stage === 'review') {
      const answers: Record<string, string> = {
        title: draft.title,
        problem: draft.problem,
        action: draft.action,
        summary: draft.summary,
        city: draft.city,
        topic: draft.topic,
        community: community?.name ?? '',
        recipient: draft.recipient,
        backing:
          [
            draft.evidence.length
              ? `${draft.evidence.length} source${draft.evidence.length === 1 ? '' : 's'}`
              : '',
            photo ? 'Photo' : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'Nothing added (optional)',
        goal: `${draft.goal.toLocaleString()} signatures · ${days} days`,
        verify: verificationLabels[draft.verification],
        identities: draft.identities.map((i) => identityLabels[i]).join(', '),
      };
      return (
        <Screen key="review">
          {header('Review', published === null ? () => ask(questions.length - 1) : undefined)}
          {progress(1, 'Review')}
          <Animated.View style={anim(kf.tickA, 450)}>
            <Text accessibilityRole="header" style={[questionTitle, { marginBottom: 8 }]}>
              {steps[3][0]}
            </Text>
            <Text style={[styles.muted, { fontSize: 15, lineHeight: 22, marginBottom: 20 }]}>
              {steps[3][1]}
            </Text>
            {!!similar.length && <View style={{ marginBottom: 14 }}>{similarPanel}</View>}
            {previewBlock}
            {publishedPanel}
            {writingCheck}
            {published === null && (
              <View style={[white, { marginTop: 14, gap: 0, paddingVertical: 6 }]}>
                {questions.map((x, i) => (
                  <Press
                    key={x.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit: ${x.q}`}
                    scale={0.99}
                    onPress={() => {
                      setBackToReview(true);
                      ask(i);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      borderTopWidth: i ? 1 : 0,
                      borderColor: colors.line,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text
                        style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}
                      >
                        {i + 1}. {x.q}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontFamily: fonts.medium,
                          fontSize: 15,
                          lineHeight: 21,
                          color: answers[x.key] ? colors.ink : colors.error,
                        }}
                      >
                        {answers[x.key] || 'Needs an answer'}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>
                      Edit
                    </Text>
                  </Press>
                ))}
              </View>
            )}
          </Animated.View>
          {notices}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {published !== null ? afterPublish : publishButton}
          </View>
          {publishConfirm}
        </Screen>
      );
    }
    // One question per screen.
    const last = question === questions.length - 1;
    return (
      // Keyed per question so each one opens at the top.
      <Screen key={question}>
        {header(`Question ${question + 1} of ${questions.length}`, () =>
          question ? ask(question - 1) : setStage('intro'),
        )}
        {progress(
          (question + 1) / (questions.length + 1),
          `Question ${question + 1} of ${questions.length}`,
        )}
        <Animated.View
          key={question}
          style={[{ gap: 14 }, anim(question % 2 ? kf.tickA : kf.tickB, 450)]}
        >
          <Text accessibilityRole="header" style={questionTitle}>
            {current.q}
          </Text>
          <Text style={[styles.muted, { fontSize: 15, lineHeight: 22, marginTop: -6 }]}>
            {current.hint}
          </Text>
          {!!current.example && (
            <Press
              accessibilityRole="button"
              onPress={() => setShowExample(!showExample)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
            >
              <Glyph name="bulb" size={18} weight={2} color={colors.accent} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>
                {showExample ? 'Hide the example' : 'Show an example'}
              </Text>
            </Press>
          )}
          {showExample && !!current.example && (
            <Animated.View
              style={[
                { backgroundColor: colors.soft, borderRadius: 16, padding: 14, gap: 8 },
                anim(kf.in, 300),
              ]}
            >
              <Text style={[styles.label, { fontSize: 11 }]}>Example</Text>
              <Text
                style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink }}
              >
                {current.example}
              </Text>
              <Button
                title="Use this as a starting point"
                variant="secondary"
                style={{ alignSelf: 'flex-start', minHeight: 38 }}
                onPress={() => {
                  form.setValue(
                    current.fields[0] as 'title' | 'problem' | 'action' | 'summary',
                    current.example ?? '',
                    { shouldValidate: true },
                  );
                  setShowExample(false);
                }}
              />
            </Animated.View>
          )}
          {current.key === 'title' &&
            input('title', 'Petition title', 'A brighter walk home starts here', false, true)}
          {current.key === 'problem' &&
            input(
              'problem',
              'The problem',
              'What have you noticed, and who does it affect?',
              true,
              true,
            )}
          {current.key === 'action' &&
            input(
              'action',
              'The exact change you’re asking for',
              'Install pedestrian lighting along the Eastbridge campus path by March 2027',
              true,
              true,
            )}
          {current.key === 'summary' &&
            input(
              'summary',
              'One-sentence summary',
              'Students ask for a lighting plan for the campus path.',
              true,
              true,
            )}
          {current.key === 'city' && cityField}
          {current.key === 'topic' &&
            topics.map((t) => (
              <OptionCard
                key={t}
                label={`${topicColors[t].emoji}  ${t}`}
                selected={draft.topic === t}
                onPress={() => form.setValue('topic', t)}
              />
            ))}
          {current.key === 'community' && (
            <>
              {choices.length
                ? choices.map((c) => (
                    <OptionCard
                      key={c.id}
                      label={c.name}
                      note={`${c.members.toLocaleString()} members · ${c.city}`}
                      selected={draft.communityId === c.id}
                      onPress={() => form.setValue('communityId', c.id, { shouldValidate: true })}
                    />
                  ))
                : noCommunity}
              {communityError}
            </>
          )}
          {current.key === 'recipient' && recipientFields}
          {current.key === 'backing' && (
            <>
              {photoField}
              {evidenceFields}
            </>
          )}
          {current.key === 'goal' && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[100, 250, 500, 1000].map((g) => (
                  <Tile
                    key={g}
                    label={g.toLocaleString()}
                    sub="signatures"
                    selected={draft.goal === g}
                    onPress={() => form.setValue('goal', g, { shouldValidate: true })}
                  />
                ))}
              </View>
              {goalField('Or another goal')}
              <Text style={[styles.label, { marginTop: 8 }]}>How long should it run?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[14, 30, 45, 90].map((n) => (
                  <Tile
                    key={n}
                    label={String(n)}
                    sub="days"
                    selected={days === n}
                    onPress={() => setDays(n)}
                  />
                ))}
              </View>
              {daysField}
              {lockNote}
            </>
          )}
          {current.key === 'verify' && verificationFields}
          {current.key === 'identities' && identityFields}
          {suggestionCards}
          {!!similar.length && similarPanel}
        </Animated.View>
        {command.error && (
          <View style={{ marginTop: 12 }}>
            <Notice error text={command.error.message} />
          </View>
        )}
        <View style={{ marginTop: 24 }}>
          <Button
            title={backToReview ? 'Back to review' : last ? 'Review' : 'Next'}
            onPress={() => void nextQuestion()}
          />
        </View>
        {publishConfirm}
      </Screen>
    );
  }

  return (
    <Screen>
      {/* The design's Write header: title, step count, a thin progress line, and Save draft. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>Start a petition</Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: fonts.semibold,
              fontSize: 14,
              color: colors.muted,
            }}
          >
            Step {step + 1} of 4
          </Text>
        </View>
        {saveButton}
      </View>
      {progress((step + 1) / 4, `Step ${step + 1} of 4`)}
      {message}
      <Animated.View key={step} style={anim(step % 2 ? kf.tickA : kf.tickB, 450)}>
        <Text accessibilityRole="header" style={[questionTitle, { marginBottom: 8 }]}>
          {steps[step][0]}
        </Text>
        <Text style={[styles.muted, { fontSize: 15, lineHeight: 22, marginBottom: 20 }]}>
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
                  onPress={() => applyTemplate(t)}
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
              {cityField}
              {recipientFields}
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
            {photoField}
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
              {choices.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {choices.map((c) => (
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
                noCommunity
              )}
              {communityError}
            </View>
            {evidenceFields}
          </View>
        )}
        {step === 2 && (
          <View style={[white, { gap: 10 }]}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
              Who may sign
            </Text>
            {verificationFields}
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
            {identityFields}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>{goalField('Signature goal')}</View>
              <View style={{ flex: 1 }}>{daysField}</View>
            </View>
            {lockNote}
          </View>
        )}
        {step === 3 && (
          <>
            {!!similar.length && <View style={{ marginBottom: 14 }}>{similarPanel}</View>}
            {previewBlock}
            {publishedPanel}
          </>
        )}
      </Animated.View>

      {writingCheck}
      {notices}
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
          afterPublish
        ) : step < 3 ? (
          <Button
            title="Continue"
            style={{ flex: 1 }}
            disabled={command.isPending}
            onPress={() => void next()}
          />
        ) : (
          publishButton
        )}
      </View>
      {publishConfirm}
    </Screen>
  );
}
