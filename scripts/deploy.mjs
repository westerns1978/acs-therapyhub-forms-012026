/**
 * Sanctioned deploy path for ACS TherapyHub. Run via `npm run deploy`.
 *
 * Sets DEPLOY_TARGET (which the firebase.json predeploy guard requires) and
 * scopes firebase to this repo's hosting site. NEVER run a bare `firebase deploy`
 * — this repo shares a Firebase project with Attesta (attesta-demo), and the
 * guard will block anything that doesn't come through here. Dependency-free and
 * cross-platform (no cross-env needed).
 *
 * TYPECHECKS, CHECKS FORMS, THEN BUILDS, THEN DEPLOYS. Every gate aborts before
 * any upload.
 *
 * FORM INTEGRITY (added 2026-08-01). `npm run check:forms` verifies the four form
 * gates — submittability, ground-truth replay, committed-record render drift, and
 * that every registry pdfSlug has its PDF on disk. It ran only by hand, so its
 * guarantees were advisory: gate 4 in particular is worthless unless it blocks a
 * release, because the failure it catches is invisible in production. Firebase
 * rewrites `**` to /index.html and only consults rewrites when no static file
 * matched, so a missing or misspelled PDF answers HTTP 200 with the app shell
 * instead of a 404 — the link "works" and serves the wrong thing. Nothing at
 * runtime can detect that; only this check, before upload, can.
 *
 * It runs BEFORE the build: it needs no bundle, and there is no point spending a
 * build on a tree whose form config is already inconsistent.
 *
 * BUILD (added 2026-07-27). firebase.json's `predeploy` hook runs only the
 * cross-deploy guard — it does NOT build. So `npm run deploy` used to upload
 * whatever happened to be sitting in dist/. On 2026-07-27 that shipped a dist
 * from six days earlier: the guard passed, firebase printed "Deploy complete!",
 * the release was real, and not one line of the intended change was in it. The
 * failure is silent and reassuring, which is the worst combination.
 *
 * TYPECHECK (added 2026-07-27, same day). `vite build` does NOT typecheck —
 * esbuild strips types without checking them. Proven while testing the build
 * gate: an unused bad import was tree-shaken away by Rollup and the build
 * happily succeeded. So the build step alone would let a whole class of error
 * reach production. `tsc --noEmit` runs FIRST, because it is the faster failure
 * and there is no reason to spend a build on code that cannot type.
 */
import { spawnSync } from 'node:child_process';

const SITE = 'acs-therapyhub';

const run = (label, cmd, args, extraEnv = {}) => {
  console.log(`\n[deploy] ${label}…`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`\n[deploy] ABORTED — ${label} failed (exit ${r.status ?? 'unknown'}).`);
    console.error(`[deploy] Nothing was uploaded. The live site is unchanged.\n`);
    process.exit(r.status ?? 1);
  }
};

// 1. Typecheck. vite build won't do it, and it is the cheapest failure.
run('typechecking (tsc --noEmit)', 'npm', ['run', 'lint']);

// 2. Form integrity. Cheap, bundle-free, and the only place a missing PDF twin
//    or a drifted committed-record render can be caught before it ships.
run('checking form integrity (npm run check:forms)', 'npm', ['run', 'check:forms']);

// 3. Build. Must succeed, or we never reach the upload.
run('building dist/ from the current working tree', 'npm', ['run', 'build']);

// 4. Deploy. The predeploy guard re-checks DEPLOY_TARGET + firebase.json.
run(`deploying to hosting:${SITE}`, 'npx', ['firebase', 'deploy', '--only', `hosting:${SITE}`], {
  DEPLOY_TARGET: SITE,
});

console.log(`\n[deploy] Done. Verify the served entry bundle matches your local dist/index.html.\n`);
