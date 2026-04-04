import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Search,
    Filter,
    Check,
    Edit,
    Trash2,
    Plus,
    Star,
    CornerDownRight,
    Download,
    FileSpreadsheet,
    FileText,
    X,
    ChevronDown,
    Loader2,
    ArrowUpCircle,
    ArrowDownCircle,
    TrendingUp,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import { cn } from '../../../utils/cn';
import MobilePagination from '../../../components/common/MobilePagination';
import apiService from '../../../services/api';
import { Can } from '../../../hooks/usePermission';



const NAME_TOOLTIP_WIDTH = 184;
const NAME_TOOLTIP_HEIGHT = 62;
const NAME_TOOLTIP_GAP = 10;
const NAME_TOOLTIP_VIEWPORT_GUTTER = 12;

const CategoryNameTooltip = ({
    name,
    transactionCount,
    lastUsedLabel,
    className = '',
    textClassName = ''
}) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);

    useLayoutEffect(() => {
        if (!visible || !triggerRef.current) return undefined;

        const updatePosition = () => {
            if (!triggerRef.current) return;

            const rect = triggerRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = rect.left;
            if (left + NAME_TOOLTIP_WIDTH > viewportWidth - NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = viewportWidth - NAME_TOOLTIP_WIDTH - NAME_TOOLTIP_VIEWPORT_GUTTER;
            }
            if (left < NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            let top = rect.bottom + NAME_TOOLTIP_GAP;
            if (top + NAME_TOOLTIP_HEIGHT > viewportHeight - NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = rect.top - NAME_TOOLTIP_HEIGHT - NAME_TOOLTIP_GAP;
            }
            if (top < NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            setPosition({ top, left });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [visible]);

    return (
        <>
            <span
                ref={triggerRef}
                className={cn('inline-block max-w-full', className)}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                <span className={cn('block truncate cursor-default', textClassName)}>
                    {name}
                </span>
            </span>

            {visible && position && createPortal(
                <div
                    className="pointer-events-none fixed z-[240] min-w-[184px] rounded-lg border border-gray-100 bg-white px-2.5 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                    style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${NAME_TOOLTIP_WIDTH}px` }}
                >
                    <div className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Transactions</span>
                        <span className="text-[11px] font-semibold text-gray-700">{Number(transactionCount || 0)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Last Used</span>
                        <span className="text-[11px] font-semibold text-gray-700">{lastUsedLabel || '-'}</span>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const CATEGORY_TYPE_OPTIONS = [
    {
        value: 'Income',
        label: 'Income',
        icon: ArrowUpCircle,
        iconClassName: 'bg-emerald-50 text-emerald-600'
    },
    {
        value: 'Expense',
        label: 'Expense',
        icon: ArrowDownCircle,
        iconClassName: 'bg-rose-50 text-rose-600'
    },
    {
        value: 'Investment',
        label: 'Investment',
        icon: TrendingUp,
        iconClassName: 'bg-amber-50 text-amber-600'
    }
];

const CategoryTypeFilter = ({
    selectedTypes,
    onApplySelection,
    variant = 'icon'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    const allTypeValues = useMemo(() => CATEGORY_TYPE_OPTIONS.map((option) => option.value), []);
    const normalizedSelectedTypes = useMemo(() => (
        Array.from(new Set((selectedTypes || []).filter(Boolean)))
    ), [selectedTypes]);
    const hasSpecificSelection = normalizedSelectedTypes.length > 0
        && normalizedSelectedTypes.length < allTypeValues.length;
    const selectedValuesForDisplay = hasSpecificSelection
        ? normalizedSelectedTypes
        : allTypeValues;
    const selectedLabels = CATEGORY_TYPE_OPTIONS
        .filter((option) => selectedValuesForDisplay.includes(option.value))
        .map((option) => option.label);
    const displayLabel = !hasSpecificSelection
        ? 'Type'
        : selectedLabels.slice(0, 2).join('+');
    const remainingSelectedCount = !hasSpecificSelection
        ? 0
        : Math.max(0, selectedLabels.length - 2);

    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const width = variant === 'full' ? 240 : 212;
            const viewportWidth = window.innerWidth;
            const left = Math.min(
                Math.max(12, rect.left + rect.width / 2 - width / 2),
                Math.max(12, viewportWidth - width - 12)
            );

            setDropdownPosition({
                top: rect.bottom + 8,
                left
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, variant]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleClickOutside = (event) => {
            const clickedTrigger = triggerRef.current?.contains(event.target);
            const clickedDropdown = dropdownRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedDropdown) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const toggleStagedType = (value) => {
        const nextSelection = normalizedSelectedTypes.includes(value)
            ? normalizedSelectedTypes.filter((type) => type !== value)
            : [...normalizedSelectedTypes, value];
        onApplySelection(nextSelection);
    };

    return (
        <>
            <div ref={triggerRef} className={cn("relative", variant === 'full' ? "w-full" : "hidden lg:block")}>
                {variant === 'full' ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen((previous) => !previous)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-left shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50"
                    >
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[12px] font-semibold text-slate-700">{displayLabel}</span>
                            {remainingSelectedCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-600">
                                    <span>{remainingSelectedCount}</span>
                                    <Plus size={9} />
                                </span>
                            )}
                        </div>
                        <ChevronDown size={16} className={cn("shrink-0 text-gray-400 transition-transform", isOpen && "rotate-180")} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setIsOpen((previous) => !previous);
                        }}
                        className={cn(
                            "relative w-10 h-10 flex items-center justify-center rounded-xl border transition-all",
                            isOpen ? "bg-gray-100 border-gray-200" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                        )}
                        title="Filter"
                    >
                        <Filter size={18} />
                    </button>
                )}
            </div>

            {isOpen && dropdownPosition && createPortal(
                <div
                    ref={dropdownRef}
                    className={cn(
                        "fixed z-[120] rounded-xl border border-gray-100 bg-white py-1 shadow-xl animate-in fade-in zoom-in-95 duration-200",
                        variant === 'full' ? "w-60" : "w-52"
                    )}
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                    <div className="max-h-60 overflow-y-auto py-0.5 no-scrollbar">
                        {CATEGORY_TYPE_OPTIONS.map((option) => {
                            const isStaged = normalizedSelectedTypes.includes(option.value);
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleStagedType(option.value)}
                                    className="group flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded-lg",
                                            isStaged ? option.iconClassName : "bg-slate-100 text-slate-400"
                                        )}>
                                            {Icon ? (
                                                <Icon size={15} strokeWidth={2} />
                                            ) : (
                                                <span className="text-[10px] font-black uppercase">{option.label.charAt(0)}</span>
                                            )}
                                        </div>
                                        <p className={cn("truncate text-[11px] font-medium", isStaged ? "text-gray-900" : "text-gray-600")}>
                                            {option.label}
                                        </p>
                                    </div>
                                    {isStaged && <Check size={14} className="text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
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
    selectedYearId,
    loading = false,
    hasFetchedOnce = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypeFilters, setSelectedTypeFilters] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const dropdownAreaRef = useRef(null);
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

    const exportTypeFilter = useMemo(() => (
        selectedTypeFilters.length === 0 || selectedTypeFilters.length === CATEGORY_TYPE_OPTIONS.length
            ? 'All Types'
            : selectedTypeFilters.join(',')
    ), [selectedTypeFilters]);

    // Filter categories and sub-categories
    const filteredCategories = useMemo(() => {
        return categories.filter(cat =>
            (selectedTypeFilters.length === 0 || selectedTypeFilters.includes(cat.type)) &&
            (
                cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cat.type.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [categories, searchTerm, selectedTypeFilters]);

    const totalPages = Math.ceil(filteredCategories.length / pageSize);
    const paginatedCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const startEntry = filteredCategories.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endEntry = Math.min(currentPage * pageSize, filteredCategories.length);
    const printCategories = filteredCategories;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    const downloadBinaryFile = (bytes, fileName, mimeType) => {
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const stringToBytes = (value) => {
        const bytes = new Uint8Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
            bytes[index] = value.charCodeAt(index) & 0xff;
        }
        return bytes;
    };

    const handleExportExcel = async () => {
        try {
            const response = await apiService.categories.export({
                branchId: 'all',
                financialYearId: selectedYearId,
                searchTerm,
                typeFilter: exportTypeFilter,
                format: 'xlsx'
            });

            const exportData = response?.data || response;

            if (typeof exportData === 'string' && exportData.startsWith('PK')) {
                downloadBinaryFile(
                    stringToBytes(exportData),
                    `category-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                return;
            }

            const base64Content = exportData?.fileContent;
            const fileName = exportData?.fileName || 'category-export.csv';
            const mimeType = exportData?.mimeType || 'text/csv;charset=utf-8';

            if (base64Content) {
                const binaryString = window.atob(base64Content);
                const fileBytes = new Uint8Array(binaryString.length);
                for (let index = 0; index < binaryString.length; index += 1) {
                    fileBytes[index] = binaryString.charCodeAt(index);
                }

                downloadBinaryFile(fileBytes, fileName, mimeType);
                return;
            }

            throw new Error('Missing export file content');
        } catch (error) {
            console.error('Failed to export categories to Excel:', error);
            alert('Failed to export categories');
        } finally {
            setActiveDropdown(null);
        }
    };

    const handleExportPDF = async () => {
        try {
            const response = await apiService.categories.export({
                financialYearId: selectedYearId,
                searchTerm,
                typeFilter: exportTypeFilter,
                format: 'pdf'
            }, {
                responseType: 'blob'
            });

            const htmlBlob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(htmlBlob);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            console.error('Failed to export categories to PDF:', error);
            alert('Failed to export categories');
        } finally {
            setActiveDropdown(null);
        }
    };

    const toggleDropdown = (dropdownName) => {
        setActiveDropdown((prev) => (prev === dropdownName ? null : dropdownName));
    };

    const handleDropdownButtonMouseDown = (event, dropdownName) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDropdown(dropdownName);
    };

    const closeDropdowns = () => setActiveDropdown(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown && dropdownAreaRef.current && !dropdownAreaRef.current.contains(event.target)) {
                closeDropdowns();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    return (
        <Card noPadding className="rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col bg-white category-laptop-registry-card w-full h-auto overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
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
                                <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[36%]">Category</th>
                                <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-[36%]">Sub-Category</th>
                                <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider text-center w-[10%]">Type</th>
                                <th className="border border-gray-300 px-3 py-2 text-[10px] font-bold text-gray-700 uppercase tracking-wider text-center w-[10%]">Status</th>
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
                                    <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-[11px] text-gray-500">
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
                <div className="relative z-50 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex flex-row items-center justify-between gap-4 flex-none print:hidden category-laptop-registry-toolbar">
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

                            <div ref={dropdownAreaRef} className="flex items-center space-x-3 justify-end">
                                <CategoryTypeFilter
                                    selectedTypes={selectedTypeFilters}
                                    onApplySelection={(nextSelection) => {
                                        setSelectedTypeFilters(nextSelection);
                                        setCurrentPage(1);
                                    }}
                                />

                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onMouseDown={(event) => handleDropdownButtonMouseDown(event, 'export')}
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
                                            <button type="button" onClick={handleExportExcel} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                                <FileSpreadsheet size={14} className="text-emerald-500" />
                                                <span>Export to Excel</span>
                                            </button>
                                            <button type="button" onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
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
                    <div className="pb-1">
                        <CategoryTypeFilter
                            variant="full"
                            selectedTypes={selectedTypeFilters}
                            onApplySelection={(nextSelection) => {
                                setSelectedTypeFilters(nextSelection);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    {showInitialLoader ? (
                        <div className="py-12 flex items-center justify-center">
                            <Loader2 size={26} className="text-gray-500 animate-spin" />
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
                                                <span className="text-[9px] font-bold text-gray-500">
                                                    {Number(cat.transactionCount || 0)} txn
                                                </span>
                                                <span className="text-[9px] font-semibold text-gray-400">
                                                    {formatDisplayDate(cat.lastUsedDate)}
                                                </span>
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
                                            <div key={sub.id} className="flex items-center justify-between group rounded-lg px-1.5 py-1 hover:bg-white/80 transition-colors">
                                                <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                                                    <CornerDownRight size={12} className="text-gray-400 shrink-0" />
                                                    <div className="flex flex-col truncate">
                                                        <span className="text-xs font-medium text-gray-700 truncate">{sub.name}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-semibold text-gray-400">{Number(sub.transactionCount || 0)} txn</span>
                                                            <span className="text-[9px] text-gray-400">{formatDisplayDate(sub.lastUsedDate)}</span>
                                                            <span className={cn(
                                                                "inline-flex items-center rounded-full px-1 py-[2px] text-[7px] font-bold uppercase tracking-[0.1em]",
                                                                (sub.status === 2 || sub.status === 'inactive')
                                                                    ? "bg-gray-100 text-gray-400"
                                                                    : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {(sub.status === 2 || sub.status === 'inactive') ? 'Inactive' : 'Active'}
                                                            </span>
                                                        </div>

                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEditSubCategory(sub); }}
                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-100 bg-white text-slate-300 transition-all hover:border-slate-200 hover:text-slate-500 hover:bg-slate-50"
                                                    >
                                                        <Edit size={10} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteSubCategory(sub.id)}
                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-100 bg-white text-slate-300 transition-all hover:border-rose-100 hover:text-rose-500 hover:bg-rose-50"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
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
                    className="relative hidden lg:block print:hidden overflow-x-auto overflow-y-auto no-scrollbar category-laptop-registry-scroll max-h-[min(62vh,640px)]"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    aria-busy={loading}
                >
                    <table className="w-full text-left border-collapse min-w-[700px] category-laptop-registry-table">
                        <colgroup>
                            <col className="category-laptop-col-id" />
                            <col className="category-laptop-col-name" />
                            <col className="category-laptop-col-type" />
                            <col className="category-laptop-col-status" />
                            <col className="category-laptop-col-actions" />
                        </colgroup>
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-50 border-y border-gray-200">
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider bg-gray-50 w-[10%]">Id</th>
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider bg-gray-50 w-[53%]">Name</th>
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center align-middle bg-gray-50 w-[15%]">Type</th>
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center bg-gray-50 w-[12%]">Status</th>
                                <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider text-center bg-gray-50 print:hidden w-[10%]">Actions</th>
                            </tr>
                        </thead>

                        {showInitialLoader ? (
                            <tbody>
                                <tr>
                                    <td colSpan={5} className="px-6 py-20">
                                        <div className="flex items-center justify-center">
                                            <Loader2 size={24} className="text-gray-500 animate-spin" />
                                        </div>
                                    </td>
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
                                            <td className="category-laptop-name-cell px-4 py-1.5">
                                                <div className="flex min-w-0 items-center space-x-4">
                                                    <div className="flex min-w-0 items-center space-x-2">
                                                        <CategoryNameTooltip
                                                            name={cat.name}
                                                            transactionCount={cat.transactionCount}
                                                            lastUsedLabel={formatDisplayDate(cat.lastUsedDate)}
                                                            textClassName="text-[13px] font-bold text-slate-700"
                                                        />
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

                                            <td className="category-laptop-actions-cell px-4 py-1.5 print:hidden">
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
                                                <td className="category-laptop-name-cell category-laptop-subcategory-name-cell px-4 py-0.5 pl-16">
                                                    <div className="flex min-w-0 items-center space-x-3">
                                                        <CornerDownRight size={14} className="text-gray-500" />
                                                        <CategoryNameTooltip
                                                            name={sub.name}
                                                            transactionCount={sub.transactionCount}
                                                            lastUsedLabel={formatDisplayDate(sub.lastUsedDate)}
                                                            textClassName="text-[12px] font-normal text-slate-600"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-0.5 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const currentStatus = sub.status === 1 || sub.status === 'active' ? 1 : 2;
                                                            const newStatus = currentStatus === 1 ? 2 : 1;
                                                            if (onToggleSubStatus) onToggleSubStatus(sub, newStatus);
                                                        }}
                                                        className={cn(
                                                            "inline-flex items-center rounded-full px-1.5 py-[2px] text-[7px] font-bold uppercase tracking-[0.12em] transition-all hover:opacity-80",
                                                            (sub.status === 2 || sub.status === 'inactive')
                                                                ? "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                        )}
                                                        title="Toggle sub-category status"
                                                    >
                                                        {(sub.status === 2 || sub.status === 'inactive') ? 'Inactive' : 'Active'}
                                                    </button>
                                                </td>

                                                <td className="category-laptop-actions-cell px-4 py-0.5 print:hidden">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (typeof onEditSubCategory === 'function') onEditSubCategory(sub);
                                                            }}
                                                            className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-100 bg-white text-slate-300 transition-all hover:border-slate-200 hover:text-slate-500 hover:bg-slate-50"
                                                        >
                                                            <Edit size={10} />
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteSubCategory(sub.id)}
                                                            className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-100 bg-white text-slate-300 transition-all hover:border-rose-100 hover:text-rose-500 hover:bg-rose-50"
                                                        >
                                                            <Trash2 size={10} />
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
                                    <td colSpan={5} className="px-6 py-20 text-center">
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

                <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 print:hidden">
                    <MobilePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>

                <div className="hidden lg:flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-100 flex-none bg-white relative z-20 gap-3 sm:gap-0 print:hidden category-laptop-registry-footer">
                    <div className="text-[10px] text-gray-500 font-medium text-center sm:text-left leading-tight">
                        Showing <span className="font-bold text-gray-700">{startEntry}</span> to <span className="font-bold text-gray-700">{endEntry}</span> of <span className="font-bold text-gray-700">{filteredCategories.length}</span> results
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-0.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors h-6"
                        >
                            Previous
                        </button>

                        <div className="flex items-center space-x-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold transition-all",
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
                            className="px-2.5 py-0.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors h-6"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default CategoryRegistry;
