import React, { useState, useEffect } from 'react';

const BellIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const BellOffIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5.16"/><line x1="1" x2="23" y1="1" y2="23"/></svg>;

const PushNotificationButton: React.FC = () => {
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            alert('This browser does not support notifications.');
            return;
        }

        const currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
            console.log('Notification permission granted.');
            showTestNotification();
        }
    };
    
    const showTestNotification = () => {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('TherapyHub Notifications Enabled', {
                body: 'You will now receive compliance reminders and alerts.',
                icon: 'https://www.gstatic.com/images/branding/product/1x/aistudio_192dp.png'
            });
        });
    }

    if (!('Notification' in window)) {
        return null;
    }

    if (permission === 'granted') {
        return (
            <button onClick={showTestNotification} className="p-2 text-green-500" title="Notifications are enabled. Click to test.">
                <BellIcon className="h-6 w-6" />
            </button>
        );
    }

    return (
        <button onClick={requestPermission} className="p-2 text-on-surface-secondary dark:text-slate-400 hover:text-primary" title="Enable Notifications">
            {permission === 'denied' ? <BellOffIcon className="h-6 w-6" /> : <BellIcon className="h-6 w-6" />}
        </button>
    );
};

export default PushNotificationButton;
