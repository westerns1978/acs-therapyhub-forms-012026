
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { UploadCloud, File, Trash2, Eye, Loader2, CheckCircle, AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface FileManagerProps {
  bucketName: string;
  clientId: string;
  onUploadSuccess?: () => void;
}

interface FileEntry {
    name: string;
    id: string;
    updated_at: string;
    metadata: any;
    publicUrl: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ bucketName, clientId, onUploadSuccess }) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
        const { data, error } = await supabase.storage.from(bucketName).list(`clients/${clientId}/`, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'desc' },
        });

        if (error) throw error;

        // FIX: Cast file to any to prevent unknown type error for properties like name and id.
        const filesWithUrls = (data || []).map((file: any) => {
            const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(`clients/${clientId}/${file.name}`);
            return {
                ...file,
                publicUrl
            } as FileEntry;
        });

        setFiles(filesWithUrls);
    } catch (e: any) {
        console.error("Storage load error:", e);
        setError("Failed to sync vault contents.");
    }
  };

  useEffect(() => {
    loadFiles();
  }, [bucketName, clientId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // FIX: Cast Array.from result to File[] to ensure the compiler recognizes the 'name' property on each file.
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of selectedFiles) {
        try {
            const filePath = `clients/${clientId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file);
            if (uploadError) throw uploadError;
        } catch (e: any) {
            // FIX: The loop variable 'file' is now correctly typed as File, preventing unknown property errors here.
            setError(`Failed to upload ${file.name}`);
            break;
        }
    }

    setUploading(false);
    loadFiles();
    onUploadSuccess?.();
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Permanently remove ${fileName} from secure vault?`)) return;
    
    try {
        const { error } = await supabase.storage.from(bucketName).remove([`clients/${clientId}/${fileName}`]);
        if (error) throw error;
        loadFiles();
    } catch (e) {
        alert("Deletion failed.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-500 bg-white/5 backdrop-blur-xl border-white/10 hover:border-primary/50 hover:bg-primary/5 group relative overflow-hidden`}
      >
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
        
        <div className="relative z-10">
          <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-4 group-hover:scale-110 transition-transform">
             {uploading ? <Loader2 className="w-10 h-10 text-primary animate-spin" /> : <UploadCloud className="w-10 h-10 text-primary" />}
          </div>
          <p className="text-lg font-black tracking-tight text-slate-800 dark:text-white">
            {uploading ? 'Transmitting to Vault...' : 'Ingest Clinical Records'}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Drag & drop or click to browse</p>
        </div>

        {/* Solaris Background Pulse */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertTriangle size={18}/>
            <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {/* File Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {files.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                <File className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Documents Synced</p>
            </div>
        ) : files.map((file) => (
          <div key={file.id} className="group relative bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-white/20 dark:border-slate-700 hover:border-primary/30 transition-all hover:shadow-xl">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                    <File size={24} className="text-slate-500" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm truncate pr-8" title={file.name}>{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">SECURE PDS</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(file.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={file.publicUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white dark:bg-slate-700 shadow-sm rounded-lg hover:text-primary transition-colors">
                    <Eye size={14} />
                </a>
                <button onClick={() => handleDelete(file.name)} className="p-1.5 bg-white dark:bg-slate-700 shadow-sm rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
