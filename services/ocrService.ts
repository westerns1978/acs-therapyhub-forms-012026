/**
 * ACS TherapyHub — Handwritten Form OCR Service
 */

import { geminiVision } from './gemini';

export interface ExtractedFormField {
  fieldName: string;
  value: string;
  confidence: "high" | "medium" | "low";
}

export interface OcrExtractionResult {
  formType: string;
  fields: ExtractedFormField[];
  flaggedFields: string[];
  completionScore: number;
  rawJson: Record<string, unknown>;
  processingMs: number;
}

export type SupportedFormType =
  | "SATOP_INTAKE"
  | "SROP_INTAKE"
  | "CSTAR_INTAKE"
  | "CONSENT"
  | "BIOPSYCHOSOCIAL"
  | "RELEASE_OF_INFO"
  | "UNKNOWN";

const OCR_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    formType: { type: "STRING", description: "Best-guess label for the document type, e.g. 'Intake Form' or 'Consent'." },
    fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          fieldName: { type: "STRING" },
          value: { type: "STRING" },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
        },
        required: ["fieldName", "value", "confidence"],
      },
    },
    flaggedFields: { type: "ARRAY", items: { type: "STRING" } },
    completionScore: { type: "NUMBER" },
  },
  required: ["formType", "fields", "flaggedFields", "completionScore"],
};

const EMPTY_RESULT = (formType = "Unknown"): Omit<OcrExtractionResult, "processingMs"> => ({
  formType,
  fields: [],
  flaggedFields: [],
  completionScore: 0,
  rawJson: {},
});

export async function extractHandwrittenForm(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  _hintFormType?: SupportedFormType
): Promise<OcrExtractionResult> {
  const startTime = Date.now();

  // Neutral, non-clinical framing — earlier prompts that called this a
  // "clinical document OCR specialist" sometimes tripped Gemini's safety
  // filters and got back prose refusals like "I'm sorry, I can't help...".
  // Combined with response_mime_type: application/json this returns a
  // parseable result reliably.
  const extractionPrompt = `Transcribe all visible text from this document image.
Return a JSON object with:
- formType: a short label describing the document
- fields: array of { fieldName, value, confidence } for each labeled field you can read
- flaggedFields: names of fields whose values are unclear or unreadable
- completionScore: integer 0-100 estimating how complete the form is

If you cannot read anything, return formType "Unknown" with empty arrays and completionScore 0.`;

  let resultText = "";
  try {
    resultText = await geminiVision(
      "gemini-2.0-flash",
      [
        { text: extractionPrompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
      {
        generation_config: {
          response_mime_type: "application/json",
          response_schema: OCR_RESPONSE_SCHEMA,
          temperature: 0,
        },
      }
    );
  } catch (e) {
    console.warn("[ocrService] Gemini Vision call failed:", e);
    return { ...EMPTY_RESULT("Unreadable"), processingMs: Date.now() - startTime };
  }

  const cleanJson = resultText.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  let parsed: Partial<OcrExtractionResult> = {};
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    // Gemini refused or returned prose. Surface the raw text as a single
    // field so the operator can still see *something* and decide whether
    // to retry. Demo-safe: never blow up the upload flow.
    console.warn("[ocrService] Non-JSON response from Gemini, falling back. First 200 chars:", cleanJson.slice(0, 200));
    return {
      ...EMPTY_RESULT("Unreadable"),
      fields: cleanJson
        ? [{ fieldName: "raw_response", value: cleanJson.slice(0, 500), confidence: "low" }]
        : [],
      flaggedFields: ["raw_response"],
      processingMs: Date.now() - startTime,
    };
  }

  return {
    formType: parsed.formType || "Unknown",
    fields: Array.isArray(parsed.fields) ? parsed.fields : [],
    flaggedFields: Array.isArray(parsed.flaggedFields) ? parsed.flaggedFields : [],
    completionScore: typeof parsed.completionScore === "number" ? parsed.completionScore : 0,
    rawJson: (parsed as any).rawJson || {},
    processingMs: Date.now() - startTime,
  };
}
