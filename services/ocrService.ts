/**
 * ACS TherapyHub — Handwritten Form OCR Service
 */

import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export async function extractHandwrittenForm(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  hintFormType?: SupportedFormType
): Promise<OcrExtractionResult> {
  const startTime = Date.now();

  const extractionPrompt = `You are a clinical document OCR specialist. Extract ALL handwritten and printed text from this intake form into structured JSON.
Return ONLY a JSON object with this structure:
{
  "formType": "string",
  "fields": [{ "fieldName": "string", "value": "string", "confidence": "high|medium|low" }],
  "flaggedFields": ["string"],
  "completionScore": number,
  "rawJson": { ... }
}`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        { text: extractionPrompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    },
  });

  const cleanJson = result.text!.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(cleanJson);

  return {
    ...parsed,
    processingMs: Date.now() - startTime,
  };
}
