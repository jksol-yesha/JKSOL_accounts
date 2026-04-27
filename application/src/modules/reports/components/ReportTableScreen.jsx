import React, { useState, useMemo } from 'react';
import { Search, Printer, ChevronRight, X, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";
import Card from '../../../components/common/Card';
import { cn } from '../../../utils/cn';
import MobilePagination from '../../../components/common/MobilePagination';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';

ModuleRegistry.registerModules([AllCommunityModule]);

const ReportTableScreen = ({
    reportData,
    paginatedData,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    totalItems,
    onExportExcel,
    onExportPdf,
    filters,
    renderExtraFilters
}) => {
    const [showSearch, setShowSearch] = useState(false);
    const [expandedProfitRows, setExpandedProfitRows] = useState({});
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

    const { formatCurrency, formatDate, preferences } = usePreferences();

    if (!reportData) return null;
    if (reportData.type === 'profit-loss') {
        const d = reportData.data || {};
        const { formatCurrency, preferences } = usePreferences();

        const renderBucket = (groups, title, colorClass) => {
            if (!groups || groups.length === 0) return null;
            return (
                <div className="mb-6 last:mb-0">
                    <h5 className={cn("text-[11px] font-extrabold mb-2 uppercase tracking-wider", colorClass)}>{title}</h5>
                    <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-gray-100/50">
                            {groups.map((group, gIdx) => (
                                <React.Fragment key={`${title}-${gIdx}`}>
                                    <tr className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="py-2.5 text-[12px] font-bold text-slate-700">
                                            <div className="flex items-center gap-2">
                                                {group.items?.length > 0 && (
                                                    <button
                                                        onClick={() => toggleRow(`${title}-${group.category}`)}
                                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                                                    >
                                                        <ChevronRight
                                                            size={12}
                                                            className={cn("text-slate-400 transition-transform duration-200", expandedProfitRows[`${title}-${group.category}`] && "rotate-90")}
                                                        />
                                                    </button>
                                                )}
                                                <span className={group.items?.length === 0 ? "pl-6" : ""}>{group.category}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 text-[12px] font-extrabold text-right text-slate-900 tabular-nums">
                                            {formatCurrency(group.total, preferences.currency)}
                                        </td>
                                    </tr>
                                    {expandedProfitRows[`${title}-${group.category}`] && group.items?.map((item, iIdx) => (
                                        <tr key={`${title}-${gIdx}-${iIdx}`} className="bg-slate-50/30">
                                            <td className="py-2 pl-10 text-[11px] font-medium text-slate-500 italic">
                                                {item.account}
                                            </td>
                                            <td className="py-2 text-[11px] font-bold text-right text-slate-600 tabular-nums pr-2">
                                                {formatCurrency(item.amount, preferences.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        };

        const toggleRow = (key) => {
            setExpandedProfitRows(prev => ({ ...prev, [key]: !prev[key] }));
        };

        const { selectedOrg } = useOrganization();
        // Access period label from reportData top level
        const periodLabel = reportData.periodLabel || "Selected Period";

        return (
            <div className="bg-white min-h-[600px] flex flex-col font-sans text-black relative">


                {/* Main Header Bar */}
                <div className="bg-white flex items-center justify-between border-b border-gray-400 relative py-1.5 px-2">
                    <div className="text-slate-800 text-[11px] font-bold">
                        Profit & Loss A/c
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-slate-800 uppercase tracking-tight">
                        {(selectedOrg?.name || "Organization Name") + (filters?.branch && filters.branch !== 'All Branches' ? `-${filters.branch}` : "")}
                    </div>
                    <div className="pr-2 no-print ml-auto flex items-center justify-end gap-2">

                        <button onClick={() => window.history.back()} className="text-slate-500 hover:text-slate-800 transition-colors p-1" title="Close Report">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-2 border-b border-gray-300 bg-white">
                    <div className="border-r border-gray-300 p-2 flex justify-between items-start">
                        <span className="text-[11px] font-bold italic">Particulars</span>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-700 font-bold">
                                {filters?.startDate && filters?.endDate
                                    ? `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
                                    : periodLabel}
                            </div>
                        </div>
                    </div>
                    <div className="p-2 flex justify-between items-start">
                        <span className="text-[11px] font-bold italic">Particulars</span>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-700 font-bold">
                                {filters?.startDate && filters?.endDate
                                    ? `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
                                    : periodLabel}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-2 flex-1 min-h-[500px]">
                    {/* LEFT SIDE: EXPENSES */}
                    <div className="border-r border-gray-300 flex flex-col pt-2">
                        <div className="px-2 space-y-4">
                            {/* All Expenses */}
                            <div>
                                <h5 className="text-[11px] font-bold mb-1 flex border-b border-gray-100 pb-0.5">
                                    <span className="flex-1">Expenses</span>
                                    <div className="w-[85px] text-right"></div>
                                    <div className="w-[85px] text-right tabular-nums">{formatCurrency(d.totalExpense, preferences.currency)}</div>
                                </h5>
                                <div className="space-y-1 mt-1">
                                    {(d.expenses || []).map((group, idx) => (
                                        <div key={idx} className="pb-1">
                                            <div className="flex text-[11px] py-0.5 group cursor-pointer" onClick={() => toggleRow(`expense-${group.category}`)}>
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    {group.items?.length > 0 && (
                                                        <ChevronRight
                                                            size={10}
                                                            className={cn("text-slate-400 transition-transform duration-200 flex-shrink-0", expandedProfitRows[`expense-${group.category}`] && "rotate-90")}
                                                        />
                                                    )}
                                                    <span className={cn("font-bold", group.items?.length === 0 && "pl-3")}>{group.category}</span>
                                                </div>
                                                <div className="w-[85px] text-right pr-2"></div>
                                                <div className="w-[85px] text-right tabular-nums font-bold">{formatCurrency(group.total, preferences.currency)}</div>
                                            </div>
                                            {expandedProfitRows[`expense-${group.category}`] && group.items?.map((item, iIdx) => (
                                                <div key={iIdx} className="flex text-[11px] pl-5 py-0.5 font-medium text-slate-600 italic">
                                                    <span className="flex-1 truncate pr-2">{item.subCategory}</span>
                                                    <div className="w-[85px] text-right tabular-nums">{formatCurrency(item.amount, preferences.currency)}</div>
                                                    <div className="w-[85px]"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Net Profit (if loss is on right) */}
                            {d.netProfit > 0 && (
                                <div className="pt-2 flex justify-between items-center bg-emerald-50/20 px-1 py-1 mt-auto border-t border-emerald-100">
                                    <span className="text-[11px] font-bold italic">Nett Profit</span>
                                    <span className="text-[11px] font-bold tabular-nums">{formatCurrency(d.netProfit, preferences.currency)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: INCOME */}
                    <div className="flex flex-col pt-2">
                        <div className="px-2 space-y-4">
                            {/* All Incomes */}
                            <div>
                                <h5 className="text-[11px] font-bold mb-1 flex border-b border-gray-100 pb-0.5">
                                    <span className="flex-1">Income</span>
                                    <div className="w-[85px] text-right"></div>
                                    <div className="w-[85px] text-right tabular-nums">{formatCurrency(d.totalIncome, preferences.currency)}</div>
                                </h5>
                                <div className="space-y-1 mt-1">
                                    {(d.incomes || []).map((group, idx) => (
                                        <div key={idx} className="pb-1">
                                            <div className="flex text-[11px] py-0.5 group cursor-pointer" onClick={() => toggleRow(`income-${group.category}`)}>
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    {group.items?.length > 0 && (
                                                        <ChevronRight
                                                            size={10}
                                                            className={cn("text-slate-400 transition-transform duration-200 flex-shrink-0", expandedProfitRows[`income-${group.category}`] && "rotate-90")}
                                                        />
                                                    )}
                                                    <span className={cn("font-bold", group.items?.length === 0 && "pl-3")}>{group.category}</span>
                                                </div>
                                                <div className="w-[85px] text-right pr-2"></div>
                                                <div className="w-[85px] text-right tabular-nums font-bold">{formatCurrency(group.total, preferences.currency)}</div>
                                            </div>
                                            {expandedProfitRows[`income-${group.category}`] && group.items?.map((item, iIdx) => (
                                                <div key={iIdx} className="flex text-[11px] pl-5 py-0.5 font-medium text-slate-600 italic">
                                                    <span className="flex-1 truncate pr-2">{item.subCategory}</span>
                                                    <div className="w-[85px] text-right tabular-nums">{formatCurrency(item.amount, preferences.currency)}</div>
                                                    <div className="w-[85px]"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Nett Loss (if profit is on left) */}
                            {d.netLoss > 0 && (
                                <div className="pt-2 flex justify-between items-center bg-rose-50/20 px-1 py-1 mt-auto border-t border-rose-100">
                                    <span className="text-[11px] font-bold italic">Nett Loss</span>
                                    <span className="text-[11px] font-bold tabular-nums">{formatCurrency(d.netLoss, preferences.currency)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grand Total Formatter row to match Print layout */}
                <div className="grid grid-cols-2 border-t border-gray-300 bg-gray-50/50 font-bold tracking-tight mt-auto">
                    <div className="px-2 py-1.5 flex justify-between items-center text-slate-900 border-r border-gray-400">
                        <span className="text-[11px] font-bold text-left tracking-tight">Total</span>
                        <div className="text-[12px] tabular-nums">{formatCurrency(d.totalLeft, preferences.currency)}</div>
                    </div>
                    <div className="px-2 py-1.5 flex justify-between items-center text-slate-900">
                        <span className="text-[11px] font-bold text-left tracking-tight">Total</span>
                        <div className="text-[12px] tabular-nums">{formatCurrency(d.totalRight, preferences.currency)}</div>
                    </div>
                </div>

                {/* Print/Export Controls */}
                {/* Removed from bottom per request to match Detailed report top-toolbar style */}
            </div>
        );
    }

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: []
    }), []);

    const colDefs = useMemo(() => {
        if (!reportData) return [];

        if (reportData.type === 'transactions') {
            return [
                { field: 'date', headerName: 'Date', minWidth: 120, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: 200, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'account', headerName: 'Bank Name', valueGetter: (params) => typeof params.data.account === 'object' && params.data.account !== null ? params.data.account.name : (params.data.account || params.data.method), minWidth: 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'type', headerName: 'Type', cellRenderer: (params) => <span className={cn("text-[11px] lg:text-[12px] font-medium", params.value === 'Income' ? "text-emerald-600" : params.value === 'Expense' ? "text-rose-600" : "text-gray-500")}>{params.value}</span>, width: typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1536 ? 85 : undefined, minWidth: 85 },
                { field: 'amount', headerName: 'Amount', type: 'rightAligned', valueGetter: params => params.data.amount || params.data.amountBase || params.data.amountLocal, cellRenderer: (params) => <span className={cn("font-bold tabular-nums text-[11px] lg:text-[12px]", params.data.type === 'Income' || params.data.type === 'Borrow' ? "text-emerald-600" : "text-gray-900")}>{formatCurrency(parseFloat(params.value || 0), preferences.currency)}</span>, minWidth: 120 }
            ];
        }

        if (reportData.type === 'ledger') {
            return [
                { field: 'date', headerName: 'Date', minWidth: 120, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: 200, colSpan: (params) => params.data.isPinnedTitle ? 4 : 1, cellRenderer: (params) => params.data.isPinnedTitle ? <span className="text-[12px] font-bold text-gray-800">{params.data.title}</span> : <span className="text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: 150, flex: 1, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] text-gray-500">{params.value}</span> },
                { field: 'debit', headerName: 'Debit', type: 'rightAligned', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-rose-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 120 },
                { field: 'credit', headerName: 'Credit', type: 'rightAligned', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-emerald-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 120 },
                { field: 'balance', headerName: 'Balance', type: 'rightAligned', pinnedRowCellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.data?.balance, preferences.currency)}</span>, cellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.value, preferences.currency)}</span>, minWidth: 120 }
            ];
        }

        if (reportData.type === 'categories' || reportData.type === 'accounts' || reportData.type === 'parties') {
            const nameHeader = reportData.type === 'categories' ? 'Category' : (reportData.type === 'accounts' ? 'Account Name' : 'Party Name');
            return [
                { field: 'name', headerName: nameHeader, minWidth: 180, flex: 2, cellRenderer: (params) => <span className="font-bold text-gray-800 text-[12px]">{params.value}</span> },
                { field: 'openingBalance', headerName: 'Opening Balance', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-gray-500 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 130 },
                { field: 'income', headerName: 'Income', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-emerald-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'expense', headerName: 'Expense', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-rose-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'investment', headerName: 'Investment', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-blue-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'closingBalance', headerName: 'Closing Balance', type: 'rightAligned', cellRenderer: (params) => <span className="font-bold text-gray-900 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 130 },
                { field: 'count', headerName: 'Count', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-gray-600 text-[12px]">{params.value}</span>, minWidth: 80 }
            ];
        }
        
        return [];
    }, [reportData, formatCurrency, formatDate, preferences.currency]);

    const pinnedTopRowData = useMemo(() => {
        if (reportData?.type === 'ledger' && !searchTerm) {
            return [{ isPinnedTitle: true, title: 'Opening Balance', balance: reportData.openingBalance !== undefined ? reportData.openingBalance : reportData.summary?.openingBalance }];
        }
        return [];
    }, [reportData, searchTerm]);

    const pinnedBottomRowData = useMemo(() => {
        if (reportData?.type === 'ledger' && !searchTerm) {
            return [{ isPinnedTitle: true, title: 'Closing Balance', balance: reportData.closingBalance !== undefined ? reportData.closingBalance : reportData.summary?.closingBalance }];
        }
        return [];
    }, [reportData, searchTerm]);

    return (
        <div className="flex flex-col min-h-full h-auto w-full">
            <div className="px-5 pt-3 pb-1.5 flex flex-row items-center justify-between gap-4 no-print relative z-20 w-full bg-transparent">
                {showSearch ? (
                    // Mobile Expanded Search View
                    <div className="w-full flex items-center space-x-2 animate-in fade-in duration-200 xl:hidden">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-2 w-full justify-end">
                            {renderExtraFilters}
                            {/* Mobile Search Toggle */}
                            <button
                                onClick={() => setShowSearch(true)}
                                className="lg:hidden w-[32px] h-[32px] flex items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all active:scale-95 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                            >
                                <Search size={14} />
                            </button>

                            <div className="relative no-print lg:hidden 2xl:block">
                                <button
                                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                    className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-gray-200 bg-white text-gray-800 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-medium text-[12px]  shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                    title="Export Options"
                                >
                                    <Download size={14} className="text-gray-500 group-hover:text-[#4A8AF4] transition-colors" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>

                                {isExportDropdownOpen && (
                                    <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={() => {
                                                setIsExportDropdownOpen(false);
                                                onExportExcel();
                                            }}
                                            className="w-full text-left px-4 py-2 text-[12px]  font-medium text-slate-700 hover:bg-[#EEF0FC] hover:text-slate-800 transition-colors flex items-center gap-2 group"
                                        >
                                            <FileSpreadsheet size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                                            Export as Excel
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsExportDropdownOpen(false);
                                                onExportPdf();
                                            }}
                                            className="w-full text-left px-4 py-2 text-[12px]  font-medium text-slate-700 hover:bg-[#EEF0FC] hover:text-slate-800 transition-colors flex items-center gap-2 group"
                                        >
                                            <FileText size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                                            Export as PDF
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="relative hidden 2xl:block w-[280px] no-print group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4A8AF4] transition-colors" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full h-[32px] pl-9 pr-4 bg-white border border-gray-200 rounded-md text-[12px] outline-none focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:font-normal placeholder:text-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Universal AG Grid Table View */}
            <div className="w-full relative flex-1 min-h-[500px] flex flex-col px-5 pb-1 flex-1">
                <div className="flex-1 w-full relative">
                    <div className="absolute inset-0">
                        <AgGridReact
                            theme={themeQuartz}
                            rowData={reportData.tableData || []}
                            columnDefs={colDefs}
                            defaultColDef={defaultColDef}
                            rowSelection="multiple"
                            rowHeight={42}
                            headerHeight={44}
                            animateRows={true}
                            pagination={true}
                            paginationPageSize={50}
                            paginationPageSizeSelector={[25, 50, 100, 200]}
                            quickFilterText={searchTerm}
                            pinnedTopRowData={pinnedTopRowData}
                            pinnedBottomRowData={pinnedBottomRowData}
                            overlayNoRowsTemplate={
                                '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No data found matching your criteria</span>'
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportTableScreen;
