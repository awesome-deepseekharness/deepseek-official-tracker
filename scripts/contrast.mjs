/**
 * contrast.mjs — verify the palette against WCAG on the actual enamel ground.
 *
 * Converts the oklch tokens to sRGB and measures real contrast, so a token edit
 * that breaks a ratio fails here rather than shipping. Reads the built CSS, not
 * the source, so it cannot drift from what ships.
 *
 * Usage: node scripts/contrast.mjs   (after node scripts/build-pages.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';

// oklch -> linear sRGB -> relative luminance (Björn Ottosson)
function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const lum = ([r, g, b]) => 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const distDir = path.join('site', 'dist', '_astro');
if (!fs.existsSync(distDir)) {
  console.error('no built CSS found — run: node scripts/build-pages.mjs');
  process.exit(1);
}
const cssText = fs.readdirSync(distDir)
  .filter(f => f.endsWith('.css'))
  .map(f => fs.readFileSync(path.join(distDir, f), 'utf8'))
  .join('\n');

const token = name => {
  const m = cssText.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`));
  if (!m) return null;
  // Channels may or may not carry a percent sign ("97.8%" and "0" both occur),
  // so strip it before parsing or Number() yields NaN.
  const [l, c, h] = m[1].trim().split(/\s+/).map(v => Number(v.replace('%', '')));
  if (!Number.isFinite(l)) return null;
  return oklchToSrgb(l / 100, c, h);
};

const enamel = token('enamel');
const porcelain = token('porcelain');
if (!enamel || !porcelain) {
  console.error('could not read --enamel / --porcelain from the built CSS');
  process.exit(1);
}

let fail = 0;
const check = (label, fg, min) => {
  if (!fg) { fail++; console.log(`FAIL ${label.padEnd(26)} token not found`); return; }
  const r = ratio(fg, enamel);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(26)} ${r.toFixed(2)}:1  (needs ${min})`);
};

console.log('contrast on the enamel panel, from the built CSS\n');
check('body text', porcelain, 4.5);
check('muted text', token('text-muted'), 4.5);
// Dates and counts: small text readers scan, so the 4.5 floor applies. This
// caught --text-faint at 3.96:1, which is why that token sits at 67%.
check('faint text (dates)', token('text-faint'), 4.5);
check('signal tint (badge)', token('signal'), 4.5);
// Line inks only ever render as dots, rings and rules — never as body copy —
// so 3:1 for non-text is the right bar.
check('line inks (non-text)', token('line-blog'), 3);

console.log(`\n${fail ? `${fail} failure(s)` : 'all contrast checks pass'}`);
process.exit(fail ? 1 : 0);
