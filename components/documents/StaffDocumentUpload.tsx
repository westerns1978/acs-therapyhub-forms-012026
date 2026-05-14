/**
 * Multi-format upload modal for staff side. Takes images, PDFs, .docx,
 * .xlsx. Validates size, runs Gemini extraction, writes to Supabase
 * Storage + uploaded_files. Warm phase indicators throughout.
 *
 * If presetClientId is provided (i.e. opened from a client's detail
 * page), skips the picker.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { extractFromFile, fileSizeError, isSupportedFile, ACCEPT_ATTRIBUTE } from "../../services/documentExtraction";

interface Client {
  id: string;
  name: string;
}

interface StaffDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  presetClientId?: string;
  presetClientName?: string;
}

type Phase =
  | "pick_client"
  | "pick_file"
  | "uploading"
  | "extracting"
  | "saving"
  | "done"
  | "error";

const STORAGE_BUCKET = "client-documents";
const DEFAULT_ORG_ID = "71077b47-66e8-4fd9-90e7-709773ea6582";

const StaffDocumentUpload: React.FC<StaffDocumentUploadProps> = ({
  isOpen, onClose, onComplete, presetClientId, presetClientName,
}) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(presetClientId || "");
  const [selectedClientName, setSelectedClientName] = useState<string>(presetClientName || "");
  const [phase, setPhase] = useState<Phase>(presetClientId ? "pick_file" : "pick_client");
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const effectiveClientName = selectedClientName || selectedClient?.name || "their";

  // Reset state when opened
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveFile(null);
    setSelectedClientId(presetClientId || "");
    setSelectedClientName(presetClientName || "");
    setPhase(presetClientId ? "pick_file" : "pick_client");
  }, [isOpen, presetClientId, presetClientName]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !["uploading", "extracting", "saving"].includes(phase)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, phase]);

  // Load client list once when opening without a preset
  useEffect(() => {
    if (!isOpen || presetClientId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("clients")
        .select("id, name")
        .order("name");
      setClients((data || []) as Client[]);
    })();
  }, [isOpen, presetClientId]);

  const handleClientPicked = () => {
    if (!selectedClientId) return;
    setSelectedClientName(selectedClient?.name || "");
    setPhase("pick_file");
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const handleFile = async (file: File) => {
    setError(null);
    const sizeErr = fileSizeError(file);
    if (sizeErr) { setError(sizeErr); return; }
    if (!isSupportedFile(file)) {
      setError("That file type isn't supported here. Try a PDF, image, Word, or Excel file.");
      return;
    }
    setActiveFile(file);

    const clientId = presetClientId || selectedClientId;
    if (!clientId) { setError("Pick a client first."); setPhase("pick_client"); return; }

    try {
      // 1. Upload to Storage
      setPhase("uploading");
      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${clientId}/${Date.now()}_${safeName}`;
      const { error: storageErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { upsert: false });
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // 2. Run Gemini extraction
      setPhase("extracting");
      const extraction = await extractFromFile(file);

      // 3. Save row in uploaded_files
      setPhase("saving");
      const insertPayload: Record<string, unknown> = {
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || guessMimeFromName(file.name),
        file_size: file.size,
        public_url: publicUrl,
        bucket_id: STORAGE_BUCKET,
        org_id: DEFAULT_ORG_ID,
        hire_id: clientId,
        uploaded_by: user?.name || "Staff",
        document_type: extraction.documentType,
        document_status: extraction.ok ? "extracted" : "saved_no_extract",
        extracted_text: extraction.extractedText,
        extracted_summary: extraction.summary,
        ocr_extracted_json: { fields: extraction.fields },
        ocr_processed_at: extraction.ok ? new Date().toISOString() : null,
        needs_review: !extraction.ok,
        metadata: {
          clientId,
          clientName: effectiveClientName,
          uploadedFrom: presetClientId ? "client-detail" : "ai-documents",
        },
      };

      const { error: dbErr } = await (supabase as any)
        .from("uploaded_files")
        .insert(insertPayload);
      if (dbErr) throw new Error(`Save failed: ${dbErr.message}`);

      // 4. Done
      setPhase("done");
      setTimeout(() => {
        onComplete();
        onClose();
      }, 2200);
    } catch (e: any) {
      console.error("[StaffDocumentUpload] failed:", e);
      setError(e?.message || "Something went wrong while saving the document.");
      setPhase("error");
    }
  };

  if (!isOpen) return null;

  const phaseLabel = (() => {
    switch (phase) {
      case "uploading":  return "Uploading file…";
      case "extracting": return "Reading the document…";
      case "saving":     return `Saving to ${effectiveClientName}'s folder…`;
      case "done":       return `Done. Saved to ${effectiveClientName}'s folder.`;
      default:           return "";
    }
  })();

  const isWorking = phase === "uploading" || phase === "extracting" || phase === "saving";

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !isWorking && onClose()}
    >
      <div
        className="w-full max-w-lg bg-stone-50 dark:bg-slate-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Upload a document</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {presetClientId
                ? `Goes to ${presetClientName || "this client"}'s folder.`
                : "Pick the client this document belongs to."}
            </p>
          </div>
          {!isWorking && (
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div className="p-6 min-h-[16rem]">
          {phase === "pick_client" && (
            <div className="space-y-5">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="mt-2 w-full bg-white dark:bg-slate-800 border border-stone-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Select a client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleClientPicked}
                disabled={!selectedClientId}
                className="w-full px-5 py-3 bg-primary text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-focus transition-all"
              >
                Choose a file for {selectedClient?.name || "this client"}
              </button>
            </div>
          )}

          {phase === "pick_file" && (
            <div className="space-y-5 text-center">
              <div className="w-20 h-20 mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-3xl flex items-center justify-center">
                <FileText size={32} className="text-amber-700" />
              </div>
              <div>
                <p className="text-base font-black text-slate-900 dark:text-white">
                  Pick a file from your computer
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, image, Word, or Excel — up to 10 MB
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-focus transition-all"
              >
                <Upload size={16} /> Choose a file
              </button>
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-left flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {isWorking && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-3xl flex items-center justify-center">
                <Loader2 size={28} className="text-amber-700 animate-spin" />
              </div>
              <p className="text-base font-black text-slate-900 dark:text-white">{phaseLabel}</p>
              {activeFile && (
                <p className="text-xs text-slate-500 truncate max-w-xs">{activeFile.name}</p>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-700" />
              </div>
              <p className="text-base font-black text-slate-900 dark:text-white">{phaseLabel}</p>
              {activeFile && (
                <p className="text-xs text-slate-500 truncate max-w-xs">{activeFile.name}</p>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-3xl flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-700" />
              </div>
              <div>
                <p className="text-base font-black text-slate-900 dark:text-white">That didn't go through</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">{error}</p>
              </div>
              <button
                onClick={() => { setPhase("pick_file"); setError(null); setActiveFile(null); }}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black rounded-xl transition-colors"
              >
                Try another file
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow same-file reselect
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>
    </div>
  );
};

function guessMimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

export default StaffDocumentUpload;
