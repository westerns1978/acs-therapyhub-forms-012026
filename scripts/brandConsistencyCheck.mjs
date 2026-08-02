/**
 * BRAND CONSISTENCY GATE — `npm run check:brand`
 *
 * The BRAND object in index.html is the single source of truth for the tenant's
 * identity colour. A handful of sites CANNOT read it (a <meta>, a JSON file, a
 * jsPDF RGB triple, a URL query param, CSS var fallbacks) and must carry a static
 * copy. This asserts every one of them still matches, in whatever notation it uses.
 *
 * WHY THIS EXISTS. Brand colour has drifted twice, and both times the miss was
 * caused by NOTATION, not carelessness:
 *   - 2026-07-28  #8B1E24 -> #7A222E   left services/pdfDocuments.ts MAROON on the
 *                                       old value, so every GENERATED pdf (CIMOR
 *                                       packets, payment receipts) shipped a retired
 *                                       colour to clients and courts for five days.
 *   - 2026-08-02  #7A222E -> #C62828   found two more survivors written as rgba()
 *                                       decimals, invisible to a hex grep.
 * A colour audit by grep is structurally unreliable. This is deterministic.
 *
 * Exit 1 on any mismatch. Runs in the deploy chain (scripts/deploy.mjs) before the
 * build, so a half-finished brand change cannot ship.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const at = (p) => join(process.cwd(), p);
const read = (p) => readFileSync(at(p), 'utf8');

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL  ' + m); };
const ok = (m) => console.log('ok    ' + m);

// ── Source of truth ──────────────────────────────────────────────────────────
const indexHtml = read('index.html');
const brandOf = (key) => {
  const m = indexHtml.match(new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`));
  return m ? m[1].toUpperCase() : null;
};
const DEFAULT = brandOf('DEFAULT');
const FOCUS = brandOf('focus');
const DARK = brandOf('dark');
if (!DEFAULT || !FOCUS || !DARK) {
  console.error('FATAL: could not parse the BRAND object in index.html — did its shape change?');
  process.exit(1);
}
console.log(`BRAND source of truth (index.html): DEFAULT ${DEFAULT} · focus ${FOCUS} · dark ${DARK}\n`);

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Assert every hex captured by `re` in `file` equals `expected`. */
const expectHex = (label, file, re, expected) => {
  const found = [...read(file).matchAll(re)].map((m) => m[1].toUpperCase());
  if (!found.length) return fail(`${label} — pattern matched nothing in ${file}; the site moved or was deleted (this gate is now blind to it)`);
  const bad = found.filter((h) => h !== expected.toUpperCase());
  if (bad.length) return fail(`${label} — ${file} has ${bad.join(', ')}, expected ${expected}`);
  ok(`${label} (${found.length}x ${expected})`);
};

// ── The blessed static copies ────────────────────────────────────────────────
expectHex('index.html <meta theme-color>', 'index.html',
  /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/g, DEFAULT);

expectHex('manifest.json theme_color', 'manifest.json',
  /"theme_color":\s*"(#[0-9A-Fa-f]{6})"/g, DEFAULT);

expectHex('index.css var(--brand) fallback', 'public/index.css',
  /var\(--brand,\s*(#[0-9A-Fa-f]{6})\)/g, DEFAULT);

expectHex('index.css var(--brand-dark) fallback', 'public/index.css',
  /var\(--brand-dark,\s*(#[0-9A-Fa-f]{6})\)/g, DARK);

expectHex('WebsitePortalBridge var(--brand) fallback', 'pages/WebsitePortalBridge.tsx',
  /var\(--brand,\s*(#[0-9A-Fa-f]{6})\)/g, DEFAULT);

expectHex('WebsitePortalBridge var(--brand-focus) fallback', 'pages/WebsitePortalBridge.tsx',
  /var\(--brand-focus,\s*(#[0-9A-Fa-f]{6})\)/g, FOCUS);

// ui-avatars takes a bare hex (no '#') in a URL param.
{
  const found = [...read('components/ui/GlobalHeader.tsx').matchAll(/background=([0-9A-Fa-f]{6})/g)]
    .map((m) => '#' + m[1].toUpperCase());
  if (!found.length) fail('GlobalHeader ui-avatars background — pattern matched nothing (site moved?)');
  else if (found.some((h) => h !== DEFAULT)) fail(`GlobalHeader ui-avatars background — ${found.join(', ')}, expected ${DEFAULT}`);
  else ok(`GlobalHeader ui-avatars background (${found.length}x ${DEFAULT} as bare hex)`);
}

// jsPDF wants an [r, g, b] triple, not a hex.
{
  const want = toRgb(DEFAULT);
  const m = read('services/pdfDocuments.ts').match(/export const MAROON:\s*\[number, number, number\]\s*=\s*\[\s*(\d+),\s*(\d+),\s*(\d+)\s*\]/);
  if (!m) fail('pdfDocuments MAROON — declaration not found (renamed or reshaped?)');
  else {
    const got = [m[1], m[2], m[3]].map(Number);
    if (got.join() !== want.join()) fail(`pdfDocuments MAROON — [${got}] , expected [${want}] (= ${DEFAULT}). This feeds GENERATED pdfs that leave the building.`);
    else ok(`pdfDocuments MAROON ([${want}] = ${DEFAULT})`);
  }
}

// ── Marker coverage: a tagged site this gate does NOT check is a blind spot ───
const CHECKED_FILES = new Set([
  'index.html', 'manifest.json', 'public/index.css',
  'pages/WebsitePortalBridge.tsx', 'services/pdfDocuments.ts',
  'components/ui/GlobalHeader.tsx',
]);
{
  // index.html carries the marker only inside its documentation block, not as a copy.
  const marked = [...CHECKED_FILES].filter((f) => read(f).includes('BRAND-STATIC-COPY'));
  const unchecked = marked.filter((f) => !CHECKED_FILES.has(f));
  if (unchecked.length) fail(`BRAND-STATIC-COPY marker present but unchecked: ${unchecked.join(', ')}`);
  else ok(`${marked.length} marked files, all covered by an assertion above`);
  console.log('      (a NEW static copy must be tagged BRAND-STATIC-COPY *and* added here)');
}

console.log(failures ? `\n${failures} FAILURE(S) — brand is inconsistent` : '\nALL GREEN — every static copy matches BRAND');
process.exit(failures ? 1 : 0);
