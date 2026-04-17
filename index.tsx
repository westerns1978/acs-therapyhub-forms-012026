
import React from 'react';
import ReactDOM from 'react-dom/client';
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
