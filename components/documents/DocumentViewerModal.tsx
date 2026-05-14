/**
 * Lightweight image/PDF viewer modal for the staff AI Documents view.
 * Handles PNG, JPG, WEBP, PDF (single and multi-page via iframe).
 * Close button, click-outside-to-close, ESC to close.
 */

import React, { useEffect } from "react";
import { X, ExternalLink, Download, FileQuestion } from "lucide-react";

interface DocumentViewerModalProps {
  isOpen: boolean;
  url: string | undefined;
  filename: string;
  mimeType?: string;
  onClose: () => void;
}

const inferMimeType = (filename: string, mimeType?: string): string => {
  if (mimeType) return mimeType;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
};

const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen, url, filename, mimeType, onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedMime = inferMimeType(filename, mimeType);
  const isPdf = resolvedMime === "application/pdf";
  const isImage = resolvedMime.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition-colors shadow-sm"
          title="Close (Esc)"
          aria-label="Close viewer"
        >
          <X size={20} />
        </button>
        <header className="flex items-center justify-between gap-3 pl-6 pr-16 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white truncate" title={filename}>{filename}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{resolvedMime}</p>
          </div>
          <div className="flex items-center gap-1">
            {url && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={18} />
                </a>
                <a
                  href={url}
                  download={filename}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  title="Download"
                >
                  <Download size={18} />
                </a>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
          {!url ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <FileQuestion size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-700 dark:text-slate-200 font-black">No file URL on record</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">This document doesn't have an accessible file — only structured form data was captured.</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={`${url}#toolbar=1&navpanes=0&view=FitH`}
              title={filename}
              className="w-full h-full border-0 bg-white"
            />
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={url}
                alt={filename}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <FileQuestion size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-700 dark:text-slate-200 font-black">Preview not available</p>
              <p className="text-slate-500 text-sm mt-1">This file type ({resolvedMime}) can't be previewed in-browser.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:scale-105 transition-all"
              >
                <ExternalLink size={14} /> Open externally
              </a>
            </div>
          )}
        </div>
        <footer className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DocumentViewerModal;
