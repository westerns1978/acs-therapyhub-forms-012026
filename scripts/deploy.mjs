/**
 * Sanctioned deploy path for ACS TherapyHub. Run via `npm run deploy`.
 *
 * Sets DEPLOY_TARGET (which the firebase.json predeploy guard requires) and
 * scopes firebase to this repo's hosting site. NEVER run a bare `firebase deploy`
 * — this repo shares a Firebase project with Attesta (attesta-demo), and the
 * guard will block anything that doesn't come through here. Dependency-free and
 * cross-platform (no cross-env needed).
 */
import { spawnSync } from 'node:child_process';

const SITE = 'acs-therapyhub';
const r = spawnSync('npx', ['firebase', 'deploy', '--only', `hosting:${SITE}`], {
  stdio: 'inherit',
  env: { ...process.env, DEPLOY_TARGET: SITE },
  shell: true,
});
process.exit(r.status ?? 1);
