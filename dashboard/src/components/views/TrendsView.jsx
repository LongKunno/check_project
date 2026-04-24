import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bar, Line } from "react-chartjs-2";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  FolderOpen,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import EmptyState from "../ui/EmptyState";
import { CardSkeleton, TableSkeleton } from "../ui/SkeletonLoader";
import TopProgressBar from "../ui/TopProgressBar";
import { getRegressionMeta, getRegressionSummaryLine } from "../../utils/regressionHelpers";

const RANGE_OPTIONS = [7, 30, 90];

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        font: { weight: "bold" },
      },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#f8fafc",
      bodyColor: "#cbd5e1",
      padding: 12,
      cornerRadius: 12,
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: "#64748b" },
      grid: { color: "rgba(148, 163, 184, 0.08)" },
    },
    y: {
      ticks: { color: "#64748b" },
      grid: { color: "rgba(148, 163, 184, 0.08)" },
      beginAtZero: true,
    },
  },
};

const SummaryCard = ({ icon, label, value, accent }) => (
  <div
    className={`flex items-center gap-3 p-4 rounded-2xl bg-white border shadow-sm ${accent}`}
  >
    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        {label}
      </div>
      <div className="text-lg font-black text-slate-800">{value}</div>
    </div>
  </div>
);

const SectionShell = ({ title, description, children }) => (
  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
    <div className="mb-5">
      <h3 className="text-lg font-black text-slate-800">{title}</h3>
      {description ? (
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      ) : null}
    </div>
    {children}
  </div>
);

const ChartCard = ({ title, children, height = 260 }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
    <div className="text-sm font-bold text-slate-700 mb-4">{title}</div>
    <div style={{ height }}>{children}</div>
  </div>
);

function TrendsView({ selectedRepoId, targetUrl, configuredRepos = [] }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [portfolioData, setPortfolioData] = useState(null);
  const [repositoryData, setRepositoryData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);
  const [repositoryError, setRepositoryError] = useState(null);

  const selectedRepo = useMemo(
    () => configuredRepos.find((repo) => repo.id === selectedRepoId),
    [configuredRepos, selectedRepoId],
  );

  const fetchPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      const res = await fetch(`/api/trends/portfolio?days=${rangeDays}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || "Unable to load portfolio trends");
      setPortfolioData(payload.data);
    } catch (err) {
      setPortfolioError(err.message);
    } finally {
      setPortfolioLoading(false);
    }
  }, [rangeDays]);

  const fetchRepository = useCallback(async () => {
    if (!targetUrl) {
      setRepositoryData(null);
      setRepositoryError(null);
      setRepositoryLoading(false);
      return;
    }

    setRepositoryLoading(true);
    setRepositoryError(null);
    try {
      const res = await fetch(
        `/api/trends/repository?target=${encodeURIComponent(targetUrl)}&days=${rangeDays}`,
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || "Unable to load repository trends");
      setRepositoryData(payload.data);
    } catch (err) {
      setRepositoryError(err.message);
    } finally {
      setRepositoryLoading(false);
    }
  }, [rangeDays, targetUrl]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    fetchRepository();
  }, [fetchRepository]);

  const portfolioScoreChart = useMemo(() => {
    const labels = portfolioData?.score_series?.map((item) => item.date) || [];
    return {
      labels,
      datasets: [
        {
          label: "Avg score",
          data: portfolioData?.score_series?.map((item) => item.avg_score) || [],
          borderColor: "#ec4899",
          backgroundColor: "rgba(236, 72, 153, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [portfolioData]);

  const portfolioVolumeChart = useMemo(() => {
    const labels = portfolioData?.scan_volume_series?.map((item) => item.date) || [];
    return {
      labels,
      datasets: [
        {
          label: "Scans",
          data: portfolioData?.scan_volume_series?.map((item) => item.scans) || [],
          backgroundColor: "rgba(99, 102, 241, 0.78)",
          borderRadius: 10,
        },
        {
          label: "Warnings",
          data: portfolioData?.regression_series?.map((item) => item.warnings) || [],
          backgroundColor: "rgba(244, 63, 94, 0.65)",
          borderRadius: 10,
        },
      ],
    };
  }, [portfolioData]);

  const repositoryScoreChart = useMemo(() => {
    const labels = repositoryData?.score_series?.map((item) => item.timestamp) || [];
    return {
      labels,
      datasets: [
        {
          label: "Score",
          data: repositoryData?.score_series?.map((item) => item.score) || [],
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [repositoryData]);

  const repositoryViolationsChart = useMemo(() => {
    const labels =
      repositoryData?.violations_series?.map((item) => item.timestamp) || [];
    return {
      labels,
      datasets: [
        {
          label: "Violations",
          data:
            repositoryData?.violations_series?.map(
              (item) => item.violations_count,
            ) || [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [repositoryData]);

  const repositoryPillarChart = useMemo(() => {
    const labels = repositoryData?.pillar_series?.map((item) => item.timestamp) || [];
    const palette = {
      Performance: "#06b6d4",
      Maintainability: "#8b5cf6",
      Reliability: "#3b82f6",
      Security: "#f43f5e",
    };

    return {
      labels,
      datasets: Object.entries(palette).map(([pillar, color]) => ({
        label: pillar,
        data:
          repositoryData?.pillar_series?.map((item) => item[pillar] ?? null) || [],
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: false,
        tension: 0.35,
      })),
    };
  }, [repositoryData]);

  return (
    <div className="dashboard-page dashboard-page-fluid">
      <div className="absolute top-0 right-0 w-[480px] h-[480px] bg-rose-500/6 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-cyan-500/6 blur-[110px] rounded-full pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 page-header-compact"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200 shadow-sm">
                <TrendingUp size={14} className="text-rose-600" /> Trends Dashboard
              </div>
              <span className="text-slate-600 text-xs font-medium hidden sm:block">
                Baseline deltas, soft gate warnings, and portfolio time series
              </span>
            </div>
            <h2
              className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-700 via-pink-600 to-fuchsia-600"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              TRENDS & REGRESSION
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              {RANGE_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    rangeDays === days
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                fetchPortfolio();
                fetchRepository();
              }}
              disabled={portfolioLoading || repositoryLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw
                size={15}
                className={portfolioLoading || repositoryLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      <TopProgressBar isFetching={portfolioLoading || repositoryLoading} />

      <div className="space-y-6">
        <SectionShell
          title="Portfolio Trends"
          description={`Tổng quan toàn bộ repositories trong ${rangeDays} ngày gần nhất.`}
        >
          {portfolioLoading && !portfolioData ? (
            <div className="space-y-6">
              <CardSkeleton count={4} />
              <TableSkeleton rows={4} cols={4} />
            </div>
          ) : portfolioError ? (
            <EmptyState
              variant="error"
              title="Không tải được Portfolio Trends"
              description={portfolioError}
              accentColor="rose"
            />
          ) : !portfolioData ? (
            <EmptyState
              variant="empty"
              title="Không có dữ liệu trend"
              description="Chạy ít nhất một audit để hệ thống bắt đầu dựng chuỗi thời gian."
              accentColor="rose"
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<FolderOpen size={16} className="text-pink-600" />}
                  label="Scanned repos"
                  value={portfolioData.summary.scanned_repos}
                  accent="border-pink-500/20"
                />
                <SummaryCard
                  icon={<BarChart3 size={16} className="text-violet-600" />}
                  label="Avg latest score"
                  value={
                    portfolioData.summary.avg_latest_score != null
                      ? `${compactNumber.format(portfolioData.summary.avg_latest_score)}/100`
                      : "—"
                  }
                  accent="border-violet-500/20"
                />
                <SummaryCard
                  icon={<AlertTriangle size={16} className="text-rose-600" />}
                  label="Regressing repos"
                  value={portfolioData.summary.regressing_repos}
                  accent="border-rose-500/20"
                />
                <SummaryCard
                  icon={<Clock size={16} className="text-cyan-600" />}
                  label="Scans in range"
                  value={portfolioData.summary.scans_in_range}
                  accent="border-cyan-500/20"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard title="Average Score by Day">
                  <Line data={portfolioScoreChart} options={baseChartOptions} />
                </ChartCard>
                <ChartCard title="Scans and Regression Warnings by Day">
                  <Bar data={portfolioVolumeChart} options={baseChartOptions} />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-sm font-bold text-slate-700 mb-4">
                    Latest Portfolio Pillars
                  </div>
                  <div className="space-y-3">
                    {Object.entries(portfolioData.latest_portfolio_pillars || {}).map(
                      ([pillar, value]) => (
                        <div key={pillar}>
                          <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1">
                            <span>{pillar}</span>
                            <span>{compactNumber.format(value)}/10</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500"
                              style={{ width: `${Math.max(0, Math.min(100, (Number(value) / 10) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                    {!Object.keys(portfolioData.latest_portfolio_pillars || {}).length ? (
                      <span className="text-sm text-slate-400">Chưa có pillar snapshot.</span>
                    ) : null}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-sm font-bold text-slate-700 mb-4">
                    Top Regressing Repositories
                  </div>
                  {!portfolioData.top_regressing_repos?.length ? (
                    <EmptyState
                      variant="success"
                      title="Không có repo regress"
                      description="Trong khoảng thời gian đang chọn, chưa có repository nào vượt ngưỡng Regression Gate."
                      accentColor="emerald"
                    />
                  ) : (
                    <div className="space-y-3">
                      {portfolioData.top_regressing_repos.map((repo) => {
                        const meta = getRegressionMeta(
                          repo.regression_status,
                          repo.regression_summary,
                        );
                        const summary = getRegressionSummaryLine(
                          repo.regression_summary,
                          repo.regression_status,
                        );
                        return (
                          <div
                            key={repo.id}
                            className="p-4 rounded-2xl bg-white border border-slate-200"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-800 truncate">
                                  {repo.repo_name || repo.repo_id || repo.target}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {repo.target}
                                </div>
                              </div>
                              <span
                                className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold shrink-0 ${meta.classes}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                              <span className="font-bold">
                                Score {compactNumber.format(repo.score)}/100
                              </span>
                              <span>{summary}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Repository Trends"
          description={
            selectedRepo
              ? `Drill-down cho ${selectedRepo.name} trong ${rangeDays} ngày gần nhất.`
              : "Chọn repository từ sidebar để xem xu hướng chi tiết."
          }
        >
          {!targetUrl ? (
            <EmptyState
              variant="noData"
              title="Chưa chọn repository"
              description="Hãy chọn một repository ở sidebar để xem score trend, pillar trend và regression events."
              accentColor="violet"
            />
          ) : repositoryLoading && !repositoryData ? (
            <div className="space-y-6">
              <CardSkeleton count={3} />
              <TableSkeleton rows={4} cols={4} />
            </div>
          ) : repositoryError ? (
            <EmptyState
              variant="error"
              title="Không tải được Repository Trends"
              description={repositoryError}
              accentColor="rose"
            />
          ) : !repositoryData || !repositoryData.audit_points?.length ? (
            <EmptyState
              variant="empty"
              title="Repository chưa có trend"
              description="Chưa có đủ audit trong khoảng thời gian đang chọn để dựng xu hướng."
              accentColor="violet"
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<Activity size={16} className="text-violet-600" />}
                  label="Total scans"
                  value={repositoryData.summary.total_scans}
                  accent="border-violet-500/20"
                />
                <SummaryCard
                  icon={<BarChart3 size={16} className="text-cyan-600" />}
                  label="Latest score"
                  value={
                    repositoryData.summary.latest_score != null
                      ? `${compactNumber.format(repositoryData.summary.latest_score)}/100`
                      : "—"
                  }
                  accent="border-cyan-500/20"
                />
                <SummaryCard
                  icon={<AlertTriangle size={16} className="text-rose-600" />}
                  label="Warnings"
                  value={repositoryData.summary.warnings_count}
                  accent="border-rose-500/20"
                />
                <SummaryCard
                  icon={<Clock size={16} className="text-amber-600" />}
                  label="Latest audit"
                  value={
                    repositoryData.summary.latest_timestamp
                      ? new Date(repositoryData.summary.latest_timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                      : "—"
                  }
                  accent="border-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard title="Score Trend">
                  <Line data={repositoryScoreChart} options={baseChartOptions} />
                </ChartCard>
                <ChartCard title="Violations Trend">
                  <Line data={repositoryViolationsChart} options={baseChartOptions} />
                </ChartCard>
              </div>

              <ChartCard title="Pillar Trends" height={320}>
                <Line data={repositoryPillarChart} options={baseChartOptions} />
              </ChartCard>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-sm font-bold text-slate-700 mb-4">
                  Regression Events
                </div>
                {!repositoryData.regression_events?.length ? (
                  <EmptyState
                    variant="success"
                    title="Không có warning events"
                    description="Repository này chưa vượt ngưỡng Regression Gate trong khoảng thời gian đang chọn."
                    accentColor="emerald"
                  />
                ) : (
                  <div className="space-y-3">
                    {repositoryData.regression_events.map((event) => {
                      const meta = getRegressionMeta(
                        event.regression_status,
                        event.regression_summary,
                      );
                      const summary = getRegressionSummaryLine(
                        event.regression_summary,
                        event.regression_status,
                      );
                      return (
                        <div
                          key={event.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-bold text-slate-800">
                              Audit #{event.id}
                            </div>
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.classes}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {event.timestamp}
                          </div>
                          <div className="text-sm text-slate-600 mt-3">{summary}</div>
                          {(event.regression_summary?.triggered_signals || []).length ? (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {event.regression_summary.triggered_signals.map((signal) => (
                                <span
                                  key={signal}
                                  className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200"
                                >
                                  {signal.replaceAll("_", " ")}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
}

export default TrendsView;
