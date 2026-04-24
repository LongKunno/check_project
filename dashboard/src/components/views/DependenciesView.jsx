import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock3,
  FolderOpen,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import EmptyState from "../ui/EmptyState";
import { CardSkeleton, TableSkeleton } from "../ui/SkeletonLoader";
import TopProgressBar from "../ui/TopProgressBar";
import {
  getDependencyHealthMeta,
  getDependencyIssueSummary,
  getDependencyIssueTypes,
  getDependencyLifecycleMeta,
  getDependencyHealthSummaryLine,
  formatDependencyIssueType,
} from "../../utils/dependencyHealthHelpers";

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const SummaryCard = ({ icon, label, value, accent }) => (
  <div className={`rounded-[28px] border bg-white/90 p-5 shadow-sm ${accent}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
          {value}
        </div>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-slate-50 text-slate-700 shadow-sm">
        {icon}
      </div>
    </div>
  </div>
);

const SectionShell = ({ eyebrow, title, description, children }) => (
  <section className="rounded-[32px] border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
    <div className="mb-6">
      {eyebrow ? (
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-700">
          {eyebrow}
        </div>
      ) : null}
      <h3 className="text-2xl font-black tracking-tight text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);

const DetailBadge = ({ status, summary }) => {
  const meta = getDependencyHealthMeta(status, summary);
  const line = getDependencyHealthSummaryLine(summary, status);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.classes}`}>
        {meta.label}
      </span>
      <span className="max-w-[280px] truncate text-[11px] text-slate-500" title={line}>
        {line}
      </span>
    </div>
  );
};

const ItemStatusPill = ({ status }) => {
  if (status === "warning") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
        Warning
      </span>
    );
  }
  if (status === "pass") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        Pass
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
      Hygiene
    </span>
  );
};

const sortItems = (items = []) =>
  [...items].sort((left, right) => {
    const statusOrder = { warning: 0, hygiene: 1, pass: 2 };
    const statusDelta =
      (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9);
    if (statusDelta !== 0) return statusDelta;
    const issueDelta =
      (getDependencyIssueTypes(right).length || 0) -
      (getDependencyIssueTypes(left).length || 0);
    if (issueDelta !== 0) return issueDelta;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });

const DependenciesView = ({ selectedRepoId, targetUrl, configuredRepos = [] }) => {
  const [overview, setOverview] = useState(null);
  const [repositoryData, setRepositoryData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [repositoryError, setRepositoryError] = useState("");

  const selectedRepo = useMemo(
    () => configuredRepos.find((repo) => repo.id === selectedRepoId),
    [configuredRepos, selectedRepoId],
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError("");
    try {
      const res = await fetch("/api/dependencies/overview");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || "Unable to load dependency overview");
      setOverview(payload.data);
    } catch (error) {
      setOverviewError(error.message);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadRepository = useCallback(async () => {
    if (!targetUrl) {
      setRepositoryData(null);
      setRepositoryError("");
      setRepositoryLoading(false);
      return;
    }

    setRepositoryLoading(true);
    setRepositoryError("");
    try {
      const res = await fetch(
        `/api/dependencies/repository?target=${encodeURIComponent(targetUrl)}`,
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.detail || "Unable to load repository dependency health");
      }
      setRepositoryData(payload.data);
    } catch (error) {
      setRepositoryError(error.message);
    } finally {
      setRepositoryLoading(false);
    }
  }, [targetUrl]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadRepository();
  }, [loadRepository]);

  const repositoryItems = useMemo(
    () => sortItems(repositoryData?.dependency_health?.items || []),
    [repositoryData],
  );

  return (
    <div className="dashboard-page dashboard-page-fluid">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(248,250,252,0.7))] pointer-events-none -z-10" />
      <div className="absolute right-0 top-10 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 h-[340px] w-[340px] rounded-full bg-amber-400/10 blur-[120px] pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-[34px] border border-slate-200/90 bg-white/85 px-6 py-6 shadow-[0_22px_80px_-48px_rgba(14,116,144,0.55)] backdrop-blur"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 shadow-sm">
              <ShieldAlert size={14} className="text-cyan-600" />
              Dependency Health Guard
            </div>
            <h2
              className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-800 via-sky-700 to-amber-600 lg:text-5xl"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              DEPENDENCY INTELLIGENCE
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Advisory severity cao, dependency deprecated/gần EOL và Docker base image
              biến động cho Python, Node, Docker ngay trong mỗi lần audit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              EOL window:{" "}
              <span className="font-black text-slate-900">
                {overview?.settings?.eol_warning_days ?? "—"}d
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              Scope: <span className="font-black text-slate-900">direct runtime + docker</span>
            </div>
            <button
              onClick={() => {
                loadOverview();
                loadRepository();
              }}
              disabled={overviewLoading || repositoryLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={overviewLoading || repositoryLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      <TopProgressBar isFetching={overviewLoading || repositoryLoading} />

      <div className="space-y-6">
        <SectionShell
          eyebrow="Portfolio"
          title="Dependency Issue Overview"
          description="Snapshot mới nhất theo từng repository đã cấu hình."
        >
          {overviewLoading && !overview ? (
            <div className="space-y-6">
              <CardSkeleton count={4} />
              <TableSkeleton rows={4} cols={5} />
            </div>
          ) : overviewError ? (
            <EmptyState
              variant="error"
              title="Không tải được dependency overview"
              description={overviewError}
              accentColor="amber"
            />
          ) : !overview ? (
            <EmptyState
              variant="empty"
              title="Chưa có dependency snapshot"
              description="Chạy audit để hệ thống bắt đầu dựng dependency health cho từng repository."
              accentColor="cyan"
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <SummaryCard
                  icon={<AlertTriangle size={18} className="text-amber-600" />}
                  label="Warning repos"
                  value={overview.summary.warning_repos}
                  accent="border-amber-200"
                />
                <SummaryCard
                  icon={<ShieldAlert size={18} className="text-rose-600" />}
                  label="High advisories"
                  value={overview.summary.high_advisories + overview.summary.critical_advisories}
                  accent="border-rose-200"
                />
                <SummaryCard
                  icon={<Clock3 size={18} className="text-cyan-700" />}
                  label="Lifecycle risks"
                  value={
                    overview.summary.deprecated_count +
                    overview.summary.near_eol_count +
                    overview.summary.eol_count
                  }
                  accent="border-cyan-200"
                />
                <SummaryCard
                  icon={<Package size={18} className="text-slate-700" />}
                  label="Mutable images"
                  value={overview.summary.mutable_base_image_count}
                  accent="border-slate-200"
                />
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        {["Repository", "Score", "Dependency Health", "Signals", "Latest Audit"].map((label) => (
                          <th
                            key={label}
                            className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.repositories.map((repo) => (
                        <tr key={repo.id || repo.url} className="border-b border-slate-200/70 last:border-b-0">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200 bg-white text-cyan-700 shadow-sm">
                                <FolderOpen size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-slate-900">
                                  {repo.name}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">{repo.url}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-700">
                            {repo.latest_score != null
                              ? `${compactNumber.format(repo.latest_score)}/100`
                              : "—"}
                          </td>
                          <td className="px-4 py-4">
                            <DetailBadge
                              status={repo.dependency_health_status}
                              summary={repo.dependency_health_summary}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">
                            <div className="flex flex-wrap gap-2">
                              {(repo.dependency_health_summary?.triggered_signals || []).length ? (
                                repo.dependency_health_summary.triggered_signals.slice(0, 3).map((signal) => (
                                  <span
                                    key={signal}
                                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600"
                                  >
                                    {signal.replaceAll("_", " ")}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">No active issues</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-500">
                            {formatDate(repo.latest_timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </SectionShell>

        <SectionShell
          eyebrow="Repository"
          title="Dependency Drill-down"
          description={
            selectedRepo
              ? `Chi tiết dependency issue và lifecycle cho ${selectedRepo.name}.`
              : "Chọn repository ở sidebar để xem manifest, package issue và audit snapshots."
          }
        >
          {!targetUrl ? (
            <EmptyState
              variant="noData"
              title="Chưa chọn repository"
              description="Hãy chọn repository ở sidebar để xem dependency drill-down."
              accentColor="cyan"
            />
          ) : repositoryLoading && !repositoryData ? (
            <div className="space-y-6">
              <CardSkeleton count={4} />
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : repositoryError ? (
            <EmptyState
              variant="error"
              title="Không tải được dependency drill-down"
              description={repositoryError}
              accentColor="amber"
            />
          ) : !repositoryData ? (
            <EmptyState
              variant="empty"
              title="Chưa có dependency snapshot"
              description="Repository này chưa có dữ liệu dependency health."
              accentColor="cyan"
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <SummaryCard
                  icon={
                    repositoryData.dependency_health?.status === "warning" ? (
                      <ShieldAlert size={18} className="text-amber-600" />
                    ) : (
                      <ShieldCheck size={18} className="text-emerald-600" />
                    )
                  }
                  label="Latest status"
                  value={getDependencyHealthMeta(repositoryData.dependency_health?.status).label}
                  accent="border-cyan-200"
                />
                <SummaryCard
                  icon={<Package size={18} className="text-slate-700" />}
                  label="Dependencies"
                  value={repositoryData.dependency_health?.summary?.dependencies_total ?? 0}
                  accent="border-slate-200"
                />
                <SummaryCard
                  icon={<AlertTriangle size={18} className="text-rose-600" />}
                  label="Issue types"
                  value={(repositoryData.dependency_health?.summary?.triggered_signals || []).length}
                  accent="border-rose-200"
                />
                <SummaryCard
                  icon={<Clock3 size={18} className="text-amber-600" />}
                  label="Latest audit"
                  value={formatDate(repositoryData.latest_audit?.timestamp)}
                  accent="border-amber-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">Issue Items</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Warning items được ưu tiên lên đầu, sau đó tới hygiene và pass.
                      </div>
                    </div>
                    <DetailBadge
                      status={repositoryData.dependency_health?.status}
                      summary={repositoryData.dependency_health?.summary}
                    />
                  </div>

                  {!repositoryItems.length ? (
                    <EmptyState
                      variant="empty"
                      title="Không có dependency item"
                      description="Manifest được nhận diện nhưng chưa trích xuất được dependency item nào."
                      accentColor="cyan"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-slate-200 text-left">
                            {["Package", "Ecosystem", "Current", "Lifecycle", "Issues", "Recommendation"].map((label) => (
                              <th
                                key={label}
                                className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {repositoryItems.map((item) => (
                            <tr key={`${item.artifact_path}-${item.name}-${item.current_spec}`} className="border-b border-slate-200/70 last:border-b-0">
                              <td className="px-3 py-4">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="mt-1 text-[11px] text-slate-500">{item.artifact_path}</div>
                              </td>
                              <td className="px-3 py-4 text-sm font-semibold capitalize text-slate-600">
                                {item.ecosystem}
                              </td>
                              <td className="px-3 py-4 text-sm text-slate-600">
                                {item.resolved_version || item.current_spec || "—"}
                              </td>
                              <td className="px-3 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getDependencyLifecycleMeta(item.lifecycle_status).classes}`}
                                >
                                  {getDependencyLifecycleMeta(item.lifecycle_status).label}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-sm text-slate-600">
                                <div className="flex flex-wrap gap-2">
                                  {getDependencyIssueTypes(item).length ? (
                                    getDependencyIssueTypes(item).map((issueType) => (
                                      <span
                                        key={issueType}
                                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600"
                                      >
                                        {formatDependencyIssueType(issueType)}
                                      </span>
                                    ))
                                  ) : (
                                    <ItemStatusPill status={item.status} />
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-4 text-sm leading-6 text-slate-500">
                                <div>{item.recommendation}</div>
                                <div className="mt-1 text-[11px] text-slate-400">
                                  {getDependencyIssueSummary(item)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-black text-slate-900">Manifests</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(repositoryData.dependency_health?.summary?.manifests_scanned || []).length ? (
                        repositoryData.dependency_health.summary.manifests_scanned.map((manifest) => (
                          <span
                            key={manifest}
                            className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-700"
                          >
                            {manifest}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No manifest info</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-black text-slate-900">Recent Audits</div>
                    <div className="mt-4 space-y-3">
                      {(repositoryData.recent_audits || []).length ? (
                        repositoryData.recent_audits.map((audit) => (
                          <div
                            key={audit.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-black text-slate-900">
                                Audit #{audit.id}
                              </div>
                              <DetailBadge
                                status={audit.dependency_health_status}
                                summary={audit.dependency_health_summary}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {formatDate(audit.timestamp)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No recent audits</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
};

export default DependenciesView;
