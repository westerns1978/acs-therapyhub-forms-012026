import { supabase } from './supabase';
import { geminiGenerate } from './gemini';
import { extractFromFile } from './documentExtraction';

const STORAGE_BUCKET = 'gemynd-files';
const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';

// Map the OCR pipeline's freeform form-type label onto the document_type
// taxonomy used for categorization. Returns undefined for unknown/blank labels
// so the caller falls back to a full classification (extractFromFile).
function ocrFormTypeToDocType(label?: string): string | undefined {
  const s = (label || '').toLowerCase().trim();
  if (!s || s === 'unknown' || s === 'unreadable') return undefined;
  if (/(court|influence|order|dwi|disposition)/.test(s)) return 'court_order';
  if (s.includes('intake')) return 'intake_form';
  if (/(consent|release|authorization)/.test(s)) return 'consent';
  if (s.includes('treatment plan')) return 'treatment_plan';
  if (/(verification|certification|slip|completion)/.test(s)) return 'verification_slip';
  if (/(progress|session note|clinical note)/.test(s)) return 'progress_note';
  if (/(drug|screen|urinalysis|uds)/.test(s)) return 'drug_screen';
  if (/(license|identification|id card)/.test(s)) return 'id_copy';
  if (/(bill|invoice|payment|fee)/.test(s)) return 'billing_record';
  return 'other';
}

export interface IngestAnalysis {
  documentType?: string;
  summary?: string;
  extractedText?: string;
  fields?: any[];
  ocrFormType?: string;
  ocrCompletionScore?: number;
  ocrExtractedJson?: Record<string, unknown>;
  needsReview?: boolean;
}

export interface IngestOptions {
  clientId: string;
  source: 'scan' | 'dropzone' | 'upload';
  uploadedBy?: string;
  analysis?: IngestAnalysis;
  onProgress?: (status: string) => void;
}

export const storageService = {
  checkConnection: async () => {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      return { status: 'healthy', message: 'Connected' };
    } catch (e: any) {
      return { status: 'offline', message: e.message };
    }
  },

  extractDocumentDNA: async (file: File) => {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    const { text } = await geminiGenerate('gemini-2.5-flash-lite', {
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: "Extract Document DNA. Return JSON exactly: {title, summary, tags: [], isSigned: boolean}. Focus on clinical/legal relevance. Verify if the signature area is actually signed." }
      ]}],
      generation_config: {
        response_mime_type: "application/json",
        response_schema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            summary: { type: "STRING" },
            tags: { type: "ARRAY", items: { type: "STRING" } },
            isSigned: { type: "BOOLEAN", description: "True if a handwritten signature is detected on the document." }
          }
        }
      }
    });

    return JSON.parse(text || "{}");
  },

  uploadToVault: async (file: File, clientId: string, onProgress?: (status: string) => void) => {
    const filePath = `clients/${clientId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    
    onProgress?.('INITIATING_TRANSMISSION');
    
    // 1. Concurrent DNA Extraction
    const dnaPromise = storageService.extractDocumentDNA(file);

    // 2. Binary Surge
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file);

    if (uploadError) throw uploadError;
    onProgress?.('BINARY_SYNC_COMPLETE');

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    const dna = await dnaPromise;
    onProgress?.('NEURAL_ANALYSIS_SYNCED');

    // 3. Metadata Commit
    // Keep file_name = the literal filename. dna.title sometimes overflows
    // with the whole document body, which would corrupt list rendering.
    const { data: dbData, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        public_url: urlData.publicUrl,
        org_id: DEFAULT_ORG_ID,
        uploaded_by: 'dan-executive',
        extracted_summary: dna.summary || null,
        metadata: {
            clientId,
            title: dna.title,
            summary: dna.summary,
            tags: dna.tags,
            isSigned: dna.isSigned,
            vault_version: '3.0'
        }
      })
      .select().single();

    if (dbError) throw dbError;
    return dbData;
  },

  /**
   * Unified ingest core. ALL grid entry points (scan, dropzone, upload modal)
   * call this so every document lands in ONE bucket (STORAGE_BUCKET), always
   * gets a document_type, and records the real uploader. Each caller passes the
   * analysis it already has; anything missing (notably document_type) is filled
   * here. All Gemini calls go through pds-gemini-proxy (via extractFromFile).
   */
  ingestDocument: async (file: File, opts: IngestOptions) => {
    const { clientId, source, uploadedBy, analysis = {}, onProgress } = opts;

    // 1. Classification — always end with a document_type. Prefer the caller's
    //    classification (upload modal), else map the scan's OCR form-type, else
    //    run extractFromFile here (covers the dropzone, which had none before).
    let documentType = analysis.documentType || ocrFormTypeToDocType(analysis.ocrFormType);
    let summary = analysis.summary;
    let extractedText = analysis.extractedText;
    let fields = analysis.fields;
    let classifyOk = true;
    if (!documentType) {
      onProgress?.('NEURAL_ANALYSIS');
      try {
        const ex = await extractFromFile(file);
        documentType = ex.documentType || 'other';
        summary = summary ?? ex.summary;
        extractedText = extractedText ?? ex.extractedText;
        fields = fields ?? ex.fields;
        classifyOk = ex.ok;
      } catch {
        classifyOk = false;
        documentType = documentType || 'other';
      }
    }

    // 2. Upload bytes to the ONE bucket the grid reads.
    const filePath = `clients/${clientId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    onProgress?.('UPLOADING');
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

    // 3. needs_review — carry from analysis (scan/upload), else derive from
    //    classification certainty.
    const needsReview = analysis.needsReview ?? (!classifyOk || documentType === 'other');

    // 4. One INSERT — existing columns only (no schema change).
    onProgress?.('SAVING');
    const row: Record<string, any> = {
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
      public_url: urlData.publicUrl,
      bucket_id: STORAGE_BUCKET,
      org_id: DEFAULT_ORG_ID,
      hire_id: clientId,
      uploaded_by: uploadedBy || 'Staff',
      document_type: documentType,
      document_status: source === 'scan' ? 'ocr_complete' : (classifyOk ? 'extracted' : 'saved_no_extract'),
      extracted_text: extractedText ?? null,
      extracted_summary: summary ?? null,
      ocr_form_type: analysis.ocrFormType ?? null,
      ocr_completion_score: analysis.ocrCompletionScore ?? null,
      ocr_extracted_json: analysis.ocrExtractedJson ?? (fields ? { fields } : null),
      ocr_processed_at: (source === 'scan' || classifyOk) ? new Date().toISOString() : null,
      needs_review: needsReview,
      // metadata.clientId is REQUIRED — fetchVault filters on it.
      metadata: { clientId, summary: summary ?? null, source },
    };
    const { data, error } = await supabase.from('uploaded_files').insert(row).select().single();
    if (error) throw error;
    return data;
  },

  fetchVault: async (clientId: string) => {
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('org_id', DEFAULT_ORG_ID)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    // Defensively handle null data from Supabase to prevent .filter crash
    const files = data || [];
    return files.filter((f: any) => f.metadata?.clientId === clientId);
  }
};