import React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * Reusable pagination component with light theme styling.
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
  const [isPageSizeOpen, setIsPageSizeOpen] = React.useState(false);
  const pageSizeRef = React.useRef(null);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  React.useEffect(() => {
    if (!isPageSizeOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!pageSizeRef.current?.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsPageSizeOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPageSizeOpen]);

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
  const btnInactive = `${btnBase} text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent`;
  const btnActive = `${btnBase} text-blue-600 bg-blue-50 border border-blue-200`;
  const btnDisabled = `${btnBase} text-slate-300 cursor-not-allowed`;
  const btnNav = (disabled) => (disabled ? btnDisabled : btnInactive);

  return (
    <div className="px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50">
      {/* Left — Summary */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 font-medium">
          Showing{" "}
          <span className="text-slate-600 font-semibold">
            {startItem}–{endItem}
          </span>{" "}
          of <span className="text-slate-600 font-semibold">{totalItems}</span>{" "}
          {label}
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <div
            ref={pageSizeRef}
            className={`pagination-size-shell ${isPageSizeOpen ? "pagination-size-shell-open" : ""}`}
          >
            <button
              type="button"
              className="pagination-size-trigger"
              onClick={() => setIsPageSizeOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isPageSizeOpen}
            >
              <span className="pagination-size-value">{pageSize} / page</span>
              <span className="pagination-size-caret" aria-hidden="true">
                <ChevronDown size={12} />
              </span>
            </button>

            {isPageSizeOpen && (
              <div className="pagination-size-panel" role="listbox" aria-label="Page size">
                {pageSizeOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={pageSize === s}
                    className={`pagination-size-item ${pageSize === s ? "pagination-size-item-active" : ""}`}
                    onClick={() => {
                      onPageSizeChange(s);
                      onPageChange(1);
                      setIsPageSizeOpen(false);
                    }}
                  >
                    <span>{s} / page</span>
                    {pageSize === s && (
                      <span className="pagination-size-check" aria-hidden="true">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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
