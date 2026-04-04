import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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

const recentRankingFetches = new Map();
const rankingHeaderIconSize = 16;

const bankLogoModules = import.meta.glob('../../../assets/bank-logos/*.{png,jpg,jpeg,svg}', {
    eager: true,
    import: 'default'
});

const normalizeLogoKey = (value = '') => String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

const bankLogoAssets = Object.entries(bankLogoModules).reduce((acc, [path, asset]) => {
    const fileName = path.split('/').pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    acc[normalizeLogoKey(baseName)] = asset;
    return acc;
}, {});

const getBankLogoAsset = ({ bankLogoKey, bankName, bankCode, fallbackBrand }) => {
    const candidates = [
        bankLogoKey,
        bankName,
        bankCode,
        fallbackBrand
    ]
        .filter(Boolean)
        .map((value) => normalizeLogoKey(value));

    for (const key of candidates) {
        if (bankLogoAssets[key]) {
            return bankLogoAssets[key];
        }
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
    const logoAsset = getBankLogoAsset({
        bankLogoKey,
        bankName,
        bankCode,
        fallbackBrand: bankBrand
    });
    const plainIconShellClassName = `${sizeClass} flex items-center justify-center dashboard-laptop-category-avatar shrink-0`;
    const circularFallbackShellClassName = `${sizeClass} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm dashboard-laptop-category-avatar overflow-hidden`;
    const iconImageClassName = cn("h-[18px] w-[18px] object-contain shrink-0", monochrome && "opacity-90");
    const personalIconImageClassName = cn("h-[22px] w-[22px] object-contain shrink-0", monochrome && "opacity-90");
    const iconGlyphShellClassName = "flex h-[18px] w-[18px] items-center justify-center overflow-visible";
    const iconTextClassName = "block w-[18px] text-center text-[7px] leading-none font-black tracking-[-0.04em]";

    if (isCashAccount) {
        return (
            <div className={plainIconShellClassName}>
                <img
                    src={bankLogoAssets.wallet}
                    alt="Cash wallet"
                    className={iconImageClassName}
                />
            </div>
        );
    }

    if (isPersonalAccount && bankLogoAssets.personalaccount) {
        return (
            <div className={plainIconShellClassName}>
                <img
                    src={bankLogoAssets.personalaccount}
                    alt="Personal account"
                    className={personalIconImageClassName}
                />
            </div>
        );
    }

    if (logoAsset) {
        return (
            <div className={plainIconShellClassName}>
                <img
                    src={logoAsset}
                    alt={bankName || bankCode || bankBrand || 'Bank logo'}
                    className={iconImageClassName}
                />
            </div>
        );
    }

    if (bankBrand === 'sbi') {
        return (
            <div className={`${plainIconShellClassName} text-[#2d2a8f]`}>
                <div className={iconGlyphShellClassName}>
                    <div className="relative h-[16px] w-[16px] rounded-full bg-[#1ea7e1]">
                        <div className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                        <div className="absolute left-1/2 bottom-[1px] h-[3px] w-[3px] -translate-x-1/2 bg-white" />
                    </div>
                </div>
            </div>
        );
    }

    if (bankBrand === 'pnb') {
        return (
            <div className={`${plainIconShellClassName} text-[#a02123]`}>
                <span className={`${iconTextClassName} text-[#a02123]`}>PNB</span>
            </div>
        );
    }

    if (bankBrand === 'kotak') {
        return (
            <div className={`${plainIconShellClassName} text-[#1d4ed8]`}>
                <div className={iconGlyphShellClassName}>
                    <div className="relative h-[16px] w-[16px]">
                        <span className="absolute left-0 top-1/2 block h-[12px] w-[12px] -translate-y-1/2 rounded-full bg-[#e63946]" />
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black leading-none tracking-[-0.04em] text-[#1d4ed8]">K</span>
                    </div>
                </div>
            </div>
        );
    }

    if (bankBrand === 'yes') {
        return (
            <div className={`${plainIconShellClassName} text-[#6d28d9]`}>
                <span className={`${iconTextClassName} text-[#6d28d9]`}>YES</span>
            </div>
        );
    }

    if (bankBrand === 'canara') {
        return (
            <div className={`${plainIconShellClassName} text-[#0f9f6e]`}>
                <span className={`${iconTextClassName} text-[#0f9f6e]`}>CNR</span>
            </div>
        );
    }

    if (bankBrand === 'icici') {
        return (
            <div className={plainIconShellClassName}>
                <div className={iconGlyphShellClassName}>
                    <div className="relative h-[18px] w-[18px]">
                        <div className="absolute left-[0px] top-[3px] h-[7px] w-[5px] rounded-[58%_42%_56%_44%/62%_40%_60%_38%] bg-[#f59d21] rotate-[24deg]" />
                        <div className="absolute left-[3px] top-[0px] h-[10px] w-[7px] rounded-[58%_42%_56%_44%/62%_40%_60%_38%] bg-[#b12234] rotate-[18deg]" />
                        <div className="absolute left-[6px] top-[1px] h-[2px] w-[3px] rounded-full bg-white rotate-[-18deg]" />
                        <div className="absolute left-[6px] top-[4px] h-[5px] w-[2px] rounded-full bg-white rotate-[18deg]" />
                        <div className="absolute left-[4px] top-[6px] h-[2px] w-[4px] rounded-full bg-white rotate-[-28deg]" />
                    </div>
                </div>
            </div>
        );
    }

    if (bankCode) {
        return (
            <div className={circularFallbackShellClassName}>
                <span className="block w-[16px] text-center text-[7px] leading-none font-black tracking-[-0.04em] text-slate-600">
                    {String(bankCode).slice(0, 4)}
                </span>
            </div>
        );
    }

    return (
        <div className={`${circularFallbackShellClassName} text-slate-500 font-bold text-[10px] leading-none`}>
            {(name || '?').charAt(0)}
        </div>
    );
};

const CategoryList = ({
    title,
    type,
    allCategories,
    icon,
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
    const totalAbsoluteAmount = filteredCategories.reduce((sum, cat) => sum + Math.abs(Number(cat.amount || 0)), 0);
    const categoriesWithShare = filteredCategories.map((category) => ({
        ...category,
        sharePercent: totalAbsoluteAmount > 0
            ? (Math.abs(Number(category.amount || 0)) / totalAbsoluteAmount) * 100
            : 0
    }));
    const nameColumnTitle = normalizedType === 'account' ? 'Account Name' : 'Category Name';
    const isIncomeCard = normalizedType === 'income';
    const isExpenseCard = normalizedType === 'expense';
    const isInvestmentCard = normalizedType === 'investment';
    const isMetricCategoryCard = isIncomeCard || isExpenseCard || isInvestmentCard;
    const headerIcon = icon;

    return (
        <Card
            title={
                <div className="flex items-center space-x-2 pt-1">
                    {headerIcon ? React.createElement(headerIcon, { size: rankingHeaderIconSize, className: iconColor }) : null}
                    <span className="text-sm font-bold dashboard-laptop-category-title">{title}</span>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full text-right ml-auto dashboard-laptop-category-total">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            }
            noPadding
            className={cn(
                "h-full flex flex-col dashboard-laptop-category-card",
                isMetricCategoryCard && "rounded-[20px] border border-[#F1F5F9] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
            )}
        >
            <div className="flex flex-col h-full min-h-[220px] dashboard-laptop-category-body">
                {/* Header Row mimicking Transaction Table */}
                <div className={cn(
                    "flex justify-between items-center px-4 border-y text-[11px] uppercase tracking-wider font-semibold dashboard-laptop-category-head-row",
                    isMetricCategoryCard
                        ? "py-2 bg-slate-50/70 border-slate-200 text-slate-700"
                        : "bg-gray-50/50 border-gray-200 text-gray-700"
                )}>
                    <span>{nameColumnTitle}</span>
                    <span className={cn("text-right dashboard-laptop-category-value-header", isMetricCategoryCard ? "w-40" : "w-24")}>Amount</span>
                </div>

                <div className="relative p-0 flex-1 overflow-y-auto max-h-[208px] no-scrollbar dashboard-laptop-category-scroll">
                    {initialLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading...</span>
                        </div>
                    ) : categoriesWithShare.length > 0 ? (
                        <div className="divide-y divide-black/[0.04]">
                            {categoriesWithShare.map((cat) => (
                                <div
                                    key={cat.id}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-1 group dashboard-laptop-category-row",
                                        isMetricCategoryCard
                                            ? "min-h-[40px] hover:bg-gray-50 transition-all duration-200"
                                            : "hover:bg-gray-50/50 transition-colors"
                                    )}
                                >
                                    <div className="flex items-center space-x-3">
                                        {!(isIncomeCard || isExpenseCard || isInvestmentCard) && (
                                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs dashboard-laptop-category-avatar">
                                                {(cat.name || '?').charAt(0)}
                                            </div>
                                        )}
                                        <span
                                            className={cn(
                                                "text-[12px] dashboard-laptop-category-name",
                                                isMetricCategoryCard
                                                    ? "font-semibold text-[#111827]"
                                                    : "font-medium text-gray-700"
                                            )}
                                        >
                                            {cat.name}
                                        </span>
                                    </div>
                                    {(isIncomeCard || isExpenseCard || isInvestmentCard) ? (
                                        <div className="w-40 text-right flex flex-col items-end gap-1.5 dashboard-laptop-category-progress-group">
                                            <span className={cn(
                                                "text-[11px] font-extrabold dashboard-laptop-category-amount",
                                                isIncomeCard
                                                    ? "text-[#1f2937]"
                                                    : isExpenseCard
                                                        ? "text-[#1f2937]"
                                                        : "text-[#1f2937]"
                                            )}>
                                                {formatCurrency(cat.amount)}
                                            </span>
                                            <div className="w-full relative">
                                                <div className="h-2.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden dashboard-laptop-category-progress-track">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-[width,filter] duration-[800ms] ease-in-out group-hover:brightness-110",
                                                            isExpenseCard
                                                                ? "bg-gradient-to-r from-[#5b6470] to-[#8f98a6]"
                                                                : "bg-gradient-to-r from-[#5b6470] to-[#8f98a6]"
                                                        )}
                                                        style={{ width: `${Math.max(cat.sharePercent, 4)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-24 text-right dashboard-laptop-category-value-cell">
                                            <span className="text-[12px] font-bold text-gray-700 dashboard-laptop-category-amount">
                                                {formatCurrency(cat.amount)}
                                            </span>
                                        </div>
                                    )}
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
    icon,
    iconColor,
    initialLoading = false,
    overlayLoading = false,
    hasFetchedOnce = false
}) => {
    const { formatCurrency } = usePreferences();
    const [animateBars, setAnimateBars] = useState(false);
    const headerIcon = icon;

    useEffect(() => {
        setAnimateBars(false);
        const frame = window.requestAnimationFrame(() => {
            setAnimateBars(true);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [accounts]);

    const accountItems = (accounts || [])
        .map((acc, index) => {
            const amount = getCurrentBalance(acc);
            return {
                id: acc.id || `acc_${normalizeLogoKey(acc.name || acc.accountName || acc.bankName || 'unknown')}_${index}`,
                displayName: acc.name || acc.accountName || acc.bankName || 'Unknown Account',
                amount,
                isPositive: amount >= 0,
                currency: acc.baseCurrency,
                subtype: acc.subtype ?? acc.subType ?? null,
                subtypeLabel: acc.subtypeLabel || null,
                bankLogoKey: acc.bankLogoKey || null,
                ifsc: acc.ifsc || null,
                bankName: acc.bankName || null,
                bankCode: acc.bankCode || null
            };
        })
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const totalAmount = accountItems.reduce((sum, acc) => sum + acc.amount, 0);
    const totalAbsoluteAmount = accountItems.reduce((sum, acc) => sum + Math.abs(acc.amount), 0);
    const accountItemsWithShare = accountItems.map((account) => ({
        ...account,
        sharePercent: totalAbsoluteAmount > 0
            ? (Math.abs(account.amount) / totalAbsoluteAmount) * 100
            : 0
    }));

    return (
        <Card
            title={
                <div className="flex min-w-0 items-center gap-1.5 pt-1 dashboard-laptop-account-title-wrap">
                    {headerIcon ? React.createElement(headerIcon, { size: rankingHeaderIconSize, className: iconColor }) : null}
                    <span className="text-sm font-bold whitespace-nowrap dashboard-laptop-category-title dashboard-laptop-account-title">{title}</span>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-2 dashboard-laptop-account-total-wrap">
                    <span className="text-[12px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full text-right ml-auto dashboard-laptop-category-total dashboard-laptop-account-total">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            }
            noPadding
            className="h-full flex flex-col dashboard-laptop-category-card relative rounded-[20px] border border-[#F1F5F9] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
        >
            <div className="flex flex-col h-full min-h-[220px] dashboard-laptop-category-body">
                <div className="flex justify-between items-center px-4 py-2 bg-slate-50/70 border-y border-slate-200 text-[11px] text-slate-700 uppercase tracking-wider font-semibold dashboard-laptop-category-head-row">
                    <span>Account Name</span>
                    <span className="w-40 text-right dashboard-laptop-category-value-header">Balance</span>
                </div>

                <div className="relative p-0 flex-1 overflow-y-auto max-h-[208px] no-scrollbar dashboard-laptop-category-scroll">
                    {initialLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 h-full">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading...</span>
                        </div>
                    ) : accountItemsWithShare.length > 0 ? (
                        <div className="divide-y divide-black/[0.04]">
                            {accountItemsWithShare.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between px-4 py-1 hover:bg-gray-50 transition-all duration-200 group dashboard-laptop-category-row dashboard-laptop-account-row cursor-default"
                                >
                                    <div className="flex items-center space-x-3">
                                        <BankAvatar
                                            name={cat.displayName}
                                            bankLogoKey={cat.bankLogoKey}
                                            ifsc={cat.ifsc}
                                            bankName={cat.bankName}
                                            bankCode={cat.bankCode}
                                            subtype={cat.subtype}
                                            subtypeLabel={cat.subtypeLabel}
                                            sizeClass="w-9 h-9"
                                            monochrome
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-semibold text-[#111827] dashboard-laptop-category-name truncate">{cat.displayName}</span>
                                        </div>
                                    </div>
                                    <div className="w-40 text-right flex flex-col items-end gap-1.5 dashboard-laptop-category-progress-group">
                                        <span className={cn(
                                            "text-[11px] font-extrabold dashboard-laptop-account-balance-amount",
                                            cat.isPositive ? "text-[#1f2937]" : "text-[#6b7280]"
                                        )}>
                                            {cat.isPositive ? '' : '-'}{formatCurrency(Math.abs(cat.amount), cat.currency)}
                                        </span>
                                        <div className="w-full relative">
                                            <div className="h-2.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden dashboard-laptop-category-progress-track">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-[width,filter] duration-[800ms] ease-in-out group-hover:brightness-110",
                                                        cat.isPositive
                                                            ? "bg-gradient-to-r from-[#5b6470] to-[#8f98a6]"
                                                            : "bg-gradient-to-r from-[#bcc5d0] to-[#dbe1e8]"
                                                    )}
                                                    style={{ width: animateBars ? `${Math.max(cat.sharePercent, 4)}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
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
    const location = useLocation();
    const { selectedBranch, loading: branchLoading, getBranchFilterValue } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { preferences } = usePreferences();
    const { user } = useAuth(); // NEW: Get user
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const cacheKey = `dashboard:rankings:v5:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}`;
    const rankingsContextReady = Boolean(
        location.pathname === '/dashboard' &&
        !branchLoading &&
        !yearLoading &&
        selectedOrg?.id &&
        selectedYear?.id &&
        (
            user?.role === 'member' ||
            user?.role === 'owner' ||
            selectedBranch?.id
        )
    );

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
        } catch {
            // Ignore cache parse errors and continue with live fetch
        }
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
                const requestKey = JSON.stringify({
                    orgId: selectedOrg?.id || null,
                    yearId: selectedYear?.id || null,
                    branchFilter,
                    currency: preferences.currency || ''
                });
                const lastStartedAt = recentRankingFetches.get(requestKey) || 0;
                if (Date.now() - lastStartedAt < 800) return;
                recentRankingFetches.set(requestKey, Date.now());

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
                            } catch {
                                // Ignore storage errors
                            }
                        }
                        if (accountsResponse.success) {
                            setAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
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
            if (rankingsContextReady) {
                fetchRankings();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [rankingsContextReady, location.pathname, user?.id, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, preferences.currency, branchLoading, yearLoading, getBranchFilterValue, cacheKey]);

    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <div className="dashboard-rankings-grid grid grid-cols-1 md:grid-cols-2 gap-3 xl:gap-4 h-full min-h-0 auto-rows-fr">
            <div className="dashboard-ranking-cell w-full min-h-0">
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
            <div className="dashboard-ranking-cell w-full min-h-0">
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
            <div className="dashboard-ranking-cell w-full min-h-0">
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
            <div className="dashboard-ranking-cell w-full min-h-0">
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
        </div>
    );
};

export default CategoryRankings;
