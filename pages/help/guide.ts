// Single source of truth for the public Help & Training pages.
//
// The guide content lives in /docs/user-guide/*.md. We import those files as raw
// strings with Vite's `?raw` loader and render them at runtime — we never copy
// their text into components, so any edit to the markdown flows through to the
// website on the next build.

import welcome from '../../docs/user-guide/00-welcome.md?raw';
import gettingStarted from '../../docs/user-guide/01-getting-started.md?raw';
import navigation from '../../docs/user-guide/02-navigation.md?raw';
import director from '../../docs/user-guide/03-director.md?raw';
import therapist from '../../docs/user-guide/04-therapist.md?raw';
import office from '../../docs/user-guide/05-office-staff.md?raw';
import commonTasks from '../../docs/user-guide/06-common-tasks.md?raw';
import whatsNext from '../../docs/user-guide/07-help-and-whats-next.md?raw';

export interface GuidePage {
  /** URL segment under /help, e.g. "getting-started" -> /help/getting-started */
  slug: string;
  /** Short label for the contents list and document title. */
  title: string;
  /** Original markdown filename, used to rewrite in-guide .md links. */
  file: string;
  /** Raw markdown content. */
  md: string;
}

// Order matches the guide's reading order (00 -> 07).
export const GUIDE_PAGES: GuidePage[] = [
  { slug: 'welcome', title: 'Welcome', file: '00-welcome.md', md: welcome },
  { slug: 'getting-started', title: 'Getting Started', file: '01-getting-started.md', md: gettingStarted },
  { slug: 'navigation', title: 'Finding Your Way Around', file: '02-navigation.md', md: navigation },
  { slug: 'director', title: 'For the Director', file: '03-director.md', md: director },
  { slug: 'therapist', title: 'For the Therapist', file: '04-therapist.md', md: therapist },
  { slug: 'office', title: 'For Office / Admin', file: '05-office-staff.md', md: office },
  { slug: 'common-tasks', title: 'Common Tasks', file: '06-common-tasks.md', md: commonTasks },
  { slug: 'whats-next', title: "Help & What's Next", file: '07-help-and-whats-next.md', md: whatsNext },
];

// Maps an in-guide markdown filename (the href used in the .md files) to its
// /help route slug, so links like "06-common-tasks.md#add-a-client" become
// "/help/common-tasks#add-a-client".
export const FILE_TO_SLUG: Record<string, string> = Object.fromEntries(
  GUIDE_PAGES.map((p) => [p.file, p.slug]),
);

export function getGuidePage(slug: string | undefined): GuidePage | undefined {
  return GUIDE_PAGES.find((p) => p.slug === slug);
}
