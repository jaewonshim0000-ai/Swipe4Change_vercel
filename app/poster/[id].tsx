import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { isDemo, useSnapshot } from '../../src/data/provider';
import { petitionLink } from '../../src/components/petition-card';
import { QrCode, qrPath } from '../../src/components/qr-code';
import { shadows } from '../../src/components/theme';
import { Button, Empty, Loading, Notice, Page, colors, styles } from '../../src/components/ui';

/**
 * A printable poster whose QR code opens the petition, for collecting signatures in person.
 *
 * Web only: a phone's link is the swipe4change:// scheme, which people scanning a poster without
 * the app cannot open. Printing builds a plain window with textContent, never innerHTML, because
 * the title and request are organizer-written text.
 */
export default function Poster() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSnapshot();
  const [notice, setNotice] = useState('');
  if (q.isPending) return <Loading variant="detail" />;
  const s = q.data;
  const p = s?.petitions.find((x) => x.id === id);
  if (!s || !p)
    return (
      <Page back>
        <Empty title="Petition not found" body="This petition may be private or archived." />
      </Page>
    );
  if (Platform.OS !== 'web')
    return (
      <Page back eyebrow="POSTER" title="Print from a computer">
        <Notice text="Open this petition on the web to print its poster. A link made on a phone opens only in the app, so people scanning the poster could not reach it." />
      </Page>
    );
  const link = petitionLink(p, s, window.location.origin);
  const ripple = link.includes('?via=');
  const by = s.communities.find((c) => c.id === p.communityId)?.name ?? p.creator;
  const footer = `${by} · ${p.city} · Swipe4Change`;
  const ask = `We’re asking ${p.recipient} to: ${p.action}`;

  function print() {
    const w = window.open('', '_blank');
    if (!w) {
      setNotice('Your browser blocked the print window. Allow pop-ups for this site and retry.');
      return;
    }
    const d = w.document;
    d.title = `${p!.title} — poster`;
    const style = d.createElement('style');
    style.textContent = `@page{margin:16mm}
body{margin:0;text-align:center;color:${colors.ink};font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:13px;font-weight:600;color:${colors.accent};margin:28px 0 10px}
h1{font-family:Georgia,'Times New Roman',serif;font-size:46px;line-height:1.08;margin:0 auto 18px;max-width:15em}
.ask{font-size:19px;line-height:1.5;max-width:30em;margin:0 auto 26px}
svg{width:300px;height:300px}
.scan{font-family:Georgia,'Times New Roman',serif;font-size:28px;margin:14px 0 6px}
.link{font-size:12px;color:${colors.muted};word-break:break-all;max-width:40em;margin:0 auto 26px}
.small{font-size:13px;color:${colors.muted};margin:4px 0}`;
    d.head.appendChild(style);
    const add = (tag: string, className: string, text: string) => {
      const el = d.createElement(tag);
      el.className = className;
      el.textContent = text;
      d.body.appendChild(el);
    };
    add('p', 'eyebrow', 'Sign the petition');
    add('h1', '', p!.title);
    add('p', 'ask', ask);
    const qr = qrPath(link);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = d.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${qr.size} ${qr.size}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    const path = d.createElementNS(ns, 'path');
    path.setAttribute('d', qr.d);
    path.setAttribute('fill', colors.ink);
    svg.appendChild(path);
    d.body.appendChild(svg);
    add('p', 'scan', 'Scan to read and sign');
    add('p', 'link', link);
    add('p', 'small', footer);
    if (isDemo) add('p', 'small', 'Fictional sample petition made for a demo.');
    w.focus();
    w.print();
  }

  return (
    <Page
      back
      eyebrow="POSTER"
      title="Collect signatures in person"
      subtitle="Print it for a noticeboard, a classroom door or a bus shelter. Scanning the code opens this petition’s page, where people read it and sign."
    >
      <View style={styles.row}>
        <Button title="Print the poster" icon="print-outline" onPress={print} />
      </View>
      {!!notice && <Notice text={notice} />}
      <Text style={styles.small}>
        {ripple
          ? 'The code carries your ripple link, so people who sign from your poster join your ripple.'
          : 'Sign it first and the code will carry your ripple link, so poster signatures count in your ripple.'}
      </Text>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          paddingVertical: 32,
          paddingHorizontal: 24,
          gap: 14,
          alignItems: 'center',
          ...shadows.card,
        }}
      >
        <Text style={styles.label}>Sign the petition</Text>
        <Text accessibilityRole="header" style={[styles.title, { textAlign: 'center' }]}>
          {p.title}
        </Text>
        <Text style={[styles.body, { textAlign: 'center', maxWidth: 520 }]}>{ask}</Text>
        <QrCode value={link} size={220} />
        <Text style={styles.h3}>Scan to read and sign</Text>
        <Text selectable style={[styles.micro, { textAlign: 'center' }]}>
          {link}
        </Text>
        <Text style={[styles.small, { textAlign: 'center' }]}>{footer}</Text>
        {isDemo && <Text style={styles.micro}>Fictional sample petition made for a demo.</Text>}
      </View>
    </Page>
  );
}
