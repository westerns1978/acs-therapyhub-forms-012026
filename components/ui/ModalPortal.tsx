import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * The one place a dialog overlay gets mounted. Wrap any `fixed inset-0` overlay
 * in this and it is centered in the VIEWPORT, always, on every page.
 *
 * WHY THIS EXISTS (2026-08-07)
 * ----------------------------
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block. A `transform` (also filter / backdrop-filter / will-change /
 * contain: paint) on ANY ancestor makes that ancestor the containing block
 * instead, and `inset-0` then resolves to the ancestor's border box.
 *
 * This app has exactly that, in two stacked layers:
 *   1. layouts/MainLayout.tsx — `<main class="… motion-safe:animate-fade-in-up">`
 *   2. most page roots — e.g. pages/ClientWorkspace.tsx `<div class="animate-fade-in-up">`
 * and the keyframe is declared `forwards` (index.html), so the final
 * `translateY(0)` transform is NOT cleaned up when the animation ends — it
 * persists on the element for the life of the page.
 *
 * Consequence for a dialog rendered inside a page: "centered" means centered in
 * the PAGE's box, not the window. On a short page that is close enough to look
 * right, which is why this survived. On a tall page — the client Overview tab
 * with Packet Readiness — the page box is thousands of pixels tall, so the
 * dialog centers thousands of pixels down the document while the backdrop
 * stretches over the whole (tall) page. The user sees a dark screen with the
 * dialog nowhere in the viewport, and because opening it also locks body scroll
 * there is no way to scroll down to its buttons. The dialog is unreachable.
 *
 * Portaling to <body> removes every transformed ancestor from the chain, so
 * `fixed` means fixed again. This is immune to any future animation added to
 * any layout or page — which is the reason to fix it here and not by deleting
 * one `animate-fade-in-up` class.
 *
 * Prior art in this repo: RecordPaymentModal, ScheduleSessionModal,
 * DocumentPreviewModal, CompleteClientModal and SubmissionViewer each grew their
 * own private `createPortal(...)` after hitting this bug individually. This
 * component is that fix, extracted once. CreateClientModal / EditClientModal /
 * CustomizeTreatmentPlanModal are rendered from MainLayout OUTSIDE `<main>`, so
 * they never had a transformed ancestor and correctly note they need no portal;
 * they are left alone.
 *
 * SCROLL LOCK
 * -----------
 * Owned here and REF-COUNTED. Several call sites used to each set
 * `document.body.style.overflow` directly; with two dialogs open (scanner →
 * review, upload → category) the inner one's cleanup released the lock while the
 * outer was still open, and the page scrolled behind the backdrop. The counter
 * means the lock lifts only when the last dialog closes, and the original
 * inline value is restored rather than blanked.
 */

let lockCount = 0;
let restoreOverflow: string | null = null;

const acquireScrollLock = () => {
  if (lockCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
};

const releaseScrollLock = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = restoreOverflow ?? '';
    restoreOverflow = null;
  }
};

interface ModalPortalProps {
  children: React.ReactNode;
  /** Set false to portal without taking the body scroll lock (non-blocking overlays). */
  lockScroll?: boolean;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ children, lockScroll = true }) => {
  useEffect(() => {
    if (!lockScroll) return;
    acquireScrollLock();
    return releaseScrollLock;
  }, [lockScroll]);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

export default ModalPortal;
