import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const ChevronRightIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 18 15 12 9 6"/></svg>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache client names by UUID so we don't re-fetch on every nav. Lives for the
// session — names rarely change.
const clientNameCache = new Map<string, string>();

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>(() => Object.fromEntries(clientNameCache));

  // Find UUID segments under a /clients/ path and resolve them to client.name.
  // We only do the lookup for the /clients/ route to avoid a fetch on every
  // breadcrumb render across the app.
  useEffect(() => {
    const clientsIdx = pathnames.findIndex(p => p === 'clients');
    if (clientsIdx === -1) return;
    const candidates = pathnames.slice(clientsIdx + 1).filter(seg => UUID_RE.test(seg) && !clientNameCache.has(seg));
    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', candidates);
        if (cancelled || !data) return;
        const updates: Record<string, string> = {};
        for (const row of data) {
          clientNameCache.set(row.id, row.name);
          updates[row.id] = row.name;
        }
        setResolvedNames(prev => ({ ...prev, ...updates }));
      } catch (e) {
        console.warn('[Breadcrumbs] client name lookup failed:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [location.pathname]);

  // Do not show on the main dashboard page
  if (pathnames.length === 0 || (pathnames.length === 1 && pathnames[0] === 'dashboard')) {
    return null;
  }

  const formatBreadcrumb = (str: string) => {
    // If it's a UUID, prefer the resolved client name; otherwise hide it
    // entirely until the lookup completes (better than showing the raw UUID).
    if (UUID_RE.test(str)) {
      return resolvedNames[str] || clientNameCache.get(str) || '…';
    }
    return str
      .replace(/-/g, ' ')
      .replace(/(\b\w)/g, (char) => char.toUpperCase());
  };

  return (
    <nav aria-label="breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-surface-secondary-content dark:text-dark-surface-secondary-content">
        <li>
          <Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
        </li>
        {pathnames.map((value, index) => {
          // Numeric IDs and certain dynamic segments hide entirely
          if (!isNaN(parseInt(value)) || ['sign'].includes(value)) {
              return null;
          }

          const isLast = index === pathnames.length - 1 || (!isNaN(parseInt(pathnames[index + 1])));
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const name = formatBreadcrumb(value);

          return (
            <li key={routeTo} className="flex items-center">
              <ChevronRightIcon className="w-4 h-4 mx-1" />
              {isLast ? (
                <span className="font-semibold text-surface-content dark:text-dark-surface-content" aria-current="page">
                    {name}
                </span>
              ) : (
                <Link to={routeTo} className="hover:text-primary transition-colors">{name}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
