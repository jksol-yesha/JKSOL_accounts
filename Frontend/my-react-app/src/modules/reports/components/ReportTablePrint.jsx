import React from 'react';
import { cn } from '../../../utils/cn';
import { usePreferences } from '../../../context/PreferenceContext';

const ReportTablePrint = ({ reportData, filters }) => {
    const { formatCurrency, formatDate, preferences } = usePreferences();
    if (!reportData) return null;

    const { summary, tableData, type } = reportData;
    const isSummary = filters.reportType === 'Summary';
    const isProfitLoss = filters.reportType === 'P/L' || filters.reportType === 'Profit/Loss' || filters.reportType === 'Profit & Loss';

    return (
        <div className={`hidden print:block w-full bg-white text-black ${isProfitLoss ? 'p-12 max-w-[297mm]' : 'p-12 max-w-[297mm]'} mx-auto font-sans`}>
            {/* ================= HEADER ================= */}
            <div className={isProfitLoss ? 'mb-4' : 'mb-4'}>
                <h1 className="text-center text-3xl font-bold text-black uppercase tracking-wide">
                    FINANCIAL REPORT
                </h1>
            </div>

            {/* Divider */}
            <div className={`w-full h-[1px] bg-black ${isProfitLoss ? 'mb-8' : 'mb-8'}`}></div>

            {/* ================= META INFO ================= */}
            <div className={`flex justify-start text-xs ${isProfitLoss ? 'mb-10' : 'mb-10'}`}>
                <div className="text-left space-y-1">
                    <div>
                        <span className="font-bold text-gray-800">Report Type:</span> <span className="text-gray-600 ml-1">{filters.reportType}</span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-800">Date Range:</span> <span className="text-gray-600 ml-1">
                            {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
                        </span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-800">Generated On:</span> <span className="text-gray-600 ml-1">
                            {formatDate(new Date())}
                        </span>
                    </div>
                </div>
            </div>

            {/* ================= SUMMARY SECTION ================= */}
            {isSummary && summary && (
                <div className="mt-10 mb-12 w-full pl-6">
                    <table className="w-full min-w-full table-fixed mx-auto border-collapse text-xs text-black">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase">Income</th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase">Expense</th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase">Investment</th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase">Net Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 text-[10px]">{formatCurrency(summary.income, preferences.currency)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 text-[10px]">{formatCurrency(summary.expense, preferences.currency)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 text-[10px]">{formatCurrency(summary.investment, preferences.currency)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 text-[10px] bg-gray-50">{formatCurrency(summary.net, preferences.currency)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
            {isProfitLoss && (
                <div className="mt-10 mb-8 w-full pl-6">
                    {(() => {
                        const income = Array.isArray(reportData.income) ? reportData.income : [];
                        const expenses = Array.isArray(reportData.expenses) ? reportData.expenses : [];
                        const totalIncome = Number(summary?.totalIncome ?? summary?.income ?? 0);
                        const totalExpense = Number(summary?.totalExpense ?? summary?.expense ?? 0);
                        const netProfit = Number(summary?.netProfit ?? summary?.net ?? 0);
                        const categoryRows = [
                            ...income.map((group) => ({
                                section: 'income',
                                category: group?.category || 'Uncategorized',
                                income: Number(group?.total || 0),
                                expense: 0,
                                count: Array.isArray(group?.items) ? group.items.length : 0,
                                items: Array.isArray(group?.items) ? group.items : [],
                            })),
                            ...expenses.map((group) => ({
                                section: 'expense',
                                category: group?.category || 'Uncategorized',
                                income: 0,
                                expense: Number(group?.total || 0),
                                count: Array.isArray(group?.items) ? group.items.length : 0,
                                items: Array.isArray(group?.items) ? group.items : [],
                            })),
                        ];

                        return (
                            <div className="space-y-6">
                                <table className="w-full min-w-full table-fixed mx-auto border-collapse text-xs text-black">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800 uppercase w-[44%]">Category</th>
                                            <th className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800 uppercase w-[18%]">Income</th>
                                            <th className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800 uppercase w-[18%]">Expense</th>
                                            <th className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800 uppercase w-[20%]">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryRows.map((row, idx) => (
                                            <React.Fragment key={`pl-row-${idx}`}>
                                                <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800 text-[10px]">{row.category}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-700 text-[10px]">{row.income > 0 ? formatCurrency(row.income, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-700 text-[10px]">{row.expense > 0 ? formatCurrency(row.expense, preferences.currency) : '-'}</td>
                                                    <td className={`border border-gray-300 px-3 py-2 text-right font-bold text-[10px] ${row.section === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                                                        {formatCurrency(row.income - row.expense, preferences.currency)}
                                                    </td>
                                                </tr>
                                                {row.items.map((item, itemIdx) => {
                                                    const accountName =
                                                        item?.account ||
                                                        item?.accountName ||
                                                        item?.name ||
                                                        item?.account_id ||
                                                        item?.accountId ||
                                                        'Unknown account';
                                                    const itemAmount = Number(item?.amount || 0);
                                                    return (
                                                        <tr key={`pl-item-${idx}-${itemIdx}`} className="bg-white">
                                                            <td className="border-l border-r border-gray-300 px-5 py-1 text-[9px] text-gray-600">- {accountName}</td>
                                                            <td className="border-l border-r border-gray-300 px-3 py-1 text-right text-[9px] text-gray-700">{row.section === 'income' ? formatCurrency(itemAmount, preferences.currency) : '-'}</td>
                                                            <td className="border-l border-r border-gray-300 px-3 py-1 text-right text-[9px] text-gray-700">{row.section === 'expense' ? formatCurrency(itemAmount, preferences.currency) : '-'}</td>
                                                            <td className={`border-l border-r border-gray-300 px-3 py-1 text-right text-[9px] font-semibold ${row.section === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                                                                {formatCurrency(row.section === 'income' ? itemAmount : -itemAmount, preferences.currency)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                        <tr className="bg-gray-50">
                                            <td className="border border-gray-300 border-t-2 border-t-gray-400 px-3 py-2 text-left font-bold text-gray-900 text-[11px]">TOTAL INCOME</td>
                                            <td className="border border-gray-300 border-t-2 border-t-gray-400 px-3 py-2 text-right font-bold text-green-700 text-[11px]">{formatCurrency(totalIncome, preferences.currency)}</td>
                                            <td className="border border-gray-300 border-t-2 border-t-gray-400 px-3 py-2 text-right text-[11px] text-gray-500">-</td>
                                            <td className="border border-gray-300 border-t-2 border-t-gray-400 px-3 py-2 text-right font-bold text-green-700 text-[11px]">{formatCurrency(totalIncome, preferences.currency)}</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900 text-[11px]">TOTAL EXPENSE</td>
                                            <td className="border border-gray-300 px-3 py-2 text-right text-[11px] text-gray-500">-</td>
                                            <td className="border border-gray-300 px-3 py-2 text-right font-bold text-red-700 text-[11px]">{formatCurrency(totalExpense, preferences.currency)}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-right font-bold text-red-700 text-[11px]">{formatCurrency(-totalExpense, preferences.currency)}</td>
                                        </tr>
                                        <tr className="bg-gray-100">
                                            <td className="border border-gray-300 border-t-2 border-t-gray-500 px-3 py-2 text-left font-bold text-gray-900 text-[12px]">NET PROFIT</td>
                                            <td className="border border-gray-300 border-t-2 border-t-gray-500 px-3 py-2 text-right text-[12px] text-gray-500">-</td>
                                            <td className="border border-gray-300 border-t-2 border-t-gray-500 px-3 py-2 text-right text-[12px] text-gray-500">-</td>
                                            <td className={`border border-gray-300 border-t-2 border-t-gray-500 px-3 py-2 text-right font-bold text-[12px] ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {formatCurrency(netProfit, preferences.currency)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ================= DATA TABLE ================= */}
            {!isProfitLoss && <div className="mt-8 mb-8">
                {tableData && tableData.length > 0 ? (
                    <table className="w-full mx-auto border-collapse text-xs text-black">
                        <thead>
                            <tr className="bg-gray-100">
                                {type === 'transactions' || type === 'ledger' ? (
                                    <>
                                        <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[12%]">Date</th>
                                        <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase">Description</th>
                                        <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[15%]">Category</th>
                                        {type === 'transactions' && (
                                            <>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[15%]">Bank Name</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[10%]">Type</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[12%]">Amount</th>
                                            </>
                                        )}
                                        {type === 'ledger' && (
                                            <>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[15%]">Debit</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[15%]">Credit</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 uppercase w-[15%]">Balance</th>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {type === 'categories' && (
                                            <>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase">Category</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Opening</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Income</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Expense</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Invest</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Closing</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[6%]">Count</th>
                                            </>
                                        )}
                                        {type === 'accounts' && (
                                            <>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase">Account Name</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Opening</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Income</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Expense</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Invest</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Closing</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[6%]">Count</th>
                                            </>
                                        )}
                                        {type === 'profit-loss' && (
                                            <>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase">Line Item</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[16%]">Type</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[12%]">Count</th>
                                                <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800 uppercase w-[16%]">Amount</th>
                                            </>
                                        )}
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Ledger Opening Balance */}
                            {type === 'ledger' && reportData.openingBalance !== undefined && (
                                <tr className="bg-gray-100 border-t border-gray-300">
                                    <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800">
                                        OPENING BALANCE
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-900 text-[10px]">
                                        {formatCurrency(reportData.openingBalance, preferences.currency)}
                                    </td>
                                </tr>
                            )}

                            {tableData.map((item, index) => (
                                <tr key={index}>
                                    {type === 'transactions' || type === 'ledger' ? (
                                        <>
                                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-600 font-medium text-[10px]">
                                                {formatDate(item.date)}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-left text-gray-900 font-medium text-[10px]">{item.description}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-500 text-[10px]">{typeof item.category === 'object' && item.category !== null ? item.category.name : item.category}</td>
                                            {type === 'transactions' && (
                                                <>
                                                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-500 text-[10px]">{typeof item.account === 'object' && item.account !== null ? item.account.name : (item.account || item.method)}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className={`border border-gray-300 px-3 py-2 text-center font-bold text-[10px] ${item.type === 'Income' ? 'text-green-700' :
                                                        item.type === 'Expense' ? 'text-red-700' :
                                                            'text-gray-700'
                                                        }`}>
                                                        {formatCurrency(Number(item.amount), preferences.currency)}
                                                    </td>
                                                </>
                                            )}
                                            {type === 'ledger' && (
                                                <>
                                                    <td className="border border-gray-300 px-3 py-2 text-right text-rose-700 font-medium text-[10px]">{item.debit ? formatCurrency(item.debit, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-right text-blue-700 font-medium text-[10px]">{item.credit ? formatCurrency(item.credit, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-900 text-[10px]">
                                                        {formatCurrency(item.balance, preferences.currency)}
                                                    </td>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {type === 'categories' && (
                                                <>
                                                    <td className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 text-[10px]">{item.name}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.openingBalance !== undefined ? formatCurrency(item.openingBalance, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.income > 0 ? formatCurrency(item.income, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.expense > 0 ? formatCurrency(item.expense, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.investment > 0 ? formatCurrency(item.investment, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-[10px]">{item.closingBalance !== undefined ? formatCurrency(item.closingBalance, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-400 text-[10px]">{item.count}</td>
                                                </>
                                            )}
                                            {type === 'accounts' && (
                                                <>
                                                    <td className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 text-[10px]">{item.name}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.openingBalance !== undefined ? formatCurrency(item.openingBalance, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.income > 0 ? formatCurrency(item.income, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.expense > 0 ? formatCurrency(item.expense, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-600 text-[10px]">{item.investment > 0 ? formatCurrency(item.investment, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-[10px]">{item.closingBalance !== undefined ? formatCurrency(item.closingBalance, preferences.currency) : '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-400 text-[10px]">{item.count}</td>
                                                </>
                                            )}
                                            {type === 'profit-loss' && (
                                                <>
                                                    <td className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 text-[10px]">{item.name}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-600 text-[10px]">{item.type || '-'}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-600 text-[10px]">{item.count || 0}</td>
                                                    <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-[10px]">{formatCurrency(Number(item.amount || 0), preferences.currency)}</td>
                                                </>
                                            )}
                                        </>
                                    )}
                                </tr>
                            ))}
                            {type === 'ledger' && reportData.closingBalance !== undefined && (
                                <tr className="bg-gray-100 border-t border-gray-300">
                                    <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800">
                                        CLOSING BALANCE
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-900 text-[10px]">
                                        {formatCurrency(reportData.closingBalance, preferences.currency)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-sm font-medium">No records found for this period</p>
                    </div>
                )
                }
            </div >}

            {/* ================= FOOTER ================= */}
            {/* Footer removed as per request */}
        </div >
    );
};

export default ReportTablePrint;
