import React from 'react';

const SynapseLogo: React.FC<React.ComponentProps<'svg'>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Central glowing core */}
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="4" strokeOpacity="0.5" />
    <circle cx="12" cy="12" r="6" strokeOpacity="0.3" />

    {/* Neural pathways */}
    <path d="M12 8V4" strokeOpacity="0.8" />
    <path d="M12 16v4" strokeOpacity="0.8" />
    <path d="M8 12H4" strokeOpacity="0.8" />
    <path d="M16 12h4" strokeOpacity="0.8" />
    <path d="M15.5 8.5l2.8-2.8" strokeOpacity="0.6" />
    <path d="M5.7 18.3l2.8-2.8" strokeOpacity="0.6" />
    <path d="M15.5 15.5l2.8 2.8" strokeOpacity="0.6" />
    <path d="M5.7 5.7l2.8 2.8" strokeOpacity="0.6" />
  </svg>
);

export default SynapseLogo;