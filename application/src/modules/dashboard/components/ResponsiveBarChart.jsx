import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { cn } from '../../../utils/cn';

const DEFAULT_HEIGHT_VH = 33;
const DEFAULT_MIN_HEIGHT = 250;
const DEFAULT_MAX_HEIGHT = 300;
const DEFAULT_POSITIVE_COLOR = '#0f766e';
const DEFAULT_NEGATIVE_COLOR = '#dc2626';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
});

const truncateLabel = (value, maxChars) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;
    if (maxChars <= 3) return normalized.slice(0, Math.max(maxChars, 1));
    return `${normalized.slice(0, maxChars - 3)}...`;
};

const formatCompactValue = (value) => {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return '0';
    return compactNumberFormatter.format(numericValue);
};

const BarTooltip = ({ active, payload, label, valueFormatter }) => {
    if (!active || !payload?.length) return null;

    const point = payload[0]?.payload;
    const value = payload[0]?.value ?? point?.value ?? 0;
    const fullLabel = point?.fullLabel || label || '';
    const indicatorColor = payload[0]?.fill || point?.fill || DEFAULT_POSITIVE_COLOR;

    return (
        <div className="pointer-events-none min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
            <div className="mb-1 text-[10px] font-semibold text-slate-500">{fullLabel}</div>
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
                    Value
                </span>
                <span className="text-[11px] font-bold text-slate-800">{valueFormatter(value)}</span>
            </div>
        </div>
    );
};

const AxisTick = ({
    x = 0,
    y = 0,
    payload,
    maxChars,
    fontSize,
    anchor = 'middle',
    dy = 0,
    dx = 0
}) => {
    const fullLabel = String(payload?.value || '');
    const truncated = truncateLabel(fullLabel, maxChars);

    return (
        <g transform={`translate(${x},${y})`}>
            <title>{fullLabel}</title>
            <text
                x={dx}
                y={dy}
                fill="#64748b"
                fontSize={fontSize}
                fontWeight={600}
                textAnchor={anchor}
            >
                {truncated}
            </text>
        </g>
    );
};

const getResponsiveMetrics = ({ width, height, count, orientation }) => {
    const safeWidth = Math.max(width || 320, 320);
    const safeHeight = Math.max(height || 260, 240);
    const safeCount = Math.max(count || 1, 1);
    const isVertical = orientation === 'vertical';
    const isShortCard = safeHeight <= 268;
    const isNarrowCard = safeWidth <= 360;

    if (isVertical) {
        const availableWidth = safeWidth - 24;
        const slotWidth = availableWidth / safeCount;
        const barSize = clamp(Math.floor(slotWidth * 0.52), 16, isNarrowCard ? 26 : 34);
        const maxLabelChars = clamp(Math.floor(slotWidth / 7.4), 4, isNarrowCard ? 7 : 11);

        return {
            chartLayout: 'horizontal',
            axisFontSize: isShortCard ? 10 : 11,
            categoryAxisHeight: isShortCard ? 28 : 34,
            categoryAxisWidth: 0,
            categoryGap: clamp(Math.floor(slotWidth * 0.22), 6, 20),
            barGap: clamp(Math.floor(slotWidth * 0.06), 2, 8),
            barSize,
            maxLabelChars,
            minTickGap: clamp(Math.floor(slotWidth * 0.18), 6, 18),
            margin: {
                top: isShortCard ? 8 : 12,
                right: isNarrowCard ? 6 : 10,
                bottom: isShortCard ? 12 : 16,
                left: 2
            },
            tickAnchor: 'middle',
            tickDx: 0,
            tickDy: 16
        };
    }

    const availableHeight = safeHeight - 28;
    const slotHeight = availableHeight / safeCount;
    const labelAxisWidth = clamp(Math.floor(safeWidth * 0.26), 92, isNarrowCard ? 118 : 136);
    const barSize = clamp(Math.floor(slotHeight * 0.58), 12, isShortCard ? 18 : 22);
    const maxLabelChars = clamp(Math.floor(labelAxisWidth / 7.1), 8, 18);

    return {
        chartLayout: 'vertical',
        axisFontSize: isShortCard ? 10 : 11,
        categoryAxisHeight: 0,
        categoryAxisWidth: labelAxisWidth,
        categoryGap: clamp(Math.floor(slotHeight * 0.24), 4, 14),
        barGap: clamp(Math.floor(slotHeight * 0.08), 2, 6),
        barSize,
        maxLabelChars,
        minTickGap: 6,
        margin: {
            top: isShortCard ? 8 : 10,
            right: isNarrowCard ? 10 : 18,
            bottom: 6,
            left: 2
        },
        tickAnchor: 'end',
        tickDx: -6,
        tickDy: 4
    };
};

const useObservedSize = () => {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const node = containerRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return undefined;

        let frameId = 0;
        const observer = new ResizeObserver((entries) => {
            const nextEntry = entries[0];
            if (!nextEntry) return;

            const nextWidth = Math.round(nextEntry.contentRect.width);
            const nextHeight = Math.round(nextEntry.contentRect.height);

            if (!nextWidth || !nextHeight) return;

            cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(() => {
                setSize((previous) => {
                    if (previous.width === nextWidth && previous.height === nextHeight) {
                        return previous;
                    }

                    return {
                        width: nextWidth,
                        height: nextHeight
                    };
                });
            });
        });

        observer.observe(node);

        return () => {
            cancelAnimationFrame(frameId);
            observer.disconnect();
        };
    }, []);

    return [containerRef, size];
};

const ResponsiveBarChart = ({
    data = [],
    orientation = 'vertical',
    labelKey = 'label',
    valueKey = 'value',
    className,
    chartClassName,
    emptyMessage = 'No data available',
    positiveColor = DEFAULT_POSITIVE_COLOR,
    negativeColor = DEFAULT_NEGATIVE_COLOR,
    heightVh = DEFAULT_HEIGHT_VH,
    minHeight = DEFAULT_MIN_HEIGHT,
    maxHeight = DEFAULT_MAX_HEIGHT,
    valueFormatter = (value) => formatCompactValue(value),
    axisValueFormatter = (value) => formatCompactValue(value),
    showGrid = true
}) => {
    const normalizedOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    const [containerRef, size] = useObservedSize();

    const chartData = useMemo(() => (
        data
            .map((entry, index) => {
                const rawValue = Number(entry?.[valueKey] ?? 0);
                const fullLabel = String(entry?.[labelKey] ?? '');
                return {
                    ...entry,
                    id: entry?.id ?? `${fullLabel}-${index}`,
                    value: Number.isFinite(rawValue) ? rawValue : 0,
                    label: fullLabel,
                    fullLabel,
                    fill: entry?.color || (rawValue < 0 ? negativeColor : positiveColor)
                };
            })
    ), [data, labelKey, valueKey, positiveColor, negativeColor]);

    const metrics = useMemo(() => (
        getResponsiveMetrics({
            width: size.width,
            height: size.height,
            count: chartData.length,
            orientation: normalizedOrientation
        })
    ), [chartData.length, normalizedOrientation, size.height, size.width]);

    const hasNegativeValue = chartData.some((entry) => entry.value < 0);

    return (
        <div
            ref={containerRef}
            className={cn(
                'w-full min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm',
                className
            )}
            style={{
                height: `clamp(${minHeight}px, ${heightVh}vh, ${maxHeight}px)`
            }}
        >
            <div className={cn('h-full w-full p-3 sm:p-4', chartClassName)}>
                {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 text-[12px] font-semibold text-slate-400">
                        {emptyMessage}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart
                            data={chartData}
                            layout={metrics.chartLayout}
                            margin={metrics.margin}
                            barCategoryGap={metrics.categoryGap}
                            barGap={metrics.barGap}
                        >
                            {showGrid && (
                                <CartesianGrid
                                    stroke="rgba(148, 163, 184, 0.16)"
                                    strokeDasharray="3 3"
                                    vertical={normalizedOrientation === 'horizontal'}
                                    horizontal={normalizedOrientation === 'vertical'}
                                />
                            )}
                            {normalizedOrientation === 'vertical' ? (
                                <>
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        interval={chartData.length > 6 ? 'preserveStartEnd' : 0}
                                        height={metrics.categoryAxisHeight}
                                        minTickGap={metrics.minTickGap}
                                        tick={(
                                            <AxisTick
                                                maxChars={metrics.maxLabelChars}
                                                fontSize={metrics.axisFontSize}
                                                anchor={metrics.tickAnchor}
                                                dy={metrics.tickDy}
                                            />
                                        )}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={50}
                                        tick={{ fill: '#64748b', fontSize: metrics.axisFontSize, fontWeight: 600 }}
                                        tickFormatter={axisValueFormatter}
                                    />
                                    {hasNegativeValue && (
                                        <ReferenceLine y={0} stroke="rgba(100, 116, 139, 0.24)" strokeWidth={1} />
                                    )}
                                </>
                            ) : (
                                <>
                                    <XAxis
                                        type="number"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#64748b', fontSize: metrics.axisFontSize, fontWeight: 600 }}
                                        tickFormatter={axisValueFormatter}
                                        tickCount={4}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        width={metrics.categoryAxisWidth}
                                        tick={(
                                            <AxisTick
                                                maxChars={metrics.maxLabelChars}
                                                fontSize={metrics.axisFontSize}
                                                anchor={metrics.tickAnchor}
                                                dx={metrics.tickDx}
                                                dy={metrics.tickDy}
                                            />
                                        )}
                                    />
                                    {hasNegativeValue && (
                                        <ReferenceLine x={0} stroke="rgba(100, 116, 139, 0.24)" strokeWidth={1} />
                                    )}
                                </>
                            )}
                            <Tooltip
                                cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }}
                                wrapperStyle={{ outline: 'none', zIndex: 20 }}
                                content={<BarTooltip valueFormatter={valueFormatter} />}
                            />
                            <Bar
                                dataKey="value"
                                radius={6}
                                maxBarSize={metrics.barSize}
                                isAnimationActive
                                animationDuration={260}
                                animationEasing="ease-out"
                            >
                                {chartData.map((entry) => (
                                    <Cell key={entry.id} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default ResponsiveBarChart;
