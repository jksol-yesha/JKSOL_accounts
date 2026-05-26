import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
    const [isCompactDesktopViewport, setIsCompactDesktopViewport] = useState(
        typeof window !== 'undefined' ? window.innerWidth >= 1024 && window.innerWidth < 1536 : false
    );
    const gridApiRef = useRef(null);

    const { formatCurrency, formatDate, preferences } = usePreferences();
    const { selectedOrg } = useOrganization();

    useEffect(() => {
        const handleResize = () => {
            setIsCompactDesktopViewport(window.innerWidth >= 1024 && window.innerWidth < 1536);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fitDesktopColumns = useCallback((api) => {
        if (!api || typeof window === 'undefined' || window.innerWidth < 1024) return;

        window.requestAnimationFrame(() => {
            try {
                api.sizeColumnsToFit();
            } catch (error) {
                // Ignore fit errors during transient grid lifecycle moments.
            }
        });
    }, []);

    if (!reportData) return null;
    if (reportData.type === 'profit-loss') {
        const d = reportData.data || {};

        const toggleRow = (key) => {
            setExpandedProfitRows(prev => ({ ...prev, [key]: !prev[key] }));
        };

        const periodLabel = reportData.periodLabel || "Selected Period";
        const reportPeriodText = filters?.startDate && filters?.endDate
            ? `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
            : periodLabel;
        const grandTotal = Math.max(Number(d.totalLeft) || 0, Number(d.totalRight) || 0);

        const renderMobileTableRows = (sectionKey, groups) => (
            <>
                {(groups || []).map((group, idx) => (
                    <React.Fragment key={`${sectionKey}-${idx}`}>
                        <tr
                            className={cn(
                                "border-b border-gray-100",
                                group.items?.length > 0 && "cursor-pointer hover:bg-gray-50"
                            )}
                            onClick={() => group.items?.length > 0 && toggleRow(`${sectionKey}-${group.category}`)}
                        >
                            <td className="px-3 py-2 align-top">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    {group.items?.length > 0 ? (
                                        <ChevronRight
                                            size={12}
                                            className={cn(
                                                "shrink-0 text-slate-400 transition-transform duration-200",
                                                expandedProfitRows[`${sectionKey}-${group.category}`] && "rotate-90"
                                            )}
                                        />
                                    ) : (
                                        <span className="block w-3 shrink-0" />
                                    )}
                                    <span className={cn("break-words text-[11px] font-bold text-slate-700", group.items?.length === 0 && "pl-1.5")}>
                                        {group.category}
                                    </span>
                                </div>
                            </td>
                            <td className="px-3 py-2 text-right align-top text-[11px] font-bold tabular-nums whitespace-nowrap text-slate-900">
                                {formatCurrency(group.total, preferences.currency)}
                            </td>
                        </tr>

                        {expandedProfitRows[`${sectionKey}-${group.category}`] && group.items?.map((item, itemIdx) => (
                            <tr key={`${sectionKey}-${idx}-${itemIdx}`} className="border-b border-gray-100 bg-slate-50/70">
                                <td className="px-3 py-2 pl-9 text-[10px] font-medium italic text-slate-500 break-words">
                                    {item.subCategory || item.account || item.name || 'Untitled'}
                                </td>
                                <td className="px-3 py-2 text-right text-[10px] font-bold tabular-nums whitespace-nowrap text-slate-700 align-top">
                                    {formatCurrency(item.amount, preferences.currency)}
                                </td>
                            </tr>
                        ))}
                    </React.Fragment>
                ))}
            </>
        );

        const renderMobileSection = (sectionKey, title, total, groups, resultLabel, resultValue, resultClass) => (
            <>
                <tr className="border-y border-gray-300 bg-slate-50">
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        {title}
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold tabular-nums whitespace-nowrap text-slate-900">
                        {formatCurrency(total, preferences.currency)}
                    </th>
                </tr>
                {renderMobileTableRows(sectionKey, groups)}
                {resultValue > 0 && (
                    <tr className={cn("border-b", resultClass)}>
                        <td className="px-3 py-2 text-[11px] font-bold italic text-slate-800">
                            {resultLabel}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] font-bold tabular-nums whitespace-nowrap text-slate-900">
                            {formatCurrency(resultValue, preferences.currency)}
                        </td>
                    </tr>
                )}
            </>
        );

        return (
            <div className="bg-white min-h-[600px] flex flex-col font-sans text-black relative">
                <div className="md:hidden flex flex-col">
                    <div className="bg-white flex items-center justify-between border-b border-gray-300 px-3 py-2">
                        <div className="min-w-0">
                            <div className="text-slate-800 text-[11px] font-bold">
                                Profit & Loss A/c
                            </div>
                            <div className="truncate text-[10px] font-bold text-slate-700">
                                {(selectedOrg?.name || "Organization Name") + (filters?.branch && filters.branch !== 'All Branches' ? `-${filters.branch}` : "")}
                            </div>
                        </div>
                        <button onClick={() => window.history.back()} className="text-slate-500 hover:text-slate-800 transition-colors p-1" title="Close Report">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="border-b border-gray-300 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[11px] font-bold italic text-slate-800">Particulars</div>
                                <div className="mt-0.5 text-[10px] font-bold text-gray-700">{reportPeriodText}</div>
                            </div>
                            <span className="text-right text-[11px] font-bold italic text-slate-800">Amount</span>
                        </div>
                    </div>

                    <div className="bg-white">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[62%]" />
                                <col className="w-[38%]" />
                            </colgroup>
                            <tbody>
                                {renderMobileSection(
                                    'expense',
                                    'Expenses',
                                    d.totalExpense,
                                    d.expenses,
                                    'Nett Profit',
                                    d.netProfit,
                                    'bg-emerald-50/20 border-emerald-100'
                                )}
                                {renderMobileSection(
                                    'income',
                                    'Income',
                                    d.totalIncome,
                                    d.incomes,
                                    'Nett Loss',
                                    d.netLoss,
                                    'bg-rose-50/20 border-rose-100'
                                )}

                                <tr className="border-t border-gray-300 bg-gray-50/60">
                                    <td className="px-3 py-2 text-[11px] font-bold text-slate-900">Total</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums whitespace-nowrap text-slate-900">
                                        {formatCurrency(grandTotal, preferences.currency)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="hidden md:block w-full overflow-x-auto">
                    <div className="min-w-[760px] flex flex-col">
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
                                        {reportPeriodText}
                                    </div>
                                </div>
                            </div>
                            <div className="p-2 flex justify-between items-start">
                                <span className="text-[11px] font-bold italic">Particulars</span>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-700 font-bold">
                                        {reportPeriodText}
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
                                            <div className="w-[85px] text-right tabular-nums whitespace-nowrap">{formatCurrency(d.totalExpense, preferences.currency)}</div>
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
                                                        <div className="w-[85px] text-right tabular-nums whitespace-nowrap font-bold">{formatCurrency(group.total, preferences.currency)}</div>
                                                    </div>
                                                    {expandedProfitRows[`expense-${group.category}`] && group.items?.map((item, iIdx) => (
                                                        <div key={iIdx} className="flex text-[11px] pl-5 py-0.5 font-medium text-slate-600 italic">
                                                            <span className="flex-1 truncate pr-2">{item.subCategory}</span>
                                                            <div className="w-[85px] text-right tabular-nums whitespace-nowrap">{formatCurrency(item.amount, preferences.currency)}</div>
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
                                            <span className="text-[11px] font-bold tabular-nums whitespace-nowrap">{formatCurrency(d.netProfit, preferences.currency)}</span>
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
                                            <div className="w-[85px] text-right tabular-nums whitespace-nowrap">{formatCurrency(d.totalIncome, preferences.currency)}</div>
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
                                                        <div className="w-[85px] text-right tabular-nums whitespace-nowrap font-bold">{formatCurrency(group.total, preferences.currency)}</div>
                                                    </div>
                                                    {expandedProfitRows[`income-${group.category}`] && group.items?.map((item, iIdx) => (
                                                        <div key={iIdx} className="flex text-[11px] pl-5 py-0.5 font-medium text-slate-600 italic">
                                                            <span className="flex-1 truncate pr-2">{item.subCategory}</span>
                                                            <div className="w-[85px] text-right tabular-nums whitespace-nowrap">{formatCurrency(item.amount, preferences.currency)}</div>
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
                                            <span className="text-[11px] font-bold tabular-nums whitespace-nowrap">{formatCurrency(d.netLoss, preferences.currency)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Grand Total Formatter row to match Print layout */}
                        <div className="grid grid-cols-2 border-t border-gray-300 bg-gray-50/50 font-bold tracking-tight mt-auto">
                            <div className="px-2 py-1.5 flex justify-between items-center text-slate-900 border-r border-gray-400">
                                <span className="text-[11px] font-bold text-left tracking-tight">Total</span>
                                <div className="text-[12px] tabular-nums whitespace-nowrap">{formatCurrency(d.totalLeft, preferences.currency)}</div>
                            </div>
                            <div className="px-2 py-1.5 flex justify-between items-center text-slate-900">
                                <span className="text-[11px] font-bold text-left tracking-tight">Total</span>
                                <div className="text-[12px] tabular-nums whitespace-nowrap">{formatCurrency(d.totalRight, preferences.currency)}</div>
                            </div>
                        </div>
                    </div>
                </div>
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
                { field: 'date', headerName: 'Date', minWidth: isCompactDesktopViewport ? 88 : 120, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: isCompactDesktopViewport ? 144 : 200, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: isCompactDesktopViewport ? 110 : 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'account', headerName: 'Bank Name', valueGetter: (params) => typeof params.data.account === 'object' && params.data.account !== null ? params.data.account.name : (params.data.account || params.data.method), minWidth: isCompactDesktopViewport ? 112 : 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'type', headerName: 'Type', cellRenderer: (params) => <span className={cn("text-[11px] lg:text-[12px] font-medium", params.value === 'Income' ? "text-emerald-600" : params.value === 'Expense' ? "text-rose-600" : "text-gray-500")}>{params.value}</span>, width: isCompactDesktopViewport ? 72 : (typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1536 ? 85 : undefined), minWidth: isCompactDesktopViewport ? 72 : 85 },
                { field: 'amount', headerName: 'Amount', type: 'rightAligned', valueGetter: params => params.data.amount || params.data.amountBase || params.data.amountLocal, getQuickFilterText: params => formatCurrency(parseFloat(params.value || 0), preferences.currency) + ' ' + (params.value || ''), cellRenderer: (params) => <span className={cn("font-bold tabular-nums text-[11px] lg:text-[12px]", params.data.type === 'Income' || params.data.type === 'Borrow' ? "text-emerald-600" : "text-gray-900")}>{formatCurrency(parseFloat(params.value || 0), preferences.currency)}</span>, minWidth: isCompactDesktopViewport ? 98 : 120 }
            ];
        }

        if (reportData.type === 'ledger') {
            return [
                { field: 'date', headerName: 'Date', minWidth: isCompactDesktopViewport ? 88 : 120, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: isCompactDesktopViewport ? 150 : 200, colSpan: (params) => params.data.isPinnedTitle ? 4 : 1, cellRenderer: (params) => params.data.isPinnedTitle ? <span className="text-[12px] font-bold text-gray-800">{params.data.title}</span> : <span className="text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: isCompactDesktopViewport ? 108 : 150, flex: 1, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] text-gray-500">{params.value}</span> },
                { field: 'debit', headerName: 'Debit', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-rose-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 96 : 120 },
                { field: 'credit', headerName: 'Credit', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-emerald-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 96 : 120 },
                { field: 'balance', headerName: 'Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', pinnedRowCellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.data?.balance, preferences.currency)}</span>, cellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.value, preferences.currency)}</span>, minWidth: isCompactDesktopViewport ? 100 : 120 }
            ];
        }

        if (reportData.type === 'categories' || reportData.type === 'accounts' || reportData.type === 'parties') {
            const nameHeader = reportData.type === 'categories' ? 'Category' : (reportData.type === 'accounts' ? 'Account Name' : 'Party Name');
            return [
                { field: 'name', headerName: nameHeader, minWidth: isCompactDesktopViewport ? 136 : 180, flex: 2, cellRenderer: (params) => <span className="font-bold text-gray-800 text-[12px]">{params.value}</span> },
                { field: 'openingBalance', headerName: 'Opening Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-gray-500 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 104 : 130 },
                { field: 'income', headerName: 'Income', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-emerald-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 90 : 110 },
                { field: 'expense', headerName: 'Expense', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-rose-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 90 : 110 },
                { field: 'investment', headerName: 'Investment', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-blue-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 90 : 110 },
                { field: 'closingBalance', headerName: 'Closing Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-bold text-gray-900 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: isCompactDesktopViewport ? 104 : 130 },
                { field: 'count', headerName: 'Count', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-gray-600 text-[12px]">{params.value}</span>, minWidth: isCompactDesktopViewport ? 64 : 80 }
            ];
        }
        
        return [];
    }, [reportData, formatCurrency, formatDate, preferences.currency, isCompactDesktopViewport]);

    const filteredTableData = useMemo(() => {
        if (!reportData?.tableData) return [];
        if (!searchTerm || !searchTerm.trim()) return reportData.tableData;

        const term = searchTerm.trim().toLowerCase();
        const isNumeric = !isNaN(term) && term !== "";
        const numericTerm = isNumeric ? Number(term) : null;

        const amountFields = ['amount', 'amountBase', 'amountLocal', 'debit', 'credit', 'balance', 'openingBalance', 'income', 'expense', 'investment', 'closingBalance', 'count'];

        return reportData.tableData.filter(row => {
            // 1. Check Amount Fields (Exact match only if numeric)
            for (const key of amountFields) {
                if (row[key] !== undefined && row[key] !== null) {
                    if (isNumeric) {
                        if (Number(row[key]) === numericTerm) return true;
                    } else {
                        // For string searches, check formatted currency and raw string
                        const rawStr = String(row[key]).toLowerCase();
                        const formatted = formatCurrency(row[key], preferences.currency).toLowerCase();
                        if (rawStr.includes(term) || formatted.includes(term)) return true;
                    }
                }
            }

            // 2. Check String Fields (Partial match always)
            if (row.date && formatDate(row.date).toLowerCase().includes(term)) return true;
            if (row.description && String(row.description).toLowerCase().includes(term)) return true;
            if (row.title && String(row.title).toLowerCase().includes(term)) return true;
            if (row.name && String(row.name).toLowerCase().includes(term)) return true;
            
            if (row.category) {
                const catName = typeof row.category === 'object' ? row.category.name : row.category;
                if (catName && String(catName).toLowerCase().includes(term)) return true;
            }
            
            if (row.account && String(row.account).toLowerCase().includes(term)) return true;
            if (row.type && String(row.type).toLowerCase().includes(term)) return true;

            return false;
        });
    }, [reportData?.tableData, searchTerm, formatCurrency, formatDate, preferences.currency]);

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

    useEffect(() => {
        if (!reportData || reportData.type === 'profit-loss' || !gridApiRef.current) return;
        fitDesktopColumns(gridApiRef.current);
    }, [reportData, filteredTableData.length, colDefs, fitDesktopColumns]);

    const renderMobileCards = () => {
        if (!filteredTableData || filteredTableData.length === 0) {
            return <div className="py-8 text-center text-sm font-medium text-gray-500">No data found matching your criteria</div>;
        }

        const renderLedgerPinned = (row, idx) => (
            <div key={`pinned-${idx}`} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center shadow-md">
                <span className="text-[12px] font-bold text-white">{row.title}</span>
                <span className="text-[13px] font-bold text-white tabular-nums">{formatCurrency(row.balance, preferences.currency)}</span>
            </div>
        );

        return (
            <div className="space-y-3 pb-6 px-1">
                {reportData.type === 'ledger' && pinnedTopRowData.map(renderLedgerPinned)}
                
                {filteredTableData.map((row, idx) => {
                    if (reportData.type === 'transactions') {
                        const typeVal = row.type;
                        const isIncome = typeVal === 'Income';
                        const isBorrow = typeVal === 'Borrow';
                        
                        return (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-2 relative">
                                <div className="flex justify-between items-start">
                                    <span className="text-[11px] font-medium text-gray-500">{formatDate(row.date)}</span>
                                    <span className={cn("text-[13px] font-bold tabular-nums", isIncome || isBorrow ? "text-emerald-600" : "text-gray-900")}>
                                        {formatCurrency(parseFloat(row.amount || row.amountBase || row.amountLocal || 0), preferences.currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-gray-50 gap-4">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Category</span>
                                        <span className="text-[11px] font-medium text-gray-700 truncate" title={typeof row.category === 'object' && row.category !== null ? row.category.name : row.category}>{typeof row.category === 'object' && row.category !== null ? row.category.name : row.category}</span>
                                    </div>
                                    <div className="flex flex-col text-right min-w-0 flex-1 items-end">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Account</span>
                                        <span className="text-[11px] font-medium text-gray-700 truncate max-w-full" title={typeof row.account === 'object' && row.account !== null ? row.account.name : (row.account || row.method)}>{typeof row.account === 'object' && row.account !== null ? row.account.name : (row.account || row.method)}</span>
                                    </div>
                                </div>
                                <div className="min-w-0 break-words whitespace-normal text-[13px] font-bold text-gray-800 leading-snug">
                                    {row.description}
                                </div>
                            </div>
                        );
                    }

                    if (reportData.type === 'ledger') {
                        if (row.isPinnedTitle) {
                            return renderLedgerPinned(row, idx);
                        }

                        return (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <span className="text-[11px] font-medium text-gray-500">{formatDate(row.date)}</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Balance</span>
                                        <span className="text-[12px] font-bold text-gray-900 tabular-nums">{formatCurrency(row.balance, preferences.currency)}</span>
                                    </div>
                                </div>
                                {row.category && (
                                    <div className="text-[11px] font-medium text-gray-500">
                                        {typeof row.category === 'object' && row.category !== null ? row.category.name : row.category}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-50">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Debit</span>
                                        <span className="text-[12px] font-medium text-rose-600 tabular-nums">{row.debit ? formatCurrency(row.debit, preferences.currency) : '-'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Credit</span>
                                        <span className="text-[12px] font-medium text-emerald-600 tabular-nums">{row.credit ? formatCurrency(row.credit, preferences.currency) : '-'}</span>
                                    </div>
                                </div>
                                <div className="min-w-0 break-words whitespace-normal text-[13px] font-bold text-gray-800 leading-snug">
                                    {row.description}
                                </div>
                            </div>
                        );
                    }

                    if (reportData.type === 'categories' || reportData.type === 'accounts' || reportData.type === 'parties') {
                        return (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-3">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="text-[14px] font-bold text-gray-900 truncate">{row.name}</span>
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md shrink-0">{row.count} txns</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Opening</span>
                                        <span className="text-[12px] font-medium text-gray-600 tabular-nums">{row.openingBalance !== undefined ? formatCurrency(row.openingBalance, preferences.currency) : '-'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Closing</span>
                                        <span className="text-[12px] font-bold text-gray-900 tabular-nums">{row.closingBalance !== undefined ? formatCurrency(row.closingBalance, preferences.currency) : '-'}</span>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-50">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Income</span>
                                        <span className="text-[11px] font-medium text-emerald-600 tabular-nums">{row.income ? formatCurrency(row.income, preferences.currency) : '-'}</span>
                                    </div>
                                    <div className="flex flex-col text-center">
                                        <span className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Expense</span>
                                        <span className="text-[11px] font-medium text-rose-600 tabular-nums">{row.expense ? formatCurrency(row.expense, preferences.currency) : '-'}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Investment</span>
                                        <span className="text-[11px] font-medium text-blue-600 tabular-nums">{row.investment ? formatCurrency(row.investment, preferences.currency) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return null;
                })}
                
                {reportData.type === 'ledger' && pinnedBottomRowData.map(renderLedgerPinned)}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-full h-auto w-full">
            <div className="px-5 pt-3 pb-1.5 flex flex-row items-center justify-between gap-4 no-print relative z-20 w-full bg-transparent">
                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-2 w-full justify-end">
                            {renderExtraFilters}

                            <div className="relative no-print hidden 2xl:block">
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
                        </div>

            {/* Universal AG Grid Table View */}
            <div className="w-full relative flex-1 min-h-[500px] flex flex-col px-4 sm:px-5 pb-1 flex-1">
                <div className="flex-1 w-full relative">
                    {/* Desktop Grid View */}
                    <div className="absolute inset-0 hidden lg:block">
                        <AgGridReact
                            theme={themeQuartz}
                            rowData={filteredTableData}
                            columnDefs={colDefs}
                            defaultColDef={defaultColDef}
                            rowSelection="multiple"
                            rowHeight={42}
                            headerHeight={44}
                            animateRows={true}
                            pagination={true}
                            paginationPageSize={50}
                            paginationPageSizeSelector={[25, 50, 100, 200]}
                            pinnedTopRowData={pinnedTopRowData}
                            pinnedBottomRowData={pinnedBottomRowData}
                            overlayNoRowsTemplate={
                                '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No data found matching your criteria</span>'
                            }
                            onGridReady={(params) => {
                                gridApiRef.current = params.api;
                                fitDesktopColumns(params.api);
                            }}
                            onGridSizeChanged={(params) => fitDesktopColumns(params.api)}
                            onFirstDataRendered={(params) => fitDesktopColumns(params.api)}
                        />
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="absolute inset-0 block lg:hidden overflow-y-auto">
                        {renderMobileCards()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportTableScreen;
