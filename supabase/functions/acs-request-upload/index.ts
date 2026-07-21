// ACS TherapyHub — Client Upload Link (inbound twin of Capture).
// Deployed as `acs-request-upload`, verify_jwt=false at the gateway (resolve/submit
// are public + token-gated). MINT verifies a real staff JWT MANUALLY — there is NO
// anon-key fallback. (This is deliberately unlike FlowVault's family-upload function,
// whose mint accepts the publishable anon key; that hole is the whole reason we port
// instead of reuse. 42 CFR Part 2 records demand a verified staff actor to mint.)
//
// Actions:
//   mint    (staff JWT)  → 24-byte CSPRNG token; store sha256(token); scope to one
//                          client + one requested_document_type; revoke prior active.
//                          Returns the RAW token once (for the /upload/<token> URL).
//   resolve (public)     → returns ONLY the requested-document label + expiry.
//                          NO client name / program / id — Part 2 confidentiality.
//   submit  (public)     → target client = token row (never the caller); mime + byte
//                          caps; writes bytes to therapyhub-patient-files + inserts
//                          uploaded_files (document_type = the staff-chosen type,
//                          needs_review=true, metadata.source='link_upload').
//   revoke  (staff JWT)  → kill a client's active link.
// Every action appends to public.audit_logs.
//
// Secrets (platform-provided): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Deploy: supabase functions deploy acs-request-upload --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const STORAGE_BUCKET = 'therapyhub-patient-files';
const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';

// Tighter than FlowVault's 25 uploads / 14 days.
const TOKEN_BYTES = 24;
const EXPIRY_DAYS = 7;
const MAX_FILES = 5;
const MAX_UPLOADS_PER_TOKEN = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file (FlowVault had no cap)
const MAX_NOTE_LEN = 500;

const STAFF_ROLES = ['Director', 'Therapist', 'Admin'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Staff may request only these existing uploaded_files.document_type values — mirrors
// config/recordCategory.ts CATEGORY_OPTIONS. No synthetic types; the upload lands
// pre-categorized (Admin/Clinical) with a real type chip.
const REQUESTABLE_DOC_TYPES: Record<string, string> = {
  consent: 'Consent',
  court_order: 'Court Order',
  id_copy: 'ID / License',
  billing_record: 'Billing',
  intake_form: 'Intake',
  treatment_plan: 'Treatment Plan',
  progress_note: 'Progress Note',
  drug_screen: 'Drug Screen',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function mintToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function publicBase(req: Request): string {
  const origin = req.headers.get('origin') || '';
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/$/, '');
  return 'https://acs-therapyhub.web.app';
}

// Verify a REAL staff user JWT. No anon-key fallback: passing the publishable anon key
// (a role=anon token with no user) fails getUser and is rejected — closing FlowVault's
// mint hole. Returns the staff user or an error string.
async function requireStaff(req: Request): Promise<{ user: any | null; error: string | null }> {
  const authz = req.headers.get('Authorization') || '';
  if (!authz.startsWith('Bearer ')) return { user: null, error: 'Sign in required.' };
  const jwt = authz.slice('Bearer '.length).trim();
  if (!jwt || jwt === ANON_KEY) return { user: null, error: 'A staff sign-in is required to create an upload link.' };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data?.user) return { user: null, error: 'Sign-in could not be verified.' };

  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
  if (!role || !STAFF_ROLES.includes(role)) {
    return { user: null, error: 'Only ACS staff can create an upload link.' };
  }
  return { user: data.user, error: null };
}

async function audit(
  sb: ReturnType<typeof admin>,
  action: string,
  opts: { userId?: string | null; entityId?: string | null; details?: Record<string, unknown>; ip?: string | null },
) {
  try {
    await sb.from('audit_logs').insert({
      user_id: opts.userId ?? null,
      action,
      entity_type: 'client_upload_link',
      entity_id: opts.entityId ?? null,
      details: opts.details ?? {},
      ip_address: opts.ip ?? null,
    });
  } catch (e) {
    // Never fail the operation because the audit write failed — but log it.
    console.error('[acs-request-upload] audit insert failed', e);
  }
}

async function loadValidToken(sb: ReturnType<typeof admin>, rawToken: string) {
  const token_hash = await sha256Hex(rawToken);
  const { data, error } = await sb
    .from('acs_upload_tokens')
    .select('*')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { row: null, reason: 'invalid' as const };
  if (data.revoked_at) return { row: data, reason: 'revoked' as const };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { row: data, reason: 'expired' as const };
  if ((data.upload_count ?? 0) >= MAX_UPLOADS_PER_TOKEN) return { row: data, reason: 'limit' as const };
  return { row: data, reason: 'ok' as const };
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return j({ ok: false, error: 'POST only' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return j({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  const action = String(body.action || '').toLowerCase();
  const ip = clientIp(req);

  try {
    const sb = admin();

    // ── mint (staff JWT REQUIRED — no anon fallback) ────────────────────────
    if (action === 'mint') {
      const { user, error: authErr } = await requireStaff(req);
      if (!user) return j({ ok: false, error: authErr }, 401);

      const clientId = String(body.clientId || body.client_id || '').trim();
      if (!clientId) return j({ ok: false, error: 'clientId is required.' }, 400);
      const docType = String(body.requestedDocumentType || body.requested_document_type || '').trim();
      if (!REQUESTABLE_DOC_TYPES[docType]) return j({ ok: false, error: 'Unknown requested document type.' }, 400);

      // Confirm the client exists (and get nothing else — the row is never exposed).
      const { data: clientRow, error: cErr } = await sb.from('clients').select('id').eq('id', clientId).maybeSingle();
      if (cErr) throw cErr;
      if (!clientRow) return j({ ok: false, error: 'Client not found.' }, 404);

      // Single active link per client: revoke prior active tokens.
      await sb
        .from('acs_upload_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .is('revoked_at', null);

      const raw = mintToken();
      const token_hash = await sha256Hex(raw);
      const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const label = REQUESTABLE_DOC_TYPES[docType];

      const { data: row, error: insErr } = await sb
        .from('acs_upload_tokens')
        .insert({
          token_hash,
          client_id: clientId,
          requested_document_type: docType,
          requested_label: label,
          expires_at: expiresAt,
          created_by: user.id,
          metadata: { minted_via: 'acs-request-upload' },
        })
        .select('id, expires_at')
        .single();
      if (insErr) {
        console.error('[acs-request-upload] mint insert failed', insErr);
        return j({ ok: false, error: 'Could not create upload link.' }, 500);
      }

      await audit(sb, 'upload_link_minted', {
        userId: user.id,
        entityId: row.id,
        ip,
        details: { client_id: clientId, requested_document_type: docType },
      });

      return j({
        ok: true,
        token: raw, // returned ONCE — only ever exists here and in the URL
        url: `${publicBase(req)}/upload/${raw}`,
        expiresAt: row.expires_at,
        expiresInDays: EXPIRY_DAYS,
        requestedLabel: label,
      });
    }

    // ── resolve (public) — NO client identity in the response ───────────────
    if (action === 'resolve') {
      const token = String(body.token || '').trim();
      if (!token) return j({ ok: false, error: 'token is required.' }, 400);

      const { row, reason } = await loadValidToken(sb, token);
      if (reason === 'invalid') return j({ ok: false, valid: false, error: 'This upload link is not valid.' }, 404);
      if (reason === 'revoked' || reason === 'expired' || reason === 'limit') {
        return j({ ok: false, valid: false, error: 'This link is no longer active. Please contact your counselor.' }, 410);
      }

      await audit(sb, 'upload_link_resolved', { entityId: row!.id, ip });

      // Deliberately minimal — requested doc label + expiry ONLY. No name, no client_id.
      return j({
        ok: true,
        valid: true,
        requestedDocumentType: row!.requested_document_type,
        requestedLabel: row!.requested_label || 'a document',
        expiresAt: row!.expires_at,
      });
    }

    // ── submit (public) — target client comes from the token row, never caller ─
    if (action === 'submit') {
      const token = String(body.token || '').trim();
      const note = String(body.note || '').trim().slice(0, MAX_NOTE_LEN);
      const files = Array.isArray(body.files) ? body.files : [];
      if (!token) return j({ ok: false, error: 'token is required.' }, 400);
      if (files.length === 0) return j({ ok: false, error: 'Please attach at least one file.' }, 400);
      if (files.length > MAX_FILES) return j({ ok: false, error: `You can upload up to ${MAX_FILES} files at a time.` }, 400);

      const { row, reason } = await loadValidToken(sb, token);
      if (reason !== 'ok' || !row) {
        return j({ ok: false, error: 'This link is no longer active. Please contact your counselor.' }, reason === 'invalid' ? 404 : 410);
      }
      const remaining = MAX_UPLOADS_PER_TOKEN - (row.upload_count ?? 0);
      if (files.length > remaining) {
        return j({ ok: false, error: `This link can accept ${remaining} more file(s).` }, 400);
      }

      const clientId: string = row.client_id; // AUTHORITATIVE — never from the request
      const docType: string = row.requested_document_type;
      const uploaded: { filename: string; id: string }[] = [];

      for (const f of files as Array<Record<string, unknown>>) {
        const filename = String(f?.filename || f?.name || 'document').slice(0, 200).replace(/[^\w.\-]+/g, '_');
        const mime = String(f?.mimeType || f?.mime_type || '').toLowerCase();
        if (!ALLOWED_MIMES.includes(mime)) return j({ ok: false, error: `Unsupported file type for ${filename}. Use JPEG, PNG, WEBP, or PDF.` }, 400);
        const base64 = String(f?.base64 || '').replace(/^data:[^;]+;base64,/, '');
        if (!base64) return j({ ok: false, error: `File ${filename} was empty.` }, 400);

        // Decode + per-file byte cap (FlowVault had none).
        let bin: string;
        try {
          bin = atob(base64);
        } catch {
          return j({ ok: false, error: `File ${filename} was not valid.` }, 400);
        }
        if (bin.length > MAX_FILE_BYTES) {
          return j({ ok: false, error: `File ${filename} is too large (max ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB).` }, 400);
        }
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const filePath = `clients/${clientId}/${Date.now()}_${filename}`;
        const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, bytes, { contentType: mime, upsert: false });
        if (upErr) {
          console.error('[acs-request-upload] storage upload failed', upErr);
          return j({ ok: false, error: 'Upload failed while saving your file. Please try again.' }, 500);
        }

        // Mirror storageService.ingestDocument's insert shape — existing columns only.
        const { data: docRow, error: insErr } = await sb
          .from('uploaded_files')
          .insert({
            file_name: filename,
            file_path: filePath,
            file_type: mime,
            file_size: bin.length,
            public_url: '', // private bucket — signed URLs are canonical; column is NOT NULL
            bucket_id: STORAGE_BUCKET,
            org_id: DEFAULT_ORG_ID,
            hire_id: clientId,
            uploaded_by: 'Client (upload link)',
            document_type: docType, // staff-chosen — pre-categorized, no Gemini on this path
            document_status: 'uploaded',
            needs_review: true, // client-submitted docs never enter the record unreviewed
            metadata: { clientId, source: 'link_upload', requested_label: row.requested_label || null, note: note || null, token_id: row.id, filename },
          })
          .select('id')
          .single();
        if (insErr) {
          console.error('[acs-request-upload] uploaded_files insert failed', insErr);
          return j({ ok: false, error: 'Your file was received but could not be filed. Please contact your counselor.' }, 500);
        }
        uploaded.push({ filename, id: docRow.id });
      }

      await sb
        .from('acs_upload_tokens')
        .update({ upload_count: (row.upload_count ?? 0) + uploaded.length, last_used_at: new Date().toISOString() })
        .eq('id', row.id);

      await audit(sb, 'upload_link_submitted', {
        entityId: row.id,
        ip,
        details: { client_id: clientId, document_type: docType, count: uploaded.length },
      });

      return j({ ok: true, uploaded: uploaded.length, message: 'Thank you — your counselor has received your document.' });
    }

    // ── revoke (staff JWT) ──────────────────────────────────────────────────
    if (action === 'revoke') {
      const { user, error: authErr } = await requireStaff(req);
      if (!user) return j({ ok: false, error: authErr }, 401);
      const clientId = String(body.clientId || body.client_id || '').trim();
      const token = String(body.token || '').trim();
      if (!clientId && !token) return j({ ok: false, error: 'clientId or token is required.' }, 400);

      let q = sb.from('acs_upload_tokens').update({ revoked_at: new Date().toISOString() }).is('revoked_at', null);
      if (token) q = q.eq('token_hash', await sha256Hex(token));
      else q = q.eq('client_id', clientId);
      const { error } = await q;
      if (error) return j({ ok: false, error: 'Could not revoke link.' }, 500);

      await audit(sb, 'upload_link_revoked', { userId: user.id, ip, details: { client_id: clientId || null } });
      return j({ ok: true });
    }

    return j({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[acs-request-upload] error', e);
    return j({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
