/**
 * scannerClient.ts — FlowHub Bridge SDK
 *
 * Single file, zero dependencies. Drop into any React/Vite app.
 *
 * Provides progressive transport fallback:
 *   1. Appliance bridge   → https://flowhub.local:8585  (preferred)
 *   2. Local bridge       → https://localhost:8585       (fallback)
 *
 * USAGE:
 *
 *   import { ScannerClient } from "../services/scannerClient";
 *
 *   const client = new ScannerClient();
 *   const { available, scanners } = await client.discover();
 *   if (available) {
 *     const result = await client.scan({ scannerId: scanners[0].id });
 *     // result.imageDataUrl is "data:image/jpeg;base64,..." ready for <img src=...>
 *   }
 *
 * REACT HOOK USAGE (uncomment block at bottom):
 *
 *   const { scanners, isReady, error, scan } = useScanner();
 *   return scanners.map(s => <button onClick={() => scan(s.id)}>{s.name}</button>);
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScannerProtocol = "twain" | "eSCL" | "twainDirect";

export interface Scanner {
  id: string;
  name: string;
  protocol: ScannerProtocol;
  available: boolean;
  ip?: string;
  twainName?: string;
}

export interface ScanOptions {
  scannerId: string;
  resolution?: number;          // default 300
  colorMode?: "color" | "grayscale" | "blackwhite"; // default "color"
  format?: "jpeg" | "pdf";       // default "jpeg"
  duplex?: boolean;              // default false
}

export interface ScanResult {
  success: true;
  imageBase64: string;
  imageDataUrl: string;          // ready for <img src={...}>
  mimeType: string;
  protocol: ScannerProtocol;
  durationMs: number;
  pageCount?: number;
}

export interface DiscoverResult {
  available: boolean;
  scanners: Scanner[];
  bridgeUrl: string | null;
  bridgeVersion: string | null;
  error: string | null;
}

export interface BridgeHealth {
  status: string;
  version: string;
  bridgeId: string;
  machine: string;
  ip: string;
  platform: string;
  mode: "desktop" | "appliance";
  twainClassic: { available: boolean; sources: string[] };
  twainDirect: { available: boolean; scanners: number };
  escl: { configured: number };
}

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_BRIDGE_CANDIDATES = [
  "https://flowhub.local:8585",
  "https://localhost:8585",
];

const HEALTH_PROBE_TIMEOUT_MS = 3000;
const SCANNERS_TIMEOUT_MS = 30000;
const SCAN_TIMEOUT_MS = 120_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms: number = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeBridge(url: string): Promise<BridgeHealth | null> {
  try {
    const res = await fetchWithTimeout(`${url}/health`, {}, HEALTH_PROBE_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    return data as BridgeHealth;
  } catch {
    return null;
  }
}

// ─── ScannerClient ──────────────────────────────────────────────────────────

export class ScannerClient {
  private bridgeUrl: string | null = null;
  private bridgeUrlPromise: Promise<string | null> | null = null;
  private candidates: string[];

  constructor(opts: { bridgeCandidates?: string[] } = {}) {
    this.candidates = opts.bridgeCandidates ?? DEFAULT_BRIDGE_CANDIDATES;
  }

  /**
   * Find a working bridge by probing /health on each candidate.
   * Result is cached for the lifetime of this client instance.
   * Returns null if no bridge is reachable.
   */
  async findBridge(): Promise<string | null> {
    if (this.bridgeUrl) return this.bridgeUrl;
    if (this.bridgeUrlPromise) return this.bridgeUrlPromise;

    this.bridgeUrlPromise = (async () => {
      for (const candidate of this.candidates) {
        const health = await probeBridge(candidate);
        if (health) {
          this.bridgeUrl = candidate;
          return candidate;
        }
      }
      this.bridgeUrlPromise = null;
      return null;
    })();

    return this.bridgeUrlPromise;
  }

  /**
   * Discover available scanners. Never throws.
   * Returns { available, scanners, bridgeUrl, error }.
   */
  async discover(): Promise<DiscoverResult> {
    const bridgeUrl = await this.findBridge();

    if (!bridgeUrl) {
      return {
        available: false,
        scanners: [],
        bridgeUrl: null,
        bridgeVersion: null,
        error:
          "FlowHub Bridge not reachable. Is flowhub_bridge.py running on this machine?",
      };
    }

    try {
      const health = await probeBridge(bridgeUrl);
      const res = await fetchWithTimeout(
        `${bridgeUrl}/api/scanners`,
        {},
        SCANNERS_TIMEOUT_MS
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[scannerClient] /api/scanners returned non-200:', res.status, body);
        return {
          available: false,
          scanners: [],
          bridgeUrl,
          bridgeVersion: health?.version ?? null,
          error: `Bridge returned HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const rawScanners = data.scanners ?? data ?? [];

      const scanners: Scanner[] = (Array.isArray(rawScanners) ? rawScanners : []).map(
        (s: any) => ({
          id: s.id ?? s.scanner_id ?? s.name,
          name: s.name ?? s.display_name ?? s.id,
          protocol: (s.protocol ?? "twain") as ScannerProtocol,
          available: s.available !== false,
          ip: s.ip,
          twainName: s.twain_name ?? s.twainName,
        })
      );

      const available = scanners.length > 0;
      const error = scanners.length === 0 ? "No scanners detected" : null;
      console.log('[scannerClient] discover() result:', {
        bridgeUrl, available, scannersCount: scanners.length, error,
        scanners: scanners.map(s => ({
          id: s.id, available: s.available, protocol: s.protocol
        }))
      });
      return {
        available,
        scanners,
        bridgeUrl,
        bridgeVersion: health?.version ?? null,
        error,
      };
    } catch (err: any) {
      console.error('[scannerClient] /api/scanners fetch failed:', err);
      return {
        available: false,
        scanners: [],
        bridgeUrl,
        bridgeVersion: null,
        error: err?.message ?? "Discovery failed",
      };
    }
  }

  /**
   * Trigger a scan. Throws on failure with a clear error message.
   * Returns a ScanResult with imageDataUrl ready for <img src={...}>.
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const bridgeUrl = await this.findBridge();
    if (!bridgeUrl) {
      throw new Error(
        "FlowHub Bridge not reachable. Is flowhub_bridge.py running on this machine?"
      );
    }

    const body = {
      scanner_id: options.scannerId,
      resolution: options.resolution ?? 300,
      color_mode: options.colorMode ?? "color",
      format: options.format ?? "jpeg",
      duplex: options.duplex ?? false,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    let r: Response;
    try {
      r = await fetch(`${bridgeUrl}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      throw new Error(`Scan request failed: ${e?.message ?? e}`);
    }
    clearTimeout(timer);

    const j = await r.json().catch(() => ({} as any));

    if (!r.ok || !j.success) {
      const err = j.error ?? `Scan failed (HTTP ${r.status})`;
      throw new Error(err);
    }

    const mime: string = j.mime_type ?? "image/jpeg";
    const b64: string = j.image_base64 ?? "";

    return {
      success: true,
      imageBase64: b64,
      imageDataUrl: `data:${mime};base64,${b64}`,
      mimeType: mime,
      protocol: j.protocol,
      durationMs: j.duration_ms ?? 0,
      pageCount: j.page_count,
    };
  }
}

// ─── React Hook (optional, only if React is in the host app) ────────────────
// Uncomment if you want the hook. Requires React 16.8+.

/*
import { useCallback, useEffect, useState } from "react";

export interface UseScannerResult {
  isReady: boolean;
  isScanning: boolean;
  scanners: Scanner[];
  error: string | null;
  bridgeUrl: string | null;
  scan: (scannerId: string, opts?: Partial<ScanOptions>) => Promise<ScanResult>;
  refresh: () => Promise<void>;
}

const sharedClient = new ScannerClient();

export function useScanner(): UseScannerResult {
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await sharedClient.discover();
    setScanners(result.scanners);
    setBridgeUrl(result.bridgeUrl);
    setIsReady(result.available);
    if (!result.available && result.error) setError(result.error);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const scan = useCallback(
    async (scannerId: string, opts: Partial<ScanOptions> = {}) => {
      setIsScanning(true);
      setError(null);
      try {
        return await sharedClient.scan({ scannerId, ...opts });
      } catch (e: any) {
        setError(e?.message ?? "Scan failed");
        throw e;
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  return { isReady, isScanning, scanners, error, bridgeUrl, scan, refresh };
}
*/

// ─── Default export for convenience ─────────────────────────────────────────

export default ScannerClient;
