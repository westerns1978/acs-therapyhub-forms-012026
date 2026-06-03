/**
 * ACS TherapyHub — Gemini REST API Helper
 *
 * generateContent calls are routed through the `pds-gemini-proxy` Supabase edge
 * function, which holds GEMINI_API_KEY as a server-side secret and injects it as
 * `x-goog-api-key`. The real Gemini key is NEVER embedded in the client bundle
 * for these (text / vision / JSON) paths.
 *
 * NOT routed here (these still hold the key client-side — tracked as follow-ups):
 *   - Clara voice/Live API in components/ai/SynapseChatPopover.tsx (Live needs
 *     the `gemini-live-token` ephemeral-token endpoint — a REST proxy can't
 *     carry a websocket; its text chat fetch could be proxied later).
 *   - generateMilestoneCelebration (Veo `generateVideos`) in services/api.ts.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// pds-gemini-proxy mount + the Gemini REST prefix it transparently forwards.
const GEMINI_PROXY_BASE = `${SUPABASE_URL}/functions/v1/pds-gemini-proxy/v1beta/models`;

/**
 * Returns the client-side Gemini key. Only used by the not-yet-proxied paths
 * noted above (Clara Live, Veo). The proxied generateContent path below does
 * NOT use this.
 */
export function getApiKey(): string {
  const key = (import.meta as any).env?.VITE_API_KEY
    || (typeof process !== 'undefined' ? process.env?.API_KEY : undefined)
    || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
  if (!key) {
    console.error('[gemini] No Gemini API key — set VITE_API_KEY in .env (local) or the hosting env (deploy).');
    return '';
  }
  return key;
}

export async function geminiGenerate(
  model: string,
  body: Record<string, unknown>
): Promise<{ text: string; candidates: any[] }> {
  // Route via the proxy edge function (server-side key injection). Auth uses the
  // public Supabase anon JWT (verify_jwt is on); the real Gemini key stays server-side.
  const res = await fetch(`${GEMINI_PROXY_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini proxy ${res.status}: ${err}`);
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
