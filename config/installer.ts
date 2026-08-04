/**
 * Constants for the bundled Gemynd Scan bridge installer.
 *
 * Same module shape as gemynd-scan, FlowView, FlowHub and FlowVault so this
 * repo has ONE place to change rather than a URL pasted into a component.
 *
 * Canonical GCS prefix is `projects/flowhub/`. `projects/twain/` is the legacy
 * prefix — see WestFlow/REPO-MAP.md.
 */

/**
 * Stable `latest/` pointer, NOT a version-pinned object. The release process
 * republishes this key, so the version served is whatever was last published
 * and this file never needs bumping. Do not append a version to it.
 */
export const INSTALLER_URL =
  'https://storage.googleapis.com/gemynd-public/projects/flowhub/latest/gemynd-scan-client-setup.exe';
