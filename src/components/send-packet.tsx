import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { officialNamed } from '../../supabase/functions/_shared/officials';
import { DeliveryMethod, Petition, Snapshot } from '../domain/model';
import { packetLines } from '../domain/packet';
import { useOfficials } from '../data/civic-lookup';
import { toast } from './kit';
import { Button, Field, Notice, colors, fonts, styles } from './ui';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Hands the packet to the recipient's real channel: a member of Congress's contact form, or an
 * email to the office. The app cannot see whether the organizer pressed send, so it only fills in
 * the delivery record below for them to confirm.
 */
export function SendPacket({
  petition: p,
  snapshot: s,
  onSent,
}: {
  petition: Petition;
  snapshot: Snapshot;
  onSent: (method: DeliveryMethod, note: string) => void;
}) {
  const officials = useOfficials(p.city);
  const official = officials.data ? officialNamed(p.recipient, officials.data.officials) : null;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const to = email || official?.email || '';
  const lines = packetLines(
    p,
    null,
    s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.displayName),
    s.communities,
  );
  const text = lines.join('\n');
  const form = official?.contactForm ?? official?.url;

  async function copy() {
    setError('');
    try {
      await Clipboard.setStringAsync(text);
      toast('Packet copied. Paste it into your message.');
      return true;
    } catch {
      setError('Copying is blocked here. Open the packet preview and copy it from there.');
      return false;
    }
  }
  async function open(url: string, method: DeliveryMethod, note: string) {
    const copied = await copy();
    try {
      await Linking.openURL(url);
      onSent(method, note);
      if (copied) toast('Packet copied. Once you have sent it, confirm the delivery below.');
    } catch {
      setError('This device could not open that link. Copy the packet and send it yourself.');
    }
  }
  function mail() {
    if (!emailPattern.test(to)) return setError('Enter the office’s public email address.');
    // Email links cut off long bodies, so the message carries the request and the count, and the
    // full packet with every public name goes on the clipboard to paste below it.
    const end = lines.indexOf('SIGNATURES') + 2;
    // ponytail: capped at 1,200 characters because some mail apps reject longer links.
    const head = lines.slice(0, end).join('\n');
    const body = `${head.length > 1200 ? `${head.slice(0, 1200)}…` : head}\n\n[The full packet, with the list of public signer names, is on your clipboard. Paste it here.]`;
    void open(
      `mailto:${to}?subject=${encodeURIComponent(`Petition: ${p.title}`)}&body=${encodeURIComponent(body)}`,
      'email',
      `Emailed to ${to}`,
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {official && (
        <View style={{ backgroundColor: colors.soft, borderRadius: 16, padding: 12, gap: 3 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
            {official.name} · {official.office} ({official.district})
          </Text>
          {official.phone && <Text style={styles.muted}>Phone: {official.phone}</Text>}
          {official.level === 'federal' && !official.email && (
            <Text style={styles.muted}>
              Congressional offices take messages through their website rather than email.
            </Text>
          )}
        </View>
      )}
      <Button title="Copy the packet" variant="secondary" onPress={() => void copy()} />
      {form && !official?.email && (
        <Button
          title={
            official?.contactForm
              ? 'Copy and open their contact form'
              : 'Copy and open their website'
          }
          onPress={() =>
            void open(form, 'portal', `Sent through ${official!.name}’s contact form (${form})`)
          }
        />
      )}
      <Field
        label="Recipient’s public email"
        value={to}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="office@city.gov"
      />
      <Button title="Copy and open in my email app" variant="secondary" onPress={mail} />
      {error ? <Notice error text={error} /> : null}
    </View>
  );
}
