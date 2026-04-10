import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * Reusable pagination component with premium dark theme styling.
 *
 * Props:
 *  - currentPage (number)    : 1-indexed current page
 *  - totalItems  (number)    : total number of items
 *  - pageSize    (number)    : items per page (default 10)
 *  - onPageChange(fn)        : callback (newPage) => void
 *  - onPageSizeChange(fn)    : optional callback (newSize) => void
 *  - showPageSizeSelector    : show rows-per-page selector (default false)
 *  - pageSizeOptions (array) : [5, 10, 20, 50] etc.
 *  - label       (string)    : e.g. "projects", "members"
 */
const Pagination = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = false,
  pageSizeOptions = [5, 10, 20, 50],
  label = "items",
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers to show (max 5 pages with ellipsis)
  const getPages = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push("...");
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems <= pageSize) return null; // Don't show if single page

  const btnBase =
    "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 select-none";
  const btnInactive = `${btnBase} text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] border border-transparent`;
  const btnActive = `${btnBase} text-white bg-blue-500/20 border border-blue-500/30 shadow-[0_0_12px_-4px_rgba(59,130,246,0.35)]`;
  const btnDisabled = `${btnBase} text-slate-700 cursor-not-allowed`;
  const btnNav = (disabled) => (disabled ? btnDisabled : btnInactive);

  return (
    <div className="px-5 py-3 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02]">
      {/* Left — Summary */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 font-medium">
          Showing{" "}
          <span className="text-slate-400 font-semibold">
            {startItem}–{endItem}
          </span>{" "}
          of <span className="text-slate-400 font-semibold">{totalItems}</span>{" "}
          {label}
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="text-[11px] bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-slate-400 font-medium outline-none focus:border-blue-500/40 cursor-pointer appearance-none"
            style={{ backgroundImage: "none" }}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s} className="bg-slate-900 text-slate-300">
                {s} / page
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right — Page controls */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className={btnNav(safeCurrentPage === 1)}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className={btnNav(safeCurrentPage === 1)}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers */}
        {getPages().map((page, i) =>
          page === "..." ? (
            <span
              key={`dots-${i}`}
              className="w-8 h-8 flex items-center justify-center text-slate-600 text-xs"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={page === safeCurrentPage ? btnActive : btnInactive}
            >
              {page}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          className={btnNav(safeCurrentPage === totalPages)}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          className={btnNav(safeCurrentPage === totalPages)}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
