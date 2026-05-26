import CompactCurrency from '../../components/common/CompactCurrency';

import React, { useEffect, useState } from 'react';
import StatCard from './components/StatCard';
import CategoryRankings from './components/CategoryRankings';
import CashFlowCard from './components/CashFlowCard';
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
    const { preferences, formatCurrency, formatCompactCurrency, updatePreferences } = usePreferences();

    const [stats, setStats] = useState(EMPTY_STATS);
    const [previousStats, setPreviousStats] = useState(EMPTY_STATS);
    const [trends, setTrends] = useState(EMPTY_TRENDS);
    const [isDashboardLoading, setIsDashboardLoading] = useState(true);
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
    const currentSeriesLabel = selectedYear?.name || 'Current FY';
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

        if (dashboardContextReady) {
            setIsDashboardLoading(true);
            fetchDashboardData().finally(() => setIsDashboardLoading(false));
        }

        return () => {
            controller.abort();
            setIsDashboardLoading(false);
        };
    }, [dashboardContextReady, user?.id, selectedBranch?.id, selectedYear?.id, previousYear?.id, selectedOrg?.id, dashboardFilters, dashboardRefreshNonce, branchLoading, yearLoading, getBranchFilterValue, statsCacheKey]);



    const currentMetrics = getMetricSnapshot(stats);
    const previousMetrics = getMetricSnapshot(previousStats);
    const metricSeries = trends?.current?.metrics || EMPTY_TRENDS.current.metrics;
    const comparisonLabels = trends?.labels || [];

    const incomeChange = formatPercentageIndicator(currentMetrics.totalIncome, previousMetrics.totalIncome);
    const expenseChange = formatPercentageIndicator(currentMetrics.totalExpense, previousMetrics.totalExpense);
    const netProfitChange = formatPercentageIndicator(currentMetrics.netProfit, previousMetrics.netProfit);
    const investmentChange = formatPercentageIndicator(currentMetrics.investmentBalance, previousMetrics.investmentBalance);

    const allStats = [
        {
            title: 'Net Profit',
            amount: <CompactCurrency amount={currentMetrics.netProfit} currencyOverride={dashboardFilters?.currency || stats.baseCurrency} />,
            currentSeries: metricSeries.netProfit || [],
            comparisonLabels,
            chartColor: '#3b82f6',
            chartFillColor: '#3b82f6',
            currentSeriesLabel,
            formatValue: (value) => formatCompactCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.netProfit >= previousMetrics.netProfit ? 'up' : 'down',
            tertiaryText: netProfitChange.text,
            tertiaryTone: netProfitChange.tone,
            tertiaryTooltip: `${formatCurrency(previousMetrics.netProfit, dashboardFilters?.currency || stats.baseCurrency)}`
        },
        {
            title: 'Total Income',
            amount: <CompactCurrency amount={currentMetrics.totalIncome} currencyOverride={dashboardFilters?.currency || stats.baseCurrency} />,
            currentSeries: metricSeries.totalIncome || [],
            comparisonLabels,
            chartColor: '#3b82f6',
            chartFillColor: '#3b82f6',
            currentSeriesLabel,
            formatValue: (value) => formatCompactCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.totalIncome >= previousMetrics.totalIncome ? 'up' : 'down',
            tertiaryText: incomeChange.text,
            tertiaryTone: incomeChange.tone,
            tertiaryTooltip: `${formatCurrency(previousMetrics.totalIncome, dashboardFilters?.currency || stats.baseCurrency)}`
        },
        {
            title: 'Total Expenses',
            amount: <CompactCurrency amount={currentMetrics.totalExpense} currencyOverride={dashboardFilters?.currency || stats.baseCurrency} />,
            currentSeries: metricSeries.totalExpense || [],
            comparisonLabels,
            chartColor: '#3b82f6',
            chartFillColor: '#3b82f6',
            currentSeriesLabel,
            formatValue: (value) => formatCompactCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.totalExpense <= previousMetrics.totalExpense ? 'up' : 'down',
            tertiaryText: expenseChange.text,
            tertiaryTone: expenseChange.tone,
            tertiaryTooltip: `${formatCurrency(previousMetrics.totalExpense, dashboardFilters?.currency || stats.baseCurrency)}`
        },
        {
            title: 'Total Investment',
            amount: <CompactCurrency amount={currentMetrics.investmentBalance} currencyOverride={dashboardFilters?.currency || stats.baseCurrency} />,
            currentSeries: metricSeries.investmentBalance || metricSeries.totalInvestment || [],
            comparisonLabels,
            chartColor: '#3b82f6',
            chartFillColor: '#3b82f6',
            currentSeriesLabel,
            formatValue: (value) => formatCompactCurrency(value, dashboardFilters?.currency || stats.baseCurrency),
            trendType: currentMetrics.investmentBalance >= previousMetrics.investmentBalance ? 'up' : 'down',
            tertiaryText: investmentChange.text,
            tertiaryTone: investmentChange.tone,
            tertiaryTooltip: `${formatCurrency(previousMetrics.investmentBalance, dashboardFilters?.currency || stats.baseCurrency)}`
        }
    ];

    return (
        <div className="dashboard-tablet-page dashboard-small-desktop-page flex min-h-full flex-col bg-white md:h-full md:min-h-0">
            <div className="dashboard-tablet-shell dashboard-small-desktop-shell flex-1 min-h-0 no-scrollbar overflow-visible overflow-x-hidden px-4 pb-4 animate-in fade-in duration-500 flex flex-col gap-3 md:overflow-y-auto md:px-4 md:gap-4 xl:px-6 xl:gap-3">
                {/* Top Action Row */}
                <div className="sticky top-0 z-30 -mx-4 mb-0 bg-white border-b border-slate-100/50 md:-mx-4 xl:-mx-6" style={{ zIndex: 40 }}>
                    <div className="dashboard-header-pattern px-4 pt-4 pb-3 md:px-4 md:pb-2 xl:px-6">
                        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end md:gap-3">
                            <div className="w-full flex-shrink-0 md:w-auto">
                                <DateRangePicker
                                    startDate={dashboardFilters.dateRange?.startDate}
                                    endDate={dashboardFilters.dateRange?.endDate}
                                    selectedPreset={dashboardFilters.dateRange?.preset}
                                    presetOptions={datePresets}
                                    onApplyRange={(range) => updateDashboardDateRange(range, { forceRefresh: true })}
                                    className="w-full md:w-auto"
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2 w-full md:w-auto md:flex md:justify-end">
                                <div className="flex-1 min-w-0 md:flex-none md:w-auto">
                                    <BranchSelector
                                        className="w-full md:w-auto"
                                        triggerClassName="w-full justify-between md:w-auto md:justify-start"
                                    />
                                </div>
    
                                <div className="flex-shrink-0 md:w-auto">
                                    <CurrencySelector
                                        className="h-[32px] w-[90px] justify-between px-2 md:w-auto md:justify-center md:px-2.5"
                                        triggerTextClassName="flex-1 justify-start md:flex-initial"
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
                </div>

                <div className="w-full relative">
                    <div className="flex flex-col gap-3 md:gap-4 xl:gap-3 w-full">
                        {/* Stat Cards - 4 Column Grid */}
                        <div className="dashboard-tablet-stat-grid grid grid-cols-1 items-start gap-3 flex-none md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {allStats.map((stat, index) => (
                                <div key={`${statsCacheKey}-${index}`} className="w-full self-start">
                                    <StatCard {...stat} isLoading={isDashboardLoading} />
                                </div>
                            ))}
                        </div>

                        {/* Category Rankings */}
                        <div className="relative flex-none min-h-0 transition-all duration-300 md:min-h-[300px]" key={`${statsCacheKey}-rankings`}>
                            <CategoryRankings dashboardFilters={dashboardFilters} />
                        </div>

                        {/* Additional Charts Row */}
                        <div className="flex flex-col gap-3 xl:gap-4 flex-none transition-all duration-300">
                            <CashFlowCard key={`${statsCacheKey}-cashflow`} isLoading={isDashboardLoading} stats={stats} chartData={comparisonLabels.map((label, i) => ({
                                label,
                                income: metricSeries.totalIncome?.[i] || 0,
                                expense: metricSeries.totalExpense?.[i] || 0
                            }))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
