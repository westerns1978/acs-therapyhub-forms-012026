/**
 * "Request from client" — staff mints a no-login upload link for one client + one
 * requested document type (reuses CategoryPicker / config/recordCategory.ts). Calls
 * the acs-request-upload `mint` action with the staff session JWT. Shows the copyable
 * /upload/<token> link. This is the STAFF side, so it may show the client's name; the
 * public page the link opens shows no identity.
 */
import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Loader2, Send } from 'lucide-react';
import Modal from '../ui/Modal';
import CategoryPicker from '../documents/CategoryPicker';
import { isCategorizable } from '../../config/recordCategory';
import { mintClientUploadLink } from '../../services/clientUploadLink';

interface RequestUploadLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

type Phase = 'pick' | 'minting' | 'done' | 'error';

const RequestUploadLinkModal: React.FC<RequestUploadLinkModalProps> = ({ isOpen, onClose, clientId, clientName }) => {
  const [phase, setPhase] = useState<Phase>('pick');
  const [docType, setDocType] = useState('');
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [requestedLabel, setRequestedLabel] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('pick'); setDocType(''); setLink(''); setExpiresAt(null); setRequestedLabel(''); setError(''); setCopied(false);
  }, [isOpen]);

  const handleMint = async () => {
    if (!docType) return;
    setPhase('minting'); setError('');
    try {
      const res = await mintClientUploadLink({ clientId, requestedDocumentType: docType });
      // Prefer the current origin so preview/local links resolve; fall back to the
      // edge-returned URL (production acs-therapyhub.web.app).
      setLink(`${window.location.origin}/upload/${res.token}` || res.url);
      setExpiresAt(res.expiresAt);
      setRequestedLabel(res.requestedLabel);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the upload link.');
      setPhase('error');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the link and copy it manually.');
    }
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request a document from the client" maxWidth="max-w-lg">
      <div className="p-6 space-y-5">
        {(phase === 'pick' || phase === 'minting' || phase === 'error') && (
          <>
            <p className="text-sm text-slate-500">
              Choose what to ask <span className="font-semibold text-slate-700 dark:text-slate-200">{clientName}</span> to upload.
              You'll get a private link to text or send them — no sign-in needed on their end.
            </p>
            <CategoryPicker value={docType} onChange={setDocType} />
            {phase === 'error' && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
            )}
            <button
              onClick={handleMint}
              disabled={!docType || phase === 'minting'}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-focus text-white font-black text-sm rounded-2xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === 'minting' ? (<><Loader2 size={16} className="animate-spin" /> Creating link…</>) : (<><Link2 size={16} /> Create upload link</>)}
            </button>
          </>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#1F7A4D]">
              <Check size={18} /> <span className="text-sm font-bold">Link ready for {requestedLabel}</span>
            </div>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={copy}
                className="flex items-center gap-2 px-4 rounded-xl bg-primary hover:bg-primary-focus text-white text-sm font-bold transition-all shrink-0"
              >
                {copied ? (<><Check size={16} /> Copied</>) : (<><Copy size={16} /> Copy</>)}
              </button>
            </div>
            <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
              <Send size={14} className="text-primary shrink-0 mt-0.5" />
              Expires in 7 days{expiryLabel ? ` (${expiryLabel})` : ''} · text or WhatsApp it to the client · this link is private to them.
            </p>
            <p className="text-[11px] text-slate-400">Creating a new link for this client revokes this one.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RequestUploadLinkModal;
