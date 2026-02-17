import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface PaginationProps {
  totalPages?: number;
  currentPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({ totalPages = 245, currentPage = 1 }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 w-full select-none">
      
      {/* Pagination Controls - LTR direction for numbers sequence 1 -> 245 */}
      <div className="flex items-center gap-2 order-1" dir="ltr">
        {/* Previous Button */}
        <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-brand-purple hover:text-white transition-all">
            <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-purple text-white font-bold text-lg shadow-md shadow-purple-200">
                1
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-brand-purple font-bold text-lg hover:bg-purple-50 transition-colors">
                2
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-brand-purple font-bold text-lg hover:bg-purple-50 transition-colors">
                3
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-brand-purple font-bold text-lg hover:bg-purple-50 transition-colors">
                4
            </button>
            <span className="w-10 h-10 flex items-center justify-center text-brand-purple font-bold text-lg pb-2">...</span>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-brand-purple font-bold text-lg hover:bg-purple-50 transition-colors">
                {totalPages}
            </button>
        </div>

        {/* Next Button */}
        <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-brand-purple hover:text-white transition-all">
            <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Rows Selector */}
      <div className="order-2">
         <div className="bg-gray-100 h-10 px-4 rounded-lg flex items-center gap-8 cursor-pointer hover:bg-gray-200 transition-colors min-w-[120px] justify-between">
            <span className="text-gray-600 font-semibold">page/5</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
         </div>
      </div>

    </div>
  );
};