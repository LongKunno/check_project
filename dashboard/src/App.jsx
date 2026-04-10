import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Shield,
  ShieldCheck,
  Settings,
  FileSearch,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Code2,
  Search,
  Zap,
  FolderOpen,
  Upload,
  X,
  Wrench,
  CheckSquare,
  Users,
  Wand2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  Trash2,
} from "lucide-react";

import {
  Chart as ChartJS,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

const RuleManager = React.lazy(() => import("./components/nlre/RuleManager"));
const RuleBuilder = React.lazy(() => import("./components/nlre/RuleBuilder"));
const HistoryView = React.lazy(() => import("./components/views/HistoryView"));
const SettingsView = React.lazy(
  () => import("./components/views/SettingsView"),
);
const AuditView = React.lazy(() => import("./components/views/AuditView"));
const ProjectScoresView = React.lazy(
  () => import("./components/views/ProjectScoresView"),
);
const MemberScoresView = React.lazy(() =>
  import("./components/views/MemberScoresView").then((m) => ({
    default: m.MemberScoresView,
  })),
);
const PresentationsStaticView = React.lazy(
  () => import("./components/views/PresentationsStaticView"),
);
import { Sidebar } from "./components/layout/Sidebar";
import PageTransition from "./components/ui/PageTransition";
import { CardSkeleton, TableSkeleton } from "./components/ui/SkeletonLoader";
import { useAuditJob } from "./hooks/useAuditJob";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("remote"); // 'local' or 'remote'
  const location = useLocation();
  const navigate = useNavigate();
  const [reportView, setReportView] = useState("project"); // 'project' or 'member'
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState("project"); // legacy, kept for safety
  const [expandedMember, setExpandedMember] = useState(null);
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const glowRef = React.useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(800px circle at ${e.clientX}px ${e.clientY}px, rgba(139, 92, 246, 0.08), transparent 40%)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const cn = (...classes) => classes.filter(Boolean).join(" ");

  // Fetch configured repositories on mount
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch("/api/repositories");
        if (response.ok) {
          const result = await response.json();
          if (result.status === "success") {
            setConfiguredRepos(result.data);

            // Cố gắng tìm dự án có lần chấm điểm gần nhất
            try {
              const histRes = await fetch("/api/history");
              if (histRes.ok) {
                const globalHistory = await histRes.json();
                if (globalHistory && globalHistory.length > 0) {
                  const latestAudit = globalHistory[0];
                  const matchedRepo = result.data.find(
                    (r) => r.url === latestAudit.target,
                  );
                  if (matchedRepo) {
                    setSelectedRepoId(matchedRepo.id);
                    return; // Đặt selectedRepoId theo history gần nhất
                  }
                }
              }
            } catch (err) {
              console.error("Failed to fetch global history:", err);
            }

            // Fallback lấy dự án đầu tiên
            if (result.data.length > 0) {
              setSelectedRepoId(result.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch configured repositories:", err);
      }
    };
    fetchRepos();
  }, []);

  const handleRepoUrlChange = (e) => {
    const val = e.target.value;
    setRepoUrl(val);
    try {
      if (
        val.includes("bitbucket.org") ||
        val.includes("github.com") ||
        val.includes("gitlab.com")
      ) {
        let cleanVal = val.trim();
        // Remove trailing slash if exists
        if (cleanVal.endsWith("/")) cleanVal = cleanVal.slice(0, -1);

        const urlObj = new URL(cleanVal);
        const parts = urlObj.pathname.split("/").filter(Boolean);

        if (parts.length >= 2) {
          const user = parts[0];
          const repo = parts[1].replace(".git", "");
          setRepoUsername(user);

          // Construct a clean .git URL if not already one
          let finalGitUrl = cleanVal;
          if (!cleanVal.endsWith(".git")) {
            finalGitUrl = `https://${urlObj.host}/${user}/${repo}.git`;
          }
          setRepoUrl(finalGitUrl);
        }
      }
    } catch (err) {
      // Ignore invalid URLs while typing
    }
  };
  const [repoUsername, setRepoUsername] = useState("");
  const [repoToken, setRepoToken] = useState("");

  // TÍCH HỢP HOOK KIỂM TOÁN V6 (BACKGROUND JOBS)
  const {
    status: auditStatus,
    error: auditError,
    result: auditResult,
    jobId,
    message: auditMessage,
    startAudit,
    stopAudit,
  } = useAuditJob();

  const isAuditing = auditStatus === "starting" || auditStatus === "running";

  const [folderName, setFolderName] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Đồng bộ kết quả (result) và lỗi (error) từ Hook sang State nội bộ do History cần dùng chung biến data
  useEffect(() => {
    if (auditResult) {
      setData(auditResult);
    }
  }, [auditResult]);

  useEffect(() => {
    if (auditError) {
      setError(auditError);
    }
  }, [auditError]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [preparingProgress, setPreparingProgress] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [aiHealth, setAiHealth] = useState({ status: "checking", model: "" });
  const [history, setHistory] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const [suggestions, setSuggestions] = useState({});

  const filesRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check AI Health on mount
  useEffect(() => {
    const checkAi = async () => {
      try {
        const res = await fetch("/api/health/ai");
        if (res.ok) {
          const d = await res.json();
          setAiHealth(d);
        } else {
          setAiHealth({ status: "unhealthy", reason: "Server error" });
        }
      } catch (err) {
        setAiHealth({ status: "unhealthy", reason: err.message });
      }
    };
    checkAi();
  }, []);

  const fetchFixSuggestion = async (violation) => {
    if (fixingId === violation.id) return;
    setFixingId(violation.id);
    try {
      const res = await fetch("/api/audit/fix-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: violation.file,
          snippet: violation.snippet,
          reason: violation.reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => ({
          ...prev,
          [violation.id]: data.suggestion,
        }));
      }
    } catch (err) {
      console.error("Fix error:", err);
    } finally {
      setFixingId(null);
    }
  };

  // Reset visible limit on view change
  useEffect(() => {
    setVisibleLimit(50);
  }, [data, reportView, selectedMember]);

  // Đồng bộ selectedMember khi data thay đổi (tránh lỗi stale author từ dự án cũ)
  useEffect(() => {
    if (data?.scores?.members) {
      const memberKeys = Object.keys(data.scores.members);
      if (memberKeys.length > 0) {
        // Nếu member cũ không còn tồn tại trong list mới -> reset về người đầu tiên
        if (!selectedMember || !memberKeys.includes(selectedMember)) {
          setSelectedMember(memberKeys[0]);
        }
      } else {
        setSelectedMember(null);
      }
    } else {
      setSelectedMember(null);
    }
  }, [data]);

  // Phục hồi trạng thái (State Recovery) & Đồng bộ
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/audit/status");
        const d = await res.json();

        if (d.is_running && !isAuditing) {
          setIsAuditing(true);
        } else if (!d.is_running && isAuditing) {
          setIsAuditing(false);
          setIsCancelling(false);
          setIsPreparing(false);
          setUploadProgress(0);
        }
      } catch (err) {
        // Bỏ qua lỗi kết nối tạm thời
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [isAuditing]);

  // Tự động nạp kết quả kiểm toán gần nhất khi mở trang hoặc thay đổi dự án
  useEffect(() => {
    const loadTargetAudit = async () => {
      let target = null;
      if (activeTab === "remote" && selectedRepoId) {
        const repo = configuredRepos.find((r) => r.id === selectedRepoId);
        if (repo) target = repo.url;
      } else if (activeTab === "local" && folderName) {
        target = folderName;
      }

      if (!target) return;

      try {
        const response = await fetch(
          `/api/history?target=${encodeURIComponent(target)}`,
        );
        if (response.ok) {
          const result = await response.json();
          if (result && result.length > 0) {
            // Lấy ID của lần quét gần nhất và gọi lấy chi tiết
            const auditId = result[0].id;
            const detailRes = await fetch(`/api/history/${auditId}`);
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (detail && detail.full_json) {
                setData(detail.full_json);
                return;
              }
            }
          }
          setData(null); // Reset nếu chưa bao giờ audit dự án này hoặc có lỗi
        }
      } catch (err) {
        console.error("Failed to load target audit:", err);
      }
    };
    loadTargetAudit();
  }, [selectedRepoId, folderName, activeTab, configuredRepos]);

  // Xoá logic EventSource bên trong App vì đã chuyển sang TerminalLogs

  const handleFolderSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    filesRef.current = files; // Lưu vào ref để tránh lag React state
    setFileCount(files.length);
    setError(null);
    setData(null);
    // Lấy tên thư mục từ file đầu tiên
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const name = firstPath.split("/")[0] || "project";
    setFolderName(name);
  };

  const runAudit = async () => {
    if (activeTab === "remote") {
      if (!selectedRepoId) {
        setError("Please select a project from the list.");
        return;
      }
      setError(null);
      setData(null);

      // Khởi động bằng Hook
      startAudit({ id: selectedRepoId }, false);
      return;
    }

    const files = filesRef.current;
    if (!files || files.length === 0) {
      setError("Please select a folder to audit.");
      return;
    }

    setIsPreparing(true);
    setError(null);
    setData(null);
    setUploadProgress(0);
    setPreparingProgress(0);

    try {
      const formData = new FormData();
      const total = files.length;
      const batchSize = 5000;

      // Xử lý theo đợt để không treo Main Thread (Hàng chục ngàn file)
      for (let i = 0; i < total; i += batchSize) {
        for (let j = i; j < Math.min(i + batchSize, total); j++) {
          const file = files[j];
          formData.append("files", file, file.webkitRelativePath || file.name);
        }

        const currentCount = Math.min(i + batchSize, total);
        const progress = Math.min(
          Math.round((currentCount / total) * 100),
          100,
        );
        setPreparingProgress(progress);

        // Nhường CPU cho UI render
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setIsPreparing(false);
      setUploadProgress(100); // Ảo upload progress xí cho vui vì background lo

      startAudit(formData, true);
    } catch (err) {
      console.error("CHI TIẾT LỖI TẠO UPLOAD:", err);
      setError(err.message);
    } finally {
      setIsPreparing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const fetchHistory = async (path) => {
    try {
      const response = await fetch(
        `/api/history?target=${encodeURIComponent(path)}`,
      );
      if (response.ok) {
        const historyData = await response.json();
        setHistory(historyData.reverse());
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    }
  };

  useEffect(() => {
    if (data?.target) {
      fetchHistory(data.target);
    }
  }, [data]);

  const getSeverityClass = (weight) => {
    if (weight <= -5) return "status-high";
    if (weight <= -3) return "status-medium";
    return "status-low";
  };

  // Removed duplicate getScoreColorClass

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-slate-300">
      {/* SIDEBAR */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        selectedRepoId={selectedRepoId}
        setSelectedRepoId={setSelectedRepoId}
        configuredRepos={configuredRepos}
        aiHealth={aiHealth}
        cn={cn}
      />
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto relative no-scrollbar bg-transparent">
        {/* Dynamic Mouse Spotlight overlay (Optimized with Ref) */}
        <div
          ref={glowRef}
          className="pointer-events-none fixed inset-0 z-[100]"
          style={{
            background: `radial-gradient(800px circle at -100px -100px, rgba(139, 92, 246, 0.08), transparent 40%)`,
          }}
        />

        {/* Decorative background blobs with breathing animations */}
        <div
          className="aurora-blob"
          style={{
            position: "fixed",
            top: "-10%",
            right: "-5%",
            width: "60vw",
            height: "60vw",
            background:
              "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 60%)",
            filter: "blur(120px)",
            zIndex: 0,
            pointerEvents: "none",
            animation: "blob-float-1 20s infinite alternate ease-in-out",
          }}
        />
        <div
          className="aurora-blob"
          style={{
            position: "fixed",
            bottom: "-10%",
            left: "-10%",
            width: "70vw",
            height: "70vw",
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 60%)",
            filter: "blur(140px)",
            zIndex: 0,
            pointerEvents: "none",
            animation: "blob-float-2 25s infinite alternate ease-in-out",
          }}
        />

        <div className="dashboard-container relative z-10 w-full min-h-screen flex flex-col pb-8">
          <header
            className={cn(
              "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-navbar/30 border-white/5 shrink-0 mb-6",
              (location.pathname.startsWith("/project-scores") ||
                location.pathname.startsWith("/member-scores") ||
                location.pathname.startsWith("/history") ||
                location.pathname.startsWith("/settings") ||
                location.pathname.startsWith("/rules") ||
                location.pathname.startsWith("/sandbox") ||
                location.pathname.startsWith("/presentations")) &&
                "hidden",
            )}
          >
            {/* Context Title - Only shown on /audit */}
            <div className="flex flex-col page-header-compact">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold"
                  style={{ width: "fit-content" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Audit Engine
                </div>
                <span className="text-slate-600 text-xs font-medium hidden sm:block">
                  Analyze and evaluate code quality in real time
                </span>
              </div>
              <h1
                className="text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-blue-400"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                AUDIT DASHBOARD
              </h1>
            </div>

            {(location.pathname.startsWith("/audit") ||
              location.pathname === "/") && (
              <div className="flex items-center gap-4 flex-wrap justify-end ml-auto bg-black/20 p-2.5 rounded-2xl border border-white/5">
                <button
                  className="btn-audit"
                  onClick={runAudit}
                  disabled={isAuditing || !selectedRepoId}
                >
                  {isAuditing ? (
                    <Zap className="spin" size={16} />
                  ) : (
                    <Zap size={16} />
                  )}
                  <span>
                    {isAuditing
                      ? isCancelling
                        ? "CANCELLING..."
                        : "AUDITING..."
                      : "RUN AUDIT"}
                  </span>
                </button>

                {isAuditing && (
                  <button
                    onClick={async () => {
                      setIsCancelling(true);
                      try {
                        await fetch("/api/audit/cancel", { method: "POST" });
                      } catch (e) {}
                    }}
                    disabled={isCancelling}
                    className="btn-stop"
                    title="Cancel audit"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
          </header>

          <PageTransition pageKey={location.pathname}>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/project-scores" replace />}
              />
              <Route
                path="/rules"
                element={
                  <div
                    key="view-rules"
                    className="flex-1 flex flex-col w-full pb-8"
                  >
                    {/* Header mới cho Rules */}
                    <div className="px-8 pt-8 pb-4 shrink-0 page-header-compact">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                          </svg>
                          Rule Manager
                        </div>
                        <span className="text-slate-600 text-xs font-medium hidden sm:block">
                          Manage, adjust weights, and toggle audit rules
                        </span>
                      </div>
                      <h2
                        className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-emerald-400"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        RULE MANAGER
                      </h2>
                    </div>
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <RuleManager
                        targetId={selectedRepoId}
                        projectName={
                          configuredRepos.find((r) => r.id === selectedRepoId)
                            ?.name || selectedRepoId
                        }
                      />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/sandbox"
                element={
                  <div
                    key="view-sandbox"
                    className="flex-1 flex flex-col w-full pb-8"
                  >
                    {/* Header mới cho Sandbox */}
                    <div className="px-8 pt-8 pb-4 shrink-0 page-header-compact">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
                          </svg>
                          Rule Builder
                        </div>
                        <span className="text-slate-600 text-xs font-medium hidden sm:block">
                          Design rules with natural language and test instantly
                        </span>
                      </div>
                      <h2
                        className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-violet-400"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        AI RULE BUILDER
                      </h2>
                    </div>
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <RuleBuilder
                        targetId={selectedRepoId}
                        projectName={
                          configuredRepos.find((r) => r.id === selectedRepoId)
                            ?.name || selectedRepoId
                        }
                      />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/settings"
                element={
                  <div
                    className="flex-1 flex flex-col w-full"
                    style={{ minHeight: "calc(100vh - 100px)" }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <SettingsView selectedRepoId={selectedRepoId} cn={cn} />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/history"
                element={
                  <div
                    className="flex-1 flex flex-col w-full"
                    style={{ minHeight: "calc(100vh - 100px)" }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <HistoryView
                        selectedRepoId={selectedRepoId}
                        targetUrl={
                          configuredRepos.find((r) => r.id === selectedRepoId)
                            ?.url
                        }
                        onRestoreAudit={(fullJson) => {
                          setData(fullJson);
                          navigate("/audit");
                        }}
                        cn={cn}
                      />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/project-scores"
                element={
                  <div
                    className="flex-1 flex flex-col w-full"
                    style={{ minHeight: "calc(100vh - 100px)" }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <ProjectScoresView
                        cn={cn}
                        onSelectProject={(repoId) => {
                          setSelectedRepoId(repoId);
                          navigate("/audit");
                        }}
                      />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/member-scores"
                element={
                  <div
                    className="flex-1 flex flex-col w-full"
                    style={{ minHeight: "calc(100vh - 100px)" }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <MemberScoresView cn={cn} />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/presentations"
                element={
                  <div
                    className="flex-1 flex flex-col w-full"
                    style={{ minHeight: "calc(100vh - 100px)" }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-8 space-y-6">
                          <CardSkeleton count={4} />
                          <TableSkeleton rows={5} cols={4} />
                        </div>
                      }
                    >
                      <PresentationsStaticView />
                    </Suspense>
                  </div>
                }
              />
              <Route
                path="/audit"
                element={
                  <Suspense
                    fallback={
                      <div className="p-8 space-y-6">
                        <CardSkeleton count={4} />
                        <TableSkeleton rows={5} cols={4} />
                      </div>
                    }
                  >
                    <AuditView
                      data={data}
                      error={error}
                      isAuditing={isAuditing}
                      jobId={jobId}
                      reportView={reportView}
                      setReportView={setReportView}
                      selectedMember={selectedMember}
                      setSelectedMember={setSelectedMember}
                      activeLedgerTab={activeLedgerTab}
                      visibleLimit={visibleLimit}
                      setVisibleLimit={setVisibleLimit}
                      fixingId={fixingId}
                      suggestions={suggestions}
                      fetchFixSuggestion={fetchFixSuggestion}
                      activeTab={activeTab}
                      getSeverityClass={getSeverityClass}
                      cn={cn}
                    />
                  </Suspense>
                }
              />
            </Routes>
          </PageTransition>
        </div>
      </div>
    </div>
  );
}

export default App;
