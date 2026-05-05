import React, { useId, useState } from 'react';
import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    YAxis,
} from 'recharts';
import { cn } from '../../../utils/cn';
import { AmountTooltip } from '../../../components/common/AmountTooltip';

const formatTooltipLabel = (label, payload) => {
    const payloadLabel = payload?.[0]?.payload?.label;
    return String(payloadLabel || label || '');
};

const MetricTooltip = ({
    active,
    payload,
    label,
    formatValue,
    currentColor,
    previousColor,
    currentLabel = 'Current FY',
    previousLabel = 'Previous FY',
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    totalNodes,
    datePreset
}) => {
    if (!active || !payload?.length) return null;

    const current = payload.find((entry) => entry.dataKey === 'current')?.value ?? 0;
    const previousEntry = payload.find((entry) => entry.dataKey === 'previous');
    const previous = previousEntry?.value ?? 0;
    const hasPreviousSeries = payload.some((entry) => entry.dataKey === 'previous');

    const hoverLabel = formatTooltipLabel(label, payload);
    const nodeIndex = payload[0]?.payload?.originalIndex ?? 0;

    const getExactDateLabel = (startDateStr, endDateStr, total, idx, isDaily) => {
        if (!startDateStr || !endDateStr || !total) return '';
        try {
            const start = new Date(startDateStr).getTime();
            const end = new Date(endDateStr).getTime();
            const interval = (end - start) / Math.max(1, total - 1);
            const nodeTime = start + (interval * idx);
            if (isDaily) {
                return new Date(nodeTime).toLocaleDateString('default', { day: 'numeric', month: 'short' });
            }
            return new Date(nodeTime).toLocaleDateString('default', { month: 'short' });
        } catch {
            return '';
        }
    };

    let resolvedCurrentLabel = hoverLabel || currentLabel;
    let resolvedPreviousLabel = hoverLabel ? `Prev ${hoverLabel}` : previousLabel;

    const isWeekLabel = /^[Ww(eek)]*\s*[-_]*\d{1,2}$/i.test(hoverLabel);
    const isMonthPreset = datePreset && typeof datePreset === 'string' && datePreset.includes('month');
    const isSingleMonth = datePreset === 'last_month';

    if ((isWeekLabel || isMonthPreset) && totalNodes && currentStart && currentEnd) {
        const curLabel = getExactDateLabel(currentStart, currentEnd, totalNodes, nodeIndex, isSingleMonth);

        if (curLabel) {
            resolvedCurrentLabel = curLabel;
            if (hasPreviousSeries) {
                const prevLabel = (previousStart && previousEnd)
                    ? getExactDateLabel(previousStart, previousEnd, totalNodes, nodeIndex, isSingleMonth)
                    : `Prev ${curLabel}`;
                resolvedPreviousLabel = prevLabel || `Prev ${curLabel}`;
            }
        }
    } else if (hoverLabel) {
        if (/\b(20\d{2})\b/.test(hoverLabel)) {
            resolvedCurrentLabel = hoverLabel;
            resolvedPreviousLabel = hoverLabel.replace(/\b(20\d{2})\b/g, m => String(Number(m) - 1));
        } else if (/'(\d{2})\b/.test(hoverLabel)) {
            resolvedCurrentLabel = hoverLabel;
            resolvedPreviousLabel = hoverLabel.replace(/'(\d{2})\b/g, (m, p1) => `'${String(Number(p1) - 1).padStart(2, '0')}`);
        } else if (/^\d{1,2}$/.test(hoverLabel)) {
            const curMonth = typeof currentLabel === 'string' ? currentLabel.split(' ')[0] : '';
            const prevMonth = typeof previousLabel === 'string' ? previousLabel.split(' ')[0] : '';
            resolvedCurrentLabel = curMonth ? `${hoverLabel} ${curMonth}` : hoverLabel;
            resolvedPreviousLabel = prevMonth ? `${hoverLabel} ${prevMonth}` : `Prev ${hoverLabel}`;
        } else {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const curStr = typeof currentLabel === 'string' ? currentLabel.split(' ')[0] : '';
            const prevStr = typeof previousLabel === 'string' ? previousLabel.split(' ')[0] : '';
            const cIdx = months.findIndex(m => m.toLowerCase() === curStr.toLowerCase());
            const pIdx = months.findIndex(m => m.toLowerCase() === prevStr.toLowerCase());

            let monthOffset = 1;
            if (cIdx !== -1 && pIdx !== -1) {
                let diff = cIdx - pIdx;
                if (diff < 0) diff += 12;
                monthOffset = diff === 0 ? 12 : diff;
            }

            let matchedMonth = false;
            let tempPrevLabel = hoverLabel;

            months.forEach((m, idx) => {
                const regex = new RegExp(`\\b${m}\\b`, 'i');
                if (regex.test(tempPrevLabel) && !matchedMonth) {
                    let targetIdx = idx - monthOffset;
                    while (targetIdx < 0) targetIdx += 12;
                    const prevIdx = targetIdx % 12;
                    let prevName = months[prevIdx];
                    const matchStr = tempPrevLabel.match(regex)[0];
                    if (matchStr === matchStr.toUpperCase()) prevName = prevName.toUpperCase();
                    else if (matchStr === matchStr.toLowerCase()) prevName = prevName.toLowerCase();
                    tempPrevLabel = tempPrevLabel.replace(regex, prevName);
                    matchedMonth = true;
                }
            });

            if (matchedMonth) resolvedPreviousLabel = tempPrevLabel;
            else {
                resolvedCurrentLabel = hoverLabel;
                resolvedPreviousLabel = `Prev ${hoverLabel}`;
            }
        }
    }

    return (
        <div className="pointer-events-none min-w-[112px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-medium text-left text-slate-600 shadow-lg">
            {hasPreviousSeries && (
                <div className="mb-1.5 flex items-center justify-between gap-3 text-left">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-left">
                        <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: previousColor }} />
                        <span className="capitalize">{resolvedPreviousLabel}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold text-right text-[10px]">{formatValue(previous)}</span>
                </div>
            )}
            <div className="flex items-center justify-between gap-3 text-left">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-left">
                    <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: currentColor }} />
                    <span className="font-semibold text-black capitalize">{resolvedCurrentLabel}</span>
                </span>
                <span className="whitespace-nowrap font-bold text-black text-right text-[10px]">{formatValue(current)}</span>
            </div>
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
    previousSeriesLabel = 'Previous FY',
    currentStartDate,
    currentEndDate,
    previousStartDate,
    previousEndDate,
    datePreset
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const normalizedLabels = labels.length ? labels : Array.from({ length: Math.max(currentValues.length, previousValues.length) }, (_, index) => String(index + 1));
    const normalizedCurrent = normalizedLabels.map((_, index) => Number(currentValues[index] || 0));
    const normalizedPrevious = normalizedLabels.map((_, index) => Number(previousValues[index] || 0));
    const hasPreviousSeries = previousValues.length > 0;
    const safeValues = [...normalizedCurrent, ...(hasPreviousSeries ? normalizedPrevious : [])].filter((value) => Number.isFinite(value));
    const minValue = safeValues.length ? Math.min(...safeValues) : 0;
    const maxValue = safeValues.length ? Math.max(...safeValues) : 0;
    const hasFlatDomain = minValue === maxValue;
    const domainPadding = hasFlatDomain
        ? (minValue === 0 ? 1 : Math.max(Math.abs(minValue) * 0.2, 1))
        : Math.max((maxValue - minValue) * 0.12, 1);
    const yDomain = hasFlatDomain
        ? [minValue - domainPadding, maxValue + domainPadding]
        : [minValue - domainPadding, maxValue + domainPadding];
    const chartData = normalizedLabels.map((label, index) => {
        const row = {
            label,
            originalIndex: index,
            current: normalizedCurrent[index] || 0
        };
        if (hasPreviousSeries) {
            row.previous = normalizedPrevious[index] || 0;
        }
        return row;
    });

    if (safeValues.length === 0) {
        return (
            <div className="w-[130px] h-[72px] rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-400">
                No data
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1.5">
            <div
                className="relative w-[130px]"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="h-[72px] w-[130px] px-1.5 py-1">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={chartData} margin={{ top: 7, right: 4, bottom: 4, left: 4 }}>
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
                                        currentStart={currentStartDate}
                                        currentEnd={currentEndDate}
                                        previousStart={previousStartDate}
                                        previousEnd={previousEndDate}
                                        totalNodes={normalizedLabels.length}
                                        datePreset={datePreset}
                                    />
                                }
                                animationDuration={120}
                            />
                            <YAxis hide domain={yDomain} />
                            {hasPreviousSeries && (
                                <Line
                                    type="natural"
                                    dataKey="previous"
                                    stroke={previousColor}
                                    strokeWidth={1.45}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeOpacity={0.4}
                                    dot={false}
                                    activeDot={{ r: 3, fill: '#fff', stroke: previousColor, strokeWidth: 1.25 }}
                                    connectNulls
                                    isAnimationActive
                                    animationDuration={900}
                                    animationEasing="ease-in-out"
                                />
                            )}
                            <Line
                                type="natural"
                                dataKey="current"
                                stroke={currentColor}
                                strokeWidth={1.85}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeOpacity={isHovered ? 0.92 : 0.82}
                                dot={(dotProps) => (
                                    <LastPointDot {...dotProps} data={chartData} stroke={currentColor} />
                                )}
                                activeDot={{ r: 3.1, fill: currentColor, stroke: '#fff', strokeWidth: 1.3 }}
                                connectNulls
                                isAnimationActive
                                animationDuration={950}
                                animationEasing="ease-in-out"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({
    title,
    amount,
    fullAmount,
    previousFullAmount,
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
    previousChartColor = '#64748b',
    formatValue,
    currentSeriesLabel,
    previousSeriesLabel,
    currentStartDate,
    currentEndDate,
    previousStartDate,
    previousEndDate,
    datePreset,
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
                px-5 py-4
                rounded-lg
                border border-slate-200
                shadow-sm
                transition-all duration-300
                hover:shadow-md
                flex flex-col
                self-start
                dashboard-laptop-metric-card
                cursor-pointer
            "
            style={compact ? { paddingTop: '0.625rem', paddingBottom: '0.625rem' } : undefined}
        >
            {/* Header */}
            <div
                className="flex justify-between items-start mb-1.5 lg:mb-1.5 dashboard-laptop-metric-header"
                style={compact ? { marginBottom: '0.25rem' } : undefined}
            >
                <span className="text-[14px] font-medium text-slate-900 tracking-tight dashboard-laptop-metric-title">
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
                    <AmountTooltip
                        amount={amount || secondaryText || linkText}
                        fullAmount={fullAmount}
                        textClassName="text-sm lg:text-base font-bold text-black leading-tight dashboard-laptop-metric-amount"
                        position="top"
                        align="left"
                    />
                    {tertiaryText && (
                        <div className="group/tertiary relative mt-auto flex w-fit">
                            <span className={cn("text-[10px] lg:text-xs font-bold leading-tight dashboard-laptop-metric-change", tertiaryToneClassName)}>
                                {tertiaryBaseText}
                                {tertiaryArrow && (
                                    <span className={cn("ml-1", tertiaryArrowClassName)}>
                                        {tertiaryArrow}
                                    </span>
                                )}
                            </span>

                            {previousFullAmount && (
                                <div className="pointer-events-none absolute left-0 bottom-full mb-2 opacity-0 transition-opacity duration-200 group-hover/tertiary:opacity-100 z-[60]">
                                    <div className="flex items-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-lg gap-1.5">
                                        <span className="text-slate-500 font-medium">{previousSeriesLabel || 'Prev'}:</span>
                                        <span>{previousFullAmount}</span>
                                    </div>
                                </div>
                            )}
                        </div>
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
                            currentStartDate={currentStartDate}
                            currentEndDate={currentEndDate}
                            previousStartDate={previousStartDate}
                            previousEndDate={previousEndDate}
                            datePreset={datePreset}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
