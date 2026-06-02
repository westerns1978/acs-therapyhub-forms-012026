import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GUIDE_PAGES } from './guide';

// Landing page at /help. Purely navigational — it introduces the guide and links
// to each section. (Per scope, it does not describe app features itself.)
const HelpHome: React.FC = () => {
  useEffect(() => {
    document.title = 'Help & Training · ACS TherapyHub';
  }, []);

  return (
    <div>
      <div className="help-content">
        <h1>Help &amp; Training</h1>
        <p>
          Welcome! These short guides walk you through ACS TherapyHub during your
          trial. You can read them in order or jump straight to whatever you need.
          Pick a topic to begin.
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GUIDE_PAGES.map((page, i) => (
          <li key={page.slug}>
            <Link
              to={`/help/${page.slug}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-white/60 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 dark:border-dark-border dark:bg-dark-surface/40 dark:hover:bg-primary/10"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary dark:text-dark-primary">
                {i + 1}
              </span>
              <span className="font-bold text-surface-content dark:text-dark-surface-content">
                {page.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HelpHome;
