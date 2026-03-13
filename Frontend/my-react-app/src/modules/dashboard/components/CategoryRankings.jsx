import React, { useState, useEffect } from 'react';
import Card from '../../../components/common/Card';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import isIgnorableRequestError from '../../../utils/isIgnorableRequestError';
import { cn } from '../../../utils/cn';
import { TrendingUp, ArrowUpCircle, ArrowDownCircle, Wallet, Loader2 } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { useAuth } from '../../../context/AuthContext';

const CategoryList = ({
    title,
    type,
    allCategories,
    icon: Icon,
    iconColor,
    initialLoading = false,
    overlayLoading = false,
    hasFetchedOnce = false
}) => {
    // Backend returns type as 'income', 'expense', 'investment' (lowercase)
    // Props might pass 'Income' (Capitalized)
    const normalizedType = type.toLowerCase();
    const filteredCategories = allCategories
        .filter(c => {
            const rankingType = String(c?.type ?? c?.txnType ?? '')
                .trim()
                .toLowerCase();
            return rankingType === normalizedType;
        })
        .sort((a, b) => (b.amount || 0) - (a.amount || 0));

    const { formatCurrency } = usePreferences();
    const totalAmount = filteredCategories.reduce((sum, cat) => sum + (cat.amount || 0), 0);
    const nameColumnTitle = normalizedType === 'account' ? 'Account Name' : 'Category Name';

    return (
        <Card
            title={
                <div className="flex items-center space-x-2 pt-1">
                    <Icon size={16} className={iconColor} />
                    <span className="text-sm font-bold dashboard-laptop-category-title">{title}</span>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-right ml-auto dashboard-laptop-category-total">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            }
            noPadding
            className="h-full flex flex-col dashboard-laptop-category-card"
        >
            <div className="flex flex-col h-full min-h-[265px] dashboard-laptop-category-body">
                {/* Header Row mimicking Transaction Table */}
                <div className="flex justify-between items-center px-4 py-1.5 bg-gray-50/50 border-y border-gray-200 text-[11px] text-gray-700 uppercase tracking-wider font-semibold dashboard-laptop-category-head-row">
                    <span>{nameColumnTitle}</span>
                    <span className="w-24 text-right">Amount</span>
                </div>

                <div className="relative p-0 flex-1 overflow-y-auto max-h-[258px] no-scrollbar dashboard-laptop-category-scroll">
                    {initialLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading...</span>
                        </div>
                    ) : filteredCategories.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {filteredCategories.map((cat) => (
                                <div key={cat.id} className="flex items-center justify-between px-4 py-0.5 hover:bg-gray-50/50 transition-colors group dashboard-laptop-category-row">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs dashboard-laptop-category-avatar">
                                            {(cat.name || '?').charAt(0)}
                                        </div>
                                        <span className="text-[12px] font-medium text-gray-700 dashboard-laptop-category-name">{cat.name}</span>
                                    </div>
                                    <div className="w-24 text-right">
                                        <span className="text-[11px] font-semibold text-gray-700 dashboard-laptop-category-amount">
                                            {formatCurrency(cat.amount)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : hasFetchedOnce ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <span className="text-sm font-medium">
                                {normalizedType === 'account' ? 'No accounts found' : 'No categories found'}
                            </span>
                        </div>
                    ) : null}
                    {overlayLoading && <LoadingOverlay label={`Loading ${title.toLowerCase()}...`} />}
                </div>
            </div>
        </Card>
    );
};

const getCurrentBalance = (account) => {
    const value = account?.closingBalance
        ?? account?.convertedClosingBalance
        ?? account?.closing_balance
        ?? account?.convertedBalance
        ?? account?.openingBalance
        ?? 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const AccountBalanceList = ({
    title,
    accounts,
    icon: Icon,
    iconColor,
    initialLoading = false,
    overlayLoading = false,
    hasFetchedOnce = false
}) => {
    const { formatCurrency } = usePreferences();
    const accountItems = (accounts || [])
        .map((acc) => {
            const amount = getCurrentBalance(acc);
            return {
                id: acc.id || `acc_${acc.name || acc.accountName || acc.bankName || Math.random()}`,
                displayName: acc.name || acc.accountName || acc.bankName || 'Unknown Account',
                amount,
                isPositive: amount >= 0,
                currency: acc.baseCurrency
            };
        })
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const totalAmount = accountItems.reduce((sum, acc) => sum + acc.amount, 0);

    return (
        <Card
            title={
                <div className="flex items-center space-x-2 pt-1">
                    <Icon size={16} className={iconColor} />
                    <span className="text-sm font-bold dashboard-laptop-category-title">{title}</span>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-right ml-auto dashboard-laptop-category-total" title="Total Current Balance">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            }
            noPadding
            className="h-full flex flex-col dashboard-laptop-category-card relative"
        >
            <div className="flex flex-col h-full min-h-[265px] dashboard-laptop-category-body">
                <div className="flex justify-between items-center px-4 py-1.5 bg-gray-50/50 border-y border-gray-200 text-[11px] text-gray-700 uppercase tracking-wider font-semibold dashboard-laptop-category-head-row">
                    <span>Account Name</span>
                    <span className="w-24 text-right">Balance</span>
                </div>

                <div className="relative p-0 flex-1 overflow-y-auto max-h-[258px] no-scrollbar dashboard-laptop-category-scroll">
                    {initialLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading...</span>
                        </div>
                    ) : accountItems.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {accountItems.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between px-4 py-1 hover:bg-gray-50/50 transition-colors group dashboard-laptop-category-row dashboard-laptop-account-row cursor-default"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 font-bold text-xs dashboard-laptop-category-avatar">
                                            {(cat.displayName || '?').charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-medium text-gray-700 dashboard-laptop-category-name">{cat.displayName}</span>
                                        </div>
                                    </div>
                                    <div className="w-24 text-right flex flex-col items-end">
                                        <span className={cn(
                                            "text-[12px] font-bold dashboard-laptop-account-balance-amount",
                                            cat.isPositive ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {cat.isPositive ? '+' : '-'}{formatCurrency(Math.abs(cat.amount), cat.currency)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : hasFetchedOnce ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <span className="text-sm font-medium">No account balances</span>
                        </div>
                    ) : null}
                    {overlayLoading && <LoadingOverlay label="Loading account balances..." />}
                </div>
            </div>
        </Card>
    );
};

const CategoryRankings = () => {
    const { selectedBranch, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { preferences } = usePreferences();
    const { user } = useAuth(); // NEW: Get user
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const cacheKey = `dashboard:rankings:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}`;

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.categories)) {
                setCategories(parsed.categories);
            }
            if (Array.isArray(parsed?.accounts)) {
                setAccounts(parsed.accounts);
            }
            if (Array.isArray(parsed?.categories) || Array.isArray(parsed?.accounts)) {
                setHasFetchedOnce(true);
            }
        } catch (e) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchRankings = async () => {
            let didStartRequest = false;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;

                if (Array.isArray(branchFilter)) {
                    didStartRequest = true;
                    const [rankingResponses, accountsResponse] = await Promise.all([
                        Promise.all(
                            branchFilter.map((branchId) =>
                                apiService.dashboard.getCategoryRankings({
                                    branchId,
                                    financialYearId: selectedYear.id,
                                    targetCurrency: preferences.currency
                                }, { signal: controller.signal })
                            )
                        ),
                        apiService.accounts.getAll({
                            branchId: 'all',
                            financialYearId: selectedYear.id,
                            targetCurrency: preferences.currency
                        }, { signal: controller.signal }).catch(() => ({ success: false, data: [] }))
                    ]);

                    if (!controller.signal.aborted) {
                        const map = new Map();
                        rankingResponses
                            .filter(r => r?.success && Array.isArray(r?.data))
                            .forEach(r => {
                                r.data.forEach(item => {
                                    const itemType = String(item?.type ?? item?.txnType ?? '')
                                        .trim()
                                        .toLowerCase();
                                    const itemName = String(item?.name ?? '').trim();
                                    const key = `${itemType}:${itemName}`;
                                    if (!map.has(key)) {
                                        map.set(key, {
                                            ...item,
                                            type: itemType,
                                            name: itemName,
                                            amount: Number(item.amount || 0)
                                        });
                                    } else {
                                        const existing = map.get(key);
                                        existing.amount += Number(item.amount || 0);
                                        map.set(key, existing);
                                    }
                                });
                            });
                        if (!controller.signal.aborted) {
                            setCategories(Array.from(map.values()));
                            setAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
                            try {
                                sessionStorage.setItem(cacheKey, JSON.stringify({
                                    categories: Array.from(map.values()),
                                    accounts: Array.isArray(accountsResponse.data) ? accountsResponse.data : []
                                }));
                            } catch (e) {
                                // Ignore storage errors
                            }
                        }
                    }
                } else {
                    didStartRequest = true;
                    const [rankingsResponse, accountsResponse] = await Promise.all([
                        apiService.dashboard.getCategoryRankings({
                            branchId: branchFilter,
                            financialYearId: selectedYear.id,
                            targetCurrency: preferences.currency
                        }, { signal: controller.signal }),
                        apiService.accounts.getAll({
                            branchId: 'all',
                            financialYearId: selectedYear.id,
                            targetCurrency: preferences.currency
                        }, { signal: controller.signal }).catch(() => ({ success: false, data: [] }))
                    ]);

                    if (!controller.signal.aborted) {
                        if (rankingsResponse.success) {
                            const normalizedRankings = (Array.isArray(rankingsResponse.data) ? rankingsResponse.data : []).map(item => ({
                                ...item,
                                type: String(item?.type ?? item?.txnType ?? '').trim().toLowerCase(),
                                name: String(item?.name ?? '').trim(),
                                amount: Number(item?.amount || 0)
                            }));
                            setCategories(normalizedRankings);
                            try {
                                sessionStorage.setItem(cacheKey, JSON.stringify({
                                    categories: normalizedRankings,
                                    accounts: accountsResponse.success ? (Array.isArray(accountsResponse.data) ? accountsResponse.data : []) : accounts
                                }));
                            } catch (e) {
                                // Ignore storage errors
                            }
                        }
                        if (accountsResponse.success) {
                            setAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
                        }
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch category rankings:", error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    if (didStartRequest) {
                        setHasFetchedOnce(true);
                    }
                }
            }
        };

        const timeoutId = setTimeout(() => {
            if (!branchLoading && !yearLoading && user && selectedBranch?.id && selectedYear?.id) {
                fetchRankings();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [user, selectedBranch?.id, selectedYear?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, cacheKey]); // ADDED: user dependency

    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 h-full">
            <div className="w-full">
                <AccountBalanceList
                    title="Account Balances"
                    accounts={accounts}
                    icon={Wallet}
                    iconColor="text-indigo-500"
                    initialLoading={showInitialLoader}
                    overlayLoading={showOverlayLoader}
                    hasFetchedOnce={hasFetchedOnce}
                />
            </div>
            <div className="w-full">
                <CategoryList
                    title="Income"
                    type="Income"
                    allCategories={categories}
                    icon={ArrowUpCircle}
                    iconColor="text-emerald-500"
                    initialLoading={showInitialLoader}
                    overlayLoading={showOverlayLoader}
                    hasFetchedOnce={hasFetchedOnce}
                />
            </div>
            <div className="w-full">
                <CategoryList
                    title="Expense"
                    type="Expense"
                    allCategories={categories}
                    icon={ArrowDownCircle}
                    iconColor="text-rose-500"
                    initialLoading={showInitialLoader}
                    overlayLoading={showOverlayLoader}
                    hasFetchedOnce={hasFetchedOnce}
                />
            </div>
            <div className="w-full">
                <CategoryList
                    title="Investment"
                    type="Investment"
                    allCategories={categories}
                    icon={TrendingUp}
                    iconColor="text-amber-500"
                    initialLoading={showInitialLoader}
                    overlayLoading={showOverlayLoader}
                    hasFetchedOnce={hasFetchedOnce}
                />
            </div>
        </div>
    );
};

export default CategoryRankings;
