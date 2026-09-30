import { Delivery, Petition, identityLabels, verificationLabels } from './model';
import { findOffice, levelLabels } from './recipients';

/**
 * The document that actually goes to the recipient.
 *
 * Built as plain text from a pure function so the same packet can be printed on web, shared from a
 * phone, and asserted in a test. Two rules govern what goes in it:
 *
 *   1. It contains only what the petition already shows in public. Signatory names are the display
 *      names each signer chose; nothing here can widen what a signature reveals.
 *   2. When a delivery exists it is rendered from that delivery's snapshot, not from live data. A
 *      packet has to say what was sent on the day it was sent, even after more people sign.
 */
export function packetLines(
  p: Petition,
  delivery: Delivery | null,
  liveSignatories: string[],
  communityName: string,
  now = Date.now(),
): string[] {
  const office = findOffice(delivery?.recipient ?? p.recipient);
  const signatories = delivery ? delivery.signatories : liveSignatories;
  const count = delivery ? delivery.signatureCount : p.count;
  const shown = signatories.slice(0, 500);
  const rule = [
    `Eligibility to sign: ${verificationLabels[p.verification]}`,
    p.verification === 'custom' && p.customRule ? `Organizer rule: ${p.customRule}` : '',
    `Public identity options offered: ${p.identities.map((i) => identityLabels[i]).join(', ')}`,
  ].filter(Boolean);
  return [
    'PETITION FOR DELIVERY',
    'Prepared with Swipe4Change — a student civic project. All names, offices and signatures',
    'below are FICTIONAL sample data and carry no legal validity.',
    '',
    `To:      ${delivery?.recipient ?? p.recipient}`,
    ...(office
      ? [
          `         ${levelLabels[office.level]} level · publishes a response in about ${office.responseDays} days`,
        ]
      : []),
    `From:    ${p.creator}, with ${communityName}`,
    `Date:    ${new Date(delivery?.deliveredAt ?? now).toLocaleDateString()}`,
    ...(delivery ? [`Method:  ${delivery.method}`, `Note:    ${delivery.note}`] : []),
    '',
    '---',
    '',
    p.title.toUpperCase(),
    '',
    'WHAT WE ARE ASKING FOR',
    p.action,
    '',
    'WHY',
    p.problem,
    '',
    'WHERE',
    `${p.city} (approximate location; no exact addresses are collected)`,
    '',
    ...(p.evidence.length
      ? [
          'SOURCES SUPPLIED BY THE ORGANIZER',
          'These are supplied by the petition author. Swipe4Change does not fact-check them.',
          ...p.evidence.map((e) => `  · ${e.label} — ${e.url}`),
          '',
        ]
      : []),
    'SIGNATURES',
    `${count.toLocaleString()} signatures toward a goal of ${p.goal.toLocaleString()}.`,
    ...(p.sampleCount > 0
      ? [
          `${p.sampleCount.toLocaleString()} of these are fictional sample signatures for this demo.`,
        ]
      : []),
    ...rule,
    '',
    'Each name below is shown exactly as that signer chose to appear in public. Signers who chose',
    'to remain anonymous are counted but not named. No email address, postal address, phone number',
    'or verification evidence appears in this document.',
    '',
    ...(shown.length
      ? shown.map((name, i) => `${String(i + 1).padStart(4)}. ${name}`)
      : ['  (No individual signatures have been recorded on this petition yet.)']),
    ...(signatories.length > shown.length
      ? ['', `  … and ${signatories.length - shown.length} more.`]
      : []),
    '',
    '---',
    '',
    'A response can be recorded against this delivery in Swipe4Change. The app marks a response as',
    'verified only where that verification actually exists.',
  ];
}

export const packetText = (...args: Parameters<typeof packetLines>) =>
  packetLines(...args).join('\n');
