/**
 * ACS TherapyHub — ClinicalMarkdown Renderer
 *
 * Renders Gemini-generated markdown inside the "AI Synthesized Intelligence"
 * panel on a client record. The panel sits on a light slate-50 background in
 * light mode, so all colors below are tuned for dark-on-light readability with
 * dark-mode variants applied via Tailwind.
 */

import React, { useMemo } from "react";

interface ClinicalMarkdownProps {
  content: string;
  compact?: boolean; // Tighter spacing for panel sidebars
  className?: string;
}

interface ParsedBlock {
  type: "h1" | "h2" | "h3" | "h4" | "paragraph" | "bullet" | "numbered" |
        "risk_critical" | "risk_high" | "risk_elevated" | "risk_moderate" | "risk_low" |
        "action" | "divider" | "keyvalue";
  content: string;
  index?: number;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseContent(raw: string): ParsedBlock[] {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n");

  const blocks: ParsedBlock[] = [];
  let numberedIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Risk tier badges — detect "RISK TIER: CRITICAL" patterns
    if (/\*?\*?risk\s+tier\s*[:—]\s*(.+)\*?\*?/i.test(line)) {
      const tier = line.replace(/.*risk\s+tier\s*[:—]\s*/i, "").replace(/\*+/g, "").trim().toUpperCase();
      const type = tier.includes("CRITICAL") ? "risk_critical"
                 : tier.includes("HIGH")     ? "risk_high"
                 : tier.includes("ELEVATED") ? "risk_elevated"
                 : tier.includes("MODERATE") ? "risk_moderate"
                 : "risk_low";
      blocks.push({ type, content: `Risk Tier: ${tier}` });
      continue;
    }

    // Horizontal rules
    if (/^---+$/.test(line)) {
      blocks.push({ type: "divider", content: "" });
      continue;
    }

    // Headers
    if (line.startsWith("#### ")) {
      blocks.push({ type: "h4", content: line.slice(5) });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "h3", content: line.slice(4) });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", content: line.slice(3) });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", content: line.slice(2) });

    // Bullets
    } else if (/^[\*\-•]\s+/.test(line)) {
      blocks.push({ type: "bullet", content: line.replace(/^[\*\-•]\s+/, "") });
      numberedIndex = 0;

    // Numbered lists
    } else if (/^\d+\.\s+/.test(line)) {
      numberedIndex++;
      blocks.push({ type: "numbered", content: line.replace(/^\d+\.\s+/, ""), index: numberedIndex });

    // Action items — lines starting with action keywords
    } else if (/^(next action|immediate action|action required|recommend|priority)[:\s]/i.test(line)) {
      blocks.push({ type: "action", content: line });

    // Key-value pairs — "Label: Value" short lines (e.g. "Observation: …")
    } else if (/^[A-Z][^:]{2,30}:\s+\S/.test(line) && line.length < 200) {
      blocks.push({ type: "keyvalue", content: line });

    // Regular paragraph
    } else {
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "paragraph") {
        prev.content += " " + line;
      } else {
        blocks.push({ type: "paragraph", content: line });
      }
      numberedIndex = 0;
    }
  }

  return blocks;
}

// ─── Inline Formatter (bold, italic within text) ──────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-bold text-slate-900 dark:text-white">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic text-slate-700 dark:text-slate-200">{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Block Renderers ──────────────────────────────────────────────────────────

const RISK_STYLES = {
  risk_critical: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-700", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", pulse: true },
  risk_high:     { bg: "bg-red-50 dark:bg-red-900/30", border: "border-red-200 dark:border-red-700", text: "text-red-700 dark:text-red-300", dot: "bg-red-400", pulse: true },
  risk_elevated: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-700", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-400", pulse: false },
  risk_moderate: { bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-700", text: "text-yellow-700 dark:text-yellow-300", dot: "bg-yellow-400", pulse: false },
  risk_low:      { bg: "bg-emerald-50 dark:bg-green-950/40", border: "border-emerald-200 dark:border-green-700", text: "text-emerald-700 dark:text-green-400", dot: "bg-emerald-500", pulse: false },
};

function RiskBadge({ type, content }: { type: keyof typeof RISK_STYLES; content: string }) {
  const s = RISK_STYLES[type];
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${s.bg} ${s.border} mb-3`}>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
      <span className={`text-sm font-bold tracking-wide uppercase ${s.text}`}>{content}</span>
    </div>
  );
}

function renderBlock(block: ParsedBlock, idx: number, compact: boolean): React.ReactNode {
  const key = `block-${idx}`;

  switch (block.type) {
    case "risk_critical":
    case "risk_high":
    case "risk_elevated":
    case "risk_moderate":
    case "risk_low":
      return <RiskBadge key={key} type={block.type} content={block.content} />;

    case "h1":
      return <h1 key={key} className="text-xl font-bold text-slate-900 dark:text-white mt-5 mb-2 tracking-tight">{renderInline(block.content)}</h1>;
    case "h2":
      return <h2 key={key} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2 uppercase tracking-widest text-xs border-b border-gray-200 dark:border-gray-700 pb-1">{renderInline(block.content)}</h2>;
    case "h3":
      return <h3 key={key} className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1">{renderInline(block.content)}</h3>;
    case "h4":
      return <h4 key={key} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2 mb-1">{renderInline(block.content)}</h4>;

    case "bullet":
      return (
        <div key={key} className="flex items-start gap-2.5 mb-2">
          <span className="text-primary mt-1.5 flex-shrink-0 text-xs">▸</span>
          <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">{renderInline(block.content)}</span>
        </div>
      );

    case "numbered":
      // Each numbered item is treated as a section — divider underneath for
      // visual separation of "1. Client Acquisition & Intake" etc.
      return (
        <div key={key} className="pb-4 mb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:mb-0 last:pb-0">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {block.index}
            </span>
            <span className="text-primary font-bold text-base leading-snug">{renderInline(block.content)}</span>
          </div>
        </div>
      );

    case "action":
      return (
        <div key={key} className={`flex items-start gap-2.5 ${compact ? "my-2" : "my-3"} px-3 py-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg`}>
          <span className="text-primary flex-shrink-0 mt-0.5 font-bold">→</span>
          <span className="text-red-800 dark:text-red-200 text-sm font-medium leading-relaxed">{renderInline(block.content)}</span>
        </div>
      );

    case "keyvalue": {
      const colonIdx = block.content.indexOf(":");
      const label = block.content.slice(0, colonIdx).trim();
      const value = block.content.slice(colonIdx + 1).trim();
      return (
        <div key={key} className="mb-2 text-sm leading-relaxed">
          <span className="font-semibold text-primary">{label}:</span>{' '}
          <span className="text-gray-800 dark:text-gray-200">{renderInline(value)}</span>
        </div>
      );
    }

    case "divider":
      return <hr key={key} className="border-gray-200 dark:border-gray-700 my-4" />;

    case "paragraph":
    default:
      return (
        <p key={key} className={`text-gray-800 dark:text-gray-200 text-sm leading-relaxed ${compact ? "mb-2" : "mb-3"}`}>
          {renderInline(block.content)}
        </p>
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClinicalMarkdown({ content, compact = false, className = "" }: ClinicalMarkdownProps) {
  const blocks = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`clinical-markdown ${compact ? "space-y-0" : "space-y-0.5"} ${className}`}>
      {blocks.map((block, idx) => renderBlock(block, idx, compact))}
    </div>
  );
}
