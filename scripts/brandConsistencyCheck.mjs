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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const at = (p) => join(process.cwd(), p);
/** Read a file, or null when it does not exist. NEVER throws: a missing file is a
 *  FINDING this gate must report clearly, not a stack trace. (It used to throw —
 *  moving manifest.json out of public/ produced an unhandled ENOENT dump instead
 *  of the one message that would have explained the problem.) */
const read = (p) => (existsSync(at(p)) ? readFileSync(at(p), 'utf8') : null);

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
  const src = read(file);
  if (src === null) return fail(`${label} — ${file} DOES NOT EXIST (moved? if it must be served it belongs under public/)`);
  const found = [...src.matchAll(re)].map((m) => m[1].toUpperCase());
  if (!found.length) return fail(`${label} — pattern matched nothing in ${file}; the site moved or was deleted (this gate is now blind to it)`);
  const bad = found.filter((h) => h !== expected.toUpperCase());
  if (bad.length) return fail(`${label} — ${file} has ${bad.join(', ')}, expected ${expected}`);
  ok(`${label} (${found.length}x ${expected})`);
};

// ── The blessed static copies ────────────────────────────────────────────────
expectHex('index.html <meta theme-color>', 'index.html',
  /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/g, DEFAULT);

expectHex('manifest.json theme_color', 'public/manifest.json',
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
  const found = [...(read('components/ui/GlobalHeader.tsx') ?? '').matchAll(/background=([0-9A-Fa-f]{6})/g)]
    .map((m) => '#' + m[1].toUpperCase());
  if (!found.length) fail('GlobalHeader ui-avatars background — pattern matched nothing (site moved?)');
  else if (found.some((h) => h !== DEFAULT)) fail(`GlobalHeader ui-avatars background — ${found.join(', ')}, expected ${DEFAULT}`);
  else ok(`GlobalHeader ui-avatars background (${found.length}x ${DEFAULT} as bare hex)`);
}

// jsPDF wants an [r, g, b] triple, not a hex.
{
  const want = toRgb(DEFAULT);
  const m = (read('services/pdfDocuments.ts') ?? '').match(/export const MAROON:\s*\[number, number, number\]\s*=\s*\[\s*(\d+),\s*(\d+),\s*(\d+)\s*\]/);
  if (!m) fail('pdfDocuments MAROON — declaration not found (renamed or reshaped?)');
  else {
    const got = [m[1], m[2], m[3]].map(Number);
    if (got.join() !== want.join()) fail(`pdfDocuments MAROON — [${got}] , expected [${want}] (= ${DEFAULT}). This feeds GENERATED pdfs that leave the building.`);
    else ok(`pdfDocuments MAROON ([${want}] = ${DEFAULT})`);
  }
}

// ── Marker coverage: a tagged site this gate does NOT check is a blind spot ───
const CHECKED_FILES = new Set([
  'index.html', 'public/manifest.json', 'public/index.css',
  'pages/WebsitePortalBridge.tsx', 'services/pdfDocuments.ts',
  'components/ui/GlobalHeader.tsx',
]);
{
  // index.html carries the marker only inside its documentation block, not as a copy.
  const marked = [...CHECKED_FILES].filter((f) => (read(f) ?? '').includes('BRAND-STATIC-COPY'));
  const unchecked = marked.filter((f) => !CHECKED_FILES.has(f));
  if (unchecked.length) fail(`BRAND-STATIC-COPY marker present but unchecked: ${unchecked.join(', ')}`);
  else ok(`${marked.length} marked files, all covered by an assertion above`);
  console.log('      (a NEW static copy must be tagged BRAND-STATIC-COPY *and* added here)');
}

/* ══════════════════════════════════════════════════════════════════════════════
 * REACHABILITY — a different gate from VALUE, and we learned that the hard way.
 *
 * Every assertion above passed for five days on manifest.json while that file was
 * NEVER SERVED: it sat at the repo root, Vite only copies public/ into dist/, and
 * Firebase's `**` rewrite answered /manifest.json with the SPA shell at HTTP 200.
 * So the gate was diligently verifying a hex in a file no browser ever fetched.
 *
 * This is the SECOND time this exact shape has bitten: check:forms gate 4 exists
 * because a missing PDF twin also returns 200 + app shell instead of a 404. A
 * missing static asset does not fail loudly on this host — it fails by looking
 * fine. Value correctness and reachability are independent properties and need
 * independent assertions.
 *
 * SPLIT BY MODE, because the two answers live at different times:
 *   (default)  source placement — checkable before a build exists
 *   --dist     real presence in dist/ — only meaningful AFTER the build
 * The deploy chain runs the first before `vite build` and the second after.
 * ═════════════════════════════════════════════════════════════════════════════ */

// Static files must live under public/ (Vite's contract: public/* -> dist/* verbatim).
// The bundled sources are deliberately NOT listed — they ship inside dist/assets/*.js,
// so their reachability is guaranteed by the build, not by file placement.
const MUST_BE_SERVED = ['public/manifest.json', 'public/index.css'];
{
  const misplaced = MUST_BE_SERVED.filter((p) => !existsSync(at(p)));
  if (misplaced.length) fail(`must be served but not under public/: ${misplaced.join(', ')} — Vite copies ONLY public/, so this would 200-with-SPA-shell in production`);
  else ok(`${MUST_BE_SERVED.length} served-asset(s) correctly placed under public/`);
}

if (process.argv.includes('--dist')) {
  console.log('\n── reachability in dist/ (post-build) ──');
  if (!existsSync(at('dist'))) {
    fail('dist/ does not exist — run this only AFTER vite build');
  } else {
    for (const p of MUST_BE_SERVED) {
      const served = p.replace(/^public\//, 'dist/');
      if (!existsSync(at(served))) fail(`${served} MISSING from the build — would serve the SPA shell at HTTP 200, not a 404`);
      else ok(`${served} present`);
    }
    // The manifest must also still PARSE and carry the brand once copied.
    try {
      const m = JSON.parse(read('dist/manifest.json') ?? 'null') ?? {};
      if ((m.theme_color || '').toUpperCase() !== DEFAULT) fail(`dist/manifest.json theme_color ${m.theme_color}, expected ${DEFAULT}`);
      else ok(`dist/manifest.json parses as JSON and carries ${DEFAULT}`);
    } catch (e) {
      fail(`dist/manifest.json is not valid JSON: ${e.message}`);
    }
    // Bundled sites: prove the brand actually made it into shipped JS, so a
    // tree-shaken or dead-code-eliminated brand value cannot pass unnoticed.
    const bundles = readdirSync(at('dist/assets')).filter((f) => f.endsWith('.js'));
    const bare = DEFAULT.slice(1);
    const rgb = toRgb(DEFAULT).join(',');
    const hasHex = bundles.some((f) => (read(`dist/assets/${f}`) ?? '').toUpperCase().includes(bare));
    const hasRgb = bundles.some((f) => (read(`dist/assets/${f}`) ?? '').replace(/\s/g, '').includes(`[${rgb}]`));
    if (!hasHex) fail(`no shipped bundle contains ${DEFAULT} — the brand may have been tree-shaken out of the app`);
    else ok(`brand hex ${DEFAULT} present in shipped JS`);
    if (!hasRgb) fail(`no shipped bundle contains the jsPDF triple [${rgb}] — generated pdfs may not carry the brand`);
    else ok(`jsPDF triple [${rgb}] present in shipped JS`);
  }
}

console.log(failures ? `\n${failures} FAILURE(S) — brand is inconsistent` : '\nALL GREEN — every static copy matches BRAND');
process.exit(failures ? 1 : 0);
