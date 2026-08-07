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

/**
 * The ids the CLIENT attestation block reads, in precedence order. 'signature' is the
 * legacy name — no current definition declares it, but committed rows still carry it,
 * so it must keep resolving. Also the definition of "this form has a client
 * signature": the block's empty-state gate tests the fieldDefinitions against THIS
 * list, so what the block reads and what counts as declaring one cannot drift apart.
 */
const CLIENT_SIGNATURE_IDS = ['signature', 'clientSignature'] as const;

/**
 * The counter-signature ids and the heading each one prints, in precedence order —
 * see the counter-signature note further down for why there are four names for one
 * concept. The heading MUST travel with the id: once the block renders on declaration
 * as well as on value (below), an unsigned form has no value to infer the heading
 * from, and a falling-through ternary captioned every unsigned document
 * "Witness Acknowledgment" regardless of which line it actually has.
 */
const COUNTER_SIGNATURE_BLOCKS = [
  { id: 'staffSignature', heading: 'Staff Verification' },
  { id: 'counselorSignature', heading: 'Counselor Verification' },
  { id: 'therapistSignature', heading: 'Therapist Verification' },
  { id: 'witnessSignature', heading: 'Witness Acknowledgment' },
] as const;

const COUNTER_SIGNATURE_IDS = COUNTER_SIGNATURE_BLOCKS.map((b) => b.id);

/**
 * A SECOND CLIENT SIGNATURE, for a distinct authorization — not a counter-signature.
 *
 * Added 2026-08-05 for the outpatient Registration Form, whose paper carries TWO
 * signature lines the same person signs for two different purposes: the HIPAA
 * acknowledgement (which uses `clientSignature`, the form's primary attestation) and
 * this one, an insurance billing authorization the client signs only when ACS will
 * bill their insurer.
 *
 * WHY IT IS NOT ADDED TO CLIENT_SIGNATURE_IDS. That list is a precedence chain —
 * `.map(...).find(Boolean)` — so a second id there would collapse into the same
 * block and only ONE of the two would print. They are separate attestations to
 * separate paragraphs, and a record showing one signature where the client gave two
 * misstates what was agreed to.
 *
 * ITS OWN BLOCK, deliberately spare: heading plus the signature rule, and nothing
 * else. It carries NO "ELECTRONICALLY COMMITTED VIA THERAPYHUB AUTH" line and no
 * timestamp — the first is a claim about the auth path that this block has no more
 * standing to make than the client one does, and the second is the §10a defect class
 * (a date printed under a signature heading reads as when it was witnessed).
 *
 * BLAST RADIUS: none. No existing definition declares this id and no committed row
 * carries the key, so every prior baseline renders byte-identically — verified by
 * gate 3 on the commit that added it.
 */
const AUTHORIZATION_SIGNATURE_ID = 'authorizationSignature';

/**
 * Field ids the ATTESTATION BLOCKS at the foot of the document render. They are
 * skipped in the field loop so a signature appears ONCE, as a signature — previously
 * every signature printed TWICE, once as an ordinary answer row and again in its
 * block (verified on telehealth-consent for staff and hipaa-ack for the client).
 *
 * SAFETY DEPENDS ON THIS LIST MATCHING THE BLOCK GATES BELOW. Every id here must be
 * rendered by a block; an id skipped here but missing from the gates would DISAPPEAR
 * from the printed record entirely. That is why adding a sixth name for "signature"
 * is a two-place change: the id list above, and the block that renders it.
 *
 * BOTH HALVES ARE NOW ENFORCED, not just documented — gate 5 of `npm run check:forms`
 * fails if a definition declares a signature-ish field missing from this set (it would
 * print as an ordinary data row), and separately if an id in this set is not actually
 * rendered by a block (it would vanish). Exported for that gate: the check must read
 * the real set, because a hand-copied duplicate would go green while drifting.
 *
 * Dates are deliberately absent: signatureDate / clientDate / counselorDate are data,
 * not signatures, and keep printing as ordinary rows.
 */
export const SIGNATURE_FIELD_IDS: ReadonlySet<string> = new Set<string>([
  ...CLIENT_SIGNATURE_IDS,
  ...COUNTER_SIGNATURE_IDS,
  AUTHORIZATION_SIGNATURE_ID,
]);

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
    // Legacy 'object' boolean-map. Map keys to option labels WHEN the definition
    // declares them, falling back to the raw key otherwise — so meeting-report's
    // meetingType prints "AA, Discussion, Big Book" instead of the storage keys, while
    // consent's groupDays (keys 'Mon'..'Fri', no options declared) is untouched.
    displayValue = Object.keys(value).filter(k => value[k])
      .map(k => options?.find(o => o.value === k)?.label ?? k).join(', ');
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

  /* THE CLIENT CERTIFICATE GATE — same class as the CLIENT EMAIL header (bb08a4c):
   * a block rendering unconditionally for a field the form does not declare. Five of
   * the fourteen forms have no client signature at all (discharge-summary,
   * chart-checklist, meeting-report, satop-intake, telehealth-feedback), and this block
   * sits OUTSIDE the fieldDefinitions loop — so every one of those records printed
   * "CLIENT DIGITAL CERTIFICATE / N/A" under a signature rule. On discharge-summary,
   * a staff-authored document a counselor signs, that reads as a client who failed to
   * sign. It is a stronger misstatement than the email one: an absent email is an
   * omission, an absent signature is a finding.
   *
   * VALUE PRESENT *OR* THE FORM DECLARES ONE. Value-presence alone would be the
   * bb08a4c rule exactly, and it is the half that matters most: removing a field from
   * a definition does NOT remove it from rows already committed, so a legacy stored
   * signature must keep printing. Censoring it would make the paper disagree with the
   * JSONB — the principle already settled in shouldPrintField (config/fieldVisibility.ts).
   *
   * THE `OR` IS THE DELIBERATE DIFFERENCE FROM clientEmail, and it is the clientName
   * argument, not a departure from it. The header comment above draws the line at
   * whether an absent value is ALARMING: clientName is unconditional because all 14
   * definitions declare it, so a missing one is always alarming and must print loudly
   * as N/A rather than vanish; clientEmail renders on value alone because a missing
   * email asserts nothing. A client signature is alarming ONLY on a form that asks for
   * one. So the test is per-form rather than per-catalog: where the definition declares
   * a client signature, an empty one still prints N/A and keeps its alarm; where the
   * definition declares none, the block is not a missing signature, it is a question
   * the document never asked. Same rule, evaluated per form — the asymmetry with
   * clientEmail is that a signature has an alarming absence and an email does not.
   *
   * Both decisions are deliberate. A reader comparing them should find the same test
   * applied, not two conventions. */
  const declaredIds = new Set(formDefinition.fieldDefinitions.map((f) => f.id));

  const clientSignature = CLIENT_SIGNATURE_IDS.map((id) => formData[id]).find(Boolean);
  const declaresClientSignature = CLIENT_SIGNATURE_IDS.some((id) => declaredIds.has(id));
  const showClientCertificate = Boolean(clientSignature) || declaresClientSignature;

  /* THE COUNTER-SIGNATURE VISIBILITY RULE — declaration-or-value, the same shape the
   * client certificate got above. On a compliance document the ABSENCE of a required
   * counter-signature is information the reader needs: a block that appears only once
   * signed makes "not yet counter-signed" and "this form has no staff line at all"
   * look identical on paper, and the probation officer or judge reading it cannot tell
   * which they are holding. Printing the heading with N/A distinguishes them. Same
   * principle as clientName printing N/A unconditionally — an absence that is
   * ALARMING must be shown, not omitted.
   *
   * THIS PARTIALLY REVERSES D-i FOR THIS BLOCK ONLY, and a future reader must not read
   * it as undoing D-i. D-i's actual fix was removing the DUPLICATE field row — a
   * signature printing twice, once as an ordinary answer and again in its block. That
   * stands, untouched: every counter-signature id is still skipped in the field loop
   * and still renders exactly once. What D-i also did, as a side effect rather than as
   * its point, was make the block itself disappear when unsigned. That side effect is
   * what is undone here.
   *
   * WHICH id supplies the heading: the one that is SIGNED if any is, otherwise the one
   * the definition DECLARES. Inferring it from the value alone (the old ternary chain)
   * silently captioned every unsigned form "Witness Acknowledgment", because with no
   * value the chain falls through to its last arm — so an unsigned discharge summary,
   * which has a counselor line and no witness line, would have printed the wrong role
   * over the empty signature rule. */
  const counterSigned = COUNTER_SIGNATURE_BLOCKS.find((b) => formData[b.id]);
  const counterDeclared = COUNTER_SIGNATURE_BLOCKS.find((b) => declaredIds.has(b.id));
  const counterBlock = counterSigned ?? counterDeclared;
  const showCounterSignature = Boolean(counterBlock);

  /* Declaration-or-value, the same rule as the two blocks above and for the same
   * reason: on a form that ASKS for this authorization, an unsigned one is
   * information the reader needs, and on a form that never asks it is not a missing
   * signature at all. See AUTHORIZATION_SIGNATURE_ID. */
  const authorizationSignature = formData[AUTHORIZATION_SIGNATURE_ID];
  const showAuthorizationSignature =
    Boolean(authorizationSignature) || declaredIds.has(AUTHORIZATION_SIGNATURE_ID);

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
          // Rendered by the attestation blocks at the foot of the document, not here.
          if (SIGNATURE_FIELD_IDS.has(field.id)) return null;
          {/* SAME resolver as the live renderer (config/fieldPath.ts) — if these
              ever diverge, a committed record can render differently from what
              the client saw and signed. Literal-first keeps legacy flat-dotted
              rows byte-identical; nested rows written post-1a fall through.
              shouldPrintField hides a conditional field UNLESS a (legacy) stored
              value is present — new records never store hidden values (submit
              strips them), so a non-empty hidden value is a pre-predicate row and
              the record must show it. config/fieldVisibility.ts. */}
          if (!shouldPrintField(field, formData)) return null;
          return <PrintField key={field.id} label={field.label} value={resolveFieldValue(formData, field.id)} type={field.type} options={(field.type === 'select' || field.type === 'checkbox-group' || field.type === 'object') ? field.options : undefined} />
        })}
      </div>

      {/* The whole attestation footer is suppressed when NEITHER block renders —
          otherwise a document with no signatures of any kind (meeting-report,
          satop-intake, telehealth-feedback) ends in a bare horizontal rule over five
          rems of empty page, which reads as a signature area someone left blank. */}
      {(showClientCertificate || showCounterSignature || showAuthorizationSignature) && (
      <div className="mt-20 pt-10 border-t-2 border-gray-100 grid grid-cols-2 gap-x-12">
        {showClientCertificate && (
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Client Digital Certificate</h2>
          <div className="border-b-2 border-gray-900 pb-2">
            <p className="font-serif text-2xl italic">{clientSignature || 'N/A'}</p>
          </div>
          <p className="text-[9px] text-gray-400 font-bold uppercase">ELECTRONICALLY COMMITTED VIA THERAPYHUB AUTH</p>
        </div>
        )}
        {/* THE COUNTER-SIGNATURE. Four field names across the catalog mean the same
         *  thing — the non-client person who signed:
         *    staffSignature      consent-treatment, satop-checklist, telehealth-consent
         *    counselorSignature  recovery-plan, discharge-summary
         *    therapistSignature  chart-checklist
         *    witnessSignature    emergency-contact
         *  This gate checked only staff/witness, so a Counselor or Therapist signature
         *  rendered as an ordinary text row while a Staff one got the attestation
         *  block — the same signature treated as data on some clinical records and as a
         *  signature on others, decided by which noun a form happened to use.
         *
         *  Four names for one concept is a naming problem, not four concepts. Resolving
         *  it here is the narrow fix; consolidating the field ids across the forms is
         *  the real one and is NOT attempted in this pass. */}
        {counterBlock && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{counterBlock.heading}</h2>
            <div className="border-b-2 border-gray-900 pb-2">
              <p className="font-serif text-2xl italic">{formData[counterBlock.id] || 'N/A'}</p>
            </div>
            {/* recordDate, NOT new Date() — see the comment on recordDate. A reprint
                must not restamp this block with today; it reads as the date the
                signature was witnessed.
                ONLY WHEN SIGNED, for that same reason. Once the block renders on
                declaration too, an unsigned counter-signature would otherwise carry
                "SYSTEM TIMESTAMPED: <date>" under an N/A signature rule — a witness
                time for an event that did not happen. That is the §10a defect class
                exactly (a date on a court-facing document asserting something untrue),
                and it would be introduced BY making the block visible when unsigned. */}
            {counterSigned && (
            <p className="text-[9px] text-gray-400 font-bold uppercase">SYSTEM TIMESTAMPED: {recordDate.toLocaleString()}</p>
            )}
          </div>
        )}
        {/* The insurance-billing authorization — a SECOND client signature, not a
         *  counter-signature. Heading and rule only: no auth claim, no timestamp.
         *  See AUTHORIZATION_SIGNATURE_ID for why it is not folded into the client
         *  certificate block above. */}
        {showAuthorizationSignature && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Insurance Authorization</h2>
            <div className="border-b-2 border-gray-900 pb-2">
              <p className="font-serif text-2xl italic">{authorizationSignature || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>
      )}
      
      {/* The fabricated "ENCRYPTION HASH … HIPAA SECURE NODE 04" footer is REMOVED
          (2026-07-28): it was decorative fiction (the "hash" was the brand hex) on a
          document that reaches courts and POs. Do not reintroduce security theater —
          if a real integrity attestation ever exists, print that. */}
    </div>
  );
};
