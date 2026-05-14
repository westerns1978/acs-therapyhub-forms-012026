/**
 * ACS TherapyHub — Multi-format document extraction
 *
 * Routes a File to the right extraction path:
 *   image/*              → Gemini Vision (inlineData)
 *   application/pdf      → Gemini Vision (inlineData, native PDF support)
 *   .docx                → mammoth (browser) → text → Gemini text
 *   .xlsx                → SheetJS (browser) → text → Gemini text
 *
 * Returns a normalized ExtractionResult shape regardless of input type.
 */

import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { geminiGenerate } from "./gemini";

export interface ExtractedField {
  fieldName: string;
  value: string;
}

export interface ExtractionResult {
  /** Best-guess document type — e.g. "court_order", "intake_form", "billing_record". */
  documentType: string;
  /** 1-2 sentence summary suitable for a row preview. */
  summary: string;
  /** Structured key/value fields the model could identify. */
  fields: ExtractedField[];
  /** Full extracted text body (for image/PDF: Gemini's transcription; for office docs: client-side extract). */
  extractedText: string;
  /** Whether extraction succeeded. False when extraction fell back to a placeholder. */
  ok: boolean;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const VISION_MODEL = "gemini-2.5-flash-lite";

const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    documentType: { type: "STRING", description: "court_order, intake_form, treatment_plan, verification_slip, id_copy, billing_record, progress_note, consent, other" },
    summary: { type: "STRING", description: "1-2 sentence summary of what this document is and why it matters." },
    fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          fieldName: { type: "STRING" },
          value: { type: "STRING" },
        },
        required: ["fieldName", "value"],
      },
      description: "Key fields visible in the document — names, dates, case numbers, amounts.",
    },
    extractedText: { type: "STRING", description: "Full transcription of all visible text." },
  },
  required: ["documentType", "summary", "fields", "extractedText"],
};

const GENERIC_PROMPT = `Extract the key information from this document.

Return JSON with:
- documentType: one of court_order, intake_form, treatment_plan, verification_slip, id_copy, billing_record, progress_note, consent, other
- summary: 1-2 sentences describing what this document is and why it matters
- fields: array of { fieldName, value } for names, dates, case numbers, amounts, and other key identifiers
- extractedText: a full transcription of all visible text in the document

If the document is blank or unreadable, return documentType "other" with empty fields and an empty extractedText.`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isDocx = (file: File): boolean =>
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  file.name.toLowerCase().endsWith(".docx");

const isXlsx = (file: File): boolean =>
  file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  file.name.toLowerCase().endsWith(".xlsx");

const isPdf = (file: File): boolean =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isImage = (file: File): boolean =>
  file.type.startsWith("image/");

const isVideo = (file: File): boolean =>
  file.type.startsWith("video/");

const FALLBACK = (summary = "Document saved without extraction."): ExtractionResult => ({
  documentType: "other",
  summary,
  fields: [],
  extractedText: "",
  ok: false,
});

async function callGeminiVision(file: File): Promise<ExtractionResult> {
  const base64 = await fileToBase64(file);
  const { text } = await geminiGenerate(VISION_MODEL, {
    contents: [{
      role: "user",
      parts: [
        { text: GENERIC_PROMPT },
        { inlineData: { mimeType: file.type, data: base64 } },
      ],
    }],
    generation_config: {
      response_mime_type: "application/json",
      response_schema: EXTRACTION_SCHEMA,
      temperature: 0,
    },
  });
  return parseGeminiResponse(text);
}

async function callGeminiText(extractedText: string, contextLabel: string): Promise<ExtractionResult> {
  const trimmed = extractedText.length > 30000 ? extractedText.slice(0, 30000) + "\n…[truncated]" : extractedText;
  const { text } = await geminiGenerate(VISION_MODEL, {
    contents: [{
      role: "user",
      parts: [{
        text: `${GENERIC_PROMPT}\n\n[Document content extracted from ${contextLabel}]\n${trimmed}`,
      }],
    }],
    generation_config: {
      response_mime_type: "application/json",
      response_schema: EXTRACTION_SCHEMA,
      temperature: 0,
    },
  });
  const parsed = parseGeminiResponse(text);
  // Preserve the original client-side extract when Gemini omitted the text
  if (!parsed.extractedText && extractedText) {
    parsed.extractedText = extractedText;
  }
  return parsed;
}

function parseGeminiResponse(rawText: string): ExtractionResult {
  const clean = rawText.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  if (!clean) return FALLBACK("Document saved — Gemini returned no extraction.");
  try {
    const parsed = JSON.parse(clean);
    return {
      documentType: parsed.documentType || "other",
      summary: parsed.summary || "",
      fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      extractedText: parsed.extractedText || "",
      ok: true,
    };
  } catch (e) {
    console.warn("[documentExtraction] Could not parse Gemini response, keeping raw:", clean.slice(0, 200));
    return {
      ...FALLBACK("Document saved — extraction returned unstructured response."),
      summary: clean.slice(0, 300),
    };
  }
}

async function extractDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

function extractXlsxText(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const lines: string[] = [];
    workbook.SheetNames.forEach((name) => {
      lines.push(`# Sheet: ${name}`);
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
      lines.push(csv);
    });
    return lines.join("\n");
  });
}

export async function extractFromFile(file: File): Promise<ExtractionResult> {
  if (isVideo(file)) {
    return FALLBACK("Video files aren't supported here — store the file separately.");
  }

  if (isImage(file) || isPdf(file)) {
    try {
      return await callGeminiVision(file);
    } catch (e) {
      console.warn("[documentExtraction] Vision call failed:", e);
      return FALLBACK("Document saved — couldn't read it just now. You can retry later.");
    }
  }

  if (isDocx(file)) {
    try {
      const text = await extractDocxText(file);
      if (!text.trim()) return FALLBACK("Document saved — no readable text found.");
      return await callGeminiText(text, "a Word document (.docx)");
    } catch (e) {
      console.warn("[documentExtraction] docx extraction failed:", e);
      return FALLBACK("Document saved — couldn't read the Word file just now.");
    }
  }

  if (isXlsx(file)) {
    try {
      const text = await extractXlsxText(file);
      if (!text.trim()) return FALLBACK("Document saved — the spreadsheet appears empty.");
      return await callGeminiText(text, "an Excel spreadsheet (.xlsx)");
    } catch (e) {
      console.warn("[documentExtraction] xlsx extraction failed:", e);
      return FALLBACK("Document saved — couldn't read the spreadsheet just now.");
    }
  }

  return FALLBACK("Document saved — this file type isn't transcribed automatically.");
}

export function fileSizeError(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "That file is over 10 MB. Try a smaller version or split it up.";
  }
  if (isVideo(file)) {
    return "Videos aren't supported here yet. Try uploading documents, images, or spreadsheets.";
  }
  return null;
}

export function isSupportedFile(file: File): boolean {
  return isImage(file) || isPdf(file) || isDocx(file) || isXlsx(file);
}

export const ACCEPT_ATTRIBUTE =
  "image/*,application/pdf,.docx,.xlsx,.doc,.xls," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
