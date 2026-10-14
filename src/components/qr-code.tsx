import { create } from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from './theme';

/** Scanners need four light modules around the code. */
const QUIET = 4;

/**
 * A QR code as one SVG path of its dark modules, in module units with the quiet zone included.
 * Medium error correction survives a crease or a smudge on a printed poster.
 */
export function qrPath(text: string) {
  const m = create(text, { errorCorrectionLevel: 'M' }).modules;
  let d = '';
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++) if (m.get(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  return { size: m.size + 2 * QUIET, d };
}

export function QrCode({ value, size }: { value: string; size: number }) {
  const qr = qrPath(value);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      accessibilityLabel={`QR code for ${value}`}
    >
      <Rect width={qr.size} height={qr.size} fill={colors.white} />
      <Path d={qr.d} fill={colors.ink} />
    </Svg>
  );
}
