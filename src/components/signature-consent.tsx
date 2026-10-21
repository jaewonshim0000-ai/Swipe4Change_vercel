import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { isDemo, useBackend, useCommand } from '../data/provider';
import { Identity, Petition, Snapshot, identityLabels, verificationLabels } from '../domain/model';
import { publicName, signingStatus } from '../domain/rules';
import { SignaturePoint, SignatureReceipt, petitionDisclosure } from '../domain/signature-record';
import { SignaturePad } from './signature-pad';
import { forgetVia, recallVia } from './ripple';
import { share } from './petition-card';
import { CircleButton, Press, Radio, Sheet, StepBars, toast } from './kit';
import { Glyph } from './glyph';
import { Celebrate } from './celebrate';
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
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={note ? `${label}. ${note}` : label}
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{label}</Text>
        {!!note && (
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
        )}
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
  // Only the server's confirmation reaches the celebration.
  if (done)
    return (
      <Celebrate
        petition={petition}
        name={name}
        shownAs={publicName(name, identity)}
        firstBadge={firstBadge}
        onClose={onClose}
        onShare={() => {
          onClose();
          void share(petition, snapshot);
        }}
      />
    );
  return (
    <Sheet visible onClose={onClose} locked={command.isPending}>
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
              lineHeight: 29,
              letterSpacing: -0.4,
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
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>
              {nextLabel}
            </Text>
          </Press>
        </View>
      </>
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
