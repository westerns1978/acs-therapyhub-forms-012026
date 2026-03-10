/**
 * ACS TherapyHub — AI Scheduling Agent (The Dispatcher)
 */

import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SchedulingRequest {
  clientId: string;
  intent: "RESCHEDULE" | "CANCEL" | "NEW_APPOINTMENT";
  message: string;
  conversationHistory?: DispatcherMessage[];
}

export interface SchedulingResponse {
  action: "CONFIRM" | "SUGGEST_SLOTS" | "ESCALATE";
  message: string;
  suggestedSlots?: string[];
  complianceWarning?: string;
  requiresTherapistApproval?: boolean;
}

export interface DispatcherMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SchedulingResult {
  action: "rescheduled" | "cancelled" | "confirmed" | "pending_approval" | "denied" | "clarification_needed";
  message: string;
  complianceWarning?: string;
  requiresTherapistApproval?: boolean;
}

export function createDispatcher(supabase: any) {
  return {
    handleRequest: async (request: any): Promise<SchedulingResult> => {
      // Logic to handle request
      return {
        action: "rescheduled",
        message: "Appointment rescheduled.",
        requiresTherapistApproval: false,
      };
    },
    getConversationHistory: () => [],
  };
}

export async function processSchedulingRequest(request: SchedulingRequest): Promise<SchedulingResponse> {
  const response = await genAI.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: request.message,
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: "checkAvailability",
              description: "Check therapist availability for a specific client",
              parameters: {
                type: "object",
                properties: { clientId: { type: "string" } },
                required: ["clientId"],
              },
            },
          ],
        },
      ],
    },
  });

  // Logic to handle natural language scheduling via Gemini
  return {
    action: "CONFIRM",
    message: response.text || "I understand you need to reschedule. Based on your compliance requirements, here are some alternative slots.",
    suggestedSlots: ["2026-03-12T10:00:00Z", "2026-03-13T14:00:00Z"],
  };
}
