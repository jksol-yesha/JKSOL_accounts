import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Edit,
    Trash2,
    Plus,
    Search,
    Copy,
    Check,
    ChevronDown,
    ChevronRight,
    ArrowUpDown,
    Loader2
} from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import { Can } from '../../hooks/usePermission';

import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import MobilePagination from '../../components/common/MobilePagination';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import apiService from '../../services/api';
import { cn } from '../../utils/cn';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_SUBTYPE_LABELS } from './constants';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import { TRANSACTION_DATA_CHANGED_EVENT } from '../transactions/transactionDataSync';
import { useToast } from '../../context/ToastContext';

const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    name: '',
    loading: false
});

const isUsedAccountDeleteError = (message) => {
    const value = String(message || '');
    return /cannot delete this account because it is used in associated records/i.test(value)
        || /modify (the )?status to 'inactive'/i.test(value);
};

const normalizeAccount = (account) => ({
    ...account,
    accountNumber: account.accountNumber ?? account.account_number ?? null,
    accountHolderName: account.accountHolderName ?? account.account_holder_name ?? '',
    bankName: account.bankName ?? account.bank_name ?? null,
    ifsc: account.ifsc ?? null,
    zipCode: account.zipCode ?? account.zip_code ?? null,
    swiftCode: account.swiftCode ?? account.zipCode ?? account.zip_code ?? null,
    bankBranchName: account.bankBranchName ?? account.bank_branch_name ?? null,
    createdAt: account.createdAt ?? account.created_at ?? null,
    creatorName: account.creator?.fullName || '-',
    createdByDisplayName: account.lastEditor?.fullName || account.creator?.fullName || '-'
});

const getBankDetailItems = (account) => ([
    { label: 'Account Holder Name', value: account.accountHolderName?.trim() || 'N/A' },
    { label: 'Bank Name', value: account.bankName?.trim() || 'N/A' },
    { label: 'Account No', value: account.accountNumber?.trim() || 'N/A' },
    { label: 'IFSC Code', value: account.ifsc?.trim() || 'N/A' },
    { label: 'Swift Code', value: account.swiftCode?.trim() || 'N/A' },
    { label: 'Branch Name', value: account.bankBranchName?.trim() || 'N/A' }
]);

const buildBankDetailsClipboardText = (account) => (
    ['Bank Details', ...getBankDetailItems(account).map((item) => `${item.label}: ${item.value}`)].join('\n')
);

const copyTextToClipboard = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    if (typeof document === 'undefined') {
        throw new Error('Clipboard is not available');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
        throw new Error('Copy failed');
    }
};

const getDisplayBalance = (account) => {
    // API returns convertedBalance in target/base currency; fallback to raw openingBalance.
    const value = account?.convertedBalance ?? account?.openingBalance ?? 0;
    return Number(value) || 0;
};

const getDisplayClosingBalance = (account) => {
    const value = account?.closingBalance ?? account?.convertedClosingBalance ?? account?.closing_balance ?? account?.openingBalance ?? 0;
    return Number(value) || 0;
};

const parseTransferAmount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.abs(numeric);
};

const deserializeOweMap = (entries) => {
    if (!Array.isArray(entries)) return new Map();
    return new Map(entries.filter((entry) => Array.isArray(entry) && entry.length === 2));
};

const BranchTooltip = ({ branchNames }) => {
    if (!branchNames || branchNames.length === 0) return <span className="text-gray-400 text-xs">-</span>;

    const displayText = branchNames.join(', ');
    const needsTooltip = branchNames.length > 1 || displayText.length > 18;

    return (
        <span className="relative inline-block max-w-full group/branch">
            <span className="block truncate max-w-[120px] text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                {displayText}
            </span>
            {needsTooltip && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 opacity-0 group-hover/branch:opacity-100 transition-opacity duration-150 pointer-events-none">
                    <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Branches</span>
                    {branchNames.map((branchName, idx) => (
                        <span key={idx} className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-gray-700 truncate">{branchName}</span>
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
};

const DescriptionTooltip = ({ description }) => {
    if (!description) return <span className="text-xs text-gray-500">-</span>;

    const needsTooltip = description.length > 18;

    return (
        <span className="relative inline-block max-w-full group/desc">
            <span className="text-xs text-gray-500 truncate max-w-[130px] inline-block hover:text-gray-700 transition-colors">
                {description}
            </span>
            {needsTooltip && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 opacity-0 group-hover/desc:opacity-100 transition-opacity duration-150 pointer-events-none">
                    <span className="text-[12px] font-semibold text-gray-700 break-words leading-relaxed">
                        {description}
                    </span>
                </span>
            )}
        </span>
    );
};

const ACCOUNT_NAME_TOOLTIP_MAX_WIDTH = 280;
const ACCOUNT_NAME_TOOLTIP_MIN_WIDTH = 160;
const ACCOUNT_NAME_TOOLTIP_GAP = 8;
const ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER = 12;

const AccountNameTooltip = ({ name, className = '', textClassName = '' }) => {
    const [visible, setVisible] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);
    const textRef = useRef(null);
    const content = name || '-';
    const shouldEnableTooltip = isTruncated || content.trim().length >= 18;

    const measureTruncation = () => {
        const wrapperNode = wrapperRef.current;
        const textNode = textRef.current;
        if (!wrapperNode || !textNode) return false;

        const truncated = (
            textNode.scrollWidth > textNode.clientWidth + 1 ||
            wrapperNode.scrollWidth > wrapperNode.clientWidth + 1
        );

        setIsTruncated(truncated);
        return truncated;
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let frameId = null;

        const scheduleMeasurement = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                measureTruncation();
            });
        };

        scheduleMeasurement();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => scheduleMeasurement())
            : null;

        if (wrapperRef.current) {
            resizeObserver?.observe(wrapperRef.current);
        }
        if (textRef.current) {
            resizeObserver?.observe(textRef.current);
        }

        window.addEventListener('resize', scheduleMeasurement);
        document.fonts?.ready?.then(() => scheduleMeasurement()).catch(() => {});

        return () => {
            window.removeEventListener('resize', scheduleMeasurement);
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            resizeObserver?.disconnect();
        };
    }, [name]);

    useLayoutEffect(() => {
        if (!visible || !wrapperRef.current) return undefined;

        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const tooltipWidth = Math.min(
                ACCOUNT_NAME_TOOLTIP_MAX_WIDTH,
                Math.max(ACCOUNT_NAME_TOOLTIP_MIN_WIDTH, rect.width + 24)
            );

            let left = rect.left;
            if (left + tooltipWidth > viewportWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = viewportWidth - tooltipWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }
            if (left < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            let top = rect.bottom + ACCOUNT_NAME_TOOLTIP_GAP;
            const estimatedHeight = 44;
            if (top + estimatedHeight > viewportHeight - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = rect.top - estimatedHeight - ACCOUNT_NAME_TOOLTIP_GAP;
            }
            if (top < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            setPosition({ top, left, width: tooltipWidth });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [visible]);

    return (
        <>
            <span
                ref={wrapperRef}
                className={cn('block max-w-full min-w-0', className)}
                onMouseEnter={() => {
                    if (measureTruncation() || content.trim().length >= 18) {
                        setVisible(true);
                    }
                }}
                onMouseLeave={() => setVisible(false)}
                title={shouldEnableTooltip ? content : undefined}
            >
                <span ref={textRef} className={cn('block truncate', textClassName)}>
                    {content}
                </span>
            </span>

            {visible && position && createPortal(
                <div
                    className="pointer-events-none fixed z-[240] rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                    style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px` }}
                >
                    <span className="block whitespace-nowrap text-[12px] font-semibold leading-relaxed text-gray-700">
                        {content}
                    </span>
                </div>,
                document.body
            )}
        </>
    );
};

const MobileAccountField = ({
    label,
    value,
    align = 'left',
    colSpan = 1,
    valueClassName = ''
}) => (
    <div className={cn("min-w-0 space-y-0.5", colSpan === 2 && "col-span-2", align === 'right' && "text-right")}>
        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">{label}</div>
        <div className={cn("text-xs font-medium text-gray-600 break-words", align === 'right' && "text-right", valueClassName)}>
            {value}
        </div>
    </div>
);

const Accounts = () => {
    const location = useLocation();
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const { showToast } = useToast();
    const { formatCurrency, formatDate, preferences } = usePreferences();

    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [oweMap, setOweMap] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const [dataRefreshTick, setDataRefreshTick] = useState(0);
    const [expandedRows, setExpandedRows] = useState({});
    const [copiedBankDetailsId, setCopiedBankDetailsId] = useState(null);
    const [settlementModal, setSettlementModal] = useState({ open: false, account: null, items: [], currency: null, loading: false });
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    const [isDesktopView, setIsDesktopView] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
    );

    const [pageSize] = useState(20); // Show 20 rows per page as requested
    const [currentPage, setCurrentPage] = useState(1);
    const cacheKey = `accounts:list:${selectedYear?.id || 'fy'}:${preferences.currency || 'currency'}`;
    const getAccountOweValue = (account) => {
        return oweMap.get(Number(account?.id)) || 0;
    };

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.accounts)) {
                setAccounts(parsed.accounts);
            }
            if (Array.isArray(parsed?.oweEntries)) {
                setOweMap(deserializeOweMap(parsed.oweEntries));
            }
            if (Array.isArray(parsed?.accounts) || Array.isArray(parsed?.oweEntries)) {
                setHasFetchedOnce(true);
            }
        } catch {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    useEffect(() => {
        const handleTransactionDataChanged = () => {
            setDataRefreshTick((current) => current + 1);
        };

        window.addEventListener(TRANSACTION_DATA_CHANGED_EVENT, handleTransactionDataChanged);
        return () => window.removeEventListener(TRANSACTION_DATA_CHANGED_EVENT, handleTransactionDataChanged);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const fetchAccounts = async () => {
            if (location.pathname !== '/accounts') {
                return;
            }
            // Rankings endpoint requires financialYearId; skip fetch until YearContext is ready.
            if (!selectedYear?.id) {
                setLoading(false);
                return;
            }

            // Bypass global branch filter: Always fetch 'all' branches
            setLoading(true);
            try {
                const [accountsResponse, rankingsResponse] = await Promise.all([
                    apiService.accounts.getAll({
                        financialYearId: selectedYear?.id
                    }, { signal: controller.signal }),
                    apiService.dashboard.getCategoryRankings({
                        branchId: 'all',
                        financialYearId: selectedYear?.id,
                        type: 'transfer_balance' // This gives us transfer details to compute inter-account owing
                    }, { signal: controller.signal }).catch(() => ({ success: false, data: [] }))
                ]);

                let fetchedAccounts = [];
                if (accountsResponse.success) {
                    fetchedAccounts = (accountsResponse.data || []).map(normalizeAccount);
                    setAccounts(fetchedAccounts);
                } else {
                    setAccounts([]);
                }

                if (rankingsResponse.success && rankingsResponse.data) {
                    const newOweMap = new Map();
                    const transfers = rankingsResponse.data.filter(c => c.type === 'transfer_balance');

                    const applyDelta = (accountId, delta) => {
                        if (!accountId) return;
                        const id = Number(accountId);
                        newOweMap.set(id, (newOweMap.get(id) || 0) + delta);
                    };

                    transfers.forEach(t => {
                        const txnType = String(t.txnType || t.transactionType || t.type || '').toLowerCase();
                        const isInvestmentTxn = txnType === 'investment';

                        const owingAccountId = t.owingAccountId || t.fromAccountId;
                        const owedAccountId = t.owedAccountId || t.toAccountId;

                        // Build a set of investment account IDs to exclude them from net settlement
                        const investmentAccountIds = new Set(
                            fetchedAccounts
                                .filter(a => Number(a.accountType) === 1 && Number(a.subtype) === 14)
                                .map(a => Number(a.id))
                        );

                        // Skip if it's explicitly an investment transaction or involves an investment account
                        if (isInvestmentTxn || (owingAccountId && investmentAccountIds.has(Number(owingAccountId))) || (owedAccountId && investmentAccountIds.has(Number(owedAccountId)))) {
                            return;
                        }

                        const amount = parseTransferAmount(t.amount ?? t.value ?? t.totalAmount);

                        if (!owingAccountId || !owedAccountId || amount === 0) return;

                        // `owingAccountId` is the account that owes the money (it received the transfer and now must PAY it back) -> negative (-)
                        // `owedAccountId` is the account that is owed the money (it sent the transfer and will RECEIVE it back) -> positive (+)
                        applyDelta(owingAccountId, -amount);
                        applyDelta(owedAccountId, +amount);
                    });
                    setOweMap(newOweMap);
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify({
                            accounts: fetchedAccounts,
                            oweEntries: Array.from(newOweMap.entries())
                        }));
                    } catch {
                        // Ignore storage errors
                    }
                } else {
                    setOweMap(new Map());
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify({
                            accounts: fetchedAccounts,
                            oweEntries: []
                        }));
                    } catch {
                        // Ignore storage errors
                    }
                }

            } catch (error) {
                if (isIgnorableRequestError(error)) return;

                console.error("Failed to fetch accounts:", error);
                setAccounts([]);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setHasFetchedOnce(true);
                }
            }
        };

        if (location.pathname === '/accounts') {
            fetchAccounts();
        }

        return () => controller.abort();
    }, [location.pathname, cacheKey, preferences.currency, selectedYear?.id, dataRefreshTick]);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktopView(window.innerWidth >= 1280);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);





    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAccounts = useMemo(() => {
        let result = [...accounts];

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter((account) => {
                const branchText = Array.isArray(account.branchNames) ? account.branchNames.join(' ') : '';
                return (
                    String(account.name || account.bankName || account.accountName || '').toLowerCase().includes(term) ||
                    String(account.typeLabel || '').toLowerCase().includes(term) ||
                    String(account.subtypeLabel || '').toLowerCase().includes(term) ||
                    String(account.description || '').toLowerCase().includes(term) ||
                    String(account.createdByDisplayName || account.creatorName || '').toLowerCase().includes(term) ||
                    String(branchText).toLowerCase().includes(term)
                );
            });
        }

        // Sorting
        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle composite or special keys
                if (sortConfig.key === 'name') {
                    aValue = (a.name || a.bankName || '') + (a.accountName || '');
                    bValue = (b.name || b.bankName || '') + (b.accountName || '');
                } else if (sortConfig.key === 'openingBalanceDate') {
                    aValue = new Date(a.openingBalanceDate || 0).getTime();
                    bValue = new Date(b.openingBalanceDate || 0).getTime();
                } else if (sortConfig.key === 'createdAt') {
                    aValue = new Date(a.createdAt || 0).getTime();
                    bValue = new Date(b.createdAt || 0).getTime();
                } else if (sortConfig.key === 'openingBalance') {
                    aValue = getDisplayBalance(a);
                    bValue = getDisplayBalance(b);
                } else if (sortConfig.key === 'closingBalance') {
                    aValue = getDisplayClosingBalance(a);
                    bValue = getDisplayClosingBalance(b);
                }

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                aValue = String(aValue || '').toLowerCase();
                bValue = String(bValue || '').toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [accounts, sortConfig, oweMap, searchTerm]);

    // Pagination
    const totalPages = Math.ceil(filteredAccounts.length / pageSize);
    const paginatedAccounts = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredAccounts.slice(startIndex, startIndex + pageSize);
    }, [filteredAccounts, currentPage, pageSize]);

    // Sorting Handler
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    const handleCreateAccount = () => {
        navigate('/accounts/create');
    };

    const handleDelete = (account) => {
        setDeleteDialog({
            open: true,
            id: account.id,
            name: account.name || account.bankName || account.accountName || '',
            loading: false
        });
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialog((current) => (
            current.loading ? current : createInitialDeleteDialog()
        ));
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog.id) return;

        setDeleteDialog((current) => ({ ...current, loading: true }));

        try {
            await apiService.accounts.delete(deleteDialog.id);
            setAccounts(prev => prev.filter(a => a.id !== deleteDialog.id));
            setDeleteDialog(createInitialDeleteDialog());
        } catch (error) {
            console.error("Failed to delete account:", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete account";
            setDeleteDialog(createInitialDeleteDialog());
            showToast(
                msg,
                'error',
                isUsedAccountDeleteError(msg)
                    ? {
                        persistent: true,
                        duration: 0
                    }
                    : undefined
            );
        }
    };

    const handleToggleStatus = async (id, currentIsActive) => {
        try {
            const newIsActive = !currentIsActive;
            await apiService.accounts.update(id, { isActive: newIsActive });

            // Hardcode to 'all' to ensure everything correctly repopulates ignoring global filter
            const response = await apiService.accounts.getAll({ currency: preferences.currency });
            if (response.success) {
                setAccounts((response.data || []).map(normalizeAccount));
            }

        } catch (error) {
            console.error("Failed to toggle status:", error);
            // Optionally, show an error message to the user
            const msg = error.response?.data?.message || error.message || "Failed to update account status";
            showToast(msg, 'error');
        }
    };

    const isAssetBankAccount = (account) => (
        Number(account.accountType) === 1 && Number(account.subtype) === 12
    );

    const toggleExpandedRow = (id) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        if (!copiedBankDetailsId) return undefined;

        const timeoutId = window.setTimeout(() => {
            setCopiedBankDetailsId(null);
        }, 1600);

        return () => window.clearTimeout(timeoutId);
    }, [copiedBankDetailsId]);

    const handleCopyBankDetails = async (account) => {
        try {
            await copyTextToClipboard(buildBankDetailsClipboardText(account));
            setCopiedBankDetailsId(account.id);
            showToast('Bank details copied', 'success');
        } catch (error) {
            console.error('Failed to copy bank details:', error);
            showToast('Failed to copy bank details', 'error');
        }
    };

    const openSettlementModal = async (account) => {
        setSettlementModal({ open: true, account, items: [], currency: account?.baseCurrency || preferences.currency, loading: true });
        try {
            const res = await apiService.accounts.getNetSettlement(account.id);
            if (res?.success && res?.data) {
                setSettlementModal(prev => ({
                    ...prev,
                    items: Array.isArray(res.data.items) ? res.data.items : [],
                    currency: res.data.currency || prev.currency,
                    loading: false
                }));
            } else {
                setSettlementModal(prev => ({ ...prev, items: [], loading: false }));
            }
        } catch (e) {
            console.error('Failed to fetch net settlement:', e);
            setSettlementModal(prev => ({ ...prev, items: [], loading: false }));
        }
    };

    const closeSettlementModal = () => {
        setSettlementModal({ open: false, account: null, items: [], currency: null, loading: false });
    };

    const tableColSpan = 8;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <div className="accounts-tablet-page flex flex-col h-full min-h-0 overflow-hidden">
            <style>{`
                @media print {
                    @page { margin: 15mm; size: A4 portrait; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        background: white !important; 
                        color: black !important; 
                        font-family: Arial, Helvetica, sans-serif !important;
                    }
                    /* Hide non-print elements */
                    nav, aside, header, footer, .sidebar, .print\\:hidden, .hidden.print\\:hidden, button { display: none !important; }
                    
                    /* Reset layout for print */
                    .min-h-screen, .h-screen { height: auto !important; min-height: 0 !important; }
                    .overflow-hidden { overflow: visible !important; }
                    .overflow-y-auto { overflow: visible !important; }
                    .overflow-x-auto { overflow: visible !important; }
                    .max-h-\\[720px\\] { max-height: none !important; }
                    .flex-1 { flex: none !important; }
                    .shadow-\\[0_8px_30px_rgb\\(0\\,0\\,0\\,0\\.04\\)\\] { box-shadow: none !important; border: none !important; }
                    .bg-gray-50\\/50, .bg-gray-50\\/95 { background: white !important; }
                    
                    /* Ensure table visibility */
                    table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin-top: 20px; table-layout: fixed !important; }
                    th { border: 1px solid #000 !important; border-bottom: 2px solid #000 !important; color: black !important; font-weight: bold !important; text-align: left !important; padding: 8px !important; font-size: 11px !important; text-transform: uppercase; background: transparent !important; white-space: normal !important; overflow-wrap: break-word !important; }
                    td { border: 1px solid #000 !important; color: black !important; padding: 6px 8px !important; font-size: 11px !important; vertical-align: middle; background: transparent !important; word-break: break-word !important; overflow-wrap: break-word !important; white-space: normal !important; text-align: left !important; }
                    
                    /* Hide Action Column in Print */
                    th:last-child, td:last-child { display: none !important; }

                    /* Remove Sorting Symbols & Badges */
                    .lucide { display: none !important; }
                    
                    /* Show Print Header */
                    .print-header { display: block !important; margin-bottom: 20px; }
                    
                    /* Force Align Headers Left (overriding flex justify-end) by default */
                    th > div { justify-content: flex-start !important; }

                    /* Center Align Opening Balance (4th Column) */
                    th:nth-child(4), td:nth-child(4) { text-align: center !important; }
                    th:nth-child(4) > div { justify-content: center !important; }
                }
                .print-header, .print-footer { display: none; }
            `}</style>

            {/* Print Header */}
            <div className="print-header">
                <h1 className="text-2xl font-bold uppercase tracking-wider text-center mb-4 text-black">Account List</h1>
                <div className="flex justify-start border-b border-black pb-2 mb-4">
                    <span className="text-sm font-bold text-gray-800">Date: {new Date().toLocaleDateString()}</span>
                </div>
            </div>

            <PageContentShell
                header={(
                    <PageHeader
                        title="Accounts"
                        breadcrumbs={['Accounts', 'List']}
                    />
                )}
            >

                {/* Toolbar */}
                <div className="p-4 flex flex-row items-center justify-between gap-4 border-b border-gray-50 relative print:hidden min-h-[74px]">
                    <div className="relative hidden xl:block w-64">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search accounts..."
                            className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3 flex-1 xl:hidden">
                        <div className="relative group w-full max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search accounts..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f9] border border-transparent rounded-xl text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                        {/* Create Button */}
                        <button
                            onClick={handleCreateAccount}
                            className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                            title="Add New Account"
                        >
                            <Plus size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>



                {!isDesktopView && (
                    <>
                        <div className="relative flex-1 p-4 print:hidden overflow-y-auto min-h-0 no-scrollbar" aria-busy={loading}>
                            <div className="relative min-h-full">
                                {showInitialLoader ? (
                                    <div className="py-12 flex items-center justify-center">
                                        <Loader2 size={26} className="text-gray-500 animate-spin" />
                                    </div>
                                ) : paginatedAccounts.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {paginatedAccounts.map((account, index) => {
                                            const syntheticId = (currentPage - 1) * pageSize + index + 1;
                                            const hasAccountNumber = Boolean(String(account.accountNumber || '').trim());
                                            const hasIfsc = Boolean(String(account.ifsc || '').trim());
                                            const hasSwiftCode = Boolean(String(account.swiftCode || '').trim());
                                            const hasBankBranchName = Boolean(String(account.bankBranchName || '').trim());
                                            const hasDescription = Boolean(String(account.description || '').trim());
                                            const openingBalanceDisplay = formatCurrency(getDisplayBalance(account), account.baseCurrency);
                                            const oweValue = getAccountOweValue(account);
                                            const closingBalance = getDisplayClosingBalance(account);
                                            return (
                                                <div key={account.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3 accounts-tablet-card">
                                                    <div className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2 text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">
                                                                <span className="font-mono">{syntheticId}</span>
                                                                <span>Bank Name</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => openSettlementModal(account)}
                                                                className="text-sm font-bold text-gray-800 hover:text-primary transition-colors text-left"
                                                            >
                                                                {account.name || account.bankName}
                                                            </button>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Opening Balance</div>
                                                            <div className="text-sm font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                                                                {openingBalanceDisplay}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 accounts-tablet-card-grid">
                                                        <MobileAccountField
                                                            label="Type"
                                                            value={account.typeLabel || '-'}
                                                        />
                                                        <MobileAccountField
                                                            label="Subtype"
                                                            value={account.subtypeLabel || '-'}
                                                            align="right"
                                                        />
                                                        <MobileAccountField
                                                            label="Date"
                                                            value={formatDate(account.openingBalanceDate)}
                                                        />
                                                        <MobileAccountField
                                                            label="Opening Balance"
                                                            value={openingBalanceDisplay}
                                                            align="right"
                                                            valueClassName="font-bold text-emerald-600 tabular-nums whitespace-nowrap"
                                                        />
                                                        <MobileAccountField
                                                            label="Net Balance"
                                                            value={oweValue === 0 ? '-' : `${oweValue > 0 ? '+' : '-'}${formatCurrency(Math.abs(oweValue), account.baseCurrency)}`}
                                                            valueClassName={cn(
                                                                oweValue === 0
                                                                    ? "font-medium text-gray-400"
                                                                    : cn(
                                                                        "font-bold tabular-nums whitespace-nowrap",
                                                                        oweValue > 0 ? "text-emerald-600" : "text-rose-600"
                                                                    )
                                                            )}
                                                        />
                                                        <MobileAccountField
                                                            label="Closing Balance"
                                                            value={formatCurrency(closingBalance, account.baseCurrency)}
                                                            align="right"
                                                            valueClassName={cn(
                                                                "font-bold tabular-nums whitespace-nowrap",
                                                                closingBalance > 0 ? "text-emerald-600" : closingBalance < 0 ? "text-rose-600" : "text-gray-600"
                                                            )}
                                                        />
                                                        {hasDescription && (
                                                            <MobileAccountField
                                                                label="Description"
                                                                value={account.description}
                                                                colSpan={2}
                                                            />
                                                        )}
                                                        <MobileAccountField
                                                            label="Status"
                                                            value={(
                                                                <button
                                                                    onClick={() => handleToggleStatus(account.id, account.isActive)}
                                                                    className={cn(
                                                                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 cursor-pointer",
                                                                        (account.status === 2 || account.status === 'inactive')
                                                                            ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                                    )}
                                                                >
                                                                    {(account.status === 2 || account.status === 'inactive') ? 'INACTIVE' : 'ACTIVE'}
                                                                </button>
                                                            )}
                                                        />
                                                        <MobileAccountField
                                                            label="Created By"
                                                            value={account.createdByDisplayName || '-'}
                                                            align="right"
                                                        />
                                                        {(hasAccountNumber || hasIfsc) && (
                                                            <>
                                                                {hasAccountNumber ? (
                                                                    <MobileAccountField
                                                                        label="Account No"
                                                                        value={account.accountNumber}
                                                                        valueClassName="tabular-nums break-all"
                                                                    />
                                                                ) : <div aria-hidden="true" />}
                                                                {hasIfsc ? (
                                                                    <MobileAccountField
                                                                        label="IFSC Code"
                                                                        value={account.ifsc}
                                                                        align="right"
                                                                    />
                                                                ) : <div aria-hidden="true" />}
                                                            </>
                                                        )}
                                                        {isAssetBankAccount(account) && (
                                                            <>
                                                                {(hasSwiftCode || hasBankBranchName) && (
                                                                    <>
                                                                        {hasSwiftCode ? (
                                                                            <MobileAccountField
                                                                                label="Swift Code"
                                                                                value={account.swiftCode}
                                                                            />
                                                                        ) : <div aria-hidden="true" />}
                                                                        {hasBankBranchName ? (
                                                                            <MobileAccountField
                                                                                label="Branch Name"
                                                                                value={account.bankBranchName}
                                                                                align="right"
                                                                            />
                                                                        ) : <div aria-hidden="true" />}
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                                        <button
                                                            onClick={() => {
                                                                navigate('/accounts/create', { state: { account } });
                                                            }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[10px] hover:bg-indigo-100 transition-colors"
                                                        >
                                                            <Edit size={12} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(account)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 font-bold text-[10px] hover:bg-rose-100 transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    hasFetchedOnce && <div className="py-12 text-center text-gray-400 font-medium text-sm">
                                        No accounts found.
                                    </div>
                                )}
                                {showOverlayLoader && <LoadingOverlay label="Loading accounts..." />}
                            </div>
                        </div>
                        <div className="xl:hidden border-t border-gray-100 p-2 print:hidden">
                            <MobilePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </>
                )}

                {/* Table View */}
                {(isDesktopView || typeof window === 'undefined') && (
                    <div className="relative print:block flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar accounts-laptop-table-scroll" aria-busy={loading}>
                        <table className="w-full text-left border-collapse table-fixed accounts-laptop-table">
                            <thead className="sticky top-0 z-10 bg-white">
                                <tr className="bg-gray-50/50 border-y border-gray-200">
                                    {(() => {
                                        const cols = [
                                            { label: 'Name', key: 'name', width: 'w-[18%]', align: 'text-left' },
                                            { label: 'Subtype', key: 'subtypeLabel', width: 'w-[11%]', align: 'text-left' },
                                            { label: 'Date', key: 'openingBalanceDate', width: 'w-[10%]', align: 'text-left' },
                                            { label: 'Opening Balance', key: 'openingBalance', width: 'w-[15%]', align: 'text-right' },
                                            { label: 'Closing Balance', key: 'closingBalance', width: 'w-[15%]', align: 'text-right' },
                                            { label: 'Status', key: 'isActive', width: 'w-[10%]', align: 'text-left' },
                                            { label: 'Created By', key: 'createdByDisplayName', width: 'w-[11%]', align: 'text-left' }
                                        ];
                                        return cols.map((col) => (
                                            <th
                                                key={col.label}
                                                className={cn(
                                                    `${col.width} sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-4 py-2 ${col.align} text-[11px] font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 group whitespace-nowrap`,
                                                    col.key === 'subtypeLabel' && "pr-4",
                                                    (col.key === 'openingBalance' || col.key === 'closingBalance') && "accounts-laptop-balance-header",
                                                    col.key === 'openingBalanceDate' && "pl-4",
                                                    col.key === 'openingBalance' && "pl-1",
                                                    col.key === 'closingBalance' && "pr-8",
                                                    col.key === 'isActive' && "pl-8"
                                                )}
                                                onClick={() => handleSort(col.key)}
                                            >
                                                <div className={cn(
                                                    "flex items-center gap-1",
                                                    col.align === 'text-right' ? "justify-end" : col.align === 'text-center' ? "justify-center" : "",
                                                    (col.key === 'openingBalance' || col.key === 'closingBalance') && "accounts-laptop-sort-header"
                                                )}>
                                                    <span className={cn(
                                                        (col.key === 'openingBalance' || col.key === 'closingBalance') && "accounts-laptop-balance-label"
                                                    )}>
                                                        {col.label}
                                                    </span>
                                                    <ArrowUpDown
                                                        size={10}
                                                        className={cn(
                                                            "shrink-0 text-gray-400 group-hover:text-gray-600 transition-opacity",
                                                            sortConfig.key === col.key ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                                                        )}
                                                    />
                                                </div>
                                            </th>
                                        ));
                                    })()}
                                    <th className="w-[7%] sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-4 py-2 pr-6 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        <div className="ml-auto w-12 text-left">Action</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {showInitialLoader ? (
                                    <tr>
                                        <td colSpan={tableColSpan} className="px-6 py-8">
                                            <div className="flex items-center justify-center">
                                                <Loader2 size={24} className="text-gray-500 animate-spin" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : hasFetchedOnce && filteredAccounts.length === 0 ? (
                                    <tr><td colSpan={tableColSpan} className="px-6 py-8 text-center text-sm text-gray-500">No accounts found.</td></tr>
                                ) : (
                                    paginatedAccounts.map((account) => {
                                        const showExpand = isAssetBankAccount(account);
                                        const isExpanded = !!expandedRows[account.id];
                                        return (
                                            <React.Fragment key={account.id}>
                                                <tr className="group hover:bg-gray-50/50">
                                                    <td className="px-4 py-1.5 text-xs font-bold text-gray-800">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {showExpand ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleExpandedRow(account.id)}
                                                                    className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                                                                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                                                                >
                                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                </button>
                                                            ) : (
                                                                <span className="w-[14px] shrink-0" />
                                                            )}
                                                            <AccountNameTooltip
                                                                name={account.name}
                                                                className="flex-1 min-w-0"
                                                                textClassName="text-xs font-bold text-gray-800 text-left cursor-default"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-1.5 pr-4 whitespace-nowrap">
                                                        <span className="text-xs font-medium text-gray-600">
                                                            {account.subtypeLabel || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1.5 pl-4 whitespace-nowrap text-left text-xs text-gray-600 font-medium">
                                                        {formatDate(account.openingBalanceDate)}
                                                    </td>
                                                    <td className="px-4 py-1.5 pl-1 text-xs font-black tabular-nums text-right whitespace-nowrap">
                                                        <span className={`text-xs font-black ${getDisplayBalance(account) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {account.baseCurrency === 'INR'
                                                                ? formatCurrency(getDisplayBalance(account), account.baseCurrency).replace('INR', '').trim()
                                                                : formatCurrency(getDisplayBalance(account), account.baseCurrency)
                                                            }
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1.5 pr-8 text-xs font-black tabular-nums text-right whitespace-nowrap">
                                                        <span className={cn(
                                                            "text-xs font-black",
                                                            getDisplayClosingBalance(account) > 0 ? "text-emerald-600" : getDisplayClosingBalance(account) < 0 ? "text-rose-600" : "text-gray-600"
                                                        )}>
                                                            {formatCurrency(getDisplayClosingBalance(account), account.baseCurrency)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1.5 pl-8 text-left">
                                                        <button
                                                            onClick={() => handleToggleStatus(account.id, account.isActive)}
                                                            className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 cursor-pointer",
                                                                (account.status === 2 || account.status === 'inactive')
                                                                    ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                            )}
                                                        >
                                                            {(account.status === 2 || account.status === 'inactive') ? 'Inactive' : 'Active'}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                                        <span className="text-xs font-medium text-gray-500">
                                                            {account.createdByDisplayName || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1.5 pr-6 print:hidden">
                                                        <div className="ml-auto flex w-12 items-center gap-0.5">
                                                            <button
                                                                onClick={() => {
                                                                    navigate('/accounts/create', { state: { account } });
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                title="Edit"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(account)}
                                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {showExpand && isExpanded && (
                                                    <tr>
                                                        <td colSpan={tableColSpan} className="px-4 py-2">
                                                            <div className="ml-6 inline-flex max-w-full animate-in fade-in duration-200 align-middle">
                                                                <div className="inline-flex w-fit min-w-[28.5rem] max-w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                                                    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-100 px-3 py-2">
                                                                        <h4 className="text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-700">
                                                                            Bank Details
                                                                        </h4>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopyBankDetails(account)}
                                                                            className="inline-flex items-center rounded-md p-1 text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900"
                                                                            aria-label={copiedBankDetailsId === account.id ? 'Copied' : 'Copy bank details'}
                                                                            title={copiedBankDetailsId === account.id ? 'Copied' : 'Copy bank details'}
                                                                        >
                                                                            {copiedBankDetailsId === account.id ? <Check size={13} /> : <Copy size={13} />}
                                                                        </button>
                                                                    </div>
                                                                    <div className="px-3 pt-0 pb-0 text-left text-xs leading-5">
                                                                        {getBankDetailItems(account).map((item) => (
                                                                            <div key={item.label} className="max-w-full text-gray-700">
                                                                                <span className="font-medium text-gray-500">
                                                                                    {item.label}:
                                                                                </span>
                                                                                <span className="ml-1 font-medium text-gray-700 break-all">
                                                                                    {item.value}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        {showOverlayLoader && <LoadingOverlay label="Loading accounts..." />}
                    </div>
                )}

                {settlementModal.open && (
                    <div className="fixed inset-0 z-[120] bg-black/25 flex items-center justify-center p-4" onClick={closeSettlementModal}>
                        <div
                            className="w-full max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Net Settlement Summary</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{settlementModal.account?.name || '-'}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeSettlementModal}
                                    className="w-8 h-8 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    <X size={14} className="mx-auto" />
                                </button>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                                {settlementModal.loading ? (
                                    <div className="px-5 py-8 text-sm text-gray-500 text-center">Loading...</div>
                                ) : settlementModal.items.length === 0 ? (
                                    <div className="px-5 py-8 text-sm text-gray-500 text-center">No counterparties with net balance.</div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 border-y border-gray-200 sticky top-0">
                                            <tr>
                                                <th className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Counterparty</th>
                                                <th className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Net Balance</th>
                                                <th className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {settlementModal.items.map((item) => {
                                                const net = Number(item.net_amount || 0);
                                                const isPayable = net > 0;
                                                return (
                                                    <tr key={item.counterparty_id} className="hover:bg-gray-50/50">
                                                        <td className="px-5 py-2 text-[12px] font-medium text-gray-800">{item.counterparty_name || '-'}</td>
                                                        <td className={cn(
                                                            "px-5 py-2 text-[12px] font-bold text-right tabular-nums",
                                                            isPayable ? "text-rose-600" : "text-emerald-600"
                                                        )}>
                                                            {formatCurrency(Math.abs(net), settlementModal.currency || preferences.currency)}
                                                        </td>
                                                        <td className={cn(
                                                            "px-5 py-2 text-[12px] font-bold",
                                                            isPayable ? "text-rose-600" : "text-emerald-600"
                                                        )}>
                                                            {isPayable ? 'Payable' : 'Receivable'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                <div className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                    <div className="text-[11px] text-gray-500 font-medium">
                        Showing <span className="font-bold text-gray-700">{filteredAccounts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredAccounts.length)}</span> of <span className="font-bold text-gray-700">{filteredAccounts.length}</span> results
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                        >
                            Previous
                        </button>
                        <div className="hidden sm:flex items-center space-x-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-bold transition-all",
                                        page === currentPage
                                            ? "bg-gray-100 border border-gray-200 text-gray-900"
                                            : "text-gray-500 hover:bg-gray-100"
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>

            </PageContentShell>

            <ConfirmDialog
                open={deleteDialog.open}
                title="Delete Account"
                message={deleteDialog.name
                    ? `Are you sure you want to archive "${deleteDialog.name}"? It will be hidden from active lists.`
                    : 'Are you sure you want to archive this account? It will be hidden from active lists.'}
                confirmLabel="Yes, Delete Account"
                isSubmitting={deleteDialog.loading}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            />

            {/* Print Footer */}
            < div className="print-footer" >
                Page {currentPage} of {totalPages}
            </div >

        </div >
    );
};

export default Accounts;
