import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Client, DocumentFile } from '../../types';
import { FileText, UploadCloud, Shield, FolderOpen, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import DocumentViewer from '../documents/DocumentViewer';
import { checkSupabaseConnection } from '../../services/api';
import { recordCategoryOf, RECORD_CATEGORY_ORDER, type RecordCategory } from '../../config/recordCategory';

interface ClientDocumentsGridProps {
  client: Client;
  initialDocuments: DocumentFile[];
  /**
   * Hand a dropped file up to the shared capture flow (StaffDocumentUpload), so the
   * dropzone routes through the same classify → category → ingest path as the
   * Capture menu — nothing enters uncategorized. Owned by ClientWorkspace (P2).
   */
  onCapture?: (file: File) => void;
}

// The segmented Admin/Clinical filter. 'All' shows everything (including unmapped).
type RecordFilter = 'All' | RecordCategory;

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
      className="group relative bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-border dark:border-slate-700 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-primary/30 shadow-lg overflow-hidden"
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
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              title="A client-submitted or unverified document — needs clinician review"
            >
              <AlertCircle size={10} /> Needs review
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

const ClientDocumentsGrid: React.FC<ClientDocumentsGridProps> = ({ client, initialDocuments, onCapture }) => {
  const [documents, setDocuments] = useState<DocumentFile[]>(initialDocuments || []);
  const [filter, setFilter] = useState<RecordFilter>('All');
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [uplinkStatus, setUplinkStatus] = useState<'connected' | 'error' | 'checking'>('checking');

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

  // Dropzone is now a secondary affordance: hand the file to the shared capture flow
  // (StaffDocumentUpload via onCapture) so it goes through the same classify →
  // category → ingest path. One file at a time (the category step is per-document).
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles.length || !onCapture) return;
    onCapture(acceptedFiles[0]);
  }, [onCapture]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {},
  });

  const docs = documents || [];

  // Segmented Admin/Clinical filter, derived from the raw document_type via the P2 map.
  // 'All' keeps everything (unmapped docs live here so they are never hidden).
  const countByBucket = useMemo(() => {
    const m: Record<RecordFilter, number> = { All: docs.length, Admin: 0, Clinical: 0 };
    for (const d of docs) {
      const c = recordCategoryOf(d.documentTypeRaw);
      if (c) m[c] += 1;
    }
    return m;
  }, [docs]);

  const filteredDocuments = useMemo(
    () => (filter === 'All' ? docs : docs.filter(d => recordCategoryOf(d.documentTypeRaw) === filter)),
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
        {/* Segmented Admin / Clinical filter (P2). Fine-grained document_type stays
            visible as the per-row chip, so nothing is lost. */}
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 p-0.5" role="tablist" aria-label="Filter records by category">
          {(['All', ...RECORD_CATEGORY_ORDER] as RecordFilter[]).map(key => {
            const active = filter === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  active ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {key} ({countByBucket[key]})
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload ingestion node — a secondary affordance; the drop routes through the
          Capture category step (onCapture). */}
      <div
        {...getRootProps()}
        className={`relative min-h-[120px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden ${isDragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-slate-300 dark:border-white/10 hover:border-primary/40'}`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-3 text-slate-500">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary"><UploadCloud size={26} /></div>
          <span className="text-[11px] font-black uppercase tracking-widest">Drag &amp; drop, or click to upload</span>
        </div>
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
      {/* Scan / Photo capture modals moved up to ClientWorkspace (P2 Capture menu),
          so a single owner drives all three capture paths. */}
    </div>
  );
};

export default ClientDocumentsGrid;
