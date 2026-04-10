import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import isIgnorableRequestError from '../../../utils/isIgnorableRequestError';
import { cn } from '../../../utils/cn';
import { Loader2, Wallet } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { useAuth } from '../../../context/AuthContext';

const recentRankingFetches = new Map();

// --- BANK AVATAR LOGIC ---
const bankLogoModules = import.meta.glob('../../../assets/bank-logos/*.{png,jpg,jpeg,svg}', {
    eager: true,
    import: 'default'
});

const normalizeLogoKey = (value = '') => String(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

const bankLogoAssets = Object.entries(bankLogoModules).reduce((acc, [path, asset]) => {
    const fileName = path.split('/').pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    acc[normalizeLogoKey(baseName)] = asset;
    return acc;
}, {});

const getBankLogoAsset = ({ bankLogoKey, bankName, bankCode, fallbackBrand }) => {
    const candidates = [bankLogoKey, bankName, bankCode, fallbackBrand].filter(Boolean).map((value) => normalizeLogoKey(value));
    for (const key of candidates) {
        if (bankLogoAssets[key]) return bankLogoAssets[key];
    }
    return null;
};

const detectBankBrand = (name = '') => {
    const normalized = String(name).toLowerCase();
    if (normalized.includes('hdfc')) return 'hdfc';
    if (normalized.includes('axis')) return 'axis';
    if (normalized.includes('icici')) return 'icici';
    if (normalized.includes('state bank') || normalized.includes('sbi')) return 'sbi';
    if (normalized.includes('punjab national') || normalized.includes('pnb')) return 'pnb';
    if (normalized.includes('kotak')) return 'kotak';
    if (normalized.includes('yes bank') || normalized.includes('yesb')) return 'yes';
    if (normalized.includes('canara')) return 'canara';
    if (normalized.includes('bank of baroda') || normalized.includes(' bob ') || normalized.startsWith('bob ') || normalized.endsWith(' bob') || normalized === 'bob') return 'bob';
    return null;
};

const BankAvatar = ({ name, bankLogoKey, ifsc, bankName, bankCode, subtype, subtypeLabel, sizeClass = 'w-7 h-7', monochrome = false }) => {
    const isCashAccount = Number(subtype) === 11 || String(subtypeLabel || '').toLowerCase() === 'cash';
    const isPersonalAccount = String(name || '').toLowerCase().includes('personal');
    const bankBrand = bankLogoKey || detectBankBrand(`${name} ${bankName} ${ifsc}`);
    const logoAsset = getBankLogoAsset({ bankLogoKey, bankName, bankCode, fallbackBrand: bankBrand });
    
    const plainIconShellClassName = `${sizeClass} flex items-center justify-center shrink-0`;
    const circularFallbackShellClassName = `${sizeClass} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden shrink-0`;
    const iconImageClassName = cn("h-[18px] w-[18px] object-contain shrink-0", monochrome && "opacity-90 grayscale");

    if (isCashAccount) {
        return (
            <div className={plainIconShellClassName}>
                <img src={bankLogoAssets.wallet} alt="Cash wallet" className={iconImageClassName} />
            </div>
        );
    }
    if (isPersonalAccount && bankLogoAssets.personalaccount) {
        return (
            <div className={plainIconShellClassName}>
                <img src={bankLogoAssets.personalaccount} alt="Personal account" className={iconImageClassName} />
            </div>
        );
    }
    if (logoAsset) {
        return (
            <div className={plainIconShellClassName}>
                <img src={logoAsset} alt={bankName || bankBrand || 'Bank logo'} className={iconImageClassName} />
            </div>
        );
    }
    return (
        <div className={`${circularFallbackShellClassName} text-slate-500 font-bold text-[10px] leading-none`}>
            {(name || '?').charAt(0)}
        </div>
    );
};

const getCurrentBalance = (account) => {
    const value = account?.closingBalance ?? account?.convertedClosingBalance ?? account?.closing_balance ?? account?.convertedBalance ?? account?.openingBalance ?? 0;
    return Number.isFinite(Number(value)) ? Number(value) : 0;
};

// --- CUSTOM CARD SHELL MATCHING REFERENCE IMAGE ---
const CardShell = ({ title, headerRight, children, className }) => (
    <div className={cn("bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full overflow-hidden", className)}>
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between gap-4">
            <h3 className="text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none shrink-0">
                {title}
            </h3>
            {headerRight && (
                <div className="flex items-center justify-end pointer-events-none">
                    {headerRight}
                </div>
            )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col relative bg-white">
            {children}
        </div>
    </div>
);

// -------------------------------------------------------------
// COLUMN 1: Account Balances
// -------------------------------------------------------------
const AccountBalanceList = ({ accounts, initialLoading, overlayLoading, hasFetchedOnce }) => {
    const { formatCurrency } = usePreferences();
    
    const accountItems = (accounts || [])
        .map((acc, index) => {
            const amount = getCurrentBalance(acc);
            return {
                id: acc.id || `acc_${index}`,
                displayName: acc.name || acc.accountName || acc.bankName || 'Unknown',
                amount,
                isPositive: amount >= 0,
                currency: acc.baseCurrency,
                subtype: acc.subtype ?? acc.subType,
                subtypeLabel: acc.subtypeLabel,
                bankLogoKey: acc.bankLogoKey,
                ifsc: acc.ifsc,
                bankName: acc.bankName,
                bankCode: acc.bankCode
            };
        })
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const totalAbsoluteAmount = accountItems.reduce((sum, acc) => sum + Math.abs(acc.amount), 0);
    const totalAvailableBalance = accountItems.reduce((sum, acc) => sum + acc.amount, 0);
    const topAccounts = accountItems.slice(0, 5);

    const isTotalPositive = totalAvailableBalance >= 0;

    const totalBalanceBadge = accountItems.length > 0 ? (
        <div className="flex items-center gap-1.5" title="Total Available Balance">
            <Wallet className="w-4 h-4 text-slate-400" />
            <span className={cn(
                "text-[14px] font-semibold tracking-tight",
                isTotalPositive ? "text-slate-800" : "text-rose-600"
            )}>
                {formatCurrency(totalAvailableBalance)}
            </span>
        </div>
    ) : null;

    return (
        <CardShell title="Account Balances" headerRight={totalBalanceBadge}>
            <div className="flex-1 overflow-y-auto relative no-scrollbar pt-2">
                {initialLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : topAccounts.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {topAccounts.map((cat) => {
                            const sharePercent = totalAbsoluteAmount > 0 ? Math.round((Math.abs(cat.amount) / totalAbsoluteAmount) * 100) : 0;
                            return (
                                <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        <BankAvatar 
                                            name={cat.displayName}
                                            bankLogoKey={cat.bankLogoKey}
                                            ifsc={cat.ifsc}
                                            bankName={cat.bankName}
                                            bankCode={cat.bankCode}
                                            subtype={cat.subtype}
                                            subtypeLabel={cat.subtypeLabel}
                                            sizeClass="w-6 h-6"
                                        />
                                        <span className="text-[13px] font-medium text-slate-800 truncate">
                                            {cat.displayName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <span className="w-32 text-right text-[13px] font-medium text-slate-800">
                                            {formatCurrency(cat.amount)}
                                        </span>
                                        <span className="w-8 text-right text-[12px] text-slate-400">
                                            {sharePercent}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : hasFetchedOnce ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-slate-400">
                        No accounts found
                    </div>
                ) : null}
            </div>
            {overlayLoading && <LoadingOverlay />}
        </CardShell>
    );
};

// -------------------------------------------------------------
// COLUMN 2: Income vs Expenses
// -------------------------------------------------------------
const PnLBreakdownList = ({ categories, initialLoading, overlayLoading, hasFetchedOnce }) => {
    const { formatCurrency } = usePreferences();
    
    const totalIncomeApp = categories
        .filter(c => String(c.type).toLowerCase() === 'income')
        .reduce((sum, c) => sum + Math.abs(c.amount), 0);
        
    const totalExpenseApp = categories
        .filter(c => String(c.type).toLowerCase() === 'expense')
        .reduce((sum, c) => sum + Math.abs(c.amount), 0);

    const total = totalIncomeApp + totalExpenseApp;
    
    const incomePercent = total > 0 ? Math.round((totalIncomeApp / total) * 100) : 0;
    const expensePercent = total > 0 ? Math.round((totalExpenseApp / total) * 100) : 0;
    
    // Fallback if no data
    const showChart = total > 0;
    const pieData = showChart ? [
        { name: 'Income', value: totalIncomeApp, color: '#4ade80' },
        { name: 'Expenses', value: totalExpenseApp, color: '#f87171' }
    ] : [{ name: 'Empty', value: 1, color: '#eff6ff' }];

    return (
        <CardShell title="Income vs Expenses">
            <div className="flex-1 overflow-y-auto px-6 relative no-scrollbar flex flex-col justify-center py-5">
                {initialLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row mx-auto items-center justify-center w-full gap-5 lg:gap-4 xl:gap-8">
                        {/* Donut Chart */}
                        <div className="w-[140px] h-[140px] xl:w-[150px] xl:h-[150px] flex-shrink-0 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={0}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={true}
                                        startAngle={showChart ? 90 : 0}
                                        endAngle={showChart ? -270 : 360}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            {!showChart && hasFetchedOnce && (
                                <div className="absolute inset-0 flex items-center justify-center text-[12px] font-medium text-slate-400">
                                    No Data
                                </div>
                            )}
                        </div>
                        
                        {/* Legend */}
                        <div className="flex-1 flex flex-col gap-6 w-full">
                           {/* Income Legend */}
                           <div className="flex flex-col">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]"></span>
                                   <span className="text-[14px] font-medium text-slate-600">Income</span>
                               </div>
                               <div className="flex items-center justify-between ml-[18px] gap-2 min-w-0">
                                   <div className="text-[16px] xl:text-[17px] font-semibold text-slate-800 tracking-tight whitespace-nowrap truncate">
                                       {formatCurrency(totalIncomeApp)}
                                   </div>
                                   <div className="text-[14px] xl:text-[15px] font-medium text-slate-500 shrink-0">
                                       {incomePercent}%
                                   </div>
                               </div>
                           </div>
                           
                           {/* Expenses Legend */}
                           <div className="flex flex-col">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]"></span>
                                   <span className="text-[14px] font-medium text-slate-600">Expenses</span>
                               </div>
                               <div className="flex items-center justify-between ml-[18px] gap-2 min-w-0">
                                   <div className="text-[16px] xl:text-[17px] font-semibold text-slate-800 tracking-tight whitespace-nowrap truncate">
                                       {formatCurrency(totalExpenseApp)}
                                   </div>
                                   <div className="text-[14px] xl:text-[15px] font-medium text-slate-500 shrink-0">
                                       {expensePercent}%
                                   </div>
                               </div>
                           </div>
                        </div>
                    </div>
                )}
            </div>
            {overlayLoading && <LoadingOverlay />}
        </CardShell>
    );
};

// -------------------------------------------------------------
// COLUMN 3: Investment Performance
// -------------------------------------------------------------
const InvestmentCardList = ({ categories, initialLoading, overlayLoading, hasFetchedOnce }) => {
    const { formatCurrency } = usePreferences();
    
    const investments = categories
        .filter(c => String(c.type).toLowerCase() === 'investment')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

    const getMockReturn = (id) => {
        const hash = String(id).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
        return ((hash % 40) - 5) + (hash % 10) / 10;
    };

    return (
        <CardShell title="Investment Performance">
            <div className="flex-1 overflow-y-auto relative no-scrollbar">
                {initialLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : investments.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {investments.map((cat, i) => {
                            const mockReturn = getMockReturn(cat.id || cat.name);
                            const isPositive = mockReturn >= 0;
                            return (
                                <div key={i} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <span className="text-[13px] font-medium text-slate-800 truncate">{cat.name}</span>
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Investment Asset</span>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className={cn(
                                            "text-[13px] font-medium tracking-tight",
                                            isPositive ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {isPositive ? '+' : ''}{mockReturn.toFixed(1)}%
                                        </span>
                                        <span className="text-[11px] font-medium text-slate-800 mt-0.5">
                                            {formatCurrency(cat.amount)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : hasFetchedOnce ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-slate-400">
                        No active investments
                    </div>
                ) : null}
            </div>
            {overlayLoading && <LoadingOverlay />}
        </CardShell>
    );
};

// -------------------------------------------------------------
// MAIN LAYOUT WRAPPER
// -------------------------------------------------------------
const CategoryRankings = ({ dashboardFilters }) => {
    const location = useLocation();
    const { selectedBranch, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { preferences } = usePreferences();
    const { user } = useAuth();
    
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    
    const cacheKey = `dashboard:rankings:layout_v6:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}:${dashboardFilters?.currency || preferences.currency}:${dashboardFilters?.dateRange?.startDate || 'all'}`;
    const rankingsContextReady = Boolean(
        location.pathname === '/dashboard' && !branchLoading && !yearLoading && selectedOrg?.id && selectedYear?.id &&
        (user?.role === 'member' || user?.role === 'owner' || selectedBranch?.id)
    );

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.categories)) setCategories(parsed.categories);
            if (Array.isArray(parsed?.accounts)) setAccounts(parsed.accounts);
            if (Array.isArray(parsed?.categories) || Array.isArray(parsed?.accounts)) setHasFetchedOnce(true);
        } catch { /* parse error */ }
    }, [cacheKey]);

    useEffect(() => {
        const controller = new AbortController();
        const fetchRankings = async () => {
            let didStartRequest = false;
            if (!rankingsContextReady) return;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;
                const requestKey = JSON.stringify({ orgId: selectedOrg?.id, yearId: selectedYear?.id, branchFilter, currency: dashboardFilters?.currency || preferences.currency, startDate: dashboardFilters?.dateRange?.startDate, endDate: dashboardFilters?.dateRange?.endDate });
                const lastStartedAt = recentRankingFetches.get(requestKey) || 0;
                if (Date.now() - lastStartedAt < 800) return;
                recentRankingFetches.set(requestKey, Date.now());

                didStartRequest = true;
                const [rankingsResponse, accountsResponse] = await Promise.all([
                    apiService.dashboard.getCategoryRankings({ 
                        branchId: branchFilter, 
                        financialYearId: selectedYear.id, 
                        targetCurrency: dashboardFilters?.currency || preferences.currency,
                        ...(dashboardFilters?.dateRange?.startDate ? { startDate: dashboardFilters.dateRange.startDate, endDate: dashboardFilters.dateRange.endDate } : {})
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
                            ...item, type: String(item?.type ?? item?.txnType ?? '').trim().toLowerCase(), name: String(item?.name ?? '').trim(), amount: Number(item?.amount || 0)
                        }));
                        setCategories(normalizedRankings);
                        try { sessionStorage.setItem(cacheKey, JSON.stringify({ categories: normalizedRankings, accounts: accountsResponse.success ? (Array.isArray(accountsResponse.data) ? accountsResponse.data : []) : accounts })); } catch {}
                    }
                    if (accountsResponse.success) setAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    if (didStartRequest) setHasFetchedOnce(true);
                }
            }
        };

        const timeoutId = setTimeout(() => { if (rankingsContextReady) fetchRankings(); }, 100);
        return () => { clearTimeout(timeoutId); controller.abort(); };
    }, [rankingsContextReady, location.pathname, user?.id, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, dashboardFilters, branchLoading, yearLoading, getBranchFilterValue, cacheKey]);

    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4 h-full min-h-[300px] auto-rows-fr items-stretch">
            <AccountBalanceList accounts={accounts} initialLoading={showInitialLoader} overlayLoading={showOverlayLoader} hasFetchedOnce={hasFetchedOnce} />
            <PnLBreakdownList categories={categories} initialLoading={showInitialLoader} overlayLoading={showOverlayLoader} hasFetchedOnce={hasFetchedOnce} />
            <InvestmentCardList categories={categories} initialLoading={showInitialLoader} overlayLoading={showOverlayLoader} hasFetchedOnce={hasFetchedOnce} />
        </div>
    );
};

export default CategoryRankings;
