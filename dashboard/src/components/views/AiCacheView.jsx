import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Bar, Line } from "react-chartjs-2";
import {
  Activity,
  BarChart3,
  CalendarRange,
  Clock3,
  Database,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";

import EmptyState from "../ui/EmptyState";
import { CardSkeleton, TableSkeleton } from "../ui/SkeletonLoader";
import { useToast } from "../ui/Toast";
import {
  FieldShell,
  SectionTitle,
  StatsCard,
  chartOptions,
  createEmptyCacheState,
  createEmptyCacheSummary,
  formatDateTime,
  formatPercent,
  localizeAiOpsMessage,
  normalizeCacheState,
  numberFmt,
  readJsonSafely,
  toExclusiveDate,
  usdFmt,
} from "./aiOpsShared";

const createInitialRange = () => ({
  date_from: "",
  date_to: "",
});

const joinClasses = (...classes) => classes.filter(Boolean).join(" ");

const buildDateParams = (range) => {
  const params = new URLSearchParams();
  if (range.date_from) params.set("date_from", range.date_from);
  if (range.date_to) params.set("date_to", toExclusiveDate(range.date_to));
  return params;
};

const normalizeCacheSummary = (payload = {}) => {
  const base = createEmptyCacheSummary();
  return {
    ...base,
    ...payload,
    hits: Number(payload.hits || 0),
    misses: Number(payload.misses || 0),
    writes: Number(payload.writes || 0),
    hit_rate: Number(payload.hit_rate || 0),
    saved_input_tokens: Number(payload.saved_input_tokens || 0),
    saved_output_tokens: Number(payload.saved_output_tokens || 0),
    saved_cost_usd: Number(payload.saved_cost_usd || 0),
    by_stage: {
      ...base.by_stage,
      ...(payload.by_stage || {}),
    },
  };
};

const hasCacheActivity = (summary, series) =>
  Boolean(
    summary.hits ||
      summary.misses ||
      summary.writes ||
      summary.saved_cost_usd ||
      summary.saved_input_tokens ||
      summary.saved_output_tokens ||
      series.length,
  );

const EMPTY_STAGE_SUMMARY = createEmptyCacheSummary().by_stage;

const ToggleCard = ({ label, detail, checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => {
      if (!disabled) onChange(!checked);
    }}
    className={joinClasses(
      "flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition",
      checked
        ? "border-violet-200 bg-violet-50/70"
        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
      disabled && "cursor-not-allowed opacity-60",
    )}
  >
    <div className="min-w-0">
      <div className="text-sm font-bold text-slate-800">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</div>
    </div>
    <span
      className={joinClasses(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition",
        checked
          ? "border-violet-400 bg-violet-600"
          : "border-slate-300 bg-slate-200",
      )}
      aria-hidden="true"
    >
      <span
        className={joinClasses(
          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition",
          checked ? "left-[1.35rem]" : "left-0.5",
        )}
      />
    </span>
  </button>
);

const AiCacheView = () => {
  const toast = useToast();
  const hasBootedRef = useRef(false);
  const activityFetchSeq = useRef(0);
  const stateFetchSeq = useRef(0);

  const [isLoading, setIsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [stateError, setStateError] = useState("");
  const [policySaving, setPolicySaving] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [cacheState, setCacheState] = useState(createEmptyCacheState());
  const [draftRange, setDraftRange] = useState(() => createInitialRange());
  const [activeRange, setActiveRange] = useState(() => createInitialRange());

  const loadActivity = useCallback(async (rangeSnapshot = activeRange) => {
    const currentSeq = ++activityFetchSeq.current;
    setActivityLoading(true);
    setActivityError("");
    const params = buildDateParams(rangeSnapshot);
    const query = params.toString();
    const overviewUrl = `/api/ai/overview${query ? `?${query}` : ""}`;
    const seriesUrl = `/api/ai/usage/series?granularity=day${query ? `&${query}` : ""}`;

    try {
      const [overviewRes, seriesRes] = await Promise.all([
        fetch(overviewUrl),
        fetch(seriesUrl),
      ]);
      if (!overviewRes.ok || !seriesRes.ok) {
        const [overviewPayload, seriesPayload] = await Promise.all([
          overviewRes.ok ? Promise.resolve(null) : readJsonSafely(overviewRes),
          seriesRes.ok ? Promise.resolve(null) : readJsonSafely(seriesRes),
        ]);
        throw new Error(
          localizeAiOpsMessage(
            overviewPayload?.detail ||
              overviewPayload?.message ||
              seriesPayload?.detail ||
              seriesPayload?.message,
            "Không thể tải tổng quan cache AI.",
          ),
        );
      }

      const [overviewJson, seriesJson] = await Promise.all([
        overviewRes.json(),
        seriesRes.json(),
      ]);

      if (currentSeq !== activityFetchSeq.current) return;
      setOverview(overviewJson.data || null);
      setSeries(seriesJson.data || []);
    } catch (error) {
      if (currentSeq !== activityFetchSeq.current) return;
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải tổng quan cache AI.",
      );
      setActivityError(message);
      throw new Error(message);
    } finally {
      if (currentSeq === activityFetchSeq.current) {
        setActivityLoading(false);
      }
    }
  }, [activeRange]);

  const loadCacheState = useCallback(async () => {
    const currentSeq = ++stateFetchSeq.current;
    setStateLoading(true);
    setStateError("");

    try {
      const res = await fetch("/api/ai/cache");
      if (!res.ok) {
        const payload = await readJsonSafely(res);
        throw new Error(
          localizeAiOpsMessage(
            payload?.detail || payload?.message,
            "Không thể tải chính sách cache AI.",
          ),
        );
      }
      const json = await res.json();
      if (currentSeq !== stateFetchSeq.current) return;
      setCacheState(normalizeCacheState(json.data || {}));
    } catch (error) {
      if (currentSeq !== stateFetchSeq.current) return;
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải chính sách cache AI.",
      );
      setStateError(message);
      throw new Error(message);
    } finally {
      if (currentSeq === stateFetchSeq.current) {
        setStateLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadActivity(activeRange), loadCacheState()]);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error.message || "Không thể tải màn hình AI Cache.",
            "AI Cache Error",
          );
        }
      } finally {
        if (!cancelled) {
          hasBootedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
      activityFetchSeq.current += 1;
      stateFetchSeq.current += 1;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasBootedRef.current) return;
    loadActivity(activeRange).catch((error) => {
      toast.error(
        error.message || "Không thể tải lại dữ liệu cache AI.",
        "AI Cache Error",
      );
    });
  }, [activeRange, loadActivity, toast]);

  const filteredCache = useMemo(
    () => normalizeCacheSummary(overview?.cache || {}),
    [overview],
  );

  const allTimeSummary = useMemo(
    () => normalizeCacheSummary(cacheState.all_time_summary || {}),
    [cacheState.all_time_summary],
  );

  const savedTokens = useMemo(
    () =>
      Number(filteredCache.saved_input_tokens || 0) +
      Number(filteredCache.saved_output_tokens || 0),
    [filteredCache.saved_input_tokens, filteredCache.saved_output_tokens],
  );

  const allTimeSavedTokens = useMemo(
    () =>
      Number(allTimeSummary.saved_input_tokens || 0) +
      Number(allTimeSummary.saved_output_tokens || 0),
    [allTimeSummary.saved_input_tokens, allTimeSummary.saved_output_tokens],
  );

  const hasPendingFilterChanges = useMemo(
    () => JSON.stringify(draftRange) !== JSON.stringify(activeRange),
    [activeRange, draftRange],
  );

  const rangeLabel = useMemo(() => {
    if (!activeRange.date_from && !activeRange.date_to) {
      return "All Time";
    }
    return [
      activeRange.date_from || "Start",
      activeRange.date_to || "Now",
    ].join(" -> ");
  }, [activeRange.date_from, activeRange.date_to]);

  const activityChartData = useMemo(
    () => ({
      labels: series.map((item) => item.bucket),
      datasets: [
        {
          label: "Hits",
          data: series.map((item) => item.cache_hits || 0),
          backgroundColor: "#10b981",
          borderRadius: 8,
        },
        {
          label: "Misses",
          data: series.map((item) => item.cache_misses || 0),
          backgroundColor: "#f59e0b",
          borderRadius: 8,
        },
        {
          label: "Writes",
          data: series.map((item) => item.cache_writes || 0),
          backgroundColor: "#7c3aed",
          borderRadius: 8,
        },
      ],
    }),
    [series],
  );

  const savingsChartData = useMemo(
    () => ({
      labels: series.map((item) => item.bucket),
      datasets: [
        {
          label: "Saved Cost (USD)",
          data: series.map((item) => Number(item.saved_cost_usd || 0)),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.12)",
          fill: true,
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "Hit Rate (%)",
          data: series.map((item) => Number(item.cache_hit_rate || 0) * 100),
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.08)",
          fill: false,
          tension: 0.28,
          yAxisID: "y1",
        },
      ],
    }),
    [series],
  );

  const savingsChartOptions = useMemo(
    () => ({
      ...chartOptions,
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          position: "left",
          ticks: {
            color: "#64748b",
            callback: (value) => `$${value}`,
          },
        },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#7c3aed",
            callback: (value) => `${value}%`,
          },
        },
      },
    }),
    [],
  );

  const stageRows = useMemo(
    () => [
      ["Validation", filteredCache.by_stage?.validation || EMPTY_STAGE_SUMMARY.validation],
      ["Deep Audit", filteredCache.by_stage?.deep_audit || EMPTY_STAGE_SUMMARY.deep_audit],
      ["Cross Check", filteredCache.by_stage?.cross_check || EMPTY_STAGE_SUMMARY.cross_check],
    ],
    [filteredCache.by_stage],
  );

  const hasTimelineData = useMemo(
    () => hasCacheActivity(filteredCache, series),
    [filteredCache, series],
  );

  const applyFilters = () => {
    setActiveRange({ ...draftRange });
  };

  const resetFilters = () => {
    const nextRange = createInitialRange();
    setDraftRange(nextRange);
    setActiveRange(nextRange);
  };

  const reloadAll = async () => {
    try {
      await Promise.all([loadActivity(activeRange), loadCacheState()]);
      toast.success(
        "Đã làm mới trạng thái cache và biểu đồ mới nhất.",
        "AI Cache",
      );
    } catch (error) {
      toast.error(
        error.message || "Không thể làm mới dữ liệu cache AI.",
        "AI Cache Error",
      );
    }
  };

  const handleSavePolicy = async () => {
    setPolicySaving(true);
    try {
      const res = await fetch("/api/ai/cache", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: cacheState.enabled,
          validation_enabled: cacheState.validation_enabled,
          deep_audit_enabled: cacheState.deep_audit_enabled,
          cross_check_enabled: cacheState.cross_check_enabled,
          retention_days: Number(cacheState.retention_days || 30),
        }),
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(
          localizeAiOpsMessage(
            json?.detail || json?.message,
            "Không thể lưu chính sách cache AI.",
          ),
        );
      }
      setCacheState(normalizeCacheState(json.data || {}));
      toast.success(
        "Đã lưu cấu hình cache mới cho toàn hệ thống.",
        "Save Policy",
      );
    } catch (error) {
      toast.error(
        error.message || "Không thể lưu chính sách cache AI.",
        "Save Policy",
      );
    } finally {
      setPolicySaving(false);
    }
  };

  const handleClearCache = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xoá toàn bộ AI cache không? Thao tác này sẽ làm các request kế tiếp phải tính lại từ đầu.",
    );
    if (!confirmed) return;

    setCacheClearing(true);
    try {
      const res = await fetch("/api/ai/cache", {
        method: "DELETE",
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(
          localizeAiOpsMessage(
            json?.detail || json?.message,
            "Không thể xoá cache AI lúc này.",
          ),
        );
      }
      setCacheState(normalizeCacheState(json.data || {}));
      await loadActivity(activeRange);
      toast.success(
        "Đã xoá cache AI và đồng bộ lại toàn bộ số liệu hiển thị.",
        "Clear Cache",
      );
    } catch (error) {
      toast.error(
        error.message || "Không thể xoá cache AI lúc này.",
        "Clear Cache",
      );
    } finally {
      setCacheClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <CardSkeleton count={4} />
        <div className="mt-6">
          <TableSkeleton rows={4} cols={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page dashboard-page-fluid flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header-compact"
      >
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
          <Database size={14} />
          Operational Console
        </div>
        <h2
          className="text-3xl font-black tracking-tight text-slate-900 lg:text-5xl"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          AI CACHE
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Theo dõi hiệu quả cache theo thời gian, chỉnh chính sách bật tắt từng
          stage và xử lý maintenance mà không lẫn với pricing hay request explorer.
        </p>
      </motion.div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle
          icon={<CalendarRange size={18} />}
          title="Filters"
          description="Bộ lọc chỉ tác động lên snapshot và timeline để bạn so sánh hiệu quả cache theo từng giai đoạn vận hành."
        />
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto]">
          <FieldShell label="Date From" icon={<CalendarRange size={12} />}>
            <input
              type="date"
              value={draftRange.date_from}
              onChange={(event) =>
                setDraftRange((prev) => ({
                  ...prev,
                  date_from: event.target.value,
                }))
              }
              className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </FieldShell>

          <FieldShell label="Date To" icon={<CalendarRange size={12} />}>
            <input
              type="date"
              value={draftRange.date_to}
              onChange={(event) =>
                setDraftRange((prev) => ({
                  ...prev,
                  date_to: event.target.value,
                }))
              }
              className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </FieldShell>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={applyFilters}
            disabled={!hasPendingFilterChanges}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Activity size={14} />
            Apply Filters
          </button>

          <button
            type="button"
            onClick={reloadAll}
            disabled={activityLoading || stateLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={14}
              className={activityLoading || stateLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Current Window</div>
            <div className="text-xs text-slate-500">
              Giữ phạm vi lọc ổn định để biểu đồ, stage breakdown và số liệu tiết
              kiệm luôn cùng một mốc so sánh.
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-700">{rangeLabel}</div>
            {activityError ? (
              <div className="mt-1 text-rose-600">{activityError}</div>
            ) : (
              <div className="mt-1">
                {activityLoading ? "Đang cập nhật số liệu cache." : "Số liệu đang đồng bộ theo phạm vi hiện tại."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          icon={<TrendingUp size={18} />}
          title="Overview"
          description="Các thẻ tóm tắt ưu tiên phạm vi lọc hiện tại, đồng thời giữ một chỉ dấu all-time để bạn nhìn được hiệu quả dài hạn của cache."
        />
        {activityError && !hasTimelineData && !cacheState.entries_count ? (
          <EmptyState
            variant="error"
            title="Overview Error"
            description={activityError}
            accentColor="rose"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              icon={<BarChart3 size={18} />}
              label="Hit Rate"
              value={formatPercent(filteredCache.hit_rate)}
              hint={`Trong phạm vi hiện tại: ${numberFmt.format(filteredCache.hits)} hits / ${numberFmt.format(filteredCache.misses)} misses.`}
              tone="violet"
            />
            <StatsCard
              icon={<Database size={18} />}
              label="Entries"
              value={numberFmt.format(cacheState.entries_count || 0)}
              hint={`All-time writes: ${numberFmt.format(allTimeSummary.writes || 0)} bản ghi đã được ghi xuống cache.`}
              tone="emerald"
            />
            <StatsCard
              icon={<Activity size={18} />}
              label="Saved Tokens"
              value={numberFmt.format(savedTokens)}
              hint={`All-time: ${numberFmt.format(allTimeSavedTokens)} tokens được tiết kiệm.`}
              tone="slate"
            />
            <StatsCard
              icon={<TrendingUp size={18} />}
              label="Saved Cost"
              value={usdFmt.format(filteredCache.saved_cost_usd || 0)}
              hint={`All-time: ${usdFmt.format(allTimeSummary.saved_cost_usd || 0)} chi phí đã tránh được.`}
              tone="amber"
            />
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          icon={<BarChart3 size={18} />}
          title="Timeline"
          description="Biểu đồ tách riêng hoạt động hit, miss, write và giá trị tiết kiệm để bạn nhìn ra stage nào đang có lợi nhất trong từng khoảng thời gian."
        />
        {activityError && !hasTimelineData ? (
          <EmptyState
            variant="error"
            title="Timeline Error"
            description={activityError}
            accentColor="rose"
          />
        ) : !hasTimelineData ? (
          <EmptyState
            variant="noData"
            title="No Cache Activity"
            description="Chưa có hoạt động cache nào trong phạm vi lọc hiện tại."
            accentColor="indigo"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 text-sm font-black text-slate-800">
                Cache Activity
              </div>
              <div className="mb-3 text-xs text-slate-500">
                Dùng biểu đồ này để nhìn nhanh nhịp độ hit, miss và write trước khi
                thay đổi policy hoặc prompt fingerprint.
              </div>
              <div className="h-[300px]">
                <Bar data={activityChartData} options={chartOptions} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 text-sm font-black text-slate-800">
                Savings Over Time
              </div>
              <div className="mb-3 text-xs text-slate-500">
                Saved Cost và Hit Rate đi cùng nhau để bạn thấy lúc nào cache thật sự
                mang lại hiệu quả kinh tế.
              </div>
              <div className="h-[300px]">
                <Line data={savingsChartData} options={savingsChartOptions} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          icon={<Activity size={18} />}
          title="Stage Breakdown"
          description="Giữ riêng từng stage để biết nơi nào đang tận dụng cache tốt, nơi nào còn miss nhiều và đáng xem lại fingerprint hoặc prompt version."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {stageRows.map(([label, item]) => {
            const stageSavedTokens =
              Number(item.saved_input_tokens || 0) +
              Number(item.saved_output_tokens || 0);
            const total = Number(item.hits || 0) + Number(item.misses || 0);
            const hitRate = total ? item.hits / total : 0;

            return (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-800">{label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Dữ liệu stage trong cùng phạm vi lọc đang xem.
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {formatPercent(hitRate)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Hits", numberFmt.format(item.hits || 0)],
                    ["Misses", numberFmt.format(item.misses || 0)],
                    ["Writes", numberFmt.format(item.writes || 0)],
                    ["Saved Tokens", numberFmt.format(stageSavedTokens)],
                  ].map(([metric, value]) => (
                    <div
                      key={metric}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        {metric}
                      </div>
                      <div className="mt-2 text-lg font-black text-slate-800">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Saved Cost
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-800">
                    {usdFmt.format(item.saved_cost_usd || 0)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Policy"
            description="Policy điều khiển cache toàn cục. Labels giữ tiếng Anh để thao tác nhanh, phần giải thích chuyển sang tiếng Việt để dễ hiểu tác động."
          />

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleCard
              label="Global Enable"
              detail="Bật hoặc tắt toàn bộ cache cho các luồng AI audit mà không đổi contract phía backend."
              checked={Boolean(cacheState.enabled)}
              disabled={policySaving}
              onChange={(checked) =>
                setCacheState((prev) => ({ ...prev, enabled: checked }))
              }
            />
            <ToggleCard
              label="Validation"
              detail="Giữ lại kết quả lọc false positive để các lần chạy sau không phải gọi lại AI nếu fingerprint vẫn giống."
              checked={Boolean(cacheState.validation_enabled)}
              disabled={policySaving}
              onChange={(checked) =>
                setCacheState((prev) => ({
                  ...prev,
                  validation_enabled: checked,
                }))
              }
            />
            <ToggleCard
              label="Deep Audit"
              detail="Tái sử dụng phần audit nặng nhất khi file và dependency fingerprint chưa đổi."
              checked={Boolean(cacheState.deep_audit_enabled)}
              disabled={policySaving}
              onChange={(checked) =>
                setCacheState((prev) => ({
                  ...prev,
                  deep_audit_enabled: checked,
                }))
              }
            />
            <ToggleCard
              label="Cross Check"
              detail="Giảm số lần đối chiếu lặp lại nếu verify_target và nội dung tham chiếu không thay đổi."
              checked={Boolean(cacheState.cross_check_enabled)}
              disabled={policySaving}
              onChange={(checked) =>
                setCacheState((prev) => ({
                  ...prev,
                  cross_check_enabled: checked,
                }))
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
            <FieldShell label="Retention Days" icon={<Clock3 size={12} />}>
              <input
                type="number"
                min="1"
                value={cacheState.retention_days}
                onChange={(event) =>
                  setCacheState((prev) => ({
                    ...prev,
                    retention_days: Number(event.target.value || 30),
                  }))
                }
                className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
              />
            </FieldShell>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">Policy Note</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">
                Retention càng dài thì tỉ lệ tái sử dụng càng tốt, nhưng số entry tồn
                tại lâu hơn và lần cleanup sau sẽ phải quét nhiều bản ghi hơn.
              </div>
              {stateError ? (
                <div className="mt-3 text-xs font-semibold text-rose-600">
                  {stateError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSavePolicy}
              disabled={policySaving || cacheClearing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />
              {policySaving ? "Saving..." : "Save Policy"}
            </button>
            <div className="text-xs text-slate-500">
              Lưu policy không chạm vào payload backend hay lịch sử request đã có.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<Database size={18} />}
            title="Maintenance"
            description="Khối này phục vụ vận hành trực tiếp: theo dõi lần hit gần nhất, lần cleanup gần nhất và xoá cache khi cần làm sạch trạng thái."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Last Hit
              </div>
              <div className="mt-2 text-lg font-black text-slate-800">
                {formatDateTime(cacheState.last_hit_at)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Last Cleanup
              </div>
              <div className="mt-2 text-lg font-black text-slate-800">
                {formatDateTime(cacheState.last_cleanup_at)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">All-time Summary</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Hits", numberFmt.format(allTimeSummary.hits || 0)],
                ["Misses", numberFmt.format(allTimeSummary.misses || 0)],
                ["Writes", numberFmt.format(allTimeSummary.writes || 0)],
                ["Saved Cost", usdFmt.format(allTimeSummary.saved_cost_usd || 0)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-2 text-base font-black text-slate-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleClearCache}
              disabled={cacheClearing || policySaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} />
              {cacheClearing ? "Clearing..." : "Clear Cache"}
            </button>
            <div className="text-xs text-slate-500">
              Khi xoá cache, các lần chạy kế tiếp sẽ build lại kết quả từ đầu nên chi
              phí AI có thể tăng tạm thời.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiCacheView;
