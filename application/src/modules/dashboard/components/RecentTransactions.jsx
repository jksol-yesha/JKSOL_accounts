import React from 'react';
import { createPortal } from 'react-dom';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import isIgnorableRequestError from '../../../utils/isIgnorableRequestError';
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Check, ChevronDown, Edit, Eye, ListFilter, Plus, Settings2, Trash2, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../utils/cn';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { useAuth } from '../../../context/AuthContext';
import { notifyTransactionDataChanged } from '../../transactions/transactionDataSync';

const recentTransactionsFetches = new Map();
const DEFAULT_TRANSACTION_TYPE_ORDER = ['income', 'expense', 'transfer', 'investment'];
const RECENT_TXN_COLUMN_STORAGE_KEY = 'dashboard:recentTxColumns:v1';
const RECENT_TXN_TOOLBAR_DROPDOWN_EVENT = 'recent-transactions:toolbar-dropdown-open';
const RECENT_TXN_COLUMNS = [
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'type', label: 'Type', defaultVisible: true },
    { key: 'account', label: 'Account', defaultVisible: true },
    { key: 'party', label: 'Party', defaultVisible: true },
    { key: 'amount', label: 'Amount', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: false },
    { key: 'description', label: 'Description', defaultVisible: false },
    { key: 'createdBy', label: 'Created By', defaultVisible: false }
];
const DEFAULT_VISIBLE_RECENT_TXN_COLUMNS = RECENT_TXN_COLUMNS.reduce((accumulator, column) => {
    accumulator[column.key] = column.defaultVisible;
    return accumulator;
}, {});
const DEFAULT_TRANSACTION_TYPE_META = {
    income: {
        label: 'Income',
        icon: ArrowUpCircle,
        itemIconClassName: 'bg-emerald-50 text-emerald-600',
        textClassName: 'text-emerald-600'
    },
    expense: {
        label: 'Expense',
        icon: ArrowDownCircle,
        itemIconClassName: 'bg-rose-50 text-rose-600',
        textClassName: 'text-rose-600'
    },
    transfer: {
        label: 'Transfer',
        icon: ArrowLeftRight,
        itemIconClassName: 'bg-blue-50 text-blue-600',
        textClassName: 'text-blue-600'
    },
    investment: {
        label: 'Investment',
        icon: TrendingUp,
        itemIconClassName: 'bg-amber-50 text-amber-600',
        textClassName: 'text-amber-600'
    }
};

const normalizeTransactionType = (value = '') => String(value || '').trim().toLowerCase();

const formatTransactionTypeLabel = (value = '') => {
    const normalizedValue = normalizeTransactionType(value);
    if (!normalizedValue) return 'Unknown';
    if (DEFAULT_TRANSACTION_TYPE_META[normalizedValue]?.label) {
        return DEFAULT_TRANSACTION_TYPE_META[normalizedValue].label;
    }

    return normalizedValue
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getTransactionTypeMeta = (value = '') => {
    const normalizedValue = normalizeTransactionType(value) || 'unknown';
    const knownMeta = DEFAULT_TRANSACTION_TYPE_META[normalizedValue];

    return {
        value: normalizedValue,
        label: knownMeta?.label || formatTransactionTypeLabel(normalizedValue),
        icon: knownMeta?.icon || null,
        itemIconClassName: knownMeta?.itemIconClassName || 'bg-slate-100 text-slate-500',
        textClassName: knownMeta?.textClassName || 'text-slate-600'
    };
};

const normalizeRecentTxColumns = (value) => {
    const normalized = { ...DEFAULT_VISIBLE_RECENT_TXN_COLUMNS };

    if (!value || typeof value !== 'object') {
        return normalized;
    }

    RECENT_TXN_COLUMNS.forEach((column) => {
        if (typeof value[column.key] === 'boolean') {
            normalized[column.key] = value[column.key];
        }
    });

    return normalized;
};

const TransactionTypeFilter = ({
    options,
    selectedTypes,
    onApplySelection
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownId = React.useId();
    const triggerRef = React.useRef(null);
    const dropdownRef = React.useRef(null);
    const [dropdownPosition, setDropdownPosition] = React.useState(null);

    const normalizedSelectedTypes = React.useMemo(() => (
        Array.from(new Set((selectedTypes || []).map((type) => normalizeTransactionType(type)).filter(Boolean)))
    ), [selectedTypes]);

    const normalizedOptions = React.useMemo(() => (
        (options || []).map((option) => ({
            ...option,
            value: normalizeTransactionType(option.value)
        }))
    ), [options]);

    const allTypeValues = React.useMemo(() => (
        normalizedOptions.map((option) => option.value)
    ), [normalizedOptions]);

    const hasSpecificSelection = normalizedSelectedTypes.length > 0
        && normalizedSelectedTypes.length < allTypeValues.length;
    const selectedValuesForDisplay = hasSpecificSelection
        ? normalizedSelectedTypes
        : allTypeValues;
    const selectedLabels = normalizedOptions
        .filter((option) => selectedValuesForDisplay.includes(option.value))
        .map((option) => option.label);
    const displayLabel = !hasSpecificSelection
        ? 'Type'
        : selectedLabels.slice(0, 2).join('+');
    const remainingSelectedCount = !hasSpecificSelection
        ? 0
        : Math.max(0, selectedLabels.length - 2);

    React.useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const width = 136;
            const viewportWidth = window.innerWidth;
            const left = Math.min(
                Math.max(12, rect.left + rect.width / 2 - width / 2),
                Math.max(12, viewportWidth - width - 12)
            );

            setDropdownPosition({
                top: rect.bottom + 8,
                left
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    React.useEffect(() => {
        if (!isOpen) return undefined;

        const handleClickOutside = (event) => {
            const clickedTrigger = triggerRef.current?.contains(event.target);
            const clickedDropdown = dropdownRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedDropdown) {
                setDropdownPosition(null);
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    React.useEffect(() => {
        const handleOtherDropdownOpen = (event) => {
            if (event.detail?.id !== dropdownId) {
                setDropdownPosition(null);
                setIsOpen(false);
            }
        };

        document.addEventListener(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, handleOtherDropdownOpen);
        return () => document.removeEventListener(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, handleOtherDropdownOpen);
    }, [dropdownId]);

    const toggleSelectedType = (value) => {
        const nextSelection = normalizedSelectedTypes.includes(value)
            ? normalizedSelectedTypes.filter((type) => type !== value)
            : [...normalizedSelectedTypes, value];

        onApplySelection(Array.from(new Set(nextSelection)));
    };

    return (
        <>
            <div className="relative w-[72px]" ref={triggerRef}>
                <button
                    type="button"
                    onClick={() => {
                        if (!isOpen) {
                            document.dispatchEvent(new CustomEvent(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, {
                                detail: { id: dropdownId }
                            }));
                        }
                        setIsOpen((previous) => !previous);
                    }}
                    className="group relative flex h-6 w-full items-center justify-start rounded-md border border-gray-200 bg-white px-1 py-0.5 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
                >
                    <div className="flex min-w-0 flex-1 items-center justify-start gap-0.5 pl-2 pr-5 text-left">
                        <span className="truncate text-left text-[10px] font-bold uppercase tracking-wide text-slate-700">
                            {displayLabel || 'Type'}
                        </span>
                        {remainingSelectedCount > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-0 rounded-full bg-slate-100 px-1 py-[1px] text-[9px] font-bold leading-none text-slate-600">
                                <span>{remainingSelectedCount}</span>
                                <Plus size={6} />
                            </span>
                        )}
                    </div>
                    <ChevronDown size={10} className={cn("absolute right-1 shrink-0 text-gray-400 transition-transform", isOpen && "rotate-180")} />
                </button>
            </div>

            {isOpen && dropdownPosition && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[120] w-[136px] rounded-md border border-gray-100 bg-white py-0.5 shadow-xl animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                    <div className="max-h-48 overflow-y-auto py-0.5 no-scrollbar">
                        {normalizedOptions.map((option) => {
                            const isSelected = normalizedSelectedTypes.includes(option.value);
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleSelectedType(option.value)}
                                    className="group flex w-full items-center justify-between px-1.5 py-1 text-left transition-colors hover:bg-gray-50"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn(
                                            "flex h-5 w-5 items-center justify-center rounded-md",
                                            isSelected ? option.itemIconClassName : "bg-slate-100 text-slate-400"
                                        )}>
                                            {Icon ? (
                                                <Icon size={11} strokeWidth={2} />
                                            ) : (
                                                <span className="text-[8px] font-black uppercase">{option.label.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={cn("truncate text-[12px] font-medium", isSelected ? "text-gray-900" : "text-gray-600")}>
                                                {option.label}
                                            </p>
                                        </div>
                                    </div>
                                    {isSelected && <Check size={12} className="text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const RecentTransactionColumnSettings = ({
    value,
    onApplySelection
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownId = React.useId();
    const triggerRef = React.useRef(null);
    const dropdownRef = React.useRef(null);
    const [dropdownPosition, setDropdownPosition] = React.useState(null);
    const [anchorMetrics, setAnchorMetrics] = React.useState(null);

    const normalizedSelection = React.useMemo(() => normalizeRecentTxColumns(value), [value]);
    const handleCloseDropdown = React.useCallback(() => {
        setDropdownPosition(null);
        setIsOpen(false);
    }, []);

    React.useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!dropdownRef.current || !anchorMetrics) return;
            const width = 170;
            const viewportPadding = 12;
            const preferredHeight = 420;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const anchorX = anchorMetrics.clickX;
            const measuredHeight = dropdownRef.current.offsetHeight || preferredHeight;
            const left = Math.min(
                Math.max(viewportPadding, anchorX - (width / 2)),
                Math.max(viewportPadding, viewportWidth - width - viewportPadding)
            );
            const availableBelow = Math.max(0, viewportHeight - anchorMetrics.triggerBottom - viewportPadding);
            const maxHeight = Math.max(0, Math.min(preferredHeight, availableBelow));
            const actualHeight = Math.min(measuredHeight, maxHeight || measuredHeight);
            const top = Math.min(anchorMetrics.triggerBottom, viewportHeight - viewportPadding - actualHeight);

            setDropdownPosition({
                top,
                left,
                maxHeight
            });
        };

        updatePosition();
        return undefined;
    }, [anchorMetrics, isOpen]);

    const handleToggleOpen = (event) => {
        if (isOpen) {
            handleCloseDropdown();
            return;
        }

        document.dispatchEvent(new CustomEvent(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, {
            detail: { id: dropdownId }
        }));
        setDropdownPosition(null);
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setAnchorMetrics({
                clickX: typeof event.clientX === 'number' ? event.clientX : rect.left + (rect.width / 2),
                triggerBottom: rect.bottom
            });
        }
        setIsOpen(true);
    };

    React.useEffect(() => {
        if (!isOpen) return undefined;

        const handleClickOutside = (event) => {
            const clickedTrigger = triggerRef.current?.contains(event.target);
            const clickedDropdown = dropdownRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedDropdown) {
                handleCloseDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleCloseDropdown, isOpen]);

    React.useEffect(() => {
        const handleOtherDropdownOpen = (event) => {
            if (event.detail?.id !== dropdownId) {
                setDropdownPosition(null);
                setIsOpen(false);
            }
        };

        document.addEventListener(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, handleOtherDropdownOpen);
        return () => document.removeEventListener(RECENT_TXN_TOOLBAR_DROPDOWN_EVENT, handleOtherDropdownOpen);
    }, [dropdownId]);

    const toggleColumn = (key) => {
        onApplySelection({
            ...normalizedSelection,
            [key]: !normalizedSelection[key]
        });
    };

    return (
        <>
            <div className="relative hidden lg:block" ref={triggerRef}>
                <button
                    type="button"
                    onClick={handleToggleOpen}
                    className="group flex h-6 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
                >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Columns</span>
                    <Settings2 size={11} className="text-slate-500" />
                </button>
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[120] w-[170px] overflow-y-auto no-scrollbar rounded-xl border border-gray-100 bg-white px-3 pt-3 pb-2 shadow-2xl"
                    style={dropdownPosition
                        ? { top: dropdownPosition.top, left: dropdownPosition.left, maxHeight: dropdownPosition.maxHeight }
                        : { top: -9999, left: -9999, visibility: 'hidden' }}
                >
                    <div className="max-h-48 overflow-y-auto py-0.5 no-scrollbar">
                        {RECENT_TXN_COLUMNS.map((column) => {
                            const isSelected = normalizedSelection[column.key];
                            return (
                                <button
                                    key={column.key}
                                    type="button"
                                    onClick={() => toggleColumn(column.key)}
                                    className={cn(
                                        "group flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-gray-50",
                                        isSelected
                                            ? "font-medium text-gray-900"
                                            : "font-medium text-gray-600"
                                    )}
                                >
                                    <span className="truncate pr-2 text-[12px]">{column.label}</span>
                                    <span className={cn("shrink-0", isSelected ? "text-primary" : "text-transparent")}>
                                        <Eye size={12} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const DescriptionTooltip = ({ description }) => {
    const [visible, setVisible] = React.useState(false);
    if (!description || description === '-') return <span className="text-[13px] font-medium text-gray-400 recent-laptop-description-text">-</span>;
    const needsTooltip = description.length > 25;
    return (
        <span
            className="relative inline-block w-full max-w-[200px]"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-[13px] font-medium text-gray-800 cursor-default hover:text-gray-900 transition-colors recent-laptop-description-text">
                {description}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[12px] font-semibold text-gray-700 whitespace-normal break-words leading-relaxed recent-laptop-description-text">{description}</span>
                    </span>
                </span>
            )}
        </span>
    );
};

const RecentTransactions = ({ maxVisibleDesktopRows = 20, fillAvailableHeight = false }) => {
    const { selectedBranch, loading: branchLoading, getBranchFilterValue } = useBranch();
    const navigate = useNavigate();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { formatCurrency, formatDate } = usePreferences();
    const [transactions, setTransactions] = React.useState([]);
    const [selectedTypeFilters, setSelectedTypeFilters] = React.useState([]);
    const [visibleColumns, setVisibleColumns] = React.useState(DEFAULT_VISIBLE_RECENT_TXN_COLUMNS);
    const [deleteDialog, setDeleteDialog] = React.useState({
        open: false,
        id: null,
        label: '',
        loading: false
    });
    const [loading, setLoading] = React.useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);
    const cacheKey = `dashboard:recentTx:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}`;
    const columnSettingsKey = `${RECENT_TXN_COLUMN_STORAGE_KEY}:${user?.id || 'user'}`;
    const recentTransactionsReady = Boolean(
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

    React.useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setTransactions(parsed);
                setHasFetchedOnce(true);
            }
        } catch {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    React.useEffect(() => {
        if (!user?.id) {
            setVisibleColumns(DEFAULT_VISIBLE_RECENT_TXN_COLUMNS);
            return;
        }

        try {
            const raw = localStorage.getItem(columnSettingsKey);
            if (!raw) {
                setVisibleColumns(DEFAULT_VISIBLE_RECENT_TXN_COLUMNS);
                return;
            }

            setVisibleColumns(normalizeRecentTxColumns(JSON.parse(raw)));
        } catch {
            setVisibleColumns(DEFAULT_VISIBLE_RECENT_TXN_COLUMNS);
        }
    }, [columnSettingsKey]);

    React.useEffect(() => {
        if (!user?.id) return;

        try {
            localStorage.setItem(columnSettingsKey, JSON.stringify(visibleColumns));
        } catch {
            // Ignore storage errors
        }
    }, [columnSettingsKey, user?.id, visibleColumns]);

    const MAX_VISIBLE_ROWS = 20;

    const deriveCategoryName = (txn) => {
        const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
        const typeId = txn.txnTypeId;

        if (type === 'transfer' || typeId === 4) {
            const toEntry = txn.entries?.find(e => e.debit > 0);
            if (toEntry && (toEntry.accountName || toEntry.account?.name)) {
                return toEntry.accountName || toEntry.account.name;
            }
        }

        return (
            txn.category?.name ||
            txn.categoryName ||
            txn.subCategory?.name ||
            txn.subCategoryName ||
            'Uncategorized'
        );
    };

    const deriveAccountName = (txn) => {
        let accountName =
            txn.accountName ||
            (typeof txn.account === 'object' && txn.account !== null ? txn.account.name : txn.account) ||
            txn.method ||
            '-';

        if (txn.entries && txn.entries.length > 0) {
            const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
            const typeId = txn.txnTypeId;

            if (type === 'expense' || typeId === 2) {
                const asset = txn.entries.find((entry) => entry.credit > 0);
                if (asset && (asset.accountName || asset.account?.name)) {
                    accountName = asset.accountName || asset.account.name;
                }
            } else if (type === 'income' || typeId === 1) {
                const asset = txn.entries.find((entry) => entry.debit > 0);
                if (asset && (asset.accountName || asset.account?.name)) {
                    accountName = asset.accountName || asset.account.name;
                }
            } else if (type === 'transfer' || typeId === 4 || type === 'investment' || typeId === 3) {
                const from = txn.entries.find((entry) => entry.credit > 0);
                if (from && (from.accountName || from.account?.name)) {
                    accountName = from.accountName || from.account.name;
                }
            }
        }

        return accountName || '-';
    };

    React.useEffect(() => {
        const controller = new AbortController();

        const fetchRecent = async () => {
            // Check loading states again inside (though guarded by debounce, good for safety)
            if (branchLoading || yearLoading) return;
            if (!user || !selectedBranch?.id || !selectedYear?.id) return;

            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;
                const requestKey = JSON.stringify({
                    orgId: selectedOrg?.id || null,
                    yearId: selectedYear?.id || null,
                    branchFilter
                });
                const lastStartedAt = recentTransactionsFetches.get(requestKey) || 0;
                if (Date.now() - lastStartedAt < 800) return;
                recentTransactionsFetches.set(requestKey, Date.now());
                const mapResponse = (rows = []) => rows.map(t => {
                    const typeStr = t.transactionType?.name || (t.txnType ? t.txnType.charAt(0).toUpperCase() + t.txnType.slice(1) : 'Unknown');
                    const isTransfer = typeStr.toLowerCase() === 'transfer' || t.txnTypeId === 4;
                    const catName = deriveCategoryName(t);
                    return {
                        id: t.id,
                        date: t.txnDate,
                        branchId: t.branchId,
                        notes: t.notes || '-',
                        category: catName,
                        type: typeStr,
                        amount: t.amountBaseCurrency || t.amountBase,
                        baseCurrency: t.baseCurrency,
                        account: deriveAccountName(t),
                        party: isTransfer ? catName : (t.contact || t.payee || '-'),
                        createdBy: t.createdByName || '-'
                    };
                });

                const response = await apiService.transactions.getAll({
                    branchId: branchFilter,
                    financialYearId: selectedYear.id,
                    limit: 20
                }, { signal: controller.signal });

                if (response.success) {
                    const mapped = mapResponse(response.data);
                    if (!controller.signal.aborted) {
                        setTransactions(mapped);
                        try {
                            sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
                        } catch {
                            // Ignore storage errors
                        }
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch recent transactions:", error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setHasFetchedOnce(true);
                }
            }
        };

        // Debounce fetch to prevent "Canceled" noise when dependencies update rapidly (e.g. Branch then Year context)
        const timeoutId = setTimeout(() => {
            // Dependencies check
            if (recentTransactionsReady) {
                fetchRecent();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [recentTransactionsReady, user?.id, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, branchLoading, yearLoading, getBranchFilterValue, cacheKey]);

    const transactionTypeOptions = React.useMemo(() => {
        const optionMap = new Map();

        DEFAULT_TRANSACTION_TYPE_ORDER.forEach((typeValue) => {
            optionMap.set(typeValue, getTransactionTypeMeta(typeValue));
        });

        transactions.forEach((transaction) => {
            const meta = getTransactionTypeMeta(transaction.type);
            if (!optionMap.has(meta.value)) {
                optionMap.set(meta.value, meta);
            }
        });

        return Array.from(optionMap.values()).sort((left, right) => {
            const leftOrder = DEFAULT_TRANSACTION_TYPE_ORDER.indexOf(left.value);
            const rightOrder = DEFAULT_TRANSACTION_TYPE_ORDER.indexOf(right.value);

            if (leftOrder === -1 && rightOrder === -1) {
                return left.label.localeCompare(right.label);
            }
            if (leftOrder === -1) return 1;
            if (rightOrder === -1) return -1;
            return leftOrder - rightOrder;
        });
    }, [transactions]);

    const displayTransactions = React.useMemo(() => {
        const shouldDisplayAllTypes = selectedTypeFilters.length === 0
            || selectedTypeFilters.length === transactionTypeOptions.length;

        if (shouldDisplayAllTypes) return transactions;
        return transactions.filter((transaction) => (
            selectedTypeFilters.includes(normalizeTransactionType(transaction.type))
        ));
    }, [selectedTypeFilters, transactionTypeOptions.length, transactions]);
    const canEditTxn = React.useCallback((txn) => {
        if (user?.role === 'owner') return true;
        if (user?.role === 'member') {
            const orgBranches = typeof user.branchIds === 'string'
                ? user.branchIds.split(',').map(Number)
                : (Array.isArray(user.branchIds) ? user.branchIds.map(Number) : []);

            if (txn.branchId) {
                return orgBranches.includes(Number(txn.branchId));
            }
        }

        return true;
    }, [user?.branchIds, user?.role]);
    const showLoadingState = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);
    const desktopTableHeight = (maxVisibleDesktopRows * 30) + 38;
    const desktopVisibleRows = Math.min(displayTransactions.length || maxVisibleDesktopRows, maxVisibleDesktopRows);
    const desktopContentHeight = (desktopVisibleRows * 30) + 38;
    const shouldAutoSizeDesktop = !fillAvailableHeight && displayTransactions.length > 0 && displayTransactions.length <= maxVisibleDesktopRows;
    const desktopTableStyle = fillAvailableHeight
        ? undefined
        : shouldAutoSizeDesktop
            ? { height: `${desktopContentHeight}px`, maxHeight: `${desktopTableHeight}px` }
            : { height: `${desktopTableHeight}px`, maxHeight: `${desktopTableHeight}px` };
    const desktopColumns = React.useMemo(() => ([
        {
            key: 'date',
            label: 'Date',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap',
            render: (tx) => (
                <span className="px-4 py-[7px] text-[13px] font-medium text-gray-600 whitespace-nowrap">
                    {formatDate(tx.date)}
                </span>
            )
        },
        {
            key: 'type',
            label: 'Type',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap',
            render: (tx) => (
                <span className={cn(
                    'px-4 py-[7px] text-[10px] font-bold whitespace-nowrap recent-desktop-type-body',
                    tx.type?.toLowerCase() === 'income' ? 'text-emerald-600' :
                        tx.type?.toLowerCase() === 'expense' ? 'text-rose-600' :
                            'text-blue-600'
                )}>
                    {tx.type}
                </span>
            )
        },
        {
            key: 'account',
            label: 'Account',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap',
            render: (tx) => (
                <span className="px-4 py-[7px] text-[13px] text-gray-700 truncate">
                    {tx.account || '-'}
                </span>
            )
        },
        {
            key: 'party',
            label: 'Party',
            headerClassName: 'pl-20 pr-1 py-2 font-bold whitespace-nowrap',
            render: (tx) => (
                <span className="pl-20 pr-1 py-[7px] text-[13px] font-normal text-gray-700 truncate">
                    {tx.party}
                </span>
            )
        },
        {
            key: 'amount',
            label: <span className="inline-block min-w-[10ch] text-right">Amount</span>,
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap text-right',
            render: (tx) => (
                <span className="block px-4 py-[7px] whitespace-nowrap text-right">
                    <span className={cn(
                        'inline-block min-w-[10ch] text-right text-[13px] font-bold tabular-nums whitespace-nowrap',
                        tx.type?.toLowerCase() === 'income' ? 'text-emerald-600' :
                            tx.type?.toLowerCase() === 'expense' ? 'text-rose-600' :
                                'text-gray-900'
                    )}>
                        {formatCurrency(tx.amount)}
                    </span>
                </span>
            )
        },
        {
            key: 'category',
            label: 'Category',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap',
            render: (tx) => (
                <span className="px-4 py-[7px] text-[13px] text-gray-500 truncate">
                    {tx.category}
                </span>
            )
        },
        {
            key: 'description',
            label: 'Description',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap recent-laptop-description-col',
            render: (tx) => (
                <span className="block px-4 py-[7px] text-[13px] font-medium text-gray-800 recent-laptop-description">
                    <DescriptionTooltip description={tx.notes} />
                </span>
            )
        },
        {
            key: 'createdBy',
            label: 'Created by',
            headerClassName: 'px-4 py-2 font-bold whitespace-nowrap text-right',
            render: (tx) => (
                <span className="block px-4 py-[7px] text-[11px] font-medium text-gray-500 whitespace-nowrap truncate text-right">
                    {tx.createdBy}
                </span>
            )
        }
    ]), [formatCurrency, formatDate]);
    const visibleDesktopColumns = React.useMemo(
        () => desktopColumns.filter((column) => visibleColumns[column.key]),
        [desktopColumns, visibleColumns]
    );
    const desktopSharedColumnWidth = React.useMemo(() => {
        const totalDesktopColumns = visibleDesktopColumns.length + 1;
        if (!totalDesktopColumns) {
            return '100%';
        }
        return `calc(100% / ${totalDesktopColumns})`;
    }, [visibleDesktopColumns.length]);
    const handleEdit = React.useCallback((tx) => {
        navigate(`/transactions/edit/${tx.id}`);
    }, [navigate]);
    const handleDelete = React.useCallback((event, tx) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setDeleteDialog({
            open: true,
            id: tx.id,
            label: String(tx.party || tx.account || tx.category || tx.type || '').trim(),
            loading: false
        });
    }, []);
    const handleCloseDeleteDialog = React.useCallback(() => {
        setDeleteDialog((current) => (
            current.loading ? current : { open: false, id: null, label: '', loading: false }
        ));
    }, []);
    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteDialog.id) return;

        setDeleteDialog((current) => ({ ...current, loading: true }));

        try {
            await apiService.transactions.delete(deleteDialog.id);
            notifyTransactionDataChanged();
            setTransactions((current) => {
                const next = current.filter((tx) => tx.id !== deleteDialog.id);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(next));
                } catch {
                    // Ignore storage errors
                }
                return next;
            });
            setDeleteDialog({ open: false, id: null, label: '', loading: false });
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to delete transaction';
            alert(msg);
            setDeleteDialog((current) => ({ ...current, loading: false }));
        }
    }, [cacheKey, deleteDialog.id]);

    return (
        <Card
            title={
                <div className="flex items-center space-x-2 pt-1">
                    <ListFilter size={16} className="text-primary" />
                    <span className="text-[13px] font-bold recent-laptop-title">Recent Transactions</span>
                </div>
            }
            headerAction={
                <div className="flex items-center gap-2">
                    <RecentTransactionColumnSettings
                        value={visibleColumns}
                        onApplySelection={(nextValue) => setVisibleColumns(normalizeRecentTxColumns(nextValue))}
                    />
                    <div className="hidden md:block w-[72px]">
                        <TransactionTypeFilter
                            options={transactionTypeOptions}
                            selectedTypes={selectedTypeFilters}
                            onApplySelection={setSelectedTypeFilters}
                        />
                    </div>
                    <Button onClick={() => navigate('/transactions')} variant="primary" size="sm" className="h-6 w-[60px] rounded-md px-1 py-0 text-[9px] font-bold uppercase leading-none">View</Button>
                </div>
            }
            headerClassName="py-3"
            noPadding
            className={cn("overflow-hidden", fillAvailableHeight ? "h-full" : shouldAutoSizeDesktop ? "h-auto self-start" : "h-full")}
        >
            <div
                className={cn(
                    "flex flex-col min-h-0 overflow-hidden",
                    fillAvailableHeight ? "h-full" : shouldAutoSizeDesktop ? "h-auto" : "h-full"
                )}
                aria-busy={loading}
            >

                {/* Mobile Card View */}
                <div
                    className="dashboard-tablet-recent-mobile relative lg:hidden flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar"
                    style={{ maxHeight: `${MAX_VISIBLE_ROWS * 54}px` }}
                >
                    {displayTransactions.length > 0 ? (
                        displayTransactions.map((tx) => (
                            <div key={tx.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
                                <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Date</div>
                                        <div className="font-bold text-gray-800 text-sm">{formatDate(tx.date)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Amount</div>
                                        <div className={cn(
                                            "font-bold text-sm tabular-nums",
                                            tx.type?.toLowerCase() === 'income' ? "text-emerald-600" :
                                                tx.type?.toLowerCase() === 'expense' ? "text-rose-600" :
                                                    "text-gray-900"
                                        )}>
                                            {formatCurrency(tx.amount)}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Description</div>
                                        <div className="font-medium text-gray-700 text-[10px] truncate">{tx.notes}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Party</div>
                                        <div className="font-medium text-gray-600 text-xs truncate">{tx.party}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Type</div>
                                        <span className={cn("text-[10px] font-bold",
                                            tx.type?.toLowerCase() === 'income' ? "text-emerald-600" :
                                                tx.type?.toLowerCase() === 'expense' ? "text-rose-600" :
                                                    "text-blue-600"
                                        )}>{tx.type}</span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleEdit(tx)}
                                        disabled={!canEditTxn(tx)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            canEditTxn(tx) ? "text-gray-400 hover:text-blue-600 hover:bg-blue-50" : "text-gray-200 cursor-not-allowed"
                                        )}
                                        title={canEditTxn(tx) ? "Edit" : "You do not have access to edit this transaction"}
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => handleDelete(event, tx)}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        !showLoadingState && (
                            <div className="py-12 text-center text-gray-400 text-sm font-medium">No transactions found</div>
                        )
                    )}
                    {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                </div>

                {/* Desktop Table View */}
                <div
                    className={cn(
                        "dashboard-tablet-recent-desktop relative hidden lg:block min-h-0 overflow-y-auto recent-laptop-scroll",
                        fillAvailableHeight && "recent-laptop-scroll-fill",
                        fillAvailableHeight ? "flex-1" : shouldAutoSizeDesktop ? "flex-none" : "flex-1"
                    )}
                    style={desktopTableStyle}
                >
                    <table className="w-full table-fixed text-sm text-left recent-laptop-table">
                        <thead className="sticky top-0 z-10 text-xs text-gray-600 font-extrabold uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                {visibleDesktopColumns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={column.headerClassName}
                                        style={{ width: desktopSharedColumnWidth, maxWidth: desktopSharedColumnWidth }}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                                <th
                                    className="px-4 py-2 font-bold whitespace-nowrap text-right"
                                    style={{ width: desktopSharedColumnWidth, maxWidth: desktopSharedColumnWidth }}
                                >
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayTransactions.length > 0 ? displayTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    {visibleDesktopColumns.map((column) => (
                                        <td
                                            key={column.key}
                                            style={{ width: desktopSharedColumnWidth, maxWidth: desktopSharedColumnWidth }}
                                        >
                                            {column.render(tx)}
                                        </td>
                                    ))}
                                    <td
                                        className="px-4 py-[7px]"
                                        style={{ width: desktopSharedColumnWidth, maxWidth: desktopSharedColumnWidth }}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(tx)}
                                                disabled={!canEditTxn(tx)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-all",
                                                    canEditTxn(tx) ? "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" : "text-gray-200 cursor-not-allowed"
                                                )}
                                                title={canEditTxn(tx) ? "Edit" : "You do not have access to edit this transaction"}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => handleDelete(event, tx)}
                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={(visibleDesktopColumns.length || 1) + 1} className="py-20 text-center text-gray-400 text-sm font-medium">
                                        {!showLoadingState ? 'No transactions found' : ''}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                </div>

            </div>
            <ConfirmDialog
                open={deleteDialog.open}
                title="Delete transaction?"
                message={deleteDialog.label
                    ? `Are you sure you want to archive "${deleteDialog.label}"? It will be hidden from active lists.`
                    : 'Are you sure you want to archive this transaction? It will be hidden from active lists.'}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                isSubmitting={deleteDialog.loading}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            />
        </Card >
    );
};

export default RecentTransactions;
