import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Activity,
  Ban,
  Bot,
  CalendarRange,
  Cpu,
  DollarSign,
  FileSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";

import Pagination from "../ui/Pagination";
import { CardSkeleton, TableSkeleton } from "../ui/SkeletonLoader";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";

const numberFmt = new Intl.NumberFormat("en-US");
const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const chartOptions = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        font: { size: 11, weight: "600" },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#64748b", font: { size: 11 } },
    },
    y: {
      grid: { color: "rgba(148,163,184,0.18)" },
      ticks: { color: "#64748b", font: { size: 11 } },
    },
  },
};

const badgeClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "blocked_budget":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "submitted":
    case "running":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const usageClass = (usageSource) =>
  usageSource === "reported"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toExclusiveDate = (value) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

const StatsCard = ({ icon, label, value, hint, tone = "slate" }) => (
  <div
    className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${
      tone === "violet"
        ? "border-violet-200/70"
        : tone === "emerald"
          ? "border-emerald-200/70"
          : tone === "amber"
            ? "border-amber-200/70"
            : tone === "rose"
              ? "border-rose-200/70"
              : "border-slate-200"
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
        {icon}
      </div>
    </div>
    <div className="mt-3 text-2xl font-black tracking-tight text-slate-800">
      {value}
    </div>
    <div className="mt-1 text-xs text-slate-500">{hint}</div>
  </div>
);

const SectionTitle = ({ icon, title, description }) => (
  <div className="mb-4 flex items-center gap-3">
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm">
      {icon}
    </div>
    <div>
      <h3 className="text-sm font-black tracking-tight text-slate-800">{title}</h3>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
    </div>
  </div>
);

const createEmptyPricingRow = () => ({
  provider: "",
  mode: "realtime",
  model: "",
  input_cost_per_million: 0,
  output_cost_per_million: 0,
  cached_input_cost_per_million: 0,
  currency: "USD",
  is_active: true,
});

const AiOpsView = ({ selectedRepoId }) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [pricingRows, setPricingRows] = useState([]);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestState, setRequestState] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
  });
  const [filters, setFilters] = useState({
    project: selectedRepoId || "",
    date_from: "",
    date_to: "",
    source: "",
    status: "",
    provider: "",
    model: "",
    mode: "",
    page: 1,
    page_size: 25,
  });
  const [budget, setBudget] = useState({
    daily_budget_usd: "",
    monthly_budget_usd: "",
    hard_stop_enabled: false,
    retention_days: 30,
    raw_payload_retention_enabled: false,
    today_spend: 0,
    month_spend: 0,
  });

  useEffect(() => {
    setFilters((prev) =>
      prev.project ? prev : { ...prev, project: selectedRepoId || "" },
    );
  }, [selectedRepoId]);

  const loadOverview = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", toExclusiveDate(filters.date_to));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const [overviewRes, seriesRes] = await Promise.all([
      fetch(`/api/ai/overview${suffix}`),
      fetch(`/api/ai/usage/series?granularity=day${suffix ? `&${params.toString()}` : ""}`),
    ]);
    if (!overviewRes.ok || !seriesRes.ok) {
      throw new Error("Failed to load AI overview.");
    }
    const overviewJson = await overviewRes.json();
    const seriesJson = await seriesRes.json();
    setOverview(overviewJson.data);
    setSeries(seriesJson.data || []);
  }, [filters.date_from, filters.date_to]);

  const loadPricingAndBudget = useCallback(async () => {
    const [pricingRes, budgetRes] = await Promise.all([
      fetch("/api/ai/pricing"),
      fetch("/api/ai/budget"),
    ]);
    if (!pricingRes.ok || !budgetRes.ok) {
      throw new Error("Failed to load AI settings.");
    }
    const pricingJson = await pricingRes.json();
    const budgetJson = await budgetRes.json();
    setPricingRows(pricingJson.data?.length ? pricingJson.data : [createEmptyPricingRow()]);
    setBudget({
      daily_budget_usd:
        budgetJson.data?.daily_budget_usd == null ? "" : budgetJson.data.daily_budget_usd,
      monthly_budget_usd:
        budgetJson.data?.monthly_budget_usd == null
          ? ""
          : budgetJson.data.monthly_budget_usd,
      hard_stop_enabled: Boolean(budgetJson.data?.hard_stop_enabled),
      retention_days: budgetJson.data?.retention_days || 30,
      raw_payload_retention_enabled: Boolean(
        budgetJson.data?.raw_payload_retention_enabled,
      ),
      today_spend: budgetJson.data?.today_spend || 0,
      month_spend: budgetJson.data?.month_spend || 0,
    });
  }, []);

  const loadRequests = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value != null) {
        params.set(
          key,
          key === "date_to" ? toExclusiveDate(String(value)) : String(value),
        );
      }
    });
    const res = await fetch(`/api/ai/requests?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Failed to load AI requests.");
    }
    const json = await res.json();
    setRequestState({
      items: json.items || [],
      total: json.total || 0,
      page: json.page || 1,
      page_size: json.page_size || 25,
    });
  }, [filters]);

  const loadRequestDetail = useCallback(async (requestId) => {
    if (!requestId) {
      setSelectedRequest(null);
      return;
    }
    const res = await fetch(`/api/ai/requests/${requestId}`);
    if (!res.ok) {
      throw new Error("Failed to load request detail.");
    }
    const json = await res.json();
    setSelectedRequest(json.data || null);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadOverview(), loadPricingAndBudget(), loadRequests()]);
    } catch (error) {
      toast.error(error.message || "Failed to load AI management data.", "Error");
    } finally {
      setIsLoading(false);
    }
  }, [loadOverview, loadPricingAndBudget, loadRequests, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadRequests().catch((error) => {
      toast.error(error.message || "Failed to load AI requests.", "Error");
    });
  }, [loadRequests, toast]);

  useEffect(() => {
    loadRequestDetail(selectedRequestId).catch((error) => {
      toast.error(error.message || "Failed to load request detail.", "Error");
    });
  }, [loadRequestDetail, selectedRequestId, toast]);

  const spendSeriesData = useMemo(
    () => ({
      labels: series.map((item) => item.bucket),
      datasets: [
        {
          label: "Spend (USD)",
          data: series.map((item) => item.cost_usd),
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.12)",
          fill: true,
          tension: 0.3,
        },
      ],
    }),
    [series],
  );

  const requestSeriesData = useMemo(
    () => ({
      labels: series.map((item) => item.bucket),
      datasets: [
        {
          label: "Requests",
          data: series.map((item) => item.request_count),
          backgroundColor: "#0f766e",
          borderRadius: 8,
        },
      ],
    }),
    [series],
  );

  const usageSplitData = useMemo(
    () => ({
      labels: ["Reported", "Estimated"],
      datasets: [
        {
          data: [
            overview?.usage_split?.reported || 0,
            overview?.usage_split?.estimated || 0,
          ],
          backgroundColor: ["#10b981", "#f59e0b"],
          borderWidth: 0,
        },
      ],
    }),
    [overview],
  );

  const breakdownChartData = useCallback(
    (groupKey, label, color) => {
      const rows = (overview?.breakdowns?.[groupKey] || []).slice(0, 8);
      return {
        labels: rows.map((item) => item.label),
        datasets: [
          {
            label,
            data: rows.map((item) => item.requests),
            backgroundColor: color,
            borderRadius: 8,
          },
        ],
      };
    },
    [overview],
  );

  const requestOptions = useMemo(() => {
    const set = new Set();
    requestState.items.forEach((item) => {
      if (item.project) set.add(item.project);
    });
    if (selectedRepoId) set.add(selectedRepoId);
    return Array.from(set).sort();
  }, [requestState.items, selectedRepoId]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page:
        key === "page"
          ? Number(value)
          : key === "page_size"
            ? 1
            : 1,
    }));
  };

  const handlePricingRowChange = (index, key, value) => {
    setPricingRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const handleSavePricing = async () => {
    setPricingSaving(true);
    try {
      const res = await fetch("/api/ai/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pricingRows.filter(
            (row) => row.provider && row.mode && row.model,
          ),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || "Failed to save pricing.");
      }
      setPricingRows(json.data?.length ? json.data : [createEmptyPricingRow()]);
      toast.success("Pricing catalog saved.", "AI Pricing");
      await loadOverview();
    } catch (error) {
      toast.error(error.message || "Failed to save pricing.", "Error");
    } finally {
      setPricingSaving(false);
    }
  };

  const handleSaveBudget = async () => {
    setBudgetSaving(true);
    try {
      const res = await fetch("/api/ai/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_budget_usd: budget.daily_budget_usd === "" ? null : Number(budget.daily_budget_usd),
          monthly_budget_usd:
            budget.monthly_budget_usd === "" ? null : Number(budget.monthly_budget_usd),
          hard_stop_enabled: budget.hard_stop_enabled,
          retention_days: Number(budget.retention_days),
          raw_payload_retention_enabled: budget.raw_payload_retention_enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || "Failed to save budget.");
      }
      setBudget((prev) => ({
        ...prev,
        daily_budget_usd:
          json.data?.daily_budget_usd == null ? "" : json.data.daily_budget_usd,
        monthly_budget_usd:
          json.data?.monthly_budget_usd == null ? "" : json.data.monthly_budget_usd,
        hard_stop_enabled: Boolean(json.data?.hard_stop_enabled),
        retention_days: json.data?.retention_days || 30,
        raw_payload_retention_enabled: Boolean(
          json.data?.raw_payload_retention_enabled,
        ),
        today_spend: json.data?.today_spend || 0,
        month_spend: json.data?.month_spend || 0,
      }));
      toast.success("Budget policy saved.", "AI Budget");
      await loadOverview();
      await loadRequests();
    } catch (error) {
      toast.error(error.message || "Failed to save budget.", "Error");
    } finally {
      setBudgetSaving(false);
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="p-8">
        <CardSkeleton count={4} />
        <div className="mt-6">
          <TableSkeleton rows={6} cols={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header-compact"
      >
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
          <Bot size={14} />
          AI Management
        </div>
        <h2
          className="text-3xl font-black tracking-tight text-slate-900 lg:text-5xl"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          AI OPS
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Request-level telemetry, cost tracking, pricing controls, and global hard-stop budgets.
        </p>
      </motion.div>

      <section>
        <SectionTitle
          icon={<Activity size={18} />}
          title="Overview"
          description="Current spend, token load, blocked requests, and health-check share."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            icon={<Wallet size={18} />}
            label="Spend Today"
            value={usdFmt.format(overview?.spend_today_usd || 0)}
            hint={`Month ${usdFmt.format(overview?.spend_month_usd || 0)}`}
            tone="violet"
          />
          <StatsCard
            icon={<Bot size={18} />}
            label="Total Requests"
            value={numberFmt.format(overview?.total_requests || 0)}
            hint={`${numberFmt.format(overview?.mode_split?.realtime || 0)} realtime / ${numberFmt.format(overview?.mode_split?.openai_batch || 0)} batch`}
            tone="emerald"
          />
          <StatsCard
            icon={<Cpu size={18} />}
            label="Tokens"
            value={numberFmt.format(
              (overview?.input_tokens || 0) + (overview?.output_tokens || 0),
            )}
            hint={`${numberFmt.format(overview?.input_tokens || 0)} in / ${numberFmt.format(overview?.output_tokens || 0)} out`}
            tone="slate"
          />
          <StatsCard
            icon={<Ban size={18} />}
            label="Blocked Requests"
            value={numberFmt.format(overview?.blocked_requests || 0)}
            hint={`${numberFmt.format(overview?.health_check_share?.requests || 0)} health checks`}
            tone="amber"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Top Models
            </div>
            <div className="mt-3 space-y-2">
              {(overview?.top_models || []).map((item) => (
                <div key={item.model} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{item.model}</span>
                  <span className="text-slate-500">{usdFmt.format(item.cost_usd || 0)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Top Projects
            </div>
            <div className="mt-3 space-y-2">
              {(overview?.top_projects || []).map((item) => (
                <div key={item.project} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{item.project}</span>
                  <span className="text-slate-500">{usdFmt.format(item.cost_usd || 0)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Top Features
            </div>
            <div className="mt-3 space-y-2">
              {(overview?.top_features || []).map((item) => (
                <div key={item.feature} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{item.feature}</span>
                  <span className="text-slate-500">{usdFmt.format(item.cost_usd || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          icon={<DollarSign size={18} />}
          title="Charts"
          description="Spend, request volume, usage quality, and breakdowns by source, provider, model, and mode."
        />
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-black text-slate-800">Spend Over Time</div>
            <div className="h-[280px]">
              <Line data={spendSeriesData} options={chartOptions} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-black text-slate-800">Request Volume</div>
            <div className="h-[280px]">
              <Bar data={requestSeriesData} options={chartOptions} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-black text-slate-800">Usage Source</div>
            <div className="h-[280px]">
              <Doughnut
                data={usageSplitData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: "#475569",
                        font: { size: 11, weight: "600" },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {[
            ["source", "By Source", "#0f766e"],
            ["provider", "By Provider", "#7c3aed"],
            ["model", "By Model", "#2563eb"],
            ["mode", "By Mode", "#ea580c"],
          ].map(([key, label, color]) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-black text-slate-800">{label}</div>
              <div className="h-[240px]">
                <Bar
                  data={breakdownChartData(key, label, color)}
                  options={{ ...chartOptions, indexAxis: "y" }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          icon={<FileSearch size={18} />}
          title="Requests Explorer"
          description="Filter request logs and inspect previews, hashes, usage, cost, and errors."
        />
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-4 2xl:grid-cols-8">
            {[
              ["date_from", "From"],
              ["date_to", "To"],
            ].map(([key, label]) => (
              <label key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <CalendarRange size={12} />
                  {label}
                </div>
                <input
                  type="date"
                  value={filters[key]}
                  onChange={(event) => handleFilterChange(key, event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </label>
            ))}
            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Project
              </div>
              <select
                className="w-full bg-transparent text-sm text-slate-700 outline-none"
                value={filters.project}
                onChange={(event) => handleFilterChange("project", event.target.value)}
              >
                <option value="">All</option>
                {requestOptions.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["source", "Source"],
              ["status", "Status"],
              ["provider", "Provider"],
              ["model", "Model"],
              ["mode", "Mode"],
            ].map(([key, label]) => (
              <label key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </div>
                <input
                  value={filters[key]}
                  onChange={(event) => handleFilterChange(key, event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  placeholder={`Filter ${label.toLowerCase()}`}
                />
              </label>
            ))}
            <div className="flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    project: selectedRepoId || "",
                    date_from: "",
                    date_to: "",
                    source: "",
                    status: "",
                    provider: "",
                    model: "",
                    mode: "",
                    page: 1,
                  }))
                }
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                title="Reset filters"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {requestState.items.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Provider / Model</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Usage</th>
                      <th className="px-4 py-3">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {requestState.items.map((item) => (
                      <tr
                        key={item.request_id}
                        onClick={() => setSelectedRequestId(item.request_id)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selectedRequestId === item.request_id ? "bg-violet-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-500">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {item.source}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.project || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="font-semibold text-slate-700">{item.model}</div>
                          <div className="text-xs text-slate-500">
                            {item.provider || "—"} / {item.mode || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${usageClass(item.usage_source)}`}>
                            {item.usage_source || "n/a"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {usdFmt.format(item.estimated_cost || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={filters.page}
                totalItems={requestState.total}
                pageSize={filters.page_size}
                onPageChange={(nextPage) => handleFilterChange("page", nextPage)}
                onPageSizeChange={(nextSize) => handleFilterChange("page_size", nextSize)}
                showPageSizeSelector
                label="requests"
              />
            </>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={<Search size={20} />}
                title="No AI requests"
                description="No requests match the current filter set."
              />
            </div>
          )}
        </div>

        {selectedRequest ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Request Detail
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedRequest.request_id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestId(null);
                  setSelectedRequest(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
              <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {[
                  ["Source", selectedRequest.source],
                  ["Provider", selectedRequest.provider],
                  ["Mode", selectedRequest.mode],
                  ["Model", selectedRequest.model],
                  ["Job", selectedRequest.job_id || "—"],
                  ["Target", selectedRequest.target || "—"],
                  ["Project", selectedRequest.project || "—"],
                  ["Started", formatDateTime(selectedRequest.started_at)],
                  ["Ended", formatDateTime(selectedRequest.ended_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-500">{label}</span>
                    <span className="text-right text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {[
                  ["Status", selectedRequest.status],
                  ["Usage Source", selectedRequest.usage_source || "n/a"],
                  ["Input Tokens", numberFmt.format(selectedRequest.input_tokens || 0)],
                  ["Output Tokens", numberFmt.format(selectedRequest.output_tokens || 0)],
                  ["Cached Tokens", numberFmt.format(selectedRequest.cached_tokens || 0)],
                  ["Input Chars", numberFmt.format(selectedRequest.input_chars || 0)],
                  ["Output Chars", numberFmt.format(selectedRequest.output_chars || 0)],
                  ["Cost", usdFmt.format(selectedRequest.estimated_cost || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-500">{label}</span>
                    <span className="text-right text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Input Preview
                </div>
                <div className="mb-2 text-xs text-slate-500">SHA256 {selectedRequest.input_hash || "—"}</div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                  {selectedRequest.input_preview || "—"}
                </pre>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Output Preview
                </div>
                <div className="mb-2 text-xs text-slate-500">SHA256 {selectedRequest.output_hash || "—"}</div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                  {selectedRequest.output_preview || "—"}
                </pre>
              </div>
            </div>
            {(selectedRequest.job_id ||
              selectedRequest.metadata?.audit_id ||
              selectedRequest.metadata?.history_id) ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Jump Links
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {selectedRequest.job_id ? (
                    <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                      Job {selectedRequest.job_id}
                    </span>
                  ) : null}
                  {selectedRequest.metadata?.audit_id ? (
                    <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                      Audit #{selectedRequest.metadata.audit_id}
                    </span>
                  ) : null}
                  {selectedRequest.metadata?.history_id ? (
                    <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                      History #{selectedRequest.metadata.history_id}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedRequest.error_reason ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {selectedRequest.error_reason}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<Cpu size={18} />}
            title="Pricing"
            description="Editable provider, mode, and model price catalog."
          />
          <div className="space-y-3">
            {pricingRows.map((row, index) => (
              <div
                key={`${row.provider}-${row.mode}-${row.model}-${index}`}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_0.8fr_1.2fr_1fr_1fr_1fr_auto]"
              >
                {[
                  ["provider", "Provider"],
                  ["mode", "Mode"],
                  ["model", "Model"],
                  ["input_cost_per_million", "Input / 1M"],
                  ["output_cost_per_million", "Output / 1M"],
                  ["cached_input_cost_per_million", "Cached / 1M"],
                ].map(([key, label]) => (
                  <label key={key} className="text-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {label}
                    </div>
                    <input
                      value={row[key]}
                      onChange={(event) =>
                        handlePricingRowChange(
                          index,
                          key,
                          key.includes("cost")
                            ? Number(event.target.value || 0)
                            : event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300"
                    />
                  </label>
                ))}
                <div className="flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPricingRows((prev) =>
                        prev.length === 1 ? [createEmptyPricingRow()] : prev.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                    title="Remove row"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPricingRows((prev) => [...prev, createEmptyPricingRow()])}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Plus size={14} />
              Add Model
            </button>
            <button
              type="button"
              onClick={handleSavePricing}
              disabled={pricingSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />
              {pricingSaving ? "Saving..." : "Save Pricing"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<ShieldAlert size={18} />}
            title="Budget"
            description="Global hard-stop controls and retention settings."
          />
          <div className="space-y-4">
            {[
              ["daily_budget_usd", "Daily Budget (USD)"],
              ["monthly_budget_usd", "Monthly Budget (USD)"],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget[key]}
                  onChange={(event) =>
                    setBudget((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300"
                  placeholder="Unlimited"
                />
              </label>
            ))}
            <label className="block text-sm">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Retention Days
              </div>
              <input
                type="number"
                min="1"
                value={budget.retention_days}
                onChange={(event) =>
                  setBudget((prev) => ({
                    ...prev,
                    retention_days: Number(event.target.value || 30),
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Hard Stop</div>
                  <div className="text-xs text-slate-500">
                    Block new AI requests when recorded spend crosses the daily or monthly cap.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={budget.hard_stop_enabled}
                  onChange={(event) =>
                    setBudget((prev) => ({
                      ...prev,
                      hard_stop_enabled: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Raw Payload Retention</div>
                  <div className="text-xs text-slate-500">
                    Disabled by default. Preview and hashes are always stored.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={budget.raw_payload_retention_enabled}
                  onChange={(event) =>
                    setBudget((prev) => ({
                      ...prev,
                      raw_payload_retention_enabled: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Spend Today
                </div>
                <div className="mt-2 text-xl font-black text-slate-800">
                  {usdFmt.format(budget.today_spend || 0)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Spend This Month
                </div>
                <div className="mt-2 text-xl font-black text-slate-800">
                  {usdFmt.format(budget.month_spend || 0)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveBudget}
              disabled={budgetSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />
              {budgetSaving ? "Saving..." : "Save Budget"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiOpsView;
