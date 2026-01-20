import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Client, DocumentFile, ClientFolderType, ComplianceStatus } from '../../types';
import { FileText, Filter, X, UploadCloud, Download, Trash2, CheckSquare, Loader2, AlertCircle, CheckCircle, Sparkles, Zap, Shield, HardDrive } from 'lucide-react';
import Card from '../ui/Card';
import DocumentViewer from '../documents/DocumentViewer';
import Modal from '../ui/Modal';
import SmartNoteImporter from '../notes/SmartNoteImporter';
import { useAuth } from '../../contexts/AuthContext';
import { getDocumentFilesForClient, saveDocumentFile, checkSupabaseConnection } from '../../services/api';

interface ClientDocumentsGridProps {
  client: Client;
  initialDocuments: DocumentFile[];
}

const getFileTypeColor = (type: ClientFolderType) => {
    const colors: Record<ClientFolderType, string> = {
        'Intake': 'bg-blue-100 text-blue-800', 'Progress': 'bg-green-100 text-green-800',
        'Compliance': 'bg-yellow-100 text-yellow-800', 'Financial': 'bg-teal-100 text-teal-800',
        'Completion': 'bg-indigo-100 text-indigo-800', 'DMV': 'bg-orange-100 text-orange-800',
        'Insurance': 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
};

const DocumentGridCard: React.FC<{ document: DocumentFile; onClick: () => void }> = ({ document, onClick }) => (
    <div 
        onClick={onClick}
        className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 hover:border-[#FFB800]/30 shadow-xl overflow-hidden"
    >
        {/* Solaris Glow Effect */}
        <div className="absolute -right-4 -top-4 w-12 h-12 bg-[#FFB800]/10 rounded-full blur-2xl group-hover:bg-[#FFB800]/20 transition-all"></div>
        
        <div className="flex items-center gap-4">
            <div className="p-3 bg-[#FFB800]/10 rounded-xl group-hover:bg-[#FFB800]/20 transition-all">
                <FileText className="w-6 h-6 text-[#FFB800]" />
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="font-black truncate text-sm tracking-tight text-slate-800 dark:text-white">{document.filename}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {new Date(document.uploadDate).toLocaleDateString()} • {(document.fileSize / 1024).toFixed(0)}KB
                </p>
            </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter rounded-md ${getFileTypeColor(document.extractedData?.suggestedSubfolder || 'Intake')}`}>
                {document.extractedData?.suggestedSubfolder || 'Intake'}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-500">
                <Shield size={10} /> SECURE
            </div>
        </div>
    </div>
);

const ClientDocumentsGrid: React.FC<ClientDocumentsGridProps> = ({ client, initialDocuments }) => {
    // FIX: Default to empty array to prevent mapping over undefined.
    const [documents, setDocuments] = useState<DocumentFile[]>(initialDocuments || []);
    const [filter, setFilter] = useState<ClientFolderType | 'All'>('All');
    const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [transmissionLogs, setTransmissionLogs] = useState<string[]>([]);
    const [uplinkStatus, setUplinkStatus] = useState<'connected' | 'error' | 'checking'>('checking');
    
    const { user } = useAuth();

    useEffect(() => {
        const check = async () => {
            const res = await checkSupabaseConnection();
            setUplinkStatus(res.status === 'healthy' ? 'connected' : 'error');
        };
        check();
    }, []);

    // Sync state if initialDocuments changes
    useEffect(() => {
        if (initialDocuments) setDocuments(initialDocuments);
    }, [initialDocuments]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!client || !user) return;
        setIsUploading(true);
        setTransmissionLogs(['UPLINK_STABLE: PDS_VAULT_LEXINGTON']);

        for (const file of acceptedFiles) {
            try {
                setTransmissionLogs(prev => [...prev, `HANDSHAKE: ${file.name}`]);
                
                const savedDoc = await saveDocumentFile(
                    { clientId: client.id } as any, 
                    file
                );
                
                setTransmissionLogs(prev => [...prev, `NEURAL_INGESTION_COMPLETE: ${savedDoc.id}`]);
                setDocuments(prev => [savedDoc, ...prev]);
            } catch (error: any) {
                setTransmissionLogs(prev => [...prev, `TRANSMISSION_FAILURE: ${error.message}`]);
                break;
            }
        }
        
        setTimeout(() => {
            setIsUploading(false);
            setTransmissionLogs([]);
        }, 2000);
    }, [client, user]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: isUploading });

    const filteredDocuments = useMemo(() => {
        const docs = documents || [];
        if (filter === 'All') return docs;
        return docs.filter(d => d.extractedData?.suggestedSubfolder === filter);
    }, [documents, filter]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-black tracking-tighter">Neural Vault</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${uplinkStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        Uplink: {uplinkStatus === 'connected' ? 'PDS LEXINGTON STABLE' : 'OFFLINE'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <select 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value as any)} 
                        className="bg-white/5 border border-white/10 text-xs font-bold p-2 rounded-xl focus:ring-0 outline-none"
                    >
                        <option value="All">All Categories</option>
                        <option value="Intake">Intake</option>
                        <option value="Compliance">Compliance</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Upload Ingestion Node */}
                <div 
                    {...getRootProps()} 
                    className={`relative min-h-[160px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden ${isDragActive ? 'border-[#FFB800] bg-[#FFB800]/5 scale-[0.98]' : 'border-white/10 hover:border-white/20'}`}
                >
                    <input {...getInputProps()} />
                    {isUploading ? (
                        <div className="p-4 w-full h-full bg-slate-900/80 backdrop-blur-md absolute inset-0 z-20 flex flex-col justify-center">
                            <div className="space-y-1">
                                {transmissionLogs.map((log, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[9px] font-mono text-[#FFB800]">
                                        <Zap size={8} className="animate-pulse" /> {log}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-[#FFB800] animate-aurora" style={{ width: '100%', backgroundSize: '200% 200%' }}></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-[#FFB800]/10 rounded-2xl mb-2 text-[#FFB800]">
                                <UploadCloud size={32} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ingest Document</span>
                        </>
                    )}
                </div>

                {filteredDocuments.map(doc => (
                    <DocumentGridCard 
                        key={doc.id} 
                        document={doc} 
                        onClick={() => setSelectedDocument(doc)}
                    />
                ))}
            </div>

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
        </div>
    );
};

export default ClientDocumentsGrid;