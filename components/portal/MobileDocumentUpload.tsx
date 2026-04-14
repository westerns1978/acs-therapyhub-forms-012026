import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, RotateCcw, X, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { extractHandwrittenForm, type OcrExtractionResult, type ExtractedFormField } from '../../services/ocrService';
import { supabase } from '../../services/supabase';
import { storageService } from '../../services/storageService';

interface MobileDocumentUploadProps {
  clientId: string;
  onComplete: () => void;
  onClose: () => void;
}

type Step = 'capture' | 'processing' | 'review' | 'saving' | 'done' | 'error';

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'High' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Review' },
  low:    { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Low' },
};

export default function MobileDocumentUpload({ clientId, onComplete, onClose }: MobileDocumentUploadProps) {
  const [step, setStep] = useState<Step>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrExtractionResult | null>(null);
  const [editedFields, setEditedFields] = useState<ExtractedFormField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedFlags, setExpandedFlags] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Capture ──────────────────────────────────────────────────────────────────

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (photo of your form).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image is too large. Please use a file under 15MB.');
      return;
    }

    setError(null);
    setImageFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Run OCR
    await runOcr(file);
  };

  const runOcr = async (file: File) => {
    setStep('processing');
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
      const result = await extractHandwrittenForm(base64, mimeType);
      setOcrResult(result);
      setEditedFields(result.fields.map(f => ({ ...f })));
      setStep('review');
    } catch (err: any) {
      console.error('OCR failed:', err);
      setError(err.message || 'Failed to process document. Please try again.');
      setStep('error');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleConfirmAndSave = async () => {
    if (!imageFile || !ocrResult) return;
    setStep('saving');
    try {
      // Upload file to storage + extract DNA
      const vaultDoc = await storageService.uploadToVault(imageFile, clientId);

      // Update the uploaded_files record with OCR data
      await supabase
        .from('uploaded_files')
        .update({
          ocr_form_type: ocrResult.formType,
          ocr_completion_score: ocrResult.completionScore,
          ocr_extracted_json: buildFieldMap(editedFields),
          needs_review: ocrResult.flaggedFields.length > 0 || ocrResult.completionScore < 80,
          document_status: 'ocr_complete',
        })
        .eq('id', vaultDoc.id);

      setStep('done');
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err.message || 'Failed to save document.');
      setStep('error');
    }
  };

  const buildFieldMap = (fields: ExtractedFormField[]): Record<string, unknown> => {
    const map: Record<string, unknown> = {};
    for (const f of fields) {
      map[f.fieldName] = f.value;
    }
    return map;
  };

  // ── Field editing ────────────────────────────────────────────────────────────

  const updateField = (index: number, value: string) => {
    setEditedFields(prev => {
      const next = [...prev];
      next[index] = { ...next[index], value, confidence: 'high' };
      return next;
    });
  };

  const handleRetake = () => {
    setStep('capture');
    setImageFile(null);
    setImagePreview(null);
    setOcrResult(null);
    setEditedFields([]);
    setError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  // Capture step
  if (step === 'capture') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={24} />
          </button>
          <h2 className="font-bold text-slate-800 dark:text-white">Scan Document</h2>
          <div className="w-10" />
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center mb-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera size={36} className="text-primary" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              Scan Your Paper Form
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
              Take a photo of your completed form or upload an existing image. AI will extract all fields automatically.
            </p>
          </div>

          {/* Camera button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Camera size={20} />
            Take Photo
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          />

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm border border-slate-200 dark:border-slate-700 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Upload size={20} />
            Upload from Gallery
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
          />

          {error && (
            <p className="text-sm text-red-500 font-bold text-center mt-2">{error}</p>
          )}
        </div>

        {/* Tip */}
        <div className="px-6 pb-6">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 text-center">
              For best results: use good lighting, lay the form flat, and capture all edges of the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Processing step
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-3 flex items-center justify-center">
              <Eye size={28} className="text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Reading Your Form</h3>
            <p className="text-sm text-slate-500 mt-2">
              AI is extracting text and fields from your document...
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error step
  if (step === 'error') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={36} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Something Went Wrong</h3>
            <p className="text-sm text-slate-500 mt-2">{error || 'An unexpected error occurred.'}</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleRetake}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-3.5 text-slate-500 font-bold text-sm hover:text-slate-700 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Done step
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Document Saved!</h3>
            <p className="text-sm text-slate-500 mt-2">
              Your form has been uploaded and processed. Your counselor will review the extracted data.
            </p>
          </div>
          {ocrResult && (
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="text-center">
                <div className="text-lg font-black text-primary">{ocrResult.fields.length}</div>
                <div className="text-slate-500">Fields Found</div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
              <div className="text-center">
                <div className="text-lg font-black text-primary">{ocrResult.completionScore}%</div>
                <div className="text-slate-500">Complete</div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
              <div className="text-center">
                <div className="text-lg font-black text-primary">{ocrResult.processingMs}ms</div>
                <div className="text-slate-500">Processing</div>
              </div>
            </div>
          )}
          <button
            onClick={() => { onComplete(); onClose(); }}
            className="w-full px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Saving step
  if (step === 'saving') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="text-primary animate-spin mx-auto" />
          <h3 className="text-lg font-black text-slate-800 dark:text-white">Saving Document</h3>
          <p className="text-sm text-slate-500">Uploading to your secure file vault...</p>
        </div>
      </div>
    );
  }

  // Review step
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <button onClick={handleRetake} className="p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <RotateCcw size={20} />
        </button>
        <h2 className="font-bold text-slate-800 dark:text-white">Review Extracted Data</h2>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-500">
          <X size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Image preview toggle */}
        {imagePreview && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400"
          >
            <span>Original Photo</span>
            {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        {showPreview && imagePreview && (
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <img src={imagePreview} alt="Captured form" className="w-full" />
          </div>
        )}

        {/* Form type + score */}
        {ocrResult && (
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Detected Form</p>
              <p className="font-bold text-slate-800 dark:text-white text-sm mt-0.5">
                {ocrResult.formType.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Complete</p>
              <p className={`font-black text-lg ${ocrResult.completionScore >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                {ocrResult.completionScore}%
              </p>
            </div>
          </div>
        )}

        {/* Flagged fields warning */}
        {ocrResult && ocrResult.flaggedFields.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <button
              onClick={() => setExpandedFlags(!expandedFlags)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-600" />
                <span className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                  {ocrResult.flaggedFields.length} field{ocrResult.flaggedFields.length > 1 ? 's' : ''} need review
                </span>
              </div>
              {expandedFlags ? <ChevronUp size={14} className="text-yellow-600" /> : <ChevronDown size={14} className="text-yellow-600" />}
            </button>
            {expandedFlags && (
              <ul className="mt-2 space-y-1">
                {ocrResult.flaggedFields.map((f, i) => (
                  <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400 pl-6">- {f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Editable fields */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Extracted Fields</p>
          {editedFields.map((field, index) => {
            const conf = CONFIDENCE_STYLES[field.confidence] || CONFIDENCE_STYLES.low;
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {field.fieldName}
                  </label>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                    {conf.label}
                  </span>
                </div>
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateField(index, e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors
                    ${field.confidence === 'low'
                      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                      : field.confidence === 'medium'
                        ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }
                    text-slate-800 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                  `}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3">
        <button
          onClick={handleConfirmAndSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <CheckCircle2 size={18} />
          Confirm & Save
        </button>
        <button
          onClick={handleRetake}
          className="w-full px-6 py-3 text-slate-500 font-bold text-sm text-center hover:text-slate-700 transition-all"
        >
          Retake Photo
        </button>
      </div>
    </div>
  );
}
