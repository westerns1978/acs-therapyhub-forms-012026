import React, { useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { GUIDE_PAGES, getGuidePage } from './guide';
import HelpMarkdown from './HelpMarkdown';

const HelpPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const page = getGuidePage(slug);
  const index = GUIDE_PAGES.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? GUIDE_PAGES[index - 1] : undefined;
  const next = index >= 0 && index < GUIDE_PAGES.length - 1 ? GUIDE_PAGES[index + 1] : undefined;

  useEffect(() => {
    if (page) document.title = `${page.title} · ACS TherapyHub Help`;
  }, [page]);

  // Scroll to the linked heading when there's an anchor (e.g. arriving from a
  // role page's link into Common Tasks), otherwise start at the top. rAF lets the
  // markdown paint first and runs after the global ScrollToTop.
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = document.getElementById(id);
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash, page]);

  if (!page) {
    return (
      <div className="help-content">
        <h1>Page not found</h1>
        <p>
          We couldn&apos;t find that help page. <Link to="/help">Return to Help &amp; Training</Link>.
        </p>
      </div>
    );
  }

  return (
    <article>
      <HelpMarkdown markdown={page.md} />

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6 dark:border-dark-border">
        {prev ? (
          <Link to={`/help/${prev.slug}`} className="text-sm font-bold text-primary hover:text-primary-focus dark:text-dark-primary">
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/help/${next.slug}`} className="text-right text-sm font-bold text-primary hover:text-primary-focus dark:text-dark-primary">
            {next.title} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
};

export default HelpPage;
