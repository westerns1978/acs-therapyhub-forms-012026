import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const ClientLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock login - in a real app, validate against a client user database
        if (email && password) {
            navigate('/portal/dashboard');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-surface">
            <div className="w-full max-w-md p-8 space-y-8 bg-background rounded-2xl shadow-lg border border-border">
                <div className="text-center">
                    <img src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg" alt="ACS Logo" className="mx-auto h-16 object-contain dark:bg-white/90 dark:p-2 dark:rounded-lg" />
                    <h2 className="mt-6 text-2xl font-bold text-on-surface">Client Portal</h2>
                    <p className="mt-2 text-on-surface-secondary">Welcome. Please sign in to access your account.</p>
                </div>
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
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition"
                        >
                            Sign In
                        </button>
                    </div>
                </form>
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