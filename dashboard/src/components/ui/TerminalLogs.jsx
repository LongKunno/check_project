import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileCode2,
  Loader2,
} from "lucide-react";

// --------------- Helpers ---------------

// Phát hiện xem dòng log có phải tiêu đề của một bước [X/5] hay [X.Y/5] hay không
const STEP_REGEX = /^\[(\d+(?:\.\d+)?\/\d+)\]/;
const BATCH_PROGRESS_REGEX = /batch\s+(\d+)\s*\/\s*(\d+)/i;

function parseProgressLine(rawLine) {
  const text = rawLine.replace("[PROGRESS]", "").trim();
  const batchMatch = text.match(BATCH_PROGRESS_REGEX);

  if (batchMatch) {
    const current = Number.parseInt(batchMatch[1], 10);
    const total = Number.parseInt(batchMatch[2], 10);
    let label = "Batch Progress";

    if (/validation/i.test(text)) {
      label = "Validation";
    } else if (/deep audit/i.test(text)) {
      label = "Deep Audit";
    }

    return {
      kind: "batch",
      headline: `${label} ${current}/${total}`,
      detail: text,
      batch: {
        current,
        total,
        percent: total > 0 ? Math.round((current / total) * 100) : 0,
      },
    };
  }

  if (/^AI Audit:/i.test(text)) {
    return {
      kind: "detail",
      headline: "Deep Audit File",
      detail: text.replace(/^AI Audit:\s*/i, "").trim(),
    };
  }

  if (/^Scanning:/i.test(text)) {
    return {
      kind: "detail",
      headline: "Scanning",
      detail: text.replace(/^Scanning:\s*/i, "").trim(),
    };
  }

  return {
    kind: "detail",
    headline: "Processing",
    detail: text,
  };
}

// Tô màu inline dựa trên nội dung dòng log
function colorizeLog(text) {
  const parts = [];
  let remaining = text;

  // Mapping từ keyword → CSS class
  const patterns = [
    // File paths (src/..., path/to/file.py)
    {
      re: /((?:[\w.\-]+\/)+[\w.\-]+\.\w+)/g,
      cls: "text-cyan-700 font-semibold",
    },
    // False Positive removal
    { re: /(False Positive|FP|✨|🛡️)/g, cls: "text-emerald-700 font-bold" },
    // Error / warning keywords
    { re: /(\bError\b|\bFailed\b|❌|⚠️|🚨)/g, cls: "text-rose-600 font-bold" },
    // Success keywords
    {
      re: /(\bCompleted\b|✅|done|COMPLETED)/g,
      cls: "text-emerald-600 font-bold",
    },
    // Numbers like violations, scores
    {
      re: /\b(\d+)\s*(vi phạm|violations?|files?|batches?|LOC)\b/gi,
      cls: "text-amber-700 font-semibold",
    },
    // Step labels [X/5]
    { re: /(\[\d+[\.\-]?\d*\/\d+\])/g, cls: "text-violet-600 font-extrabold" },
    // Brackets like CUSTOM, AI_REASONING
    {
      re: /\[(Custom|Core|AI|AI_REASONING|AI_ONLY)\]/g,
      cls: "text-sky-600 font-semibold",
    },
  ];

  // Apply first match greedily, build array of spans
  const combined = patterns.map((p) => p.re.source).join("|");
  const globalRe = new RegExp(combined, "gi");

  let lastIndex = 0;
  let i = 0;
  const allMatches = [...remaining.matchAll(globalRe)];

  for (const match of allMatches) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={i++}>{remaining.slice(lastIndex, match.index)}</span>,
      );
    }
    // Find which pattern matched
    let matchedCls = "text-slate-700";
    for (const p of patterns) {
      if (new RegExp(p.re.source, "i").test(match[0])) {
        matchedCls = p.cls;
        break;
      }
    }
    parts.push(
      <span key={i++} className={matchedCls}>
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(<span key={i++}>{remaining.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
}

// --------------- Sub-components ---------------

function StepGroup({ stepLabel, lines, isActive, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open when this group becomes active
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div
      className={`mb-3 rounded-xl border transition-colors duration-300 ${isActive
        ? "border-violet-300 bg-violet-50"
        : "border-slate-200 bg-slate-50"
        }`}
    >
      {/* Accordion Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left group"
      >
        <div
          className={`shrink-0 transition-colors ${isActive ? "text-violet-600" : "text-slate-400"}`}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
        <span
          className={`font-extrabold text-sm tracking-wide uppercase ${isActive ? "text-violet-600" : "text-slate-500"
            }`}
        >
          {stepLabel}
        </span>
        {isActive && (
          <Loader2
            size={13}
            className="text-violet-600 animate-spin ml-auto shrink-0"
          />
        )}
        {!isActive && (
          <span className="ml-auto text-xs text-slate-600 font-medium shrink-0">
            {lines.length} lines
          </span>
        )}
      </button>

      {/* Accordion Body */}
      {open && (
        <div className="px-4 pb-3 border-t border-slate-200 pt-2">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="mb-1 text-sm leading-relaxed border-l border-emerald-300 pl-3 font-mono"
            >
              {colorizeLog(line)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------- Main Component ---------------

const TerminalLogs = React.memo(({ isAuditing, jobId }) => {
  // Groups: array of { label: string, lines: string[] }
  const [groups, setGroups] = useState([]);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [progressState, setProgressState] = useState(null);
  const logsEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const processLine = useCallback((rawLine) => {
    if (rawLine.startsWith("[PROGRESS]")) {
      const parsed = parseProgressLine(rawLine);
      setProgressState((prev) => {
        if (parsed.kind === "batch") {
          return parsed;
        }

        return {
          headline: parsed.headline,
          detail: parsed.detail,
          batch: prev?.batch || null,
        };
      });
      return;
    }

    const isStepHeader = STEP_REGEX.test(rawLine);
    if (isStepHeader) {
      setProgressState(null);
    }

    setGroups((prev) => {
      if (isStepHeader || prev.length === 0) {
        // Start a new group
        const newGroup = { label: rawLine, lines: [] };
        const updated = [...prev, newGroup];
        setActiveGroupIdx(updated.length - 1);
        return updated;
      }

      // Append to last group
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.lines = [...last.lines, rawLine];
      updated[updated.length - 1] = last;
      return updated;
    });
  }, []);

  useEffect(() => {
    let eventSource;
    if (isAuditing && jobId) {
      setGroups([]);
      setProgressState(null);
      setActiveGroupIdx(0);

      eventSource = new EventSource(`/api/audit/jobs/${jobId}/logs`);
      eventSource.onmessage = (e) => {
        if (e.data === "[END_OF_STREAM]") {
          eventSource.close();
          setProgressState(null);
          return;
        }
        processLine(e.data);
      };
      eventSource.onerror = () => { };
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isAuditing, jobId, processLine]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [groups]);

  if (!isAuditing) return null;

  return (
    <div
      style={{ marginBottom: "2rem" }}
      className="rounded-2xl border border-slate-200 overflow-hidden shadow-md"
    >
      {/* ── Terminal Header ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-100 border-b border-slate-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500/70" />
          <div className="w-3 h-3 rounded-full bg-amber-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        </div>
        <Zap size={14} className="text-violet-600" />
        <span className="text-slate-600 font-bold text-xs uppercase tracking-widest">
          CORE AUDITOR LOGS
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Loader2 size={13} className="text-violet-600 animate-spin" />
          <span className="text-violet-600 text-xs font-bold animate-pulse">
            RUNNING
          </span>
        </div>
      </div>

      {/* ── Status Bar — Progress Ticker ── */}
      {progressState && (
        <div className="px-5 py-3 bg-cyan-50 border-b border-cyan-200">
          <div className="flex items-start gap-3">
            <FileCode2
              size={14}
              className="text-cyan-600 shrink-0 animate-pulse mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-cyan-700 text-[10px] font-bold uppercase tracking-[0.18em]">
                  {progressState.headline}
                </span>
                {progressState.batch && (
                  <span className="text-cyan-600 text-[10px] font-bold">
                    {progressState.batch.percent}%
                  </span>
                )}
              </div>
              <div className="text-cyan-700 text-xs font-mono font-semibold overflow-hidden text-ellipsis whitespace-nowrap mt-1">
                {progressState.detail}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-600 text-[10px] font-bold uppercase tracking-widest">
                Processing
              </span>
            </div>
          </div>
          {progressState.batch && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-cyan-100 border border-cyan-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${progressState.batch.percent}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-cyan-700 font-semibold text-right">
                Batch {progressState.batch.current}/{progressState.batch.total}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Log Groups (Accordion) ── */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto p-4"
        style={{
          height: "60vh",
          minHeight: "420px",
          background: "#fafbfc",
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontSize: "0.78rem",
        }}
      >
        {groups.length === 0 && (
          <div className="flex items-center gap-3 text-slate-400 p-6 text-sm">
            <Cpu size={18} className="animate-pulse text-violet-600" />
            <span>Starting audit engine...</span>
          </div>
        )}
        {groups.map((group, idx) => (
          <StepGroup
            key={idx}
            stepLabel={group.label}
            lines={group.lines}
            isActive={idx === activeGroupIdx}
            defaultOpen={idx === activeGroupIdx}
          />
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
});

export default TerminalLogs;
