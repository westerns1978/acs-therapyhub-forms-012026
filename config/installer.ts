/**
 * Constants for the bundled Gemynd Scan bridge installer.
 *
 * Same module shape as gemynd-scan, FlowView, FlowHub and FlowVault so this
 * repo has ONE version string to bump per release rather than a URL pasted
 * into a component.
 *
 * Canonical GCS prefix is `projects/flowhub/`. `projects/twain/` is legacy and
 * 404s for anything past 0.1.1 — see WestFlow/REPO-MAP.md.
 */

export const INSTALLER_URL =
  'https://storage.googleapis.com/gemynd-public/projects/flowhub/gemynd-scan-client-setup-0.2.1.exe';
