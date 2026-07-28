
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

// Identity hues — decorative, NOT status (2026-07-28). These used to borrow
// emerald/amber/rose from the status families, so re-toning status desaturated
// half the avatars and left the other half bright. Pinned to arbitrary literals
// that no status ramp owns, so the two systems can never drag each other again.
const avatarColors = [
    'bg-[#4C6FA5]', 'bg-[#5B8C7B]', 'bg-[#A8763E]', 'bg-[#7C5C9E]', 'bg-[#9E5C72]', 'bg-[#3F7F8C]'
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
