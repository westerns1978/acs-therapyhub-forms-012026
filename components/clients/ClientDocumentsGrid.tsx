import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Client, DocumentFile } from '../../types';
import { FileText, UploadCloud, Shield, Zap, ScanLine, FolderOpen, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import DocumentViewer from '../documents/DocumentViewer';
import ScannerPickerModal from '../ScannerPickerModal';
import MobileDocumentUpload from '../portal/MobileDocumentUpload';
import { useAuth } from '../../contexts/AuthContext';
import { getDocumentFilesForClient, saveDocumentFile, checkSupabaseConnection } from '../../services/api';

type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

type ScanFlow =
  | { stage: 'closed' }
  | { stage: 'picker' }
  | { stage: 'upload'; initialImage?: { base64: string; mimeType: SupportedMime } };

interface ClientDocumentsGridProps {
  client: Client;
  initialDocuments: DocumentFile[];
  onDocumentsChanged?: () => void;
}

const UNCATEGORIZED = 'Uncategorized';

// Display order for the file-cabinet sections (clinical/legal first; the honest
// "Uncategorized" bucket always last). Categories not listed sort alphabetically
// in between.
const CATEGORY_ORDER = [
  'Court Order', 'Intake', 'Treatment Plan', 'Consent', 'Verification',
  'Progress Note', 'Completion Certificate', 'Drug Screen', 'ID / License',
  'Billing', 'Other', UNCATEGORIZED,
];

const CATEGORY_COLORS: Record<string, string> = {
  'Court Order': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Intake': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Treatment Plan': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Consent': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Verification': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Progress Note': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Completion Certificate': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Drug Screen': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'ID / License': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Billing': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Other': 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
  [UNCATEGORIZED]: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const catColor = (c: string) => CATEGORY_COLORS[c] || CATEGORY_COLORS[UNCATEGORIZED];

// Category comes from the real uploaded_files.document_type (mapped in api.ts).
// Never invents one — missing/unrecognized stays "Uncategorized".
const docCategory = (d: DocumentFile): string => d.category || UNCATEGORIZED;

const friendlyType = (d: DocumentFile): string => {
  const m = (d.mimeType || '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.startsWith('image/')) return (m.split('/')[1] || 'image').toUpperCase();
  if (m.includes('word') || /\.docx?$/i.test(d.filename)) return 'DOC';
  if (m.includes('sheet') || /\.xlsx?$/i.test(d.filename)) return 'XLS';
  const ext = d.filename.includes('.') ? d.filename.split('.').pop() : '';
  return ext ? ext.toUpperCase() : 'FILE';
};

const sortCategories = (cats: string[]): string[] =>
  [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

const DocumentGridCard: React.FC<{ document: DocumentFile; onClick: () => void }> = ({ document, onClick }) => {
  const category = docCategory(document);
  return (
    <div
      onClick={onClick}
      className="group relative bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-primary/30 shadow-lg overflow-hidden"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-all shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="font-black truncate text-sm tracking-tight text-slate-800 dark:text-white" title={document.filename}>{document.filename}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {friendlyType(document)} • {new Date(document.uploadDate).toLocaleDateString()} • {Math.max(1, Math.round((document.fileSize || 0) / 1024))} KB
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter rounded-md ${catColor(category)}`}>
          {category}
        </span>
        <div className="flex items-center gap-2">
          {document.needsReview && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600" title="Flagged for clinician review">
              <AlertCircle size={10} /> REVIEW
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-500">
            <Shield size={10} /> SECURE
          </span>
        </div>
      </div>
    </div>
  );
};

const ClientDocumentsGrid: React.FC<ClientDocumentsGridProps> = ({ client, initialDocuments, onDocumentsChanged }) => {
  const [documents, setDocuments] = useState<DocumentFile[]>(initialDocuments || []);
  const [filter, setFilter] = useState<string>('All');
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transmissionLogs, setTransmissionLogs] = useState<string[]>([]);
  const [uplinkStatus, setUplinkStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [scanFlow, setScanFlow] = useState<ScanFlow>({ stage: 'closed' });

  const { user } = useAuth();

  useEffect(() => {
    const check = async () => {
      const res = await checkSupabaseConnection();
      setUplinkStatus(res.status === 'healthy' ? 'connected' : 'error');
    };
    check();
  }, []);

  useEffect(() => {
    if (initialDocuments) setDocuments(initialDocuments);
  }, [initialDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!client || !user) return;
    setIsUploading(true);
    setTransmissionLogs(['Connecting to storage...']);

    for (const file of acceptedFiles) {
      try {
        setTransmissionLogs(prev => [...prev, `Uploading: ${file.name}`]);
        const savedDoc = await saveDocumentFile({ clientId: client.id } as any, file, user?.name);
        setTransmissionLogs(prev => [...prev, `Upload complete: ${savedDoc.id}`]);
        setDocuments(prev => [savedDoc, ...prev]);
      } catch (error: any) {
        setTransmissionLogs(prev => [...prev, `Upload failed: ${error.message}`]);
        break;
      }
    }

    setTimeout(() => {
      setIsUploading(false);
      setTransmissionLogs([]);
    }, 2000);
  }, [client, user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isUploading,
    multiple: true,
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {},
  });

  const docs = documents || [];

  // Real categories actually present, in display order.
  const categories = useMemo(() => sortCategories(Array.from(new Set(docs.map(docCategory)))), [docs]);
  const countByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of docs) m[docCategory(d)] = (m[docCategory(d)] || 0) + 1;
    return m;
  }, [docs]);

  const filteredDocuments = useMemo(
    () => (filter === 'All' ? docs : docs.filter(d => docCategory(d) === filter)),
    [docs, filter],
  );

  // Group the (filtered) docs by category for the file-cabinet layout.
  const groups = useMemo(() => {
    const present = sortCategories(Array.from(new Set(filteredDocuments.map(docCategory))));
    return present.map(cat => ({ cat, items: filteredDocuments.filter(d => docCategory(d) === cat) }));
  }, [filteredDocuments]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h3 className="text-2xl font-black tracking-tighter">Documents</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${uplinkStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            Storage: {uplinkStatus === 'connected' ? 'Connected' : 'Offline'} • {docs.length} file{docs.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setScanFlow({ stage: 'picker' })}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ScanLine size={16} /> Scan Document
          </button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold p-2 rounded-xl focus:ring-0 outline-none"
          >
            <option value="All">All Categories ({docs.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c} ({countByCategory[c]})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload ingestion node */}
      <div
        {...getRootProps()}
        className={`relative min-h-[120px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden ${isDragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-slate-300 dark:border-white/10 hover:border-primary/40'}`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="p-4 w-full h-full bg-slate-900/80 backdrop-blur-md absolute inset-0 z-20 flex flex-col justify-center">
            <div className="space-y-1">
              {transmissionLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-[9px] font-mono text-primary">
                  <Zap size={8} className="animate-pulse" /> {log}
                </div>
              ))}
            </div>
            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-aurora" style={{ width: '100%', backgroundSize: '200% 200%' }}></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><UploadCloud size={26} /></div>
            <span className="text-[11px] font-black uppercase tracking-widest">Drag &amp; drop, or click to upload</span>
          </div>
        )}
      </div>

      {/* File cabinet: grouped sections by real category */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-widest">
          {docs.length === 0 ? 'No documents yet.' : 'No documents in this category.'}
        </div>
      ) : (
        groups.map(({ cat, items }) => (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={15} className="text-slate-400" />
              <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${catColor(cat)}`}>{cat}</span>
              <span className="text-[10px] font-bold text-slate-400">{items.length} file{items.length === 1 ? '' : 's'}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(doc => (
                <DocumentGridCard key={doc.id} document={doc} onClick={() => setSelectedDocument(doc)} />
              ))}
            </div>
          </div>
        ))
      )}

      {selectedDocument && (
        <Modal isOpen={!!selectedDocument} onClose={() => setSelectedDocument(null)} maxWidth="max-w-6xl">
          <div className="h-[80vh]">
            <DocumentViewer
              document={selectedDocument}
              documentsInFolder={filteredDocuments}
              onNavigate={() => {}}
            />
          </div>
        </Modal>
      )}

      <ScannerPickerModal
        isOpen={scanFlow.stage === 'picker'}
        onClose={() => setScanFlow({ stage: 'closed' })}
        onScanComplete={(base64, mimeType) =>
          setScanFlow({ stage: 'upload', initialImage: { base64, mimeType: mimeType as SupportedMime } })
        }
        onCameraFallback={() => setScanFlow({ stage: 'upload' })}
      />

      {scanFlow.stage === 'upload' && (
        <MobileDocumentUpload
          clientId={client.id}
          initialImage={scanFlow.initialImage}
          onComplete={() => {
            onDocumentsChanged?.();
            setScanFlow({ stage: 'closed' });
          }}
          onClose={() => setScanFlow({ stage: 'closed' })}
        />
      )}
    </div>
  );
};

export default ClientDocumentsGrid;
