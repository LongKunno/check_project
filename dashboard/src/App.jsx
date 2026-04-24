import React, { useState, useEffect, Suspense } from "react";
import {
  Zap,
  X,
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
const RepositoryView = React.lazy(() => import("./components/views/RepositoryView"));
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
const AiOpsView = React.lazy(() => import("./components/views/AiOpsView"));
const AiCacheView = React.lazy(() => import("./components/views/AiCacheView"));
const TrendsView = React.lazy(() => import("./components/views/TrendsView"));
import { Sidebar } from "./components/layout/Sidebar";
import PageTransition from "./components/ui/PageTransition";
import { CardSkeleton, TableSkeleton } from "./components/ui/SkeletonLoader";
import { useToast } from "./components/ui/Toast";
import { useRepositories } from "./hooks/useRepositories";
import { useAuditState } from "./hooks/useAuditState";
import ProtectedRoute from "./components/auth/ProtectedRoute";
const LoginPage = React.lazy(() => import("./components/auth/LoginPage"));
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [reportView, setReportView] = useState("project"); // 'project' or 'member'
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState("project"); // legacy, kept for safety
  const completedCancelToastRef = React.useRef(null);

  // ── Hooks Custom ──────────────────────────────────────────────────────────
  const {
    configuredRepos,
    selectedRepoId,
    setSelectedRepoId,
  } = useRepositories();

  const {
    data,
    setData,
    error,
    isAuditing,
    jobId,
    auditStatus,
    auditProgress,
    isCancelling,
    visibleLimit,
    setVisibleLimit,
    fixingId,
    suggestions,
    activeTab,
    runAudit,
    cancelAudit,
    fetchFixSuggestion,
  } = useAuditState(selectedRepoId, configuredRepos);

  // ── AI Health ──────────────────────────────────────────────────────────────
  const [aiHealth, setAiHealth] = useState({ status: "checking", model: "" });

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

  useEffect(() => {
    if (auditStatus !== "cancelled" || !jobId) return;
    if (completedCancelToastRef.current === jobId) return;

    completedCancelToastRef.current = jobId;
    toast.info(
      "Audit đã dừng an toàn. Các request AI mới đã bị chặn.",
      "Audit Cancelled",
    );
  }, [auditStatus, jobId, toast]);

  // ── Mouse Spotlight ────────────────────────────────────────────────────────
  const glowRef = React.useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(800px circle at ${e.clientX}px ${e.clientY}px, rgba(139, 92, 246, 0.03), transparent 40%)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ── Utils ──────────────────────────────────────────────────────────────────
  const cn = (...classes) => classes.filter(Boolean).join(" ");

  const getSeverityClass = (weight) => {
    if (weight <= -5) return "status-high";
    if (weight <= -3) return "status-medium";
    return "status-low";
  };

  // Đồng bộ selectedMember khi data thay đổi
  useEffect(() => {
    if (data?.scores?.members) {
      const memberKeys = Object.keys(data.scores.members);
      if (memberKeys.length > 0) {
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

  // ── LOGIN PAGE: render outside dashboard layout ──
  if (location.pathname === "/login") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen w-full bg-slate-50" />}>
        <LoginPage />
      </Suspense>
    );
  }

  // ── DASHBOARD: protected by auth ──
  return (
    <ProtectedRoute>
      <div className="flex h-screen w-screen overflow-hidden font-sans text-slate-700">

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
        <div className="relative min-w-0 flex-1 overflow-y-auto no-scrollbar bg-gradient-to-br from-slate-100 via-sky-50/40 to-violet-50/30">
          {/* Dynamic Mouse Spotlight overlay (Optimized with Ref) */}
          <div
            ref={glowRef}
            className="pointer-events-none fixed inset-0 z-[100]"
            style={{
              background: `radial-gradient(800px circle at -100px -100px, rgba(139, 92, 246, 0.03), transparent 40%)`,
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
                "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
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
                "radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 60%)",
              filter: "blur(140px)",
              zIndex: 0,
              pointerEvents: "none",
              animation: "blob-float-2 25s infinite alternate ease-in-out",
            }}
          />

          <div className="dashboard-container relative z-10 flex min-h-screen w-full min-w-0 flex-col pb-8">
            <header
              className={cn(
                "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200 shrink-0 mb-6",
                (location.pathname.startsWith("/project-scores") ||
                  location.pathname.startsWith("/trends") ||
                  location.pathname.startsWith("/member-scores") ||
                  location.pathname.startsWith("/history") ||
                  location.pathname.startsWith("/ai-ops") ||
                  location.pathname.startsWith("/ai-cache") ||
                  location.pathname.startsWith("/settings") ||
                  location.pathname.startsWith("/rules") ||
                  location.pathname.startsWith("/sandbox") ||
                  location.pathname.startsWith("/presentations") ||
                  location.pathname.startsWith("/repositories")) &&
                "hidden",
              )}
            >
              {/* Context Title - Only shown on /audit */}
              <div className="flex flex-col page-header-compact">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold"
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
                  className="text-3xl lg:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-blue-600 to-blue-500"
                  style={{ fontFamily: "Outfit, sans-serif" }}
                >
                  AUDIT DASHBOARD
                </h1>
              </div>

              {(location.pathname.startsWith("/audit") ||
                location.pathname === "/") && (
                  <div className="flex items-center gap-4 flex-wrap justify-end ml-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
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
                          const cancelResult = await cancelAudit(jobId);
                          if (cancelResult?.message) {
                            toast.warning(cancelResult.message, "Cancel Requested");
                          }
                        }}
                        disabled={isCancelling || !jobId}
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
                      <div className="pt-6 pb-4 shrink-0 page-header-compact">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold">
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
                          className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-emerald-600 to-emerald-500"
                          style={{ fontFamily: "Outfit, sans-serif" }}
                        >
                          RULE MANAGER
                        </h2>
                      </div>
                      <Suspense
                        fallback={
                          <div className="w-full h-full opacity-0 pointer-events-none" />
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
                      <div className="pt-6 pb-4 shrink-0 page-header-compact">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold">
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
                          className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-800 via-fuchsia-700 to-pink-600"
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
                  path="/repositories"
                  element={
                    <div
                      className="flex-1 flex flex-col w-full"
                      style={{ minHeight: "calc(100vh - 100px)" }}
                    >
                      <Suspense
                        fallback={
                          <div className="p-8 space-y-6">
                            <CardSkeleton count={3} />
                            <TableSkeleton rows={5} cols={4} />
                          </div>
                        }
                      >
                        <RepositoryView />
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
                  path="/ai-ops"
                  element={
                    <div
                      className="flex-1 flex flex-col w-full"
                      style={{ minHeight: "calc(100vh - 100px)" }}
                    >
                      <Suspense
                        fallback={
                          <div className="p-8 space-y-6">
                            <CardSkeleton count={4} />
                            <TableSkeleton rows={6} cols={7} />
                          </div>
                        }
                      >
                        <AiOpsView selectedRepoId={selectedRepoId} />
                      </Suspense>
                    </div>
                  }
                />
                <Route
                  path="/ai-cache"
                  element={
                    <div
                      className="flex-1 flex flex-col w-full"
                      style={{ minHeight: "calc(100vh - 100px)" }}
                    >
                      <Suspense
                        fallback={
                          <div className="p-8 space-y-6">
                            <CardSkeleton count={4} />
                            <TableSkeleton rows={4} cols={4} />
                          </div>
                        }
                      >
                        <AiCacheView />
                      </Suspense>
                    </div>
                  }
                />
                <Route
                  path="/trends"
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
                        <TrendsView
                          selectedRepoId={selectedRepoId}
                          targetUrl={
                            configuredRepos.find((r) => r.id === selectedRepoId)
                              ?.url
                          }
                          configuredRepos={configuredRepos}
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
                        auditProgress={auditProgress}
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
    </ProtectedRoute>
  );
}

export default App;
