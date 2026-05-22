import type { UserRole } from '../types';

export interface StaffDirectoryEntry {
  phone: string; // E.164, e.g. "+13145551234"
  email: string;
  name: string;
  role: UserRole;
}

// Trial roster. Maps the phone number the user types on the login screen to a
// role + identity, so iVALT success can resolve to a known staff member without
// requiring a Supabase session.
//
// TODO(Dan): replace the placeholder phone numbers with the real iVALT-
// registered numbers for David, Karen, and Jess before the first trial login.
//
// Post-trial: this hardcoded directory should be replaced by either
//   (a) an extension to the ivalt-auth edge function that returns role +
//       full_name with the validation response, or
//   (b) a Supabase staff_directory table with public-read RLS policy,
//       seeded from auth.users.phone + auth.users.raw_user_meta_data.
// Both options eliminate the need to ship phone numbers in the client bundle.
export const TRIAL_STAFF_DIRECTORY: StaffDirectoryEntry[] = [
  {
    phone: '+15555550100',
    email: 'david.yoder@acs-therapy.com',
    name: 'David Yoder',
    role: 'Director',
  },
  {
    phone: '+15555550101',
    email: 'karen@acs-therapy.com',
    name: 'Karen',
    role: 'Therapist',
  },
  {
    phone: '+15555550102',
    email: 'jessica@acs-therapy.com',
    name: 'Jessica',
    role: 'Admin',
  },
];

// Normalizes loose input (10-digit US, "+1...", "1-555-...") to E.164 before
// matching against the directory.
export function lookupStaffByPhone(rawPhone: string): StaffDirectoryEntry | undefined {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return undefined;
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return TRIAL_STAFF_DIRECTORY.find(s => s.phone === e164);
}
