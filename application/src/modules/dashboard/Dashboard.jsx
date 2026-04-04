
import React, { useEffect, useState } from 'react';
import StatCard from './components/StatCard';
import CategoryRankings from './components/CategoryRankings';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import BranchSelector from '../../components/layout/BranchSelector';

const recentDashboardFetches = new Map();

const EMPTY_STATS = {
    openingBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalInvestment: 0,
    closingBalance: 0
};

const EMPTY_TRENDS = {
    labels: [],
    current: {
        metrics: {
            netProfit: [],
            totalIncome: [],
            totalExpense: [],
            totalInvestment: []
        }
    },
    previous: {
        metrics: {
            netProfit: [],
            totalIncome: [],
            totalExpense: [],
            totalInvestment: []
        }
    }
};

const METRIC_LINE_COLOR = '#6b7280';
const METRIC_FILL_COLOR = 'rgba(107, 114, 128, 0.14)';
const PREVIOUS_LINE_COLOR = '#d1d5db';

const shiftMonthDate = (dateString, monthOffset) => {
    const [year = 0, month = 1] = String(dateString || '').split('-').map(Number);
    if (!year || !month) return null;
    const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

const formatMonthYearLabel = (dateString, monthOffset = 0) => {
    const shiftedDate = shiftMonthDate(dateString, monthOffset);
    if (!shiftedDate) return null;

    const [year = 0, month = 1] = shiftedDate.split('-').map(Number);
    if (!year || !month) return null;

    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const buildReverseMonthYearLabels = (endDate, pointCount = 14) => {
    return Array.from({ length: pointCount }, (_, index) => formatMonthYearLabel(endDate, 1 - index));
};

const buildSeriesLookup = (series = [], financialYear) => {
    const startDate = financialYear?.startDate;
    if (!startDate) return new Map();

    return new Map(
        series
            .map((value, index) => {
                const monthDate = shiftMonthDate(startDate, index);
                if (!monthDate) return null;
                return [monthDate.slice(0, 7), Number(value || 0)];
            })
            .filter(Boolean)
    );
};

const buildReverseFiscalTrail = (currentSeries = [], previousSeries = [], currentYear, previousYear) => {
    const currentEndDate = currentYear?.endDate || shiftMonthDate(currentYear?.startDate, 11);
    const labels = buildReverseMonthYearLabels(currentEndDate);
    const currentLookup = buildSeriesLookup(currentSeries, currentYear);
    const previousLookup = buildSeriesLookup(previousSeries, previousYear);

    return labels.map((label, index) => {
        const monthDate = shiftMonthDate(currentEndDate, 1 - index);
        const monthKey = monthDate ? monthDate.slice(0, 7) : null;
        const value = monthKey
            ? (currentLookup.get(monthKey) ?? previousLookup.get(monthKey) ?? 0)
            : 0;

        return {
            label: label || '',
            value: Number(value || 0)
        };
    });
};

const getMetricSnapshot = (summary = EMPTY_STATS) => {
    const income = Number(summary.totalIncome || 0);
    const expense = Number(summary.totalExpense || 0);
    const investment = Number(summary.totalInvestment || 0);

    return {
        netProfit: income - expense,
        totalIncome: income,
        totalExpense: expense,
        totalInvestment: investment
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

const Dashboard = () => {
    const { selectedBranch, selectedBranchIds, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, financialYears, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { preferences } = usePreferences();
    const { formatCurrency } = usePreferences(); // Keeping this separate per existing code or merge it

    const [stats, setStats] = useState(EMPTY_STATS);
    const [previousStats, setPreviousStats] = useState(EMPTY_STATS);
    const [trends, setTrends] = useState(EMPTY_TRENDS);
    const branchCachePart = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
        ? selectedBranchIds.map(Number).sort((a, b) => a - b).join(',')
        : String(selectedBranch?.id || 'branch');
    const statsCacheKey = `dashboard:summary:v5:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}:${branchCachePart}:${preferences.currency || 'cur'}`;

    const sortedFinancialYears = [...(financialYears || [])].sort((a, b) => {
        const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
        return aDate - bDate;
    });
    const selectedYearIndex = sortedFinancialYears.findIndex((year) => Number(year.id) === Number(selectedYear?.id));
    const previousYear = selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;
    const previousSeriesLabel = previousYear?.name || 'Previous FY';
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

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(statsCacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (parsed.current && typeof parsed.current === 'object') {
                    setStats(prev => ({ ...prev, ...parsed.current }));
                } else {
                    setStats(prev => ({ ...prev, ...parsed }));
                }
                if (parsed.previous && typeof parsed.previous === 'object') {
                    setPreviousStats(prev => ({ ...prev, ...parsed.previous }));
                } else {
                    setPreviousStats(EMPTY_STATS);
                }
                if (parsed.trends && typeof parsed.trends === 'object') {
                    setTrends(parsed.trends);
                } else {
                    setTrends(EMPTY_TRENDS);
                }
            }
        } catch {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [statsCacheKey]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchDashboardData = async () => {
            if (!dashboardContextReady) return;
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;
                const requestKey = JSON.stringify({
                    orgId: selectedOrg?.id || null,
                    yearId: selectedYear?.id || null,
                    previousYearId: previousYear?.id || null,
                    branchFilter,
                    currency: preferences.currency || ''
                });
                const lastStartedAt = recentDashboardFetches.get(requestKey) || 0;
                if (Date.now() - lastStartedAt < 800) return;
                recentDashboardFetches.set(requestKey, Date.now());

                const fetchSummaryForYear = async (financialYearId) => {
                    if (!financialYearId) return EMPTY_STATS;

                    const response = await apiService.dashboard.getSummary({
                        branchId: branchFilter,
                        financialYearId,
                        targetCurrency: preferences.currency
                    }, { signal: controller.signal });

                    return response?.success ? response.data : EMPTY_STATS;
                };

                const fetchTrendPayload = async () => {
                    const response = await apiService.dashboard.getTrends({
                        branchId: branchFilter,
                        financialYearId: selectedYear?.id,
                        compareFinancialYearId: previousYear?.id,
                        targetCurrency: preferences.currency
                    }, { signal: controller.signal });

                    if (!response?.success || !response?.data) return EMPTY_TRENDS;

                    return {
                        ...EMPTY_TRENDS,
                        ...response.data,
                        current: response.data.current || EMPTY_TRENDS.current,
                        previous: response.data.previous || EMPTY_TRENDS.previous
                    };
                };

                const [currentSummary, previousSummary, trendPayload] = await Promise.all([
                    fetchSummaryForYear(selectedYear?.id),
                    fetchSummaryForYear(previousYear?.id),
                    fetchTrendPayload()
                ]);

                if (!controller.signal.aborted) {
                    setStats(currentSummary || EMPTY_STATS);
                    setPreviousStats(previousSummary || EMPTY_STATS);
                    setTrends(trendPayload || EMPTY_TRENDS);
                    try {
                        sessionStorage.setItem(statsCacheKey, JSON.stringify({
                            current: currentSummary || EMPTY_STATS,
                            previous: previousSummary || EMPTY_STATS,
                            trends: trendPayload || EMPTY_TRENDS
                        }));
                    } catch {
                        // Ignore storage errors
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch dashboard stats:", error);
            }
        };

        const timeoutId = setTimeout(() => {
            if (dashboardContextReady) {
                fetchDashboardData();
            }
        }, 150);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [dashboardContextReady, user?.id, selectedBranch?.id, selectedYear?.id, previousYear?.id, selectedOrg?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, statsCacheKey]);



    const currentMetrics = getMetricSnapshot(stats);
    const previousMetrics = getMetricSnapshot(previousStats);
    const metricSeries = trends?.current?.metrics || EMPTY_TRENDS.current.metrics;
    const previousMetricSeries = trends?.previous?.metrics || EMPTY_TRENDS.previous.metrics;
    const netProfitChange = formatPercentageIndicator(currentMetrics.netProfit, previousMetrics.netProfit);
    const incomeChange = formatPercentageIndicator(currentMetrics.totalIncome, previousMetrics.totalIncome);
    const expenseChange = formatPercentageIndicator(currentMetrics.totalExpense, previousMetrics.totalExpense);
    const investmentChange = formatPercentageIndicator(currentMetrics.totalInvestment, previousMetrics.totalInvestment);
    const netProfitTrail = buildReverseFiscalTrail(metricSeries.netProfit || [], previousMetricSeries.netProfit || [], selectedYear, previousYear);
    const incomeTrail = buildReverseFiscalTrail(metricSeries.totalIncome || [], previousMetricSeries.totalIncome || [], selectedYear, previousYear);
    const expenseTrail = buildReverseFiscalTrail(metricSeries.totalExpense || [], previousMetricSeries.totalExpense || [], selectedYear, previousYear);
    const investmentTrail = buildReverseFiscalTrail(metricSeries.totalInvestment || [], previousMetricSeries.totalInvestment || [], selectedYear, previousYear);
    const allStats = [
        {
            title: 'Net Profit',
            amount: formatCurrency(currentMetrics.netProfit, stats.baseCurrency),
            previousSeries: [],
            currentSeries: netProfitTrail.map((point) => point.value),
            comparisonLabels: netProfitTrail.map((point) => point.label),
            chartColor: METRIC_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: METRIC_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: null,
            trendType: currentMetrics.netProfit >= previousMetrics.netProfit ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.netProfit, stats.baseCurrency),
            tertiaryText: netProfitChange.text,
            tertiaryTone: netProfitChange.tone
        },
        {
            title: 'Total Income',
            amount: formatCurrency(currentMetrics.totalIncome, stats.baseCurrency),
            previousSeries: [],
            currentSeries: incomeTrail.map((point) => point.value),
            comparisonLabels: incomeTrail.map((point) => point.label),
            chartColor: METRIC_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: METRIC_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: null,
            trendType: currentMetrics.totalIncome >= previousMetrics.totalIncome ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalIncome, stats.baseCurrency),
            tertiaryText: incomeChange.text,
            tertiaryTone: incomeChange.tone
        },
        {
            title: 'Total Expenses',
            amount: formatCurrency(currentMetrics.totalExpense, stats.baseCurrency),
            previousSeries: [],
            currentSeries: expenseTrail.map((point) => point.value),
            comparisonLabels: expenseTrail.map((point) => point.label),
            chartColor: METRIC_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: METRIC_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: null,
            trendType: currentMetrics.totalExpense <= previousMetrics.totalExpense ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalExpense, stats.baseCurrency),
            tertiaryText: expenseChange.text,
            tertiaryTone: expenseChange.tone
        },
        {
            title: 'Total Investments',
            amount: formatCurrency(currentMetrics.totalInvestment, stats.baseCurrency),
            previousSeries: [],
            currentSeries: investmentTrail.map((point) => point.value),
            comparisonLabels: investmentTrail.map((point) => point.label),
            chartColor: METRIC_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: METRIC_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: null,
            trendType: currentMetrics.totalInvestment >= previousMetrics.totalInvestment ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalInvestment, stats.baseCurrency),
            tertiaryText: investmentChange.text,
            tertiaryTone: investmentChange.tone
        }
    ];

    return (
        <div className="dashboard-tablet-page dashboard-small-desktop-page flex flex-col h-full min-h-0">
            <div className="dashboard-tablet-shell dashboard-small-desktop-shell flex-1 min-h-0 no-scrollbar overflow-hidden px-4 md:px-4 xl:px-6 pt-2 pb-4 animate-in fade-in duration-500 flex flex-col gap-2 md:gap-3 xl:gap-2">
                <div className="dashboard-tablet-insights-row flex items-center justify-between gap-2 md:gap-3 xl:gap-4 flex-none mt-0 mb-0 dashboard-laptop-hide-insights">
                    <p className="dashboard-insights-text flex-1 min-w-0 text-sm md:text-base font-semibold text-gray-500">
                        Here's your financial Insights
                    </p>
                    <div className="w-auto shrink-0 dashboard-insights-branch">
                        <BranchSelector />
                    </div>
                </div>

                {/* Stat Cards - 5 Column Grid */}
                <div className="dashboard-tablet-stat-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start gap-3 flex-none">
                    {allStats.map((stat, index) => (
                        <div key={index} className="w-full self-start">
                            <StatCard {...stat} />
                        </div>
                    ))}
                </div>

                {/* Category Rankings */}
                <div className="flex-1 min-h-0 mt-1 overflow-hidden">
                    <CategoryRankings />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
