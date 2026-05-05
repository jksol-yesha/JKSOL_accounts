import React, { Suspense, lazy, useEffect, useState } from 'react';
import StatCard from './components/StatCard';
import DashboardSkeleton from './components/DashboardSkeleton';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import BranchSelector from '../../components/layout/BranchSelector';
import CurrencySelector from '../../components/layout/CurrencySelector';
import DateRangePicker from '../../components/common/DateRangePicker';
import { generateDatePresets } from '../../utils/constants';
import { formatCompactAmount } from '../../utils/formatters';

const formatSpecificPeriod = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    try {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
        const startYear = start.getFullYear();
        const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
        const endYear = end.getFullYear();

        if (startMonth === endMonth && startYear === endYear) {
            return `${startMonth} ${startYear}`;
        }
        if (startYear === endYear) {
            return `${startMonth} - ${endMonth} ${startYear}`;
        }
        return `${startMonth} '${String(startYear).slice(2)} - ${endMonth} '${String(endYear).slice(2)}`;
    } catch {
        return '';
    }
};

const CategoryRankings = lazy(() => import('./components/CategoryRankings'));
const CashFlowCard = lazy(() => import('./components/CashFlowCard'));
const DashboardPieChart = lazy(() => import('./components/DashboardPieChart'));

const EMPTY_STATS = {
    openingBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalInvestment: 0,
    investmentBalance: 0,
    closingBalance: 0
};

const EMPTY_TRENDS = {
    labels: [],
    current: {
        metrics: {
            netProfit: [],
            totalIncome: [],
            totalExpense: [],
            totalInvestment: [],
            investmentBalance: []
        }
    },
    previous: {
        metrics: {
            netProfit: [],
            totalIncome: [],
            totalExpense: [],
            totalInvestment: [],
            investmentBalance: []
        }
    }
};

const METRIC_LINE_COLOR = '#6b7280';
const METRIC_FILL_COLOR = 'rgba(107, 114, 128, 0.14)';

const DashboardPanelFallback = ({ className = '' }) => (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
        <div className="h-full min-h-[280px] animate-pulse bg-gradient-to-br from-slate-100 via-white to-slate-100" />
    </div>
);

const DashboardPanelSuspense = ({ children, fallbackClassName = '' }) => (
    <Suspense fallback={<DashboardPanelFallback className={fallbackClassName} />}>
        {children}
    </Suspense>
);

const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

    // Timezone safe YYYY-MM-DD extraction
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculatePreviousRange = (startDate, endDate, preset) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // For specific month presets, shift by calendar months
    if (preset === 'last_month' || preset === 'current' || (preset && preset.includes('months'))) {
        let months = 1;
        if (preset === 'current') months = 12;
        else if (preset.includes('months')) months = parseInt(preset.replace(/\D/g, '')) || 1;

        const prevStart = new Date(start);
        prevStart.setMonth(prevStart.getMonth() - months);

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);

        return { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) };
    }

    // Default: Shift back by the same number of days
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    return { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) };
};

const getMetricSnapshot = (summary = EMPTY_STATS) => {
    const opening = Number(summary.openingBalance || 0);
    const closing = Number(summary.closingBalance || 0);
    const income = Number(summary.totalIncome || 0);
    const expense = Number(summary.totalExpense || 0);
    const investment = Number(summary.totalInvestment || 0);
    const investmentBalance = Number((summary.investmentBalance ?? summary.totalInvestment) || 0);

    return {
        openingBalance: opening,
        closingBalance: closing,
        netProfit: income - expense,
        totalIncome: income,
        totalExpense: expense,
        totalInvestment: investment,
        investmentBalance
    };
};

const getPercentageChange = (currentYearValue, previousYearValue) => {
    const current = Number(currentYearValue || 0);
    const previous = Number(previousYearValue || 0);

    if (previous === 0) {
        if (current > 0) return 100;
        if (current < 0) return -100;
        return 0;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
};

const formatPercentageIndicator = (currentYearValue, previousYearValue) => {
    const change = getPercentageChange(currentYearValue, previousYearValue);

    if (change > 0) {
        return {
            text: `+${change.toFixed(1)}% ↗`,
            tone: 'positive'
        };
    }

    if (change < 0) {
        return {
            text: `${change.toFixed(1)}% ↘`,
            tone: 'negative'
        };
    }

    return {
        text: `${change.toFixed(1)}%`,
        tone: 'neutral'
    };
};

const formatLocalDateOnly = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toDateOnlyString = (value) => {
    if (!value) return '';
    if (value instanceof Date) return formatLocalDateOnly(value);

    const rawValue = String(value).trim();
    if (!rawValue) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) {
        return formatLocalDateOnly(parsedDate);
    }

    return rawValue.slice(0, 10);
};

const normalizeDateRange = (range) => {
    if (!range) return null;

    const startDate = toDateOnlyString(range.startDate);
    const endDate = toDateOnlyString(range.endDate) || startDate;

    if (!startDate) return null;

    return {
        startDate,
        endDate,
        preset: range.preset || 'custom'
    };
};

const areDateRangesEqual = (left, right) => {
    const normalizedLeft = normalizeDateRange(left);
    const normalizedRight = normalizeDateRange(right);

    if (!normalizedLeft && !normalizedRight) return true;
    if (!normalizedLeft || !normalizedRight) return false;

    return normalizedLeft.startDate === normalizedRight.startDate
        && normalizedLeft.endDate === normalizedRight.endDate
        && normalizedLeft.preset === normalizedRight.preset;
};

const Dashboard = () => {
    const { selectedBranch, selectedBranchIds, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, financialYears, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { preferences, formatCurrency, updatePreferences } = usePreferences();

    const [stats, setStats] = useState(EMPTY_STATS);
    const [previousStats, setPreviousStats] = useState(EMPTY_STATS);
    const [trends, setTrends] = useState(EMPTY_TRENDS);
    const [rankingCategories, setRankingCategories] = useState([]);
    const [rankingLoading, setRankingLoading] = useState(false);
    const [hasFetchedRankings, setHasFetchedRankings] = useState(false);
    const [isDashboardLoading, setIsDashboardLoading] = useState(false);
    const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState(0);
    const [dashboardFilters, setDashboardFilters] = useState({
        dateRange: null,
        currency: preferences.currency || 'INR'
    });

    const branchCachePart = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
        ? selectedBranchIds.map(Number).sort((a, b) => a - b).join(',')
        : String(selectedBranch?.id || 'branch');
    const statsCacheKey = `dashboard:summary:v11:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}:${branchCachePart}:${dashboardFilters.currency}:${formatDate(dashboardFilters.dateRange?.startDate) || 'all'}:${formatDate(dashboardFilters.dateRange?.endDate) || 'all'}`;

    const sortedFinancialYears = [...(financialYears || [])].sort((a, b) => {
        const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
        return aDate - bDate;
    });
    const selectedYearIndex = sortedFinancialYears.findIndex((year) => Number(year.id) === Number(selectedYear?.id));
    const previousYear = selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;

    const currentRangeStart = dashboardFilters.dateRange?.startDate;
    const currentRangeEnd = dashboardFilters.dateRange?.endDate;
    const prevRange = calculatePreviousRange(
        currentRangeStart,
        currentRangeEnd,
        dashboardFilters.dateRange?.preset
    );

    const resolvedCurrentStart = formatDate(currentRangeStart || selectedYear?.startDate);
    const resolvedCurrentEnd = formatDate(currentRangeEnd || selectedYear?.endDate);
    const resolvedPrevStart = formatDate(prevRange?.startDate || previousYear?.startDate);
    const resolvedPrevEnd = formatDate(prevRange?.endDate || previousYear?.endDate);

    const currentSeriesLabel = currentRangeStart && currentRangeEnd
        ? formatSpecificPeriod(currentRangeStart, currentRangeEnd)
        : (selectedYear?.name || 'Current FY');

    const previousSeriesLabel = prevRange?.startDate && prevRange?.endDate
        ? formatSpecificPeriod(prevRange.startDate, prevRange.endDate)
        : (previousYear?.name || 'Previous FY');

    const dashboardContextReady = Boolean(
        !branchLoading &&
        !yearLoading &&
        selectedOrg?.id &&
        selectedYear?.id &&
        (
            user?.role === 'member' ||
            user?.role === 'owner' ||
            selectedBranch?.id ||
            (Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0)
        )
    );


    const datePresets = generateDatePresets(selectedYear, previousYear);

    const updateDashboardDateRange = (range, { forceRefresh = false } = {}) => {
        const normalizedRange = normalizeDateRange(range);
        if (!normalizedRange) return;

        setDashboardFilters((previous) => {
            if (areDateRangesEqual(previous.dateRange, normalizedRange) && !forceRefresh) {
                return previous;
            }

            return {
                ...previous,
                dateRange: normalizedRange
            };
        });

        if (forceRefresh) {
            setDashboardRefreshNonce((previous) => previous + 1);
        }
    };

    // Sync dashboard filters with global preference currency
    useEffect(() => {
        if (preferences.currency && preferences.currency !== dashboardFilters.currency) {
            setDashboardFilters(prev => ({ ...prev, currency: preferences.currency }));
        }
    }, [preferences.currency]);

    // Default DateRangePicker to Current FY as requested
    useEffect(() => {
        if (selectedYear?.startDate && !dashboardFilters.dateRange) {
            setDashboardFilters(prev => ({
                ...prev,
                dateRange: normalizeDateRange({
                    startDate: selectedYear.startDate,
                    endDate: selectedYear.endDate || new Date().toISOString().split('T')[0],
                    preset: 'current'
                })
            }));
        }
    }, [selectedYear, dashboardFilters.dateRange]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchDashboardData = async () => {
            if (!dashboardContextReady) return;
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;

                const prevRange = calculatePreviousRange(
                    dashboardFilters.dateRange?.startDate,
                    dashboardFilters.dateRange?.endDate,
                    dashboardFilters.dateRange?.preset
                );

                const fetchSummaryForPeriod = async (financialYearId, customRange = null) => {
                    if (!financialYearId) return EMPTY_STATS;

                    const response = await apiService.dashboard.getSummary({
                        branchId: branchFilter,
                        financialYearId,
                        targetCurrency: dashboardFilters.currency,
                        ...(customRange
                            ? { startDate: formatDate(customRange.startDate), endDate: formatDate(customRange.endDate) }
                            : (dashboardFilters.dateRange?.startDate ? { startDate: formatDate(dashboardFilters.dateRange.startDate), endDate: formatDate(dashboardFilters.dateRange.endDate) } : {})
                        )
                    }, { signal: controller.signal });

                    return response?.success ? response.data : EMPTY_STATS;
                };

                const fetchTrendPayload = async () => {
                    const response = await apiService.dashboard.getTrends({
                        branchId: branchFilter,
                        financialYearId: selectedYear?.id,
                        compareFinancialYearId: previousYear?.id,
                        targetCurrency: dashboardFilters.currency,
                        // Current Period
                        ...(dashboardFilters.dateRange?.startDate ? { startDate: formatDate(dashboardFilters.dateRange.startDate), endDate: formatDate(dashboardFilters.dateRange.endDate) } : {}),
                        // Comparison Period
                        ...(prevRange ? { compareStartDate: formatDate(prevRange.startDate), compareEndDate: formatDate(prevRange.endDate) } : {})
                    }, { signal: controller.signal });

                    if (!response?.success || !response?.data) return EMPTY_TRENDS;

                    return {
                        ...EMPTY_TRENDS,
                        ...response.data,
                        current: response.data.current || EMPTY_TRENDS.current,
                        previous: response.data.previous || EMPTY_TRENDS.previous
                    };
                };

                const [currentSummaryResult, previousSummaryResult, trendPayloadResult] = await Promise.allSettled([
                    fetchSummaryForPeriod(selectedYear?.id),
                    fetchSummaryForPeriod(previousYear?.id || selectedYear?.id, prevRange),
                    fetchTrendPayload()
                ]);

                if (!controller.signal.aborted) {
                    const nextCurrentSummary = currentSummaryResult.status === 'fulfilled'
                        ? (currentSummaryResult.value || EMPTY_STATS)
                        : EMPTY_STATS;
                    const nextPreviousSummary = previousSummaryResult.status === 'fulfilled'
                        ? (previousSummaryResult.value || EMPTY_STATS)
                        : EMPTY_STATS;
                    const nextTrendPayload = trendPayloadResult.status === 'fulfilled'
                        ? (trendPayloadResult.value || EMPTY_TRENDS)
                        : EMPTY_TRENDS;

                    if (currentSummaryResult.status === 'rejected' && !isIgnorableRequestError(currentSummaryResult.reason)) {
                        console.error('Failed to fetch current dashboard summary:', currentSummaryResult.reason);
                    }

                    if (previousSummaryResult.status === 'rejected' && !isIgnorableRequestError(previousSummaryResult.reason)) {
                        console.error('Failed to fetch comparison dashboard summary:', previousSummaryResult.reason);
                    }

                    if (trendPayloadResult.status === 'rejected' && !isIgnorableRequestError(trendPayloadResult.reason)) {
                        console.error('Failed to fetch dashboard trends:', trendPayloadResult.reason);
                    }

                    setStats(nextCurrentSummary);
                    setPreviousStats(nextPreviousSummary);
                    setTrends(nextTrendPayload);
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch dashboard stats:", error);
            }
        };

        const timeoutId = setTimeout(() => {
            if (dashboardContextReady) {
                setIsDashboardLoading(true);
                // Force reset states to ensure dynamic refresh and skeleton trigger
                setStats(EMPTY_STATS);
                setTrends(EMPTY_TRENDS);
                fetchDashboardData().finally(() => setIsDashboardLoading(false));
            }
        }, 150);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
            setIsDashboardLoading(false);
        };
    }, [dashboardContextReady, user?.id, selectedBranch?.id, selectedYear?.id, previousYear?.id, selectedOrg?.id, dashboardFilters, dashboardRefreshNonce, branchLoading, yearLoading, getBranchFilterValue, statsCacheKey]);

    useEffect(() => {
        if (!dashboardContextReady) {
            setRankingCategories([]);
            setRankingLoading(false);
            setHasFetchedRankings(false);
            return undefined;
        }

        const controller = new AbortController();

        const fetchRankingCategories = async () => {
            setRankingLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;

                const response = await apiService.dashboard.getCategoryRankings({
                    branchId: branchFilter,
                    financialYearId: selectedYear?.id,
                    targetCurrency: dashboardFilters?.currency || preferences.currency,
                    ...(dashboardFilters?.dateRange?.startDate ? {
                        startDate: formatDate(dashboardFilters.dateRange.startDate),
                        endDate: formatDate(dashboardFilters.dateRange.endDate)
                    } : {})
                }, { signal: controller.signal });

                if (!controller.signal.aborted) {
                    if (response?.success) {
                        const normalizedCategories = (Array.isArray(response.data) ? response.data : []).map((item) => ({
                            ...item,
                            type: String(item?.type ?? item?.txnType ?? '').trim().toLowerCase(),
                            name: String(item?.name ?? '').trim(),
                            amount: Number(item?.amount || 0)
                        }));
                        setRankingCategories(normalizedCategories.filter((item) => item.type !== 'account'));
                    } else {
                        setRankingCategories([]);
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error('Failed to fetch dashboard rankings:', error);
                if (!controller.signal.aborted) {
                    setRankingCategories([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setRankingLoading(false);
                    setHasFetchedRankings(true);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            if (dashboardContextReady) {
                fetchRankingCategories();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [dashboardContextReady, user?.id, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, dashboardFilters, preferences.currency, getBranchFilterValue]);



    const currentMetrics = getMetricSnapshot(stats);
    const previousMetrics = getMetricSnapshot(previousStats);
    const metricSeries = trends?.current?.metrics || EMPTY_TRENDS.current.metrics;
    const previousMetricSeries = trends?.previous?.metrics || EMPTY_TRENDS.previous.metrics;
    const comparisonLabels = trends?.labels || [];

    const incomeChange = formatPercentageIndicator(currentMetrics.totalIncome, previousMetrics.totalIncome);
    const expenseChange = formatPercentageIndicator(currentMetrics.totalExpense, previousMetrics.totalExpense);
    const netProfitChange = formatPercentageIndicator(currentMetrics.netProfit, previousMetrics.netProfit);
    const investmentChange = formatPercentageIndicator(currentMetrics.totalInvestment, previousMetrics.totalInvestment);

    const allStats = [
        {
            title: 'Net Profit',
            amount: formatCompactAmount(currentMetrics.netProfit, dashboardFilters?.currency || stats.baseCurrency, preferences?.numberFormat),
            fullAmount: formatCurrency(currentMetrics.netProfit, dashboardFilters?.currency || stats.baseCurrency),
            previousFullAmount: formatCurrency(previousMetrics.netProfit, dashboardFilters?.currency || stats.baseCurrency),
            currentSeries: metricSeries.netProfit || [],
            previousSeries: previousMetricSeries.netProfit || [],
            comparisonLabels,
            chartColor: '#2563eb',
            chartFillColor: '#2563eb',
            previousChartColor: '#93c5fd',
            currentSeriesLabel,
            previousSeriesLabel,
            currentStartDate: resolvedCurrentStart,
            currentEndDate: resolvedCurrentEnd,
            previousStartDate: resolvedPrevStart,
            previousEndDate: resolvedPrevEnd,
            datePreset: dashboardFilters.dateRange?.preset,
            formatValue: (value) => formatCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.netProfit >= previousMetrics.netProfit ? 'up' : 'down',
            tertiaryText: netProfitChange.text,
            tertiaryTone: netProfitChange.tone
        },
        {
            title: 'Total Income',
            amount: formatCompactAmount(currentMetrics.totalIncome, dashboardFilters?.currency || stats.baseCurrency, preferences?.numberFormat),
            fullAmount: formatCurrency(currentMetrics.totalIncome, dashboardFilters?.currency || stats.baseCurrency),
            previousFullAmount: formatCurrency(previousMetrics.totalIncome, dashboardFilters?.currency || stats.baseCurrency),
            currentSeries: metricSeries.totalIncome || [],
            previousSeries: previousMetricSeries.totalIncome || [],
            comparisonLabels,
            chartColor: '#2563eb',
            chartFillColor: '#2563eb',
            previousChartColor: '#93c5fd',
            currentSeriesLabel,
            previousSeriesLabel,
            currentStartDate: resolvedCurrentStart,
            currentEndDate: resolvedCurrentEnd,
            previousStartDate: resolvedPrevStart,
            previousEndDate: resolvedPrevEnd,
            datePreset: dashboardFilters.dateRange?.preset,
            formatValue: (value) => formatCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.totalIncome >= previousMetrics.totalIncome ? 'up' : 'down',
            tertiaryText: incomeChange.text,
            tertiaryTone: incomeChange.tone
        },
        {
            title: 'Total Expenses',
            amount: formatCompactAmount(currentMetrics.totalExpense, dashboardFilters?.currency || stats.baseCurrency, preferences?.numberFormat),
            fullAmount: formatCurrency(currentMetrics.totalExpense, dashboardFilters?.currency || stats.baseCurrency),
            previousFullAmount: formatCurrency(previousMetrics.totalExpense, dashboardFilters?.currency || stats.baseCurrency),
            currentSeries: metricSeries.totalExpense || [],
            previousSeries: previousMetricSeries.totalExpense || [],
            comparisonLabels,
            chartColor: '#2563eb',
            chartFillColor: '#2563eb',
            previousChartColor: '#93c5fd',
            currentSeriesLabel,
            previousSeriesLabel,
            currentStartDate: resolvedCurrentStart,
            currentEndDate: resolvedCurrentEnd,
            previousStartDate: resolvedPrevStart,
            previousEndDate: resolvedPrevEnd,
            datePreset: dashboardFilters.dateRange?.preset,
            formatValue: (value) => formatCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.totalExpense <= previousMetrics.totalExpense ? 'up' : 'down',
            tertiaryText: expenseChange.text,
            tertiaryTone: expenseChange.tone
        },
        {
            title: 'Total Investment',
            amount: formatCompactAmount(currentMetrics.totalInvestment, dashboardFilters?.currency || stats.baseCurrency, preferences?.numberFormat),
            fullAmount: formatCurrency(currentMetrics.totalInvestment, dashboardFilters?.currency || stats.baseCurrency),
            previousFullAmount: formatCurrency(previousMetrics.totalInvestment, dashboardFilters?.currency || stats.baseCurrency),
            currentSeries: metricSeries.totalInvestment || [],
            previousSeries: previousMetricSeries.totalInvestment || [],
            comparisonLabels,
            chartColor: '#2563eb',
            chartFillColor: '#2563eb',
            previousChartColor: '#93c5fd',
            currentSeriesLabel,
            previousSeriesLabel,
            currentStartDate: resolvedCurrentStart,
            currentEndDate: resolvedCurrentEnd,
            previousStartDate: resolvedPrevStart,
            previousEndDate: resolvedPrevEnd,
            datePreset: dashboardFilters.dateRange?.preset,
            formatValue: (value) => formatCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.totalInvestment >= previousMetrics.totalInvestment ? 'up' : 'down',
            tertiaryText: investmentChange.text,
            tertiaryTone: investmentChange.tone
        }
    ];

    return (
        <div className="dashboard-tablet-page dashboard-small-desktop-page flex flex-col h-full min-h-0 bg-white">
            <div className="shrink-0 bg-white border-b border-slate-100/50">
                <div className="dashboard-header-pattern px-4 pt-4 pb-2 md:px-4 xl:px-6">
                    <div className="flex flex-col md:flex-row justify-end items-end md:items-center gap-2 md:gap-3">
                        <div className="flex-shrink-0">
                            <DateRangePicker
                                startDate={dashboardFilters.dateRange?.startDate}
                                endDate={dashboardFilters.dateRange?.endDate}
                                selectedPreset={dashboardFilters.dateRange?.preset}
                                presetOptions={datePresets}
                                onApplyRange={(range) => updateDashboardDateRange(range, { forceRefresh: true })}
                                className=""
                            />
                        </div>

                        <div className="flex-shrink-0">
                            <BranchSelector />
                        </div>

                        <div className="flex-shrink-0">
                            <CurrencySelector
                                value={dashboardFilters.currency}
                                onChange={(val) => {
                                    setDashboardFilters(prev => ({ ...prev, currency: val }));
                                    updatePreferences({ currency: val });
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-tablet-shell dashboard-small-desktop-shell flex-1 min-h-0 no-scrollbar overflow-y-auto px-4 md:px-4 xl:px-6 pb-4 pt-3 animate-in fade-in duration-500 flex flex-col gap-3 md:gap-4 xl:gap-3">

                {isDashboardLoading && !stats.openingBalance && !stats.totalIncome ? (
                    <DashboardSkeleton />
                ) : (
                    <>
                        {/* Stat Cards - 4 Column Grid */}
                        <div className="dashboard-tablet-stat-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start gap-3 flex-none">
                            {allStats.map((stat, index) => (
                                <div key={`${statsCacheKey}-${index}`} className="w-full self-start">
                                    <StatCard {...stat} />
                                </div>
                            ))}
                        </div>

                        {/* Category Rankings */}
                        <div className="flex-none min-h-[300px] relative transition-all duration-300" key={`${statsCacheKey}-rankings`} style={{ opacity: isDashboardLoading ? 0.6 : 1 }}>
                            <DashboardPanelSuspense fallbackClassName="min-h-[300px]">
                                <CategoryRankings
                                    dashboardFilters={dashboardFilters}
                                    categories={rankingCategories}
                                    rankingsLoading={rankingLoading}
                                    hasFetchedRankings={hasFetchedRankings}
                                />
                            </DashboardPanelSuspense>
                        </div>

                        {/* Additional Charts Row */}
                        <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4 flex-none transition-all duration-300 ${isDashboardLoading ? 'opacity-60' : 'opacity-100'}`}>
                            <DashboardPanelSuspense fallbackClassName="min-h-[280px]">
                                <CashFlowCard key={`${statsCacheKey}-cashflow`} stats={stats} chartData={comparisonLabels.map((label, i) => ({
                                    label,
                                    income: metricSeries.totalIncome?.[i] || 0,
                                    expense: metricSeries.totalExpense?.[i] || 0
                                }))} />
                            </DashboardPanelSuspense>
                            <DashboardPanelSuspense fallbackClassName="min-h-[280px] xl:col-span-1">
                                <DashboardPieChart
                                    key={`${statsCacheKey}-pie`}
                                    dashboardFilters={dashboardFilters}
                                    categories={rankingCategories}
                                    loading={rankingLoading && !hasFetchedRankings}
                                />
                            </DashboardPanelSuspense>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
