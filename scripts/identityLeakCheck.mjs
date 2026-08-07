#!/usr/bin/env node
/**
 * check:privacy — fail the build if an outbound URL to a third party is built
 * out of somebody's identity.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two of these shipped, and neither was caught by review or by any gate:
 *
 *   services/api.ts        `ui-avatars.com/api/?name=${encodeURIComponent(name)}…`
 *                          — every CLIENT's full name, on every avatar render.
 *   components/ui/GlobalHeader.tsx
 *                          `ui-avatars.com/api/?name=${user?.name}…`
 *                          — the signed-in STAFF member's name, every page render.
 *
 * These are 42 CFR Part 2 records. The mere fact that a person is an ACS client
 * is protected, and a URL leaks on the wire, in the third party's access logs,
 * and in the Referer header — with no request body to inspect and nothing in the
 * UI to suggest it is happening.
 *
 * Worse, check:brand was ASSERTING on the GlobalHeader URL's background colour,
 * so the gate actively held the leak in place: deleting it failed the build.
 *
 * WHAT IT CHECKS
 * --------------
 * For every app source file: strip comments and strings-that-are-comments, find
 * absolute http(s) URLs, and for any host NOT on the allowlist, fail if an
 * identity-bearing expression is interpolated into or concatenated onto it.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 * -----------------------------------
 * This is a STATIC check over first-party source, so it cannot see:
 *   - identity reaching a third party via a request BODY rather than a URL
 *   - a host assembled at runtime from a variable or config value
 *   - anything inside node_modules or a third-party script
 *   - supabase/functions/* (server-side; those legitimately hold PHI and talk
 *     to Stripe/Zoom/Gemini with it under a BAA-shaped trust boundary)
 * A runtime check would catch more, but there is no browser in CI here and a
 * Playwright/CDP harness is a bigger build than this pass. Logged as such in
 * SECURITY_BACKLOG. Static coverage still catches the exact shape that shipped
 * twice, and it is the shape a hurried edit reintroduces.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const at = (p) => join(ROOT, p);

const SCAN_DIRS = ['components', 'pages', 'services', 'layouts', 'contexts', 'hooks', 'config', 'data'];
const EXT = /\.(ts|tsx|js|jsx|mjs)$/;

/**
 * Hosts allowed to appear in a URL built from identity.
 *  - supabase / google / firebase: this app's own backends
 *  - zoom.us, stripe.com: contracted integrations, and the identity-carrying
 *    calls to both run server-side in supabase/functions, not here
 *  - anthropic.com: model API
 * A host NOT on this list has no business receiving a name, email, or DOB.
 */
const ALLOWED_HOSTS = [
  'supabase.co', 'supabase.com', 'supabase.in',
  'googleapis.com', 'google.com', 'gstatic.com', 'googleusercontent.com',
  'firebaseapp.com', 'firebaseio.com', 'web.app',
  'anthropic.com',
  'zoom.us', 'stripe.com',
  'localhost', '127.0.0.1',
  'acs-therapyhub.web.app',
  'w3.org', // SVG xmlns declarations
];

/** Expressions that carry a person's identity. Substring match, case-insensitive. */
const IDENTITY_TOKENS = [
  'name', 'email', 'dob', 'birth', 'ssn', 'phone', 'address',
  'casenumber', 'case_number', 'initials', 'client', 'patient', 'user',
  'firstname', 'lastname', 'first_name', 'last_name',
];

let failures = 0;
let scanned = 0;
const ok = (m) => console.log(`ok    ${m}`);
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };

/** Remove // line comments and block comments so prose about a leak isn't a leak. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

const hostAllowed = (host) =>
  ALLOWED_HOSTS.some((a) => host === a || host.endsWith('.' + a));

/**
 * Pull every template literal out of the source, with its start offset.
 * Nested `${}` containing backticks are rare here and would only cause an early
 * close — which errs toward a SHORTER window, i.e. toward false negatives, not
 * false alarms. Concatenation is handled separately below.
 */
function templateLiterals(src) {
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '`') continue;
    if (i > 0 && src[i - 1] === '\\') continue;
    const end = src.indexOf('`', i + 1);
    if (end === -1) break;
    out.push({ text: src.slice(i, end + 1), index: i });
    i = end;
  }
  return out;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

for (const dir of SCAN_DIRS) {
  for (const file of walk(at(dir))) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const raw = readFileSync(file, 'utf8');
    const src = stripComments(raw);
    scanned++;

    // ── 1. Identity interpolated into a template-literal URL ──────────────────
    for (const { text, index } of templateLiterals(src)) {
      const url = text.match(/https?:\/\/([A-Za-z0-9.-]+)/);
      if (!url) continue;
      if (hostAllowed(url[1])) continue;
      const interpolations = [...text.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
      const guilty = interpolations.filter((expr) =>
        IDENTITY_TOKENS.some((t) => expr.toLowerCase().includes(t)));
      if (guilty.length) {
        fail(`${rel}:${lineOf(src, index)} — URL to third-party host "${url[1]}" built from identity: ${guilty.map((g) => '${' + g.trim() + '}').join(', ')}`);
      }
    }

    // ── 2. Identity concatenated onto a quoted URL string ─────────────────────
    const concat = /(['"])(https?:\/\/([A-Za-z0-9.-]+))[^'"]*\1\s*\+\s*([A-Za-z0-9_.?()\[\]]+)/g;
    for (const m of src.matchAll(concat)) {
      if (hostAllowed(m[3])) continue;
      if (IDENTITY_TOKENS.some((t) => m[4].toLowerCase().includes(t))) {
        fail(`${rel}:${lineOf(src, m.index)} — URL to third-party host "${m[3]}" concatenated with identity expression \`${m[4]}\``);
      }
    }
  }
}

console.log('');
if (failures) {
  console.log(`check:privacy FAILED — ${failures} outbound identity leak(s) across ${scanned} source files.`);
  console.log('42 CFR Part 2: a client or staff name in a third-party URL is a disclosure. Render it locally, or route it through a server-side function under the trust boundary.');
  process.exit(1);
}
ok(`${scanned} source files — no identity-bearing URL to a non-allowlisted host`);
console.log('\ncheck:privacy PASSED');
