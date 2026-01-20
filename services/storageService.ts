import { supabase } from './supabase';
import { GoogleGenAI, Type } from '@google/genai';

const STORAGE_BUCKET = 'gemynd-files';
const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';

export const storageService = {
  checkConnection: async () => {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      return { status: 'healthy', message: 'Uplink Established' };
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

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: "Extract Document DNA. Return JSON exactly: {title, summary, tags: []}. Focus on clinical/legal relevance." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
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
    const { data: dbData, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        file_name: dna.title || file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        public_url: urlData.publicUrl,
        org_id: DEFAULT_ORG_ID,
        uploaded_by: 'dan-executive',
        metadata: {
            clientId,
            summary: dna.summary,
            tags: dna.tags,
            vault_version: '3.0'
        }
      })
      .select().single();

    if (dbError) throw dbError;
    return dbData;
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