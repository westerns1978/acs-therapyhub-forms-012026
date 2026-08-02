import React from 'react';
import { FormDefinition } from '../types';
import { resolveFieldValue } from '../config/fieldPath';
import { shouldPrintField } from '../config/fieldVisibility';

interface PrintPreviewProps {
  formData: any;
  formDefinition: FormDefinition<any>;
  /** When reprinting an EXISTING record (SubmissionViewer print action), the
   *  original submission date — a reprint must not restamp today as the commit
   *  date. Omitted in the live commit flow, where "today" is genuinely the
   *  commit date (2026-07-28). */
  committedAt?: string | Date;
}

const PrintField: React.FC<{ label: string; value: any, type?: string, options?: { value: string; label: string }[] }> = ({ label, value, type, options }) => {
  // Display-only prose prints as the paragraph it is — no label chrome, no value
  // row, no "N/A". This is document text (Consent's numbered narrative clauses),
  // so on a committed record it must read exactly as it does on ACS's paper.
  if (type === 'static') {
    return (
      <p className="text-sm text-black leading-relaxed mb-3 break-inside-avoid whitespace-pre-wrap">{label}</p>
    );
  }
  let displayValue: string;
  // Options-aware label mapping for the NEW types only ('select' /
  // 'checkbox-group') — committed records should print human labels
  // ("Group Counseling"), not machine tokens ("groupCounseling"). Gated so
  // every legacy field's output stays byte-identical (witnessed against
  // auth row 47431370).
  if (type === 'select' && options) {
    displayValue = options.find(o => o.value === value)?.label ?? (value || 'N/A');
  } else if (type === 'checkbox-group' && options && value && typeof value === 'object') {
    displayValue = Object.keys(value).filter(k => value[k]).map(k => options.find(o => o.value === k)?.label ?? k).join(', ') || 'N/A';
  } else if (type === 'rating' && typeof value === 'number') {
    displayValue = `${value}/5`;
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (typeof value === 'object' && value !== null) {
    displayValue = Object.keys(value).filter(k => value[k]).join(', ');
  } else {
    displayValue = value || 'N/A';
  }

  return (
    <div className="mb-4 break-inside-avoid border-b border-gray-100 pb-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</h3>
      <p className="text-sm text-black whitespace-pre-wrap font-medium">{displayValue}</p>
    </div>
  );
};

export const PrintPreview: React.FC<PrintPreviewProps> = ({ formData, formDefinition, committedAt }) => {
  /**
   * THE ONLY CLOCK READ IN THIS COMPONENT. Every date this document prints must
   * derive from `recordDate` — do NOT call new Date() again further down.
   *
   * Why this is load-bearing: a reprint (SubmissionViewer passes committedAt)
   * must show when the record was COMMITTED, not when it was reprinted. 83f4826
   * established that for the header and left the signature block calling
   * new Date() directly, so reprinting a June record in August printed
   * "COMMITTED RECORD: 6/14/2026" beside "SYSTEM TIMESTAMPED: 8/1/2026" — and
   * the second one sits under the staff-verification heading, where it reads as
   * the date a staff member witnessed the signature. On a document that reaches
   * courts and probation officers that is a false assertion, not a cosmetic
   * mismatch. Fixed 2026-08-01; docs/design/forms-revision-080126.md §10a.
   *
   * Resolving once also removes the midnight-straddle variant: two separate
   * reads could land on different days.
   */
  const recordDate = committedAt ? new Date(committedAt) : new Date();
  return (
    <div className="p-12 bg-white text-black font-sans min-h-screen">
      <div className="flex justify-between items-start mb-10 border-b-2 border-gray-900 pb-6">
        <div>
            <img
              src="/branding/acs-logomark.svg"
              alt="ACS Logo"
              className="h-16 object-contain"
            />
            <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">11648 Gravois, Suite 245, St. Louis, MO 63126</p>
        </div>
        <div className="text-right">
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{formDefinition.title}</h1>
            <p className="text-sm font-bold text-gray-600 mt-2">COMMITTED RECORD: {recordDate.toLocaleDateString()}</p>
        </div>
      </div>

      {/* THE ASYMMETRY HERE IS DELIBERATE — do not "fix" it into symmetry.
       *
       * Client Name is UNCONDITIONAL: if a committed clinical record somehow has no
       * client name on it, that must print loudly as N/A, not vanish. An absent name
       * is alarming; silently omitting the row would hide the alarm.
       *
       * Client Email renders ONLY when a value is present. Nine of the fourteen forms
       * do not declare a clientEmail field at all (authorization-release stopped
       * declaring it in 5535f0c, per David), and this header sits OUTSIDE the
       * fieldDefinitions loop — so every one of those records printed "CLIENT EMAIL /
       * N/A" on a document that goes to courts and POs.
       *
       * WHY NOT GATE ON "the definition declares the field" instead — the tidier-looking
       * option: because it would stop printing FOUR real stored emails, including row
       * 47431370's legacy TBecker@gomail.com. Removing a field from a form does NOT
       * remove it from rows already committed, and this codebase already settled that
       * principle in shouldPrintField (config/fieldVisibility.ts): the committed record
       * must show what is actually IN the record — censoring a legacy value at print
       * would make the paper disagree with the JSONB. Value-presence honours that;
       * field-presence violates it.
       */}
      <div className="grid grid-cols-2 gap-x-12 mb-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <PrintField label="Client Name" value={formData.clientName} />
        {formData.clientEmail ? <PrintField label="Client Email" value={formData.clientEmail} /> : null}
      </div>

      <div className="space-y-6">
        {formDefinition.fieldDefinitions.map(field => {
          if (field.id === 'clientName' || field.id === 'clientEmail') return null;
          {/* SAME resolver as the live renderer (config/fieldPath.ts) — if these
              ever diverge, a committed record can render differently from what
              the client saw and signed. Literal-first keeps legacy flat-dotted
              rows byte-identical; nested rows written post-1a fall through.
              shouldPrintField hides a conditional field UNLESS a (legacy) stored
              value is present — new records never store hidden values (submit
              strips them), so a non-empty hidden value is a pre-predicate row and
              the record must show it. config/fieldVisibility.ts. */}
          if (!shouldPrintField(field, formData)) return null;
          return <PrintField key={field.id} label={field.label} value={resolveFieldValue(formData, field.id)} type={field.type} options={(field.type === 'select' || field.type === 'checkbox-group') ? field.options : undefined} />
        })}
      </div>

      <div className="mt-20 pt-10 border-t-2 border-gray-100 grid grid-cols-2 gap-x-12">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Client Digital Certificate</h2>
          <div className="border-b-2 border-gray-900 pb-2">
            <p className="font-serif text-2xl italic">{formData.signature || formData.clientSignature || 'N/A'}</p>
          </div>
          <p className="text-[9px] text-gray-400 font-bold uppercase">ELECTRONICALLY COMMITTED VIA THERAPYHUB AUTH</p>
        </div>
        {(formData.staffSignature || formData.witnessSignature) && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{formData.staffSignature ? 'Staff Verification' : 'Witness Acknowledgment'}</h2>
            <div className="border-b-2 border-gray-900 pb-2">
              <p className="font-serif text-2xl italic">{formData.staffSignature || formData.witnessSignature}</p>
            </div>
            {/* recordDate, NOT new Date() — see the comment on recordDate. A reprint
                must not restamp this block with today; it reads as the date the
                signature was witnessed. */}
            <p className="text-[9px] text-gray-400 font-bold uppercase">SYSTEM TIMESTAMPED: {recordDate.toLocaleString()}</p>
          </div>
        )}
      </div>
      
      {/* The fabricated "ENCRYPTION HASH … HIPAA SECURE NODE 04" footer is REMOVED
          (2026-07-28): it was decorative fiction (the "hash" was the brand hex) on a
          document that reaches courts and POs. Do not reintroduce security theater —
          if a real integrity attestation ever exists, print that. */}
    </div>
  );
};
