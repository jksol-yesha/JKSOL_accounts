
import React, { useEffect, useState } from 'react';
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    TrendingUp,
} from 'lucide-react';
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

const Dashboard = () => {
    const { selectedBranch, selectedBranchIds, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { preferences } = usePreferences();
    const { formatCurrency } = usePreferences(); // Keeping this separate per existing code or merge it

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        openingBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalInvestment: 0,
        closingBalance: 0
    });
    const branchCachePart = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
        ? selectedBranchIds.map(Number).sort((a, b) => a - b).join(',')
        : String(selectedBranch?.id || 'branch');
    const statsCacheKey = `dashboard:summary:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}:${branchCachePart}:${preferences.currency || 'cur'}`;

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(statsCacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                setStats(prev => ({ ...prev, ...parsed }));
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
                if (Array.isArray(branchFilter)) {
                    const responses = await Promise.all(
                        branchFilter.map((branchId) =>
                            apiService.dashboard.getSummary({
                                branchId,
                                financialYearId: selectedYear.id,
                                targetCurrency: preferences.currency
                            }, { signal: controller.signal })
                        )
                    );

                    const merged = responses
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
                            openingBalance: 0,
                            totalIncome: 0,
                            totalExpense: 0,
                            totalInvestment: 0,
                            closingBalance: 0,
                            baseCurrency: preferences.currency
                        });

                    if (!controller.signal.aborted) {
                        setStats(merged);
                        try {
                            sessionStorage.setItem(statsCacheKey, JSON.stringify(merged));
                        } catch (e) {
                            // Ignore storage errors
                        }
                    }
                } else {
                    const response = await apiService.dashboard.getSummary({
                        branchId: branchFilter,
                        financialYearId: selectedYear.id,
                        targetCurrency: preferences.currency
                    }, { signal: controller.signal });

                    if (response.success) {
                        if (!controller.signal.aborted) {
                            setStats(response.data);
                            try {
                                sessionStorage.setItem(statsCacheKey, JSON.stringify(response.data));
                            } catch (e) {
                                // Ignore storage errors
                            }
                        }
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
    }, [user, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, statsCacheKey]);



    const dynamicLinkText = selectedYear ? `FY(${selectedYear.name})` : 'FY(...)';
    const netProfit = Number(stats.totalIncome || 0) - Number(stats.totalExpense || 0);

    const allStats = [
        {
            title: 'Net Profit',
            amount: formatCurrency(netProfit, stats.baseCurrency),
            icon: Wallet,
            iconBgColor: '#e0e7ff',  // Light indigo
            iconColor: '#4f46e5',    // Indigo
            trend: '-',
            trendType: netProfit >= 0 ? 'up' : 'down',
            linkText: dynamicLinkText
        },
        {
            title: 'Total Income',
            amount: formatCurrency(stats.totalIncome, stats.baseCurrency),
            icon: ArrowUpCircle,
            iconBgColor: '#dbeafe',  // Light blue
            iconColor: '#3b82f6',    // Blue
            trend: '-',
            trendType: 'up', // Static for now
            linkText: dynamicLinkText
        },
        {
            title: 'Total Expenses',
            amount: formatCurrency(stats.totalExpense, stats.baseCurrency),
            icon: ArrowDownCircle,
            iconBgColor: '#ffe4e6',  // Light rose/pink
            iconColor: '#f43f5e',    // Rose
            trend: '-',
            trendType: 'down',
            linkText: dynamicLinkText
        },
        {
            title: 'Total Investments',
            amount: formatCurrency(stats.totalInvestment, stats.baseCurrency),
            icon: TrendingUp,
            iconBgColor: '#fef3c7',  // Light amber/yellow
            iconColor: '#f59e0b',    // Amber
            trend: '-',
            trendType: 'up',
            linkText: dynamicLinkText
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
