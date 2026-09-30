import { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSnapshot } from '../../src/data/provider';
import { packetText } from '../../src/domain/packet';
import { deliveryMethodLabels } from '../../src/domain/model';
import {
  Button,
  Empty,
  Loading,
  Notice,
  Page,
  Panel,
  colors,
  fonts,
  styles,
} from '../../src/components/ui';

/**
 * The delivery packet, rendered so an organizer can print it, save it as a PDF, or share it.
 *
 * Printing opens a plain HTML window rather than calling window.print() on the app itself: the
 * app's navigation, tab bar and cards have no business on a document going to a public office.
 */
export default function Packet() {
  const { id, delivery: deliveryId } = useLocalSearchParams<{ id: string; delivery?: string }>();
  const q = useSnapshot();
  const [notice, setNotice] = useState('');
  if (q.isPending) return <Loading />;
  const s = q.data;
  const p = s?.petitions.find((x) => x.id === id);
  if (!s || !p)
    return (
      <Page back>
        <Empty title="Petition not found" body="This petition may be private or archived." />
      </Page>
    );
  const delivery = deliveryId ? (p.deliveries.find((d) => d.id === deliveryId) ?? null) : null;
  const text = packetText(
    p,
    delivery,
    s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.displayName),
    s.communities.find((c) => c.id === p.communityId)?.name ?? 'an independent organizer',
  );
  const title = p.title;
  function output() {
    if (Platform.OS !== 'web') {
      void Share.share({ message: text }).catch(() =>
        setNotice('Sharing is unavailable on this device.'),
      );
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      setNotice('Your browser blocked the print window. Allow pop-ups for this site and retry.');
      return;
    }
    // textContent, never innerHTML: the petition body is author-supplied text.
    const pre = w.document.createElement('pre');
    pre.style.cssText = 'font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;margin:40px';
    pre.textContent = text;
    w.document.title = `${title} — petition packet`;
    w.document.body.appendChild(pre);
    w.focus();
    w.print();
  }
  return (
    <Page
      back
      title="The document you send"
      subtitle={
        delivery
          ? `Delivered ${new Date(delivery.deliveredAt).toLocaleDateString()} by ${delivery.deliveredBy} · ${deliveryMethodLabels[delivery.method]}`
          : 'A preview of what will be sent. Recording a delivery freezes a copy of this exact document.'
      }
      eyebrow={delivery ? 'DELIVERED PACKET' : 'DELIVERY PREVIEW'}
    >
      <View style={styles.row}>
        <Button
          title={Platform.OS === 'web' ? 'Print or save as PDF' : 'Share the packet'}
          icon={Platform.OS === 'web' ? 'print-outline' : 'share-outline'}
          onPress={output}
        />
      </View>
      {!!notice && <Notice text={notice} />}
      {!delivery && (
        <Notice text="Nothing has been delivered yet. This preview uses the signatures recorded right now; the count will keep moving until a delivery is recorded." />
      )}
      <Panel>
        <Text
          accessibilityLabel="Petition delivery packet"
          selectable
          style={{
            fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : fonts.body,
            fontSize: 12,
            lineHeight: 19,
            color: colors.ink,
          }}
        >
          {text}
        </Text>
      </Panel>
      <Text style={styles.micro}>
        Fictional demo document. Nothing here establishes legal validity, and no contact details or
        verification evidence are included.
      </Text>
    </Page>
  );
}
