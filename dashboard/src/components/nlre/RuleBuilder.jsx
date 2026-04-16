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
  Zap,
  Database,
  Info,
  Box,
} from "lucide-react";
import {
  cn,
  templates,
  groupedTemplates,
  JsonHighlight,
  Stepper,
  StreamingTerminal,
  VisualRuleConfigurator,
} from "./RuleBuilderParts";

/* ─── Main Component ───────────────────────────────────────────────────── */

/* ─── Main Component ───────────────────────────────────────────────────── */
const RuleBuilder = ({ targetId, projectName }) => {
  const [naturalText, setNaturalText] = useState("");
  const [compiledJson, setCompiledJson] = useState(null);
  const [existingCompiledJson, setExistingCompiledJson] = useState(null);
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
        const pr = result.data.project_rules || {};
        setCustomWeights(pr.custom_weights || {});
        setExistingCompiledJson(pr.compiled_json || null);
        if (!compiledJson) setCompiledJson(pr.compiled_json || null);
        if (!naturalText) setNaturalText(pr.natural_text || "");
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
      // Merge: nối rules mới vào rules cũ đã có trong DB
      let mergedJson = compiledJson;
      if (existingCompiledJson && compiledJson && existingCompiledJson !== compiledJson) {
        mergedJson = { ...compiledJson };
        // Merge regex_rules: nối thêm 
        const existingRegex = existingCompiledJson.regex_rules || [];
        const newRegex = compiledJson.regex_rules || [];
        // Tránh trùng lặp theo id+pattern
        const existingRegexKeys = new Set(newRegex.map(r => `${r.id}::${r.pattern}`));
        const uniqueOldRegex = existingRegex.filter(r => !existingRegexKeys.has(`${r.id}::${r.pattern}`));
        mergedJson.regex_rules = [...uniqueOldRegex, ...newRegex];
        // Merge ast_rules.dangerous_functions
        const existingFuncs = existingCompiledJson.ast_rules?.dangerous_functions || [];
        const newFuncs = compiledJson.ast_rules?.dangerous_functions || [];
        const existingFuncNames = new Set(newFuncs.map(f => f.name));
        const uniqueOldFuncs = existingFuncs.filter(f => !existingFuncNames.has(f.name));
        mergedJson.ast_rules = {
          ...(existingCompiledJson.ast_rules || {}),
          ...(compiledJson.ast_rules || {}),
          dangerous_functions: [...uniqueOldFuncs, ...newFuncs],
        };
        // Merge ai_rules
        const existingAi = existingCompiledJson.ai_rules || [];
        const newAi = compiledJson.ai_rules || [];
        const existingAiIds = new Set(newAi.map(r => r.id));
        const uniqueOldAi = existingAi.filter(r => !existingAiIds.has(r.id));
        mergedJson.ai_rules = [...uniqueOldAi, ...newAi];
      }
      // Xóa test_case khỏi JSON trước khi lưu (không cần lưu vào DB)
      const { test_case, ...jsonToSave } = mergedJson || {};
      const res = await fetch("/api/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetId,
          natural_text: naturalText,
          compiled_json: jsonToSave,
          custom_weights: customWeights,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setExistingCompiledJson(jsonToSave);
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
              "fixed bottom-10 left-1/2 px-5 py-3 rounded-2xl shadow-md z-[200] border flex items-center gap-3",
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
        <div className="bg-white border border-slate-200 rounded-2xl px-8 py-5 shrink-0 shadow-lg">
          <Stepper current={wizardStep} />
        </div>

        {/* ── Main panel ── */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-md relative flex flex-col w-full h-full">
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
                        <p className="font-black text-slate-800 text-base leading-tight">
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
                        "flex-1 min-h-[200px] bg-slate-50 border rounded-2xl p-5 text-slate-800 font-medium",
                        "placeholder-slate-400 placeholder:italic placeholder:font-normal outline-none resize-none text-base leading-relaxed",
                        "transition-all duration-300 shadow-inner",
                        naturalText
                          ? "border-violet-500/40 bg-white focus:border-violet-500/70"
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
                  <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-0">
                    <div className="px-5 py-3 border-b border-slate-100 shrink-0">
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
                            <div className="flex-1 h-px bg-slate-50" />
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
                                      ? "bg-white border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                                      : "bg-white border-slate-200 hover:border-violet-500/30 hover:bg-white",
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
                                            : "text-slate-700 group-hover:text-violet-300",
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
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-200 shrink-0">
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
                        : "bg-slate-100 text-slate-400 border border-slate-200",
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
                      className="p-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <p className="font-black text-slate-800 text-base">
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
                    className="flex-1 max-w-2xl mx-auto w-full bg-[#101828] border border-amber-500/30 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-md p-10"
                  >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
                    <XCircle size={60} className="text-amber-500/70 mb-6" />
                    <h3 className="text-2xl font-black text-amber-400 mb-3 uppercase tracking-widest">
                      Luật Đã Tồn Tại
                    </h3>
                    <p className="text-slate-500 mb-6 max-w-md leading-relaxed text-sm">
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
                  <div className="flex-1 flex items-center justify-center text-slate-600 gap-3 bg-white rounded-2xl border border-dashed border-slate-200">
                    <RefreshCw size={32} className="opacity-20" />
                    <p className="font-bold text-sm uppercase tracking-widest">
                      Chưa có JSON
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-200 shrink-0">
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
                        : "bg-slate-100 text-slate-400 border border-slate-200",
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
                      className="p-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <p className="font-black text-slate-800 text-base">
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
                    <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 py-2.5 px-4 shrink-0">
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
                    <div className="w-px h-full bg-slate-50 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full bg-slate-100"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right panels */}
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    {/* Code input */}
                    <div className="flex-1 flex flex-col bg-[#0c1222] border border-white/8 rounded-2xl overflow-hidden focus-within:border-blue-500/40 transition-colors min-h-0">
                      <div className="flex items-center bg-slate-50 border-b border-slate-200 py-2.5 px-4 shrink-0">
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
                        className="flex-1 w-full font-mono text-[12px] bg-transparent p-4 text-slate-700 outline-none resize-none leading-7 border-none focus:ring-0 placeholder-slate-700"
                        spellCheck={false}
                      />
                    </div>

                    {/* Results */}
                    <div className="flex-1 flex flex-col bg-[#0c1222] border border-white/8 rounded-2xl overflow-hidden min-h-0">
                      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 py-2.5 px-4 shrink-0">
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
                              : "bg-slate-100 text-slate-400 border border-slate-200",
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

                      <div className="flex-1 overflow-auto p-4 bg-slate-50">
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
                                <p className="text-slate-600 text-xs leading-relaxed">
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
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200 shrink-0">
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
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
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
