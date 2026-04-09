import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import isIgnorableRequestError from '../../../utils/isIgnorableRequestError';
import { cn } from '../../../utils/cn';
import { Loader2 } from 'lucide-react';
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
const CardShell = ({ title, children, className }) => (
    <div className={cn("bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full overflow-hidden", className)}>
        <div className="px-5 py-4 border-b border-slate-100 bg-white shrink-0">
            <h3 className="text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
                {title}
            </h3>
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
    const topAccounts = accountItems.slice(0, 5);

    return (
        <CardShell title="Account Balances">
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
                                        <span className="w-32 text-right text-[13px] font-medium text-blue-600">
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
// COLUMN 2: P&L Breakdown
// -------------------------------------------------------------
const PnLBreakdownList = ({ categories, initialLoading, overlayLoading, hasFetchedOnce }) => {
    const { formatCurrency } = usePreferences();
    
    const incomeCats = categories.filter(c => String(c.type).toLowerCase() === 'income').sort((a, b) => b.amount - a.amount);
    const topIncome = incomeCats.slice(0, 2);
    const totalIncomeAbs = incomeCats.reduce((sum, c) => sum + Math.abs(c.amount), 0);

    const expenseCats = categories.filter(c => String(c.type).toLowerCase() === 'expense').sort((a, b) => b.amount - a.amount);
    const topExpense = expenseCats.slice(0, 2);
    const totalExpenseAbs = expenseCats.reduce((sum, c) => sum + Math.abs(c.amount), 0);

    const formatShorthand = (val) => {
        return formatCurrency(val);
    };

    return (
        <CardShell title="P&L Breakdown">
            <div className="flex-1 overflow-y-auto px-5 py-5 relative no-scrollbar">
                {initialLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Top Income</span>
                                <span className="text-[11px] text-slate-700 font-semibold tracking-wider">{formatShorthand(totalIncomeAbs)}</span>
                            </div>
                            <div className="space-y-4">
                                {topIncome.length > 0 ? topIncome.map((cat, i) => {
                                    const percent = totalIncomeAbs > 0 ? Math.round((Math.abs(cat.amount) / totalIncomeAbs) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="w-24 text-[13px] font-medium text-slate-800 truncate shrink-0">{cat.name}</span>
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex items-center">
                                                <div className="h-full bg-emerald-600 rounded-full transition-all duration-1000" style={{ width: `${Math.max(percent, 2)}%` }} />
                                            </div>
                                            <span className="w-8 text-right text-[12px] font-medium text-slate-400 shrink-0">{percent}%</span>
                                        </div>
                                    );
                                }) : <span className="text-[13px] text-slate-400">No income data</span>}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Top Expenses</span>
                                <span className="text-[11px] text-slate-700 font-semibold tracking-wider">{formatShorthand(totalExpenseAbs)}</span>
                            </div>
                            <div className="space-y-4">
                                {topExpense.length > 0 ? topExpense.map((cat, i) => {
                                    const percent = totalExpenseAbs > 0 ? Math.round((Math.abs(cat.amount) / totalExpenseAbs) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="w-24 text-[13px] font-medium text-slate-800 truncate shrink-0">{cat.name}</span>
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex items-center">
                                                <div className="h-full bg-rose-600 rounded-full transition-all duration-1000" style={{ width: `${Math.max(percent, 2)}%` }} />
                                            </div>
                                            <span className="w-8 text-right text-[12px] font-medium text-slate-400 shrink-0">{percent}%</span>
                                        </div>
                                    );
                                }) : <span className="text-[13px] text-slate-400">No expense data</span>}
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
                                        <span className="text-[11px] font-medium text-blue-600 mt-0.5">
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
const CategoryRankings = () => {
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
    
    const cacheKey = `dashboard:rankings:layout_v5:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}`;
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
                const requestKey = JSON.stringify({ orgId: selectedOrg?.id, yearId: selectedYear?.id, branchFilter, currency: preferences.currency });
                const lastStartedAt = recentRankingFetches.get(requestKey) || 0;
                if (Date.now() - lastStartedAt < 800) return;
                recentRankingFetches.set(requestKey, Date.now());

                didStartRequest = true;
                const [rankingsResponse, accountsResponse] = await Promise.all([
                    apiService.dashboard.getCategoryRankings({ branchId: branchFilter, financialYearId: selectedYear.id, targetCurrency: preferences.currency }, { signal: controller.signal }),
                    apiService.accounts.getAll({ branchId: 'all', financialYearId: selectedYear.id, targetCurrency: preferences.currency }, { signal: controller.signal }).catch(() => ({ success: false, data: [] }))
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
    }, [rankingsContextReady, location.pathname, user?.id, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, cacheKey]);

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
