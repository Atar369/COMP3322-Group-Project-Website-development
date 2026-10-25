import { useEffect, useState } from 'react';

export const PAGE_SIZE = 10;

export function usePagination(items, resetKey = '') {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  return {
    pageItems: items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    page: currentPage,
    pageCount,
    setPage,
  };
}

export default function Pagination({ page, pageCount, totalItems, onPageChange }) {
  if (pageCount <= 1) return null;

  const firstPage = Math.max(1, Math.min(page - 2, pageCount - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => firstPage + index
  );
  const firstItem = (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);

  function changePage(nextPage) {
    onPageChange(nextPage);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        Showing {firstItem}–{lastItem} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button type="button" onClick={() => changePage(page - 1)} disabled={page === 1} aria-label="Previous page">
          Previous
        </button>
        {visiblePages.map(pageNumber => (
          <button
            type="button"
            key={pageNumber}
            onClick={() => changePage(pageNumber)}
            aria-label={`Page ${pageNumber}`}
            aria-current={pageNumber === page ? 'page' : undefined}
            className={pageNumber === page ? 'is-current' : ''}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" onClick={() => changePage(page + 1)} disabled={page === pageCount} aria-label="Next page">
          Next
        </button>
      </div>
      <span className="pagination-page-count">Page {page} of {pageCount} · 10 per page</span>
    </nav>
  );
}
