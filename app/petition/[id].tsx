import { readingFrame } from '../../src/components/responsive';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { isDemo, useCommand, useSnapshot } from '../../src/data/provider';
import { recordSignal } from '../../src/data/signals';
import {
  Entry,
  Petition,
  Snapshot,
  VolunteerRole,
  deliveryMethodLabels,
  identityLabels,
  volunteerRoleLabels,
  volunteerRoles,
} from '../../src/domain/model';
import { milestones, reachedMilestones } from '../../src/domain/rules';
import { milestoneLabel, requirementLabel } from '../../src/domain/discovery';
import { findOffice, levelLabels } from '../../src/domain/recipients';
import { officialNamed } from '../../supabase/functions/_shared/officials';
import { isSampleCity, useOfficials } from '../../src/data/civic-lookup';
import { HeldNotice } from '../../src/components/held-notice';
import { CommunityBacking } from '../../src/components/community-backing';
import { MySignature, SignatureConsent } from '../../src/components/signature-consent';
import { RipplePanel, rememberVia } from '../../src/components/ripple';
import { Progress, share, useSave } from '../../src/components/petition-card';
import {
  Composer,
  Entries,
  ManagerControl,
  Post,
  entryRemover,
} from '../../src/components/entries';
import {
  CircleButton,
  Heart,
  Initials,
  LiveDot,
  PillChip,
  Press,
  Scrim,
  Segmented,
  Sheet,
  TopicPill,
  initialsOf,
  toast,
  petitionImage,
} from '../../src/components/kit';
import { Glyph } from '../../src/components/glyph';
import { topicColors } from '../../src/components/theme';
import { anim, kf, reducedMotion } from '../../src/components/motion';
import {
  Button,
  Chip,
  Confirm,
  Empty,
  Field,
  Loading,
  Notice,
  Page,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';

const card = { backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 10 };
const cardTitle = { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22.5, color: colors.ink };
const supporterColors = [
  [colors.pale, colors.accent],
  [topicColors.Education.soft, topicColors.Education.accent],
  [topicColors['Public spaces'].soft, topicColors['Public spaces'].accent],
  [topicColors.Accessibility.soft, topicColors.Accessibility.accent],
];

/** Counts from 60% up to the real figure on arrival, and eases to each new count after that. */
function useCountUp(value: number) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : Math.round(value * 0.6)));
  const from = useRef(shown);
  useEffect(() => {
    if (reducedMotion()) return;
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 900);
      const v = Math.round(start + (value - start) * (1 - (1 - k) ** 3));
      from.current = v;
      setShown(v);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return reducedMotion() ? value : shown;
}

export default function Detail() {
  // `?sign=1` lets the Home deck's Sign action land straight in the signing sheet.
  // `?via=` is a supporter's ripple code from the link they shared.
  const {
    id,
    sign: signParam,
    volunteer: volunteerParam,
    via,
  } = useLocalSearchParams<{
    id: string;
    sign?: string;
    volunteer?: string;
    via?: string;
  }>();
  const q = useSnapshot();
  useEffect(() => {
    if (via) void rememberVia(id, via);
  }, [id, via]);
  // Opening a petition says a little about what you care about; staying to read says more.
  const loaded = !!q.data;
  const viewerId = q.data?.profile?.id;
  const personalize = q.data?.profile?.useSigningHistory !== false;
  useEffect(() => {
    if (!loaded) return;
    const viewer = viewerId ? { id: viewerId, useSigningHistory: personalize } : null;
    void recordSignal(viewer, id, 'detail');
    const timer = setTimeout(() => void recordSignal(viewer, id, 'dwell'), 20000);
    return () => clearTimeout(timer);
  }, [id, loaded, viewerId, personalize]);
  if (q.isPending) return <Loading variant="detail" />;
  if (q.error)
    return (
      <Page back>
        <Notice error text={q.error.message} />
        <Button title="Retry" onPress={() => void q.refetch()} />
      </Page>
    );
  const p = q.data.petitions.find((x) => x.id === id);
  if (!p)
    return (
      <Page back>
        <Empty
          title="Petition not found"
          body="This petition may be private, archived, or hidden while a report is reviewed."
        />
      </Page>
    );
  return (
    <PetitionPage
      key={p.id}
      petition={p}
      snapshot={q.data}
      via={via}
      sign={signParam === '1'}
      volunteer={volunteerParam === '1'}
    />
  );
}

function PetitionPage({
  petition: p,
  snapshot: s,
  via,
  sign: signInitially,
  volunteer: volunteerInitially,
}: {
  petition: Petition;
  snapshot: Snapshot;
  via?: string;
  sign: boolean;
  volunteer: boolean;
}) {
  const mutation = useCommand();
  const save = useSave(s);
  const insets = useSafeAreaInsets();
  const shown = useCountUp(p.count);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.max(0, scrollY.get()) * 0.45 },
      { scale: 1.04 + Math.min(Math.max(0, scrollY.get()), 300) / 2400 },
    ],
  }));
  const [tab, setTab] = useState(0);
  const [sign, setSign] = useState(signInitially && !!s.profile);
  const [offering, setOffering] = useState(volunteerInitially && !!s.profile);
  const myOffer = s.volunteering.find((v) => v.petitionId === p.id);
  const [roles, setRoles] = useState<VolunteerRole[]>(myOffer?.roles ?? []);
  const [helpNote, setHelpNote] = useState(myOffer?.note ?? '');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'question' | 'idea' | 'experience'>('question');
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const [donate, setDonate] = useState(false);
  const [statement, setStatement] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [removing, setRemoving] = useState<{
    scope: 'discussion' | 'update' | 'response';
    entry: Entry;
  } | null>(null);
  const signed = s.signed.includes(p.id);
  const saved = s.saved.includes(p.id);
  const community = s.communities.find((c) => c.id === p.communityId);
  const office = findOffice(p.recipient);
  const pendingSign = mutation.isPending && mutation.variables?.type === 'sign';
  const supporters = s.signatures
    .filter((x) => x.petitionId === p.id)
    .slice(-4)
    .reverse();
  const needAccount = (then: () => void) => (s.profile ? then() : router.push('/(auth)/sign-in'));
  const run = (command: Parameters<typeof mutation.mutate>[0], done: string, after?: () => void) =>
    mutation.mutate(command, {
      onSuccess: () => {
        after?.();
        toast(done);
      },
    });
  const updates = p.updates
    .filter((u) => !u.removed)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const actions = [
    { label: saved ? 'Saved' : 'Save', icon: <Heart on={saved} dark />, onPress: () => save(p) },
    {
      label: 'Share',
      icon: <Text style={{ fontSize: 18, color: colors.dark }}>↗</Text>,
      onPress: () => void share(p, s),
    },
    {
      label: myOffer ? 'Volunteering' : 'Volunteer',
      icon: <Text style={{ fontSize: 18 }}>✋</Text>,
      onPress: () => needAccount(() => setOffering(true)),
    },
    {
      label: 'Report',
      icon: <Text style={{ fontSize: 18, color: colors.muted }}>⚑</Text>,
      onPress: () => needAccount(() => setReport(true)),
    },
  ];
  return (
    <Animated.View
      style={[readingFrame, { flex: 1, backgroundColor: colors.canvas }, anim(kf.slide, 420)]}
    >
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
      >
        <View style={{ height: 330, overflow: 'hidden', backgroundColor: colors.dark }}>
          <Animated.View style={[{ width: '100%', height: '100%' }, parallax]}>
            <Image
              source={petitionImage(p)}
              resizeMode="cover"
              accessibilityLabel={
                p.photo
                  ? `Organizer’s photo: ${p.photo.alt}`
                  : 'Illustrative theme image, not petition evidence'
              }
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
          <Scrim stops="rgba(18,20,15,0.4) 0%, rgba(18,20,15,0) 40%" />
          <Text
            style={{
              position: 'absolute',
              right: 14,
              bottom: 44,
              backgroundColor: 'rgba(18,20,15,0.55)',
              color: colors.white,
              fontFamily: fonts.medium,
              fontSize: 11,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {p.photo ? 'Organizer’s photo' : 'Illustrative image'}
          </Text>
          <View
            style={{
              position: 'absolute',
              top: Math.max(insets.top, 12) + 4,
              left: 16,
              right: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <CircleButton
              label="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            >
              <Glyph name="back" size={19} weight={2} />
            </CircleButton>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CircleButton label="Share" onPress={() => void share(p, s)}>
                <Glyph name="share" size={18} />
              </CircleButton>
              <CircleButton label={saved ? 'Unsave' : 'Save'} onPress={() => save(p)}>
                <Heart on={saved} dark />
              </CircleButton>
            </View>
          </View>
        </View>
        <View
          style={{
            marginTop: -30,
            backgroundColor: colors.canvas,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 12,
            paddingHorizontal: 18,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.handle,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Animated.View
            style={[
              { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
              anim(kf.in, 500, { delay: 100 }),
            ]}
          >
            <TopicPill topic={p.topic} soft />
            <Chip label={p.city} />
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 11,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {p.status === 'active' && <LiveDot color={colors.success} size={6} />}
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 11,
                  color: p.status === 'active' ? colors.success : colors.muted,
                  textTransform: 'capitalize',
                }}
              >
                {p.status}
              </Text>
            </View>
          </Animated.View>
          <Animated.Text
            accessibilityRole="header"
            style={[
              {
                fontFamily: fonts.display,
                fontSize: 30,
                lineHeight: 33,
                letterSpacing: -1.2,
                color: colors.ink,
                marginTop: 14,
                marginBottom: 8,
              },
              anim(kf.in, 550, { delay: 160 }),
            ]}
          >
            {p.title}
          </Animated.Text>
          <Animated.Text
            style={[
              {
                fontFamily: fonts.body,
                fontSize: 14.5,
                lineHeight: 23,
                color: colors.secondary,
                marginBottom: 6,
              },
              anim(kf.in, 550, { delay: 220 }),
            ]}
          >
            {p.action.replace(/\.?$/, '.')}
          </Animated.Text>
          <Animated.Text
            style={[
              { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted },
              anim(kf.in, 550, { delay: 260 }),
            ]}
          >
            Started by {p.creator} · {community?.name ?? p.city}
          </Animated.Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <ManagerControl petition={p} profile={s.profile} />
            <HeldNotice petition={p} />
            {!!via && !signed && (
              <Notice text="Shared with you by someone who signed it. If you sign too, you join their ripple." />
            )}
          </View>

          <Animated.View
            style={[
              card,
              {
                borderRadius: 24,
                marginTop: 16,
                boxShadow: '0px 12px 28px -18px rgba(32,38,26,0.4)',
              },
              anim(kf.in, 600, { delay: 300 }),
            ]}
          >
            <Progress petition={p} shown={shown} />
            <View style={{ height: 1, backgroundColor: colors.canvas, marginVertical: 2 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {supporters.map((x, i) => (
                  <Animated.View
                    key={x.id}
                    style={[
                      { marginLeft: i ? -9 : 0 },
                      anim(kf.pop, 400, { delay: 400 + i * 80, ease: 'ease' }),
                    ]}
                  >
                    <Initials
                      text={x.identity === 'anonymous' ? 'A' : initialsOf(x.displayName)}
                      size={30}
                      bg={supporterColors[i % 4][0]}
                      fg={supporterColors[i % 4][1]}
                      ring={colors.white}
                    />
                  </Animated.View>
                ))}
              </View>
              <Text
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: fonts.body,
                  fontSize: 12,
                  lineHeight: 17,
                  color: colors.muted,
                }}
              >
                {supporters.length
                  ? `${signed ? 'You, ' : ''}${supporters
                      .slice(0, 2)
                      .map((x) => x.displayName)
                      .join(
                        ', ',
                      )} and ${Math.max(0, p.count - Math.min(2, supporters.length) - (signed ? 1 : 0)).toLocaleString()} others`
                  : p.count
                    ? `${p.count.toLocaleString()} supporters so far. Each appears only as they chose.`
                    : 'Be one of the first voices.'}
              </Text>
            </View>
            {p.viaShares > 0 && (
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.accent }}>
                {p.viaShares.toLocaleString()} signed because a supporter shared it
              </Text>
            )}
            <Text style={styles.micro}>
              {p.sampleCount > 0
                ? `${p.sampleCount.toLocaleString()} are fictional sample signatures · new ones checked against eligibility`
                : 'Signatures are checked against the configured eligibility rule'}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              { flexDirection: 'row', gap: 8, marginTop: 12 },
              anim(kf.in, 600, { delay: 360 }),
            ]}
          >
            {actions.map((a) => (
              <Press
                key={a.label}
                accessibilityLabel={a.label}
                scale={0.94}
                onPress={a.onPress}
                style={{
                  flex: 1,
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  paddingTop: 12,
                  paddingBottom: 10,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0px 8px 20px -16px rgba(32,38,26,0.4)',
                }}
              >
                {a.icon}
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.secondary }}
                >
                  {a.label}
                </Text>
              </Press>
            ))}
          </Animated.View>
          {!!p.donationUrl && (
            <Button
              title="Donate on the organizer’s page"
              variant="secondary"
              onPress={() => setDonate(true)}
              style={{ marginTop: 10 }}
            />
          )}
          {p.verification === 'community' &&
            s.profile &&
            !s.profile.joined.includes(p.communityId) && (
              <View style={[card, { marginTop: 12 }]}>
                <Text style={styles.muted}>
                  Only members of {community?.name ?? 'this community'} can sign this petition.
                </Text>
                <Button
                  title="Join the community"
                  disabled={mutation.isPending}
                  onPress={() =>
                    run(
                      { type: 'join', communityId: p.communityId },
                      `Welcome to ${community?.name ?? 'the community'}!`,
                    )
                  }
                />
              </View>
            )}
          {p.verification === 'custom' &&
            s.profile &&
            !s.customApprovals.includes(p.id) &&
            !signed && (
              <View style={[card, { marginTop: 12 }]}>
                <Text style={cardTitle}>Request eligibility review</Text>
                <Text style={styles.small}>{p.customRule}</Text>
                <Text style={styles.small}>
                  The organizer sees this statement and your abbreviated name. Do not include
                  addresses, emails, or private evidence.
                </Text>
                <Field
                  label="Non-sensitive eligibility statement"
                  multiline
                  value={statement}
                  onChangeText={setStatement}
                />
                <Button
                  title="Request review"
                  disabled={mutation.isPending || statement.trim().length < 5}
                  onPress={() =>
                    run(
                      { type: 'requestEligibility', petitionId: p.id, statement },
                      'Review requested. An organizer can approve it in Manage.',
                      () => setStatement(''),
                    )
                  }
                />
              </View>
            )}

          <CommunityBacking p={p} s={s} />

          <Animated.View
            style={[
              {
                marginTop: 12,
                backgroundColor: colors.dark,
                borderRadius: 24,
                padding: 18,
                gap: 8,
              },
              anim(kf.in, 600, { delay: 420 }),
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 11,
                  letterSpacing: 1.3,
                  textTransform: 'uppercase',
                  color: colors.pale,
                }}
              >
                Who decides this?
              </Text>
              {office && (
                <View
                  style={{
                    backgroundColor: 'rgba(228,230,195,0.16)',
                    borderRadius: 999,
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                  }}
                >
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.pale }}>
                    {levelLabels[office.level]}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={{
                fontFamily: fonts.heading,
                fontSize: 18,
                lineHeight: 23,
                color: colors.white,
              }}
            >
              {p.recipient}
            </Text>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 19,
                color: colors.onDark,
              }}
            >
              {office
                ? `${office.controls.slice(0, 2).join('; ')}.`
                : isSampleCity(p.city)
                  ? 'Check the recipient directory to see which office controls this.'
                  : 'Named by the organizer as the office that can make this change.'}
            </Text>
            <OfficialContact recipient={p.recipient} city={p.city} />
            {(office || isSampleCity(p.city)) && (
              <Pressable accessibilityRole="link" onPress={() => router.push('/recipients')}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.pale }}>
                  {office ? `Usually responds within ${office.responseDays} days · ` : ''}What this
                  office controls ›
                </Text>
              </Pressable>
            )}
          </Animated.View>

          <View style={{ marginTop: 20 }}>
            <Segmented options={['Story', 'Progress', 'Activity']} value={tab} onChange={setTab} />
          </View>
          <Animated.View key={tab} style={[{ gap: 12, paddingTop: 14 }, anim(kf.in, 400)]}>
            {tab === 0 && (
              <>
                {[
                  { n: 1, title: 'The problem', body: p.problem },
                  {
                    n: 2,
                    title: 'How we propose to solve it',
                    body: p.summary ? `${p.action.replace(/\.?$/, '.')} ${p.summary}` : p.action,
                  },
                  {
                    n: 3,
                    title: 'Who can make this change',
                    body: office ? `${p.recipient} — ${office.controls[0]}.` : p.recipient,
                  },
                ].map((part) => (
                  <View key={part.n} style={[card, { gap: 8 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          backgroundColor: colors.pale,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{ fontFamily: fonts.display, fontSize: 13, color: colors.accent }}
                        >
                          {part.n}
                        </Text>
                      </View>
                      <Text style={[cardTitle, { flex: 1 }]}>{part.title}</Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 14.5,
                        lineHeight: 23,
                        color: colors.secondary,
                      }}
                    >
                      {part.body}
                    </Text>
                  </View>
                ))}
                <View style={card}>
                  <Text style={cardTitle}>Who can sign</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
                    {requirementLabel(p, s.communities)}
                  </Text>
                  <Text style={styles.small}>
                    {p.verification === 'custom'
                      ? p.customRule
                      : 'Eligibility is checked privately. Your contact details are never shown to the organizer or the public.'}
                  </Text>
                  <Text style={styles.small}>
                    Public name choices: {p.identities.map((i) => identityLabels[i]).join(', ')}
                  </Text>
                </View>
                <View style={card}>
                  <Text style={cardTitle}>Organizer’s sources</Text>
                  <Text style={[styles.small, { fontSize: 12 }]}>
                    Creator-supplied. Swipe4Change does not fact-check these.
                    {p.sampleCount > 0 ? ' Demo links are placeholders.' : ''}
                  </Text>
                  {p.evidence.length ? (
                    p.evidence.map((e) => (
                      <Pressable
                        key={e.url}
                        accessibilityRole="link"
                        accessibilityLabel={e.label}
                        onPress={() =>
                          void Linking.openURL(e.url).catch(() =>
                            toast('Unable to open the source. Try again from a browser.'),
                          )
                        }
                        style={{
                          flexDirection: 'row',
                          gap: 11,
                          alignItems: 'center',
                          backgroundColor: colors.quiet,
                          borderRadius: 14,
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 14,
                            backgroundColor: colors.white,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Glyph name="link" size={15} weight={2} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={{
                              fontFamily: fonts.semibold,
                              fontSize: 13,
                              lineHeight: 17.5,
                              color: colors.ink,
                            }}
                          >
                            {e.label}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}
                          >
                            {e.url.replace(/^https?:\/\//, '').split('/')[0]}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.muted}>No supporting sources have been supplied yet.</Text>
                  )}
                </View>
              </>
            )}
            {tab === 1 && (
              <>
                <View style={[card, { gap: 0 }]}>
                  <Text style={[cardTitle, { marginBottom: 12 }]}>Milestones</Text>
                  {milestones.map((n, i) => {
                    const hit = reachedMilestones(p.count, p.goal).includes(n);
                    const target = Math.ceil((p.goal * n) / 100);
                    return (
                      <View key={n} style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ alignItems: 'center', width: 18 }}>
                          <Animated.View
                            style={[
                              {
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                backgroundColor: hit ? colors.sage : colors.white,
                                borderWidth: 2,
                                borderColor: hit ? colors.sage : colors.handle,
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                              anim(kf.pop, 400, { delay: 100 + i * 120, ease: 'ease' }),
                            ]}
                          >
                            {hit && (
                              <Text
                                style={{
                                  fontFamily: fonts.bold,
                                  fontSize: 11,
                                  lineHeight: 11,
                                  color: colors.white,
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </Animated.View>
                          <View
                            style={{
                              width: 2,
                              flex: 1,
                              minHeight: 18,
                              backgroundColor:
                                i === 3 ? 'transparent' : hit ? colors.sage : colors.knob,
                            }}
                          />
                        </View>
                        <View style={{ paddingBottom: 16, flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: fonts.semibold,
                              fontSize: 14.5,
                              lineHeight: 18,
                              color: colors.ink,
                            }}
                          >
                            {n}% · {target.toLocaleString()} voices
                          </Text>
                          <Text
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 12,
                              lineHeight: 17,
                              color: colors.muted,
                            }}
                          >
                            {hit ? 'Reached' : `${(target - p.count).toLocaleString()} more to go`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  <Text style={styles.micro}>
                    Signature progress, not verified policy outcomes.
                  </Text>
                </View>
                <View style={card}>
                  <Text style={cardTitle}>Delivery record</Text>
                  {p.deliveries.length ? (
                    p.deliveries.map((d) => (
                      <View key={d.id} style={{ gap: 8 }}>
                        <Text
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            lineHeight: 21,
                            color: colors.secondary,
                          }}
                        >
                          Sent to {d.recipient} on {new Date(d.deliveredAt).toLocaleDateString()} by{' '}
                          {d.deliveredBy} ({deliveryMethodLabels[d.method].toLowerCase()}) with{' '}
                          {d.signatureCount.toLocaleString()} signatures. Count and names frozen at
                          sending.
                          {d.note ? ` ${d.note}` : ''}
                        </Text>
                        <Button
                          title="Read the document that was sent"
                          variant="secondary"
                          onPress={() => router.push(`/packet/${p.id}?delivery=${d.id}`)}
                          style={{ backgroundColor: colors.quiet }}
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>
                      Not yet delivered. The organizer records the hand-off here once this petition
                      reaches {p.recipient}.
                    </Text>
                  )}
                </View>
                {p.responses.map((r) => {
                  const official = r.verification === 'verified';
                  return (
                    <View
                      key={r.id}
                      style={[
                        card,
                        official
                          ? { backgroundColor: colors.soft }
                          : {
                              backgroundColor: colors.warnSoft,
                              borderWidth: 1,
                              borderColor: colors.warnLine,
                            },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.semibold,
                          fontSize: 11,
                          letterSpacing: 1.1,
                          textTransform: 'uppercase',
                          color: official ? colors.success : colors.warning,
                        }}
                      >
                        {official
                          ? isDemo || r.organization.includes('(fictional)')
                            ? 'Verified · fictional sample'
                            : 'Verified official response'
                          : `${r.verification} · not an official response`}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.heading,
                          fontSize: 16,
                          lineHeight: 21.5,
                          color: colors.ink,
                        }}
                      >
                        {r.organization}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 13,
                          lineHeight: 21,
                          color: colors.secondary,
                        }}
                      >
                        {r.body}
                      </Text>
                      <Text style={styles.micro}>
                        {official
                          ? 'Verified by a trusted reviewer.'
                          : 'Recorded by the organizer. Not independently verified.'}{' '}
                        {r.author} · {new Date(r.date).toLocaleDateString()}
                      </Text>
                      {!r.removed && entryRemover('response', s.profile, p)(r) && (
                        <Button
                          title="Retract this response"
                          variant="ghost"
                          onPress={() => setRemoving({ scope: 'response', entry: r })}
                        />
                      )}
                    </View>
                  );
                })}
                <View style={card}>
                  <Text style={cardTitle}>Voices behind the progress</Text>
                  {supporters.map((x) => (
                    <Text
                      key={x.id}
                      style={{ fontFamily: fonts.body, fontSize: 13, color: colors.secondary }}
                    >
                      ✓ {x.displayName}
                    </Text>
                  ))}
                  <Text style={styles.micro}>
                    {p.sampleCount > 0
                      ? `${p.sampleCount} fictional sample supporters. New signatures show only the chosen public name.`
                      : 'Only each signer’s chosen public name is shown.'}
                  </Text>
                </View>
                {signed && (
                  <>
                    <MySignature key={s.profile?.id} petitionId={p.id} />
                    <View style={card}>
                      <Text style={cardTitle}>Change your mind</Text>
                      <Text style={styles.small}>
                        You can withdraw your signature at any time. It stops being counted, your
                        public name is removed, and your drawn signature is deleted.
                      </Text>
                      <Button
                        title="Withdraw my signature"
                        variant="danger"
                        onPress={() => setWithdraw(true)}
                        style={{ backgroundColor: colors.quiet }}
                      />
                    </View>
                  </>
                )}
              </>
            )}
            {tab === 2 && (
              <>
                <View style={[card, { gap: 12 }]}>
                  <Text style={cardTitle}>Discussion</Text>
                  {s.profile ? (
                    <>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(['question', 'idea', 'experience'] as const).map((k) => (
                          <PillChip
                            key={k}
                            label={k}
                            capitalize
                            height={32}
                            selected={kind === k}
                            onPress={() => setKind(k)}
                          />
                        ))}
                      </View>
                      <Composer
                        value={body}
                        onChange={setBody}
                        placeholder="Add a question, idea or experience…"
                        pending={mutation.isPending}
                        onSubmit={() =>
                          run(
                            { type: 'discussion', petitionId: p.id, body, kind },
                            'Posted. Conversation starter progress updated.',
                            () => setBody(''),
                          )
                        }
                      />
                    </>
                  ) : (
                    <Button
                      title="Sign in to join the discussion"
                      onPress={() => router.push('/(auth)/sign-in')}
                    />
                  )}
                  <Entries
                    entries={[...p.discussion].reverse()}
                    empty="Start the conversation."
                    canRemove={entryRemover('discussion', s.profile, p)}
                    onRemove={(entry) => setRemoving({ scope: 'discussion', entry })}
                  />
                </View>
                <View style={card}>
                  <Text style={cardTitle}>Organizer updates</Text>
                  {updates.length ? (
                    updates.map((u) => (
                      <View
                        key={u.id}
                        style={{
                          borderLeftWidth: 2,
                          borderLeftColor: colors.sage,
                          paddingLeft: 13,
                          gap: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 11,
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                            color: colors.accent,
                          }}
                        >
                          {new Date(u.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            lineHeight: 21,
                            color: colors.secondary,
                          }}
                        >
                          {u.body}
                        </Text>
                        {entryRemover('update', s.profile, p)(u) && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setRemoving({ scope: 'update', entry: u })}
                          >
                            <Text
                              style={{
                                fontFamily: fonts.semibold,
                                fontSize: 11,
                                color: colors.error,
                              }}
                            >
                              Remove
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>No updates yet.</Text>
                  )}
                </View>
                <View style={card}>
                  <Text style={cardTitle}>Community support</Text>
                  {p.endorsements.length ? (
                    p.endorsements.map((e) => <Post key={e.id} entry={e} />)
                  ) : (
                    <Text style={styles.muted}>No community has voted to back this yet.</Text>
                  )}
                </View>
                <View style={card}>
                  <Text style={cardTitle}>Edit history</Text>
                  {p.edits.length ? (
                    p.edits.map((e) => (
                      <View key={e.id} style={{ gap: 4 }}>
                        <Text
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 11,
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                            color: colors.accent,
                          }}
                        >
                          {new Date(e.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          · {e.kind}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.body,
                            fontSize: 13,
                            lineHeight: 19.5,
                            color: colors.secondary,
                          }}
                        >
                          {e.body}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>No edits yet.</Text>
                  )}
                  <Text style={styles.micro}>
                    Material edits keep their prior wording here. Signing rules cannot change after
                    signatures exist.
                  </Text>
                </View>
              </>
            )}
          </Animated.View>
          <View style={{ marginTop: 14 }}>
            <RipplePanel petition={p} snapshot={s} />
          </View>
          <Text
            style={[styles.micro, { textAlign: 'center', paddingTop: 18, paddingHorizontal: 8 }]}
          >
            {isDemo
              ? 'Fictional demo data. Nothing on this page establishes legal validity.'
              : 'One person. One signature. Your public identity is your choice.'}
          </Text>
        </View>
      </Animated.ScrollView>

      <Animated.View
        style={[
          { position: 'absolute', left: 14, right: 14, bottom: 28 + insets.bottom, zIndex: 20 },
          anim(kf.sheet, 500, { delay: 200 }),
        ]}
      >
        <View
          style={{
            backgroundColor: colors.dark,
            borderRadius: 999,
            paddingVertical: 8,
            paddingRight: 8,
            paddingLeft: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0px 18px 36px -14px rgba(18,20,15,0.6)',
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}
            >
              {pendingSign
                ? 'Confirming your signature…'
                : signed
                  ? 'You signed this'
                  : p.status === 'active'
                    ? `${p.count.toLocaleString()} signed`
                    : 'Signatures closed'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.body, fontSize: 12, color: colors.onDark }}
            >
              {signed
                ? 'Share to grow your ripple'
                : `${milestoneLabel(p)} · ${requirementLabel(p, s.communities)}`}
            </Text>
          </View>
          {(signed || p.status === 'active') && (
            <Press
              accessibilityLabel={signed ? 'Share link' : 'Sign petition'}
              disabled={pendingSign}
              scale={0.95}
              onPress={() => (signed ? void share(p, s) : needAccount(() => setSign(true)))}
              style={{
                backgroundColor: colors.pale,
                minHeight: 48,
                paddingHorizontal: 22,
                borderRadius: 999,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.dark }}>
                {signed ? 'Share link' : 'Sign petition'}
              </Text>
            </Press>
          )}
        </View>
      </Animated.View>

      {sign && <SignatureConsent petition={p} snapshot={s} onClose={() => setSign(false)} />}
      <Sheet visible={offering} onClose={() => setOffering(false)} locked={mutation.isPending}>
        <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 26 }]}>
          Offer to help
        </Text>
        <Text style={[styles.muted, { marginTop: 6, marginBottom: 14 }]}>
          Organizers see your profile name and the roles you pick. Swipe4Change never collects or
          shows your contact details.
          {p.volunteerCount > 0
            ? ` ${p.volunteerCount} ${p.volunteerCount === 1 ? 'person has' : 'people have'} offered so far.`
            : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {volunteerRoles.map((r) => (
            <PillChip
              key={r}
              label={volunteerRoleLabels[r]}
              height={36}
              selected={roles.includes(r)}
              onPress={() =>
                setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])
              }
            />
          ))}
        </View>
        <Field
          label="Anything the organizer should know (optional)"
          multiline
          value={helpNote}
          onChangeText={setHelpNote}
          placeholder="When you are free, skills you bring, questions you have…"
        />
        {mutation.error && (
          <View style={{ marginTop: 10 }}>
            <Notice error text={mutation.error.message} />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {myOffer ? (
            <Button
              title="Step back"
              variant="secondary"
              disabled={mutation.isPending}
              style={{ flex: 1 }}
              onPress={() =>
                run(
                  { type: 'volunteer', petitionId: p.id, roles: [], note: '' },
                  'You stepped back from volunteering.',
                  () => setOffering(false),
                )
              }
            />
          ) : (
            <Button
              title="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setOffering(false)}
            />
          )}
          <Button
            title={myOffer ? 'Update my offer' : 'Offer to help'}
            disabled={mutation.isPending || roles.length === 0 || p.status !== 'active'}
            style={{ flex: 2 }}
            onPress={() =>
              run(
                { type: 'volunteer', petitionId: p.id, roles, note: helpNote },
                'Thanks! The organizer sees your name and role — never your contact details.',
                () => setOffering(false),
              )
            }
          />
        </View>
      </Sheet>
      <Confirm
        visible={report}
        title="Report this petition"
        body="Tell us what is wrong. An AI model reviews the petition’s wording (not your reason). If it finds spam, threats, insults, hateful language or text that is not a real request, the petition is hidden until a person reviews it. Only you and trusted reviewers see your report."
        pending={mutation.isPending}
        confirmLabel="Send report"
        confirmDisabled={reason.trim().length < 5}
        onCancel={() => setReport(false)}
        onConfirm={() =>
          mutation.mutate(
            { type: 'report', petitionId: p.id, reason },
            {
              onSuccess: (result) => {
                setReport(false);
                setReason('');
                toast(
                  result === 'flagged'
                    ? 'Report sent. The automatic review flagged this petition, so it is hidden while a person reviews it.'
                    : 'Report sent. It stays private — track it in Profile.',
                );
              },
            },
          )
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {['Spam or advertising', 'Offensive or hateful content', 'Threats or harassment'].map(
            (r) => (
              <PillChip
                key={r}
                label={r}
                height={36}
                selected={reason === r}
                onPress={() => setReason(r)}
              />
            ),
          )}
        </View>
        <Field label="Reason for reporting" multiline value={reason} onChangeText={setReason} />
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
      <Confirm
        visible={donate}
        title="Leave Swipe4Change to donate?"
        body={`This opens ${(p.donationUrl ?? '').replace(/^https:\/\//, '').split('/')[0]} outside Swipe4Change. The organizer runs that page. Swipe4Change does not process, hold or verify donations, or check how money is used.`}
        confirmLabel="Open donation page"
        onCancel={() => setDonate(false)}
        onConfirm={() => {
          setDonate(false);
          if (p.donationUrl)
            void Linking.openURL(p.donationUrl).catch(() =>
              toast('Unable to open the donation page. Try again from a browser.'),
            );
        }}
      />
      <Confirm
        visible={withdraw}
        title="Withdraw your signature?"
        body={`Your signature on “${p.title}” will stop being counted, your public name will be removed from the supporter list, and your drawn signature will be deleted. You can sign again later.`}
        pending={mutation.isPending}
        confirmLabel="Withdraw"
        onCancel={() => setWithdraw(false)}
        onConfirm={() =>
          run(
            { type: 'withdraw', petitionId: p.id },
            'Your signature was withdrawn and your drawn signature deleted.',
            () => setWithdraw(false),
          )
        }
      >
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
      <Confirm
        visible={removing !== null}
        title="Remove this post?"
        body="The post is replaced with a visible note saying it was removed, so the thread stays honest. This cannot be undone."
        pending={mutation.isPending}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          run(
            {
              type: 'removeEntry',
              scope: removing.scope,
              entryId: removing.entry.id,
              petitionId: p.id,
            },
            'The post was removed.',
            () => setRemoving(null),
          )
        }
      >
        {mutation.error && <Notice error text={mutation.error.message} />}
      </Confirm>
    </Animated.View>
  );
}

/** A real elected official named as the recipient: their office, district and public contacts. */
function OfficialContact({ recipient, city }: { recipient: string; city: string }) {
  const officials = useOfficials(city);
  const o = officials.data ? officialNamed(recipient, officials.data.officials) : null;
  if (!o) return null;
  const link = o.contactForm ?? o.url;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.onDark }}>
        {o.office} for {o.district}
        {o.phone ? ` · ${o.phone}` : ''}
        {o.email ? ` · ${o.email}` : ''}
      </Text>
      {link && (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(link)}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.pale }}>
            {o.contactForm ? 'Contact form' : 'Official website'} ›
          </Text>
        </Pressable>
      )}
    </View>
  );
}
