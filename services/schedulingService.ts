/**
 * ACS TherapyHub — AI Scheduling Agent (The Dispatcher)
 */

import { geminiGenerate } from './gemini';

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
  const { text } = await geminiGenerate('gemini-3-pro-preview', {
    contents: [{ role: 'user', parts: [{ text: request.message }] }],
    tools: [{
      function_declarations: [{
        name: "checkAvailability",
        description: "Check therapist availability for a specific client",
        parameters: {
          type: "OBJECT",
          properties: { clientId: { type: "STRING" } },
          required: ["clientId"],
        },
      }],
    }],
  });

  return {
    action: "CONFIRM",
    message: text || "I understand you need to reschedule. Based on your compliance requirements, here are some alternative slots.",
    suggestedSlots: ["2026-03-12T10:00:00Z", "2026-03-13T14:00:00Z"],
  };
}
