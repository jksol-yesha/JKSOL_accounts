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
    Loader2,
    Landmark,
    CreditCard,
    Banknote,
    ChevronUp,
    Calendar,
    TrendingUp,
    RefreshCcw,
    EyeOff,
    Pin,
    ArrowRight,
    Wallet,
    PiggyBank,
    Briefcase,
    Activity,
    ChevronLeft
} from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import CustomSelect from '../../components/common/CustomSelect';
import apiService from '../../services/api';
import { cn } from '../../utils/cn';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_SUBTYPE_LABELS } from './constants';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import { TRANSACTION_DATA_CHANGED_EVENT } from '../transactions/transactionDataSync';
import { useToast } from '../../context/ToastContext';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const MOCK_30_DAYS = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bank: 45000 + Math.random() * 20000 - 5000,
        card: 5000 + Math.random() * 3000 - 1000,
        cash: 1000 + Math.random() * 800 - 200
    };
});

const MOCK_12_MONTHS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        bank: 40000 + (i * 2000) + Math.random() * 10000,
        card: 8000 + (i * 100) + Math.random() * 2000,
        cash: 1200 + (i * 50) + Math.random() * 500
    };
});

const SummaryItem = ({ title, amount, icon: Icon, colorClass, bgClass, currency }) => {
    const { formatCurrency } = usePreferences();
    return (
        <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/60", bgClass)}>
                <Icon size={16} className={colorClass} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-0.5">{title}</p>
                <h3 className="text-[17px] font-bold text-gray-800 tracking-tight">
                    {formatCurrency(amount, currency)}
                </h3>
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label, currency }) => {
    const { formatCurrency } = usePreferences();
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-md z-50 min-w-[140px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                                {formatCurrency(entry.value, currency)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

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
    const socketBranchId = typeof selectedBranch?.id === 'number' ? selectedBranch.id : null;
    const { on } = useWebSocket(socketBranchId);
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

    const computedBalances = useMemo(() => {
        let bank = 0, card = 0, cash = 0;
        accounts.forEach(a => {
            const val = getDisplayClosingBalance(a);
            const subtype = Number(a.subtype);
            if (subtype === 12) bank += val;
            else if (subtype === 22 || subtype === 21) card += val;
            else if (subtype === 11) cash += val;
        });
        return { bankBalance: bank, cardBalance: card, cashBalance: cash };
    }, [accounts]);
    const { bankBalance, cardBalance, cashBalance } = computedBalances;

    const [chartTimeframe, setChartTimeframe] = useState('30D');
    const [chartVisible, setChartVisible] = useState(false);
    const [summaryFilter, setSummaryFilter] = useState('All Accounts');
    const [listFilter, setListFilter] = useState('Active Accounts');
    
    // Grid Controls
    const [groupBy, setGroupBy] = useState('none');
    const [hiddenColumns, setHiddenColumns] = useState(new Set());
    const [frozenColumns, setFrozenColumns] = useState(new Set(['name'])); // Name forced frozen per user spec
    const [columnFilters, setColumnFilters] = useState({});
    const [activeColumnMenu, setActiveColumnMenu] = useState(null);
    const [activeRowPopover, setActiveRowPopover] = useState(null);

    // Click-away listener for popovers
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.popover-container') && !event.target.closest('.popover-trigger')) {
                setActiveColumnMenu(null);
                setActiveRowPopover(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const chartData = useMemo(() => {
        return chartTimeframe === '30D' ? MOCK_30_DAYS : MOCK_12_MONTHS;
    }, [chartTimeframe]);

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

    //  Listen for real-time account updates
    useEffect(() => {
        const refreshAccounts = () => {
            setDataRefreshTick((current) => current + 1);
        };

        const unsubscribeTransactionCreate = on('transaction:created', refreshAccounts);
        const unsubscribeTransactionUpdate = on('transaction:updated', refreshAccounts);
        const unsubscribeTransactionDelete = on('transaction:deleted', refreshAccounts);

        return () => {
            unsubscribeTransactionCreate();
            unsubscribeTransactionUpdate();
            unsubscribeTransactionDelete();
        };
    }, [on]);

    useEffect(() => {
        // Listen for new accounts
        const unsubscribeCreate = on('account:created', (newAccount) => {
            const normalized = normalizeAccount(newAccount);

            // Add the new account to the list
            setAccounts(prev => {
                // Check if account already exists (avoid duplicates)
                const exists = prev.some(a => a.id === normalized.id);
                if (exists) return prev;

                // Add new account at the beginning
                return [normalized, ...prev];
            });
        });

        // Listen for updated accounts
        const unsubscribeUpdate = on('account:updated', (updatedAccount) => {
            const normalized = normalizeAccount(updatedAccount);

            // Update the account in the list
            setAccounts(prev => prev.map(a =>
                a.id === normalized.id ? normalized : a
            ));
        });

        // Listen for deleted accounts
        const unsubscribeDelete = on('account:deleted', (data) => {

            // Remove the account from the list
            setAccounts(prev => prev.filter(a => a.id !== data.id));
        });

        return () => {
            unsubscribeCreate();
            unsubscribeUpdate();
            unsubscribeDelete();
        };
    }, [on]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAccounts = useMemo(() => {
        let result = [...accounts];

        if (listFilter === 'Active Accounts') {
            result = result.filter(a => a.isActive || a.status === 1 || a.status === 'active');
        } else if (listFilter === 'Inactive Accounts') {
            result = result.filter(a => !a.isActive && a.status !== 1 && a.status !== 'active');
        }

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

        // Apply Column-Wise amount filters
        if (Object.keys(columnFilters).length > 0) {
            result = result.filter(account => {
                for (const [colKey, filterOpts] of Object.entries(columnFilters)) {
                    if (!filterOpts) continue;
                    let val = 0;
                    if (colKey === 'openingBalance') val = getDisplayBalance(account);
                    if (colKey === 'closingBalance') val = getDisplayClosingBalance(account);
                    
                    const targetVal = Number(filterOpts.value);
                    if (filterOpts.operator === 'lt' && !(val < targetVal)) return false;
                    if (filterOpts.operator === 'gt' && !(val > targetVal)) return false;
                    if (filterOpts.operator === 'eq' && !(val === targetVal)) return false;
                }
                return true;
            });
        }

        return result;
    }, [accounts, sortConfig, oweMap, searchTerm, listFilter, columnFilters]);

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
                        title="Account Overview"
                        breadcrumbs={['Accounts', 'Overview']}
                    />
                )}
                contentClassName="p-0 lg:p-0"
                cardClassName="border-none shadow-none rounded-none overflow-visible"
            >
                {/* Summary Component Box */}
                <div className="px-5 pt-5 pb-0 print:hidden relative z-10">
                    <div className="bg-[#fafafc] border border-gray-100 rounded-[12px] px-6 py-5 shadow-sm">

                        {/* Metrics Row */}
                        <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                            <SummaryItem 
                                title="Bank Balance" 
                                amount={bankBalance} 
                                icon={Landmark} 
                                colorClass="text-emerald-600" 
                                bgClass="bg-emerald-50" 
                                currency={preferences.currency}
                            />
                            <SummaryItem 
                                title="Card Balance" 
                                amount={cardBalance} 
                                icon={CreditCard} 
                                colorClass="text-purple-600" 
                                bgClass="bg-purple-50"
                                currency={preferences.currency}
                            />
                            <SummaryItem 
                                title="Cash in Hand" 
                                amount={cashBalance} 
                                icon={Banknote} 
                                colorClass="text-gray-600" 
                                bgClass="bg-gray-100"
                                currency={preferences.currency}
                            />
                        </div>

                        {/* Chart Toggle */}
                        <div className="mt-4 border-t border-gray-50 flex justify-between items-center">
                            <button 
                                onClick={() => setChartVisible(!chartVisible)}
                                className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                                <TrendingUp size={14} />
                                {chartVisible ? 'Hide Chart' : 'Show Chart'}
                                {chartVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-semibold">
                                <Calendar size={13} />
                                <span>Last 30 days</span>
                            </div>
                        </div>

                        {/* Chart Section */}
                        {chartVisible && (
                            <div className="h-[220px] w-full mt-6 transition-all">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={{ stroke: '#f3f4f6' }} 
                                            tickLine={false} 
                                            tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 500 }}
                                            dy={8}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 500 }}
                                            tickFormatter={(val) => {
                                                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                                return val;
                                            }}
                                        />
                                        <Tooltip content={<CustomTooltip currency={preferences.currency} />} />
                                        <Line type="monotone" name="Bank Balance" dataKey="bank" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} />
                                        <Line type="monotone" name="Card Balance" dataKey="card" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }} />
                                        <Line type="monotone" name="Cash in Hand" dataKey="cash" stroke="#6b7280" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#6b7280' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                                {/* Custom List Header */}
                <div className="px-5 pb-3 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between print:hidden gap-3 border-b border-gray-50">
                    <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                        <div className="relative min-w-[160px]">
                            <CustomSelect 
                                value={listFilter}
                                onChange={(e) => setListFilter(e.target.value)}
                                className="text-[17px] font-bold text-gray-900 hover:opacity-80 transition-opacity whitespace-nowrap"
                            >
                                <option value="All Accounts">All Accounts</option>
                                <option value="Active Accounts">Active Accounts</option>
                                <option value="Inactive Accounts">Inactive Accounts</option>
                            </CustomSelect>
                        </div>
                        <div className="relative min-w-[140px]">
                            <CustomSelect 
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value)}
                                className="text-xs font-semibold text-gray-700 bg-white"
                            >
                                <option value="none">No Grouping</option>
                                <option value="type">Group by Type</option>
                                <option value="subtype">Group by Subtype</option>
                            </CustomSelect>
                        </div>
                        <button
                            onClick={() => setDataRefreshTick(t => t + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-md border transition-all active:scale-95 shadow-sm bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
                            title="Refresh Records"
                        >
                            <RefreshCcw size={15} strokeWidth={2.5} className={cn(loading && "animate-spin text-primary")} />
                        </button>
                        <button
                            onClick={handleCreateAccount}
                            className="w-8 h-8 flex items-center justify-center rounded-md border transition-all active:scale-95 shadow-sm bg-primary border-primary text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
                            title="Add New Account"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="relative group w-full sm:w-64 shrink-0">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search accounts..."
                            className="w-full pl-8 pr-3 py-1.5 bg-[#f1f3f9] border border-transparent rounded-lg text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Table View */}
                {(isDesktopView || typeof window === 'undefined') && (() => {
                    const allCols = [
                        { label: 'Name', key: 'name', width: 'w-[18%]', align: 'text-left' },
                        { label: 'Subtype', key: 'subtypeLabel', width: 'w-[11%]', align: 'text-left' },
                        { label: 'Date', key: 'openingBalanceDate', width: 'w-[10%]', align: 'text-left' },
                        { label: 'Opening Balance', key: 'openingBalance', width: 'w-[15%]', align: 'text-right' },
                        { label: 'Closing Balance', key: 'closingBalance', width: 'w-[15%]', align: 'text-right' },
                        { label: 'Status', key: 'isActive', width: 'w-[10%]', align: 'text-left' },
                        { label: 'Created By', key: 'createdByDisplayName', width: 'w-[11%]', align: 'text-left' }
                    ];
                    
                    const visibleCols = [...allCols.filter(c => frozenColumns.has(c.key)), ...allCols.filter(c => !frozenColumns.has(c.key))]
                        .filter(c => !hiddenColumns.has(c.key));
                    
                    const tableColSpan = visibleCols.length + 1; // +1 for Action

                    let groupedAccounts = { 'All': paginatedAccounts };
                    if (groupBy !== 'none' && paginatedAccounts.length > 0) {
                        groupedAccounts = {};
                        paginatedAccounts.forEach(acc => {
                            const key = groupBy === 'type' ? (acc.typeLabel || 'Unknown Type') : (acc.subtypeLabel || 'Unknown Subtype');
                            if (!groupedAccounts[key]) groupedAccounts[key] = [];
                            groupedAccounts[key].push(acc);
                        });
                    }

                    return (
                        <div className="relative print:block flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar accounts-laptop-table-scroll px-5 pb-8" aria-busy={loading}>
                            <div className="border border-[#e5e7eb] rounded-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-left border-collapse table-fixed accounts-laptop-table divide-y divide-[#e5e7eb]">
                                                                                    <thead className="sticky top-0 z-10 bg-white">
                                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                                    
                                    {visibleCols.map((col) => (
                                        <th
                                            key={col.label}
                                            className={cn(
                                                `${col.width} sticky top-0 z-10 bg-[#f9fafb]/95 backdrop-blur-sm px-2 py-1.5 ${col.align} text-[11px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap relative border-r border-[#e5e7eb] last:border-r-0`,
                                                (col.key === 'openingBalance' || col.key === 'closingBalance') && "accounts-laptop-balance-header",
                                                frozenColumns.has(col.key) && "sticky left-0 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)] z-20"
                                            )}
                                        >
                                                                                        <div className="flex items-center gap-1 group w-full relative">
                                                <div className={cn(
                                                    "flex items-center gap-1",
                                                    col.align === 'text-right' ? "justify-end" : col.align === 'text-center' ? "justify-center" : "",
                                                    (col.key === 'openingBalance' || col.key === 'closingBalance') && "accounts-laptop-sort-header"
                                                )}>
                                                    <span className={cn(
                                                        "cursor-pointer hover:text-gray-900 transition-colors",
                                                        col.key === 'subtypeLabel' && "pl-1",
                                                    )} onClick={() => handleSort(col.key)}>
                                                        {col.label}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveColumnMenu(activeColumnMenu === col.key ? null : col.key);
                                                    }}
                                                    className="popover-trigger p-1 rounded-sm text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 transition-all focus:outline-none shrink-0"
                                                >
                                                    <ChevronDown size={13} strokeWidth={2.5} />
                                                </button>

                                                {}
                                                {activeColumnMenu === col.key && (
                                                    <React.Fragment>
                                                        
                                                        <div className="popover-container absolute top-[calc(100%+4px)] right-0 w-40 bg-white border border-gray-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-[101] py-1 text-[11px] font-semibold text-gray-600 normal-case flex flex-col">
                                                            <button onClick={() => { handleSort(col.key); setActiveColumnMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                                                <ArrowUpDown size={14} className="text-gray-400" /> 
                                                                <span className="font-semibold">Sort Ascending</span>
                                                            </button>
                                                            <button onClick={() => { handleSort(col.key); setActiveColumnMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                                                <ArrowUpDown size={14} className="text-gray-400" /> 
                                                                <span className="font-semibold">Sort Descending</span>
                                                            </button>
                                                            <div className="h-px bg-gray-100 my-1"></div>
                                                            <button onClick={() => { setFrozenColumns(prev => { const n = new Set(prev); if(n.has(col.key)) n.delete(col.key); else n.add(col.key); return n; }); setActiveColumnMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                                                <Pin size={14} className="text-gray-400" /> 
                                                                <span className="font-semibold">{frozenColumns.has(col.key) ? 'Unfreeze column' : 'Freeze column'}</span>
                                                            </button>
                                                            <button onClick={() => { setHiddenColumns(prev => new Set([...prev, col.key])); setActiveColumnMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                                                <EyeOff size={14} className="text-gray-400" /> 
                                                                <span className="font-semibold">Hide column</span>
                                                            </button>
                                                            
                                                            {(col.key === 'openingBalance' || col.key === 'closingBalance') && (
                                                                <>
                                                                <div className="h-px bg-gray-100 my-1"></div>
                                                                <div className="px-3 pb-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2 mt-1">Filter Amount</div>
                                                                    <div className="flex flex-col gap-2">
                                                                        <select 
                                                                            defaultValue={columnFilters[col.key]?.operator || 'gt'}
                                                                            id={`filter-op-${col.key}`}
                                                                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-primary/50 bg-white"
                                                                        >
                                                                            <option value="gt">Greater than</option>
                                                                            <option value="lt">Less than</option>
                                                                            <option value="eq">Equal to</option>
                                                                        </select>
                                                                        <input 
                                                                            type="number" 
                                                                            id={`filter-val-${col.key}`}
                                                                            defaultValue={columnFilters[col.key]?.value || 1000} 
                                                                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-primary/50 bg-white"
                                                                        />
                                                                        <button 
                                                                            className="w-full mt-0.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 py-1 rounded text-[11px] font-bold transition-colors"
                                                                            onClick={(e) => {
                                                                                const op = document.getElementById(`filter-op-${col.key}`).value;
                                                                                const val = document.getElementById(`filter-val-${col.key}`).value;
                                                                                setColumnFilters(prev => ({ ...prev, [col.key]: { operator: op, value: Number(val) } }));
                                                                                setActiveColumnMenu(null);
                                                                            }}
                                                                        >
                                                                            Apply Filter
                                                                        </button>
                                                                        {columnFilters[col.key] && (
                                                                            <button 
                                                                                className="w-full text-rose-500 hover:text-rose-600 py-1 rounded text-[10px] font-bold"
                                                                                onClick={() => {
                                                                                    const next = { ...columnFilters };
                                                                                    delete next[col.key];
                                                                                    setColumnFilters(next);
                                                                                    setActiveColumnMenu(null);
                                                                                }}
                                                                            >
                                                                                Clear Filter
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </React.Fragment>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="w-[7%] sticky top-0 z-10 bg-[#f9fafb]/95 backdrop-blur-sm px-2 py-1.5 pr-4 text-[11px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap border-l border-[#e5e7eb]">
                                        <div className="xl:ml-auto w-12 text-center xl:text-left">Action</div>
                                    </th>
                                </tr>
                            </thead>
                                                                                    <tbody className="divide-y divide-[#e5e7eb]">
                                {showInitialLoader ? (
                                    <tr>
                                        <td colSpan={tableColSpan} className="px-6 py-8">
                                            <div className="flex items-center justify-center">
                                                <Loader2 size={24} className="text-gray-500 animate-spin" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : hasFetchedOnce && Object.keys(groupedAccounts).length === 0 ? (
                                    <tr><td colSpan={tableColSpan} className="px-6 py-8 text-center text-sm text-gray-500">No accounts found.</td></tr>
                                ) : (
                                    Object.entries(groupedAccounts).map(([groupKey, accounts]) => (
                                        <React.Fragment key={groupKey}>
                                            {groupBy !== 'none' && (
                                                <tr className="bg-gray-100/50">
                                                    <td colSpan={tableColSpan} className="px-3 py-1 text-xs font-bold text-gray-600 bg-gray-50 border-y border-[#e5e7eb]">
                                                        {groupKey} <span className="text-gray-400 font-normal ml-1">({accounts.length})</span>
                                                    </td>
                                                </tr>
                                            )}
                                            {accounts.map((account) => {
                                                const showExpand = isAssetBankAccount(account);
                                                return (
                                                    <tr key={account.id} className="group hover:bg-[#f8fafc] transition-colors">

                                                        {visibleCols.map(col => {
                                                            const isFrozen = frozenColumns.has(col.key);
                                                            const tdBaseClass = cn(
                                                                "px-2 py-1 whitespace-nowrap border-r border-[#e5e7eb]",
                                                                isFrozen && "sticky left-0 bg-white group-hover:bg-[#f8fafc] z-[1] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.02)] transition-colors"
                                                            );

                                                            if (col.key === 'name') {
                                                                return (
                                                                    <td key="name" className={cn(tdBaseClass, "min-w-0 px-3 overflow-visible relative")}>
                                                                        <div className="flex items-center gap-2 min-w-0 w-full relative">
                                                                            <div className="flex items-center justify-center shrink-0 w-4 h-4 text-gray-400">
                                                                                {account.subtype === 12 || account.subtype === '12' ? <Landmark size={14} strokeWidth={2} /> : 
                                                                                account.subtype === 22 || account.subtype === '22' || account.subtype === 21 || account.subtype === '21' ? <CreditCard size={14} strokeWidth={2} /> : 
                                                                                account.type === 20 || account.type === '20' ? <PiggyBank size={14} strokeWidth={2} /> :
                                                                                account.subtype === 13 || account.subtype === '13' ? <Briefcase size={14} strokeWidth={2} /> :
                                                                                account.subtype === 11 || account.subtype === '11' ? <Wallet size={14} strokeWidth={2} /> :
                                                                                account.type === 4 || account.type === '4' ? <Activity size={14} strokeWidth={2} /> :
                                                                                <Banknote size={14} strokeWidth={2} />}
                                                                            </div>
                                                                            <AccountNameTooltip
                                                                                name={account.name}
                                                                                className="flex-1 min-w-0"
                                                                                textClassName="text-[12px] font-semibold text-gray-800 text-left cursor-default leading-snug"
                                                                            />
                                                                            {showExpand && (
                                                                                <div className="relative shrink-0 flex items-center">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setActiveRowPopover(activeRowPopover?.id === account.id ? null : { id: account.id, anchor: e.currentTarget }); }}
                                                                                        className="popover-trigger inline-flex items-center justify-center p-1 rounded-sm text-gray-400 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                                                                                        title="View Bank Details"
                                                                                    >
                                                                                        <ArrowRight size={13} />
                                                                                    </button>
                                                                                                                                                                                                                                                            {activeRowPopover?.id === account.id && (
                                                                                        <React.Fragment>
                                                                                            
                                                                                                                                                                                    {createPortal(
                                                                                            <div className="fixed z-[9999] pointer-events-auto shadow-[0_4px_24px_rgba(0,0,0,0.15)] bg-white rounded-lg border border-[#e5e7eb] w-[320px] flex flex-col" 
                                                                                                style={{
                                                                                                    top: Math.min(activeRowPopover.anchor.getBoundingClientRect().top, window.innerHeight - 300),
                                                                                                    left: activeRowPopover.anchor.getBoundingClientRect().right + 8
                                                                                                }}
                                                                                                onClick={(e)=>e.stopPropagation()}>
                                                                                                <div className="bg-[#f9fafb] px-3 py-2 border-b border-[#e5e7eb] flex items-center justify-between rounded-t-lg">
                                                                                                    <span className="text-[12px] font-bold text-gray-800">
                                                                                                        Bank Details
                                                                                                    </span>
                                                                                                    <button onClick={() => handleCopyBankDetails(account)} className="text-gray-500 hover:text-gray-900 transition-colors p-0.5" title="Copy Details">
                                                                                                        {copiedBankDetailsId === account.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                                                                    </button>
                                                                                                </div>
                                                                                                <div className="max-h-[300px] overflow-y-auto no-scrollbar bg-white rounded-b-lg">
                                                                                                    <table className="w-full text-left text-[11px]">
                                                                                                        <tbody className="divide-y divide-[#e5e7eb]">
                                                                                                            {getBankDetailItems(account).map(item => (
                                                                                                                <tr key={item.label} className="hover:bg-gray-50/50 transition-colors">
                                                                                                                    <td className="px-3 py-1.5 text-gray-500 font-medium w-[40%] align-top">{item.label}</td>
                                                                                                                    <td className="px-3 py-1.5 text-gray-900 font-medium break-all align-top border-l border-[#e5e7eb]">{item.value || '-'}</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </div>
                                                                                            </div>,
                                                                                            document.body
                                                                                        )}
                                                                                        </React.Fragment>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            }
                                                            if (col.key === 'subtypeLabel') return <td key="subtype" className={cn(tdBaseClass, "text-[11px] font-medium text-gray-500 overflow-hidden text-ellipsis px-3")}><span className="truncate block max-w-[140px]">{account.subtypeLabel || '-'}</span></td>;
                                                            if (col.key === 'openingBalanceDate') return <td key="date" className={cn(tdBaseClass, "text-[11px] font-medium text-gray-500 overflow-hidden text-ellipsis pl-3")}>{formatDate(account.openingBalanceDate)}</td>;
                                                            if (col.key === 'openingBalance') return <td key="open" className={cn(tdBaseClass, "text-[12px] font-semibold tabular-nums text-right overflow-hidden", getDisplayBalance(account) < 0 ? 'text-rose-600' : 'text-emerald-700')}>{formatCurrency(getDisplayBalance(account), account.baseCurrency)}</td>;
                                                            if (col.key === 'closingBalance') return <td key="close" className={cn(tdBaseClass, "text-[12px] font-semibold tabular-nums text-right overflow-hidden pr-6", getDisplayClosingBalance(account) < 0 ? 'text-rose-600' : 'text-emerald-700')}>{formatCurrency(getDisplayClosingBalance(account), account.baseCurrency)}</td>;
                                                            if (col.key === 'isActive') return (
                                                                <td key="status" className={cn(tdBaseClass, "pl-6 text-left overflow-hidden text-ellipsis")}>
                                                                    <button
                                                                        onClick={() => handleToggleStatus(account.id, account.isActive)}
                                                                        className={cn(
                                                                            "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all hover:opacity-80 cursor-pointer text-left",
                                                                            (account.status === 2 || account.status === 'inactive') ? "bg-gray-100 text-gray-500" : "bg-blue-50/50 text-blue-600"
                                                                        )}
                                                                    >
                                                                        {(account.status === 2 || account.status === 'inactive') ? 'Inactive' : 'Active'}
                                                                    </button>
                                                                </td>
                                                            );
                                                            if (col.key === 'createdByDisplayName') return <td key="creator" className={cn(tdBaseClass, "text-[11px] font-medium text-gray-400 truncate max-w-[120px] overflow-hidden text-ellipsis")}>{account.createdByDisplayName || '-'}</td>;
                                                            return <td key={col.key} className={tdBaseClass}>-</td>;
                                                        })}
                                                        <td className="px-2 py-1 pr-4 whitespace-nowrap xl:text-right print:hidden text-center">
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <button onClick={() => navigate('/accounts/create', { state: { account } })} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Edit"><Edit size={14} /></button>
                                                                <button onClick={() => handleDelete(account)} className="p-1 text-gray-400 hover:text-rose-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </div>
                        {showOverlayLoader && <LoadingOverlay label="Loading accounts..." />}
                    </div>
                    );
                })()}

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

                {}
                <div className="sticky bottom-0 left-0 right-0 border-t border-[#e5e7eb] bg-white text-[12px] text-gray-500 flex items-center px-4 py-2.5 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] mt-auto shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors">
                                <ChevronLeft size={14} />
                            </button>
                            <span className="flex items-center gap-1.5">Page <span className="font-bold text-gray-800 border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 min-w-[20px] text-center">{currentPage}</span> of {Math.max(1, Math.ceil(filteredAccounts.length / pageSize))}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredAccounts.length / pageSize)))} disabled={currentPage * pageSize >= filteredAccounts.length} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="h-4 w-px bg-gray-200 pointer-events-none"></div>
                        <div>
                            <span className="font-bold text-gray-800">{pageSize}</span> rows
                        </div>
                        <div className="h-4 w-px bg-gray-200 pointer-events-none"></div>
                        <div>
                            <span className="font-bold text-gray-800">{filteredAccounts.length}</span> records
                        </div>
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
