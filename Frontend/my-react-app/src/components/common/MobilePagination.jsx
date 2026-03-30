import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

const MobilePagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages === 0) return null;

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 1; // neighbors

        // Always show first page
        pages.push(1);

        // Add ellipsis or range
        if (currentPage > 3) {
            pages.push('...');
        }

        // Add neighbors
        for (let i = Math.max(2, currentPage - maxVisible); i <= Math.min(totalPages - 1, currentPage + maxVisible); i++) {
            pages.push(i);
        }

        // Add ellipsis or range
        if (currentPage < totalPages - 2) {
            pages.push('...');
        }

        // Always show last page if > 1
        if (totalPages > 1) {
            pages.push(totalPages);
        }

        return pages;
    };

    const renderPageKey = (page, index) => {
        if (page === '...') return `ellipsis-${index}`;
        return `page-${page}`;
    };

    return (
        <div className="flex items-center justify-center gap-2 py-2 w-full no-print">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                    "bg-white border border-gray-100 shadow-sm text-gray-500",
                    "disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                )}
            >
                <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map((page, index) => (
                <div key={renderPageKey(page, index)}>
                    {page === '...' ? (
                        <span className="w-9 h-9 flex items-center justify-center text-gray-400 text-xs shrink-0">
                            ...
                        </span>
                    ) : (
                        <button
                            onClick={() => onPageChange(page)}
                            className={cn(
                                "w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all shadow-sm",
                                currentPage === page
                                    ? "bg-gray-100 border border-gray-200 text-gray-900"
                                    : "bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 active:scale-95"
                            )}
                        >
                            {page}
                        </button>
                    )}
                </div>
            ))}

            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                    "bg-white border border-gray-100 shadow-sm text-gray-500",
                    "disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                )}
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
};

export default MobilePagination;
