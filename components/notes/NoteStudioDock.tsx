import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, NotebookPen } from 'lucide-react';
import SmartNoteImporter from './SmartNoteImporter';

/**
 * NoteStudioDock — a right-docked, NON-BLOCKING host for the Smart Note Studio so a
 * therapist can keep it open beside a Zoom window during a live session and type the
 * note as they go. Unlike the old centered <Modal> host, this does NOT dim or lock the
 * page: the rest of the app stays interactive. The panel is drag-resizable (width is
 * remembered) and can be minimized to a slim edge tab WITHOUT unmounting, so an
 * in-progress note is never lost.
 */

const WIDTH_KEY = 'acs.noteDock.width';
const MIN_W = 340;
const MAX_W = 820;
const DEFAULT_W = 460;

const clampWidth = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w));

interface NoteStudioDockProps {
    isOpen: boolean;
    onClose: () => void;
    clientId?: string;
}

const NoteStudioDock: React.FC<NoteStudioDockProps> = ({ isOpen, onClose, clientId }) => {
    const [width, setWidth] = useState<number>(() => {
        const saved = Number(typeof localStorage !== 'undefined' ? localStorage.getItem(WIDTH_KEY) : '');
        return saved >= MIN_W && saved <= MAX_W ? saved : DEFAULT_W;
    });
    const [minimized, setMinimized] = useState(false);
    const [dirty, setDirty] = useState(false);
    const draggingRef = useRef(false);

    useEffect(() => {
        try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* ignore */ }
    }, [width]);

    // Drag-to-resize from the left edge. Docked right, so width = viewport - cursorX.
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!draggingRef.current) return;
            setWidth(clampWidth(window.innerWidth - e.clientX));
        };
        const onUp = () => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    // A freshly (re)opened dock should be expanded, not stuck in a prior minimized state.
    useEffect(() => { if (isOpen) setMinimized(false); }, [isOpen]);

    if (!isOpen) return null;

    const requestClose = () => {
        if (dirty && !window.confirm('Close the Note Studio? Unsaved note text will be discarded.')) return;
        onClose();
    };

    return (
        <>
            {/* Panel. No full-screen backdrop → the page behind stays fully interactive.
                Kept mounted (via `hidden`) while minimized so the draft survives. */}
            <aside
                style={{ width }}
                className={`fixed top-0 right-0 h-screen max-w-[100vw] z-[60] bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 shadow-2xl ${minimized ? 'hidden' : 'flex'}`}
                role="complementary"
                aria-label="Clinical Smart Note Studio"
            >
                {/* Drag-to-resize handle (left edge). */}
                <div
                    onMouseDown={() => { draggingRef.current = true; document.body.style.userSelect = 'none'; }}
                    className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
                    title="Drag to resize"
                />
                <div className="flex flex-col w-full min-w-0 pl-1.5">
                    <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 bg-gray-50/80 dark:bg-slate-800/40">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 min-w-0">
                            <NotebookPen size={18} className="text-primary flex-shrink-0" />
                            <span className="truncate">Smart Note Studio</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setMinimized(true)} title="Minimize (keeps your note open)" className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 transition-colors"><Minus size={18} /></button>
                            <button onClick={requestClose} title="Close" className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 transition-colors"><X size={18} /></button>
                        </div>
                    </header>
                    <div className="flex-1 min-h-0 p-4">
                        <SmartNoteImporter clientId={clientId} onNoteGenerated={onClose} onDirtyChange={setDirty} />
                    </div>
                </div>
            </aside>

            {/* Minimized: a slim edge tab to restore (the note stays in memory). */}
            {minimized && (
                <button
                    onClick={() => setMinimized(false)}
                    className="fixed top-1/2 right-0 -translate-y-1/2 z-[60] flex flex-col items-center gap-2 bg-primary text-white px-2 py-4 rounded-l-xl shadow-xl hover:px-3 transition-all"
                    title="Reopen Note Studio"
                >
                    <NotebookPen size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">Note{dirty ? ' •' : ''}</span>
                </button>
            )}
        </>
    );
};

export default NoteStudioDock;
