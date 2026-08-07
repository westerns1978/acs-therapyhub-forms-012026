
import React from 'react';
import { Client } from '../../types';

/**
 * The identity fields this component actually reads. Widened from `Client`
 * (2026-08-07) so surfaces that hold a client-shaped row rather than a full
 * Client — a group-roster attendee, a Green Room attendee — can render the ONE
 * shared avatar instead of hand-rolling their own. A full `Client` still
 * satisfies this, so existing call sites are unchanged.
 */
export type AvatarClient = Pick<Client, 'id'> &
  Partial<Pick<Client, 'name' | 'initials' | 'avatarUrl'>>;

interface ClientAvatarProps {
  client: AvatarClient;
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

/**
 * Derived here as a fallback so a surface that carries a name but no precomputed
 * `initials` still gets the SAME glyph as everywhere else. Mirrors the rule in
 * services/api.ts's client mapper. Without this, such a surface fell through to
 * the grey placeholder icon below and the same person read as two different
 * marks on two screens.
 */
const toInitials = (name?: string) =>
  (name || '').split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/**
 * A generated placeholder is not a photo. Four client rows still carry a
 * `ui-avatars.com/api/?name=<CLIENT NAME>&background=8B1E24` URL persisted by
 * the old services/api.ts fallback. Honouring those would keep those four
 * clients rendering a flat third-party PNG — no identity signal, and a request
 * carrying the client's name to an external host — while the other eleven use
 * the shared palette. Ignored at the display layer so all fifteen agree with no
 * data migration; a genuinely uploaded photo is unaffected.
 */
const isGeneratedPlaceholder = (url: string) => url.includes('ui-avatars.com');

/**
 * Identity hue, keyed on the client id — the one input, so the same person is
 * the same colour on every surface. Never on name or list position.
 *
 * Reads the WHOLE id. It used to be `id.charCodeAt(0) % 6`, i.e. the first hex
 * character only, which gives 16 possible inputs and — worse — collapses any
 * shared id prefix onto a single hue. The demo seed deliberately namespaces its
 * rows under `dee0…`, so on the Green Room roster ten of eleven clients came out
 * the same mauve. Still one function, still deterministic, still id-keyed; it
 * just uses all 36 characters. Hues will differ from before for most clients,
 * which is the point — nothing depends on a specific client keeping a specific
 * colour, only on it being the same everywhere.
 */
const hueIndex = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % avatarColors.length;
};

const ClientAvatar: React.FC<ClientAvatarProps> = ({ client, className = '' }) => {
  if (client.avatarUrl && !isGeneratedPlaceholder(client.avatarUrl)) {
    return (
      <img
        src={client.avatarUrl}
        alt={client.name}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const initials = client.initials || toInitials(client.name);

  if (initials) {
    const color = avatarColors[hueIndex(client.id)];

    return (
      <div
        className={`flex items-center justify-center rounded-full text-white font-bold ${color} ${className}`}
        title={client.name}
      >
        <span>{initials}</span>
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
