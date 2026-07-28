import React from 'react';

/**
 * The ACS logo lockup (J6 branding hygiene, 2026-07-28). This is David Yoder's
 * product: the sidebar/header logo component was previously named
 * "GemyndFlowLogo" (vendor name) with this file as a shim around it - inverted.
 * The asset is self-hosted under /branding (it used to load from the vendor's
 * public storage bucket).
 *
 * MARK discipline (J4b): the logo's vermillion lives in the asset only - it is
 * never sampled into UI colors.
 */
const AcsTherapyHubLogo: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={`flex items-center gap-2 ${className ?? ''}`} {...props}>
    <img src="/branding/acs-logo.svg" alt="ACS TherapyHub" className="h-8" />
  </div>
);

export default AcsTherapyHubLogo;
