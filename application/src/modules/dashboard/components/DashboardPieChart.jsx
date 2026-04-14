import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Loader2, RefreshCw } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { cn } from '../../../utils/cn';

const COLORS = ['#2f80ed', '#45c164', '#ff8a1e', '#9b67e5', '#b7b7b7', '#ff5c5c', '#20c4d8', '#ffd166'];
const MAX_VISIBLE_SEGMENTS = 5;
const TOP_CATEGORY_COUNT = MAX_VISIBLE_SEGMENTS - 1;
const ACTIVE_SLICE_OFFSET = 2;
const ACTIVE_SLICE_RADIUS_GROWTH = 2;

const getCurrencySymbol = (currency) => {
    try {
        const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0);
        return parts.find((part) => part.type === 'currency')?.value || currency;
    } catch {
        return currency;
    }
};

const formatCompactAmount = (amount, currency) => {
    const numericAmount = Math.abs(Number(amount) || 0);
    const symbol = getCurrencySymbol(currency || 'INR');

    if (numericAmount >= 10000000) {
        return `${symbol}${(numericAmount / 10000000).toFixed(2)} Cr`;
    }

    if (numericAmount >= 100000) {
        return `${symbol}${(numericAmount / 100000).toFixed(2)} L`;
    }

    if (numericAmount >= 1000) {
        return `${symbol}${(numericAmount / 1000).toFixed(2)} K`;
    }

    return `${symbol}${numericAmount.toFixed(2)}`;
};

const ActiveSliceShape = ({
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    midAngle = 0,
    fill
}) => {
    const radians = (-midAngle * Math.PI) / 180;
    const offsetX = Math.cos(radians) * ACTIVE_SLICE_OFFSET;
    const offsetY = Math.sin(radians) * ACTIVE_SLICE_OFFSET;

    return (
        <g style={{ pointerEvents: 'none' }}>
            <Sector
                cx={cx + offsetX}
                cy={cy + offsetY}
                innerRadius={innerRadius}
                outerRadius={outerRadius + ACTIVE_SLICE_RADIUS_GROWTH}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                cornerRadius={4}
                style={{
                    filter: 'drop-shadow(0 4px 8px rgba(15,23,42,0.10))'
                }}
            />
        </g>
    );
};

const HoverRevealLabel = ({ text, onTruncatedHoverStart, onTruncatedHoverEnd }) => {
    const labelRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        const node = labelRef.current;
        if (!node) return undefined;

        const updateTruncationState = () => {
            setIsTruncated(node.scrollWidth > node.clientWidth + 1);
        };

        updateTruncationState();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateTruncationState);
            return () => window.removeEventListener('resize', updateTruncationState);
        }

        const observer = new ResizeObserver(updateTruncationState);
        observer.observe(node);

        return () => observer.disconnect();
    }, [text]);

    const handleHover = (event) => {
        if (!isTruncated) return;
        onTruncatedHoverStart?.(event, text);
    };

    return (
        <div
            className="min-w-0 flex-1"
            onMouseEnter={handleHover}
            onMouseLeave={onTruncatedHoverEnd}
        >
            <span
                ref={labelRef}
                className="block truncate text-[10px] font-medium text-slate-700 2xl:text-[12px]"
            >
                {text}
            </span>
        </div>
    );
};

const DashboardPieChart = ({ dashboardFilters }) => {
    const { getBranchFilterValue, selectedBranch, loading: branchLoading } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { preferences, formatCurrency } = usePreferences();

    const [selectedType, setSelectedType] = useState('expense');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const [tooltipState, setTooltipState] = useState(null);
    const [labelTooltipState, setLabelTooltipState] = useState(null);
    const chartBodyRef = useRef(null);

    const contextReady = Boolean(!branchLoading && !yearLoading && selectedYear?.id);

    useEffect(() => {
        const fetchCategories = async () => {
            if (!contextReady) return;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                const response = await apiService.dashboard.getCategoryRankings({
                    branchId: branchFilter,
                    financialYearId: selectedYear.id,
                    targetCurrency: dashboardFilters?.currency || preferences.currency,
                    ...(dashboardFilters?.dateRange?.startDate ? {
                        startDate: dashboardFilters.dateRange.startDate,
                        endDate: dashboardFilters.dateRange.endDate
                    } : {})
                });

                if (response?.success && Array.isArray(response.data)) {
                    setCategories(response.data.map((category) => ({
                        ...category,
                        type: String(category?.type ?? category?.txnType ?? '').trim().toLowerCase(),
                        amount: Number(category?.amount || 0)
                    })));
                } else {
                    setCategories([]);
                }
            } catch (error) {
                console.error('Failed to fetch pie chart categories', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [contextReady, selectedBranch?.id, selectedYear?.id, dashboardFilters, preferences.currency]);

    const sourceData = categories
        .filter((category) => category.type === selectedType)
        .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));

    const totalAmount = sourceData.reduce((sum, category) => sum + Math.abs(category.amount), 0);

    let chartData = [];
    if (sourceData.length > MAX_VISIBLE_SEGMENTS) {
        chartData = sourceData.slice(0, TOP_CATEGORY_COUNT);
        const othersAmount = sourceData
            .slice(TOP_CATEGORY_COUNT)
            .reduce((sum, category) => sum + Math.abs(category.amount), 0);

        if (othersAmount > 0) {
            chartData.push({ name: 'Others', amount: othersAmount });
        }
    } else {
        chartData = [...sourceData];
    }

    const currencyCode = dashboardFilters?.currency || preferences?.currency || 'INR';

    useEffect(() => {
        setActiveIndex(null);
        setTooltipState(null);
        setLabelTooltipState(null);
    }, [selectedType, dashboardFilters]);

    const getTooltipPosition = (event, dimensions = {}) => {
        const sourceEvent = event?.nativeEvent || event;
        const { clientX, clientY } = sourceEvent || {};

        if (typeof clientX !== 'number' || typeof clientY !== 'number') {
            return null;
        }

        const tooltipWidth = dimensions.width || 148;
        const tooltipHeight = dimensions.height || 50;
        const gutter = 12;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

        const nextLeft = Math.min(Math.max(clientX + gutter, 8), Math.max(viewportWidth - tooltipWidth - 8, 8));
        const nextTop = Math.min(Math.max(clientY + gutter, 8), Math.max(viewportHeight - tooltipHeight - 8, 8));

        return { left: nextLeft, top: nextTop };
    };

    const handleSegmentHover = (entry, index, event) => {
        const nextPosition = getTooltipPosition(event, { width: 148, height: 50 });

        setActiveIndex(index);
        setLabelTooltipState(null);
        setTooltipState({
            entry,
            position: nextPosition,
            color: COLORS[index % COLORS.length]
        });
    };

    const clearSegmentHover = () => {
        setActiveIndex(null);
        setTooltipState(null);
    };

    const handleLabelHover = (event, text) => {
        const nextPosition = getTooltipPosition(event, { width: 180, height: 36 });

        setActiveIndex(null);
        setTooltipState(null);
        setLabelTooltipState({
            text,
            position: nextPosition
        });
    };

    const clearLabelHover = () => {
        setLabelTooltipState(null);
    };

    const clearAllTooltips = () => {
        setActiveIndex(null);
        setTooltipState(null);
        setLabelTooltipState(null);
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-1 overflow-visible min-h-[340px]">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 bg-[#F9F9FB]">
                <div
                    onClick={() => setSelectedType((previous) => previous === 'expense' ? 'income' : 'expense')}
                    className="flex items-center gap-1.5 cursor-pointer select-none group"
                >
                    <h3 className="text-[14px] leading-none font-medium text-slate-900 group-hover:text-slate-700 tracking-tight transition-colors focus:outline-none flex items-center">
                        Top {selectedType === 'income' ? 'Income' : 'Expenses'}
                    </h3>
                    <div className="text-slate-400 group-hover:text-slate-600 transition-colors p-1 rounded-md group-hover:bg-slate-50 flex items-center justify-center mt-[1px]">
                        <RefreshCw className="w-4 h-4" />
                    </div>
                </div>
            </div>

            <div ref={chartBodyRef} className="flex-1 flex flex-col relative overflow-visible" onMouseLeave={clearAllTooltips}>
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
                        No {selectedType} data found
                    </div>
                ) : (
                    <div className="flex-1 flex items-center px-5 py-5 md:px-6 md:py-6">
                        <div className="flex w-full flex-col items-center gap-6 xl:grid xl:grid-cols-[118px_minmax(0,1fr)] xl:items-center xl:gap-3 2xl:grid-cols-[168px_minmax(0,1fr)] 2xl:gap-5">
                            <div className="flex h-[176px] w-[176px] shrink-0 items-center justify-center lg:h-[188px] lg:w-[188px] xl:h-[118px] xl:w-[118px] 2xl:h-[168px] 2xl:w-[168px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius="78%"
                                            innerRadius={0}
                                            paddingAngle={1}
                                            cornerRadius={2}
                                            dataKey="amount"
                                            stroke="none"
                                            startAngle={90}
                                            endAngle={-270}
                                            isAnimationActive
                                            activeIndex={activeIndex ?? undefined}
                                            activeShape={ActiveSliceShape}
                                            onMouseEnter={(entry, index, event) => handleSegmentHover(entry, index, event)}
                                            onMouseLeave={clearSegmentHover}
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1 xl:gap-1.5 2xl:gap-2">
                                {chartData.map((entry, index) => {
                                    const amount = Math.abs(entry.amount);
                                    const percent = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                                    const isActive = activeIndex === index;

                                    return (
                                        <div
                                            key={`${entry.name}-${index}`}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors xl:gap-1.5 2xl:gap-2",
                                                isActive && "bg-slate-50"
                                            )}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-1.5 xl:gap-1.5 2xl:gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full shrink-0 2xl:h-3 2xl:w-3"
                                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                />
                                                <HoverRevealLabel
                                                    text={entry.name}
                                                    onTruncatedHoverStart={handleLabelHover}
                                                    onTruncatedHoverEnd={clearLabelHover}
                                                />
                                            </div>

                                            <div
                                                className="flex shrink-0 items-center gap-1.5 xl:gap-1.5 2xl:gap-2"
                                                onMouseEnter={(event) => handleSegmentHover(entry, index, event)}
                                                onMouseLeave={clearSegmentHover}
                                            >
                                                <span className="w-[34px] shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-500 xl:w-[32px] 2xl:w-[48px] 2xl:text-[13px]">
                                                    {Math.round(percent)}%
                                                </span>

                                                <span className="w-[68px] shrink-0 text-right text-[10px] font-semibold tabular-nums tracking-tight text-slate-800 xl:w-[66px] 2xl:w-[100px] 2xl:text-[13px]">
                                                    {formatCompactAmount(amount, currencyCode)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {tooltipState?.entry && tooltipState?.position && (
                    <div
                        className="pointer-events-none fixed z-[160] min-w-[148px] max-w-[192px] rounded-[8px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.28)]"
                        style={{
                            left: tooltipState.position.left,
                            top: tooltipState.position.top
                        }}
                    >
                        <p
                            className="text-[10px] font-semibold"
                            style={{ color: tooltipState.color }}
                        >
                            {tooltipState.entry.name}
                        </p>
                        <p
                            className="mt-0.5 text-[11px] font-bold"
                            style={{ color: tooltipState.color }}
                        >
                            {formatCurrency(Math.abs(tooltipState.entry.amount), currencyCode)}
                        </p>
                    </div>
                )}

                {labelTooltipState?.text && labelTooltipState?.position && (
                    <div
                        className="pointer-events-none fixed z-[160] max-w-[160px] rounded-[7px] border border-slate-200 bg-white px-2 py-1 shadow-[0_8px_16px_-12px_rgba(15,23,42,0.24)]"
                        style={{
                            left: labelTooltipState.position.left,
                            top: labelTooltipState.position.top
                        }}
                    >
                        <p className="text-[10px] font-semibold text-slate-900">
                            {labelTooltipState.text}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPieChart;
