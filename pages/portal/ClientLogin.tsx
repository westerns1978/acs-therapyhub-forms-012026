import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPassword, DEMO_PASSWORD } from '../../services/authService';

// Demo personas map to EXISTING client rows (by email). Clicking one performs a
// REAL Supabase sign-in — it no longer fakes a session via sessionStorage.
// The demo portal auth accounts WERE provisioned 2026-06-02 (real auth.users
// rows, role 'Client' in app_metadata), so these buttons sign into real test
// accounts. (Stale "not provisioned yet" copy corrected 2026-06-11.)
const demoClients = [
  {
    name: 'Marcus Reyes',
    email: 'marcus.reyes.demo@gemyndflow.com',
    programLabel: 'SATOP Level IV',
    photoUrl: '/images/clients/marcus.png',
  },
  {
    name: 'Pat Novak',
    email: 'pat.novak.demo@gemyndflow.com',
    programLabel: 'Gambling Recovery',
    photoUrl: '/images/clients/pat.png',
  },
];

const ClientLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Real email/password sign-in. Wrong credentials are rejected by Supabase —
  // arbitrary email/password no longer logs anyone into real client data.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setIsLoading(true);
    const res = await signInWithPassword(email, password);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    navigate('/portal/dashboard');
  };

  const handleDemoLogin = async (clientEmail: string) => {
    setError('');
    setIsLoading(true);
    const res = await signInWithPassword(clientEmail, DEMO_PASSWORD);
    if (res.error) {
      // Surface the real failure — don't explain it away with a stale story.
      setError(`Demo client sign-in failed: ${res.error}`);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    navigate('/portal/dashboard');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="w-full max-w-md p-8 space-y-8 bg-background rounded-2xl shadow-lg border border-border">
        <div className="text-center">
          <img src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" alt="ACS Logo" className="mx-auto h-16 object-contain dark:bg-white/90 dark:p-2 dark:rounded-lg" />
          <h2 className="mt-6 text-2xl font-bold text-on-surface">Client Portal</h2>
          <p className="mt-2 text-on-surface-secondary">Welcome. Please sign in to access your account.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            <p className="text-xs font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-on-surface rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password-for-portal" className="sr-only">Password</label>
              <input
                id="password-for-portal"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-on-surface rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition disabled:opacity-50"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-1">
            Demo Access
          </p>
          <p className="text-[11px] text-gray-400 text-center mb-3 leading-relaxed">
            Signs into a real, provisioned demo account scoped to that client.
          </p>
          {demoClients.map(client => (
            <button
              key={client.email}
              onClick={() => handleDemoLogin(client.email)}
              disabled={isLoading}
              className="w-full text-left px-4 py-3 mb-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <img
                src={client.photoUrl}
                alt={client.name}
                className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-semibold text-sm">{client.name}</div>
                <div className="text-xs text-gray-500">{client.programLabel}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="text-center text-sm space-y-2">
          <Link to="/login" className="block font-medium text-primary hover:text-primary-focus">
            Are you a counselor? Log in here
          </Link>
          <Link to="/visitor-resources" className="block font-medium text-surface-secondary-content hover:text-primary">
            Looking for community resources? Click here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;
