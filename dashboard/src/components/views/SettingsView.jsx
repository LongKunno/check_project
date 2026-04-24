import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  AlertTriangle,
  Zap,
  Trash2,
  ShieldAlert,
  Activity,
  ShieldCheck,
  Code2,
  ExternalLink,
  Server,
  Clock,
  Cpu,
  Info,
  FolderOpen,
  Plus,
  Edit3,
  X,
  GitBranch,
  Check,
  ToggleLeft,
  ToggleRight,
  Save,
  Wifi,
  WifiOff,
  FileSearch,
  Lock,
  LockOpen,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

const InfoCard = ({
  icon,
  label,
  value,
  iconClass = "bg-slate-500/10 border-slate-500/20 text-slate-500",
  accent = "",
}) => (
  <div
    className={`flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border transition-all hover:bg-slate-50 ${accent || "border-slate-100"}`}
  >
    <div className={`p-2 rounded-xl border ${iconClass}`}>{icon}</div>
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        {label}
      </div>
      <div className="text-sm font-bold text-slate-800">{value}</div>
    </div>
  </div>
);

const SectionTitle = ({ icon, title, description }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
      {icon}
    </div>
    <div>
      <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 text-xs mt-0.5">{description}</p>
      )}
    </div>
  </div>
);

const SettingsView = ({ selectedRepoId, cn }) => {
  const [resetState, setResetState] = useState({ confirming: null, loading: null });
  const [systemInfo, setSystemInfo] = useState(null);
  const [rulesInfo, setRulesInfo] = useState(null);
  const toast = useToast();
  const { updateAuthRequired } = useAuth();

  // ── Engine Configuration State ──────────────────────────────────────────
  const [engineConfig, setEngineConfig] = useState({
    ai_enabled: false,
    ai_mode: "realtime",
    test_mode_limit_files: 0,
    ai_max_concurrency: 5,
    openai_batch_model: "gpt-4.1-nano",
    openai_batch_api_key: "",
    openai_batch_api_key_configured: false,
    clear_openai_batch_api_key: false,
    member_recent_months: 3,
    auth_required: true,
    regression_gate_enabled: true,
    regression_score_drop_threshold: 2.0,
    regression_violations_increase_threshold: 5,
    regression_pillar_drop_threshold: 0.5,
    regression_new_critical_threshold: 1,
  });
  const [engineSaving, setEngineSaving] = useState(false);
  const [engineDirty, setEngineDirty] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [aiTesting, setAiTesting] = useState(false);

  const fetchEngineConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/engine");
      if (res.ok) {
        const d = await res.json();
        if (d.status === "success") {
          setEngineConfig((prev) => ({
            ...prev,
            ...d.data,
            openai_batch_api_key: "",
            clear_openai_batch_api_key: false,
          }));
          setEngineDirty(false);
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => { fetchEngineConfig(); }, [fetchEngineConfig]);

  const handleEngineConfigChange = (key, value) => {
    setEngineConfig((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "openai_batch_api_key" ? { clear_openai_batch_api_key: false } : {}),
    }));
    setEngineDirty(true);
  };

  const handleEngineSave = async () => {
    setEngineSaving(true);
    try {
      const payload = { ...engineConfig };
      if (!payload.openai_batch_api_key) {
        delete payload.openai_batch_api_key;
      }
      if (!payload.clear_openai_batch_api_key) {
        delete payload.clear_openai_batch_api_key;
      }
      const res = await fetch("/api/settings/engine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.status === "success") {
          setEngineConfig((prev) => ({
            ...prev,
            ...d.data,
            openai_batch_api_key: "",
            clear_openai_batch_api_key: false,
          }));
          setEngineDirty(false);
          toast.success("Engine configuration saved successfully.", "Settings Updated");
          // Cập nhật AuthContext nếu auth_required đã thay đổi
          if (d.data.auth_required !== undefined) {
            updateAuthRequired(d.data.auth_required);
          }
        }
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.detail || "Failed to save settings.", "Error");
      }
    } catch (e) {
      toast.error("Network error.", "Connection Error");
    } finally {
      setEngineSaving(false);
    }
  };

  const handleClearBatchKey = () => {
    setEngineConfig((prev) => ({
      ...prev,
      openai_batch_api_key: "",
      openai_batch_api_key_configured: false,
      clear_openai_batch_api_key: true,
    }));
    setEngineDirty(true);
  };

  const handleTestAiConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await fetch("/api/health/ai");
      const d = await res.json();
      setAiTestResult(d);
    } catch (e) {
      setAiTestResult({ status: "unhealthy", reason: "Network error" });
    } finally {
      setAiTesting(false);
    }
  };

  // Fetch system info
  useEffect(() => {
    fetch("/api/health/ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSystemInfo(d);
      })
      .catch(() => { });
  }, []);

  // Fetch rules summary
  useEffect(() => {
    if (!selectedRepoId) return;
    fetch(`/api/rules?target=${encodeURIComponent(selectedRepoId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((resp) => {
        if (!resp?.data) return;
        const d = resp.data;
        const coreCount = d.default_rules
          ? Object.keys(d.default_rules).length
          : 0;
        const pr = d.project_rules || {};
        const customRegex = pr.compiled_json?.regex_rules?.length || 0;
        const customAst = pr.compiled_json?.ast_rules?.dangerous_functions?.length || 0;
        const customAi = pr.compiled_json?.ai_rules?.length || 0;
        const disabledCount = pr.disabled_core_rules?.length || 0;
        setRulesInfo({
          coreCount,
          customCount: customRegex + customAst + customAi,
          disabledCount,
        });
      })
      .catch(() => { });
  }, [selectedRepoId]);

  // ── Multi-Level Reset Handler ──────────────────────────────────────────
  const handleLevelReset = async (target, level, key) => {
    if (resetState.confirming !== key) {
      setResetState({ confirming: key, loading: null });
      setTimeout(() => setResetState(s => s.confirming === key ? { confirming: null, loading: null } : s), 4000);
      return;
    }
    setResetState({ confirming: null, loading: key });
    try {
      const res = await fetch("/api/rules/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, level }),
      });
      if (res.ok) {
        const d = await res.json();
        toast.success(d.message, "Reset Complete");
      } else {
        toast.error("Server error while resetting.", "Reset Failed");
      }
    } catch (e) {
      toast.error("Network connection error.", "Connection Error");
    } finally {
      setResetState({ confirming: null, loading: null });
    }
  };

  return (
    <div className="dashboard-page dashboard-page-contained">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-500/6 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-500/6 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 page-header-compact"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 text-xs font-semibold">
              <Settings size={14} /> System Settings
            </div>
            <span className="text-slate-600 text-xs font-medium hidden sm:block">
              Manage configuration and parameters for the audit engine
            </span>
          </div>
          <h2
            className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-600 to-slate-500"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            SYSTEM SETTINGS
          </h2>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* ── Engine Configuration ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md"
        >
          <SectionTitle
            icon={<Zap size={18} />}
            title="Engine Configuration"
            description="Cấu hình AI và hành vi quét tại runtime"
          />

          {/* AI Enabled Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${engineConfig.ai_enabled
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600"
                : "bg-slate-500/10 border-slate-500/20 text-slate-500"
                }`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">AI-Powered Analysis</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {engineConfig.ai_enabled
                    ? "Kết hợp AI — Hybrid Validation + Deep Reasoning + Cross-Check (tốn token)"
                    : "Chỉ phân tích tĩnh — Regex + AST (nhanh, miễn phí)"}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleEngineConfigChange("ai_enabled", !engineConfig.ai_enabled)}
              className="relative shrink-0 group"
              title={engineConfig.ai_enabled ? "Click to disable AI" : "Click to enable AI"}
            >
              {engineConfig.ai_enabled ? (
                <ToggleRight size={36} className="text-emerald-600 transition-colors" />
              ) : (
                <ToggleLeft size={36} className="text-slate-600 group-hover:text-slate-500 transition-colors" />
              )}
            </button>
          </div>

          {engineConfig.ai_enabled && (
            <>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${engineConfig.ai_mode === "openai_batch"
                      ? "bg-violet-500/10 border-violet-500/25 text-violet-600"
                      : "bg-cyan-500/10 border-cyan-500/25 text-cyan-600"
                      }`}>
                      <Activity size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">AI Execution Mode</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {engineConfig.ai_mode === "openai_batch"
                          ? "OpenAI Batch API chính thức — bất đồng bộ, tối ưu chi phí, không stream realtime."
                          : "Realtime API hiện tại — dùng proxy/local endpoint như hệ thống đang chạy."}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shrink-0">
                    {[
                      { key: "realtime", label: "Realtime" },
                      { key: "openai_batch", label: "OpenAI Batch" },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        onClick={() => handleEngineConfigChange("ai_mode", mode.key)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${engineConfig.ai_mode === mode.key
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {engineConfig.ai_mode === "realtime" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 mb-4">
                  <Info size={14} className="text-cyan-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-cyan-700/90 leading-relaxed">
                    Realtime mode tiếp tục dùng cấu hình API hiện tại của backend (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Khi tắt OpenAI Batch, hệ thống quay về đúng luồng này.
                  </p>
                </div>
              )}

              {engineConfig.ai_mode === "openai_batch" && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 mb-4">
                    <Info size={14} className="text-violet-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-violet-700/90 leading-relaxed">
                      Batch mode dùng OpenAI Batch API chính thức cho toàn bộ pipeline AI. Luồng này chờ batch hoàn tất ở backend, có thể resume sau restart và không tự động fallback về realtime nếu submit/poll thất bại.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl border bg-violet-500/10 border-violet-500/25 text-violet-600">
                        <Cpu size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">OpenAI Batch Model</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Model dùng riêng cho OpenAI Batch API
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={engineConfig.openai_batch_model}
                      onChange={(e) => handleEngineConfigChange("openai_batch_model", e.target.value)}
                      className="w-44 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border ${engineConfig.openai_batch_api_key_configured
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600"
                          : "bg-amber-500/10 border-amber-500/25 text-amber-600"
                          }`}>
                          <Lock size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">OpenAI Batch API Key</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Lưu mã hóa trong database. API không trả lại plaintext sau khi lưu.
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${engineConfig.openai_batch_api_key_configured
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}>
                        {engineConfig.openai_batch_api_key_configured ? "Configured" : "Missing"}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 flex-wrap">
                      <input
                        type="password"
                        value={engineConfig.openai_batch_api_key}
                        onChange={(e) => handleEngineConfigChange("openai_batch_api_key", e.target.value)}
                        placeholder={engineConfig.openai_batch_api_key_configured ? "••••••••••••••••" : "sk-..."}
                        className="flex-1 min-w-[240px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-mono focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder:text-slate-400"
                      />
                      <button
                        onClick={handleClearBatchKey}
                        className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all"
                      >
                        Clear Stored Key
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* AI Max Concurrency */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border bg-cyan-500/10 border-cyan-500/25 text-cyan-600">
                <Cpu size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">AI Parallel Requests</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Giới hạn số request AI chạy song song cho Validation + Deep Audit
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={engineConfig.ai_max_concurrency}
                onChange={(e) =>
                  handleEngineConfigChange(
                    "ai_max_concurrency",
                    Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)),
                  )
                }
                className="w-20 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-600 font-bold">reqs</span>
            </div>
          </div>

          {/* Authentication Required Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${engineConfig.auth_required
                ? "bg-blue-500/10 border-blue-500/25 text-blue-600"
                : "bg-amber-500/10 border-amber-500/25 text-amber-600"
                }`}>
                {engineConfig.auth_required ? <Lock size={16} /> : <LockOpen size={16} />}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Authentication Required</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {engineConfig.auth_required
                    ? "Yêu cầu đăng nhập Google OAuth để truy cập Dashboard"
                    : "Tắt xác thực — ai cũng truy cập được (chỉ dùng cho local / demo)"}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleEngineConfigChange("auth_required", !engineConfig.auth_required)}
              className="relative shrink-0 group"
              title={engineConfig.auth_required ? "Click to disable authentication" : "Click to enable authentication"}
            >
              {engineConfig.auth_required ? (
                <ToggleRight size={36} className="text-blue-600 transition-colors" />
              ) : (
                <ToggleLeft size={36} className="text-slate-600 group-hover:text-slate-500 transition-colors" />
              )}
            </button>
          </div>
          {!engineConfig.auth_required && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-4">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-600/80 leading-relaxed">
                <strong>Warning:</strong> Khi tắt xác thực, bất kỳ ai có quyền truy cập mạng đều có thể vào Dashboard mà không cần đăng nhập. Chỉ nên dùng trong môi trường local hoặc demo.
              </p>
            </div>
          )}

          {/* Member Recency Window */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border bg-violet-500/10 border-violet-500/25 text-violet-600">
                <Clock size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Member Recency Window</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Cửa sổ thời gian dùng để tính đánh giá thành viên từ Git authorship gần đây
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="24"
                value={engineConfig.member_recent_months}
                onChange={(e) =>
                  handleEngineConfigChange(
                    "member_recent_months",
                    Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 1)),
                  )
                }
                className="w-20 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-600 font-bold">months</span>
            </div>
          </div>

          {/* Test Mode Limit Files */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${engineConfig.test_mode_limit_files > 0
                ? "bg-amber-500/10 border-amber-500/25 text-amber-600"
                : "bg-slate-500/10 border-slate-500/20 text-slate-500"
                }`}>
                <FileSearch size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">File Scan Limit</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {engineConfig.test_mode_limit_files > 0
                    ? `Test Mode — Giới hạn ${engineConfig.test_mode_limit_files} files mỗi lần audit`
                    : "Production Mode — Quét toàn bộ files (không giới hạn)"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="999"
                value={engineConfig.test_mode_limit_files || ""}
                placeholder="∞"
                onChange={(e) => handleEngineConfigChange("test_mode_limit_files", Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-600 font-bold">files</span>
            </div>
          </div>

          {/* Regression Gate */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl border ${engineConfig.regression_gate_enabled
                ? "bg-rose-500/10 border-rose-500/25 text-rose-600"
                : "bg-slate-500/10 border-slate-500/20 text-slate-500"
                }`}>
                <TrendingUp size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800">Regression Gate</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Cảnh báo mềm khi lần scan mới xấu đi so với scan liền trước của cùng repository
                </div>
              </div>
              <button
                onClick={() => handleEngineConfigChange("regression_gate_enabled", !engineConfig.regression_gate_enabled)}
                className="relative shrink-0 group"
                title={engineConfig.regression_gate_enabled ? "Click to disable regression gate" : "Click to enable regression gate"}
              >
                {engineConfig.regression_gate_enabled ? (
                  <ToggleRight size={36} className="text-rose-600 transition-colors" />
                ) : (
                  <ToggleLeft size={36} className="text-slate-600 group-hover:text-slate-500 transition-colors" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Score Drop Threshold</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Cảnh báo khi score giảm ít nhất N điểm
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={engineConfig.regression_score_drop_threshold}
                      onChange={(e) =>
                        handleEngineConfigChange(
                          "regression_score_drop_threshold",
                          Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                        )
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                    />
                    <span className="text-[10px] text-slate-600 font-bold">pts</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Violations Increase</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Cảnh báo khi số finding tăng thêm ít nhất N
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      value={engineConfig.regression_violations_increase_threshold}
                      onChange={(e) =>
                        handleEngineConfigChange(
                          "regression_violations_increase_threshold",
                          Math.min(100000, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        )
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                    />
                    <span className="text-[10px] text-slate-600 font-bold">issues</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Pillar Drop Threshold</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Cảnh báo khi bất kỳ pillar nào giảm ít nhất N điểm
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={engineConfig.regression_pillar_drop_threshold}
                      onChange={(e) =>
                        handleEngineConfigChange(
                          "regression_pillar_drop_threshold",
                          Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)),
                        )
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                    />
                    <span className="text-[10px] text-slate-600 font-bold">pillar</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">New High Severity</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Cảnh báo khi có thêm ít nhất N finding Critical/Blocker
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      value={engineConfig.regression_new_critical_threshold}
                      onChange={(e) =>
                        handleEngineConfigChange(
                          "regression_new_critical_threshold",
                          Math.min(100000, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        )
                      }
                      className="w-24 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-mono text-center focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                    />
                    <span className="text-[10px] text-slate-600 font-bold">findings</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleEngineSave}
              disabled={engineSaving || !engineDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${engineDirty
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/15"
                : "bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed"
                }`}
            >
              {engineSaving ? <Zap className="animate-spin" size={14} /> : <Save size={14} />}
              {engineSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleTestAiConnection}
              disabled={aiTesting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 transition-all"
            >
              {aiTesting ? <Zap className="animate-spin" size={14} /> : <Wifi size={14} />}
              Test AI Connection
            </button>
            {aiTestResult && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${aiTestResult.status === "healthy"
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
                }`}>
                {aiTestResult.status === "healthy" ? <Wifi size={12} /> : <WifiOff size={12} />}
                {aiTestResult.status === "healthy"
                  ? `Healthy — ${aiTestResult.mode || "ai"} / ${aiTestResult.model || aiTestResult.provider || "configured"}`
                  : `Error — ${aiTestResult.reason?.substring(0, 40)}`}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── System Information ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md"
        >
          <SectionTitle
            icon={<Server size={18} />}
            title="System Information"
            description="Trạng thái engine và môi trường hiện tại"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard
              icon={<Cpu size={16} />}
              label="Engine"
              value={`V${import.meta.env.VITE_APP_VERSION || "1.0.0"} Stable`}
              iconClass="bg-blue-500/10 border-blue-500/20 text-blue-600"
              accent="border-blue-500/25 shadow-[0_0_15px_-5px_rgba(59,130,246,0.15)]"
            />
            <InfoCard
              icon={<Code2 size={16} />}
              label="Framework"
              value="React + FastAPI"
              iconClass="bg-violet-500/10 border-violet-500/20 text-violet-600"
              accent="border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]"
            />
            <InfoCard
              icon={<Clock size={16} />}
              label="AI Model"
              value={systemInfo?.model || "cx/gpt-5.4-mini"}
              iconClass="bg-cyan-500/10 border-cyan-500/20 text-cyan-600"
              accent="border-cyan-500/25 shadow-[0_0_15px_-5px_rgba(6,182,212,0.15)]"
            />
          </div>
        </motion.div>

        {/* ── Engine Configuration ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md"
        >
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Rule Overview"
            description={`Cấu hình rules cho: ${selectedRepoId || "chưa chọn"}`}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard
              icon={<ShieldCheck size={16} />}
              label="Core Rules"
              value={rulesInfo ? `${rulesInfo.coreCount} rules` : "—"}
              iconClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
              accent="border-emerald-500/25 shadow-[0_0_15px_-5px_rgba(16,185,129,0.15)]"
            />
            <InfoCard
              icon={<Zap size={16} />}
              label="Custom AI Rules"
              value={rulesInfo ? `${rulesInfo.customCount} rules` : "—"}
              iconClass="bg-violet-500/10 border-violet-500/20 text-violet-600"
              accent="border-violet-500/25 shadow-[0_0_15px_-5px_rgba(139,92,246,0.15)]"
            />
            <InfoCard
              icon={<AlertTriangle size={16} />}
              label="Disabled Rules"
              value={rulesInfo ? `${rulesInfo.disabledCount} rules` : "—"}
              iconClass="bg-amber-500/10 border-amber-500/20 text-amber-600"
              accent="border-amber-500/25 shadow-[0_0_15px_-5px_rgba(245,158,11,0.15)]"
            />
          </div>
        </motion.div>

        {/* ── Quick Links ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md"
        >
          <SectionTitle
            icon={<Info size={18} />}
            title="Quick Links"
            description="Tài liệu và tài nguyên hữu ích"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                label: "Documentation",
                href: "http://localhost:8001",
                desc: "MkDocs project docs",
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-violet-600 transition-colors">
                    {link.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {link.desc}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-slate-600 group-hover:text-blue-600 transition-colors shrink-0"
                />
              </a>
            ))}
          </div>
        </motion.div>

        {/* ── Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md"
        >
          <div className="border border-red-500/20 rounded-2xl p-6 bg-red-50">
            <h3 className="text-red-600 font-extrabold text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
              <ShieldAlert size={16} /> Danger Zone — Multi-Level Reset
            </h3>

            {/* ── GLOBAL Section ── */}
            <div className="mb-6 pb-6 border-b border-red-500/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-500/25">GLOBAL</span>
                <span className="text-sm font-bold text-slate-800">Áp dụng cho tất cả dự án</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { key: "g-toggles", level: "toggles", label: "Reset Toggles", desc: "Bật lại tất cả rules đã bị tắt ở Global", badgeColor: "bg-amber-500/15 text-amber-600 border-amber-500/25", btnIdle: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/25 hover:border-amber-500/40", icon: "🟡" },
                  { key: "g-weights", level: "weights", label: "Reset Penalties", desc: "Đưa điểm phạt của tất cả rules về giá trị gốc", badgeColor: "bg-orange-500/15 text-orange-600 border-orange-500/25", btnIdle: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/25 hover:border-orange-500/40", icon: "🟠" },
                  { key: "g-all", level: "all", label: "Reset All Global", desc: "Khôi phục toàn bộ Global config (toggles + weights)", badgeColor: "bg-red-500/15 text-red-600 border-red-500/25", btnIdle: "bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/25 hover:border-red-500/40", icon: "🔴" },
                ].map(item => {
                  const isConfirming = resetState.confirming === item.key;
                  const isLoading = resetState.loading === item.key;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-red-200 transition-all shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800">{item.label}</div>
                          <div className="text-[11px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLevelReset("GLOBAL", item.level, item.key)}
                        disabled={isLoading}
                        className={cn(
                          "px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 ml-3",
                          isLoading
                            ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                            : isConfirming
                              ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)] animate-pulse"
                              : item.btnIdle,
                        )}
                      >
                        {isLoading ? <Zap className="animate-spin" size={13} /> : <Trash2 size={13} />}
                        {isLoading ? "..." : isConfirming ? "Confirm?" : "Reset"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {resetState.confirming?.startsWith("g-") && (
                <p className="mt-2 text-[11px] text-red-600/70 font-medium">
                  Nhấn lần nữa để xác nhận. Tự hủy sau 4 giây.
                </p>
              )}
            </div>

            {/* ── PROJECT Section ── */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/25">PROJECT</span>
                <span className="text-sm font-bold text-slate-800">Chỉ áp dụng cho dự án đang chọn</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-4 ml-1">
                Target:{" "}
                <strong className="text-violet-600 font-mono bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                  {selectedRepoId || "None"}
                </strong>
              </p>
              <div className="space-y-2.5">
                {[
                  { key: "p-toggles", level: "toggles", label: "Reset Overrides", desc: "Đồng bộ bật/tắt rule với Global (giữ weights + custom rules)", btnIdle: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/25 hover:border-amber-500/40", icon: "🟡" },
                  { key: "p-weights", level: "weights", label: "Reset Penalties", desc: "Đưa điểm phạt về mặc định (giữ toggles + custom rules)", btnIdle: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/25 hover:border-orange-500/40", icon: "🟠" },
                  { key: "p-custom", level: "custom", label: "Reset Custom Rules", desc: "Xóa toàn bộ AI rules đã tạo bằng Rule Builder", btnIdle: "bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 border border-violet-500/25 hover:border-violet-500/40", icon: "🟣" },
                  { key: "p-all", level: "all", label: "Reset All Project", desc: "Xóa toàn bộ cấu hình dự án — nuclear option", btnIdle: "bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/25 hover:border-red-500/40", icon: "🔴" },
                ].map(item => {
                  const isConfirming = resetState.confirming === item.key;
                  const isLoading = resetState.loading === item.key;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-red-200 transition-all shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800">{item.label}</div>
                          <div className="text-[11px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLevelReset(selectedRepoId, item.level, item.key)}
                        disabled={!selectedRepoId || isLoading}
                        className={cn(
                          "px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 ml-3",
                          !selectedRepoId || isLoading
                            ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                            : isConfirming
                              ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)] animate-pulse"
                              : item.btnIdle,
                        )}
                      >
                        {isLoading ? <Zap className="animate-spin" size={13} /> : <Trash2 size={13} />}
                        {isLoading ? "..." : isConfirming ? "Confirm?" : "Reset"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {resetState.confirming?.startsWith("p-") && (
                <p className="mt-2 text-[11px] text-red-600/70 font-medium">
                  Nhấn lần nữa để xác nhận. Tự hủy sau 4 giây.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsView;
