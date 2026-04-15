/**
 * ACS TherapyHub — Deep Reasoning Document Analysis Service
 */

import { geminiText } from './gemini';

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

  const text = await geminiText('gemini-3.1-pro-preview', prompt);
  return JSON.parse(text || "{}");
}
