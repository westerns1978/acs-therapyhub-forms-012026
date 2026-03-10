/**
 * ACS TherapyHub — OCR Form Uploader Component
 */

import React, { useState, useRef } from "react";
import { extractHandwrittenForm, OcrExtractionResult, SupportedFormType } from "../services/ocrService";

export default function OcrFormUploader({ onFormProcessed }: { onFormProcessed: (result: OcrExtractionResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await extractHandwrittenForm(base64, file.type as any);
        onFormProcessed(result);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("OCR Error:", error);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900 rounded-lg">
      <h2 className="text-lg font-bold mb-4">OCR Form Scanner</h2>
      <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />
      <button 
        onClick={handleUpload} 
        disabled={!file || loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
      >
        {loading ? "Scanning..." : "Scan Form"}
      </button>
    </div>
  );
}
