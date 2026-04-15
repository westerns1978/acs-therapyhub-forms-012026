/**
 * ACS TherapyHub — Gemini REST API Helper
 * Replaces @google/genai SDK with direct fetch() calls.
 * No WebSocket connections on import.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function getApiKey(): string {
  return import.meta.env.VITE_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyBLU362ndX18qYQO7OiW3mGniyn2Lsk93M';
}

export async function geminiGenerate(
  model: string,
  body: Record<string, unknown>
): Promise<{ text: string; candidates: any[] }> {
  const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const json = await res.json();
  const candidates = json.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text || '').join('');
  return { text, candidates };
}

/** Shorthand: text-only prompt, returns text */
export async function geminiText(model: string, prompt: string, config?: Record<string, unknown>): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...config,
  };
  const { text } = await geminiGenerate(model, body);
  return text;
}

/** Shorthand: text prompt with JSON response schema */
export async function geminiJSON<T = any>(
  model: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  config?: Record<string, unknown>
): Promise<T> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: responseSchema,
      ...(config?.generation_config as any),
    },
    ...config,
  };
  delete body.generation_config; // rebuild cleanly
  const genConfig: any = {
    response_mime_type: 'application/json',
    response_schema: responseSchema,
    ...(config?.generation_config as any),
  };
  const finalBody: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generation_config: genConfig,
  };
  if (config?.system_instruction) finalBody.system_instruction = config.system_instruction;
  if (config?.tools) finalBody.tools = config.tools;
  const { text } = await geminiGenerate(model, finalBody);
  return JSON.parse(text || '{}');
}

/** Vision: send image + text prompt */
export async function geminiVision(
  model: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  config?: Record<string, unknown>
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    ...config,
  };
  const { text } = await geminiGenerate(model, body);
  return text;
}
