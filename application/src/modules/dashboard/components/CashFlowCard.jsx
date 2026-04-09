import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '../../../utils/cn';
import { usePreferences } from '../../../context/PreferenceContext';

const formatYAxis = (value) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
};

const CustomTooltip = ({ active, payload, label, formatCurrency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white px-3 py-2 border border-slate-200 rounded-md shadow-sm">
                <p className="text-[11px] text-slate-500 font-semibold mb-1">{label}</p>
                <p className="text-[12px] font-bold text-[#111827]">
                    {formatCurrency(payload[0].value)}
                </p>
            </div>
        );
    }
    return null;
};

const CashFlowCard = ({ stats = {}, chartData = [] }) => {
    const { formatCurrency } = usePreferences();

    // Reversing the chartData to show chronological order from left to right (Dashboard trails are reversed by default)
    const displayData = [...chartData].reverse().map(item => ({
        ...item,
        // Shorten labels like "Jan 2026" to "Jan\n2026" for better XAxis fitting if needed, or keep as is.
        shortLabel: item.label.split(' ').join('\n')
    }));

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-2 overflow-hidden min-h-[360px]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h3 className="text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
                    Cash Flow
                </h3>
            </div>

            {/* Body */}
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-white">
                
                {/* Left Side: Graph */}
                <div className="flex-1 p-5 relative min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCashFlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="label" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                                tickFormatter={formatYAxis}
                            />
                            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#3b82f6" 
                                strokeWidth={2.5}
                                fillOpacity={1} 
                                fill="url(#colorCashFlow)" 
                                activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                                dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1.5 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Right Side: Summary Stats block */}
                <div className="lg:w-[260px] border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col justify-center px-6 py-6 lg:py-0 shrink-0 gap-6">
                    
                    {/* Opening Balance */}
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[12px] font-medium text-slate-500 mb-1">
                            Opening Balance
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-[#111827] tracking-tight">
                                {formatCurrency(stats.openingBalance || 0)}
                            </span>
                        </div>
                    </div>

                    {/* Incoming */}
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[12px] font-medium text-emerald-600 mb-1">
                            Incoming
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-[#111827] tracking-tight">
                                {formatCurrency(stats.totalIncome || 0)}
                            </span>
                            <span className="text-[13px] font-bold text-emerald-600">+</span>
                        </div>
                    </div>

                    {/* Outgoing */}
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[12px] font-medium text-rose-500 mb-1">
                            Outgoing
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-[#111827] tracking-tight">
                                {formatCurrency(stats.totalExpense || 0)}
                            </span>
                            <span className="text-[13px] font-bold text-rose-500">-</span>
                        </div>
                    </div>

                    {/* Closing Balance */}
                    <div className="flex flex-col items-end text-right pt-2 border-t border-slate-100/60 w-full justify-end">
                        <span className="text-[12px] font-medium text-blue-500 mb-1">
                            Closing Balance
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[16px] font-bold text-[#111827] tracking-tight">
                                {formatCurrency(stats.closingBalance || 0)}
                            </span>
                            <span className="text-[13px] font-bold text-slate-400">=</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default CashFlowCard;
