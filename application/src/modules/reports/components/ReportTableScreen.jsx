import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Printer, Download, FileSpreadsheet, FileText, Wallet, ArrowUpRight, ArrowDownLeft, Activity } from 'lucide-react';
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
    onExportPdf,
    filters,
    renderExtraFilters
}) => {

    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [pagingPanel, setPagingPanel] = useState(null);

    const { formatCurrency, formatDate, preferences } = usePreferences();
    const { selectedOrg } = useOrganization();

    const formatProfitLossStatementDate = (value) => {
        if (!value) return '';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
        }).format(date).replace(/ /g, '-');
    };

    const formatProfitLossStatementAmount = (value, showZero = false) => {
        const amount = Number(value || 0);
        if (!showZero && amount === 0) return '';

        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const getProfitLossItemLabel = (item) => (
        String(item?.subCategory || item?.account || item?.name || '').trim()
    );

    const buildProfitLossStatementRows = (groups = [], balancingRow = null) => {
        const rows = [];

        groups
            .filter((group) => String(group?.category || '').trim())
            .forEach((group) => {
                rows.push({
                    kind: 'section',
                    label: String(group.category).trim(),
                    total: Number(group.total || 0)
                });

                (group.items || []).forEach((item) => {
                    const label = getProfitLossItemLabel(item);
                    if (!label) return;

                    rows.push({
                        kind: 'item',
                        label,
                        amount: Number(item.amount || 0)
                    });
                });
            });

        if (balancingRow?.amount > 0) {
            rows.push({
                kind: 'balance',
                label: balancingRow.label,
                total: Number(balancingRow.amount || 0)
            });
        }

        return rows;
    };

    if (!reportData) return null;
    if (reportData.type === 'profit-loss') {
        const d = reportData.data || {};
        const periodLabel = reportData.periodLabel || "Selected Period";
        const branchLabel = filters?.branch && filters.branch !== 'All Branches'
            ? String(filters.branch).trim()
            : '';
        const addressLines = String(selectedOrg?.address || '')
            .split(/\r?\n|,/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 3);
        const headerLines = addressLines.length > 0 ? addressLines : (branchLabel ? [branchLabel] : []);
        const dateRangeLabel = filters?.startDate && filters?.endDate
            ? `${formatProfitLossStatementDate(filters.startDate)} to ${formatProfitLossStatementDate(filters.endDate)}`
            : periodLabel;
        const leftRows = buildProfitLossStatementRows(
            d.expenses || [],
            d.netProfit > 0 ? { label: 'Nett Profit', amount: d.netProfit } : null
        );
        const rightRows = buildProfitLossStatementRows(
            d.incomes || [],
            d.netLoss > 0 ? { label: 'Nett Loss', amount: d.netLoss } : null
        );
        const hasProfitLossData = leftRows.length > 0 || rightRows.length > 0;
        const statementFont = { fontFamily: 'Arial, Helvetica, sans-serif' };
        const blankCell = '\u00A0';

        return (
            <div className="min-h-[600px] bg-white px-4 pb-8 pt-12 sm:px-8 sm:pb-10 sm:pt-16 w-full text-black">
                <div className="mx-auto max-w-[880px]">
                    <div className="text-center" style={statementFont}>
                        <h1 className="text-[16px] font-semibold uppercase leading-[1.12] text-black sm:text-[17px]">
                            {selectedOrg?.name || 'Organization Name'}
                        </h1>
                        {headerLines.map((line, index) => (
                            <div
                                key={`${line}-${index}`}
                                className={cn(
                                    "text-[10.5px] leading-[1.16] text-black sm:text-[11px]",
                                    index === headerLines.length - 1 && "inline-block border-b border-black pb-px"
                                )}
                            >
                                {line}
                            </div>
                        ))}
                        <h2 className="mt-[7px] text-[15.5px] font-semibold leading-[1.12] text-black sm:text-[16px]">
                            Profit &amp; Loss A/c
                        </h2>
                        <div className="mt-px text-[10.5px] leading-[1.12] text-black sm:text-[11px]">
                            {dateRangeLabel}
                        </div>
                    </div>
                    <div className="mt-5">
                        {hasProfitLossData ? (
                            <table className="w-full border-collapse table-fixed text-[10.5px] text-black sm:text-[11px]" style={statementFont}>
                                <colgroup>
                                    <col style={{ width: '26%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '13%' }} />
                                    <col style={{ width: '26%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '13%' }} />
                                </colgroup>
                                <thead>
                                    <tr className="border-y border-black/80">
                                        <th colSpan={3} className="border-r border-black/40 py-px text-center text-[11px] font-[550] tracking-[0.02em] text-black sm:text-[12px]">
                                            Expense
                                        </th>
                                        <th colSpan={3} className="py-px text-center text-[11px] font-[550] tracking-[0.02em] text-black sm:text-[12px]">
                                            Income
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="align-top">
                                    <tr>
                                        <td colSpan={3} className="p-0 border-r border-black/40 align-top">
                                            <table className="w-full border-collapse table-fixed">
                                                <colgroup>
                                                    <col style={{ width: '52%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '26%' }} />
                                                </colgroup>
                                                <tbody>
                                                    <tr className="h-[6px]">
                                                        <td></td><td></td><td></td>
                                                    </tr>
                                                    {leftRows.map((left, index) => {
                                                        const isLeftLastItem = left?.kind === 'item' && leftRows[index + 1]?.kind !== 'item';
                                                        return (
                                                            <tr key={`left-row-${index}`} className="align-top">
                                                                <td className={cn(
                                                                    'py-px pl-[8px] pr-3 leading-[1.15]',
                                                                    left?.kind === 'section' && 'pt-[10px]',
                                                                    left?.kind === 'balance' && 'pt-[10px]',
                                                                    left?.kind === 'section' && 'text-[11px] font-[550] sm:text-[11.5px]',
                                                                    left?.kind === 'balance' && 'text-[11px]',
                                                                    left?.kind === 'item' && 'pl-[12px] italic'
                                                                )}>
                                                                    {left?.label || blankCell}
                                                                </td>
                                                                <td className={cn(
                                                                    'py-px text-right tabular-nums leading-[1.15] pr-2',
                                                                    left?.kind === 'section' && 'pt-[10px]',
                                                                    left?.kind === 'balance' && 'pt-[10px]',
                                                                    left?.kind === 'item' && 'italic',
                                                                    !left && 'text-transparent'
                                                                )}>
                                                                    {left?.kind === 'item' ? (
                                                                        <span className={cn(
                                                                            "relative -left-[36px] inline-block min-w-[104px] text-right",
                                                                            isLeftLastItem && "border-b border-black/55 pb-[1px]"
                                                                        )}>
                                                                            {formatProfitLossStatementAmount(left.amount)}
                                                                        </span>
                                                                    ) : blankCell}
                                                                </td>
                                                                <td className={cn(
                                                                    'py-px pr-2 text-right tabular-nums leading-[1.15]',
                                                                    left?.kind === 'section' && 'pt-[10px]',
                                                                    left?.kind === 'balance' && 'pt-[10px]',
                                                                    left?.kind === 'section' && 'font-[550]',
                                                                    left?.kind === 'balance' && 'font-semibold',
                                                                    !left && 'text-transparent'
                                                                )}>
                                                                    {left?.kind === 'section' || left?.kind === 'balance'
                                                                        ? formatProfitLossStatementAmount(left.total)
                                                                        : blankCell}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="h-[12px]">
                                                        <td></td><td></td><td></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                        <td colSpan={3} className="p-0 align-top">
                                            <table className="w-full border-collapse table-fixed">
                                                <colgroup>
                                                    <col style={{ width: '52%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '26%' }} />
                                                </colgroup>
                                                <tbody>
                                                    <tr className="h-[6px]">
                                                        <td></td><td></td><td></td>
                                                    </tr>
                                                    {rightRows.map((right, index) => {
                                                        const isRightLastItem = right?.kind === 'item' && rightRows[index + 1]?.kind !== 'item';
                                                        return (
                                                            <tr key={`right-row-${index}`} className="align-top">
                                                                <td className={cn(
                                                                    'py-px pl-[8px] pr-3 leading-[1.15]',
                                                                    right?.kind === 'section' && 'pt-[10px]',
                                                                    right?.kind === 'balance' && 'pt-[10px]',
                                                                    right?.kind === 'section' && 'text-[11px] font-[550] sm:text-[11.5px]',
                                                                    right?.kind === 'balance' && 'text-[11px]',
                                                                    right?.kind === 'item' && 'pl-[12px] italic'
                                                                )}>
                                                                    {right?.label || blankCell}
                                                                </td>
                                                                <td className={cn(
                                                                    'py-px text-right tabular-nums leading-[1.15] pr-2',
                                                                    right?.kind === 'section' && 'pt-[10px]',
                                                                    right?.kind === 'balance' && 'pt-[10px]',
                                                                    right?.kind === 'item' && 'italic',
                                                                    !right && 'text-transparent'
                                                                )}>
                                                                    {right?.kind === 'item' ? (
                                                                        <span className={cn(
                                                                            "relative -left-[36px] inline-block min-w-[104px] text-right",
                                                                            isRightLastItem && "border-b border-black/55 pb-[1px]"
                                                                        )}>
                                                                            {formatProfitLossStatementAmount(right.amount)}
                                                                        </span>
                                                                    ) : blankCell}
                                                                </td>
                                                                <td className={cn(
                                                                    'py-px pr-2 text-right tabular-nums leading-[1.15]',
                                                                    right?.kind === 'section' && 'pt-[16px]',
                                                                    right?.kind === 'balance' && 'pt-[16px]',
                                                                    right?.kind === 'section' && 'font-[550]',
                                                                    right?.kind === 'balance' && 'font-semibold',
                                                                    right?.kind === 'balance' && right?.label === 'Nett Loss' && 'italic',
                                                                    !right && 'text-transparent'
                                                                )}>
                                                                    {right?.kind === 'section' || right?.kind === 'balance'
                                                                        ? formatProfitLossStatementAmount(right.total)
                                                                        : blankCell}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="h-[12px]">
                                                        <td></td><td></td><td></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="border-y border-black/80">
                                        <td colSpan={2} className="py-px pl-[8px] pr-3 text-left text-[11px] font-[550] tracking-[0.02em] text-black sm:text-[12px]">
                                            T o t a l
                                        </td>
                                        <td className="border-r border-black/40 py-px pr-2 text-right font-[550] tabular-nums text-black">
                                            {formatProfitLossStatementAmount(d.totalLeft, true)}
                                        </td>
                                        <td colSpan={2} className="py-px pl-[8px] text-left text-[11px] font-[550] tracking-[0.02em] text-black sm:text-[12px]">
                                            T o t a l
                                        </td>
                                        <td className="py-px pr-2 text-right font-[550] tabular-nums text-black">
                                            {formatProfitLossStatementAmount(d.totalRight, true)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="py-12 text-center text-[11px] font-medium text-gray-500 sm:text-[12px]">
                                No data found for this period
                            </div>
                        )}
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
                { field: 'date', headerName: 'Date', minWidth: 120, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: 200, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'account', headerName: 'Bank Name', valueGetter: (params) => typeof params.data.account === 'object' && params.data.account !== null ? params.data.account.name : (params.data.account || params.data.method), minWidth: 150, flex: 1, cellRenderer: (params) => <span className="text-[11px] lg:text-[12px] text-gray-500">{params.value}</span> },
                { field: 'type', headerName: 'Type', cellRenderer: (params) => <span className={cn("text-[11px] lg:text-[12px] font-medium", params.value === 'Income' ? "text-emerald-600" : params.value === 'Expense' ? "text-rose-600" : "text-gray-500")}>{params.value}</span>, width: typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1536 ? 85 : undefined, minWidth: 85 },
                { field: 'amount', headerName: 'Amount', type: 'rightAligned', valueGetter: params => params.data.amount || params.data.amountBase || params.data.amountLocal, getQuickFilterText: params => formatCurrency(parseFloat(params.value || 0), preferences.currency) + ' ' + (params.value || ''), cellRenderer: (params) => <span className={cn("font-bold tabular-nums text-[11px] lg:text-[12px]", params.data.type === 'Income' || params.data.type === 'Borrow' ? "text-emerald-600" : "text-gray-900")}>{formatCurrency(parseFloat(params.value || 0), preferences.currency)}</span>, minWidth: 120 }
            ];
        }

        if (reportData.type === 'ledger') {
            return [
                { field: 'date', headerName: 'Date', minWidth: 120, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] font-medium text-gray-600">{formatDate(params.value)}</span> },
                { field: 'description', headerName: 'Description', flex: 2, minWidth: 200, colSpan: (params) => params.data.isPinnedTitle ? 4 : 1, cellRenderer: (params) => params.data.isPinnedTitle ? <span className="text-[12px] font-bold text-gray-800">{params.data.title}</span> : <span className="text-[12px] font-medium text-gray-800">{params.value}</span> },
                { field: 'category', headerName: 'Category', valueGetter: (params) => typeof params.data.category === 'object' && params.data.category !== null ? params.data.category.name : params.data.category, minWidth: 150, flex: 1, cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-[12px] text-gray-500">{params.value}</span> },
                { field: 'debit', headerName: 'Debit', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-rose-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 120 },
                { field: 'credit', headerName: 'Credit', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => params.data.isPinnedTitle ? null : <span className="text-emerald-600 font-medium tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 120 },
                { field: 'balance', headerName: 'Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', pinnedRowCellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.data?.balance, preferences.currency)}</span>, cellRenderer: (params) => <span className="font-bold text-gray-800 tabular-nums text-[12px]">{formatCurrency(params.value, preferences.currency)}</span>, minWidth: 120 }
            ];
        }

        if (reportData.type === 'categories' || reportData.type === 'accounts' || reportData.type === 'parties') {
            const nameHeader = reportData.type === 'categories' ? 'Category' : (reportData.type === 'accounts' ? 'Account Name' : 'Party Name');
            return [
                { field: 'name', headerName: nameHeader, minWidth: 180, flex: 2, cellRenderer: (params) => <span className="font-bold text-gray-800 text-[12px]">{params.value}</span> },
                { field: 'openingBalance', headerName: 'Opening Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-gray-500 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 130 },
                { field: 'income', headerName: 'Income', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-emerald-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'expense', headerName: 'Expense', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-rose-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'investment', headerName: 'Investment', type: 'rightAligned', getQuickFilterText: params => params.value ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-medium text-blue-600 tabular-nums text-[12px]">{params.value ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 110 },
                { field: 'closingBalance', headerName: 'Closing Balance', type: 'rightAligned', getQuickFilterText: params => params.value !== undefined ? formatCurrency(params.value, preferences.currency) + ' ' + params.value : '', cellRenderer: (params) => <span className="font-bold text-gray-900 tabular-nums text-[12px]">{params.value !== undefined ? formatCurrency(params.value, preferences.currency) : '-'}</span>, minWidth: 130 },
                { field: 'count', headerName: 'Count', type: 'rightAligned', cellRenderer: (params) => <span className="font-medium text-gray-600 text-[12px]">{params.value}</span>, minWidth: 80 }
            ];
        }
        
        return [];
    }, [reportData, formatCurrency, formatDate, preferences.currency]);

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
        if (pagingPanel) return undefined;

        const interval = setInterval(() => {
            const panel = document.querySelector('.reports-grid-shell .ag-paging-panel');
            if (panel) {
                setPagingPanel(panel);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [pagingPanel]);

    const bottomSummaryItems = useMemo(() => {
        if (!reportData?.summary || reportData?.type === 'profit-loss') return [];

        const opening = reportData.openingBalance ?? reportData.summary.openingBalance ?? 0;
        const debit = (Number(reportData.summary.expense) || 0) + (Number(reportData.summary.investment) || 0);
        const credit = Number(reportData.summary.income) || 0;
        const closing = reportData.closingBalance ?? reportData.summary.closingBalance ?? 0;

        return [
            {
                label: 'Opening',
                value: formatCurrency(opening, preferences.currency),
                icon: Wallet,
                iconClassName: 'text-slate-600',
                iconWrapClassName: 'bg-slate-100 border border-slate-200/80'
            },
            {
                label: 'Debit',
                value: formatCurrency(debit, preferences.currency),
                icon: ArrowUpRight,
                iconClassName: 'text-rose-600',
                iconWrapClassName: 'bg-rose-50 border border-rose-100'
            },
            {
                label: 'Credit',
                value: formatCurrency(credit, preferences.currency),
                icon: ArrowDownLeft,
                iconClassName: 'text-emerald-600',
                iconWrapClassName: 'bg-emerald-50 border border-emerald-100'
            },
            {
                label: 'Closing',
                value: formatCurrency(closing, preferences.currency),
                icon: Activity,
                iconClassName: 'text-slate-700',
                iconWrapClassName: 'bg-slate-100 border border-slate-200/80'
            }
        ];
    }, [reportData, formatCurrency, preferences.currency]);

    return (
        <div className="flex flex-col min-h-full h-auto w-full">
            <div className="px-5 pt-3 pb-1.5 flex flex-row items-center justify-between gap-4 no-print relative z-20 w-full bg-transparent">
                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-2 w-full justify-end">
                            {renderExtraFilters}

                        </div>
            </div>

            {/* Universal AG Grid Table View */}
            <div className="reports-grid-shell w-full relative flex-1 min-h-[500px] flex flex-col px-5 pb-1 flex-1">
                <div className="flex-1 w-full relative">
                    <div className="absolute inset-0">
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
                        />
                    </div>
                </div>
                {pagingPanel && bottomSummaryItems.length > 0 && createPortal(
                    <div className="flex items-center gap-5 print:hidden mr-auto pl-4 h-full pointer-events-auto" style={{ order: -1 }}>
                        {bottomSummaryItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.label}
                                    className={cn(
                                        "flex items-center gap-2.5 min-w-fit",
                                        index > 0 && "pl-5 border-l border-gray-200"
                                    )}
                                >
                                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.iconWrapClassName)}>
                                        <Icon size={14} className={item.iconClassName} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold text-gray-500 mb-[2px] leading-none">
                                            {item.label}
                                        </div>
                                        <div className="text-[13px] font-bold text-gray-900 whitespace-nowrap leading-none tabular-nums">
                                            {item.value}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>,
                    pagingPanel
                )}
            </div>
        </div>
    );
};

export default ReportTableScreen;
