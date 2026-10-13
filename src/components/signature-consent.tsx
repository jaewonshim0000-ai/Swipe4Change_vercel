import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { isDemo, useBackend, useCommand } from '../data/provider';
import { Identity, Petition, Snapshot, identityLabels, verificationLabels } from '../domain/model';
import { publicName, signingStatus } from '../domain/rules';
import { SignaturePoint, SignatureReceipt, petitionDisclosure } from '../domain/signature-record';
import { SignaturePad } from './signature-pad';
import { forgetVia, recallVia, RippleRings } from './ripple';
import { share } from './petition-card';
import {
  CircleButton,
  Confetti,
  DrawnCheck,
  Press,
  Radio,
  Ring,
  Sheet,
  StepBars,
  toast,
} from './kit';
import { Glyph } from './glyph';
import { Medal, badgeLook } from './badge-medal';
import { anim, haptic, kf } from './motion';
import { Button, Notice, colors, fonts, styles } from './ui';

const titles = ['Read the full request', 'How should your name appear?', 'Sign and confirm'];

/** An option card: radio, label, and the note that explains it. */
export function OptionCard({
  label,
  note,
  selected,
  onPress,
}: {
  label: string;
  note: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${note}`}
      scale={0.98}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        borderWidth: 1.5,
        borderColor: selected ? colors.dark : 'transparent',
        backgroundColor: colors.white,
        borderRadius: 20,
        paddingVertical: 13,
        paddingHorizontal: 14,
        minHeight: 52,
      }}
    >
      <Radio on={selected} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink }}>
          {label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 12,
            lineHeight: 17,
            color: colors.muted,
            marginTop: 2,
          }}
        >
          {note}
        </Text>
      </View>
    </Press>
  );
}

/**
 * The signing sheet: read the text, choose a public identity, draw and consent. Only the server's
 * confirmation moves it to the celebration; a rejected write stays on the form with the reason.
 */
export function SignatureConsent({
  petition,
  snapshot,
  onClose,
  onRecorded,
}: {
  petition: Petition;
  snapshot: Snapshot;
  onClose: () => void;
  onRecorded?: () => void;
}) {
  const command = useCommand();
  // Keep the text that was opened, even when background queries refresh the petition.
  const [disclosure] = useState(() => petitionDisclosure(petition));
  const [firstBadge] = useState(() => !snapshot.profile?.badges.includes('First voice'));
  const [identity, setIdentity] = useState<Identity>(
    petition.identities.includes('anonymous') ? 'anonymous' : petition.identities[0],
  );
  const [signature, setSignature] = useState<SignaturePoint[]>([]);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const eligibility = signingStatus(petition, snapshot, identity);
  const drawn = signature.length >= 8;
  const canNext = step === 0 ? !eligibility.message : step === 1 || (drawn && consent);
  const name = snapshot.profile?.name ?? '';
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
      haptic('success');
      setDone(true);
      onRecorded?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Your signature could not be recorded. Please try again.',
      );
    }
  }
  function next() {
    if (!canNext) {
      toast(
        step === 0
          ? (eligibility.message ?? '')
          : !drawn
            ? 'Draw your signature first.'
            : 'Explicit consent is required.',
      );
      return;
    }
    if (step < 2) setStep(step + 1);
    else void submit();
  }
  const nextLabel = command.isPending
    ? 'Confirming…'
    : step < 2
      ? 'Continue'
      : !drawn
        ? 'Draw your signature'
        : !consent
          ? 'Tick the consent box'
          : 'Sign petition';
  return (
    <Sheet visible onClose={onClose} locked={command.isPending}>
      {done ? (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
          <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
            <Confetti />
            <Ring ms={1800} delay={300} />
            <Animated.View
              style={[
                {
                  width: 76,
                  height: 76,
                  borderRadius: 999,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                anim(kf.pop, 550, { ease: 'ease' }),
              ]}
            >
              <DrawnCheck />
            </Animated.View>
          </View>
          <Animated.Text
            accessibilityRole="header"
            style={[
              {
                fontFamily: fonts.display,
                fontSize: 27,
                lineHeight: 30,
                letterSpacing: -0.9,
                color: colors.ink,
                textAlign: 'center',
              },
              anim(kf.in, 500, { delay: 300 }),
            ]}
          >
            You added your voice.
          </Animated.Text>
          <Animated.Text
            style={[
              { ...styles.muted, fontSize: 14.5, lineHeight: 21.5, textAlign: 'center' },
              anim(kf.in, 500, { delay: 400 }),
            ]}
          >
            Supporter #{petition.count.toLocaleString()} on “{petition.title}”, as{' '}
            {publicName(name, identity)}.
          </Animated.Text>
          <Animated.View
            style={[
              {
                width: '100%',
                backgroundColor: colors.white,
                borderRadius: 24,
                padding: 16,
                flexDirection: 'row',
                gap: 14,
                alignItems: 'center',
                marginTop: 6,
              },
              anim(kf.in, 500, { delay: 500 }),
            ]}
          >
            <RippleRings moving size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink }}>
                Now start a ripple
              </Text>
              <Text style={[styles.small, { fontSize: 12, marginTop: 2 }]}>
                Everyone who signs through your link joins your ripple. Counts only, never names.
              </Text>
            </View>
          </Animated.View>
          {firstBadge && (
            <Animated.View
              style={[
                {
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: badgeLook('First voice').tone.soft,
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                },
                anim(kf.in, 500, { delay: 600 }),
              ]}
            >
              <Animated.View style={anim(kf.float, 2400, { loop: true, ease: 'ease-in-out' })}>
                <Medal name="First voice" earned size={40} />
              </Animated.View>
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.secondary,
                }}
              >
                Badge earned · <Text style={{ fontFamily: fonts.bold }}>First voice</Text>
              </Text>
            </Animated.View>
          )}
          <View style={{ width: '100%', flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button title="Done" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Share my link"
              onPress={() => {
                onClose();
                void share(petition, snapshot);
              }}
              style={{ flex: 1.6 }}
            />
          </View>
          <Text style={[styles.micro, { fontSize: 11, textAlign: 'center' }]}>
            Private receipt saved to your profile. Withdraw any time.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 16 }}>
            <StepBars count={3} current={step} />
          </View>
          <Animated.View key={step} style={anim(step % 2 ? kf.tickA : kf.tickB, 400)}>
            <Text style={[styles.label, { fontSize: 11, letterSpacing: 1.3 }]}>
              Step {step + 1} of 3
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                lineHeight: 27.5,
                letterSpacing: -0.8,
                color: colors.ink,
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              {titles[step]}
            </Text>
            {step === 0 && (
              <>
                <View
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: 20,
                    maxHeight: 190,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 8 }}>
                    <Text
                      style={{
                        fontFamily: fonts.heading,
                        fontSize: 16,
                        lineHeight: 21,
                        color: colors.ink,
                      }}
                    >
                      {disclosure.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 13,
                        lineHeight: 21.5,
                        color: colors.secondary,
                      }}
                    >
                      {disclosure.fullText}
                    </Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
                      To {disclosure.recipient} · {disclosure.approximateLocation} · closes{' '}
                      {disclosure.deadline}
                    </Text>
                  </ScrollView>
                </View>
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: eligibility.message ? colors.errorSoft : colors.soft,
                    borderRadius: 20,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginTop: 10,
                  }}
                >
                  <Animated.View
                    style={[
                      {
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: eligibility.message ? colors.error : colors.success,
                      },
                      anim(kf.pop, 400, { delay: 200, ease: 'ease' }),
                    ]}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                      {eligibility.message ? '!' : '✓'}
                    </Text>
                  </Animated.View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      lineHeight: 18,
                      color: colors.secondary,
                    }}
                  >
                    {eligibility.message ??
                      `Eligible · ${verificationLabels[petition.verification]}${isDemo ? ' (simulated)' : ''}`}
                  </Text>
                </View>
              </>
            )}
            {step === 1 && (
              <>
                <View style={{ gap: 8 }}>
                  {petition.identities.map((i) => (
                    <OptionCard
                      key={i}
                      label={identityLabels[i]}
                      note={`Appears as “${publicName(name, i)}”`}
                      selected={identity === i}
                      onPress={() => setIdentity(i)}
                    />
                  ))}
                </View>
                <Text style={[styles.micro, { fontSize: 12, marginTop: 10 }]}>
                  Your account always owns the signature privately.
                </Text>
              </>
            )}
            {step === 2 && (
              <>
                <SignaturePad value={signature} onChange={setSignature} />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  aria-checked={consent}
                  onPress={() => setConsent(!consent)}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                    backgroundColor: colors.white,
                    borderRadius: 20,
                    padding: 14,
                    marginTop: 10,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: consent ? colors.dark : colors.radio,
                      backgroundColor: consent ? colors.dark : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: consent ? 1.06 : 1 }],
                    }}
                  >
                    {consent && (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.body,
                      fontSize: 13,
                      lineHeight: 20,
                      color: colors.secondary,
                    }}
                  >
                    {isDemo
                      ? 'I have read the request and understand this fictional signature has no legal validity.'
                      : 'I have read the full text and I am signing it as myself.'}
                  </Text>
                </Pressable>
                <Text style={[styles.micro, { marginTop: 8 }]}>
                  Only you can see your drawn signature. Others see “{publicName(name, identity)}”.
                </Text>
              </>
            )}
          </Animated.View>
          {!!error && (
            <View style={{ marginTop: 12 }}>
              <Notice error text={error} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <CircleButton
              label={step === 0 ? 'Close' : 'Previous step'}
              light={false}
              size={52}
              onPress={() => (step === 0 ? onClose() : setStep(step - 1))}
            >
              <Glyph name="back" size={18} weight={2} />
            </CircleButton>
            <Press
              testID="sign-next"
              accessibilityLabel={nextLabel}
              accessibilityState={{ disabled: !canNext || command.isPending }}
              // `disabled={false}` would overwrite accessibilityState.disabled, so pass it only while pending.
              disabled={command.isPending || undefined}
              scale={0.97}
              onPress={next}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 999,
                backgroundColor: colors.dark,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canNext ? 1 : 0.4,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>
                {nextLabel}
              </Text>
            </Press>
          </View>
        </>
      )}
    </Sheet>
  );
}

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
    <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 10 }}>
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
        style={{ backgroundColor: colors.quiet }}
      />
      {expanded && (
        <>
          <Text style={styles.cardTitle}>{receipt.disclosure.title}</Text>
          <Text style={styles.body}>{receipt.disclosure.fullText}</Text>
          <Text style={styles.small}>To: {receipt.disclosure.recipient}</Text>
        </>
      )}
    </View>
  );
}
