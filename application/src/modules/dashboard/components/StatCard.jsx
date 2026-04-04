import React, { useId, useState } from 'react';
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    YAxis,
} from 'recharts';
import { cn } from '../../../utils/cn';

const FISCAL_MONTH_SHORT_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const formatTooltipLabel = (label, payload) => {
    const payloadLabel = payload?.[0]?.payload?.label;
    if (payloadLabel) {
        return String(payloadLabel);
    }

    const numericLabel = Number(label);
    if (Number.isInteger(numericLabel) && numericLabel >= 1 && numericLabel <= 12) {
        return FISCAL_MONTH_SHORT_NAMES[numericLabel - 1];
    }

    return String(label || '');
};

const MetricTooltip = ({
    active,
    payload,
    label,
    formatValue,
    currentColor,
    previousColor,
    currentLabel = 'Current FY',
    previousLabel = 'Previous FY'
}) => {
    if (!active || !payload?.length) return null;

    const current = payload.find((entry) => entry.dataKey === 'current')?.value ?? 0;
    const previousEntry = payload.find((entry) => entry.dataKey === 'previous');
    const previous = previousEntry?.value ?? 0;
    const hasPreviousSeries = payload.some((entry) => entry.dataKey === 'previous');

    return (
        <div className="pointer-events-none min-w-[112px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-left text-slate-600 shadow-lg">
            <div className="mb-1 text-[9px] font-normal uppercase tracking-[0.12em] text-left text-slate-400">
                {formatTooltipLabel(label, payload)}
            </div>
            {hasPreviousSeries && (
                <div className="flex items-center justify-between gap-3 text-left">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                        <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: previousColor }} />
                        {previousLabel}
                    </span>
                    <span className="whitespace-nowrap text-right text-[9px]">{formatValue(previous)}</span>
                </div>
            )}
            {hasPreviousSeries ? (
                <div className="mt-1 flex items-center justify-between gap-3 text-left">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                        <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: currentColor }} />
                        {currentLabel}
                    </span>
                    <span className="whitespace-nowrap text-right text-[9px]">{formatValue(current)}</span>
                </div>
            ) : (
                <div className="text-center text-[9px]">{formatValue(current)}</div>
            )}
        </div>
    );
};

const LastPointDot = ({ cx, cy, index, data, stroke }) => {
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    if (index !== data.length - 1) return null;

    return (
        <g>
            <circle cx={cx} cy={cy} r={3.6} fill={`${stroke}10`} />
            <circle cx={cx} cy={cy} r={2.25} fill={stroke} stroke="#ffffff" strokeWidth={1.25} />
        </g>
    );
};

const MetricSparkline = ({
    currentValues = [],
    previousValues = [],
    labels = [],
    currentColor = '#4f46e5',
    currentFillColor = 'rgba(79, 70, 229, 0.12)',
    previousColor = '#94a3b8',
    formatValue = (value) => String(value),
    currentSeriesLabel = 'Current FY',
    previousSeriesLabel = 'Previous FY'
}) => {
    const chartId = useId().replace(/:/g, '');
    const [isHovered, setIsHovered] = useState(false);
    const normalizedLabels = labels.length ? labels : Array.from({ length: Math.max(currentValues.length, previousValues.length) }, (_, index) => String(index + 1));
    const normalizedCurrent = normalizedLabels.map((_, index) => Number(currentValues[index] || 0));
    const normalizedPrevious = normalizedLabels.map((_, index) => Number(previousValues[index] || 0));
    const hasPreviousSeries = normalizedPrevious.some((value) => Number.isFinite(value) && value !== 0);
    const safeValues = [...normalizedCurrent, ...(hasPreviousSeries ? normalizedPrevious : [])].filter((value) => Number.isFinite(value));
    const minValue = safeValues.length ? Math.min(...safeValues) : 0;
    const maxValue = safeValues.length ? Math.max(...safeValues) : 0;
    const hasFlatDomain = minValue === maxValue;
    const showFlatBaseline = hasFlatDomain && !hasPreviousSeries;
    const domainPadding = hasFlatDomain
        ? (minValue === 0 ? 1 : Math.max(Math.abs(minValue) * 0.2, 1))
        : Math.max((maxValue - minValue) * 0.12, 1);
    const yDomain = hasFlatDomain
        ? [minValue - domainPadding, maxValue + domainPadding]
        : [minValue - domainPadding, maxValue + domainPadding];
    const chartData = normalizedLabels.map((label, index) => {
        const row = {
            label,
            current: normalizedCurrent[index] || 0
        };
        if (hasPreviousSeries) {
            row.previous = normalizedPrevious[index] || 0;
        }
        return row;
    });

    if (safeValues.length === 0) {
        return (
            <div className="w-[108px] h-[44px] rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-400">
                No data
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1.5">
            <div
                className="relative w-[118px]"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {showFlatBaseline && (
                    <div className="pointer-events-none absolute inset-x-[8px] top-1/2 z-[1] -translate-y-1/2">
                        <div
                            className="h-[2px] rounded-full opacity-95"
                            style={{
                                background: currentColor,
                                opacity: 0.82
                            }}
                        />
                    </div>
                )}
                <div className="h-[54px] w-[118px] px-1.5 py-1">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={chartData} margin={{ top: 7, right: 4, bottom: 4, left: 4 }}>
                            <defs>
                                <linearGradient id={`sparkline-fill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={currentFillColor} stopOpacity={0.09} />
                                    <stop offset="55%" stopColor={currentFillColor} stopOpacity={0.035} />
                                    <stop offset="100%" stopColor={currentFillColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={{ stroke: 'rgba(148, 163, 184, 0.24)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                wrapperStyle={{ outline: 'none', zIndex: 20 }}
                                offset={8}
                                reverseDirection={{ x: true, y: true }}
                                allowEscapeViewBox={{ x: true, y: true }}
                                content={
                                    <MetricTooltip
                                        formatValue={formatValue}
                                        currentColor={currentColor}
                                        previousColor={previousColor}
                                        currentLabel={currentSeriesLabel}
                                        previousLabel={previousSeriesLabel}
                                    />
                                }
                                animationDuration={120}
                            />
                            <YAxis hide domain={yDomain} />
                            {!showFlatBaseline && (
                                <Area
                                    type="natural"
                                    dataKey="current"
                                    stroke={currentColor}
                                    strokeWidth={1.85}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill={`url(#sparkline-fill-${chartId})`}
                                    fillOpacity={1}
                                    dot={false}
                                    activeDot={false}
                                    connectNulls
                                    isAnimationActive
                                    animationDuration={950}
                                    animationEasing="ease-in-out"
                                />
                            )}
                            {hasPreviousSeries && (
                                <Area
                                    type="natural"
                                    dataKey="previous"
                                    stroke={previousColor}
                                    strokeWidth={1.45}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeOpacity={0.24}
                                    fill="none"
                                    fillOpacity={0}
                                    dot={false}
                                    activeDot={{ r: 3, fill: '#fff', stroke: previousColor, strokeWidth: 1.25 }}
                                    connectNulls
                                    isAnimationActive
                                    animationDuration={900}
                                    animationEasing="ease-in-out"
                                />
                            )}
                            {!showFlatBaseline && (
                                <Area
                                    type="natural"
                                    dataKey="current"
                                    stroke={currentColor}
                                    strokeWidth={1.85}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeOpacity={isHovered ? 0.92 : 0.82}
                                    fill="none"
                                    fillOpacity={0}
                                    dot={(dotProps) => (
                                        <LastPointDot {...dotProps} data={chartData} stroke={currentColor} />
                                    )}
                                    activeDot={{ r: 3.1, fill: currentColor, stroke: '#fff', strokeWidth: 1.3 }}
                                    connectNulls
                                    isAnimationActive
                                    animationDuration={950}
                                    animationEasing="ease-in-out"
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({
    title,
    amount,
    trend,
    trendType = 'up',
    linkText = 'View net earnings',
    secondaryText,
    tertiaryText,
    comparisonLabels = [],
    currentSeries = [],
    previousSeries = [],
    chartColor = '#4f46e5',
    chartFillColor = 'rgba(79, 70, 229, 0.12)',
    previousChartColor = '#94a3b8',
    formatValue,
    currentSeriesLabel,
    previousSeriesLabel,
    tertiaryTone = 'default',
    compact = false
}) => {
    const hasChartData = currentSeries.length > 0 || previousSeries.length > 0;
    const arrowMatch = typeof tertiaryText === 'string' ? tertiaryText.match(/(↗|↘)$/) : null;
    const tertiaryArrow = arrowMatch?.[1] || '';
    const tertiaryBaseText = tertiaryArrow ? tertiaryText.slice(0, -tertiaryArrow.length).trimEnd() : tertiaryText;
    const tertiaryToneClassName = tertiaryTone === 'positive'
        ? 'text-[#16a34a]'
        : tertiaryTone === 'negative'
            ? 'text-[#dc2626]'
            : tertiaryTone === 'neutral'
                ? 'text-slate-500'
                : 'text-slate-500';
    const tertiaryArrowClassName = tertiaryTone === 'positive'
        ? 'text-[#16a34a]'
        : tertiaryTone === 'negative'
            ? 'text-[#dc2626]'
            : 'text-slate-400';

    return (
        <div
            className="
                bg-white
                p-2.5 lg:px-3 lg:py-2.5
                rounded-xl
                border border-gray-100
                shadow-sm
                hover:-translate-y-0.5
                hover:border-slate-200
                hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]
                transition-all duration-300
                flex flex-col
                self-start
                dashboard-laptop-metric-card
            "
            style={compact ? { paddingTop: '0.625rem', paddingBottom: '0.625rem' } : undefined}
        >
            {/* Header */}
            <div
                className="flex justify-between items-start mb-1.5 lg:mb-1.5 dashboard-laptop-metric-header"
                style={compact ? { marginBottom: '0.25rem' } : undefined}
            >
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide dashboard-laptop-metric-title">
                    {title}
                </span>

                {trend && (
                    <div
                        className={cn(
                            "flex items-center gap-1 text-sm font-semibold",
                            trendType === 'up'
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                        )}
                    >
                        <span className="leading-none">
                            {trendType === 'up' ? '↗' : '↘'}
                        </span>
                        {trend !== '-' && <span>{trend}</span>}
                    </div>
                )}
            </div>

            <div className="flex flex-1 items-stretch justify-between gap-3">
                <div
                    className="flex min-h-[66px] flex-col"
                    style={compact ? { minHeight: 'unset' } : undefined}
                >
                    <div
                        style={compact ? { height: '0.125rem' } : undefined}
                        className={compact ? '' : 'h-2.5 dashboard-laptop-metric-spacer'}
                    />
                    <span
                        className="
                            text-sm lg:text-base
                            font-bold
                            text-black
                            leading-tight
                            dashboard-laptop-metric-amount
                        "
                    >
                        {amount || secondaryText || linkText}
                    </span>
                    {tertiaryText && (
                        <span className={cn("mt-auto text-[10px] lg:text-xs font-bold leading-tight dashboard-laptop-metric-change", tertiaryToneClassName)}>
                            {tertiaryBaseText}
                            {tertiaryArrow && (
                                <span className={cn("ml-1", tertiaryArrowClassName)}>
                                    {tertiaryArrow}
                                </span>
                            )}
                        </span>
                    )}
                </div>

                {hasChartData && (
                    <div className="flex items-end">
                        <MetricSparkline
                            labels={comparisonLabels}
                            currentValues={currentSeries}
                            previousValues={previousSeries}
                            currentColor={chartColor}
                            currentFillColor={chartFillColor}
                            previousColor={previousChartColor}
                            formatValue={formatValue}
                            currentSeriesLabel={currentSeriesLabel}
                            previousSeriesLabel={previousSeriesLabel}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
