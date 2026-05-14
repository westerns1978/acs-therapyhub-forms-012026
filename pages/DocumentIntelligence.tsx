/**
 * ACS TherapyHub — Document Intelligence Hub
 * Surfaces every clinical document — form submissions, paper uploads, and
 * AI-processed scans — across all clients. Gemini Vision OCR + Deep
 * Reasoning DNA layered on top.
 */

import React, { useState, useEffect } from "react";
import OcrFormUploader from "../components/OcrFormUploader";
import ScannerPickerModal from "../components/ScannerPickerModal";
import MobileDocumentUpload from "../components/portal/MobileDocumentUpload";
import DocumentViewerModal from "../components/documents/DocumentViewerModal";
import Card from "../components/ui/Card";
import { extractDocumentDNADeep, type DocumentDNA } from "../services/deepReasoningService";
import { type OcrExtractionResult } from "../services/ocrService";
import {
  ArrowLeft, AlertTriangle, Camera, Upload, FileText, FileImage,
  Sparkles, CheckCircle2, ArrowUpRight, ClipboardList, FileUp, Eye,
} from "lucide-react";

type SupportedMime = "image/jpeg" | "image/png" | "image/webp";

type ScanFlow =
  | { stage: "closed" }
  | { stage: "picker" }
  | { stage: "upload"; initialImage?: { base64: string; mimeType: SupportedMime } };

type DocSource = "Form" | "Upload" | "AI-Processed";

interface MergedDoc {
  id: string;
  client_id?: string;
  client_name?: string;
  document_label: string;
  document_type: string;
  source: DocSource;
  date: string;
  url?: string;
  status?: string;
  // OCR/DNA fields (only present for uploaded_files)
  ocr_form_type?: string;
  ocr_completion_score?: number;
  needs_review?: boolean;
  clinical_significance?: string;
  dna_confidence?: number;
  _kind: "form_submission" | "uploaded_file";
  _raw: any;
}

interface DocumentIntelligenceProps {
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>;
  clientId?: string;
}

type ActiveView = "hub" | "ocr_upload" | "doc_detail";

const SIG_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  critical:      { label: "Critical", dot: "bg-red-500 animate-pulse", text: "text-red-700" },
  high:          { label: "High",     dot: "bg-red-400",               text: "text-red-700" },
  medium:        { label: "Medium",   dot: "bg-amber-500",             text: "text-amber-700" },
  low:           { label: "Low",      dot: "bg-emerald-500",           text: "text-emerald-700" },
  informational: { label: "Info",     dot: "bg-slate-400",             text: "text-slate-500" },
};

const SOURCE_META: Record<DocSource, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  "Form":         { label: "Form",         icon: ClipboardList, bg: "bg-blue-50 border-blue-200",       text: "text-blue-700" },
  "Upload":       { label: "Upload",       icon: FileUp,        bg: "bg-slate-50 border-slate-200",     text: "text-slate-700" },
  "AI-Processed": { label: "AI-Processed", icon: Sparkles,      bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
};

const StatTile: React.FC<{ label: string; value: number | string; tone?: "default" | "warning" | "success" | "danger" }> = ({ label, value, tone = "default" }) => {
  const toneClass =
    tone === "warning" ? "text-amber-600" :
    tone === "success" ? "text-emerald-600" :
    tone === "danger" ? "text-red-600" :
    "text-slate-900 dark:text-white";
  return (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl transition-all hover:scale-[1.02]">
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
      <h4 className={`text-3xl font-black mt-2 tracking-tighter ${toneClass}`}>{value}</h4>
    </div>
  );
};

export default function DocumentIntelligenceHub({ supabase, clientId }: DocumentIntelligenceProps) {
  const [docs, setDocs] = useState<MergedDoc[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientFilter, setClientFilter] = useState<string>(clientId || "all");
  const [activeView, setActiveView] = useState<ActiveView>("hub");
  const [selectedDoc, setSelectedDoc] = useState<MergedDoc | null>(null);
  const [selectedDNA, setSelectedDNA] = useState<DocumentDNA | null>(null);
  const [isLoadingDNA, setIsLoadingDNA] = useState(false);
  const [filterReview, setFilterReview] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [scanFlow, setScanFlow] = useState<ScanFlow>({ stage: "closed" });
  const [viewerDoc, setViewerDoc] = useState<MergedDoc | null>(null);

  useEffect(() => { loadAllDocs(); }, []);

  async function loadAllDocs() {
    setIsLoadingDocs(true);
    try {
      const [formsRes, uploadsRes, clientsRes] = await Promise.all([
        (supabase as any).from("form_submissions").select("*").order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("uploaded_files").select("*").order("uploaded_at", { ascending: false }).limit(200),
        (supabase as any).from("clients").select("id, name"),
      ]);

      const clientList = (clientsRes.data || []) as { id: string; name: string }[];
      const clientMap = new Map(clientList.map(c => [c.id, c.name]));
      setClients(clientList);

      const formDocs: MergedDoc[] = (formsRes.data || []).map((fs: any) => ({
        id: `form_${fs.id}`,
        client_id: fs.client_id,
        client_name: clientMap.get(fs.client_id),
        document_label: fs.form_name || "Untitled Form",
        document_type: fs.form_type || "Form",
        source: fs.data?.is_paper_upload ? "Upload" : "Form",
        date: fs.submitted_at || fs.created_at,
        url: fs.data?.file_url,
        status: fs.status,
        _kind: "form_submission",
        _raw: fs,
      }));

      const uploadDocs: MergedDoc[] = (uploadsRes.data || []).map((uf: any) => ({
        id: `upload_${uf.id}`,
        client_id: uf.hire_id || uf.metadata?.clientId,
        client_name: uf.hire_id ? clientMap.get(uf.hire_id) : undefined,
        document_label: uf.file_name || "Untitled Document",
        document_type: uf.ocr_form_type || uf.document_type || uf.file_type || "Document",
        source: "AI-Processed",
        date: uf.uploaded_at,
        url: uf.public_url,
        status: uf.document_status,
        ocr_form_type: uf.ocr_form_type,
        ocr_completion_score: uf.ocr_completion_score,
        needs_review: uf.needs_review,
        clinical_significance: uf.clinical_significance,
        dna_confidence: uf.dna_confidence,
        _kind: "uploaded_file",
        _raw: uf,
      }));

      const merged = [...formDocs, ...uploadDocs].sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        return tb - ta;
      });

      setDocs(merged);
    } catch (e) {
      console.warn("[DocumentIntelligence] loadAllDocs failed:", e);
    } finally {
      setIsLoadingDocs(false);
    }
  }

  async function handleOcrComplete(_result: OcrExtractionResult) {
    await loadAllDocs();
    setActiveView("hub");
  }

  async function handleDocSelect(doc: MergedDoc) {
    setSelectedDoc(doc);
    setSelectedDNA(null);
    setActiveView("doc_detail");

    if (doc._kind === "uploaded_file" && !doc.clinical_significance) {
      setIsLoadingDNA(true);
      try {
        const { data } = await (supabase as any)
          .from("uploaded_files")
          .select("document_dna, ocr_extracted_json")
          .eq("id", doc._raw.id)
          .single();

        const textContent = (data && data.document_dna && data.document_dna.summary)
          || JSON.stringify((data && data.ocr_extracted_json) || {});

        if (textContent && textContent !== "{}") {
          const dna = await extractDocumentDNADeep(textContent);
          setSelectedDNA(dna);
        }
      } catch (e) {
        console.error("DNA generation failed", e);
      } finally {
        setIsLoadingDNA(false);
      }
    }
  }

  // Filter: client → review → display
  const clientFiltered = clientFilter === "all"
    ? docs
    : docs.filter(d => d.client_id === clientFilter);

  const reviewCount = clientFiltered.filter(d => d.needs_review).length;
  const displayDocs = filterReview ? clientFiltered.filter(d => d.needs_review) : clientFiltered;

  // ── OCR Upload View ──────────────────────────────────────────────────────────
  if (activeView === "ocr_upload") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
        <button
          onClick={() => setActiveView("hub")}
          className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-bold transition-colors"
        >
          <ArrowLeft size={16} /> Back to Document Hub
        </button>
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Handwritten Form Scanner</h2>
          <p className="text-slate-500 text-sm mt-1">Gemini Vision extracts all fields — no manual transcription.</p>
        </div>
        <Card>
          <OcrFormUploader onFormProcessed={handleOcrComplete} />
        </Card>
      </div>
    );
  }

  // ── Doc Detail View ──────────────────────────────────────────────────────────
  if (activeView === "doc_detail" && selectedDoc) {
    const sig = SIG_CONFIG[selectedDoc.clinical_significance || "informational"];
    const sourceMeta = SOURCE_META[selectedDoc.source];

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
        <button
          onClick={() => { setActiveView("hub"); setSelectedDoc(null); setSelectedDNA(null); }}
          className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-bold transition-colors"
        >
          <ArrowLeft size={16} /> Back to Document Hub
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card title="Document">
              <h3 className="text-slate-900 dark:text-white font-black text-sm leading-snug mb-4">
                {selectedDoc.document_label}
              </h3>
              <div className="space-y-3 text-xs">
                {selectedDoc.client_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Client</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedDoc.client_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Source</span>
                  <span className={`inline-flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full text-[10px] border ${sourceMeta.bg} ${sourceMeta.text}`}>
                    {sourceMeta.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Type</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedDoc.document_type}</span>
                </div>
                {selectedDoc.status && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Status</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedDoc.status}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Date</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedDoc.date ? new Date(selectedDoc.date).toLocaleDateString() : "—"}</span>
                </div>
                {selectedDoc.ocr_completion_score != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">OCR Completion</span>
                    <span className={`font-black ${selectedDoc.ocr_completion_score >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                      {selectedDoc.ocr_completion_score}%
                    </span>
                  </div>
                )}
                {selectedDoc.dna_confidence != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">AI Confidence</span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold">{selectedDoc.dna_confidence}%</span>
                  </div>
                )}
                {selectedDoc.clinical_significance && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Significance</span>
                    <span className={`flex items-center gap-1.5 font-bold ${sig.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sig.dot}`} />
                      {sig.label}
                    </span>
                  </div>
                )}
              </div>

              {selectedDoc.url && (
                <a
                  href={selectedDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-xs font-black text-primary hover:underline"
                >
                  Open original <ArrowUpRight size={14} />
                </a>
              )}
            </Card>

            {selectedDoc.needs_review && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">Flagged for human review — some fields may need verification.</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card title={selectedDoc._kind === "uploaded_file" ? "AI Clinical Analysis" : "Submission Details"} subtitle={selectedDoc._kind === "uploaded_file" ? "Document DNA from Gemini deep reasoning" : "Form data and metadata"}>
              {selectedDoc._kind === "uploaded_file" ? (
                isLoadingDNA ? (
                  <div className="space-y-3 animate-pulse">
                    {[80, 60, 90, 50, 70].map((w, i) => (
                      <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : selectedDNA ? (
                  <div className="space-y-5">
                    <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{selectedDNA.summary}</p>

                    {selectedDNA.riskFlags.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Risk Flags</p>
                        {selectedDNA.riskFlags.map((flag, i) => (
                          <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
                            <span className={
                              flag.severity === "urgent" ? "text-red-600" :
                              flag.severity === "warning" ? "text-amber-600" : "text-slate-400"
                            }>
                              {flag.severity === "urgent" ? "⚡" : flag.severity === "warning" ? "⚠" : "ℹ"}
                            </span>
                            <span className="text-slate-700 dark:text-slate-200">{flag.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDNA.actionItems.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action Items</p>
                        {selectedDNA.actionItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
                            <span className="text-primary font-black">→</span>
                            <span className="text-slate-700 dark:text-slate-200">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedDNA.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {selectedDNA.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-300 font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-10">
                    <Sparkles size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">No AI analysis available yet.</p>
                    <button
                      onClick={() => handleDocSelect(selectedDoc)}
                      className="mt-3 text-primary hover:underline text-xs font-bold"
                    >
                      Generate now
                    </button>
                  </div>
                )
              ) : (
                <SubmissionPreview submission={selectedDoc._raw} />
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Hub View ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ACS Clinical Intelligence</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <CheckCircle2 size={10} /> Gemini Vision Active
            </span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">Document Intelligence</h1>
          <p className="text-slate-500 text-sm mt-2">
            Every clinical document, every client — forms, paper uploads, and AI-processed scans in one view.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setScanFlow({ stage: "picker" })}
            className="flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-focus text-white text-sm font-black rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Camera size={16} /> Scan Handwritten Form
          </button>
          <button
            onClick={() => setScanFlow({ stage: "upload" })}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary text-slate-700 dark:text-slate-200 text-sm font-black rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <Upload size={16} /> Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatTile label="Total Documents" value={clientFiltered.length} />
        <StatTile label="Form Submissions" value={clientFiltered.filter(d => d.source === "Form").length} />
        <StatTile label="AI Processed" value={clientFiltered.filter(d => d.source === "AI-Processed").length} tone="success" />
        <StatTile label="Needs Review" value={reviewCount} tone={reviewCount > 0 ? "warning" : "success"} />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterReview(false)}
            className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-all ${!filterReview ? "bg-primary text-white shadow-sm" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700"}`}
          >
            All Documents
          </button>
          <button
            onClick={() => setFilterReview(true)}
            className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-all ${filterReview ? "bg-amber-500 text-white shadow-sm" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700"}`}
          >
            Needs Review{reviewCount > 0 ? ` (${reviewCount})` : ""}
          </button>
        </div>
      </div>

      {isLoadingDocs ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayDocs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
              <FileText size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-black">No documents in view</p>
            <p className="text-slate-500 text-sm mt-1">
              {clientFilter === "all" ? "Upload a document or scan a handwritten form to get started." : "No documents on file for this client yet."}
            </p>
            <button
              onClick={() => setScanFlow({ stage: "upload" })}
              className="mt-6 px-5 py-3 bg-primary text-white text-sm font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Upload First Document
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayDocs.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              onOpen={() => handleDocSelect(doc)}
              onView={() => setViewerDoc(doc)}
            />
          ))}
        </div>
      )}

      <DocumentViewerModal
        isOpen={!!viewerDoc}
        url={viewerDoc?.url}
        filename={viewerDoc?.document_label || "Document"}
        mimeType={viewerDoc?._raw?.file_type || viewerDoc?._raw?.mimeType}
        onClose={() => setViewerDoc(null)}
      />

      <ScannerPickerModal
        isOpen={scanFlow.stage === "picker"}
        onClose={() => setScanFlow({ stage: "closed" })}
        onScanComplete={(base64, mimeType) =>
          setScanFlow({
            stage: "upload",
            initialImage: { base64, mimeType: mimeType as SupportedMime },
          })
        }
        onCameraFallback={() => setScanFlow({ stage: "upload" })}
      />

      {scanFlow.stage === "upload" && (
        <MobileDocumentUpload
          clientId="hub_unassigned"
          initialImage={scanFlow.initialImage}
          onComplete={() => {
            loadAllDocs();
            setScanFlow({ stage: "closed" });
          }}
          onClose={() => setScanFlow({ stage: "closed" })}
        />
      )}
    </div>
  );
}

function DocRow({ doc, onOpen, onView }: { doc: MergedDoc; onOpen: () => void; onView: () => void }) {
  const sig = SIG_CONFIG[doc.clinical_significance || "informational"];
  const sourceMeta = SOURCE_META[doc.source];
  const SourceIcon = sourceMeta.icon;
  const FileIcon = doc._kind === "uploaded_file"
    ? (doc._raw.file_type?.includes("pdf") ? FileText : doc._raw.file_type?.includes("image") ? FileImage : FileText)
    : ClipboardList;
  const canView = !!doc.url;

  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-primary/30 rounded-2xl cursor-pointer transition-all group shadow-sm hover:shadow-md"
    >
      <div className="w-11 h-11 bg-primary/10 text-primary rounded-2xl flex items-center justify-center flex-shrink-0">
        <FileIcon size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-slate-900 dark:text-white text-sm font-black truncate">{doc.document_label}</div>
          <span className={`hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${sourceMeta.bg} ${sourceMeta.text}`}>
            <SourceIcon size={10} /> {sourceMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
          {doc.client_name && <span className="font-black text-slate-700 dark:text-slate-300">{doc.client_name}</span>}
          <span className="font-bold">{doc.document_type}</span>
          {doc.ocr_completion_score != null && (
            <span className={`font-black ${doc.ocr_completion_score >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
              {doc.ocr_completion_score}% OCR
            </span>
          )}
          {doc.date && <span>{new Date(doc.date).toLocaleDateString()}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {doc.needs_review && (
          <span className="text-[10px] px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-black uppercase tracking-widest">
            Review
          </span>
        )}
        {doc.clinical_significance && (
          <span className={`flex items-center gap-1.5 text-[11px] font-bold ${sig.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sig.dot}`} />
            {sig.label}
          </span>
        )}
        {canView && (
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded-full transition-all"
            title="View document"
          >
            <Eye size={12} /> View
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"
          title="Open detail"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SubmissionPreview({ submission }: { submission: any }) {
  const data = submission?.data || {};
  const entries = Object.entries(data).filter(([k, v]) =>
    typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );

  if (entries.length === 0) {
    return (
      <div className="text-slate-500 text-sm text-center py-10">
        <ClipboardList size={24} className="mx-auto mb-2 text-slate-300" />
        <p className="font-bold">No structured data captured for this submission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {entries.slice(0, 20).map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest col-span-1">{k.replace(/_/g, " ")}</div>
          <div className="text-slate-700 dark:text-slate-200 col-span-2 break-words">{String(v)}</div>
        </div>
      ))}
      {entries.length > 20 && (
        <p className="text-[10px] text-slate-400 italic pt-2">… {entries.length - 20} more fields</p>
      )}
    </div>
  );
}
