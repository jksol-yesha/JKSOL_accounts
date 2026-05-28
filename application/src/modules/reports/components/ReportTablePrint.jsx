import React from 'react';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { cn } from '../../../utils/cn';

const ReportTablePrint = ({ reportData, filters }) => {
    const { formatCurrency, formatDate, preferences } = usePreferences();
    const { selectedOrg } = useOrganization();
    if (!reportData) return null;

    const { summary, tableData, type } = reportData;
    const isSummary = filters.reportType === 'Summary';
    const isProfitLoss = filters.reportType === 'P/L' || filters.reportType === 'Profit/Loss' || filters.reportType === 'Profit & Loss';

    const d = reportData.data || {};
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

    // Format Branch Name for Header
    const branchDisplayName = filters.branch && filters.branch !== 'All Branches'
        ? `JKSOL-${filters.branch}`
        : (filters.branch || 'JKSOL-All Branches');

    const addressLines = String(selectedOrg?.address || '')
        .split(/\r?\n|,/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);
    const fallbackBranchLine = filters.branch && filters.branch !== 'All Branches'
        ? [String(filters.branch).trim()]
        : [];
    const headerLines = addressLines.length > 0 ? addressLines : fallbackBranchLine;

    return (
        <div className={`hidden print:block w-full bg-white text-black ${isProfitLoss ? 'max-w-[210mm] px-10 pb-10 pt-20 font-sans' : 'p-12 max-w-[297mm] font-sans'} mx-auto`}>
            {/* ================= HEADER ================= */}
            {!isProfitLoss && (
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
                            {`${filters.reportType} Report`}
                        </h2>
                    </div>
                    <div className="mt-2 text-[12px] font-bold text-slate-700">
                        {branchDisplayName}
                    </div>
                </div>
            )}

            {/* Divider (Optional if using border-y above) */}
            {!isProfitLoss && !selectedOrg?.name && <div className="w-full h-[1px] bg-black mb-8"></div>}

            {/* ================= META INFO ================= */}
            {!isProfitLoss && (
                <div className="mb-10 flex justify-start text-[10px]">
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
            )}

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
                <div className="mb-4 w-full">
                    {(() => {
                        const dateRangeHeader = `${formatProfitLossStatementDate(filters.startDate)} to ${formatProfitLossStatementDate(filters.endDate)}`;
                        const leftRows = buildProfitLossStatementRows(
                            d.expenses || [],
                            d.netProfit > 0 ? { label: 'Nett Profit', amount: d.netProfit } : null
                        );
                        const rightRows = buildProfitLossStatementRows(
                            d.incomes || [],
                            d.netLoss > 0 ? { label: 'Nett Loss', amount: d.netLoss } : null
                        );
                        const rowCount = Math.max(leftRows.length, rightRows.length, 1);
                        const pairedRows = Array.from({ length: rowCount }, (_, index) => ({
                            left: leftRows[index] || null,
                            right: rightRows[index] || null
                        }));
                        const blankCell = '\u00A0';

                        return (
                            <div className="text-black">
                                <div className="mb-7 text-center">
                                    <h1 className="text-[16px] font-semibold uppercase leading-[1.12] text-black">
                                        {selectedOrg?.name || 'Organization Name'}
                                    </h1>
                                    {headerLines.map((line, index) => (
                                        <div
                                            key={`${line}-${index}`}
                                            className={cn(
                                                "text-[10.5px] leading-[1.16] text-black",
                                                index === headerLines.length - 1 && "inline-block border-b border-black pb-px"
                                            )}
                                        >
                                            {line}
                                        </div>
                                    ))}
                                    <h2 className="mt-[7px] text-[15.5px] font-semibold leading-[1.12] text-black">
                                        Profit &amp; Loss A/c
                                    </h2>
                                    <div className="mt-px text-[10.5px] leading-[1.12] text-black">
                                        {dateRangeHeader}
                                    </div>
                                </div>

                                <table className="w-full border-collapse table-fixed text-[10.5px] text-black">
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
                                            <th className="py-px pl-[8px] pr-3 text-left text-[11px] font-[550] tracking-[0.02em] text-black">
                                                P a r t i c u l a r s
                                            </th>
                                            <th colSpan={2} className="border-r border-black/40 py-px text-center text-[10.5px] font-normal text-black">&nbsp;</th>
                                            <th className="py-px pl-[8px] pr-3 text-left text-[11px] font-[550] tracking-[0.02em] text-black">
                                                P a r t i c u l a r s
                                            </th>
                                            <th colSpan={2} className="py-px text-center text-[10.5px] font-normal text-black">&nbsp;</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="h-[6px]">
                                            <td></td>
                                            <td></td>
                                            <td className="border-r border-black/40"></td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                        </tr>
                                        {pairedRows.map(({ left, right }, index) => {
                                            const isLeftLastItem = left?.kind === 'item' && pairedRows[index + 1]?.left?.kind !== 'item';
                                            const isRightLastItem = right?.kind === 'item' && pairedRows[index + 1]?.right?.kind !== 'item';

                                            return (
                                                <tr key={`print-pnl-row-${index}`} className="align-top">
                                                    {/* LEFT SIDE */}
                                                    <td className={cn(
                                                        'py-px pl-[8px] pr-3 leading-[1.15]',
                                                        left?.kind === 'section' && 'pt-[4px]',
                                                        left?.kind === 'balance' && 'pt-[4px]',
                                                        left?.kind === 'section' && 'text-[11.5px] font-[550]',
                                                        left?.kind === 'balance' && 'text-[11px]',
                                                        left?.kind === 'item' && 'pl-[12px] italic'
                                                    )}>
                                                        {left?.label || blankCell}
                                                    </td>
                                                    <td className={cn(
                                                        'py-px text-right tabular-nums leading-[1.15] pr-2',
                                                        left?.kind === 'section' && 'pt-[4px]',
                                                        left?.kind === 'balance' && 'pt-[4px]',
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
                                                        'border-r border-black/40 py-px pr-2 text-right tabular-nums leading-[1.15]',
                                                        left?.kind === 'section' && 'pt-[4px]',
                                                        left?.kind === 'balance' && 'pt-[4px]',
                                                        left?.kind === 'section' && 'font-[550]',
                                                        left?.kind === 'balance' && 'font-semibold',
                                                        !left && 'text-transparent'
                                                    )}>
                                                        {left?.kind === 'section' || left?.kind === 'balance'
                                                            ? formatProfitLossStatementAmount(left.total)
                                                            : blankCell}
                                                    </td>

                                                    {/* RIGHT SIDE */}
                                                    <td className={cn(
                                                        'py-px pl-[8px] pr-3 leading-[1.15]',
                                                        right?.kind === 'section' && 'pt-[4px]',
                                                        right?.kind === 'balance' && 'pt-[4px]',
                                                        right?.kind === 'section' && 'text-[11.5px] font-[550]',
                                                        right?.kind === 'balance' && 'text-[11px]',
                                                        right?.kind === 'item' && 'pl-[12px] italic'
                                                    )}>
                                                        {right?.label || blankCell}
                                                    </td>
                                                    <td className={cn(
                                                        'py-px text-right tabular-nums leading-[1.15] pr-2',
                                                        right?.kind === 'section' && 'pt-[4px]',
                                                        right?.kind === 'balance' && 'pt-[4px]',
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
                                                        right?.kind === 'section' && 'pt-[4px]',
                                                        right?.kind === 'balance' && 'pt-[4px]',
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
                                            <td></td>
                                            <td></td>
                                            <td className="border-r border-black/40"></td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-y border-black/80">
                                            <td colSpan={2} className="py-px pl-[8px] pr-3 text-left text-[11px] font-[550] tracking-[0.02em] text-black">
                                                T o t a l
                                            </td>
                                            <td className="border-r border-black/40 py-px pr-2 text-right font-[550] tabular-nums text-black">
                                                {formatProfitLossStatementAmount(d.totalLeft, true)}
                                            </td>
                                            <td colSpan={2} className="py-px pl-[8px] text-left text-[11px] font-[550] tracking-[0.02em] text-black">
                                                T o t a l
                                            </td>
                                            <td className="py-px pr-2 text-right font-[550] tabular-nums text-black">
                                                {formatProfitLossStatementAmount(d.totalRight, true)}
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
