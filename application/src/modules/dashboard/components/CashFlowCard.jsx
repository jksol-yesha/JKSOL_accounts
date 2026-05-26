import CompactCurrency from '../../../components/common/CompactCurrency';
import React, { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { usePreferences } from '../../../context/PreferenceContext';
import LoadingOverlay from '../../../components/common/LoadingOverlay';

const formatYAxis = (value) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
};

const CustomTooltip = ({ active, payload, label, formatCurrency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="pointer-events-none relative min-w-[112px] rounded-md bg-slate-800 px-2.5 py-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-left text-slate-300">{label}</div>
                <div className="flex flex-col gap-1.5">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 text-left">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-left text-[11px] text-slate-200">
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name || 'Value'}
                            </span>
                            <span className="whitespace-nowrap text-right text-[11px] font-semibold text-white">
                                {formatCurrency(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Tooltip Arrow pointing down */}
                <div 
                    className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-800" 
                />
            </div>
        );
    }
    return null;
};

const CashFlowAxisTick = ({ x = 0, y = 0, payload }) => {
    const label = String(payload?.value || '').trim();
    const monthDayMatch = label.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
    const dayMonthMatch = label.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
    const match = label.match(/^(.*)\s+(\d{4})$/);

    if (monthDayMatch || dayMonthMatch) {
        const [, firstPart, secondPart] = monthDayMatch || dayMonthMatch;
        const dayLabel = monthDayMatch ? secondPart : firstPart;
        const monthLabel = monthDayMatch ? firstPart : secondPart;

        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={0}
                    dy={8}
                    textAnchor="middle"
                >
                    <tspan x={0} dy={0} fill="#94a3b8" fontSize="10" fontWeight="600">
                        {dayLabel}
                    </tspan>
                    <tspan x={0} dy={12} fill="#cbd5e1" fontSize="9" fontWeight="500">
                        {monthLabel}
                    </tspan>
                </text>
            </g>
        );
    }

    if (!match) {
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={0}
                    dy={12}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight={600}
                >
                    {label}
                </text>
            </g>
        );
    }

    const [, monthLabel, yearLabel] = match;

    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={8}
                textAnchor="middle"
            >
                <tspan x={0} dy={0} fill="#94a3b8" fontSize="10" fontWeight="600">
                    {monthLabel}
                </tspan>
                <tspan x={0} dy={12} fill="#cbd5e1" fontSize="9" fontWeight="500">
                    {yearLabel}
                </tspan>
            </text>
        </g>
    );
};

const isMonthlyCashFlowLabel = (value) => /^\w{3}\s+\d{4}$/.test(String(value || '').trim());



const CashFlowCard = ({ stats = {}, chartData = [], isLoading = false }) => {
    const { formatCompactCurrency: formatCurrency, formatCurrency: formatCurrencyExact } = usePreferences();

    const displayData = [...chartData];
    const showAllMonthTicks = displayData.length > 0 && displayData.every((item) => isMonthlyCashFlowLabel(item.label));

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full overflow-hidden min-h-[300px] sm:min-h-[320px] lg:min-h-[280px] lg:row-span-1 lg:col-span-1 xl:col-span-2 2xl:min-h-[360px]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 bg-[#F9F9FB]">
                <h3 className="text-[13px] 2xl:text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
                    Cash Flow
                </h3>
            </div>

            {/* Body */}
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-white relative">
                {isLoading && <LoadingOverlay />}

                {/* Left Side: Graph */}
                <div className="relative h-[240px] p-4 sm:h-[260px] sm:p-5 lg:h-auto lg:min-h-[160px] lg:flex-1 2xl:min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={<CashFlowAxisTick />}
                                height={46}
                                tickMargin={8}
                                minTickGap={showAllMonthTicks ? 0 : 24}
                                interval={showAllMonthTicks ? 0 : 'preserveStartEnd'}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                                tickFormatter={formatYAxis}
                            />
                            <Tooltip content={<CustomTooltip formatCurrency={formatCurrencyExact} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area
                                type="monotone"
                                name="Income"
                                dataKey="income"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorIncome)"
                                activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                                dot={{ r: 3, fill: "#10b981", stroke: "#fff", strokeWidth: 1.5 }}
                            />
                            <Area
                                type="monotone"
                                name="Expense"
                                dataKey="expense"
                                stroke="#f43f5e"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorExpense)"
                                activeDot={{ r: 4, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
                                dot={{ r: 3, fill: "#f43f5e", stroke: "#fff", strokeWidth: 1.5 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Right Side: Summary Stats block */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-100 px-4 py-4 sm:gap-x-5 sm:px-5 sm:py-5 lg:w-[210px] lg:flex lg:flex-col lg:justify-center lg:border-t-0 lg:border-l lg:px-5 lg:py-6 lg:gap-7 shrink-0">

                    {/* Opening Balance */}
                    <div className="flex flex-col items-start text-left lg:items-end lg:text-right">
                        <span className="text-xs font-medium text-slate-500 mb-1">
                            Opening Balance
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-slate-900 tracking-tight">
                                <CompactCurrency amount={stats.openingBalance || 0} />
                            </div>
                        </div>
                    </div>

                    {/* Incoming */}
                    <div className="flex flex-col items-start text-left lg:items-end lg:text-right">
                        <span className="text-xs font-medium text-emerald-600 mb-1">
                            Incoming
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-slate-900 tracking-tight">
                                <CompactCurrency amount={stats.totalIncome || 0} />
                            </div>
                            <span className="text-sm font-bold text-emerald-600">+</span>
                        </div>
                    </div>

                    {/* Outgoing */}
                    <div className="flex flex-col items-start border-t border-slate-100/60 pt-3 text-left lg:border-t-0 lg:pt-0 lg:items-end lg:text-right">
                        <span className="text-xs font-medium text-rose-500 mb-1">
                            Outgoing
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-slate-900 tracking-tight">
                                <CompactCurrency amount={stats.totalExpense || 0} />
                            </div>
                            <span className="text-sm font-bold text-rose-500">-</span>
                        </div>
                    </div>

                    {/* Closing Balance */}
                    <div className="col-span-1 flex w-full flex-col items-start justify-end border-t border-slate-100/60 pt-3 text-left lg:items-end lg:text-right">
                        <span className="text-xs font-medium text-blue-500 mb-1">
                            Closing Balance
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-slate-900 tracking-tight">
                                <CompactCurrency amount={stats.closingBalance || 0} />
                            </div>
                            <span className="text-sm font-bold text-slate-400">=</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default CashFlowCard;
