/**
 * RuleBuilder shared sub-components:
 * - Templates, JsonHighlight, Stepper, StreamingTerminal, VisualRuleConfigurator
 * Tách từ RuleBuilder.jsx (L30-429, ~400 LOC).
 */
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Lock,
  Wrench,
  Code2,
  Clock,
  Box,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

/* ─── Templates ───────────────────────────────────────────────────────── */
export const templates = [
  {
    label: "Cấm bắt ngoại lệ chung", category: "Clean Code", icon: AlertTriangle,
    color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20",
    reason: "bare except / except Exception nuốt lỗi ngầm, cực kỳ nguy hiểm.",
    prompt: "Tuyệt đối không sử dụng bare except (except:) hoặc ngoại lệ quá chung chung (except Exception:). Phải bắt rõ ngoại lệ cụ thể.",
  },
  {
    label: "Giới hạn độ dài hàm", category: "Maintainability", icon: Wrench,
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
    reason: "Hàm > 50 dòng: phức tạp, khó test, khó bảo trì.",
    prompt: "Các hàm Python không được vượt quá 50 dòng code để đảm bảo Clean Code.",
  },
  {
    label: "Ngăn chặn eval()", category: "Security", icon: Lock,
    color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20",
    reason: "Thực thi string thành code → RCE (Remote Code Execution).",
    prompt: "Tuyệt đối không sử dụng hàm eval() để thực thi code, rủi ro bảo mật nghiêm trọng (RCE).",
  },
  {
    label: "Cấm Hardcode Credentials", category: "Security", icon: Lock,
    color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20",
    reason: "API Keys, token, password không được nhúng thẳng vào mã nguồn.",
    prompt: "Ngăn chặn việc gán các token, password, secret_key cứng trong mã nguồn. Bắt buộc đọc từ biến môi trường.",
  },
];

const categoryOrder = ["Security", "Maintainability", "Clean Code"];
export const groupedTemplates = categoryOrder.reduce((acc, cat) => {
  const items = templates.filter((t) => t.category === cat);
  if (items.length) acc[cat] = items;
  return acc;
}, {});

/* ─── JSON Syntax Highlighter ─────────────────────────────────────────── */
export const JsonHighlight = ({ value }) => {
  if (!value) return null;
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const html = str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/: (true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>');

  return (
    <div
      className="w-full h-full font-mono text-[13px] leading-relaxed p-5 overflow-auto text-slate-600 whitespace-pre-wrap json-highlight"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/* ─── Stepper ──────────────────────────────────────────────────────────── */
const STEPS = [
  { num: 1, label: "Ý Tưởng", sub: "Mô tả bằng tiếng Việt" },
  { num: 2, label: "Biên Dịch", sub: "AI sinh JSON rule" },
  { num: 3, label: "Sandbox", sub: "Test & Lưu" },
];

export const Stepper = ({ current }) => (
  <div className="flex items-center justify-center gap-0 w-full max-w-2xl mx-auto">
    {STEPS.map((step, i) => {
      const done = current > step.num;
      const active = current === step.num;
      return (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 border-2 shrink-0",
                done ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : active ? "bg-gradient-to-br from-violet-600 to-purple-700 border-violet-400/50 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] scale-110"
                    : "bg-slate-50 border-slate-200 text-slate-600",
              )}
            >
              {done ? <CheckCircle2 size={18} /> : step.num}
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className={cn("text-[11px] font-black tracking-wider uppercase", done ? "text-emerald-500" : active ? "text-violet-600" : "text-slate-600")}>{step.label}</span>
              <span className="text-[9px] text-slate-600 tracking-wide hidden sm:block">{step.sub}</span>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 mx-3 mb-5 relative h-[2px] rounded-full bg-slate-50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: "0%" }}
                animate={{ width: done ? "100%" : "0%" }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/* ─── Streaming Terminal ───────────────────────────────────────────────── */
export const StreamingTerminal = ({ text, isPending, label }) => {
  const containerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isPending) { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isPending]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [text]);

  const loadingMessages = [
    "Initializing neural network...", "Parsing language features...",
    "Extracting logic constraints...", "Building AST syntax trees...",
    "Compiling regex patterns..."
  ];
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (!isPending) return;
    const msgTimer = setInterval(() => setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length), 2000);
    return () => clearInterval(msgTimer);
  }, [isPending]);

  return (
    <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-w-4xl mx-auto w-full relative">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-slate-50/30 pointer-events-none" />
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
            </div>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          )}
          <span className="text-xs font-black text-violet-700 uppercase tracking-[0.2em]">
            {label || (isPending ? "AI đang tư duy…" : "Hoàn tất")}
          </span>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
            <Clock size={11} />{elapsed}s
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-1 p-6 overflow-y-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap relative z-10 bg-white">
        {text ? (
          <span className="text-slate-700">{text}</span>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-violet-600 font-bold animate-pulse">Đang kết nối tới mô hình AI...</span>
            <span className="text-slate-500 text-xs">&gt; {loadingMessages[loadingMsgIdx]}</span>
          </div>
        )}
        {isPending && (
          <span className="inline-block w-2 h-4 bg-violet-500 ml-0.5 rounded-sm animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
        )}
      </div>
    </div>
  );
};

/* ─── Visual Rule Configurator ─────────────────────────────────────────── */
export const VisualRuleConfigurator = ({ config, onChange, readOnly = false }) => {
  if (!config) return null;

  const formatAstType = (value) => value ? value.replaceAll("_", " ") : "";

  const handleChange = (cat, subCat, idx, field, val) => {
    if (readOnly || !onChange) return;
    const clone = JSON.parse(JSON.stringify(config));
    if (cat === "ast_rules") {
      const target = clone[cat]?.[subCat];
      if (Array.isArray(target)) clone[cat][subCat][idx][field] = val;
      else if (target && typeof target === "object") clone[cat][subCat][field] = val;
    } else clone[cat][idx][field] = val;
    onChange(clone);
  };

  const astGroups = (() => {
    const astRules = config.ast_rules;
    if (Array.isArray(astRules)) {
      return astRules.length
        ? [{ type: "dangerous_functions", rules: astRules }]
        : [];
    }
    return Object.entries(astRules || {}).flatMap(([type, rawRules]) => {
      if (Array.isArray(rawRules)) {
        return rawRules.length ? [{ type, rules: rawRules }] : [];
      }
      if (rawRules && typeof rawRules === "object" && Object.keys(rawRules).length > 0) {
        return [{ type, rules: [{ ...rawRules, _astType: type }] }];
      }
      return [];
    });
  })();

  const renderCard = (item, cat, subCat, idx) => (
    <div key={`${cat}-${subCat}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 hover:border-violet-400/40 transition-all shadow-sm shrink-0 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 to-purple-600 opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="flex flex-col gap-4 shrink-0 pl-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl font-black text-slate-800 truncate">{item.id || item.name || formatAstType(item._astType)?.toUpperCase() || "UNNAMED_RULE"}</span>
          <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-md border border-violet-200 whitespace-nowrap uppercase tracking-widest shadow-sm">{item.pillar || "N/A"}</span>
        </div>

        <div className="flex items-start justify-between gap-5">
          {readOnly ? (
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lý Do (Reason)</span>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 p-3 rounded-xl min-h-[42px]">{item.reason}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lý Do (Reason)</label>
              <input
                className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 rounded-xl w-full px-4 py-2.5 transition-all "
                value={item.reason || ""}
                onChange={(e) => handleChange(cat, subCat, idx, "reason", e.target.value)}
                placeholder="Nhập giải thích cho quy tắc này..."
              />
            </div>
          )}

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Điểm Phạt</label>
            {readOnly ? (
              <span className="text-sm font-black text-rose-700 bg-rose-50 px-4 py-[9px] rounded-xl border border-rose-200 shadow-sm min-w-[96px] text-center">{item.weight || 0}</span>
            ) : (
              <input type="number"
                className="w-24 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm font-black text-rose-600 text-center focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all "
                value={item.weight || 0}
                onChange={(e) => handleChange(cat, subCat, idx, "weight", parseFloat(e.target.value))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detail field */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 font-mono text-sm text-slate-600 break-all overflow-hidden flex flex-col gap-3  shrink-0">
        {(cat === "ai_rules" && item.prompt) && (
          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-[10px] text-emerald-600 font-bold uppercase tracking-[0.15em]">Lệnh Gọi Trí Tuệ Nhân Tạo (AI Prompt)</label>
            {readOnly ? (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700 text-[13px] leading-relaxed">{item.prompt}</div>
            ) : (
              <textarea
                className="flex-1 w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 p-4 text-emerald-700 outline-none resize-none leading-relaxed text-[13px] transition-all "
                value={item.prompt}
                onChange={e => handleChange(cat, subCat, idx, "prompt", e.target.value)}
              />
            )}
          </div>
        )}
        {(cat === "regex_rules" && item.pattern) && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.15em]">Biểu Thức Chính Quy (Regex Pattern)</label>
            {readOnly ? (
              <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-blue-700">{item.pattern}</div>
            ) : (
              <input
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-blue-700 outline-none transition-all  font-bold"
                value={item.pattern}
                onChange={e => handleChange(cat, subCat, idx, "pattern", e.target.value)}
              />
            )}
          </div>
        )}
        {(cat === "ast_rules" && (item.name || item._astType)) && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-teal-600 font-bold uppercase tracking-[0.15em]">{item.name ? "Target Node (AST)" : "AST Check Type"}</span>
            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
              <span className="text-teal-700 font-bold">{item.name || formatAstType(item._astType)}</span>
              {item.args ? <span className="text-slate-500 ml-2">(Args: {item.args})</span> : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const hasAst = astGroups.length > 0;
  const hasRegex = Array.isArray(config.regex_rules) && config.regex_rules.length > 0;
  const hasAI = Array.isArray(config.ai_rules) && config.ai_rules.length > 0;

  return (
    <div className="flex flex-col gap-8 flex-1 px-8 pb-8">
      <div className="flex flex-col gap-5 shrink-0">
        <span className="text-lg font-black text-slate-800 flex items-center gap-2"><Sparkles size={20} className="text-violet-500" /> Phân Tích Logic Bằng AI (AI Rules)</span>
        {hasAI ? (
          <div className="flex flex-col gap-4 shrink-0 mt-2">
            {config.ai_rules.map((rule, i) => renderCard(rule, "ai_rules", null, i))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic mt-2">
            <Info size={18} className="opacity-50" /> Không có chỉ thị lệnh phân tích ngữ nghĩa nào được sinh ra.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 shrink-0 pt-6 border-t border-slate-200">
        <span className="text-lg font-black text-slate-800 flex items-center gap-2"><Code2 size={20} className="text-blue-500" /> Quét Mã Bằng Biểu Thức Chính Quy (Regex Rules)</span>
        {hasRegex ? (
          <div className="flex flex-col gap-4 mt-2">
            {config.regex_rules.map((rule, i) => renderCard(rule, "regex_rules", null, i))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic mt-2">
            <Info size={18} className="opacity-50" /> Không có luật biểu thức chính quy (Regex) nào được tạo đối với rule này.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 shrink-0 pt-6 border-t border-slate-200">
        <span className="text-lg font-black text-slate-800 flex items-center gap-2"><Box size={20} className="text-emerald-500" /> Phân Tích Cú Pháp Python (AST Rules)</span>
        {hasAst ? (
          <div className="border-l-2 border-emerald-500/20 pl-5 flex flex-col gap-5 mt-2 ml-2">
            {astGroups.map(({ type, rules }) => {
              return (
                <div key={type} className="flex flex-col gap-3">
                  <span className="text-sm font-black text-emerald-600 uppercase tracking-widest">{formatAstType(type)}</span>
                  {rules.map((rule, i) => renderCard(rule, "ast_rules", type, i))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic mt-2">
            <Info size={18} className="opacity-50" /> Không có luật phân tích cú pháp (AST) nào được tạo đối với rule này.
          </div>
        )}
      </div>
    </div>
  );
};
