import React from 'react';
import { cn } from '../../../utils/cn';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';

const ReportTablePrint = ({ reportData, filters }) => {
    const { formatCurrency, formatDate, preferences } = usePreferences();
    const { selectedOrg } = useOrganization();
    if (!reportData) return null;

    const { summary, tableData, type } = reportData;
    const isSummary = filters.reportType === 'Summary';
    const isProfitLoss = filters.reportType === 'P/L' || filters.reportType === 'Profit/Loss' || filters.reportType === 'Profit & Loss';

    const d = reportData.data || {};

    // Format Branch Name for Header
    const branchDisplayName = filters.branch && filters.branch !== 'All Branches'
        ? `JKSOL-${filters.branch}`
        : (filters.branch || 'JKSOL-All Branches');

    // Make sure d.incomes and d.expenses exist for mapping
    const incomes = (d.incomes || []).filter(g => (g.items?.length > 0 || Number(g.total || 0) > 0));
    const expenses = (d.expenses || []).filter(g => (g.items?.length > 0 || Number(g.total || 0) > 0));

    return (
        <div className={`hidden print:block w-full bg-white text-black ${isProfitLoss ? 'p-12 max-w-[297mm]' : 'p-12 max-w-[297mm]'} mx-auto font-sans`}>
            {/* ================= HEADER ================= */}
            <div className="mb-6 text-center">
                {selectedOrg?.name && (
                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight mb-1">
                        {selectedOrg.name}
                    </h1>
                )}
                {selectedOrg?.address && (
                    <p className="text-[11px] text-slate-600 max-w-[300px] mx-auto leading-relaxed mb-3">
                        {selectedOrg.address}
                    </p>
                )}
                <div className="inline-block border-y border-slate-300 py-1 px-4">
                    <h2 className="text-lg font-bold text-slate-800 uppercase tracking-[0.1em]">
                        {isProfitLoss ? 'Profit & Loss A/c' : `${filters.reportType} Report`}
                    </h2>
                </div>
                <div className="mt-2 text-[12px] font-bold text-slate-700">
                    {branchDisplayName}
                </div>
            </div>

            {/* Divider (Optional if using border-y above) */}
            {!selectedOrg?.name && <div className="w-full h-[1px] bg-black mb-8"></div>}

            {/* ================= META INFO ================= */}
            <div className={`flex justify-start text-[10px] ${isProfitLoss ? 'mb-6' : 'mb-10'}`}>
                <div className="text-left space-y-0.5">
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
                        const totalLeft = Number(d.totalLeft || 0).toLocaleString();
                        const totalRight = Number(d.totalRight || 0).toLocaleString();
                        const netProfit = Number(d.netProfit || 0);
                        const netLoss = Number(d.netLoss || 0);
                        const dateRangeHeader = `${filters.startDate} to ${filters.endDate}`;

                        return (
                            <div className="border border-gray-400 text-black font-serif">
                                <table className="w-full border-collapse">
                                    <thead>
                                        {/* Row 2: Sub-Headers (Particulars, Date Range) */}
                                        <tr className="bg-slate-50 border-b border-gray-400">
                                            <th className="px-2 py-1 text-[10px] font-bold uppercase text-slate-600 border-r border-gray-300 text-left w-[32%]">Particulars</th>
                                            <th colSpan={2} className="px-2 py-1 text-[10px] font-bold uppercase text-slate-600 border-r border-gray-400 text-center w-[18%]">{dateRangeHeader}</th>
                                            <th className="px-2 py-1 text-[10px] font-bold uppercase text-slate-600 border-r border-gray-300 text-left w-[32%]">Particulars</th>
                                            <th colSpan={2} className="px-2 py-1 text-[10px] font-bold uppercase text-slate-600 text-center w-[18%]">{dateRangeHeader}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {/* LEFT SIDE: EXPENSES */}
                                            <td colSpan={3} className="align-top border-r border-gray-400 p-0">
                                                <div className="min-h-[450px] flex flex-col">
                                                    <div className="flex-1">
                                                        {expenses.map((group, idx) => (
                                                            <div key={idx} className="mb-2">
                                                                <div className="grid grid-cols-[1fr,70px,70px] w-full items-end">
                                                                    <div className="px-2 py-1 text-[11px] font-bold text-slate-900">{group.category}</div>
                                                                    <div></div>
                                                                    <div className="px-2 py-1 text-[11px] font-bold text-right tabular-nums text-slate-900">
                                                                        {formatCurrency(group.total, preferences.currency)}
                                                                    </div>
                                                                </div>
                                                                {(group.items || []).map((item, iIdx) => (
                                                                    <div key={iIdx} className="grid grid-cols-[1fr,70px,70px] w-full items-end">
                                                                        <div className="px-5 py-0.5 text-[10px] text-slate-600 italic">{item.subCategory}</div>
                                                                        <div className="px-2 py-0.5 text-[10px] text-right tabular-nums text-slate-600">
                                                                            {formatCurrency(item.amount, preferences.currency)}
                                                                        </div>
                                                                        <div></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {netProfit > 0 && (
                                                        <div className="grid grid-cols-[1fr,70px,70px] border-t border-emerald-100 mt-auto">
                                                            <div className="px-2 py-1.5 text-[11px] font-bold italic text-slate-800">Nett Profit</div>
                                                            <div></div>
                                                            <div className="px-2 py-1.5 text-[11px] font-bold text-right tabular-nums text-slate-900">
                                                                {formatCurrency(netProfit, preferences.currency)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* RIGHT SIDE: INCOME */}
                                            <td colSpan={3} className="align-top p-0">
                                                <div className="min-h-[450px] flex flex-col">
                                                    <div className="flex-1">
                                                        {incomes.map((group, idx) => (
                                                            <div key={idx} className="mb-2">
                                                                <div className="grid grid-cols-[1fr,70px,70px] w-full items-end">
                                                                    <div className="px-2 py-1 text-[11px] font-bold text-slate-900">{group.category}</div>
                                                                    <div></div>
                                                                    <div className="px-2 py-1 text-[11px] font-bold text-right tabular-nums text-slate-900">
                                                                        {formatCurrency(group.total, preferences.currency)}
                                                                    </div>
                                                                </div>
                                                                {(group.items || []).map((item, iIdx) => (
                                                                    <div key={iIdx} className="grid grid-cols-[1fr,70px,70px] w-full items-end">
                                                                        <div className="px-5 py-0.5 text-[10px] text-slate-600 italic">{item.subCategory}</div>
                                                                        <div className="px-2 py-0.5 text-[10px] text-right tabular-nums text-slate-600">
                                                                            {formatCurrency(item.amount, preferences.currency)}
                                                                        </div>
                                                                        <div></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {netLoss > netProfit && netLoss > 0 && (
                                                        <div className="grid grid-cols-[1fr,70px,70px] border-t border-rose-100 mt-auto">
                                                            <div className="px-2 py-1.5 text-[11px] font-bold italic text-slate-800">Nett Loss</div>
                                                            <div></div>
                                                            <div className="px-2 py-1.5 text-[11px] font-bold text-right tabular-nums text-slate-900">
                                                                {formatCurrency(netLoss, preferences.currency)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-y border-gray-300 bg-white font-bold tracking-tight">
                                            <td colSpan={2} className="px-2 py-1.5 text-[11px] text-slate-900 text-left">Total</td>
                                            <td className="px-2 py-1.5 text-[11px] text-right text-slate-900 border-r border-gray-400 tabular-nums">
                                                {formatCurrency(d.totalLeft, preferences.currency)}
                                            </td>
                                            <td colSpan={2} className="px-2 py-1.5 text-[11px] text-slate-900 text-left">Total</td>
                                            <td className="px-2 py-1.5 text-[11px] text-right text-slate-900 tabular-nums">
                                                {formatCurrency(d.totalRight, preferences.currency)}
                                            </td>
                                        </tr>
                                    </tfoot>
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
