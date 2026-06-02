import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AcsTherapyHubLogo from '../../components/ui/AcsTherapyHubLogo';
import { GUIDE_PAGES } from './guide';
import './help.css';

// Public, branded shell for the Help & Training pages. Deliberately does NOT use
// the authenticated MainLayout/NavigationSidebar — this renders for signed-out
// visitors too. Branding (logo, maroon primary, slate surfaces, fonts) is reused
// from the app's theme tokens so it reads as ACS TherapyHub.

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-surface-secondary dark:text-dark-surface-secondary hover:bg-black/5 dark:hover:bg-white/10 hover:text-surface-content dark:hover:text-white'
  }`;

const HelpLayout: React.FC = () => {
  const { user } = useAuth();
  // Signed-in visitors return to their dashboard; signed-out visitors go to login.
  const appHref = user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-dark-background text-surface-content dark:text-dark-surface-content transition-colors duration-500">
      {/* Public header */}
      <header className="sticky top-0 z-30 border-b border-border dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/help" className="flex items-center gap-3" aria-label="ACS TherapyHub Help & Training">
            <AcsTherapyHubLogo className="h-8" />
            <span className="hidden text-sm font-black uppercase tracking-[0.14em] text-surface-secondary dark:text-dark-surface-secondary sm:flex sm:items-center sm:gap-3">
              <span className="text-border dark:text-dark-border">|</span>
              Help &amp; Training
            </span>
          </Link>
          <Link
            to={appHref}
            className="text-sm font-bold text-primary hover:text-primary-focus dark:text-dark-primary"
          >
            {user ? 'Back to app' : 'Sign in'} &rarr;
          </Link>
        </div>
      </header>

      {/* Body: contents list + page content */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8 lg:flex-row lg:gap-10">
        <aside className="lg:w-64 lg:flex-shrink-0">
          <nav className="lg:sticky lg:top-24" aria-label="Guide contents">
            <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-surface-secondary dark:text-dark-surface-secondary">
              Contents
            </p>
            <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              <li>
                <NavLink to="/help" end className={navLinkClass}>
                  Overview
                </NavLink>
              </li>
              {GUIDE_PAGES.map((page) => (
                <li key={page.slug}>
                  <NavLink to={`/help/${page.slug}`} className={navLinkClass}>
                    {page.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl flex-1">
          <Outlet />
        </main>
      </div>

      {/* Public footer */}
      <footer className="border-t border-border dark:border-dark-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-surface-secondary dark:text-dark-surface-secondary">
          ACS TherapyHub &middot; Assessment &amp; Counseling Solutions
        </div>
      </footer>
    </div>
  );
};

export default HelpLayout;
