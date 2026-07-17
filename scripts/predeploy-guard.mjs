/**
 * CROSS-DEPLOY GUARD — runs as the firebase.json hosting `predeploy` hook, so
 * firebase executes it before ANY hosting upload and aborts on a non-zero exit.
 *
 * WHY: this repo (ACS TherapyHub, site `acs-therapyhub`) shares Firebase project
 * gen-lang-client-0121881478 with the Attesta repo (site `attesta-demo`). The
 * only thing keeping an ACS bundle off Attesta's live demo is the deploy target.
 * A bare `firebase deploy` — the flag omitted, not forgotten — is the hazard.
 *
 * HOW: firebase exposes NO target/site/`--only` information to a predeploy hook
 * (verified empirically 2026-07-17: the hook sees only GCLOUD_PROJECT,
 * RESOURCE_DIR, PROJECT_DIR, IS_FIREBASE_CLI). It DOES pass through inherited
 * custom env vars (verified). So the sanctioned path — `npm run deploy` — sets
 * DEPLOY_TARGET, and this guard requires it. Any raw `firebase deploy` (bare or
 * even hand-flagged) lacks DEPLOY_TARGET and is BLOCKED before upload. A second
 * layer cross-checks firebase.json's own hosting.site in case the wrong repo's
 * config is present.
 *
 * This is a control, not a reminder: there is no flag to type correctly under
 * pressure — you run `npm run deploy` or the deploy does not happen.
 */
import { readFileSync } from 'node:fs';

const EXPECTED_SITE = 'acs-therapyhub'; // this repo deploys here and NOWHERE else

let ok = true;
const fail = (m) => { ok = false; console.error('  ✗ ' + m); };

if (process.env.DEPLOY_TARGET !== EXPECTED_SITE) {
  fail(`DEPLOY_TARGET=${process.env.DEPLOY_TARGET ?? '(unset)'} — expected '${EXPECTED_SITE}'. A bare 'firebase deploy' omits it.`);
}
try {
  const site = JSON.parse(readFileSync('firebase.json', 'utf8'))?.hosting?.site;
  if (site !== EXPECTED_SITE) fail(`firebase.json hosting.site='${site}' — expected '${EXPECTED_SITE}' (wrong repo's config?).`);
} catch (e) {
  fail(`could not read firebase.json hosting.site: ${e}`);
}

if (!ok) {
  console.error(`\n[predeploy-guard] DEPLOY BLOCKED — this repo deploys ONLY to '${EXPECTED_SITE}'.`);
  console.error(`  Shared Firebase project with Attesta (attesta-demo); a wrong bundle here lands on their live demo.`);
  console.error(`  Run:  npm run deploy   (never a bare 'firebase deploy').\n`);
  process.exit(1);
}
console.log(`[predeploy-guard] OK — DEPLOY_TARGET + firebase.json both '${EXPECTED_SITE}'.`);
