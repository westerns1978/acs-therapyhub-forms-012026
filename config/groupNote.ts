/**
 * GROUP-NOTE DECLARED TYPES (L2, David's 7/15 note spec — exactly four).
 *
 * The declared type is chosen AT NOTE TIME — this is how Deb's alternating
 * Ed/Cns groups (and her MRT groups) work with no ahead-of-time designation.
 *
 * ACCRUAL RULE (Dan 7/28): MRT is a modality label, not an accrual category —
 * the MRT prefix never changes accrual. MRT Group Education accrues as
 * education; MRT Group Counseling accrues as counseling. Confirmed by
 * inference from David's four-type note spec; verbal confirmation pending
 * (see ROADMAP) since it touches hours.
 */
import type { ServiceType } from '../types';

export interface GroupDeclaredType {
    id: 'group_education' | 'group_counseling' | 'mrt_group_education' | 'mrt_group_counseling';
    label: string;
    /** WS3 accrual axis the seat appointments are written with. */
    serviceType: ServiceType;
}

export const GROUP_DECLARED_TYPES: GroupDeclaredType[] = [
    { id: 'group_education', label: 'Group Education', serviceType: 'education' },
    { id: 'group_counseling', label: 'Group Counseling', serviceType: 'counseling' },
    { id: 'mrt_group_education', label: 'MRT Group Education', serviceType: 'education' },
    { id: 'mrt_group_counseling', label: 'MRT Group Counseling', serviceType: 'counseling' },
];

export const declaredTypeById = (id: string | null | undefined): GroupDeclaredType | undefined =>
    GROUP_DECLARED_TYPES.find(t => t.id === id);

/** Sensible pre-selection from the group's session_kind; alternating/MRT rows
 *  force an explicit choice (return undefined → the select starts empty). */
export const defaultDeclaredTypeFor = (sessionKind: string | null | undefined): GroupDeclaredType | undefined => {
    if (sessionKind === 'therapy') return GROUP_DECLARED_TYPES[1];   // group_counseling
    if (sessionKind === 'education') return GROUP_DECLARED_TYPES[0]; // group_education
    return undefined; // 'alternating' and 'mrt' declare at note time
};
