import React, { useState, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import {
    Search,
    Edit,
    Trash2,
    Plus,
    CornerDownRight,
    ShoppingBag,
    TrendingUp,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import Card from '../../../components/common/Card';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import LoadingOverlay from '../../../components/common/LoadingOverlay';

ModuleRegistry.registerModules([AllCommunityModule]);

const CategoryRegistry = ({
    categories = [],
    subCategories = [],
    onDeleteCategory,
    onDeleteSubCategory,
    onQuickAddSub,
    onEditCategory,
    onEditSubCategory,
    onCreateCategory,
    onToggleStatus,
    onToggleSubStatus,
    selectedYearId,
    loading = false,
    hasFetchedOnce = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const gridRef = useRef(null);

    const formatDisplayDate = (date) => {
        if (!date) return '-';
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const flatData = useMemo(() => {
        const result = [];
        const safeCategories = Array.isArray(categories) ? categories : [];
        const safeSubCategories = Array.isArray(subCategories) ? subCategories : [];

        safeCategories.forEach(cat => {
            result.push({ ...cat, isSubCategory: false });
            const subs = safeSubCategories.filter(s => s.parentId === cat.id);
            subs.forEach(sub => {
                // Ensure subcategories inherit the formatted type from their parent
                result.push({ ...sub, isSubCategory: true, parentType: cat.type, parentName: cat.name });
            });
        });

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return result.filter(item =>
                (item.name || '').toLowerCase().includes(term) ||
                (item.type || item.parentType || '').toLowerCase().includes(term)
            );
        }

        return result;
    }, [categories, subCategories, searchTerm]);

    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: []
    }), []);

    const colDefs = useMemo(() => [
        {
            headerName: "Category Name",
            field: "name",
            flex: 2,
            minWidth: 200,
            cellRenderer: (params) => {
                const { data } = params;
                return (
                    <div className="flex items-center gap-2.5 h-full w-full overflow-hidden group">
                        {data.isSubCategory ? (
                            <CornerDownRight size={14} className="text-gray-300 ml-4 shrink-0 transition-colors group-hover:text-gray-400" />
                        ) : (
                            <div className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                                <ShoppingBag size={12} strokeWidth={2.5} />
                            </div>
                        )}
                        <div className="flex flex-col justify-center min-w-0">
                            <span className={cn(
                                "truncate font-bold tracking-tight",
                                data.isSubCategory ? "text-[12px] text-gray-700" : "text-[12px] text-gray-900"
                            )} title={data.name}>
                                {data.name}
                            </span>
                        </div>
                    </div>
                );
            }
        },
        {
            headerName: "Type",
            field: "type",
            flex: 1,
            minWidth: 100,
            cellRenderer: (params) => {
                const { data } = params;
                const typeVal = data.isSubCategory ? data.parentType : data.type;
                const lowerType = String(typeVal || '').toLowerCase();

                let Icon = ArrowDownCircle;
                let textColorClass = 'text-rose-600';

                if (lowerType === 'income') {
                    Icon = ArrowUpCircle;
                    textColorClass = 'text-emerald-600';
                } else if (lowerType === 'investment') {
                    Icon = TrendingUp;
                    textColorClass = 'text-amber-600';
                }

                return (
                    <div className="flex items-center gap-1.5 h-full">
                        <Icon size={12} className={textColorClass} strokeWidth={2.5} />
                        <span className={cn("text-[11px] font-bold uppercase tracking-wider", textColorClass)}>
                            {typeVal || '-'}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: "Stats",
            field: "transactionCount",
            flex: 1.5,
            minWidth: 140,
            cellRenderer: (params) => {
                const { data } = params;
                return (
                    <div className="flex flex-col justify-center h-full">
                        <span className="text-[11px] font-bold text-gray-600 tracking-tight">
                            {Number(data.transactionCount || 0)} txns
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 truncate">
                            Used: {formatDisplayDate(data.lastUsedDate)}
                        </span>
                    </div>
                );
            }
        },

        {
            headerName: "Action",
            maxWidth: 160,
            sortable: false,
            filter: false,
            cellRenderer: (params) => {
                const { data } = params;
                return (
                    <div className="flex items-center gap-1.5 h-full opacity-60 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        {!data.isSubCategory && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onQuickAddSub(data); }}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title={`Add Sub-Category to ${data.name}`}
                            >
                                <Plus size={12} strokeWidth={2.5} />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (data.isSubCategory) onEditSubCategory(data);
                                else onEditCategory(data);
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#4A8AF4] hover:bg-[#4A8AF4]/10 rounded-md transition-colors"
                        >
                            <Edit size={12} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (data.isSubCategory) onDeleteSubCategory(data.id);
                                else onDeleteCategory(data.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                            <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                    </div>
                );
            }
        }
    ], [onToggleStatus, onToggleSubStatus, onEditCategory, onEditSubCategory, onDeleteCategory, onDeleteSubCategory, onQuickAddSub]);
    const gridTheme = useMemo(() => themeQuartz.withParams({
        headerFontSize: 12,
    }), []);

    return (
        <Card noPadding className="!border-none !shadow-none !rounded-none flex flex-col bg-white overflow-hidden w-full h-full min-h-[400px]">
            {/* Header Toolbar */}
            <div className="px-3 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 relative print:hidden min-h-[60px] z-50 bg-white">
                {/* Left: Actions (and Mobile Search Toggle) */}
                <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto">
                    <button
                        onClick={onCreateCategory}
                        className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-blue-200 bg-blue-50/50 text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all text-[12px] font-medium"
                        title="Add Category"
                    >
                        <Plus size={14} strokeWidth={2.5} className="text-[#4A8AF4]/80 group-hover:text-[#4A8AF4] transition-colors" />
                        <span className="text-[#3B6FC8] group-hover:text-[#2F5FC6] transition-colors">Add Category</span>
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                        className={cn(
                            "sm:hidden flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:border-[#BAE6FD] hover:bg-[#F0F9FF] hover:text-[#4A8AF4] focus:outline-none focus-visible:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:text-[#4A8AF4]",
                            isMobileSearchOpen && "border-[#BAE6FD] bg-[#F0F9FF] text-[#4A8AF4]"
                        )}
                        aria-label="Toggle search"
                    >
                        <Search size={14} />
                    </button>
                </div>

                {/* Right: Search Field */}
                <div className={cn("items-center gap-3 w-full sm:w-auto", isMobileSearchOpen ? "flex" : "hidden sm:flex")}>
                    <div className="relative group w-full sm:w-[240px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4A8AF4] transition-colors" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search"
                            className="w-full pl-9 pr-3 h-[32px] bg-white border border-gray-200 rounded-md text-[13px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#BAE6FD] outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        />
                    </div>
                </div>
            </div>

            {/* Grid Container */}
            <div
                className="category-grid-shell relative w-full px-0 sm:px-5 pb-1 flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-75px)] min-h-[400px]"
            >
                {showInitialLoader ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                        <LoadingOverlay label="Loading Categories..." />
                    </div>
                ) : (
                    <>
                        {/* Desktop View (AG Grid) */}
                        <div className="hidden sm:block h-full w-full relative">
                            <div className="absolute inset-0">
                                <AgGridReact
                                    ref={gridRef}
                                    theme={gridTheme}
                                    rowData={flatData}
                                    columnDefs={colDefs}
                                    defaultColDef={defaultColDef}
                                    rowHeight={42}
                                    headerHeight={44}
                                    animateRows={true}
                                    rowSelection="single"
                                    suppressCellFocus={true}
                                    suppressRowClickSelection={true}
                                    domLayout="normal"
                                    pagination={true}
                                    paginationPageSize={50}
                                    paginationPageSizeSelector={[25, 50, 100, 200]}
                                    getRowStyle={(params) => {
                                        if (!params.data) return null;
                                        const { data, node, api } = params;
                                        const nextNode = api.getDisplayedRowAtIndex(node.rowIndex + 1);
                                        if (nextNode && nextNode.data) {
                                            if (!data.isSubCategory && nextNode.data.isSubCategory && nextNode.data.parentId === data.id) {
                                                return { borderBottomColor: 'transparent' };
                                            }
                                            if (data.isSubCategory && nextNode.data.isSubCategory && nextNode.data.parentId === data.parentId) {
                                                return { borderBottomColor: 'transparent' };
                                            }
                                        }
                                        return null;
                                    }}
                                    overlayNoRowsTemplate={
                                        '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No categories found</span>'
                                    }
                                />
                            </div>
                        </div>

                        {/* Mobile View (Card List) */}
                        <div className="block sm:hidden flex-1 overflow-y-auto px-4 py-2 space-y-3 bg-slate-50/50">
                            {flatData.length === 0 ? (
                                <div className="py-8 text-center text-sm font-medium text-gray-500">No categories found</div>
                            ) : (
                                [...flatData]
                                    .sort((a, b) => {
                                        const aActive = a.status === 1 || a.status === 'active';
                                        const bActive = b.status === 1 || b.status === 'active';
                                        if (aActive === bActive) return 0;
                                        return aActive ? -1 : 1;
                                    })
                                    .map((data, index) => {
                                        const isActive = data.status === 1 || data.status === 'active';
                                        const typeVal = data.isSubCategory ? data.parentType : data.type;
                                        const lowerType = String(typeVal || '').toLowerCase();
                                        
                                        let Icon = ArrowDownCircle;
                                        let textColorClass = 'text-rose-600';
                        
                                        if (lowerType === 'income') {
                                            Icon = ArrowUpCircle;
                                            textColorClass = 'text-emerald-600';
                                        } else if (lowerType === 'investment') {
                                            Icon = TrendingUp;
                                            textColorClass = 'text-amber-600';
                                        }

                                        return (
                                            <div key={data.isSubCategory ? `sub-${data.id}` : `cat-${data.id}`} className={cn("rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-200 p-4 flex flex-col gap-3 relative", !isActive ? "bg-[#fef2f2]" : "bg-white")}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1 flex items-center gap-2">
                                                        {data.isSubCategory ? (
                                                            <CornerDownRight size={14} className="text-gray-400 shrink-0" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                                                                <ShoppingBag size={12} strokeWidth={2.5} />
                                                            </div>
                                                        )}
                                                        <div className="truncate text-[14px] font-bold text-slate-800">
                                                            {data.name || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 -mr-2">
                                                        {!data.isSubCategory && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onQuickAddSub(data); }}
                                                                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                                                title="Add Sub-Category"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (data.isSubCategory) onEditSubCategory(data);
                                                                else onEditCategory(data);
                                                            }}
                                                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-slate-50 hover:text-[#4A8AF4]"
                                                            title="Edit"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (data.isSubCategory) onDeleteSubCategory(data.id);
                                                                else onDeleteCategory(data.id);
                                                            }}
                                                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Icon size={12} className={textColorClass} strokeWidth={2.5} />
                                                        <span className={cn("text-[11px] font-bold uppercase tracking-wider", textColorClass)}>
                                                            {typeVal || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0">
                                                        <span className="text-[11px] font-bold text-gray-600 tracking-tight">
                                                            {Number(data.transactionCount || 0)} txns
                                                        </span>
                                                        <span className="text-[10px] font-medium text-gray-400 truncate">
                                                            Used: {formatDisplayDate(data.lastUsedDate)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </>
                )}
                {showOverlayLoader && <LoadingOverlay label="Updating Categories..." />}
            </div>
        </Card>
    );
};

export default CategoryRegistry;
