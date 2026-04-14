import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Save,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Wand2,
  Terminal,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Lock,
  Gauge,
  Wrench,
  Code2,
  Zap,
  Clock,
  Database,
  Box,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

/* ─── Templates ───────────────────────────────────────────────────────── */
const templates = [
  {
    label: "Cấm bắt ngoại lệ chung",
    category: "Clean Code",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    reason: "bare except / except Exception nuốt lỗi ngầm, cực kỳ nguy hiểm.",
    prompt:
      "Tuyệt đối không sử dụng bare except (except:) hoặc ngoại lệ quá chung chung (except Exception:). Phải bắt rõ ngoại lệ cụ thể.",
  },
  {
    label: "Giới hạn độ dài hàm",
    category: "Maintainability",
    icon: Wrench,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    reason: "Hàm > 50 dòng: phức tạp, khó test, khó bảo trì.",
    prompt:
      "Các hàm Python không được vượt quá 50 dòng code để đảm bảo Clean Code.",
  },
  {
    label: "Ngăn chặn eval()",
    category: "Security",
    icon: Lock,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    reason: "Thực thi string thành code → RCE (Remote Code Execution).",
    prompt:
      "Tuyệt đối không sử dụng hàm eval() để thực thi code, rủi ro bảo mật nghiêm trọng (RCE).",
  },
  {
    label: "Cấm Hardcode Credentials",
    category: "Security",
    icon: Lock,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    reason: "API Keys, token, password không được nhúng thẳng vào mã nguồn.",
    prompt:
      "Ngăn chặn việc gán các token, password, secret_key cứng trong mã nguồn. Bắt buộc đọc từ biến môi trường.",
  },
];

const categoryOrder = ["Security", "Maintainability", "Clean Code"];
const groupedTemplates = categoryOrder.reduce((acc, cat) => {
  const items = templates.filter((t) => t.category === cat);
  if (items.length) acc[cat] = items;
  return acc;
}, {});

/* ─── Fake JSON syntax highlighter ────────────────────────────────────── */
const JsonHighlight = ({ value }) => {
  if (!value) return null;
  const str =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  // Simple tokenizer: keys → violet, strings → emerald, numbers → amber, bools → sky
  const html = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/: (true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>');

  return (
    <div
      className="w-full h-full font-mono text-[13px] leading-relaxed p-5 overflow-auto text-slate-300 whitespace-pre-wrap json-highlight"
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

const Stepper = ({ current }) => (
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
                done
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : active
                    ? "bg-gradient-to-br from-violet-600 to-purple-700 border-violet-400/50 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] scale-110"
                    : "bg-white/3 border-white/10 text-slate-600",
              )}
            >
              {done ? <CheckCircle2 size={18} /> : step.num}
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span
                className={cn(
                  "text-[11px] font-black tracking-wider uppercase",
                  done
                    ? "text-emerald-400"
                    : active
                      ? "text-violet-300"
                      : "text-slate-600",
                )}
              >
                {step.label}
              </span>
              <span className="text-[9px] text-slate-600 tracking-wide hidden sm:block">
                {step.sub}
              </span>
            </div>
          </div>

          {i < STEPS.length - 1 && (
            <div className="flex-1 mx-3 mb-5 relative h-[2px] rounded-full bg-white/5 overflow-hidden">
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
const StreamingTerminal = ({ text, isPending, label }) => {
  const containerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isPending) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [isPending]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  const loadingMessages = [
    "Initializing neural network...",
    "Parsing language features...",
    "Extracting logic constraints...",
    "Building AST syntax trees...",
    "Compiling regex patterns..."
  ];

  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (!isPending) return;
    const msgTimer = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(msgTimer);
  }, [isPending]);

  return (
    <div className="flex-1 flex flex-col bg-[#0c1222] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-w-4xl mx-auto w-full relative">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none" />
      {/* Terminal header */}
      <div className="flex items-center justify-between px-5 py-3 bg-violet-900/40 border-b border-violet-500/30 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
            </div>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          )}
          <span className="text-xs font-black text-violet-200 uppercase tracking-[0.2em] drop-shadow-md">
            {label || (isPending ? "AI đang tư duy…" : "Hoàn tất")}
          </span>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
            <Clock size={11} />
            {elapsed}s
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 p-6 overflow-y-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap relative z-10"
      >
        {text ? (
          <span className="text-emerald-300">{text}</span>
        ) : (
          <div className="flex flex-col gap-2">
             <span className="text-violet-300 font-bold animate-pulse">
               Đang kết nối tới mô hình AI...
             </span>
             <span className="text-slate-500 text-xs">
               &gt; {loadingMessages[loadingMsgIdx]}
             </span>
          </div>
        )}
        {isPending && (
          <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 rounded-sm animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        )}
      </div>
    </div>
  );
};

/* ─── Visual Rule Configurator ─────────────────────────────────────────── */
const VisualRuleConfigurator = ({ config, onChange, readOnly = false }) => {
  if (!config) return null;

  const handleChange = (cat, subCat, idx, field, val) => {
    if (readOnly || !onChange) return;
    const clone = JSON.parse(JSON.stringify(config));
    if (cat === "ast_rules") {
      clone[cat][subCat][idx][field] = val;
    } else {
      clone[cat][idx][field] = val;
    }
    onChange(clone);
  };

  const renderCard = (item, cat, subCat, idx) => (
    <div key={`${cat}-${subCat}-${idx}`} className="bg-[rgba(16,22,38,0.7)] backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-5 hover:border-violet-400/40 transition-all shadow-xl shrink-0 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 to-purple-600 opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="flex flex-col gap-4 shrink-0 pl-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl font-black text-white truncate drop-shadow-md">{item.id || item.name || "UNNAMED_RULE"}</span>
          <span className="text-[11px] font-bold text-violet-300 bg-violet-500/20 px-3 py-1 rounded-md border border-violet-400/30 whitespace-nowrap uppercase tracking-widest shadow-sm">
            {item.pillar || "N/A"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-5">
          {readOnly ? (
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lý Do (Reason)</span>
              <p className="text-sm text-slate-300 leading-relaxed bg-white/5 border border-white/10 p-3 rounded-xl min-h-[42px]">{item.reason}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lý Do (Reason)</label>
              <input 
                className="text-sm text-white leading-relaxed bg-[rgba(0,0,0,0.2)] border border-white/10 hover:border-white/20 focus:border-violet-500 focus:bg-[rgba(16,18,38,0.8)] focus:outline-none focus:ring-2 focus:ring-violet-500/20 rounded-xl w-full px-4 py-2.5 transition-all shadow-inner"
                value={item.reason || ""}
                onChange={(e) => handleChange(cat, subCat, idx, "reason", e.target.value)}
                placeholder="Nhập giải thích cho quy tắc này..."
              />
            </div>
          )}

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Trọng Số (Weight)</label>
            {readOnly ? (
               <span className="text-sm font-black text-rose-300 bg-rose-500/15 px-4 py-[9px] rounded-xl border border-rose-500/30 shadow-sm min-w-[96px] text-center">{item.weight || 0}</span>
            ) : (
               <input type="number" 
                      className="w-24 bg-[rgba(0,0,0,0.2)] border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm font-black text-rose-400 text-center focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-inner"
                      value={item.weight || 0}
                      onChange={(e) => handleChange(cat, subCat, idx, "weight", parseFloat(e.target.value))} />
            )}
          </div>
        </div>
      </div>
      
      {/* Detail field based on rule type */}
      <div className="bg-[#0c1222]/80 backdrop-blur-md rounded-xl p-5 border border-white/10 font-mono text-sm text-slate-300 break-all overflow-hidden flex flex-col gap-3 shadow-inner shrink-0">
        {(cat === "ai_rules" && item.prompt) && (
           <div className="flex flex-col gap-2 shrink-0">
              <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.15em]">Lệnh Gọi Trí Tuệ Nhân Tạo (AI Prompt)</label>
              {readOnly ? (
                 <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-slate-300 text-[13px] leading-relaxed">
                   {item.prompt}
                 </div>
              ) : (
                 <textarea 
                   className="flex-1 w-full bg-[rgba(0,0,0,0.3)] border border-white/10 hover:border-white/20 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 p-4 text-emerald-100 outline-none resize-none leading-relaxed text-[13px] transition-all shadow-inner" 
                   value={item.prompt} 
                   onChange={e => handleChange(cat, subCat, idx, "prompt", e.target.value)}
                 />
              )}
           </div>
        )}
        {(cat === "regex_rules" && item.pattern) && (
           <div className="flex flex-col gap-2">
              <label className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.15em]">Biểu Thức Chính Quy (Regex Pattern)</label>
              {readOnly ? (
                 <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-blue-200">
                   {item.pattern}
                 </div>
              ) : (
                 <input 
                   className="w-full bg-[rgba(0,0,0,0.3)] border border-white/10 hover:border-white/20 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-blue-300 outline-none transition-all shadow-inner font-bold" 
                   value={item.pattern} 
                   onChange={e => handleChange(cat, subCat, idx, "pattern", e.target.value)} 
                 />
              )}
           </div>
        )}
        {(cat === "ast_rules" && item.name) && (
           <div className="flex flex-col gap-2">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-[0.15em]">Target Node (AST)</span>
              <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl">
                 <span className="text-teal-200 font-bold">{item.name}</span>
                 {item.args ? <span className="text-slate-400 ml-2">(Args: {item.args})</span> : ""}
              </div>
           </div>
        )}
      </div>
    </div>
  );

  const hasAst = config.ast_rules && Object.keys(config.ast_rules).length > 0;
  const hasRegex = config.regex_rules && config.regex_rules.length > 0;
  const hasAI = config.ai_rules && config.ai_rules.length > 0;

  return (
    <div className="flex flex-col gap-8 flex-1 px-8 pb-8">
      <div className="flex flex-col gap-5 shrink-0">
        <div className="flex flex-col shrink-0">
          <span className="text-lg font-black text-white flex items-center gap-2"><Sparkles size={20} className="text-violet-400"/> Phân Tích Logic Bằng AI (AI Rules)</span>
        </div>
        {hasAI ? (
          <div className="flex flex-col gap-4 shrink-0 mt-2">
            {config.ai_rules.map((rule, i) => renderCard(rule, "ai_rules", null, i))}
          </div>
        ) : (
          <div className="bg-[rgba(10,15,28,0.5)] border border-white/5 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic shadow-inner mt-2">
            <Info size={18} className="opacity-50" /> Không có chỉ thị lệnh phân tích ngữ nghĩa nào được sinh ra.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 shrink-0 pt-6 border-t border-white/[0.05]">
        <div className="flex flex-col shrink-0">
          <span className="text-lg font-black text-white flex items-center gap-2"><Code2 size={20} className="text-blue-400"/> Quét Mã Bằng Biểu Thức Chính Quy (Regex Rules)</span>
        </div>
        {hasRegex ? (
          <div className="flex flex-col gap-4 mt-2">
            {config.regex_rules.map((rule, i) => renderCard(rule, "regex_rules", null, i))}
          </div>
        ) : (
          <div className="bg-[rgba(10,15,28,0.5)] border border-white/5 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic shadow-inner mt-2">
            <Info size={18} className="opacity-50" /> Không có luật biểu thức chính quy (Regex) nào được tạo đối với rule này.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 shrink-0 pt-6 border-t border-white/[0.05]">
        <div className="flex flex-col shrink-0">
          <span className="text-lg font-black text-white flex items-center gap-2"><Box size={20} className="text-emerald-400"/> Phân Tích Cú Pháp Python (AST Rules)</span>
        </div>
        {hasAst ? (
          <div className="border-l-2 border-emerald-500/20 pl-5 flex flex-col gap-5 mt-2 ml-2">
             {Object.entries(config.ast_rules).map(([type, rules]) => {
                if (!Array.isArray(rules) || rules.length === 0) return null;
                return (
                   <div key={type} className="flex flex-col gap-3">
                     <span className="text-sm font-black text-emerald-400/80 uppercase tracking-widest">{type}</span>
                     {rules.map((rule, i) => renderCard(rule, "ast_rules", type, i))}
                   </div>
                )
             })}
          </div>
        ) : (
          <div className="bg-[rgba(10,15,28,0.5)] border border-white/5 border-dashed rounded-xl p-5 flex items-center gap-3 text-slate-500 text-[13px] italic shadow-inner mt-2">
            <Info size={18} className="opacity-50" /> Không có luật phân tích cú pháp (AST) nào được tạo đối với rule này.
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────── */
const RuleBuilder = ({ targetId, projectName }) => {
  const [naturalText, setNaturalText] = useState("");
  const [compiledJson, setCompiledJson] = useState(null);
  const [customWeights, setCustomWeights] = useState({});
  const [wizardStep, setWizardStep] = useState(1);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toast, setToast] = useState(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testViolations, setTestViolations] = useState(null);
  const [isTestRun, setIsTestRun] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRules = async () => {
    if (!targetId) return;
    try {
      const res = await fetch(
        `/api/rules?target=${encodeURIComponent(targetId)}`,
      );
      const result = await res.json();
      if (result.status === "success" && result.data) {
        setCustomWeights(result.data.custom_weights || {});
        if (!compiledJson) setCompiledJson(result.data.compiled_json || null);
        if (!naturalText) setNaturalText(result.data.natural_text || "");
      }
    } catch (e) {
      console.error("Fetch rules error", e);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [targetId]);

  const handleCompile = async () => {
    if (!naturalText.trim()) return;
    setIsCompiling(true);
    setWizardStep(2);
    setTestViolations(null);
    setSaved(false);
    setStreamingText("");
    setCompiledJson(null);
    try {
      const response = await fetch("/api/rules/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ natural_text: naturalText }),
      });
      if (!response.body) throw new Error("ReadableStream not supported");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setStreamingText(fullText);
      }
      let jsonStr = null;
      const jsonMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) jsonStr = jsonMatch[1].trim();
      else {
        const fi = fullText.indexOf("{");
        const li = fullText.lastIndexOf("}");
        if (fi !== -1 && li !== -1 && li > fi)
          jsonStr = fullText.substring(fi, li + 1);
      }
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.existing_rule)
            setCompiledJson({ ...parsed, _is_duplicate: true });
          else {
            setCompiledJson(parsed);
            if (parsed.test_case) setTestCode(parsed.test_case);
            setIsTestRun(false);
          }
        } catch (e) {
          showToast("AI trả về JSON không hợp lệ.", "error");
        }
      } else {
        showToast("Không tìm thấy JSON hợp lệ trong phản hồi AI", "error");
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleAutoFix = async () => {
    if (!compiledJson) return;
    setIsAutoFixing(true);
    setWizardStep(2);
    setSaved(false);
    setStreamingText("");
    const failedJsonStr =
      typeof compiledJson === "string"
        ? compiledJson
        : JSON.stringify(compiledJson, null, 2);
    setCompiledJson(null);
    try {
      const errMsg =
        testViolations && testViolations.length > 0
          ? "Có lỗi vi phạm báo sai khi chạy test"
          : "Không áp dụng hoặc Parse lỗi JSON";
      const response = await fetch("/api/rules/auto_fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failed_json: failedJsonStr,
          test_case_code: testCode,
          error_message: errMsg,
        }),
      });
      if (!response.body) throw new Error("ReadableStream not supported");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setStreamingText(fullText);
      }
      let jsonStr = null;
      const jsonMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) jsonStr = jsonMatch[1].trim();
      else {
        const fi = fullText.indexOf("{");
        const li = fullText.lastIndexOf("}");
        if (fi !== -1 && li !== -1 && li > fi)
          jsonStr = fullText.substring(fi, li + 1);
      }
      if (jsonStr) {
        try {
          setCompiledJson(JSON.parse(jsonStr));
          setIsTestRun(false);
          setTestViolations(null);
          showToast("AI Auto-Fix thành công!");
        } catch (e) {
          showToast("AI Auto-Fix JSON lỗi.", "error");
          setCompiledJson(failedJsonStr);
        }
      } else {
        showToast("Auto-Fix thất bại.", "error");
        setCompiledJson(failedJsonStr);
      }
    } catch (e) {
      showToast(e.message, "error");
      setCompiledJson(failedJsonStr);
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleSave = async () => {
    if (!targetId) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: compiledJson,
          custom_weights: customWeights,
        }),
      });
      if (res.ok) {
        setSaved(true);
        showToast("Rule đã lưu thành công!");
        setTimeout(() => setSaved(false), 3000);
      } else {
        showToast("Lỗi khi lưu rule", "error");
      }
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestRule = async () => {
    if (!compiledJson || !testCode.trim()) return;
    setIsTesting(true);
    setTestViolations(null);
    try {
      const res = await fetch("/api/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_snippet: testCode,
          compiled_json: compiledJson,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestViolations(data.violations || []);
        setIsTestRun(true);
      } else {
        showToast("Sandbox test error", "error");
      }
    } catch (e) {
      showToast("API connection error", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const jsonStr =
    compiledJson && !compiledJson._is_duplicate
      ? typeof compiledJson === "string"
        ? compiledJson
        : JSON.stringify(compiledJson, null, 2)
      : "";

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent pt-0 pb-12 gap-5 font-sans relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 60, x: "-50%" }}
            className={cn(
              "fixed bottom-10 left-1/2 px-5 py-3 rounded-2xl shadow-2xl z-[200] border backdrop-blur-xl flex items-center gap-3",
              toast.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
            )}
          >
            {toast.type === "error" ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "flex-1 w-full relative z-10 flex flex-col gap-5 mx-auto min-h-[calc(100vh-160px)] transition-all duration-500",
        wizardStep === 2 ? "max-w-full px-2 lg:px-4" : "max-w-7xl"
      )}>
        {/* ── Stepper ── */}
        <div className="bg-[rgba(16,22,38,0.55)] backdrop-blur-xl border border-white/[0.07] rounded-2xl px-8 py-5 shrink-0 shadow-lg">
          <Stepper current={wizardStep} />
        </div>

        {/* ── Main panel ── */}
        <div className="flex-1 bg-[rgba(16,22,38,0.55)] backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-2xl relative flex flex-col w-full h-full">
          <AnimatePresence mode="wait">
            {/* ════ STEP 1 ════ */}
            {wizardStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col p-6 lg:p-8 flex-1 min-h-[500px] w-full"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 flex-1 min-h-0">
                  {/* Left — Prompt area */}
                  <div className="flex flex-col min-h-0">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                        <Wand2 size={20} className="text-violet-400" />
                      </div>
                      <div>
                        <p className="font-black text-white text-base leading-tight">
                          Mô Tả Luật Bằng Tiếng Việt
                        </p>
                        <p className="text-[10px] uppercase tracking-[3px] text-slate-500 mt-0.5">
                          Natural Language → AI Rule
                        </p>
                      </div>
                    </div>

                    <textarea
                      autoFocus
                      value={naturalText}
                      onChange={(e) => setNaturalText(e.target.value)}
                      placeholder={`Ví dụ:\n"Cấm import os và subprocess vì lý do bảo mật, chỉ cho phép dùng pathlib."\n"Mỗi file không được có quá 3 class Python."`}
                      className={cn(
                        "flex-1 min-h-[200px] bg-[rgba(10,15,28,0.5)] border rounded-2xl p-5 text-slate-100 font-medium",
                        "placeholder-slate-600 outline-none resize-none text-base leading-relaxed",
                        "transition-all duration-300 shadow-inner",
                        naturalText
                          ? "border-violet-500/40 bg-[rgba(16,18,38,0.5)] focus:border-violet-500/70"
                          : "border-white/8 hover:border-violet-500/25 focus:border-violet-500/50",
                      )}
                    />

                    {/* Char counter */}
                    <div className="flex justify-between items-center mt-2 px-1">
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Info size={10} /> AI sẽ tự tạo Regex + AST config tương
                        ứng
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          naturalText.length > 400
                            ? "text-amber-400"
                            : "text-slate-600",
                        )}
                      >
                        {naturalText.length} ký tự
                      </span>
                    </div>
                  </div>

                  {/* Right — Template gallery */}
                  <div className="flex flex-col bg-[rgba(16,22,38,0.4)] rounded-2xl border border-white/[0.06] overflow-hidden min-h-0">
                    <div className="px-5 py-3 border-b border-white/5 shrink-0">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={12} /> Prompt Mẫu Tham Khảo
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
                      {Object.entries(groupedTemplates).map(([cat, items]) => (
                        <div key={cat}>
                          {/* Category separator */}
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                              {cat}
                            </span>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>

                          <div className="flex flex-col gap-2">
                            {items.map((tpl, i) => {
                              const TIcon = tpl.icon;
                              const isSelected =
                                selectedTemplate === `${cat}-${i}`;
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setNaturalText(tpl.prompt);
                                    setSelectedTemplate(`${cat}-${i}`);
                                  }}
                                  className={cn(
                                    "text-left p-4 rounded-xl border transition-all duration-200 group flex gap-3",
                                    isSelected
                                      ? "bg-[rgba(16,18,38,0.6)] border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                                      : "bg-[rgba(16,22,38,0.45)] border-white/[0.06] hover:border-violet-500/30 hover:bg-[rgba(16,18,38,0.55)]",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "p-2 rounded-lg shrink-0",
                                      tpl.bg,
                                      tpl.border,
                                      "border mt-0.5",
                                    )}
                                  >
                                    <TIcon size={14} className={tpl.color} />
                                  </div>
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={cn(
                                          "font-bold text-sm transition-colors",
                                          isSelected
                                            ? "text-violet-300"
                                            : "text-slate-200 group-hover:text-violet-300",
                                        )}
                                      >
                                        {tpl.label}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[9px] font-black text-violet-400 bg-violet-500/15 px-2 py-0.5 rounded-full border border-violet-500/25 shrink-0">
                                          ✓ Selected
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                      {tpl.reason}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-white/[0.06] shrink-0">
                  <span className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Zap size={12} className="text-violet-400" />
                    Powered by Chain-of-Thought AI reasoning
                  </span>
                  <button
                    onClick={handleCompile}
                    disabled={!naturalText.trim()}
                    className={cn(
                      "flex items-center gap-2.5 px-7 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      naturalText.trim()
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_28px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 active:scale-95"
                        : "bg-slate-800 text-slate-500 border border-slate-700",
                    )}
                  >
                    <Wand2 size={16} /> Biên Dịch AI <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════ STEP 2 ════ */}
            {wizardStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col pt-6 lg:pt-8 flex-1 w-full"
              >
                {/* Sub-header */}
                <div className="flex items-center justify-between mb-5 shrink-0 px-6 lg:px-8">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="p-2 bg-[rgba(10,15,28,0.5)] hover:bg-[rgba(16,22,38,0.7)] border border-white/[0.08] rounded-xl text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <p className="font-black text-white text-base">
                        Kết Quả Biên Dịch AI
                      </p>
                      <p className="text-[10px] text-violet-400 font-bold uppercase tracking-[2px]">
                        AI Parser & Configurator
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isCompiling && !isAutoFixing && compiledJson && !compiledJson._is_duplicate && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <CheckCircle2 size={14} /> BIÊN DỊCH THÀNH CÔNG
                      </span>
                    )}
                    {!isCompiling &&
                      !isAutoFixing &&
                      compiledJson &&
                      !compiledJson._is_duplicate && (
                        <button
                          onClick={handleAutoFix}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20 hover:bg-orange-500/20 transition-all group"
                        >
                          <Wand2
                            size={15}
                            className="group-hover:rotate-12 transition-transform"
                          />
                          ✨ Tự Động Sửa Bằng AI
                        </button>
                      )}
                  </div>
                </div>

                {/* Content */}
                {isCompiling || isAutoFixing ? (
                  <StreamingTerminal
                    text={streamingText}
                    isPending={true}
                    label={
                      isAutoFixing
                        ? "AI đang gỡ lỗi JSON…"
                        : "AI Chain-of-Thought đang tư duy…"
                    }
                  />
                ) : compiledJson?._is_duplicate ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 max-w-2xl mx-auto w-full bg-[#101828] border border-amber-500/30 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl p-10"
                  >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
                    <XCircle size={60} className="text-amber-500/70 mb-6" />
                    <h3 className="text-2xl font-black text-amber-400 mb-3 uppercase tracking-widest">
                      Luật Đã Tồn Tại
                    </h3>
                    <p className="text-slate-400 mb-6 max-w-md leading-relaxed text-sm">
                      Hệ thống phát hiện luật này trùng với Core Rule đang hoạt
                      động:
                    </p>
                    <code className="text-amber-400 px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-lg font-mono font-black block mb-8">
                      {compiledJson.existing_rule}
                    </code>
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-xl font-black transition-all flex items-center gap-2 uppercase tracking-wider text-sm shadow-lg"
                    >
                      <RefreshCw size={16} /> Nhập Lại Prompt Mới
                    </button>
                  </motion.div>
                ) : compiledJson ? (
                  <div className="flex-1 relative flex flex-col">
                     <VisualRuleConfigurator config={compiledJson} onChange={setCompiledJson} />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-600 gap-3 bg-[rgba(16,22,38,0.4)] rounded-2xl border border-dashed border-white/[0.06]">
                    <RefreshCw size={32} className="opacity-20" />
                    <p className="font-bold text-sm uppercase tracking-widest">
                      Chưa có JSON
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-white/[0.06] shrink-0">
                  <span className="text-xs text-slate-600">
                    Bạn có thể chỉnh sửa trực tiếp nội dung JSON ở trên.
                  </span>
                  <button
                    onClick={() => setWizardStep(3)}
                    disabled={
                      isCompiling ||
                      isAutoFixing ||
                      !compiledJson ||
                      compiledJson._is_duplicate
                    }
                    className={cn(
                      "flex items-center gap-2.5 px-7 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      !isCompiling &&
                        !isAutoFixing &&
                        compiledJson &&
                        !compiledJson._is_duplicate
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_28px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 active:scale-95"
                        : "bg-slate-800 text-slate-500 border border-slate-700",
                    )}
                  >
                    Tiến Vào Sandbox <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════ STEP 3 ════ */}
            {wizardStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col p-6 lg:p-8 flex-1 h-[600px] xl:h-[800px] w-full"
              >
                {/* Sub-header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="p-2 bg-[rgba(10,15,28,0.5)] hover:bg-[rgba(16,22,38,0.7)] border border-white/[0.08] rounded-xl text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <p className="font-black text-white text-base">
                        Chạy Thử Gỡ Lỗi
                      </p>
                      <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[2px]">
                        Interactive Sandbox
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoFix}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                  >
                    <Wand2 size={13} /> ✨ AI Sửa Luật Này
                  </button>
                </div>

                {/* Split pane */}
                <div className="flex-1 flex gap-4 min-h-0">
                  <div className="w-[45%] flex flex-col bg-[#0c1222] border border-white/8 rounded-2xl overflow-hidden focus-within:border-violet-500/40 transition-colors">
                    <div className="flex items-center justify-between bg-[rgba(10,15,28,0.4)] border-b border-white/[0.06] py-2.5 px-4 shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Database size={12} className="text-violet-400" /> Trình Quản Lý & Tinh Chỉnh
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                       {/* Cung cấp quyền edit thẳng trên màn hình Sandbox */}
                       <VisualRuleConfigurator config={compiledJson} onChange={(newConfig) => {
                          setCompiledJson(newConfig);
                          setIsTestRun(false);
                       }} />
                    </div>
                  </div>

                  {/* Gutter */}
                  <div className="flex items-center justify-center w-4 shrink-0">
                    <div className="w-px h-full bg-white/5 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full bg-white/10"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right panels */}
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    {/* Code input */}
                    <div className="flex-1 flex flex-col bg-[#0c1222] border border-white/8 rounded-2xl overflow-hidden focus-within:border-blue-500/40 transition-colors min-h-0">
                      <div className="flex items-center bg-[rgba(10,15,28,0.4)] border-b border-white/[0.06] py-2.5 px-4 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Terminal size={12} className="text-blue-400" /> Mã
                          Nguồn Mô Phỏng
                        </span>
                      </div>
                      <textarea
                        autoFocus
                        value={testCode}
                        onChange={(e) => {
                          setTestCode(e.target.value);
                          setIsTestRun(false);
                        }}
                        placeholder="# Viết hoặc dán code cần test luật bên trái..."
                        className="flex-1 w-full font-mono text-[12px] bg-transparent p-4 text-slate-200 outline-none resize-none leading-7 border-none focus:ring-0 placeholder-slate-700"
                        spellCheck={false}
                      />
                    </div>

                    {/* Results */}
                    <div className="flex-1 flex flex-col bg-[#0c1222] border border-white/8 rounded-2xl overflow-hidden min-h-0">
                      <div className="flex items-center justify-between bg-[rgba(10,15,28,0.4)] border-b border-white/[0.06] py-2.5 px-4 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Box size={12} /> Kết Quả Phân Tích
                        </span>
                        <button
                          onClick={handleTestRule}
                          disabled={
                            isTesting || !testCode.trim() || !compiledJson
                          }
                          className={cn(
                            "flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            !isTesting && testCode.trim() && compiledJson
                              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                              : "bg-slate-800 text-slate-500",
                          )}
                        >
                          {isTesting ? (
                            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          Chạy Test
                        </button>
                      </div>

                      <div className="flex-1 overflow-auto p-4 bg-[rgba(10,15,28,0.25)]">
                        {isTesting ? (
                          <div className="flex flex-col items-center justify-center h-full text-blue-400 gap-3">
                            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">
                              Analyzing AST & Regex…
                            </p>
                          </div>
                        ) : testViolations === null ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs italic gap-2">
                            <Play size={20} className="opacity-20" />
                            Nhấn{" "}
                            <strong className="text-blue-400 not-italic">
                              Chạy Test
                            </strong>{" "}
                            để xem kết quả
                          </div>
                        ) : testViolations.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-full bg-emerald-500/5 rounded-xl border border-emerald-500/10"
                          >
                            <CheckCircle2
                              size={32}
                              className="text-emerald-500/70 mb-2"
                            />
                            <span className="font-black text-emerald-400 text-xs uppercase tracking-widest">
                              Không Có Vi Phạm
                            </span>
                          </motion.div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {testViolations.map((v, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="bg-red-500/8 border border-red-500/25 rounded-xl p-3 flex flex-col gap-2 border-l-2 border-l-red-500/60"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-red-400 font-mono text-xs">
                                    {v.rule_id}
                                  </span>
                                  <span className="text-[9px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/25 flex items-center gap-1">
                                    <AlertTriangle size={9} /> Line {v.line}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                  {v.reason}
                                </p>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.06] shrink-0">
                  <span className="text-xs text-slate-600">
                    {isTestRun
                      ? testViolations?.length === 0
                        ? "✓ Test passed — Sẵn sàng lưu vào dự án"
                        : `${testViolations?.length} violations phát hiện — Kiểm tra lại JSON nếu cần`
                      : "Chạy test ít nhất 1 lần trước khi lưu"}
                  </span>

                  <motion.button
                    whileHover={
                      isTestRun && !saved ? { scale: 1.02, y: -2 } : {}
                    }
                    whileTap={isTestRun && !saved ? { scale: 0.97 } : {}}
                    onClick={handleSave}
                    disabled={isSaving || !isTestRun || saved}
                    className={cn(
                      "flex items-center gap-2.5 px-7 py-3 rounded-xl font-black text-sm uppercase tracking-wider outline-none transition-all duration-300",
                      !isTestRun
                        ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        : saved
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] hover:shadow-[0_4px_30px_rgba(16,185,129,0.6)] border border-emerald-400/30",
                    )}
                  >
                    {isSaving ? (
                      <span className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                    ) : saved ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    {saved ? "Đã Lưu Thành Công" : "Lưu Vào Dự Án"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default RuleBuilder;
