
import React from 'react';
import { Client } from '../../types';

interface ClientAvatarProps {
  client: Client;
  className?: string;
}

const UserIcon = (props: React.ComponentProps<'svg'>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const avatarColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500'
];

const ClientAvatar: React.FC<ClientAvatarProps> = ({ client, className = '' }) => {
  if (client.avatarUrl) {
    return (
      <img
        src={client.avatarUrl}
        alt={client.name}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  if (client.initials) {
    const colorIndex = client.id.charCodeAt(0) % avatarColors.length;
    const color = avatarColors[colorIndex];
    
    return (
      <div
        className={`flex items-center justify-center rounded-full text-white font-bold ${color} ${className}`}
        title={client.name}
      >
        <span>{client.initials}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gray-300 text-white ${className}`}
      title={client.name}
    >
      <UserIcon className="w-1/2 h-1/2" />
    </div>
  );
};

export default ClientAvatar;
