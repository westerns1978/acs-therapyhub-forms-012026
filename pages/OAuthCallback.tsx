import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { completeGoogleOAuth } from '../services/googleCalendar';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const OAuthCallback: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
    const [message, setMessage] = useState('Completing Google connection...');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state') || '';
        const errorParam = params.get('error');

        if (errorParam) {
            setStatus('error');
            setMessage(`Google denied the request: ${errorParam}`);
            return;
        }
        if (!code || !state.startsWith('google:')) {
            setStatus('error');
            setMessage('Missing authorization code. Restart the connection from Settings.');
            return;
        }
        if (!user?.id) {
            setStatus('error');
            setMessage('You must be signed in to complete this connection.');
            return;
        }

        (async () => {
            try {
                const { email } = await completeGoogleOAuth(code, state, String(user.id));
                setStatus('ok');
                setMessage(email ? `Connected ${email}` : 'Connected to Google Calendar');
                setTimeout(() => navigate('/settings', { replace: true }), 1500);
            } catch (e: any) {
                setStatus('error');
                setMessage(e?.message || 'Connection failed.');
            }
        })();
    }, [location.search, user?.id, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                <div className="flex justify-center mb-4">
                    {status === 'working' && <Loader2 className="w-12 h-12 text-primary animate-spin" />}
                    {status === 'ok' && <CheckCircle className="w-12 h-12 text-green-500" />}
                    {status === 'error' && <AlertTriangle className="w-12 h-12 text-red-500" />}
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {status === 'working' && 'Connecting to Google'}
                    {status === 'ok' && 'Connection Successful'}
                    {status === 'error' && 'Connection Failed'}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
                {status === 'error' && (
                    <button
                        onClick={() => navigate('/settings', { replace: true })}
                        className="mt-6 px-5 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-focus transition"
                    >
                        Back to Settings
                    </button>
                )}
            </div>
        </div>
    );
};

export default OAuthCallback;
