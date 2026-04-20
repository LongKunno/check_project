import { useEffect, useMemo } from "react";

export function getPaginationState(totalItems, currentPage, pageSize) {
  const safeTotalItems = Math.max(0, totalItems || 0);
  const safePageSize = Math.max(1, pageSize || 1);
  const totalPages =
    safeTotalItems === 0 ? 0 : Math.ceil(safeTotalItems / safePageSize);
  const safeCurrentPage =
    totalPages === 0 ? 1 : Math.min(Math.max(1, currentPage), totalPages);
  const pageStartIndex =
    safeTotalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize;
  const pageEndIndex = Math.min(pageStartIndex + safePageSize, safeTotalItems);

  return {
    totalItems: safeTotalItems,
    pageSize: safePageSize,
    totalPages,
    safeCurrentPage,
    pageStartIndex,
    pageEndIndex,
    startItem: safeTotalItems === 0 ? 0 : pageStartIndex + 1,
    endItem: safeTotalItems === 0 ? 0 : pageEndIndex,
    hasItems: safeTotalItems > 0,
    hasMultiplePages: totalPages > 1,
  };
}

export function usePaginationState({
  items = [],
  currentPage,
  pageSize,
  onPageChange,
}) {
  const pagination = useMemo(
    () => getPaginationState(items.length, currentPage, pageSize),
    [items.length, currentPage, pageSize],
  );

  const pageItems = useMemo(
    () => items.slice(pagination.pageStartIndex, pagination.pageEndIndex),
    [items, pagination.pageEndIndex, pagination.pageStartIndex],
  );

  useEffect(() => {
    if (typeof onPageChange !== "function") return;
    if (currentPage !== pagination.safeCurrentPage) {
      onPageChange(pagination.safeCurrentPage);
    }
  }, [currentPage, onPageChange, pagination.safeCurrentPage]);

  return {
    ...pagination,
    pageItems,
  };
}
