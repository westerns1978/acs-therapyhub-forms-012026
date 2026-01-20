import React from 'react';
import { useLocation, Link } from 'react-router-dom';

// FIX: Corrected malformed viewBox attribute and added quotes to SVG properties to make them valid strings.
const ChevronRightIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 18 15 12 9 6"/></svg>;

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Do not show on the main dashboard page
  if (pathnames.length === 0 || (pathnames.length === 1 && pathnames[0] === 'dashboard')) {
    return null;
  }
  
  const formatBreadcrumb = (str: string) => {
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
          // Filter out numeric IDs and certain dynamic segments from the breadcrumb path
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
