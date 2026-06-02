import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { FILE_TO_SLUG } from './guide';

type LinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'internal'; pathname: string; hash: string }
  | { kind: 'passthrough'; href: string };

/**
 * Turn a link href found inside a guide markdown file into something the SPA can
 * navigate. The guide uses three link shapes:
 *   - external:        https://..., mailto:..., tel:...
 *   - cross-page:      "06-common-tasks.md" or "03-director.md#apply-a-treatment-plan"
 *   - same-page anchor: "#add-a-client"
 * Cross-page links are mapped from their .md filename to the matching /help route.
 */
function resolveTarget(rawHref: string, currentPathname: string): LinkTarget {
  const href = rawHref.trim();
  if (!href) return { kind: 'passthrough', href };

  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return { kind: 'external', href };
  }

  // Same-page anchor, e.g. "#add-a-client".
  if (href.startsWith('#')) {
    return { kind: 'internal', pathname: currentPathname, hash: href };
  }

  // Cross-page .md link, optionally with an anchor.
  const clean = href.replace(/^\.\//, '');
  const [file, anchor] = clean.split('#');
  const slug = FILE_TO_SLUG[file];
  if (slug) {
    return {
      kind: 'internal',
      pathname: `/help/${slug}`,
      hash: anchor ? `#${anchor}` : '',
    };
  }

  // Unknown (shouldn't happen for the current guide) — render as-is.
  return { kind: 'passthrough', href };
}

const GuideLink: React.FC<{ href?: string; children?: React.ReactNode }> = ({ href, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const target = resolveTarget(href ?? '', location.pathname);

  if (target.kind === 'external') {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  if (target.kind === 'passthrough') {
    return <a href={target.href}>{children}</a>;
  }

  // Internal: build a HashRouter-correct href (so open-in-new-tab / middle-click
  // still work) but navigate via the router on normal clicks.
  const hashHref = `#${target.pathname}${target.hash}`;
  return (
    <a
      href={hashHref}
      onClick={(e) => {
        // Let modified clicks (new tab, etc.) behave normally.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        navigate({ pathname: target.pathname, hash: target.hash });
      }}
    >
      {children}
    </a>
  );
};

// Wrap tables so they scroll horizontally on narrow phones instead of overflowing.
const TableWrap: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="help-table-wrap">
    <table>{children}</table>
  </div>
);

const COMPONENTS: Components = {
  a: GuideLink,
  table: TableWrap,
};

const HelpMarkdown: React.FC<{ markdown: string }> = ({ markdown }) => {
  return (
    <div className="help-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={COMPONENTS}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default HelpMarkdown;
