import React, { useState, useMemo } from 'react';
import {
    Search,
    Edit,
    Trash2,
    Plus,
    Star,
    CornerDownRight,
    Download,
    FileSpreadsheet,
    FileText,
    X
} from 'lucide-react';
import Card from '../../../components/common/Card';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import { cn } from '../../../utils/cn';
import MobilePagination from '../../../components/common/MobilePagination';
import { Can } from '../../../hooks/usePermission';

/** Custom tooltip that shows a white card with the full branch list on hover */
const BranchTooltip = ({ branchNames, className = '' }) => {
    const [visible, setVisible] = useState(false);
    if (!branchNames || branchNames.length === 0) return <span className="text-gray-400">-</span>;
    const displayText = branchNames.join(', ');
    const needsTooltip = branchNames.length > 1 || displayText.length > 22;

    return (
        <span
            className={cn('relative inline-block max-w-full', className)}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-[12px] font-semibold text-gray-600 cursor-default">
                {displayText}
            </span>

            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[200] min-w-[160px] max-w-[260px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Branches</span>
                    {branchNames.map((b, i) => (
                        <span key={i} className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-gray-700 truncate">{b}</span>
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
};

const CategoryRegistry = ({
    categories,
    subCategories,
    onDeleteCategory,
    onDeleteSubCategory,
    onQuickAddSub,
    onEditCategory,
    onEditSubCategory,
    onToggleStatus,
    onToggleSubStatus,
    pageSize,
    showBranchColumn = true,
    loading = false,
    hasFetchedOnce = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    // Unified activeDropdown state
    const [activeDropdown, setActiveDropdown] = useState(null); // 'view' | 'export' | null
    const [showSearch, setShowSearch] = useState(false);

    // Filter categories and sub-categories
    const filteredCategories = useMemo(() => {
        return categories.filter(cat =>
            cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cat.type.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [categories, searchTerm]);

    const totalPages = Math.ceil(filteredCategories.length / pageSize);
    const paginatedCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const startEntry = filteredCategories.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endEntry = Math.min(currentPage * pageSize, filteredCategories.length);
    const printCategories = filteredCategories;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    const handleExportExcel = () => {
        const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const normalizeStatus = (status) => (
            status === 2 || String(status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
        );

        const headers = ["Category", "Sub-Category", "Type", "Status"];
        const rows = [];

        filteredCategories.forEach((category) => {
            rows.push([
                escapeCsv(category.name),
                escapeCsv(''),
                escapeCsv(category.type || ''),
                escapeCsv(normalizeStatus(category.status))
            ].join(","));

            const linkedSubs = subCategories.filter((sub) => sub.parentId === category.id);
            linkedSubs.forEach((sub) => {
                rows.push([
                    escapeCsv(category.name),
                    escapeCsv(sub.name),
                    escapeCsv(category.type || ''),
                    escapeCsv(normalizeStatus(sub.status))
                ].join(","));
            });
        });

        const csvContent = [headers.join(","), ...rows].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "categories_with_subcategories.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setActiveDropdown(null);
    };

    const handleExportPDF = () => {
        window.print();
        setActiveDropdown(null);
    };

    const closeDropdowns = () => setActiveDropdown(null);

    return (
        <Card noPadding className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col bg-white category-laptop-registry-card w-full max-h-full min-h-0" onClick={closeDropdowns}>
            <style>{`
                @media print {
                    @page { margin: 12mm; }
                    body { -webkit-print-color-adjust: exact; background: white !important; }
                    nav, aside, header, footer, .sidebar { display: none !important; }
                    .print\\:hidden { display: none !important; }
                    
                    /* Reset layout for print */
                    .min-h-screen, .h-screen { height: auto !important; min-height: 0 !important; }
                    .overflow-hidden { overflow: visible !important; }
                    .overflow-y-auto { overflow: visible !important; }
                    .overflow-x-auto { overflow: visible !important; }
                    .max-h-\\[670px\\] { max-height: none !important; }
                    .flex-1 { flex: none !important; }

                    /* Hide scrollbars explicitly */
                    ::-webkit-scrollbar { display: none !important; }
                    * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                }
            `}</style>

            <div className="hidden print:block pb-6">
                <h1 className="text-2xl font-bold text-gray-900 text-center">Category List</h1>
                <div className="h-[1px] bg-black w-full mt-2"></div>
            </div>

            {/* Print-only Table: transaction-like full grid */}
            <div className="hidden print:block overflow-visible">
                <table className="w-full border-collapse text-xs text-black table-fixed">
                    <thead>
                        <tr className="bg-gray-100 border-y border-gray-300">
                            <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[8%]">Id</th>
                            <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[28%]">Category</th>
                            <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[28%]">Sub-Category</th>
                            {showBranchColumn && (
                                <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[18%]">Branch</th>
                            )}
                            <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider text-center w-[9%]">Type</th>
                            <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider text-center w-[9%]">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {printCategories.length > 0 ? (
                            printCategories.map((cat, idx) => {
                                const serial = idx + 1;
                                const catSubs = subCategories.filter((sub) => sub.parentId === cat.id);
                                const catStatus = (cat.status === 2 || cat.status === 'inactive') ? 'Inactive' : 'Active';
                                return (
                                    <React.Fragment key={`print-cat-${cat.id}`}>
                                        <tr className="bg-white">
                                            <td className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-600">{serial}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-800">{cat.name}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-[10px] text-gray-500">-</td>
                                            {showBranchColumn && (
                                                <td className="border border-gray-300 px-3 py-2 text-[10px] text-gray-600">
                                                    {cat.branchNames?.length ? cat.branchNames.join(', ') : '-'}
                                                </td>
                                            )}
                                            <td className="border border-gray-300 px-3 py-2 text-[10px] text-center font-bold text-gray-700">{cat.type}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-[10px] text-center text-gray-700">{catStatus}</td>
                                        </tr>
                                        {catSubs.map((sub) => {
                                            const subStatus = (sub.status === 2 || sub.status === 'inactive') ? 'Inactive' : 'Active';
                                            return (
                                                <tr key={`print-sub-${sub.id}`} className="bg-gray-50">
                                                    <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-gray-400"> </td>
                                                    <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-gray-400"> </td>
                                                    <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-gray-700 pl-6">- {sub.name}</td>
                                                    {showBranchColumn && (
                                                        <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-gray-500">
                                                            {sub.branchNames?.length ? sub.branchNames.join(', ') : '-'}
                                                        </td>
                                                    )}
                                                    <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-center text-gray-600">{cat.type}</td>
                                                    <td className="border border-gray-300 px-3 py-1.5 text-[9px] text-center text-gray-600">{subStatus}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={showBranchColumn ? 6 : 5} className="border border-gray-300 px-4 py-8 text-center text-[11px] text-gray-500">
                                    No categories found in the registry
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Backdrop for click-outside closing */}
            {activeDropdown && (
                <div
                    className="fixed inset-0 z-45 bg-black/5 lg:bg-transparent"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(null);
                    }}
                />
            )}

            {/* Header with View and Search */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex flex-row items-center justify-between gap-4 flex-none print:hidden category-laptop-registry-toolbar">
                {showSearch ? (
                    // Mobile Expanded Search View
                    <div className="w-full flex items-center space-x-2 animate-in fade-in duration-200 lg:hidden">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                placeholder="Search categories..."
                                className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setShowSearch(false);
                                setSearchTerm('');
                            }}
                            className="p-2 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="relative hidden lg:block w-64">
                            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 " />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setActiveDropdown(null)}
                                placeholder="Search categories..."
                                className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="flex items-center space-x-3 justify-end">




                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => setActiveDropdown(prev => prev === 'export' ? null : 'export')}
                                    className={cn(
                                        "w-10 h-10 flex items-center justify-center rounded-xl border transition-all",
                                        activeDropdown === 'export' ? "bg-gray-100 border-gray-200" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                                    )}
                                    title="Export"
                                >
                                    <Download size={18} />
                                </button>
                                {activeDropdown === 'export' && (
                                    <div className="absolute top-12 right-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                                        <button onClick={handleExportExcel} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                            <FileSpreadsheet size={14} className="text-emerald-500" />
                                            <span>Export to Excel</span>
                                        </button>
                                        <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                            <FileText size={14} className="text-rose-500" />
                                            <span>Export to PDF</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Search Toggle */}
                            <button
                                onClick={() => setShowSearch(true)}
                                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 transition-all active:scale-95 bg-white"
                            >
                                <Search size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="relative lg:hidden p-4 space-y-3 print:hidden" aria-busy={loading}>
                {showInitialLoader ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 font-medium text-sm">Loading...</p>
                    </div>
                ) : paginatedCategories.length > 0 ? (
                    paginatedCategories.map((cat) => (
                        <div key={cat.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm relative">
                            {/* Parent Category Header & Actions */}
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-3 pr-8">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-slate-400 shrink-0">
                                        <Star size={16} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm leading-tight">{cat.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn(
                                                "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight",
                                                cat.type === 'Income' ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {cat.type}
                                            </span>
                                            {showBranchColumn && cat.branchNames && cat.branchNames.length > 0 && (
                                                <span
                                                    className="text-[9px] font-semibold text-gray-400 truncate max-w-[100px]"
                                                    title={cat.branchNames.join(', ')}
                                                >
                                                    {cat.branchNames.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Compact Actions */}
                                <div className="absolute top-3 right-3 flex items-center space-x-1">
                                    <button onClick={() => onEditCategory(cat)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => onDeleteCategory(cat.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Sub Categories Section */}
                            {subCategories.filter(sub => sub.parentId === cat.id).length > 0 && (
                                <div className="mt-2 bg-gray-50/50 rounded-lg p-2 space-y-1.5 border border-gray-100/50">
                                    {subCategories.filter(sub => sub.parentId === cat.id).map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between group">
                                            <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                                                <CornerDownRight size={12} className="text-gray-400 shrink-0" />
                                                <div className="flex flex-col truncate">
                                                    <span className="text-xs font-medium text-gray-700 truncate">{sub.name}</span>
                                                    {showBranchColumn && sub.branchNames && sub.branchNames.length > 0 && (
                                                        <span className="text-[9px] text-gray-400 truncate" title={sub.branchNames.join('\n')}>
                                                            {sub.branchNames.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); onEditSubCategory(sub); }} className="p-1 text-slate-300 hover:text-indigo-600"><Edit size={12} /></button>
                                                <button onClick={() => onDeleteSubCategory(sub.id)} className="p-1 text-slate-300 hover:text-rose-600"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add Sub Button - Very Compact */}
                            <button onClick={() => onQuickAddSub(cat)} className="w-full mt-2 py-1 flex items-center justify-center gap-1 text-[10px] font-bold text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded border border-dashed border-gray-200 hover:border-emerald-200 transition-all">
                                <Plus size={10} strokeWidth={3} /> Add Sub
                            </button>
                        </div>
                    ))
                ) : hasFetchedOnce ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 text-gray-300 mb-3">
                            <Star size={24} />
                        </div>
                        <p className="text-gray-400 font-medium text-sm">No categories found</p>
                    </div>
                ) : null}
                {showOverlayLoader && <LoadingOverlay label="Loading categories..." />}
            </div>

            {/* Desktop Table View */}
            <div
                className="relative hidden lg:block print:hidden flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                aria-busy={loading}
            >
                <table className="w-full text-left border-collapse min-w-[700px] category-laptop-registry-table">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-y border-gray-200">
                            <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider bg-gray-50 w-[10%]">Id</th>
                            <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider bg-gray-50 w-[25%]">Name</th>
                            {showBranchColumn && (
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider bg-gray-50 w-[20%]">Branch</th>
                            )}
                            <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center align-middle bg-gray-50 w-[15%]">Type</th>
                            <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center bg-gray-50 w-[15%]">Status</th>
                            <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center bg-gray-50 print:hidden w-[15%]">Actions</th>
                        </tr>
                    </thead>

                    {showInitialLoader ? (
                        <tbody>
                            <tr>
                                <td colSpan={showBranchColumn ? 6 : 5} className="px-6 py-20 text-center text-sm text-gray-500">Loading...</td>
                            </tr>
                        </tbody>
                    ) : paginatedCategories.length > 0 ? (
                        paginatedCategories.map((cat, index) => {
                            const serialStart = (currentPage - 1) * pageSize + index + 1;
                            const catSubRows = subCategories.filter(sub => sub.parentId === cat.id);

                            return (
                                <tbody key={cat.id} className={index !== paginatedCategories.length - 1 ? "border-b border-gray-100" : ""}>
                                    {/* Parent Category Row */}
                                    <tr className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-1.5 text-[12px] font-bold text-slate-500">
                                            {serialStart}
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-[13px] font-bold text-slate-700">{cat.name}</span>
                                                    <button
                                                        onClick={() => onQuickAddSub(cat)}
                                                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-md transition-all opacity-0 group-hover:opacity-100 print:hidden"
                                                        title="Add Sub-category"
                                                    >
                                                        <Plus size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        {showBranchColumn && (
                                            <td className="px-4 py-1.5 max-w-[160px] overflow-visible">
                                                <BranchTooltip branchNames={cat.branchNames} />
                                            </td>
                                        )}
                                        <td rowSpan={catSubRows.length + 1} className="px-4 py-1.5 text-center align-middle">
                                            <div className="flex items-center justify-center h-full min-h-[24px]">
                                                <span className={cn(
                                                    "inline-flex items-center text-[10px] font-bold uppercase tracking-wider",
                                                    cat.type === 'Income'
                                                        ? "text-emerald-600"
                                                        : "text-rose-600"
                                                )}>
                                                    {cat.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Toggle: If 1 (Active) -> 2 (Inactive), else -> 1 (Active)
                                                    // Handle legacy string 'active'/'inactive' just in case, but prefer int
                                                    const currentStatus = cat.status === 1 || cat.status === 'active' ? 1 : 2;
                                                    const newStatus = currentStatus === 1 ? 2 : 1;
                                                    if (onToggleStatus) onToggleStatus(cat.id, newStatus);
                                                }}
                                                className={cn(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight transition-all hover:opacity-80",
                                                    (cat.status === 2 || cat.status === 'inactive')
                                                        ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                )}
                                            >
                                                {(cat.status === 2 || cat.status === 'inactive') ? 'Inactive' : 'Active'}
                                            </button>
                                        </td>

                                        <td className="px-4 py-1.5 print:hidden">
                                            <div className="flex items-center justify-center space-x-1">
                                                <button
                                                    onClick={() => onEditCategory(cat)}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all group/btn"
                                                    title="Edit"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteCategory(cat.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all group/btn"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Sub-Category Rows */}
                                    {catSubRows.map((sub) => (
                                        <tr key={sub.id} className="group hover:bg-gray-50/30 transition-colors">
                                            <td className="px-4 py-0.5 text-[11px] font-semibold text-slate-400"></td>
                                            <td className="px-4 py-0.5 pl-16">
                                                <div className="flex items-center space-x-3">
                                                    <CornerDownRight size={14} className="text-gray-500" />
                                                    <span className="text-[12px] font-normal text-slate-600">{sub.name}</span>
                                                </div>
                                            </td>
                                            {showBranchColumn && (
                                                <td className="px-4 py-0.5 max-w-[160px] overflow-visible">
                                                    <BranchTooltip branchNames={sub.branchNames} className="opacity-70" />
                                                </td>
                                            )}
                                            <td className="px-4 py-0.5 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const currentStatus = sub.status === 1 || sub.status === 'active' ? 1 : 2;
                                                        const newStatus = currentStatus === 1 ? 2 : 1;
                                                        if (onToggleSubStatus) onToggleSubStatus(sub, newStatus);
                                                    }}
                                                    className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight transition-all hover:opacity-80",
                                                        (sub.status === 2 || sub.status === 'inactive')
                                                            ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                    )}
                                                    title="Toggle sub-category status"
                                                >
                                                    {(sub.status === 2 || sub.status === 'inactive') ? 'Inactive' : 'Active'}
                                                </button>
                                            </td>

                                            <td className="px-4 py-0.5 print:hidden">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (typeof onEditSubCategory === 'function') onEditSubCategory(sub);
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-all rounded hover:bg-gray-50"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteSubCategory(sub.id)}
                                                        className="p-1 text-slate-400 hover:text-rose-400 transition-all rounded hover:bg-rose-50"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            );
                        })
                    ) : hasFetchedOnce ? (
                        <tbody>
                            <tr>
                                <td colSpan={showBranchColumn ? 6 : 5} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-slate-200">
                                            <Star size={24} />
                                        </div>
                                        <p className="text-gray-400 font-medium text-[13px]">No categories found in the registry</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    ) : null}
                </table>
                {showOverlayLoader && <LoadingOverlay label="Loading categories..." />}
            </div>

            <div className="lg:hidden border-t border-gray-100 p-2 print:hidden">
                <MobilePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>

            <div className="hidden lg:flex items-center justify-between px-4 py-3 sm:py-1.5 border-t border-gray-100 flex-none bg-white relative z-20 gap-3 sm:gap-0 print:hidden category-laptop-registry-footer">
                <div className="text-[11px] text-gray-500 font-medium text-center sm:text-left">
                    Showing <span className="font-bold text-gray-700">{startEntry}</span> to <span className="font-bold text-gray-700">{endEntry}</span> of <span className="font-bold text-gray-700">{filteredCategories.length}</span> results
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-0.5 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                    >
                        Previous
                    </button>

                    <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={cn(
                                    "w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-bold transition-all",
                                    page === currentPage
                                        ? "bg-gray-100 border border-gray-200 text-gray-900"
                                        : "text-gray-500 hover:bg-gray-100"
                                )}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-3 py-0.5 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default CategoryRegistry;
