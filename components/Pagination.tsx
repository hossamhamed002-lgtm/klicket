import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

const buildPageItems = (currentPage: number, totalPages: number): Array<number | '...'> => {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
};

export const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  const safePageSize = Math.max(1, pageSize || 5);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), totalPages);
  const pageItems = buildPageItems(safeCurrentPage, totalPages);
  const canGoPrev = safeCurrentPage > 1;
  const canGoNext = safeCurrentPage < totalPages;

  const goToPage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next !== safeCurrentPage) {
      onPageChange(next);
    }
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 w-full select-none">
      
      {/* Pagination Controls - LTR direction for numbers sequence 1 -> 245 */}
      <div className="flex items-center gap-2 order-1" dir="ltr">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => goToPage(safeCurrentPage - 1)}
          disabled={!canGoPrev}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-brand-purple hover:text-white disabled:opacity-50 disabled:hover:bg-gray-100 disabled:hover:text-gray-400 transition-all"
        >
            <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageItems.map((item, index) =>
            item === '...' ? (
              <span key={`ellipsis-${index}`} className="w-10 h-10 flex items-center justify-center text-brand-purple font-bold text-lg pb-2">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-lg transition-colors ${
                  item === safeCurrentPage
                    ? 'bg-brand-purple text-white shadow-md shadow-purple-200'
                    : 'text-brand-purple hover:bg-purple-50'
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => goToPage(safeCurrentPage + 1)}
          disabled={!canGoNext}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-brand-purple hover:text-white disabled:opacity-50 disabled:hover:bg-gray-100 disabled:hover:text-gray-400 transition-all"
        >
            <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Rows Selector */}
      <div className="order-2">
         <div className="relative bg-gray-100 h-10 px-4 rounded-lg flex items-center cursor-pointer hover:bg-gray-200 transition-colors min-w-[120px]">
            <select
              value={safePageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              className="appearance-none bg-transparent text-gray-600 font-semibold pr-6 pl-1 outline-none cursor-pointer"
              dir="ltr"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  page/{option}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500" />
         </div>
      </div>

    </div>
  );
};
