/**
 * ACS TherapyHub — Enhanced Document Intelligence Hub
 * Replaces Vision API (broken) with Gemini Vision OCR + Deep Reasoning DNA
 * DROP-IN: Replace pages/DocumentIntelligence.tsx (or equivalent page component)
 */

import React, { useState, useEffect } from "react";
import OcrFormUploader from "../components/OcrFormUploader";
import ClinicalMarkdown from "../components/ClinicalMarkdown";
import { extractDocumentDNADeep, type DocumentDNA } from "../services/deepReasoningService";
import { type OcrExtractionResult } from "../services/ocrService";

interface UploadedDoc {
  id: string;
  file_name: string;
  file_type: string;
  document_type?: string;
  document_status: string;
  ocr_form_type?: string;
  ocr_completion_score?: number;
  needs_review?: boolean;
  clinical_significance?: string;
  dna_confidence?: number;
  uploaded_at: string;
  summary?: string;
}

interface DocumentIntelligenceProps {
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>;
  clientId?: string; // Optional: scope to specific client
}

type ActiveView = "hub" | "ocr_upload" | "doc_detail";

// ─── Significance Config ──────────────────────────────────────────────────────

const SIG_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  critical:      { label: "Critical",      dot: "bg-red-500 animate-pulse", text: "text-red-400" },
  high:          { label: "High",          dot: "bg-red-400",               text: "text-red-400" },
  medium:        { label: "Medium",        dot: "bg-yellow-400",            text: "text-yellow-400" },
  low:           { label: "Low",           dot: "bg-green-500",             text: "text-green-400" },
  informational: { label: "Info",          dot: "bg-gray-500",              text: "text-gray-400" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentIntelligenceHub({ supabase, clientId }: DocumentIntelligenceProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("hub");
  const [selectedDoc, setSelectedDoc] = useState<UploadedDoc | null>(null);
  const [selectedDNA, setSelectedDNA] = useState<DocumentDNA | null>(null);
  const [isLoadingDNA, setIsLoadingDNA] = useState(false);
  const [filterReview, setFilterReview] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  useEffect(() => { loadDocs(); }, [clientId]);

  async function loadDocs() {
    setIsLoadingDocs(true);
    let query = supabase
      .from("uploaded_files")
      .select("id, file_name, file_type, document_type, document_status, ocr_form_type, ocr_completion_score, needs_review, clinical_significance, dna_confidence, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(50);

    if (clientId) query = query.eq("hire_id", clientId);

    const { data } = await query;
    setDocs(data || []);
    setIsLoadingDocs(false);
  }

  async function handleOcrComplete(result: OcrExtractionResult) {
    // After OCR, run deep DNA reasoning on extracted text
    const flatText = Object.entries(result.rawJson)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    await loadDocs(); // Refresh list
    setActiveView("hub");
  }

  async function handleDocSelect(doc: UploadedDoc) {
    setSelectedDoc(doc);
    setActiveView("doc_detail");

    // Load DNA if available, or generate on demand
    if (!doc.clinical_significance) {
      setIsLoadingDNA(true);
      try {
        // Fetch document text from Supabase
        const { data } = await (supabase as any)
          .from("uploaded_files")
          .select("document_dna, ocr_extracted_json")
          .eq("id", doc.id)
          .single();

        const textContent = (data && data.document_dna && data.document_dna.summary)
          || JSON.stringify((data && data.ocr_extracted_json) || {});

        if (textContent && textContent !== "{}") {
          const dna = await extractDocumentDNADeep(
            textContent
          );
          setSelectedDNA(dna);
        }
      } catch (e) {
        console.error("DNA generation failed", e);
      } finally {
        setIsLoadingDNA(false);
      }
    }
  }

  const reviewCount = docs.filter(d => d.needs_review).length;
  const displayDocs = filterReview ? docs.filter(d => d.needs_review) : docs;

  // ── OCR Upload View ──────────────────────────────────────────────────────────
  if (activeView === "ocr_upload") {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setActiveView("hub")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
          >
            ← Back to Document Hub
          </button>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Handwritten Form Scanner</h2>
            <p className="text-gray-500 text-sm mt-1">
              Gemini Vision extracts all fields — no manual transcription
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <OcrFormUploader
              onFormProcessed={handleOcrComplete}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Doc Detail View ──────────────────────────────────────────────────────────
  if (activeView === "doc_detail" && selectedDoc) {
    const sig = SIG_CONFIG[selectedDoc.clinical_significance || "informational"];

    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => { setActiveView("hub"); setSelectedDoc(null); setSelectedDNA(null); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
          >
            ← Back to Document Hub
          </button>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Document metadata */}
            <div className="col-span-1 space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Document</div>
                <h3 className="text-white font-semibold text-sm leading-snug mb-3">
                  {selectedDoc.file_name}
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="text-gray-300">{selectedDoc.ocr_form_type || selectedDoc.document_type || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="text-gray-300">{selectedDoc.document_status}</span>
                  </div>
                  {selectedDoc.ocr_completion_score != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Completion</span>
                      <span className={selectedDoc.ocr_completion_score >= 80 ? "text-green-400" : "text-yellow-400"}>
                        {selectedDoc.ocr_completion_score}%
                      </span>
                    </div>
                  )}
                  {selectedDoc.dna_confidence != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">AI Confidence</span>
                      <span className="text-gray-300">{selectedDoc.dna_confidence}%</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Significance</span>
                    <span className={`flex items-center gap-1.5 ${sig.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sig.dot}`} />
                      {sig.label}
                    </span>
                  </div>
                </div>
              </div>

              {selectedDoc.needs_review && (
                <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 text-xs text-yellow-300">
                  ⚠ Flagged for human review — some fields may need verification
                </div>
              )}
            </div>

            {/* Right: DNA Analysis */}
            <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest">
                  AI Clinical Analysis
                </div>
                {isLoadingDNA && (
                  <div className="w-3 h-3 border border-gray-600 border-t-red-500 rounded-full animate-spin ml-auto" />
                )}
              </div>

              {isLoadingDNA ? (
                <div className="space-y-3 animate-pulse">
                  {[80, 60, 90, 50, 70].map((w, i) => (
                    <div key={i} className="h-3 bg-gray-800 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : selectedDNA ? (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedDNA.summary}</p>

                  {selectedDNA.riskFlags.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Risk Flags</div>
                      {selectedDNA.riskFlags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
                          <span className={
                            flag.severity === "urgent" ? "text-red-400" :
                            flag.severity === "warning" ? "text-yellow-400" : "text-gray-500"
                          }>
                            {flag.severity === "urgent" ? "⚡" : flag.severity === "warning" ? "⚠" : "ℹ"}
                          </span>
                          <span className="text-gray-300">{flag.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDNA.actionItems.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Action Items</div>
                      {selectedDNA.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5 text-xs">
                          <span className="text-red-400">→</span>
                          <span className="text-gray-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDNA.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {selectedDNA.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-600 text-sm text-center py-8">
                  No AI analysis available yet.<br />
                  <button
                    onClick={() => handleDocSelect(selectedDoc)}
                    className="mt-3 text-red-500 hover:text-red-400 text-xs underline"
                  >
                    Generate Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Hub View (main) ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-widest">ACS Clinical Intelligence</span>
            <span className="text-xs text-green-400 border border-green-800 rounded px-1.5 py-0.5">
              ✓ Gemini Vision Active
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Document Intelligence Hub</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-powered document processing — OCR, Deep Reasoning, Clinical DNA
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setActiveView("ocr_upload")}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <span>📋</span> Scan Handwritten Form
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
            <span>↑</span> Upload Document
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Documents", value: docs.length, color: "text-white" },
          { label: "Needs Review", value: reviewCount, color: reviewCount > 0 ? "text-yellow-400" : "text-green-400" },
          { label: "OCR Processed", value: docs.filter(d => d.ocr_form_type).length, color: "text-blue-400" },
          { label: "Critical Flags", value: docs.filter(d => d.clinical_significance === "critical").length, color: "text-red-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setFilterReview(false)}
          className={`text-xs px-3 py-1.5 rounded border transition-all ${!filterReview ? "bg-white text-black border-white" : "text-gray-400 border-gray-700"}`}
        >
          All Documents
        </button>
        <button
          onClick={() => setFilterReview(true)}
          className={`text-xs px-3 py-1.5 rounded border transition-all ${filterReview ? "bg-yellow-900 text-yellow-300 border-yellow-700" : "text-gray-400 border-gray-700"}`}
        >
          Needs Review {reviewCount > 0 && `(${reviewCount})`}
        </button>
      </div>

      {/* Document List */}
      {isLoadingDocs ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">📂</div>
          <div className="text-gray-400 font-medium">No documents yet</div>
          <div className="text-gray-600 text-sm mt-1">Upload a document or scan a handwritten form to get started</div>
          <button
            onClick={() => setActiveView("ocr_upload")}
            className="mt-6 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg"
          >
            Scan First Form
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {displayDocs.map(doc => (
            <DocRow key={doc.id} doc={doc} onClick={() => handleDocSelect(doc)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Doc Row ──────────────────────────────────────────────────────────────────

function DocRow({ doc, onClick }: { doc: UploadedDoc; onClick: () => void }) {
  const sig = SIG_CONFIG[doc.clinical_significance || "informational"];

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl cursor-pointer transition-all group"
    >
      {/* Type icon */}
      <div className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
        {doc.file_type?.includes("pdf") ? "📄" : doc.file_type?.includes("image") ? "🖼" : "📋"}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{doc.file_name}</div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          <span>{doc.ocr_form_type || doc.document_type || "Document"}</span>
          {doc.ocr_completion_score != null && (
            <span className={doc.ocr_completion_score >= 80 ? "text-green-500" : "text-yellow-500"}>
              {doc.ocr_completion_score}% complete
            </span>
          )}
          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {doc.needs_review && (
          <span className="text-xs px-2 py-0.5 bg-yellow-950 border border-yellow-800 text-yellow-300 rounded-full">
            Review
          </span>
        )}
        {doc.clinical_significance && (
          <span className={`flex items-center gap-1.5 text-xs ${sig.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sig.dot}`} />
            {sig.label}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
