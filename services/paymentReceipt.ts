/**
 * ACS TherapyHub — Payment Receipt (client-side, jsPDF).
 *
 * A deterministic, hand-to-client proof of a SINGLE recorded payment — NOT an
 * account statement. There is deliberately no running balance, so the receipt is
 * a pure function of its inputs and a reprint is byte-identical (stable forever).
 *
 * Reuses the certificate's jsPDF kit (letterhead, footer, watermark, brand
 * palette + letter geometry) from pdfDocuments.ts — the SAME plumbing, a separate
 * layout. No AI, no server. Demo/sample payments carry the identical SAMPLE
 * watermark as demo certificates so a generated receipt can never be mistaken for
 * a real one.
 */
import { jsPDF } from 'jspdf';
import {
  MAROON,
  SLATE,
  GREY,
  MARGIN,
  PAGE_W,
  CONTENT_W,
  fmtDate,
  letterhead,
  footer,
  sampleWatermark,
} from './pdfDocuments';

export interface ReceiptPayment {
  id: string;
  amount: number;
  payment_method?: string | null;
  payment_date?: string | null;
  external_payment_id?: string | null;
  description?: string | null;
  charge_id?: string | null;
}

export interface ReceiptCharge {
  charge_type?: string | null;
  satop_level?: string | null;
  description?: string | null;
  is_pass_through?: boolean | null;
}

export interface ReceiptInput {
  payment: ReceiptPayment;
  /** The charge this payment was applied to, if any (resolved by charge_id). */
  charge?: ReceiptCharge | null;
  clientName: string;
  /** Demo/sample record → SAMPLE watermark (mirrors the certificate). */
  isDemo?: boolean;
}

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  money_order: 'Money Order',
  stripe: 'Card (Stripe)',
  insurance: 'Insurance',
};
const prettyMethod = (m?: string | null) =>
  METHOD_LABELS[(m || '').toLowerCase()] ||
  (m || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
  '—';

const humanizeType = (t?: string | null) =>
  (t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Account payment';

// Only check / money order carry a meaningful client-visible reference (the
// instrument number). A Stripe pi_* id is internal, so it is never printed here.
const showsReference = (method?: string | null) => {
  const m = (method || '').toLowerCase();
  return m === 'check' || m === 'money_order';
};

/** Stable receipt number from the payment id — same id → same number every reprint. */
export function receiptNumber(paymentId: string): string {
  const short = String(paymentId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
  return `RCPT-${short || 'PAYMENT'}`;
}

const safeSeg = (s: string) =>
  String(s || 'client').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'client';

export function receiptFileName(clientName: string, payment: ReceiptPayment): string {
  return `Payment_Receipt_${safeSeg(clientName)}_${receiptNumber(payment.id)}.pdf`;
}

/** "Applied to" description: charge label + SATOP level; flags state pass-through. */
function appliedTo(
  charge?: ReceiptCharge | null,
  payment?: ReceiptPayment,
): { label: string; passThrough: boolean } {
  if (charge) {
    let label = (charge.description && charge.description.trim()) || humanizeType(charge.charge_type);
    if (charge.satop_level && !/satop/i.test(label)) label += ` — SATOP Level ${charge.satop_level}`;
    return { label, passThrough: charge.is_pass_through === true };
  }
  // No linked charge — fall back to the payment's own note.
  const fallback = (payment?.description && payment.description.trim()) || 'Account payment';
  return { label: fallback, passThrough: false };
}

/**
 * Builds the receipt jsPDF. Returns the instance (NOT a blob) so the caller can
 * preview the exact same document it later saves — zero drift, the same contract
 * as the certificate builder.
 */
export function buildPaymentReceiptDoc(input: ReceiptInput): jsPDF {
  const { payment, charge, clientName, isDemo } = input;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  // Branded clinic header (shared with the certificate / status report).
  let y = letterhead(doc);

  // Title (left) + receipt meta (right) on the same band.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...MAROON);
  doc.text('Payment Receipt', MARGIN, y);

  const metaX = PAGE_W - MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE);
  doc.text(`Receipt No.  ${receiptNumber(payment.id)}`, metaX, y - 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(`Date  ${fmtDate(payment.payment_date)}`, metaX, y + 8, { align: 'right' });

  if (isDemo) {
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...MAROON);
    doc.text('DEMONSTRATION SAMPLE — NOT A VALID RECEIPT', MARGIN, y);
  }

  y += 14;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 26;

  // Received from.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text('RECEIVED FROM', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(clientName || '—', MARGIN, y + 16);
  y += 40;

  // Amount paid — the prominent element. Light maroon panel + big figure.
  const boxH = 62;
  doc.setFillColor(248, 240, 241);
  doc.rect(MARGIN, y, CONTENT_W, boxH, 'F');
  doc.setFillColor(...MAROON);
  doc.rect(MARGIN, y, 5, boxH, 'F'); // left accent
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text('AMOUNT PAID', MARGIN + 18, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...MAROON);
  doc.text(money(payment.amount), MARGIN + 18, y + 48);
  y += boxH + 30;

  // Detail rows.
  const row = (label: string, value: string): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(label.toUpperCase(), MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value, CONTENT_W - 150);
    doc.text(lines, MARGIN + 150, y);
    y += 16 + (lines.length - 1) * 13;
  };

  row('Payment method', prettyMethod(payment.payment_method));

  // Reference — check / money order only (the instrument number).
  if (showsReference(payment.payment_method) && payment.external_payment_id) {
    const isCheck = (payment.payment_method || '').toLowerCase() === 'check';
    row(isCheck ? 'Check #' : 'Money order #', payment.external_payment_id);
  }

  const applied = appliedTo(charge, payment);
  row('Applied to', applied.label);
  if (applied.passThrough) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    const note = doc.splitTextToSize(
      'State pass-through fee — collected on behalf of the State of Missouri. This is not an ACS service fee.',
      CONTENT_W - 150,
    );
    doc.text(note, MARGIN + 150, y);
    y += note.length * 11 + 6;
  }

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...MAROON);
  doc.text('Payment received — thank you.', MARGIN, y);

  // Footer provenance — intentionally NO generation timestamp, so a reprint of the
  // same payment is byte-identical (this is a record of one payment, not a live
  // statement). The payment date above is the authoritative date.
  footer(
    doc,
    `${isDemo ? 'DEMONSTRATION SAMPLE — sample data, not a valid receipt. ' : ''}This receipt confirms a single payment recorded in ACS TherapyHub for the amount shown. It is not an account statement and does not reflect any remaining balance. Assessment & Counseling Solutions.`,
  );

  // Stamp the SAMPLE watermark last so it overlays the whole receipt.
  if (isDemo) sampleWatermark(doc);

  return doc;
}
