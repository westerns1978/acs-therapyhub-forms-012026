import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MainLayout from '../../layouts/MainLayout';
import AcsTherapyHubLogo from '../../components/ui/AcsTherapyHubLogo';
import { GUIDE_PAGES } from './guide';
import './help.css';

// Help & Training is a destination WITHIN the app for signed-in staff (it renders
// inside the same MainLayout shell — NavigationSidebar / GlobalHeader / Clara — so
// the app chrome never disappears and every section stays one click away). It also
// stays readable for signed-out visitors, who get a lightweight public shell
// (MainLayout would bounce them to /login). Branding reuses the app theme tokens.

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-surface-secondary dark:text-dark-surface-secondary hover:bg-black/5 dark:hover:bg-white/10 hover:text-surface-content dark:hover:text-white'
  }`;

// The guide's own table-of-contents (secondary nav within Help).
const HelpContents: React.FC = () => (
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
);

// Contents + the active guide page. Shared by both shells.
const HelpBody: React.FC = () => (
  <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
    <HelpContents />
    <main className="min-w-0 max-w-3xl flex-1">
      <Outlet />
    </main>
  </div>
);

const HelpLayout: React.FC = () => {
  const { user } = useAuth();

  // Signed-in staff: render inside the full app shell so Help is part of the app,
  // not a separate space. The sidebar's "Help & Training" item stays highlighted
  // and the user can jump to any section without leaving a dead-end.
  if (user) {
    return (
      <MainLayout>
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-surface-content dark:text-white">
            Help &amp; Training
          </h1>
          <p className="mt-1 text-sm text-surface-secondary dark:text-dark-surface-secondary">
            Guides for using ACS TherapyHub.
          </p>
        </div>
        <HelpBody />
      </MainLayout>
    );
  }

  // Signed-out visitors: lightweight public shell with a clear path to sign in.
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-dark-background text-surface-content dark:text-dark-surface-content transition-colors duration-500">
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
            to="/login"
            className="text-sm font-bold text-primary hover:text-primary-focus dark:text-dark-primary"
          >
            Sign in &rarr;
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <HelpBody />
      </div>

      <footer className="border-t border-border dark:border-dark-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-surface-secondary dark:text-dark-surface-secondary">
          ACS TherapyHub &middot; Assessment &amp; Counseling Solutions
        </div>
      </footer>
    </div>
  );
};

export default HelpLayout;
