import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Activity,
  Ban,
  Bot,
  CalendarRange,
  Check,
  ChevronDown,
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
import {
  FieldShell,
  SectionTitle,
  StatsCard,
  chartOptions,
  formatDateTime,
  hasVietnameseText,
  localizeAiOpsMessage,
  humanizeValue,
  numberFmt,
  readJsonSafely,
  toExclusiveDate,
  usdFmt,
} from "./aiOpsShared";

const DEFAULT_REQUEST_PAGE_SIZE = 10;

const STATUS_LABELS = {
  completed: "Completed",
  failed: "Failed",
  blocked_budget: "Budget Blocked",
  submitted: "Submitted",
  running: "Running",
};

const USAGE_SOURCE_LABELS = {
  reported: "Reported",
  estimated: "Estimated",
};

const MODE_LABELS = {
  realtime: "Realtime",
  openai_batch: "Batch",
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  proxy: "Proxy",
};

let pricingRowCounter = 0;

const createPricingRowId = () => {
  pricingRowCounter += 1;
  return `pricing-row-${pricingRowCounter}`;
};

const createInitialFilters = (lockedProject = "") => ({
  project: lockedProject || "",
  date_from: "",
  date_to: "",
  source: "",
  status: "",
  provider: "",
  model: "",
  mode: "",
  page: 1,
  page_size: DEFAULT_REQUEST_PAGE_SIZE,
});

const createEmptyFilterMeta = () => ({
  projects: [],
  sources: [],
  providers: ["openai", "anthropic", "google", "proxy"],
  models: [],
  statuses: ["completed", "failed", "blocked_budget", "submitted", "running"],
  modes: ["realtime", "openai_batch"],
  models_by_provider: {},
});

const createEmptyPricingRow = () => ({
  row_id: createPricingRowId(),
  provider: "",
  mode: "realtime",
  model: "",
  input_cost_per_million: 0,
  output_cost_per_million: 0,
  cached_input_cost_per_million: 0,
  currency: "USD",
  is_active: true,
  research_status: "",
  research_detail: "",
  research_source_label: "",
  research_source_url: "",
  research_note_code: "",
  matched_model: "",
});

const normalizePricingRow = (row = {}) => ({
  ...createEmptyPricingRow(),
  ...row,
  row_id: row.row_id || createPricingRowId(),
  provider: row.provider || "",
  mode: row.mode || "realtime",
  model: row.model || "",
  input_cost_per_million: Number(row.input_cost_per_million || 0),
  output_cost_per_million: Number(row.output_cost_per_million || 0),
  cached_input_cost_per_million: Number(row.cached_input_cost_per_million || 0),
  currency: row.currency || "USD",
  is_active: row.is_active !== false,
  research_status: row.research_status || "",
  research_detail: row.research_detail || "",
  research_source_label: row.research_source_label || "",
  research_source_url: row.research_source_url || "",
  research_note_code: row.research_note_code || "",
  matched_model: row.matched_model || "",
});

const buildPricingPayload = (rows) =>
  rows
    .filter((row) => row.provider && row.mode && row.model)
    .map((row) => ({
      provider: row.provider,
      mode: row.mode,
      model: row.model,
      input_cost_per_million: Number(row.input_cost_per_million || 0),
      output_cost_per_million: Number(row.output_cost_per_million || 0),
      cached_input_cost_per_million: Number(row.cached_input_cost_per_million || 0),
      currency: row.currency || "USD",
      is_active: row.is_active !== false,
    }));

const joinClasses = (...classes) => classes.filter(Boolean).join(" ");

const formatStatusLabel = (status) =>
  STATUS_LABELS[(status || "").toLowerCase()] ||
  humanizeValue(status) ||
  "Unknown";

const formatUsageSourceLabel = (usageSource) =>
  USAGE_SOURCE_LABELS[(usageSource || "").toLowerCase()] ||
  (usageSource ? humanizeValue(usageSource) : "Pending");

const formatModeLabel = (mode) =>
  MODE_LABELS[(mode || "").toLowerCase()] || (mode ? humanizeValue(mode) : "—");

const formatProviderLabel = (provider) =>
  PROVIDER_LABELS[(provider || "").toLowerCase()] ||
  (provider ? humanizeValue(provider) : "—");

const formatFailureReason = (detail) => {
  const localized = localizeAiOpsMessage(detail, "");
  if (!detail) {
    return "Request này không ghi nhận thêm chi tiết lỗi.";
  }
  if (localized && localized !== detail) {
    return localized;
  }
  if (String(detail).trim().startsWith("{")) {
    return String(detail);
  }
  return hasVietnameseText(String(detail))
    ? String(detail)
    : `Request này kết thúc với lỗi sau: ${detail}`;
};

const localizeResearchNote = (code) => {
  switch (code) {
    case "openai_batch_discount":
      return "Giá batch được suy ra từ hướng dẫn Batch API chính thức của OpenAI với mức giảm 50% so với giá tiêu chuẩn.";
    case "tiered_prompt_rate_first_tier":
      return "Đang dùng mức giá đầu tiên trên trang chính thức vì catalog hiện tại chỉ lưu được một mức giá cho mỗi dòng.";
    case "batch_same_as_standard":
      return "Nguồn chính thức ghi chú phần batch chưa có mức riêng cho mục này, nên hệ thống giữ đúng giá hiển thị ở bảng nguồn.";
    default:
      return "";
  }
};

const applyPricingSuggestion = (row, suggestion) => {
  const current = normalizePricingRow(row);
  const normalizedSuggestion = normalizePricingRow({
    ...current,
    ...suggestion,
  });
  const sameValues =
    Number(current.input_cost_per_million || 0) ===
      Number(normalizedSuggestion.input_cost_per_million || 0) &&
    Number(current.output_cost_per_million || 0) ===
      Number(normalizedSuggestion.output_cost_per_million || 0) &&
    Number(current.cached_input_cost_per_million || 0) ===
      Number(normalizedSuggestion.cached_input_cost_per_million || 0);
  const hadCosts =
    Number(current.input_cost_per_million || 0) > 0 ||
    Number(current.output_cost_per_million || 0) > 0 ||
    Number(current.cached_input_cost_per_million || 0) > 0;
  const researchStatus = sameValues ? "Unchanged" : hadCosts ? "Updated" : "New";
  const note = localizeResearchNote(suggestion.source_note_code);
  const matchedModel =
    suggestion.matched_model && suggestion.matched_model !== suggestion.model
      ? ` Đối chiếu theo model gốc ${suggestion.matched_model}.`
      : "";

  return {
    ...normalizedSuggestion,
    research_status: researchStatus,
    research_source_label: suggestion.source_label || "",
    research_source_url: suggestion.source_url || "",
    research_note_code: suggestion.source_note_code || "",
    research_detail: `${sameValues ? "Giá hiện tại đã trùng với nguồn chính thức." : "Đã áp dụng gợi ý giá mới từ nguồn chính thức."}${matchedModel}${note ? ` ${note}` : ""}`.trim(),
  };
};

const hasOverviewContent = (overview) => {
  if (!overview) return false;
  return Boolean(
    overview.total_requests ||
      overview.spend_today_usd ||
      overview.spend_month_usd ||
      overview.blocked_requests ||
      overview.input_tokens ||
      overview.output_tokens ||
      overview.cached_tokens ||
      overview.top_models?.length ||
      overview.top_projects?.length ||
      overview.top_features?.length,
  );
};

const hasChartContent = (overview, series) => {
  if (series?.length) return true;
  return ["source", "provider", "model", "mode"].some(
    (key) => (overview?.breakdowns?.[key] || []).length > 0,
  );
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
    : usageSource === "estimated"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

const researchBadgeClass = (status) => {
  switch (status) {
    case "New":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Updated":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Unchanged":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const CONTROL_TRIGGER_CLASS =
  "flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 shadow-sm transition duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-100";

const CONTROL_PANEL_CLASS =
  "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]";

const CONTROL_ITEM_CLASS =
  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none";

const useDismissibleLayer = (ref, isOpen, onClose) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current?.contains(event.target)) return;
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, ref]);
};

const SelectControl = ({
  value,
  options,
  onChange,
  placeholder = "Select",
  emptyMessage = "No options available.",
  disabled = false,
  ariaLabel,
}) => {
  const shellRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useDismissibleLayer(shellRef, isOpen, () => setIsOpen(false));

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={shellRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        className={joinClasses(
          CONTROL_TRIGGER_CLASS,
          isOpen && "border-violet-300 ring-4 ring-violet-100",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={joinClasses(
            "min-w-0 flex-1 truncate",
            selectedOption ? "text-slate-700" : "text-slate-400",
          )}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={joinClasses(
            "shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div className={CONTROL_PANEL_CLASS}>
          <div className="max-h-64 overflow-auto p-2" role="listbox" aria-label={ariaLabel}>
            {options.length ? (
              options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={`${option.value || "empty"}-${option.label}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={joinClasses(
                      CONTROL_ITEM_CLASS,
                      isSelected && "bg-violet-50 text-violet-700",
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <span className="shrink-0 text-violet-600" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SearchableCombobox = ({
  value,
  options,
  onChange,
  placeholder = "Type to search",
  emptyMessage = "No matching options.",
  disabled = false,
  ariaLabel,
}) => {
  const shellRef = useRef(null);
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useDismissibleLayer(shellRef, isOpen, () => setIsOpen(false));

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    setQuery(selectedOption?.label || value || "");
  }, [selectedOption, value]);

  const filteredOptions = useMemo(() => {
    const keyword = String(query || "")
      .trim()
      .toLowerCase();

    if (!keyword) {
      return options.slice(0, 12);
    }

    return options
      .filter((option) =>
        `${option.label} ${option.value}`.toLowerCase().includes(keyword),
      )
      .slice(0, 20);
  }, [options, query]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={shellRef} className="relative min-w-0">
      <div
        className={joinClasses(
          CONTROL_TRIGGER_CLASS,
          "gap-0 px-0 pr-1 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100",
          isOpen && "border-violet-300 ring-4 ring-violet-100",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Search size={14} className="ml-3 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onChange(nextValue);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              return;
            }

            if (event.key === "Enter" && filteredOptions.length === 1) {
              event.preventDefault();
              handleSelect(filteredOptions[0].value);
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => !prev);
            if (!isOpen) {
              requestAnimationFrame(() => inputRef.current?.focus());
            }
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronDown
            size={14}
            className={joinClasses(
              "transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </div>

      {isOpen ? (
        <div className={CONTROL_PANEL_CLASS}>
          <div className="max-h-64 overflow-auto p-2" role="listbox" aria-label={ariaLabel}>
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={`${option.value || "empty"}-${option.label}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={joinClasses(
                      CONTROL_ITEM_CLASS,
                      isSelected && "bg-violet-50 text-violet-700",
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <span className="shrink-0 text-violet-600" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DetailDrawer = ({
  isOpen,
  onClose,
  selectedRequest,
  selectedRequestId,
  requestDetailLoading,
  requestDetailError,
}) => (
  <AnimatePresence>
    {isOpen ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[180] bg-slate-950/35 backdrop-blur-sm"
      >
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Request Detail
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {selectedRequest?.request_id || selectedRequestId || "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {requestDetailLoading ? (
              <EmptyState
                variant="empty"
                title="Loading Detail"
                description="Đang tải chi tiết request AI đã chọn."
                accentColor="indigo"
              />
            ) : requestDetailError ? (
              <EmptyState
                variant="error"
                title="Detail Error"
                description={requestDetailError}
                accentColor="rose"
              />
            ) : selectedRequest ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(
                      selectedRequest.status,
                    )}`}
                  >
                    {formatStatusLabel(selectedRequest.status)}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${usageClass(
                      selectedRequest.usage_source,
                    )}`}
                  >
                    {formatUsageSourceLabel(selectedRequest.usage_source)}
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {[
                      ["Source", selectedRequest.source],
                      ["Provider", formatProviderLabel(selectedRequest.provider)],
                      ["Mode", formatModeLabel(selectedRequest.mode)],
                      ["Model", selectedRequest.model],
                      ["Job", selectedRequest.job_id || "—"],
                      ["Target", selectedRequest.target || "—"],
                      ["Project", selectedRequest.project || "—"],
                      ["Started", formatDateTime(selectedRequest.started_at)],
                      ["Ended", formatDateTime(selectedRequest.ended_at)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <span className="font-semibold text-slate-500">{label}</span>
                        <span className="text-right text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {[
                      ["Input Tokens", numberFmt.format(selectedRequest.input_tokens || 0)],
                      ["Output Tokens", numberFmt.format(selectedRequest.output_tokens || 0)],
                      ["Cached Tokens", numberFmt.format(selectedRequest.cached_tokens || 0)],
                      ["Input Chars", numberFmt.format(selectedRequest.input_chars || 0)],
                      ["Output Chars", numberFmt.format(selectedRequest.output_chars || 0)],
                      ["Cost", usdFmt.format(selectedRequest.estimated_cost || 0)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <span className="font-semibold text-slate-500">{label}</span>
                        <span className="text-right text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Input Preview
                    </div>
                    <div className="mb-2 text-xs text-slate-500">
                      SHA256 {selectedRequest.input_hash || "—"}
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                      {selectedRequest.input_preview || "—"}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Output Preview
                    </div>
                    <div className="mb-2 text-xs text-slate-500">
                      SHA256 {selectedRequest.output_hash || "—"}
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                      {selectedRequest.output_preview || "—"}
                    </pre>
                  </div>
                </div>

                {(selectedRequest.job_id ||
                  selectedRequest.metadata?.audit_id ||
                  selectedRequest.metadata?.history_id) ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Jump Links
                    </div>
                    <p className="mb-3 text-xs text-slate-500">
                      Giữ nguyên định danh liên quan để đối chiếu nhanh với job, audit
                      hoặc history tương ứng.
                    </p>
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
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-700">
                      Failure Detail
                    </div>
                    <p className="mt-1 text-xs text-rose-700/80">
                      Phần dưới đây giữ nguyên ngữ cảnh lỗi để người vận hành dễ đối
                      chiếu hơn khi debug request.
                    </p>
                    <div className="mt-2">
                      {formatFailureReason(selectedRequest.error_reason)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                variant="empty"
                title="No Request Selected"
                description="Chọn một request trong bảng để mở side drawer và xem preview, hash cùng số liệu usage."
                accentColor="slate"
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

const AiOpsView = ({ selectedRepoId }) => {
  const toast = useToast();
  const requestFetchSeq = useRef(0);
  const detailFetchSeq = useRef(0);
  const hasBootedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [series, setSeries] = useState([]);
  const [filterMeta, setFilterMeta] = useState(createEmptyFilterMeta());
  const [metaError, setMetaError] = useState("");
  const [pricingRows, setPricingRows] = useState([]);
  const [settingsError, setSettingsError] = useState("");
  const [pricingSaving, setPricingSaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [researchingRowIndex, setResearchingRowIndex] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [requestDetailLoading, setRequestDetailLoading] = useState(false);
  const [requestDetailError, setRequestDetailError] = useState("");
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [requestState, setRequestState] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: DEFAULT_REQUEST_PAGE_SIZE,
  });
  const [activeFilters, setActiveFilters] = useState(() => createInitialFilters());
  const [draftFilters, setDraftFilters] = useState(() => createInitialFilters());
  const [budget, setBudget] = useState({
    daily_budget_usd: "",
    monthly_budget_usd: "",
    hard_stop_enabled: false,
    retention_days: 30,
    raw_payload_retention_enabled: false,
    today_spend: 0,
    month_spend: 0,
  });

  const loadOverview = useCallback(async () => {
    setOverviewError("");
    const params = new URLSearchParams();
    if (activeFilters.date_from) params.set("date_from", activeFilters.date_from);
    if (activeFilters.date_to) {
      params.set("date_to", toExclusiveDate(activeFilters.date_to));
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    try {
      const [overviewRes, seriesRes] = await Promise.all([
        fetch(`/api/ai/overview${suffix}`),
        fetch(`/api/ai/usage/series?granularity=day${suffix ? `&${params.toString()}` : ""}`),
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
            "Không thể tải phần tổng quan AI Ops.",
          ),
        );
      }
      const overviewJson = await overviewRes.json();
      const seriesJson = await seriesRes.json();
      setOverview(overviewJson.data);
      setSeries(seriesJson.data || []);
    } catch (error) {
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải phần tổng quan AI Ops.",
      );
      setOverviewError(message);
      throw new Error(message);
    }
  }, [activeFilters.date_from, activeFilters.date_to]);

  const loadFilterMeta = useCallback(async () => {
    setMetaError("");
    const params = new URLSearchParams();
    if (activeFilters.project) params.set("project", activeFilters.project);
    if (activeFilters.date_from) params.set("date_from", activeFilters.date_from);
    if (activeFilters.date_to) {
      params.set("date_to", toExclusiveDate(activeFilters.date_to));
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    try {
      const res = await fetch(`/api/ai/filters/meta${suffix}`);
      if (!res.ok) {
        const payload = await readJsonSafely(res);
        throw new Error(
          localizeAiOpsMessage(
            payload?.detail || payload?.message,
            "Không thể tải bộ dữ liệu lọc cho AI Ops.",
          ),
        );
      }
      const json = await res.json();
      setFilterMeta({
        ...createEmptyFilterMeta(),
        ...(json.data || {}),
      });
    } catch (error) {
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải bộ dữ liệu lọc cho AI Ops.",
      );
      setMetaError(message);
    }
  }, [activeFilters.date_from, activeFilters.date_to, activeFilters.project]);

  const loadPricingAndBudget = useCallback(async () => {
    setSettingsError("");
    try {
      const [pricingRes, budgetRes] = await Promise.all([
        fetch("/api/ai/pricing"),
        fetch("/api/ai/budget"),
      ]);
      if (!pricingRes.ok || !budgetRes.ok) {
        const [pricingPayload, budgetPayload] = await Promise.all([
          pricingRes.ok ? Promise.resolve(null) : readJsonSafely(pricingRes),
          budgetRes.ok ? Promise.resolve(null) : readJsonSafely(budgetRes),
        ]);
        throw new Error(
          localizeAiOpsMessage(
            pricingPayload?.detail ||
              pricingPayload?.message ||
              budgetPayload?.detail ||
              budgetPayload?.message,
            "Không thể tải cấu hình pricing và budget của AI Ops.",
          ),
        );
      }
      const pricingJson = await pricingRes.json();
      const budgetJson = await budgetRes.json();
      setPricingRows(
        pricingJson.data?.length
          ? pricingJson.data.map((item) => normalizePricingRow(item))
          : [createEmptyPricingRow()],
      );
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
    } catch (error) {
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải cấu hình pricing và budget của AI Ops.",
      );
      setSettingsError(message);
      throw new Error(message);
    }
  }, []);

  const loadRequests = useCallback(
    async (filtersSnapshot = activeFilters) => {
      const currentSeq = ++requestFetchSeq.current;
      setRequestsLoading(true);
      setRequestsError("");
      const params = new URLSearchParams();
      Object.entries(filtersSnapshot).forEach(([key, value]) => {
        if (value !== "" && value != null) {
          params.set(
            key,
            key === "date_to" ? toExclusiveDate(String(value)) : String(value),
          );
        }
      });
      try {
        const res = await fetch(`/api/ai/requests?${params.toString()}`);
        if (!res.ok) {
          const payload = await readJsonSafely(res);
          throw new Error(
            localizeAiOpsMessage(
              payload?.detail || payload?.message,
              "Không thể tải danh sách request AI.",
            ),
          );
        }
        const json = await res.json();
        if (currentSeq !== requestFetchSeq.current) return;
        setRequestState({
          items: json.items || [],
          total: json.total || 0,
          page: json.page || 1,
          page_size: json.page_size || DEFAULT_REQUEST_PAGE_SIZE,
        });
      } catch (error) {
        if (currentSeq !== requestFetchSeq.current) return;
        const message = localizeAiOpsMessage(
          error.message,
          "Không thể tải danh sách request AI.",
        );
        setRequestsError(message);
        throw new Error(message);
      } finally {
        if (currentSeq === requestFetchSeq.current) {
          setRequestsLoading(false);
        }
      }
    },
    [activeFilters],
  );

  const loadRequestDetail = useCallback(async (requestId) => {
    const currentSeq = ++detailFetchSeq.current;
    if (!requestId) {
      setSelectedRequest(null);
      setRequestDetailError("");
      setRequestDetailLoading(false);
      return;
    }
    setRequestDetailLoading(true);
    setRequestDetailError("");
    setSelectedRequest(null);
    try {
      const res = await fetch(`/api/ai/requests/${requestId}`);
      if (!res.ok) {
        const payload = await readJsonSafely(res);
        throw new Error(
          localizeAiOpsMessage(
            payload?.detail || payload?.message,
            "Không thể tải chi tiết request AI đã chọn.",
          ),
        );
      }
      const json = await res.json();
      if (currentSeq !== detailFetchSeq.current) return;
      setSelectedRequest(json.data || null);
    } catch (error) {
      if (currentSeq !== detailFetchSeq.current) return;
      const message = localizeAiOpsMessage(
        error.message,
        "Không thể tải chi tiết request AI đã chọn.",
      );
      setRequestDetailError(message);
      throw new Error(message);
    } finally {
      if (currentSeq === detailFetchSeq.current) {
        setRequestDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadOverview(),
          loadFilterMeta(),
          loadPricingAndBudget(),
          loadRequests(activeFilters),
        ]);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error.message || "Không thể tải dữ liệu AI Ops.",
            "AI Ops Error",
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
      requestFetchSeq.current += 1;
      detailFetchSeq.current += 1;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasBootedRef.current) return;
    Promise.all([loadOverview(), loadFilterMeta()]).catch((error) => {
      toast.error(
        error.message || "Không thể tải dữ liệu phần tổng quan AI Ops.",
        "Overview Error",
      );
    });
  }, [loadOverview, loadFilterMeta, toast]);

  useEffect(() => {
    if (!hasBootedRef.current) return;
    loadRequests(activeFilters).catch((error) => {
      toast.error(
        error.message || "Không thể tải danh sách request AI.",
        "Requests Error",
      );
    });
  }, [activeFilters, loadRequests, toast]);

  useEffect(() => {
    if (!detailOpen || !selectedRequestId) return;
    loadRequestDetail(selectedRequestId).catch((error) => {
      toast.error(
        error.message || "Không thể tải chi tiết request AI đã chọn.",
        "Detail Error",
      );
    });
  }, [detailOpen, selectedRequestId, loadRequestDetail, toast]);

  useEffect(() => {
    if (!hasBootedRef.current) return;
    setDetailOpen(false);
    setSelectedRequestId(null);
    setSelectedRequest(null);
    setRequestDetailError("");
  }, [
    activeFilters.date_from,
    activeFilters.date_to,
    activeFilters.mode,
    activeFilters.model,
    activeFilters.page,
    activeFilters.page_size,
    activeFilters.project,
    activeFilters.provider,
    activeFilters.source,
    activeFilters.status,
  ]);

  const totalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          (requestState.total || 0) /
            (activeFilters.page_size || DEFAULT_REQUEST_PAGE_SIZE),
        ),
      ),
    [activeFilters.page_size, requestState.total],
  );

  useEffect(() => {
    if (
      !hasBootedRef.current ||
      requestsLoading ||
      requestState.total <= 0 ||
      requestState.items.length > 0 ||
      activeFilters.page <= totalPages
    ) {
      return;
    }
    setActiveFilters((prev) => ({ ...prev, page: totalPages }));
    setDraftFilters((prev) => ({ ...prev, page: totalPages }));
  }, [
    activeFilters.page,
    requestState.items.length,
    requestState.total,
    requestsLoading,
    totalPages,
  ]);

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
        labels: rows.map((item) =>
          groupKey === "mode" ? formatModeLabel(item.label) : item.label,
        ),
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
    const set = new Set(filterMeta.projects || []);
    if (selectedRepoId) set.add(selectedRepoId);
    if (activeFilters.project) set.add(activeFilters.project);
    return Array.from(set).sort();
  }, [activeFilters.project, filterMeta.projects, selectedRepoId]);

  const providerOptions = useMemo(() => {
    const set = new Set(filterMeta.providers || []);
    set.add("openai");
    set.add("anthropic");
    set.add("google");
    set.add("proxy");
    return Array.from(set);
  }, [filterMeta.providers]);

  const projectFilterOptions = useMemo(
    () => [
      { value: "", label: "All Projects" },
      ...requestOptions.map((project) => ({ value: project, label: project })),
    ],
    [requestOptions],
  );

  const sourceFilterOptions = useMemo(
    () =>
      (filterMeta.sources || []).map((source) => ({
        value: source,
        label: source,
      })),
    [filterMeta.sources],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "", label: "All Statuses" },
      ...(filterMeta.statuses || []).map((status) => ({
        value: status,
        label: formatStatusLabel(status),
      })),
    ],
    [filterMeta.statuses],
  );

  const providerFilterOptions = useMemo(
    () => [
      { value: "", label: "All Providers" },
      ...providerOptions.map((provider) => ({
        value: provider,
        label: formatProviderLabel(provider),
      })),
    ],
    [providerOptions],
  );

  const modelFilterOptions = useMemo(
    () =>
      (filterMeta.models || []).map((model) => ({
        value: model,
        label: model,
      })),
    [filterMeta.models],
  );

  const modeFilterOptions = useMemo(
    () => [
      { value: "", label: "All Modes" },
      ...(filterMeta.modes || []).map((mode) => ({
        value: mode,
        label: formatModeLabel(mode),
      })),
    ],
    [filterMeta.modes],
  );

  const pricingProviderOptions = useMemo(
    () =>
      providerOptions.map((provider) => ({
        value: provider,
        label: formatProviderLabel(provider),
      })),
    [providerOptions],
  );

  const pricingModeOptions = useMemo(
    () =>
      (filterMeta.modes || []).map((mode) => ({
        value: mode,
        label: formatModeLabel(mode),
      })),
    [filterMeta.modes],
  );

  const pricingModelOptions = useMemo(() => {
    const baseMap = {};
    Object.entries(filterMeta.models_by_provider || {}).forEach(
      ([provider, models]) => {
        baseMap[provider] = new Set(models || []);
      },
    );
    return Object.fromEntries(
      Object.entries(baseMap).map(([provider, values]) => [
        provider,
        Array.from(values).sort(),
      ]),
    );
  }, [filterMeta.models_by_provider]);

  const hasOverviewData = useMemo(() => hasOverviewContent(overview), [overview]);
  const hasChartsData = useMemo(
    () => hasChartContent(overview, series),
    [overview, series],
  );

  const hasPendingFilterChanges = useMemo(
    () =>
      JSON.stringify({
        ...draftFilters,
        page: 1,
      }) !==
      JSON.stringify({
        ...activeFilters,
        page: 1,
      }),
    [activeFilters, draftFilters],
  );

  const handleDraftFilterChange = (key, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      page: 1,
    };
    setActiveFilters(nextFilters);
    setDraftFilters(nextFilters);
  };

  const resetFilters = () => {
    const reset = {
      ...createInitialFilters(),
      page_size: activeFilters.page_size,
    };
    setDraftFilters(reset);
    setActiveFilters(reset);
  };

  const handlePageChange = (page) => {
    setActiveFilters((prev) => ({ ...prev, page: Number(page) }));
    setDraftFilters((prev) => ({ ...prev, page: Number(page) }));
  };

  const handlePageSizeChange = (pageSize) => {
    setActiveFilters((prev) => ({ ...prev, page: 1, page_size: Number(pageSize) }));
    setDraftFilters((prev) => ({ ...prev, page: 1, page_size: Number(pageSize) }));
  };

  const handlePricingRowChange = (index, key, value) => {
    setPricingRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? normalizePricingRow({
              ...row,
              model:
                key === "provider"
                  ? ""
                  : key === "model"
                    ? value
                    : row.model,
              research_status:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.research_status,
              research_detail:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.research_detail,
              research_source_label:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.research_source_label,
              research_source_url:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.research_source_url,
              research_note_code:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.research_note_code,
              matched_model:
                key === "provider" || key === "mode" || key === "model"
                  ? ""
                  : row.matched_model,
              [key]:
                key.includes("cost")
                  ? Number(value === "" ? 0 : value)
                  : value,
            })
          : row,
      ),
    );
  };

  const handleResearchPricing = async (index) => {
    const row = pricingRows[index];
    if (!row?.provider || row.provider === "proxy") {
      toast.error(
        "Provider proxy hoặc nguồn tuỳ biến hiện chưa có research giá tự động.",
        "Pricing Research",
      );
      return;
    }
    if (!row?.model) {
      toast.error("Vui lòng chọn model trước khi research giá.", "Pricing Research");
      return;
    }

    setResearchingRowIndex(index);
    try {
      const res = await fetch("/api/ai/pricing/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: row.provider,
          model: row.model,
          mode: row.mode,
        }),
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(
          localizeAiOpsMessage(
            json?.detail || json?.message,
            "Không thể research giá từ nguồn chính thức.",
          ),
        );
      }
      const suggestion = json?.data?.suggestions?.[0];
      if (!suggestion) {
        throw new Error("Không tìm thấy gợi ý giá phù hợp từ nguồn chính thức.");
      }

      setPricingRows((prev) =>
        prev.map((item, rowIndex) =>
          rowIndex === index ? applyPricingSuggestion(item, suggestion) : item,
        ),
      );

      toast.success(
        "Đã áp dụng gợi ý giá từ nguồn chính thức vào dòng hiện tại.",
        "Pricing Research",
      );
    } catch (error) {
      toast.error(
        localizeAiOpsMessage(
          error.message,
          "Không thể research giá từ nguồn chính thức.",
        ),
        "Pricing Research",
      );
    } finally {
      setResearchingRowIndex(null);
    }
  };

  const handleSavePricing = async () => {
    setPricingSaving(true);
    try {
      const res = await fetch("/api/ai/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: buildPricingPayload(pricingRows),
        }),
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(
          localizeAiOpsMessage(
            json?.detail || json?.message,
            "Không thể lưu bảng giá AI.",
          ),
        );
      }
      setPricingRows(
        json.data?.length
          ? json.data.map((item) => normalizePricingRow(item))
          : [createEmptyPricingRow()],
      );
      toast.success("Đã lưu bảng giá AI.", "AI Pricing");
      await loadOverview();
      await loadFilterMeta();
    } catch (error) {
      toast.error(
        error.message || "Không thể lưu bảng giá AI.",
        "Pricing Error",
      );
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
          daily_budget_usd:
            budget.daily_budget_usd === "" ? null : Number(budget.daily_budget_usd),
          monthly_budget_usd:
            budget.monthly_budget_usd === ""
              ? null
              : Number(budget.monthly_budget_usd),
          hard_stop_enabled: budget.hard_stop_enabled,
          retention_days: Number(budget.retention_days),
          raw_payload_retention_enabled: budget.raw_payload_retention_enabled,
        }),
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(
          localizeAiOpsMessage(
            json?.detail || json?.message,
            "Không thể lưu chính sách ngân sách AI.",
          ),
        );
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
      toast.success("Đã lưu chính sách ngân sách AI.", "AI Budget");
      await loadOverview();
      await loadRequests(activeFilters);
    } catch (error) {
      toast.error(
        error.message || "Không thể lưu chính sách ngân sách AI.",
        "Budget Error",
      );
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
    <>
      <div className="dashboard-page dashboard-page-fluid flex flex-col gap-8">
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
            Theo dõi telemetry theo từng request, chi phí ước tính, bảng giá và
            hard-stop budget toàn cục cho các luồng AI.
          </p>
        </motion.div>

        <section>
          <SectionTitle
            icon={<Activity size={18} />}
            title="Overview"
            description="Tổng hợp mức chi hiện tại, tải token, request bị chặn và tỷ trọng health check trong khoảng lọc đang chọn."
          />
          {overviewError && !hasOverviewData ? (
            <EmptyState
              variant="error"
              title="Overview Error"
              description={overviewError}
              accentColor="rose"
            />
          ) : !hasOverviewData ? (
            <EmptyState
              variant="noData"
              title="No Overview Data"
              description="Chưa có dữ liệu tổng hợp AI trong khoảng lọc hiện tại."
              accentColor="cyan"
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatsCard
                  icon={<Wallet size={18} />}
                  label="Spend Today"
                  value={usdFmt.format(overview?.spend_today_usd || 0)}
                  hint={`Tháng này ${usdFmt.format(overview?.spend_month_usd || 0)}`}
                  tone="violet"
                />
                <StatsCard
                  icon={<Bot size={18} />}
                  label="Total Requests"
                  value={numberFmt.format(overview?.total_requests || 0)}
                  hint={`Gồm ${numberFmt.format(overview?.mode_split?.realtime || 0)} ${formatModeLabel("realtime")} / ${numberFmt.format(overview?.mode_split?.openai_batch || 0)} ${formatModeLabel("openai_batch")}`}
                  tone="emerald"
                />
                <StatsCard
                  icon={<Cpu size={18} />}
                  label="Tokens"
                  value={numberFmt.format(
                    (overview?.input_tokens || 0) + (overview?.output_tokens || 0),
                  )}
                  hint={`Input ${numberFmt.format(overview?.input_tokens || 0)} / Output ${numberFmt.format(overview?.output_tokens || 0)}`}
                  tone="slate"
                />
                <StatsCard
                  icon={<Ban size={18} />}
                  label="Blocked Requests"
                  value={numberFmt.format(overview?.blocked_requests || 0)}
                  hint={`Có ${numberFmt.format(overview?.health_check_share?.requests || 0)} health checks`}
                  tone="amber"
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Top Models
                  </div>
                  <div className="mt-3 space-y-2">
                    {(overview?.top_models || []).length ? (
                      (overview?.top_models || []).map((item) => (
                        <div
                          key={item.model}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-slate-700">{item.model}</span>
                          <span className="text-slate-500">
                            {usdFmt.format(item.cost_usd || 0)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                        Chưa có chi phí theo model trong khoảng lọc hiện tại.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Top Projects
                  </div>
                  <div className="mt-3 space-y-2">
                    {(overview?.top_projects || []).length ? (
                      (overview?.top_projects || []).map((item) => (
                        <div
                          key={item.project}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-slate-700">{item.project}</span>
                          <span className="text-slate-500">
                            {usdFmt.format(item.cost_usd || 0)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                        Chưa có project nào phát sinh chi phí trong khoảng lọc hiện tại.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Top Features
                  </div>
                  <div className="mt-3 space-y-2">
                    {(overview?.top_features || []).length ? (
                      (overview?.top_features || []).map((item) => (
                        <div
                          key={item.feature}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-slate-700">{item.feature}</span>
                          <span className="text-slate-500">
                            {usdFmt.format(item.cost_usd || 0)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                        Chưa có tính năng nào được ghi nhận chi phí trong khoảng lọc hiện tại.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<DollarSign size={18} />}
            title="Charts"
            description="Biểu đồ chi phí, số lượng request, chất lượng usage và phân rã theo source, provider, model, mode."
          />
          {overviewError && !hasChartsData ? (
            <EmptyState
              variant="error"
              title="Charts Error"
              description={overviewError}
              accentColor="rose"
            />
          ) : !hasChartsData ? (
            <EmptyState
              variant="noData"
              title="No Chart Data"
              description="Chưa có dữ liệu để vẽ biểu đồ AI trong khoảng lọc hiện tại."
              accentColor="amber"
            />
          ) : (
            <>
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
                  <div
                    key={key}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
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
            </>
          )}
        </section>

        <section>
          <SectionTitle
            icon={<FileSearch size={18} />}
            title="Requests Explorer"
            description="Lọc nhật ký request và mở chi tiết ở side drawer để giữ màn hình chính gọn, dễ quét và tránh trạng thái lệch khi đổi trang."
          />
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldShell label="Date From" icon={<CalendarRange size={12} />}>
                  <input
                    type="date"
                    value={draftFilters.date_from}
                    onChange={(event) =>
                      handleDraftFilterChange("date_from", event.target.value)
                    }
                    className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </FieldShell>

                <FieldShell label="Date To" icon={<CalendarRange size={12} />}>
                  <input
                    type="date"
                    value={draftFilters.date_to}
                    onChange={(event) =>
                      handleDraftFilterChange("date_to", event.target.value)
                    }
                    className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </FieldShell>

                <FieldShell label="Project">
                  <SearchableCombobox
                    value={draftFilters.project}
                    options={projectFilterOptions.slice(1)}
                    onChange={(value) => handleDraftFilterChange("project", value)}
                    placeholder="All Projects"
                    emptyMessage="No matching projects."
                    ariaLabel="Project"
                  />
                </FieldShell>

                <FieldShell label="Source">
                  <SearchableCombobox
                    value={draftFilters.source}
                    options={sourceFilterOptions}
                    onChange={(value) => handleDraftFilterChange("source", value)}
                    placeholder="Any source"
                    emptyMessage="No matching sources."
                    ariaLabel="Source"
                  />
                </FieldShell>

                <FieldShell label="Status">
                  <SelectControl
                    value={draftFilters.status}
                    options={statusFilterOptions}
                    onChange={(value) => handleDraftFilterChange("status", value)}
                    placeholder="All Statuses"
                    ariaLabel="Status"
                  />
                </FieldShell>

                <FieldShell label="Provider">
                  <SelectControl
                    value={draftFilters.provider}
                    options={providerFilterOptions}
                    onChange={(value) => handleDraftFilterChange("provider", value)}
                    placeholder="All Providers"
                    ariaLabel="Provider"
                  />
                </FieldShell>

                <FieldShell label="Model">
                  <SearchableCombobox
                    value={draftFilters.model}
                    options={modelFilterOptions}
                    onChange={(value) => handleDraftFilterChange("model", value)}
                    placeholder="Any model"
                    emptyMessage="No matching models."
                    ariaLabel="Model"
                  />
                </FieldShell>

                <FieldShell label="Mode">
                  <SelectControl
                    value={draftFilters.mode}
                    options={modeFilterOptions}
                    onChange={(value) => handleDraftFilterChange("mode", value)}
                    placeholder="All Modes"
                    ariaLabel="Mode"
                  />
                </FieldShell>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    Bộ lọc chỉ áp dụng sau khi bấm <span className="font-semibold">Apply Filters</span> để tránh giật phân trang và giữ side drawer luôn khớp với dữ liệu đang xem.
                  </p>
                  {metaError ? (
                    <p className="text-xs text-amber-600">{metaError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-11 items-center gap-2 justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    title="Reset Filters"
                  >
                    <RefreshCw size={14} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    disabled={!hasPendingFilterChanges}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Search size={14} />
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Request List</div>
                <div className="text-xs text-slate-500">
                  Nhấn vào một dòng để mở detail ở panel bên phải thay vì đẩy màn hình chính xuống dưới.
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {requestsLoading
                  ? "Đang cập nhật danh sách."
                  : `${numberFmt.format(requestState.total || 0)} requests`}
              </div>
            </div>

            {requestsLoading && !requestState.items.length ? (
              <div className="p-8">
                <EmptyState
                  icon={<Search size={20} />}
                  title="Loading Requests"
                  description="Đang tải danh sách request AI theo bộ lọc hiện tại."
                  accentColor="indigo"
                />
              </div>
            ) : requestsError && !requestState.items.length ? (
              <div className="p-8">
                <EmptyState
                  variant="error"
                  icon={<Search size={20} />}
                  title="Requests Error"
                  description={requestsError}
                  accentColor="rose"
                />
              </div>
            ) : requestState.items.length ? (
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
                          onClick={() => {
                            setSelectedRequestId(item.request_id);
                            setDetailOpen(true);
                          }}
                          className={`cursor-pointer transition hover:bg-slate-50 ${
                            selectedRequestId === item.request_id
                              ? "bg-violet-50/40"
                              : ""
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
                            <div className="font-semibold text-slate-700">
                              {item.model}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatProviderLabel(item.provider)} /{" "}
                              {formatModeLabel(item.mode)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(
                                item.status,
                              )}`}
                            >
                              {formatStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${usageClass(
                                item.usage_source,
                              )}`}
                            >
                              {formatUsageSourceLabel(item.usage_source)}
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
                  currentPage={activeFilters.page}
                  totalItems={requestState.total}
                  pageSize={activeFilters.page_size}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  showPageSizeSelector
                  label="requests"
                />
              </>
            ) : (
              <div className="p-8">
                <EmptyState
                  icon={<Search size={20} />}
                  title="No AI Requests"
                  description="Không có request AI nào khớp với bộ lọc hiện tại."
                />
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              icon={<Cpu size={18} />}
              title="Pricing"
              description="Chỉnh sửa bảng giá theo provider, mode và model; có thể research giá chính thức trước khi lưu nhưng không tự động ghi đè xuống backend."
            />
            {settingsError && !pricingRows.length ? (
              <EmptyState
                variant="error"
                title="Pricing Error"
                description={settingsError}
                accentColor="rose"
              />
            ) : (
              <>
                <p className="mb-4 text-xs text-slate-500">
                  Chỉ các dòng có đủ provider, mode và model mới được lưu. Nút{" "}
                  <span className="font-semibold">Research Prices</span> chỉ lấy
                  dữ liệu từ nguồn chính thức để bạn rà soát rồi mới quyết định lưu.
                </p>
                <div className="space-y-3">
                  {pricingRows.map((row, index) => {
                    const rowModelOptions = pricingModelOptions[row.provider] || [];
                    const canResearch =
                      row.provider &&
                      row.provider !== "proxy" &&
                      row.model &&
                      researchingRowIndex == null;

                    return (
                      <div
                        key={row.row_id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-500">
                              {index + 1}
                            </span>
                            <div className="min-w-0 text-sm font-semibold text-slate-700">
                              {row.model || "New pricing row"}
                            </div>
                          </div>
                          {row.research_status ? (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${researchBadgeClass(
                                row.research_status,
                              )}`}
                            >
                              {row.research_status}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px_minmax(0,1.3fr)]">
                          <FieldShell label="Provider" className="bg-white">
                            <SelectControl
                              value={row.provider}
                              onChange={(value) =>
                                handlePricingRowChange(index, "provider", value)
                              }
                              options={pricingProviderOptions}
                              placeholder="Select Provider"
                              ariaLabel={`Provider ${index + 1}`}
                            />
                          </FieldShell>

                          <FieldShell label="Mode" className="bg-white">
                            <SelectControl
                              value={row.mode}
                              onChange={(value) =>
                                handlePricingRowChange(index, "mode", value)
                              }
                              options={pricingModeOptions}
                              placeholder="Select Mode"
                              ariaLabel={`Mode ${index + 1}`}
                            />
                          </FieldShell>

                          <FieldShell label="Model" className="bg-white">
                            <SearchableCombobox
                              value={row.model}
                              onChange={(value) =>
                                handlePricingRowChange(index, "model", value)
                              }
                              options={rowModelOptions.map((model) => ({
                                value: model,
                                label: model,
                              }))}
                              placeholder="Search or type model"
                              emptyMessage="No matching models."
                              ariaLabel={`Model ${index + 1}`}
                            />
                          </FieldShell>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                          {[
                            ["input_cost_per_million", "Input / 1M"],
                            ["output_cost_per_million", "Output / 1M"],
                            ["cached_input_cost_per_million", "Cached / 1M"],
                          ].map(([key, label]) => (
                            <FieldShell key={key} label={label} className="bg-white">
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={row[key]}
                                onChange={(event) =>
                                  handlePricingRowChange(index, key, event.target.value)
                                }
                                className="min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
                              />
                            </FieldShell>
                          ))}

                          <div className="flex flex-wrap items-end justify-end gap-2 xl:flex-nowrap">
                            <button
                              type="button"
                              onClick={() => handleResearchPricing(index)}
                              disabled={!canResearch || pricingSaving}
                              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Research Prices"
                            >
                              <Search size={14} />
                              {researchingRowIndex === index
                                ? "Researching..."
                                : "Research Prices"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPricingRows((prev) =>
                                  prev.length === 1
                                    ? [createEmptyPricingRow()]
                                    : prev.filter((_, rowIndex) => rowIndex !== index),
                                )
                              }
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                              title="Remove Row"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>

                        {row.provider === "proxy" ? (
                          <p className="mt-3 text-xs text-slate-500">
                            Provider tuỳ biến chưa có nguồn giá chính thức ổn định để
                            research tự động, nên cần nhập tay.
                          </p>
                        ) : null}

                        {row.research_status ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${researchBadgeClass(
                                  row.research_status,
                                )}`}
                              >
                                {row.research_status}
                              </span>
                              {row.research_source_label && row.research_source_url ? (
                                <a
                                  href={row.research_source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-violet-700 transition hover:text-violet-800"
                                >
                                  {row.research_source_label}
                                </a>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {row.research_detail}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPricingRows((prev) => [...prev, createEmptyPricingRow()])
                    }
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
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle
              icon={<ShieldAlert size={18} />}
              title="Budget"
              description="Đặt ngưỡng ngày/tháng, thời gian lưu giữ và hard stop cho toàn bộ request AI."
            />
            {settingsError && !pricingRows.length ? (
              <EmptyState
                variant="error"
                title="Budget Error"
                description={settingsError}
                accentColor="rose"
              />
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Đặt ngưỡng theo ngày và theo tháng, chọn thời gian lưu giữ và quy
                  định request nào sẽ bị chặn khi vượt ngân sách.
                </p>
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
                        Nếu bật, request AI mới sẽ bị chặn ngay khi tổng chi phí đã ghi
                        nhận vượt ngưỡng theo ngày hoặc theo tháng.
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
                      <div className="text-sm font-bold text-slate-800">
                        Raw Payload Retention
                      </div>
                      <div className="text-xs text-slate-500">
                        Mặc định đang tắt. Preview và hash vẫn luôn được lưu ngay cả
                        khi không giữ raw payload.
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
            )}
          </div>
        </section>
      </div>

      <DetailDrawer
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedRequestId(null);
          setSelectedRequest(null);
          setRequestDetailError("");
        }}
        selectedRequest={selectedRequest}
        selectedRequestId={selectedRequestId}
        requestDetailLoading={requestDetailLoading}
        requestDetailError={requestDetailError}
      />
    </>
  );
};

export default AiOpsView;
