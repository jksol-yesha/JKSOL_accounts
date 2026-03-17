
import React, { useEffect, useState } from 'react';
import StatCard from './components/StatCard';
import CategoryRankings from './components/CategoryRankings';
import RecentTransactions from './components/RecentTransactions';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import BranchSelector from '../../components/layout/BranchSelector';

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

const CURRENT_LINE_COLOR = '#1d4ed8';
const PREVIOUS_LINE_COLOR = '#93c5fd';
const CURRENT_FILL_COLOR = 'rgba(29, 78, 216, 0.16)';

const getMonthDiff = (startDate, txnDate) => {
    const [startYear = 0, startMonth = 1] = String(startDate || '').split('-').map(Number);
    const [txnYear = 0, txnMonth = 1] = String(txnDate || '').split('-').map(Number);
    return ((txnYear - startYear) * 12) + (txnMonth - startMonth);
};

const buildMonthLabels = (startDate, endDate) => {
    const [startYear = 0, startMonth = 1] = String(startDate || '').split('-').map(Number);
    const [endYear = 0, endMonth = 1] = String(endDate || '').split('-').map(Number);
    const monthCount = Math.max(1, ((endYear - startYear) * 12) + (endMonth - startMonth) + 1);

    return Array.from({ length: monthCount }, (_, index) => {
        const date = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
        return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    });
};

const buildTrendMetricsFromRows = (rows = [], financialYear) => {
    const labels = buildMonthLabels(financialYear?.startDate, financialYear?.endDate);
    const totalIncome = Array(labels.length).fill(0);
    const totalExpense = Array(labels.length).fill(0);
    const totalInvestment = Array(labels.length).fill(0);

    rows.forEach((row) => {
        const monthIndex = getMonthDiff(financialYear?.startDate, row?.txnDate || row?.date);
        if (monthIndex < 0 || monthIndex >= labels.length) return;

        const amount = Number(row?.amountNumeric || row?.amount || 0);
        const type = String(row?.txnType || row?.type || '').toLowerCase();

        if (type === 'income') totalIncome[monthIndex] += amount;
        if (type === 'expense') totalExpense[monthIndex] += amount;
        if (type === 'investment') totalInvestment[monthIndex] += amount;
    });

    return {
        labels,
        metrics: {
            totalIncome,
            totalExpense,
            totalInvestment,
            netProfit: totalIncome.map((value, index) => value - totalExpense[index])
        }
    };
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

const formatFinancialYearFromStartDate = (startDate) => {
    const startYear = Number(String(startDate || '').slice(0, 4));
    if (!Number.isFinite(startYear) || startYear <= 0) return null;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const Dashboard = () => {
    const { selectedBranch, selectedBranchIds, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, financialYears, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { preferences } = usePreferences();
    const { formatCurrency } = usePreferences(); // Keeping this separate per existing code or merge it

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(EMPTY_STATS);
    const [previousStats, setPreviousStats] = useState(EMPTY_STATS);
    const [trends, setTrends] = useState(EMPTY_TRENDS);
    const branchCachePart = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
        ? selectedBranchIds.map(Number).sort((a, b) => a - b).join(',')
        : String(selectedBranch?.id || 'branch');
    const statsCacheKey = `dashboard:summary:v2:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}:${branchCachePart}:${preferences.currency || 'cur'}`;

    const sortedFinancialYears = [...(financialYears || [])].sort((a, b) => {
        const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
        return aDate - bDate;
    });
    const selectedYearIndex = sortedFinancialYears.findIndex((year) => Number(year.id) === Number(selectedYear?.id));
    const previousYear = selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;
    const comparisonLabels = [
        previousYear?.name || 'Prev FY',
        selectedYear?.name || 'Current FY'
    ];
    const previousSeriesLabel = previousYear?.name || 'Previous FY';
    const currentSeriesLabel = selectedYear?.name || 'Current FY';

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
        } catch (e) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [statsCacheKey]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;

                const fetchSummaryForYear = async (financialYearId) => {
                    if (!financialYearId) return EMPTY_STATS;

                    if (Array.isArray(branchFilter)) {
                        const responses = await Promise.all(
                            branchFilter.map((branchId) =>
                                apiService.dashboard.getSummary({
                                    branchId,
                                    financialYearId,
                                    targetCurrency: preferences.currency
                                }, { signal: controller.signal })
                            )
                        );

                        return responses
                            .filter(r => r?.success && r?.data)
                            .reduce((acc, r) => {
                                const d = r.data;
                                acc.openingBalance += Number(d.openingBalance || 0);
                                acc.totalIncome += Number(d.totalIncome || 0);
                                acc.totalExpense += Number(d.totalExpense || 0);
                                acc.totalInvestment += Number(d.totalInvestment || 0);
                                acc.closingBalance += Number(d.closingBalance || 0);
                                acc.baseCurrency = d.baseCurrency || acc.baseCurrency;
                                return acc;
                            }, {
                                ...EMPTY_STATS,
                                baseCurrency: preferences.currency
                            });
                    }

                    const response = await apiService.dashboard.getSummary({
                        branchId: branchFilter,
                        financialYearId,
                        targetCurrency: preferences.currency
                    }, { signal: controller.signal });

                    return response?.success ? response.data : EMPTY_STATS;
                };

                const [currentSummary, previousSummary] = await Promise.all([
                    fetchSummaryForYear(selectedYear?.id),
                    fetchSummaryForYear(previousYear?.id)
                ]);
                const fetchTrendRowsForYear = async (financialYear) => {
                    if (!financialYear?.startDate || !financialYear?.endDate) return null;

                    const response = await apiService.reports.get({
                        branchId: branchFilter,
                        type: 'Detailed',
                        startDate: financialYear.startDate,
                        endDate: financialYear.endDate,
                        targetCurrency: preferences.currency
                    });

                    if (!response?.success) return null;

                    return buildTrendMetricsFromRows(response?.data?.tableData || [], financialYear);
                };

                const [currentTrendData, previousTrendData] = await Promise.all([
                    fetchTrendRowsForYear(selectedYear),
                    fetchTrendRowsForYear(previousYear)
                ]);
                const trendPayload = {
                    labels: currentTrendData?.labels || [],
                    current: currentTrendData || EMPTY_TRENDS.current,
                    previous: previousTrendData || EMPTY_TRENDS.previous
                };

                if (!controller.signal.aborted) {
                    setStats(currentSummary || EMPTY_STATS);
                    setPreviousStats(previousSummary || EMPTY_STATS);
                    setTrends(trendPayload);
                    try {
                        sessionStorage.setItem(statsCacheKey, JSON.stringify({
                            current: currentSummary || EMPTY_STATS,
                            previous: previousSummary || EMPTY_STATS,
                            trends: trendPayload
                        }));
                    } catch (e) {
                        // Ignore storage errors
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            if (!branchLoading && !yearLoading && user && selectedBranch?.id && selectedYear?.id) {
                fetchDashboardData();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [user, selectedBranch?.id, selectedYear?.id, previousYear?.id, selectedOrg?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, statsCacheKey]);



    const currentMetrics = getMetricSnapshot(stats);
    const previousMetrics = getMetricSnapshot(previousStats);
    const metricSeries = trends?.current?.metrics || EMPTY_TRENDS.current.metrics;
    const previousMetricSeries = trends?.previous?.metrics || EMPTY_TRENDS.previous.metrics;
    const trendLabels = trends?.labels?.length ? trends.labels : comparisonLabels;
    const previousYearDisplay = formatFinancialYearFromStartDate(previousYear?.startDate)
        || formatFinancialYearFromStartDate(selectedYear?.startDate ? `${Number(String(selectedYear.startDate).slice(0, 4)) - 1}-04-01` : null)
        || previousYear?.name
        || 'Previous FY';
    const previousYearLabel = previousYearDisplay.startsWith('Previous FY')
        ? previousYearDisplay
        : `(FY ${previousYearDisplay})`;
    const allStats = [
        {
            title: 'Net Profit',
            amount: formatCurrency(currentMetrics.netProfit, stats.baseCurrency),
            previousSeries: previousMetricSeries.netProfit || [],
            currentSeries: metricSeries.netProfit || [],
            comparisonLabels: trendLabels,
            chartColor: CURRENT_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: CURRENT_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: '-',
            trendType: currentMetrics.netProfit >= previousMetrics.netProfit ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.netProfit, stats.baseCurrency),
            tertiaryText: `${previousYearLabel}: ${formatCurrency(previousMetrics.netProfit, stats.baseCurrency)}`
        },
        {
            title: 'Total Income',
            amount: formatCurrency(currentMetrics.totalIncome, stats.baseCurrency),
            previousSeries: previousMetricSeries.totalIncome || [],
            currentSeries: metricSeries.totalIncome || [],
            comparisonLabels: trendLabels,
            chartColor: CURRENT_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: CURRENT_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: '-',
            trendType: currentMetrics.totalIncome >= previousMetrics.totalIncome ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalIncome, stats.baseCurrency),
            tertiaryText: `${previousYearLabel}: ${formatCurrency(previousMetrics.totalIncome, stats.baseCurrency)}`
        },
        {
            title: 'Total Expenses',
            amount: formatCurrency(currentMetrics.totalExpense, stats.baseCurrency),
            previousSeries: previousMetricSeries.totalExpense || [],
            currentSeries: metricSeries.totalExpense || [],
            comparisonLabels: trendLabels,
            chartColor: CURRENT_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: CURRENT_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: '-',
            trendType: currentMetrics.totalExpense <= previousMetrics.totalExpense ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalExpense, stats.baseCurrency),
            tertiaryText: `${previousYearLabel}: ${formatCurrency(previousMetrics.totalExpense, stats.baseCurrency)}`
        },
        {
            title: 'Total Investments',
            amount: formatCurrency(currentMetrics.totalInvestment, stats.baseCurrency),
            previousSeries: previousMetricSeries.totalInvestment || [],
            currentSeries: metricSeries.totalInvestment || [],
            comparisonLabels: trendLabels,
            chartColor: CURRENT_LINE_COLOR,
            previousChartColor: PREVIOUS_LINE_COLOR,
            chartFillColor: CURRENT_FILL_COLOR,
            previousSeriesLabel,
            currentSeriesLabel,
            formatValue: (value) => formatCurrency(value, stats.baseCurrency),
            trend: '-',
            trendType: currentMetrics.totalInvestment >= previousMetrics.totalInvestment ? 'up' : 'down',
            secondaryText: formatCurrency(currentMetrics.totalInvestment, stats.baseCurrency),
            tertiaryText: `${previousYearLabel}: ${formatCurrency(previousMetrics.totalInvestment, stats.baseCurrency)}`
        }
    ];

    return (
        <div className="dashboard-tablet-page flex flex-col h-full min-h-0">
            <div className="dashboard-tablet-shell flex-1 min-h-0 no-scrollbar overflow-hidden px-4 md:px-4 xl:px-6 pt-2 pb-4 animate-in fade-in duration-500 flex flex-col gap-2 md:gap-3 xl:gap-2">
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

                {/* Category Rankings - Full Width */}
                <div className="flex-none mt-1">
                    <CategoryRankings />
                </div>

                {/* Recent Transactions - Full Width at Bottom */}
                <div className="flex-1 min-h-0 mt-1">
                    <RecentTransactions fillAvailableHeight />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
