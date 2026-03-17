import React, { useId } from 'react';
import {
    Area,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
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
    const previous = payload.find((entry) => entry.dataKey === 'previous')?.value ?? 0;

    return (
        <div className="pointer-events-none min-w-[112px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 shadow-lg">
            <div className="mb-1 text-[9px] font-normal uppercase tracking-[0.12em] text-slate-400">
                {formatTooltipLabel(label, payload)}
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: previousColor }} />
                    {previousLabel}
                </span>
                <span className="whitespace-nowrap text-right text-[9px]">{formatValue(previous)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: currentColor }} />
                    {currentLabel}
                </span>
                <span className="whitespace-nowrap text-right text-[9px]">{formatValue(current)}</span>
            </div>
        </div>
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
    const normalizedLabels = labels.length ? labels : Array.from({ length: Math.max(currentValues.length, previousValues.length) }, (_, index) => String(index + 1));
    const normalizedCurrent = normalizedLabels.map((_, index) => Number(currentValues[index] || 0));
    const normalizedPrevious = normalizedLabels.map((_, index) => Number(previousValues[index] || 0));
    const safeValues = [...normalizedCurrent, ...normalizedPrevious].filter((value) => Number.isFinite(value));
    const chartData = normalizedLabels.map((label, index) => ({
        label,
        current: normalizedCurrent[index] || 0,
        previous: normalizedPrevious[index] || 0
    }));

    if (safeValues.length === 0) {
        return (
            <div className="w-[108px] h-[44px] rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-400">
                No data
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1.5">
            <div className="relative w-[108px]">
                <div className="w-[108px] h-[44px] px-1.5 py-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
                            <defs>
                                <linearGradient id={`sparkline-fill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={currentFillColor} stopOpacity={1} />
                                    <stop offset="100%" stopColor={currentFillColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={{ stroke: 'rgba(148, 163, 184, 0.24)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                wrapperStyle={{ outline: 'none', zIndex: 20 }}
                                offset={12}
                                reverseDirection={{ x: false, y: true }}
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
                            <Area
                                type="monotone"
                                dataKey="current"
                                stroke="none"
                                fill={`url(#sparkline-fill-${chartId})`}
                                fillOpacity={1}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="previous"
                                stroke={previousColor}
                                strokeWidth={1.35}
                                dot={false}
                                activeDot={{ r: 3, fill: '#fff', stroke: previousColor, strokeWidth: 1.5 }}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="current"
                                stroke={currentColor}
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 3.4, fill: '#fff', stroke: currentColor, strokeWidth: 1.7 }}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
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
    previousSeriesLabel
}) => {
    return (
        <div
            className="
                bg-white
                p-2.5 lg:p-3
                rounded-xl
                border border-gray-100
                shadow-sm
                hover:shadow-md
                transition-all duration-300
                flex flex-col
                self-start
                dashboard-laptop-metric-card
            "
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-1.5 lg:mb-2 dashboard-laptop-metric-header">
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
                <div className="flex min-h-[72px] flex-col">
                    <div className="h-3" />
                    <span
                        className="
                            text-sm lg:text-base
                            font-bold
                            text-[#445185]
                            leading-tight
                            dashboard-laptop-metric-link
                        "
                    >
                        {secondaryText || linkText}
                    </span>
                    {tertiaryText && (
                        <span className="mt-auto text-[10px] lg:text-xs font-bold leading-tight text-slate-400">
                            {tertiaryText}
                        </span>
                    )}
                </div>

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
            </div>
        </div>
    );
};

export default StatCard;
