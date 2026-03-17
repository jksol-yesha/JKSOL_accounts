import React, { useState } from 'react';
import { Search, Printer, ChevronRight, X, Download } from 'lucide-react';
import Card from '../../../components/common/Card';
import { cn } from '../../../utils/cn';
import MobilePagination from '../../../components/common/MobilePagination';
import { usePreferences } from '../../../context/PreferenceContext';

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
    onPrint
}) => {
    const [showSearch, setShowSearch] = useState(false);
    const [expandedProfitRows, setExpandedProfitRows] = useState({});

    const { formatCurrency, formatDate, preferences } = usePreferences();

    const handleExportCSV = () => {
        if (!reportData) return;

        let headers = [];
        let rows = [];

        const escapeCsv = (str) => {
            if (str === null || str === undefined) return '""';
            let s = String(str).replace(/"/g, '""');
            return `"${s}"`;
        };

        if (reportData.type === 'profit-loss') {
            const income = Array.isArray(reportData.income) ? reportData.income : [];
            const expenses = Array.isArray(reportData.expenses) ? reportData.expenses : [];
            const term = (searchTerm || '').trim().toLowerCase();

            const filterGroups = (groups) => {
                if (!term) return groups;
                return groups
                    .map((g) => ({
                        ...g,
                        items: (g.items || []).filter((item) => {
                            const line = `${g.category} ${item.subCategory} ${item.account}`.toLowerCase();
                            return line.includes(term);
                        })
                    }))
                    .filter((g) => g.items.length > 0);
            };

            const filteredIncome = filterGroups(income);
            const filteredExpense = filterGroups(expenses);

            headers = ["Section", "Category", "Sub Category", "Account", "Amount"];
            rows.push(headers.join(","));

            filteredIncome.forEach(group => {
                if (group.items && group.items.length > 0) {
                    group.items.forEach(item => {
                        rows.push([escapeCsv("Income"), escapeCsv(group.category || 'Uncategorized'), escapeCsv(item.subCategory), escapeCsv(item.account), escapeCsv(item.amount || 0)].join(","));
                    });
                } else {
                    rows.push([escapeCsv("Income"), escapeCsv(group.category || 'Uncategorized'), '""', '""', escapeCsv(group.total || 0)].join(","));
                }
            });

            filteredExpense.forEach(group => {
                if (group.items && group.items.length > 0) {
                    group.items.forEach(item => {
                        rows.push([escapeCsv("Expense"), escapeCsv(group.category || 'Uncategorized'), escapeCsv(item.subCategory), escapeCsv(item.account), escapeCsv(item.amount || 0)].join(","));
                    });
                } else {
                    rows.push([escapeCsv("Expense"), escapeCsv(group.category || 'Uncategorized'), '""', '""', escapeCsv(group.total || 0)].join(","));
                }
            });

        } else {
            let dataToExport = reportData.tableData || [];
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                dataToExport = dataToExport.filter(item => {
                    if (reportData.type === 'transactions' || reportData.type === 'ledger') {
                        const categoryText = typeof item.category === 'object' && item.category !== null
                            ? (item.category.name || '')
                            : (item.category || '');
                        return (item.description || '').toLowerCase().includes(lower) ||
                            String(categoryText).toLowerCase().includes(lower) ||
                            (item.party || item.contact || '').toLowerCase().includes(lower);
                    } else if (reportData.type === 'categories' || reportData.type === 'accounts') {
                        return (item.name || '').toLowerCase().includes(lower);
                    }
                    return false;
                });
            }

            if (reportData.type === 'transactions') {
                headers = ["Date", "Description", "Category", "Bank Name", "Type", "Amount"];
                rows.push(headers.join(","));
                dataToExport.forEach(item => {
                    const cat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
                    const acc = typeof item.account === 'object' && item.account !== null ? item.account.name : (item.account || item.method);
                    rows.push([
                        escapeCsv(formatDate(item.date)),
                        escapeCsv(item.description),
                        escapeCsv(cat),
                        escapeCsv(acc),
                        escapeCsv(item.type),
                        escapeCsv(item.amount)
                    ].join(","));
                });
            } else if (reportData.type === 'ledger') {
                headers = ["Date", "Description", "Category", "Debit", "Credit", "Balance"];
                rows.push(headers.join(","));
                if (!searchTerm && reportData.openingBalance !== undefined) {
                    rows.push([ '""', escapeCsv('Opening Balance'), '""', '""', '""', escapeCsv(reportData.openingBalance) ].join(","));
                }
                dataToExport.forEach(item => {
                    const cat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
                    rows.push([
                        escapeCsv(formatDate(item.date)),
                        escapeCsv(item.description),
                        escapeCsv(cat),
                        escapeCsv(item.debit || ''),
                        escapeCsv(item.credit || ''),
                        escapeCsv(item.balance)
                    ].join(","));
                });
                if (!searchTerm && reportData.closingBalance !== undefined) {
                    rows.push([ '""', escapeCsv('Closing Balance'), '""', '""', '""', escapeCsv(reportData.closingBalance) ].join(","));
                }
            } else if (reportData.type === 'categories' || reportData.type === 'accounts') {
                headers = [reportData.type === 'categories' ? "Category" : "Account Name", "Opening Balance", "Income", "Expense", "Investment", "Closing Balance", "Count"];
                rows.push(headers.join(","));
                dataToExport.forEach(item => {
                    rows.push([
                        escapeCsv(item.name),
                        escapeCsv(item.openingBalance !== undefined ? item.openingBalance : ''),
                        escapeCsv(item.income !== undefined ? item.income : ''),
                        escapeCsv(item.expense !== undefined ? item.expense : ''),
                        escapeCsv(item.investment !== undefined ? item.investment : ''),
                        escapeCsv(item.closingBalance !== undefined ? item.closingBalance : ''),
                        escapeCsv(item.count !== undefined ? item.count : '')
                    ].join(","));
                });
            }
        }

        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Report_${reportData.type}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!reportData) return null;
    if (reportData.type === 'profit-loss') {
        const summary = reportData.summary || {};
        const income = Array.isArray(reportData.income) ? reportData.income : [];
        const expenses = Array.isArray(reportData.expenses) ? reportData.expenses : [];
        const term = (searchTerm || '').trim().toLowerCase();

        const filterGroups = (groups) => {
            if (!term) return groups;
            return groups
                .map((g) => ({
                    ...g,
                    items: (g.items || []).filter((item) => {
                        const line = `${g.category} ${item.subCategory} ${item.account}`.toLowerCase();
                        return line.includes(term);
                    })
                }))
                .filter((g) => g.items.length > 0);
        };

        const filteredIncome = filterGroups(income);
        const filteredExpense = filterGroups(expenses);
        const hasRows = filteredIncome.length > 0 || filteredExpense.length > 0;
        const toCategoryLines = (groups) => groups.map((group) => ({
            label: group.category || 'Uncategorized',
            amount: Number(group.total || 0)
        }));
        const incomeLines = toCategoryLines(filteredIncome);
        const expenseLines = toCategoryLines(filteredExpense);

        const toggleRow = (key) => {
            setExpandedProfitRows((prev) => ({
                ...prev,
                [key]: !prev[key]
            }));
        };

        return (
            <Card noPadding className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-styles">
                <div className="p-4 lg:p-6 border-b border-gray-50 flex flex-row items-center justify-between gap-4 no-print table-toolbar">
                    <h3 className="text-sm font-bold text-gray-800">Profit &amp; Loss Statement</h3>
                    <div className="flex items-center space-x-3 w-auto justify-end">
                        <button onClick={handleExportCSV} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Export to CSV">
                            <Download size={18} />
                        </button>
                        <button onClick={onPrint} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Print / Download PDF">
                            <Printer size={18} />
                        </button>
                        <div className="relative w-64 hidden lg:block no-print">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-sm outline-none" />
                        </div>
                    </div>
                </div>

                <div className="p-4 lg:p-6 overflow-auto">
                    {!hasRows && <div className="py-12 text-center text-gray-400 text-sm font-medium">No data found matching your criteria</div>}

                    {hasRows && (
                        <div className="space-y-6 min-w-[620px]">
                            <div>
                                <h4 className="text-[13px] font-extrabold text-emerald-700 mb-2">INCOME</h4>
                                <table className="w-full text-left border border-gray-200">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase">Category</th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {incomeLines.map((line, idx) => (
                                            <React.Fragment key={`income-line-${idx}`}>
                                            <tr>
                                                <td className="px-4 py-2 text-[12px] text-gray-800 font-medium">
                                                    {(() => {
                                                        const group = filteredIncome.find((g) => (g.category || 'Uncategorized') === line.label);
                                                        const rowKey = `income:${line.label}`;
                                                        const hasChildren = !!(group?.items?.length);
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                {hasChildren && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleRow(rowKey)}
                                                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
                                                                        title="Show associated accounts"
                                                                    >
                                                                        <ChevronRight
                                                                            size={14}
                                                                            className={`transition-transform ${expandedProfitRows[rowKey] ? 'rotate-90' : ''}`}
                                                                        />
                                                                    </button>
                                                                )}
                                                                <span>{line.label}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-2 text-[12px] text-right font-bold text-gray-900">{formatCurrency(line.amount, preferences.currency)}</td>
                                            </tr>
                                            {(() => {
                                                const group = filteredIncome.find((g) => (g.category || 'Uncategorized') === line.label);
                                                const rowKey = `income:${line.label}`;
                                                if (!group?.items?.length || !expandedProfitRows[rowKey]) return null;
                                                return group.items.map((item, childIdx) => (
                                                    <tr key={`income-line-${idx}-child-${childIdx}`} className="bg-gray-50/70">
                                                        <td className="px-4 py-2 text-[12px] text-gray-600 pl-10">- {item.account || item.subCategory || 'Associated Account'}</td>
                                                        <td className="px-4 py-2 text-[12px] text-right font-semibold text-gray-700">{formatCurrency(Number(item.amount || 0), preferences.currency)}</td>
                                                    </tr>
                                                ));
                                            })()}
                                            </React.Fragment>
                                        ))}
                                        <tr className="bg-emerald-50/50">
                                            <td className="px-4 py-2 text-[12px] font-extrabold text-emerald-700">Total Income</td>
                                            <td className="px-4 py-2 text-[12px] text-right font-extrabold text-emerald-700">{formatCurrency(Number(summary.totalIncome ?? summary.income ?? 0), preferences.currency)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <h4 className="text-[13px] font-extrabold text-rose-700 mb-2">EXPENSE</h4>
                                <table className="w-full text-left border border-gray-200">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase">Category</th>
                                            <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {expenseLines.map((line, idx) => (
                                            <React.Fragment key={`expense-line-${idx}`}>
                                            <tr>
                                                <td className="px-4 py-2 text-[12px] text-gray-800 font-medium">
                                                    {(() => {
                                                        const group = filteredExpense.find((g) => (g.category || 'Uncategorized') === line.label);
                                                        const rowKey = `expense:${line.label}`;
                                                        const hasChildren = !!(group?.items?.length);
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                {hasChildren && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleRow(rowKey)}
                                                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
                                                                        title="Show associated accounts"
                                                                    >
                                                                        <ChevronRight
                                                                            size={14}
                                                                            className={`transition-transform ${expandedProfitRows[rowKey] ? 'rotate-90' : ''}`}
                                                                        />
                                                                    </button>
                                                                )}
                                                                <span>{line.label}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-2 text-[12px] text-right font-bold text-gray-900">{formatCurrency(line.amount, preferences.currency)}</td>
                                            </tr>
                                            {(() => {
                                                const group = filteredExpense.find((g) => (g.category || 'Uncategorized') === line.label);
                                                const rowKey = `expense:${line.label}`;
                                                if (!group?.items?.length || !expandedProfitRows[rowKey]) return null;
                                                return group.items.map((item, childIdx) => (
                                                    <tr key={`expense-line-${idx}-child-${childIdx}`} className="bg-gray-50/70">
                                                        <td className="px-4 py-2 text-[12px] text-gray-600 pl-10">- {item.account || item.subCategory || 'Associated Account'}</td>
                                                        <td className="px-4 py-2 text-[12px] text-right font-semibold text-gray-700">{formatCurrency(Number(item.amount || 0), preferences.currency)}</td>
                                                    </tr>
                                                ));
                                            })()}
                                            </React.Fragment>
                                        ))}
                                        <tr className="bg-rose-50/50">
                                            <td className="px-4 py-2 text-[12px] font-extrabold text-rose-700">Total Expense</td>
                                            <td className="px-4 py-2 text-[12px] text-right font-extrabold text-rose-700">{formatCurrency(Number(summary.totalExpense ?? summary.expense ?? 0), preferences.currency)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="border-y border-gray-300 py-3 flex items-center justify-between">
                                <span className="text-[14px] font-extrabold text-gray-900 uppercase">Net Profit</span>
                                <span className="text-[16px] font-extrabold text-gray-900">{formatCurrency(Number(summary.netProfit ?? summary.net ?? 0), preferences.currency)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
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

                            <button onClick={handleExportCSV} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Export to CSV">
                                <Download size={18} />
                            </button>
                            <button onClick={onPrint} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 no-print" title="Print / Download PDF">
                                <Printer size={18} />
                            </button>
                            <div className="relative w-64 hidden xl:block no-print"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-sm outline-none" /></div>
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
                                <tr key={item.id || index} className="hover:bg-gray-50/50 transition-colors">
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
