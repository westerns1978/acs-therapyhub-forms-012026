/**
 * ACS TherapyHub — Deep Reasoning Document Analysis Service
 */

import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DocumentDNA {
  summary: string;
  clinicalSignificance: string;
  riskFlags: { severity: "urgent" | "warning" | "info"; description: string }[];
  complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "PENDING";
  extractedEntities: string[];
  asamRelevance: string;
  actionItems: string[];
  tags: string[];
  reasoningTrace: string;
}

export async function extractDocumentDNADeep(documentText: string): Promise<DocumentDNA> {
  const prompt = `Analyze this clinical document and extract its "Document DNA".
Document:
${documentText}

Return a JSON object with:
{
  "summary": "string",
  "clinicalSignificance": "string",
  "riskFlags": [{"severity": "urgent" | "warning" | "info", "description": "string"}],
  "complianceStatus": "COMPLIANT" | "NON_COMPLIANT" | "PENDING",
  "extractedEntities": ["string"],
  "asamRelevance": "string",
  "actionItems": ["string"],
  "tags": ["string"],
  "reasoningTrace": "string"
}`;

  const result = await genAI.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });
  
  const json = JSON.parse(result.text || "{}");
  return json;
}
