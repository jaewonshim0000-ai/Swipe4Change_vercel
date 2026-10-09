/**
 * Removes every metadata segment from a JPEG — EXIF and XMP (APP1–APP15, where phones keep the GPS
 * position, camera and time) and comments — and keeps the image data byte for byte. Photos are
 * re-encoded before upload, which already drops EXIF on every platform we know of; this makes the
 * "never your exact location" promise hold even if an encoder ever copies it across.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Only JPEG photos can be attached.');
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff || i + 3 >= bytes.length) throw new Error('This photo looks damaged.');
    const marker = bytes[i + 1];
    // Start of scan: everything after is compressed image data, ending at EOI.
    if (marker === 0xda || marker === 0xd9) {
      kept.push(bytes.subarray(i));
      break;
    }
    const end = i + 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    if (end > bytes.length) throw new Error('This photo looks damaged.');
    const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!metadata) kept.push(bytes.subarray(i, end));
    i = end;
  }
  const out = new Uint8Array(kept.reduce((n, k) => n + k.length, 0));
  kept.reduce((at, k) => (out.set(k, at), at + k.length), 0);
  return out;
}

export function fromBase64(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function toBase64(bytes: Uint8Array) {
  let binary = '';
  // Chunked: String.fromCharCode cannot take a whole photo's worth of arguments at once.
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
