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
                                <ShoppingBag size={12} strokeWidth={2.5}/>
                            </div>
                        )}
                        <div className="flex flex-col justify-center min-w-0">
                            <span className={cn(
                                "truncate font-bold tracking-tight",
                                data.isSubCategory ? "text-[12px] text-gray-700" : "text-[13px] text-gray-900"
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
                        <Icon size={12} className={textColorClass} strokeWidth={2.5}/>
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
                                    ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700" 
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                                className="px-2 py-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 rounded bg-emerald-50/50 border border-emerald-100 transition-all"
                                title={`Add Sub-Category to ${data.name}`}
                            >
                                <Plus size={10} strokeWidth={3} /> Add
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

    const myTheme = useMemo(() => themeQuartz.withParams({
        headerHeight: 44,
        rowHeight: 46,
        headerBackgroundColor: '#F8FAFC',
        headerTextColor: '#64748B',
        headerFontWeight: 800,
        headerFontSize: 11,
        rowBorder: { style: 'solid', width: 1, color: '#f1f5f9' },
        wrapperBorder: false,
        wrapperBorderRadius: 0,
        cellHorizontalPadding: 16,
    }), []);

    return (
        <Card noPadding className="rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col bg-white overflow-hidden w-full h-full min-h-[400px]">
            {/* Header Toolbar */}
            <div className="relative z-50 px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-4 flex-none bg-white">
                <div className="relative w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full pl-9 pr-4 py-1.5 bg-[#f8fafc] border border-gray-100 rounded-lg text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-2" ref={dropdownAreaRef}>
                    <div className="relative">
                        <button
                            onClick={() => setActiveDropdown(prev => prev === 'export' ? null : 'export')}
                            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-[13px] font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <Download size={14} /> Export
                        </button>
                        {activeDropdown === 'export' && (
                            <div className="absolute top-full mt-2 right-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                                <button className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                    <span>Export to Excel</span>
                                </button>
                                <button className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                    <FileText size={14} className="text-rose-500" />
                                    <span>Export to PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onCreateCategory}
                        className="px-3 py-1.5 bg-black text-white rounded-lg text-[13px] font-bold hover:bg-gray-800 transition-colors shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={14} strokeWidth={3} />
                        New Category
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="relative flex-1 min-h-[400px] bg-white w-full overflow-hidden">
                {showInitialLoader ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                        <LoadingOverlay label="Loading Categories..." />
                    </div>
                ) : (
                    <>
                        <style>{`
                            .custom-category-grid .ag-root-wrapper { border: none !important; }
                            .custom-category-grid .ag-header { border-bottom: 2px solid #f1f5f9; }
                            .custom-category-grid .ag-row { transition: background-color 0.15s ease; border-bottom: 1px solid #f8fafc; }
                            .custom-category-grid .ag-row:hover { background-color: #f8fafc !important; }
                        `}</style>
                        <div className="absolute inset-0 custom-category-grid">
                            <AgGridReact
                                ref={gridRef}
                                theme={myTheme}
                                rowData={flatData}
                                columnDefs={colDefs}
                                defaultColDef={defaultColDef}
                                animateRows={true}
                                rowSelection="single"
                                suppressCellFocus={true}
                                suppressRowClickSelection={true}
                                domLayout="normal"
                                overlayNoRowsTemplate={
                                    '<div class="flex flex-col items-center justify-center p-8 text-gray-400"><div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-3 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><span class="text-sm font-bold opacity-50">No categories found</span></div>'
                                }
                            />
                        </div>
                    </>
                )}
                {showOverlayLoader && <LoadingOverlay label="Updating Categories..." />}
            </div>
        </Card>
    );
};

export default CategoryRegistry;
