
import React from 'react';
import { useNotificationState } from '../../contexts/NotificationContext';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotificationState();

  return (
    <div className="fixed top-20 right-6 z-50 w-full max-w-sm space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white dark:bg-slate-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-fade-in-up"
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">{icons[notification.type]}</div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="bg-white dark:bg-slate-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
