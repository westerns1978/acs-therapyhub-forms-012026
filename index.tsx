
import React from 'react';
import ReactDOM from 'react-dom/client';
// Tailwind, compiled at BUILD time (2026-08-07). Replaces the render-blocking
// cdn.tailwindcss.com Play-CDN runtime compiler that used to sit in index.html.
// Must be imported before App so the utilities are in the bundle's CSS.
import './styles/tailwind.css';
import App from './App';

// OAuth redirects (Google, Zoom) land on origin root with ?code=&state=<provider>:...
// HashRouter can't read those without help, so forward into the hash route
// before React mounts.
(() => {
  const search = window.location.search;
  if (!search || !search.includes('code=')) return;
  const params = new URLSearchParams(search);
  const state = params.get('state') || '';
  if (!state.startsWith('google:') && !state.startsWith('zoom:')) return;
  const next = `${window.location.origin}${window.location.pathname}#/oauth/callback${search}`;
  window.history.replaceState(null, '', next);
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
