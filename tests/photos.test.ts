import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { fromBase64, stripJpegMetadata, toBase64 } from '../src/domain/jpeg';

const seg = (marker: number, body: number[]) => [
  0xff,
  marker,
  (body.length + 2) >> 8,
  (body.length + 2) & 0xff,
  ...body,
];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
// SOI, JFIF, EXIF with a GPS block, a comment, a quantization table, then scan data and EOI.
const jfif = seg(0xe0, ascii('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
const exif = seg(0xe1, ascii('Exif\0\0GPSLatitude 47.6062 N GPSLongitude 122.3321 W'));
const xmp = seg(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<gps>47.6</gps>'));
const comment = seg(0xfe, ascii('Taken at 12 Pine Street'));
const dqt = seg(0xdb, [0, 1, 2, 3]);
const scan = [...seg(0xda, [1, 2, 3]), 9, 8, 0xff, 0x00, 7, 0xff, 0xd9];
const photo = new Uint8Array([0xff, 0xd8, ...jfif, ...exif, ...xmp, ...comment, ...dqt, ...scan]);

test('location and other metadata are removed from a photo before it leaves the device', () => {
  const clean = stripJpegMetadata(photo);
  const text = String.fromCharCode(...clean);
  expect(text).not.toContain('GPS');
  expect(text).not.toContain('Exif');
  expect(text).not.toContain('Pine Street');
  expect(text).not.toContain('<gps>');
  // The picture itself is untouched: header, tables and the compressed scan survive byte for byte.
  expect([...clean]).toEqual([0xff, 0xd8, ...jfif, ...dqt, ...scan]);
});

test('anything that is not a JPEG is refused rather than passed through', () => {
  expect(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow(/JPEG/);
  expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0x12, 0x34]))).toThrow(/damaged/);
});

test('base64 round-trips binary data', () => {
  const bytes = new Uint8Array(70000).map((_, i) => (i * 31) % 256);
  expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
});

function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let id = 0;
  return new LocalAdapter(storage, () => `test-${++id}`);
}

test('organizers add, change and remove a photo, and every change is public history', async () => {
  const a = setup();
  await a.signIn(demoIds.maya);
  const id = (await a.execute({
    type: 'create',
    draft: seedPetitions()[0],
    publish: true,
  })) as string;
  // A photo the creator drafted is not smuggled in through `create`; it needs the photo command.
  expect((await a.load()).petitions.find((p) => p.id === id)?.photo).toBeUndefined();
  const url = await a.uploadPhoto(toBase64(photo));
  expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
  await expect(a.uploadPhoto(toBase64(new Uint8Array([1, 2, 3])))).rejects.toThrow(/JPEG/);
  await expect(
    a.execute({ type: 'photo', petitionId: id, photo: { url, alt: 'x' } }),
  ).rejects.toThrow(/screen readers/);
  await expect(
    a.execute({
      type: 'photo',
      petitionId: id,
      photo: { url: 'https://example.com/elsewhere.jpg', alt: 'The unlit path' },
    }),
  ).rejects.toThrow(/through the app/);
  await a.execute({
    type: 'photo',
    petitionId: id,
    photo: { url, alt: 'The unlit path at night' },
  });
  let p = (await a.load()).petitions.find((x) => x.id === id)!;
  expect(p.photo).toEqual({ url, alt: 'The unlit path at night' });
  expect(p.edits[0].body).toBe('Photo added: “The unlit path at night”.');
  await a.signIn(demoIds.sam);
  await expect(a.execute({ type: 'photo', petitionId: id, photo: null })).rejects.toThrow(
    /owner or an authorized/,
  );
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'photo', petitionId: id, photo: null });
  p = (await a.load()).petitions.find((x) => x.id === id)!;
  expect(p.photo).toBeUndefined();
  expect(p.edits[0].body).toBe('Photo removed.');
});
