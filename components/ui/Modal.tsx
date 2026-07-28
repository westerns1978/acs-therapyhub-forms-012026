import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

/**
 * Shared modal shell. Hardened 2026-07-28.
 *
 * Previously it declared `role="dialog"` + `aria-modal="true"` and nothing else:
 *  - Tab moved straight out of the dialog into the page behind it (no focus trap).
 *  - Escape did nothing. The only Escape handling lived in MainLayout and closed a
 *    HARDCODED list of specific modals, so anything rendered through this component
 *    that wasn't on that list could not be dismissed with the keyboard at all.
 *  - The dialog was announced unnamed (the title <h2> carried no id to point
 *    aria-labelledby at).
 *  - The icon-only close button announced as just "button".
 *  - Focus was never moved in, and never restored to the trigger on close.
 *
 * NOTE on `if (!isOpen) return null` (kept): that is NOT an unmount for consumers
 * that stay mounted — MainLayout deliberately conditional-renders CreateClientModal
 * for PHI-retention reasons (see its comment there). This hardening does not change
 * that contract; per-call-site conditional rendering remains the way to guarantee
 * state is dropped.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className = '', maxWidth = 'max-w-2xl' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Escape to close + focus trap. Bound while open only.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Wrap at both ends, and pull focus back in if it has escaped the panel.
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    // Move focus into the dialog so the keyboard starts inside it.
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to whatever opened the dialog.
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up"
        style={{ animationDuration: '0.25s' }}
        onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col border border-white/20 dark:border-slate-700 transform transition-all focus:outline-none ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {(title || onClose) && (
            <header className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
                {title && <h2 id={titleId} className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>}
                <button
                    onClick={onClose}
                    aria-label={title ? `Close ${title}` : 'Close dialog'}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 transition-all"
                >
                    <X size={20} />
                </button>
            </header>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
