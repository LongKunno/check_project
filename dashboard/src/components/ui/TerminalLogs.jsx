import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, ChevronDown, ChevronRight, Cpu, FileCode2, Loader2 } from 'lucide-react';

// --------------- Helpers ---------------

// Phát hiện xem dòng log có phải tiêu đề của một bước [X/5] hay [X.Y/5] hay không
const STEP_REGEX = /^\[(\d+(?:\.\d+)?\/\d+)\]/;

// Tô màu inline dựa trên nội dung dòng log
function colorizeLog(text) {
  const parts = [];
  let remaining = text;

  // Mapping từ keyword → CSS class
  const patterns = [
    // File paths (src/..., path/to/file.py)
    { re: /((?:[\w.\-]+\/)+[\w.\-]+\.\w+)/g, cls: 'text-cyan-400 font-semibold' },
    // False Positive removal
    { re: /(False Positive|FP|✨|🛡️)/g, cls: 'text-emerald-400 font-bold' },
    // Error / warning keywords
    { re: /(\bError\b|\bFailed\b|❌|⚠️|🚨)/g, cls: 'text-rose-400 font-bold' },
    // Success keywords
    { re: /(\bCompleted\b|✅|done|COMPLETED)/g, cls: 'text-emerald-300 font-bold' },
    // Numbers like violations, scores
    { re: /\b(\d+)\s*(vi phạm|violations?|files?|batches?|LOC)\b/gi, cls: 'text-amber-300 font-semibold' },
    // Step labels [X/5]
    { re: /(\[\d+[\.\-]?\d*\/\d+\])/g, cls: 'text-violet-300 font-extrabold' },
    // Brackets like CUSTOM, AI_REASONING
    { re: /\[(Custom|Core|AI|AI_REASONING|AI_ONLY)\]/g, cls: 'text-sky-300 font-semibold' },
  ];

  // Apply first match greedily, build array of spans
  const combined = patterns.map(p => p.re.source).join('|');
  const globalRe = new RegExp(combined, 'gi');

  let lastIndex = 0;
  let i = 0;
  const allMatches = [...remaining.matchAll(globalRe)];
  
  for (const match of allMatches) {
    if (match.index > lastIndex) {
      parts.push(<span key={i++}>{remaining.slice(lastIndex, match.index)}</span>);
    }
    // Find which pattern matched
    let matchedCls = 'text-slate-200';
    for (const p of patterns) {
      if (new RegExp(p.re.source, 'i').test(match[0])) {
        matchedCls = p.cls;
        break;
      }
    }
    parts.push(<span key={i++} className={matchedCls}>{match[0]}</span>);
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
    <div className={`mb-3 rounded-xl border transition-colors duration-300 ${
      isActive 
        ? 'border-violet-500/40 bg-violet-500/5' 
        : 'border-white/5 bg-black/20'
    }`}>
      {/* Accordion Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left group"
      >
        <div className={`shrink-0 transition-colors ${isActive ? 'text-violet-400' : 'text-slate-500'}`}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
        <span className={`font-extrabold text-sm tracking-wide uppercase ${
          isActive ? 'text-violet-300' : 'text-slate-400'
        }`}>
          {stepLabel}
        </span>
        {isActive && (
          <Loader2 size={13} className="text-violet-400 animate-spin ml-auto shrink-0" />
        )}
        {!isActive && (
          <span className="ml-auto text-xs text-slate-600 font-medium shrink-0">{lines.length} lines</span>
        )}
      </button>

      {/* Accordion Body */}
      {open && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="mb-1 text-sm leading-relaxed border-l border-emerald-500/20 pl-3 font-mono"
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
  const [currentFile, setCurrentFile] = useState(null); // For Status Bar
  const logsEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const processLine = useCallback((rawLine) => {
    // Filter out PROGRESS lines → only update StatusBar, don't store in terminal
    if (rawLine.startsWith('[PROGRESS]')) {
      const filePart = rawLine.replace('[PROGRESS]', '').trim();
      setCurrentFile(filePart);
      return; 
    }

    setGroups(prev => {
      const isStepHeader = STEP_REGEX.test(rawLine);

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
      setCurrentFile(null);
      setActiveGroupIdx(0);
      
      eventSource = new EventSource(`/api/audit/jobs/${jobId}/logs`);
      eventSource.onmessage = (e) => {
        if (e.data === '[END_OF_STREAM]') {
          eventSource.close();
          setCurrentFile(null);
          return;
        }
        processLine(e.data);
      };
      eventSource.onerror = () => {};
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
      style={{ marginBottom: '2rem' }}
      className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
    >
      {/* ── Terminal Header ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-black/60 border-b border-white/10 backdrop-blur-xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500/70" />
          <div className="w-3 h-3 rounded-full bg-amber-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        </div>
        <Zap size={14} className="text-violet-400" />
        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">CORE AUDITOR LOGS</span>
        <div className="ml-auto flex items-center gap-2">
          <Loader2 size={13} className="text-violet-400 animate-spin" />
          <span className="text-violet-400 text-xs font-bold animate-pulse">RUNNING</span>
        </div>
      </div>

      {/* ── Status Bar — Progress Ticker ── */}
      {currentFile && (
        <div className="flex items-center gap-3 px-5 py-2 bg-cyan-500/5 border-b border-cyan-500/20">
          <FileCode2 size={14} className="text-cyan-400 shrink-0 animate-pulse" />
          <span className="text-cyan-300 text-xs font-mono font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
            {currentFile}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-cyan-500 text-[10px] font-bold uppercase tracking-widest">Processing</span>
          </div>
        </div>
      )}

      {/* ── Log Groups (Accordion) ── */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto p-4"
        style={{
          height: '60vh',
          minHeight: '420px',
          background: 'rgba(2, 6, 23, 0.92)',
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          fontSize: '0.78rem',
        }}
      >
        {groups.length === 0 && (
          <div className="flex items-center gap-3 text-slate-500 p-6 text-sm">
            <Cpu size={18} className="animate-pulse text-violet-400" />
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
