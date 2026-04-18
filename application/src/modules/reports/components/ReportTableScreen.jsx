import React, { useState } from 'react';
import { Search, Printer, ChevronRight, X, Download } from 'lucide-react';
import Card from '../../../components/common/Card';
import { cn } from '../../../utils/cn';
import MobilePagination from '../../../components/common/MobilePagination';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';

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
    filters
}) => {
    const [showSearch, setShowSearch] = useState(false);
    const [expandedProfitRows, setExpandedProfitRows] = useState({});

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
                {/* Thin top blue line removed per request */}

                {/* Main Blue Header Bar */}
                <div className="bg-sky-100 flex items-center justify-between border-b border-gray-300 relative py-1.5 px-2">
                    <div className="text-slate-800 text-[11px] font-bold">
                        Profit & Loss
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 text-[12px] font-bold text-slate-800 uppercase tracking-tight">
                        {(selectedOrg?.name || "Organization Name") + (filters?.branch && filters.branch !== 'All Branches' ? `-${filters.branch}` : "")}
                    </div>
                    <div className="pr-2 no-print ml-auto">
                        {/* the cross button was removed from here per request */}
                    </div>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-2 border-b border-gray-300 bg-white">
                    <div className="border-r border-gray-300 p-2 flex justify-between items-start">
                        <span className="text-[12px] font-bold italic">Particulars</span>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-700 font-bold">
                                {filters?.startDate && filters?.endDate 
                                    ? `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
                                    : periodLabel}
                            </div>
                        </div>
                    </div>
                    <div className="p-2 flex justify-between items-start">
                        <span className="text-[12px] font-bold italic">Particulars</span>
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
                                <h5 className="text-[11px] font-bold mb-1 flex justify-between border-b border-gray-100 pb-0.5">
                                    <span>Expenses</span>
                                    <span className="tabular-nums">{formatCurrency(d.totalExpense, preferences.currency)}</span>
                                </h5>
                                <div className="space-y-1">
                                    {(d.expenses || []).map((group, idx) => (
                                        <div key={idx} className="border-b border-gray-50 last:border-0 pb-1">
                                            <div className="flex justify-between text-[11px] py-0.5 group cursor-pointer" onClick={() => toggleRow(`expense-${group.category}`)}>
                                                <div className="flex items-center gap-1">
                                                    {group.items?.length > 0 && (
                                                        <ChevronRight
                                                            size={10}
                                                            className={cn("text-slate-400 transition-transform duration-200", expandedProfitRows[`expense-${group.category}`] && "rotate-90")}
                                                        />
                                                    )}
                                                    <span className={cn("font-bold italic", group.items?.length === 0 && "pl-3")}>{group.category}</span>
                                                </div>
                                                <span className="tabular-nums font-bold">{formatCurrency(group.total, preferences.currency)}</span>
                                            </div>
                                            {expandedProfitRows[`expense-${group.category}`] && group.items?.map((item, iIdx) => (
                                                <div key={iIdx} className="flex justify-between text-[11px] pl-5 py-0.5 font-medium text-slate-500 italic">
                                                    <span>{item.subCategory}</span>
                                                    <span className="tabular-nums font-semibold">{formatCurrency(item.amount, preferences.currency)}</span>
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
                                <h5 className="text-[11px] font-bold mb-1 flex justify-between border-b border-gray-100 pb-0.5">
                                    <span>Income</span>
                                    <span className="tabular-nums">{formatCurrency(d.totalIncome, preferences.currency)}</span>
                                </h5>
                                <div className="space-y-1">
                                    {(d.incomes || []).map((group, idx) => (
                                        <div key={idx} className="border-b border-gray-50 last:border-0 pb-1">
                                            <div className="flex justify-between text-[11px] py-0.5 group cursor-pointer" onClick={() => toggleRow(`income-${group.category}`)}>
                                                <div className="flex items-center gap-1">
                                                    {group.items?.length > 0 && (
                                                        <ChevronRight
                                                            size={10}
                                                            className={cn("text-slate-400 transition-transform duration-200", expandedProfitRows[`income-${group.category}`] && "rotate-90")}
                                                        />
                                                    )}
                                                    <span className={cn("font-bold italic", group.items?.length === 0 && "pl-3")}>{group.category}</span>
                                                </div>
                                                <span className="tabular-nums font-bold">{formatCurrency(group.total, preferences.currency)}</span>
                                            </div>
                                            {expandedProfitRows[`income-${group.category}`] && group.items?.map((item, iIdx) => (
                                                <div key={iIdx} className="flex justify-between text-[11px] pl-5 py-0.5 font-medium text-slate-500 italic">
                                                    <span>{item.subCategory}</span>
                                                    <span className="tabular-nums font-semibold">{formatCurrency(item.amount, preferences.currency)}</span>
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

                {/* Bottom Total Bar Removed */}
                <div className="pb-4" />

                {/* Print/Export Controls (Moved to bottom or top-right no-print) */}
                <div className="absolute top-1 right-8 flex gap-2 no-print">
                    {/* Excel download removed for P/L per request */}
                    <button onClick={onExportPdf} className="p-1 hover:bg-white/50 rounded" title="PDF"><Printer size={14} /></button>
                </div>
            </div>
        );
    }

    return (
        <Card noPadding className="reports-tablet-table-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-styles">
            <div className="reports-tablet-table-toolbar p-4 xl:p-6 border-b border-gray-50 flex flex-row items-center justify-between gap-4 no-print table-toolbar">
                {showSearch ? (
                    // Mobile Expanded Search View
                    <div className="w-full flex items-center space-x-2 animate-in fade-in duration-200 xl:hidden">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
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
                        <h3 className="text-sm font-bold text-gray-800">
                            {reportData.type === 'transactions' && reportData.summary ? 'Summary Table' : `${reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1)} Report`}
                        </h3>
                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-3 w-auto justify-end">
                            {/* Mobile Search Toggle */}
                            <button
                                onClick={() => setShowSearch(true)}
                                className="xl:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-700 hover:bg-gray-100 transition-all active:scale-95 bg-white shadow-sm"
                            >
                                <Search size={18} />
                            </button>

                            <button onClick={onExportExcel} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Export to Excel">
                                <Download size={18} />
                            </button>
                            <button onClick={onExportPdf} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Download as PDF">
                                <Printer size={18} />
                            </button>
                        <div className="relative w-64 hidden xl:block no-print group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                                placeholder="Search..." 
                                className="w-full pl-9 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-sm outline-none hover:bg-[#F0F9FF] hover:border-blue-200 focus:bg-[#F0F9FF] focus:border-blue-400 transition-all placeholder:transition-colors group-hover:placeholder:text-blue-400" 
                            />
                        </div>
                        </div>
                    </>
                )}
            </div>

            {/* Universal Scrollable Table View */}
            <div className="reports-tablet-table-wrap block overflow-x-auto overflow-y-auto max-h-[600px] desktop-table-view">
                <div className="reports-tablet-table-inner min-w-[900px]"> {/* Ensure min-width for table */}
                    <table className="reports-tablet-table w-full text-left">
                        <thead className="bg-gray-50/50 border-y border-gray-200">
                            <tr>
                                {(reportData.type === 'transactions' || reportData.type === 'ledger') && (
                                    <>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                        {reportData.type === 'transactions' && (<><th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Bank Name</th><th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Type</th><th className="w-[12%] px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Amount</th></>)}
                                        {reportData.type === 'ledger' && (<><th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-rose-600">Debit</th><th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-emerald-600">Credit</th><th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Balance</th></>)}
                                    </>
                                )}
                                {(reportData.type === 'categories') && (
                                    <>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Opening Balance</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-emerald-600">Income</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-rose-600">Expense</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-blue-600">Investment</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-gray-900">Closing Balance</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Count</th>
                                    </>
                                )}
                                {(reportData.type === 'accounts') && (
                                    <>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Account Name</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Opening Balance</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-emerald-600">Income</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-rose-600">Expense</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-blue-600">Investment</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right text-gray-900">Closing Balance</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Count</th>
                                    </>
                                )}
                                {(reportData.type === 'profit-loss') && (
                                    <>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Line Item</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Count</th>
                                        <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reportData.type === 'ledger' && (currentPage === 1 && !searchTerm) && (<tr className="bg-gray-50/50"><td colSpan="5" className="px-6 py-3 text-[13px] font-bold text-gray-800">Opening Balance</td><td className="px-6 py-3 text-[13px] font-bold text-right tabular-nums">{formatCurrency(reportData.openingBalance, preferences.currency)}</td></tr>)}
                            {paginatedData.length > 0 ? paginatedData.map((item, index) => (
                                <tr key={item.id || index} className="hover:bg-[#F0F9FF] transition-colors">
                                    {(reportData.type === 'transactions' || reportData.type === 'ledger') && (
                                        <>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-gray-800">{item.description}</td>
                                            <td className="px-4 py-1.5 text-[12px] text-gray-500">{typeof item.category === 'object' && item.category !== null ? item.category.name : item.category}</td>
                                            {reportData.type === 'transactions' && (<><td className="px-4 py-1.5 text-[12px] text-gray-500">{typeof item.account === 'object' && item.account !== null ? item.account.name : (item.account || item.method)}</td><td className="px-4 py-1.5"><span className={cn("text-[11px] font-bold px-2 py-1 rounded-full border", item.type === 'Income' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : item.type === 'Expense' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-blue-50 text-blue-600 border-blue-100")}>{item.type}</span></td><td className={cn("px-4 py-1.5 text-[12px] font-bold text-center tabular-nums", item.type === 'Income' || item.type === 'Borrow' ? "text-emerald-600" : "text-gray-900")}>{formatCurrency(parseFloat(item.amount || 0), preferences.currency)}</td></>)}
                                            {reportData.type === 'ledger' && (<><td className="px-4 py-1.5 text-[12px] text-right text-rose-600 font-medium">{item.debit ? formatCurrency(item.debit, preferences.currency) : '-'}</td><td className="px-4 py-1.5 text-[12px] text-right text-emerald-600 font-medium">{item.credit ? formatCurrency(item.credit, preferences.currency) : '-'}</td><td className="px-4 py-1.5 text-[12px] text-right font-bold text-gray-800 tabular-nums">{formatCurrency(item.balance, preferences.currency)}</td></>)}
                                        </>
                                    )}
                                    {(reportData.type === 'categories') && (
                                        <>
                                            <td className="px-4 py-1.5 text-[12px] font-bold text-gray-800">{item.name}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-gray-500">{item.openingBalance !== undefined ? formatCurrency(item.openingBalance, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-emerald-600">{item.income ? formatCurrency(item.income, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-rose-600">{item.expense ? formatCurrency(item.expense, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-blue-600">{item.investment ? formatCurrency(item.investment, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-bold text-right text-gray-900">{item.closingBalance !== undefined ? formatCurrency(item.closingBalance, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-gray-600">{item.count}</td>
                                        </>
                                    )}
                                    {(reportData.type === 'accounts') && (
                                        <>
                                            <td className="px-4 py-1.5 text-[12px] font-bold text-gray-800">{item.name}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-gray-500">{item.openingBalance !== undefined ? formatCurrency(item.openingBalance, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-emerald-600">{item.income ? formatCurrency(item.income, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-rose-600">{item.expense ? formatCurrency(item.expense, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-blue-600">{item.investment ? formatCurrency(item.investment, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-bold text-right text-gray-900">{item.closingBalance !== undefined ? formatCurrency(item.closingBalance, preferences.currency) : '-'}</td>
                                            <td className="px-4 py-1.5 text-[12px] font-medium text-right text-gray-600">{item.count}</td>
                                        </>
                                    )}
                                    {(reportData.type === 'profit-loss') && (
                                        <>
                                            <td className="px-4 py-1.5 text-[12px] font-bold text-gray-800">{item.name}</td>
                                            <td className="px-4 py-1.5 text-[12px]">
                                                <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full border", item.type === 'Income' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-[12px] text-right text-gray-600">{item.count || 0}</td>
                                            <td className="px-4 py-1.5 text-[12px] text-right font-bold text-gray-900 tabular-nums">{formatCurrency(Number(item.amount || 0), preferences.currency)}</td>
                                        </>
                                    )}
                                </tr>
                            )) : (<tr><td colSpan="12" className="px-6 py-12 text-center text-gray-400 font-medium text-sm">No data found matching your criteria</td></tr>)}
                            {reportData.type === 'ledger' && (currentPage === totalPages && !searchTerm) && (<tr className="bg-gray-100 border-t border-gray-200"><td colSpan="5" className="px-6 py-3 text-[13px] font-bold text-gray-800">Closing Balance</td><td className="px-6 py-3 text-[13px] font-bold text-right tabular-nums">{formatCurrency(reportData.closingBalance, preferences.currency)}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Pagination (Custom Design) */}
            <div className="sm:hidden border-t border-gray-100 p-2">
                <MobilePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Desktop Pagination (Original Layout) */}
            <div className="hidden sm:flex items-center justify-between px-4 py-1.5 border-t border-gray-100 flex-none bg-white relative z-20 no-print pagination-footer">
                <div className="text-[11px] text-gray-500 font-medium">Showing <span className="font-bold text-gray-700">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="font-bold text-gray-700">{totalItems}</span> results</div>
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

export default ReportTableScreen;
