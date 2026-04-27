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
    Download,
    FileSpreadsheet,
    FileText,
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
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownAreaRef = useRef(null);
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
            headerName: "Status",
            field: "status",
            flex: 1,
            maxWidth: 100,
            cellRenderer: (params) => {
                const { data } = params;
                const isActive = data.status === 1 || data.status === 'active';
                return (
                    <div className="flex items-center h-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (data.isSubCategory) {
                                    onToggleSubStatus(data, isActive ? 2 : 1);
                                } else {
                                    onToggleStatus(data.id, isActive ? 2 : 1);
                                }
                            }}
                            className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                                isActive
                                    ? "text-emerald-600 hover:text-emerald-700"
                                    : "text-gray-500 hover:text-gray-600"
                            )}
                        >
                            {isActive ? 'Active' : 'Inactive'}
                        </button>
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
        <Card noPadding className="border-none shadow-none rounded-none flex flex-col bg-white overflow-hidden w-full h-full min-h-[400px]">
            {/* Header Toolbar */}
            <div className="px-5 py-3 flex flex-row items-center justify-between gap-4 relative print:hidden min-h-[60px] z-50 bg-white">
                {/* Left: Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCreateCategory}
                        className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-blue-200 bg-blue-50/50 text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all text-[12px] font-medium"
                        title="Add Category"
                    >
                        <Plus size={14} strokeWidth={2.5} className="text-[#4A8AF4]/80 group-hover:text-[#4A8AF4] transition-colors" />
                        <span className="text-[#3B6FC8] group-hover:text-[#2F5FC6] transition-colors">Add Category</span>
                    </button>
                </div>

                {/* Right: Search */}
                <div className="flex items-center gap-3">
                    <div className="relative" ref={dropdownAreaRef}>
                        <button
                            onClick={() => setActiveDropdown(prev => prev === 'export' ? null : 'export')}
                            className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all text-[12px] font-medium"
                        >
                            <Download size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                            <span>Export</span>
                        </button>
                        {activeDropdown === 'export' && (
                            <div className="absolute top-full mt-2 right-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                                <button className="w-full text-left px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                    <span>Export to Excel</span>
                                </button>
                                <button className="w-full text-left px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                    <FileText size={14} className="text-rose-500" />
                                    <span>Export to PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="relative group w-[240px]">
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
                className="category-grid-shell relative w-full px-5 pb-1 flex flex-col"
                style={{ height: '760px' }}
            >
                {showInitialLoader ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                        <LoadingOverlay label="Loading Categories..." />
                    </div>
                ) : (
                    <div className="h-full w-full relative">
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
                                overlayNoRowsTemplate={
                                    '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No categories found</span>'
                                }
                            />
                        </div>
                    </div>
                )}
                {showOverlayLoader && <LoadingOverlay label="Updating Categories..." />}
            </div>
        </Card>
    );
};

export default CategoryRegistry;
