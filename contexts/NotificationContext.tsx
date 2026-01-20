
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: NotificationType) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(currentNotifications =>
      currentNotifications.filter(n => n.id !== id)
    );
  }, []);

  const addNotification = useCallback((message: string, type: NotificationType) => {
    const id = uuidv4();
    setNotifications(currentNotifications => [
      ...currentNotifications,
      { id, message, type },
    ]);
    setTimeout(() => {
      removeNotification(id);
    }, 5000); // Auto-remove after 5 seconds
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): Omit<NotificationContextType, 'notifications' | 'removeNotification'> => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return { addNotification: context.addNotification };
};

export const useNotificationState = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotificationState must be used within a NotificationProvider');
    }
    return { notifications: context.notifications, removeNotification: context.removeNotification };
}
