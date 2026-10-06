/** Colour helpers. Every input is a `#rrggbb` string that normalizeTheme() has already checked. */

export const HEX = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];

export function toRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** `weight` is how much of `a` ends up in the result. */
export function mix(a: string, b: string, weight: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] * weight + y[i] * (1 - weight)) as Rgb);
}

export const alpha = (hex: string, a: number) => `rgba(${toRgb(hex).join(', ')}, ${Math.round(a * 1000) / 1000})`;

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `c` pulled toward `ink` just far enough to read on `paper`. */
export function readable(c: string, ink: string, paper: string, ratio = 4.5): string {
  return (
    [1, 0.84, 0.7, 0.56, 0.42, 0.28].map((w) => mix(c, ink, w)).find((v) => contrastRatio(v, paper) >= ratio) ?? ink
  );
}

/** A Mantine 10 shade scale with the colour itself at index 6. */
export function shades(c: string): string[] {
  return [
    ...[0.1, 0.22, 0.4, 0.58, 0.76, 0.9].map((w) => mix(c, '#ffffff', w)),
    c,
    ...[0.84, 0.7, 0.56].map((w) => mix(c, '#000000', w)),
  ];
}

/** `#rrggbb` for a hue in degrees (any number, wrapped) and saturation and lightness in percent. */
export function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => 255 * (light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return toHex([channel(0), channel(8), channel(4)]);
}

/**
 * Turns what people paste into colour fields (`#abc`, `abc123`, `rgb(1, 2, 3)`) into `#rrggbb`, or null.
 * The editor runs it on blur; normalizeTheme() only ever sees the result.
 */
export function toHexColor(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (HEX.test(v)) return v;
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(v);
  if (rgb) {
    const parts = rgb.slice(1, 4).map(Number);
    if (parts.every((n) => n <= 255)) return toHex(parts as Rgb);
  }
  return null;
}
