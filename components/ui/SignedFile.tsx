import React, { useEffect, useState } from 'react';
import { getSignedUrl, SIGNED_URL_TTL } from '../../services/storageService';

/**
 * Resolve a PRIVATE-bucket `file_path` to a short-lived signed URL.
 * Returns null until ready / on failure — callers render nothing rather than a broken/public link.
 */
export function useSignedUrl(filePath?: string | null, ttl = SIGNED_URL_TTL): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!filePath) { setUrl(null); return; }
    getSignedUrl(filePath, ttl).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [filePath, ttl]);
  return url;
}

/** Anchor that opens a private file via a freshly-minted signed URL (renders nothing if unavailable). */
export const SignedFileLink: React.FC<{
  filePath?: string | null; className?: string; title?: string; children: React.ReactNode;
}> = ({ filePath, className, title, children }) => {
  const url = useSignedUrl(filePath);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={title}>{children}</a>;
};

/** Iframe preview of a private file via a signed URL (empty placeholder until ready). */
export const SignedFileFrame: React.FC<{ filePath?: string | null; className?: string; title?: string }>
  = ({ filePath, className, title }) => {
  const url = useSignedUrl(filePath);
  return url ? <iframe src={url} className={className} title={title} /> : <div className={className} />;
};
