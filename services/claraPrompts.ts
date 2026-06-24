/**
 * Clara contextual-action prompt composers — the ONE place seeded prompts are built.
 *
 * HONESTY CONTRACT (non-negotiable):
 *   • Every function is PURE: primitives in, a prompt string out. No fetching, no React,
 *     no DB. Callers pass ONLY facts already loaded and displayed on the current screen.
 *   • Clara (staff) has no client-data read tool — she can only phrase what we hand her.
 *     So each prompt (a) supplies the real facts inline and (b) instructs her to use ONLY
 *     those facts and to say plainly when something isn't established, never inventing a
 *     number, date, or status.
 *   • No mock. If a fact is unknown on the page, it is passed as null and rendered as an
 *     honest "not established / not on file" — never a fabricated value.
 *
 * This keeps the auditable line bright: if it isn't in these strings, Clara can't claim it.
 */

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Facts for the "Summarize this client" action — all sourced from ClientWorkspace state
 *  (client + composeProgress + signed forms + timeline + balance), which is already on screen. */
export interface ClientSummaryFacts {
  staffFirstName: string;
  name: string;
  programLabel: string;            // e.g. "SATOP Level IV (SROP)" or "Anger Management" — as the header shows
  lifecycle: string;               // active / completed / archived (the lifecycle badge)
  established: boolean;             // a current signed placement determination exists
  completedTotal: number;          // authoritative accrued hours
  requiredTotal: number | null;    // null until a determination is signed
  progressPct: number | null;      // null until established
  isSrop: boolean;
  counselingCompleted: number;
  counselingRequired: number | null;   // 35 for SROP, else null
  signedFormsCount: number | null;     // ids in the signed-forms set
  requiredFormsCount: number | null;   // required forms for the level (null until established)
  outstandingBalance: number | null;   // clients.balance
  timelineReview: string | null;       // non-SATOP review state shown in the header (else null)
}

/**
 * Compose the client-summary prompt from real, on-screen facts. The bullet list is built
 * only from values the page already holds; missing values become honest "not established"
 * lines rather than being dropped (so Clara can't quietly fill the gap).
 */
export function buildClientSummaryPrompt(f: ClientSummaryFacts): string {
  const lines: string[] = [];
  lines.push(`- Name: ${f.name}`);
  lines.push(`- Program: ${f.programLabel}`);
  lines.push(`- Lifecycle status: ${f.lifecycle}`);

  if (f.established && f.requiredTotal != null) {
    lines.push(`- Hours: ${f.completedTotal} of ${f.requiredTotal} required${f.progressPct != null ? ` (${f.progressPct}%)` : ''}`);
    if (f.isSrop && f.counselingRequired != null) {
      lines.push(`- Counseling hours (SROP floor): ${f.counselingCompleted} of ${f.counselingRequired} required`);
    }
  } else {
    lines.push(`- Hours: ${f.completedTotal} accrued; required total is NOT established (no signed placement determination yet)`);
  }

  if (f.signedFormsCount != null) {
    lines.push(`- Required forms signed: ${f.signedFormsCount}${f.requiredFormsCount != null ? ` of ${f.requiredFormsCount}` : ''}`);
  }
  if (f.outstandingBalance != null) {
    lines.push(`- Outstanding balance: ${f.outstandingBalance > 0 ? money(f.outstandingBalance) : 'none'}`);
  }
  if (f.timelineReview) {
    lines.push(`- Plan review: ${f.timelineReview}`);
  }

  return [
    `Give ${f.staffFirstName} a brief, plain-language at-a-glance summary of where this client stands and the single most useful next step.`,
    ``,
    `Use ONLY the facts below — they are this client's current record. Do not invent or infer any number, date, level, or status that is not listed. If the required total or a determination is not established, say so plainly rather than guessing.`,
    ``,
    `Facts:`,
    ...lines,
    ``,
    `Keep it to 3–4 short sentences, warm and calm. End with one concrete next step that follows from these facts.`,
  ].join('\n');
}

/** Facts for "Clara, explain this flag" — the exact GuardrailVerdict already rendered in the row. */
export interface GuardrailExplainFacts {
  staffFirstName: string;
  clientName: string;
  program: string;
  status: 'warning' | 'violation';
  headline: string;
  detail: string;
  citation: string;
}

/** Compose the guardrail-explanation prompt from the real verdict already on the card. */
export function buildGuardrailExplainPrompt(g: GuardrailExplainFacts): string {
  return [
    `Explain this compliance flag to ${g.staffFirstName} in plain language — what it means and what it implies for next steps.`,
    ``,
    `Use ONLY the facts below (this is an engine-computed Missouri 9 CSR check already shown on the dashboard). Do not invent additional client details, numbers, or deadlines beyond what's here.`,
    ``,
    `Flag:`,
    `- Client: ${g.clientName} (${g.program})`,
    `- Severity: ${g.status}`,
    `- Headline: ${g.headline}`,
    `- Detail: ${g.detail}`,
    `- Citation: ${g.citation}`,
    ``,
    `Keep it to 2–3 short sentences, calm and clear. Explain the rule in everyday terms and the one action it points to. Do not cause alarm.`,
  ].join('\n');
}

/** Clara's avatar — same image used across the header and portal bubble (one identity). */
export const CLARA_AVATAR_URL =
  'https://storage.googleapis.com/gemynd-public/projects/acs-therapyhub/clara2.png';
