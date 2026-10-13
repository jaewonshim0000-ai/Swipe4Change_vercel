import { create } from 'qrcode';
import { qrPath } from '../src/components/qr-code';
import { petitionLink } from '../src/components/petition-card';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';
import { prepareSubmission } from './signature-fixture';

test('the QR path draws exactly the dark modules, inside a four-module quiet zone', () => {
  const text =
    'https://swipe4change.example/petition/20000000-0000-4000-8000-000000000001?via=k3x9';
  const { size, d } = qrPath(text);
  const m = create(text, { errorCorrectionLevel: 'M' }).modules;
  expect(size).toBe(m.size + 8);
  const drawn = new Set(d.match(/M\d+ \d+/g));
  let dark = 0;
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++) {
      expect(drawn.has(`M${c + 4} ${r + 4}`)).toBe(!!m.get(r, c));
      if (m.get(r, c)) dark++;
    }
  expect(drawn.size).toBe(dark);
});

test('a poster link carries your ripple code only once you have signed', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.sam);
  let s = await localAdapter.load();
  const p = s.petitions.find(
    (x) => x.verification === 'account' && x.status === 'active' && !s.signed.includes(x.id),
  )!;
  expect(petitionLink(p, s, 'https://app.example')).toBe(`https://app.example/petition/${p.id}`);
  await localAdapter.execute({
    type: 'sign',
    petitionId: p.id,
    identity: 'anonymous',
    submission: await prepareSubmission(localAdapter, p.id),
  });
  s = await localAdapter.load();
  expect(petitionLink(p, s, 'https://app.example')).toBe(
    `https://app.example/petition/${p.id}?via=${s.ripple!.code}`,
  );
});
