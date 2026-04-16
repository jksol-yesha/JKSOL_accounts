
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Wallet, Building2, Calendar, FileText, Edit, Trash2,
    Download, X, FileSpreadsheet, ChevronDown, ArrowUpDown, Paperclip, Eye, ExternalLink, User, Loader2, Settings2
} from 'lucide-react';
import apiService, { buildAttachmentUrl, downloadAttachmentFile } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../context/AuthContext';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';


import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import { cn } from '../../utils/cn';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import MobilePagination from '../../components/common/MobilePagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CustomSelect from '../../components/common/CustomSelect';
import ImportTransactionModal from './ImportTransactionModal';
// import ImportPDFModal from './ImportPDFModal';
import DateRangePicker from '../../components/common/DateRangePicker';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import AccountNameTooltip from '../../components/common/AccountNameTooltip';
import { notifyTransactionDataChanged } from './transactionDataSync';

const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    label: '',
    loading: false
});

const TXN_TABLE_COLUMN_STORAGE_KEY = 'transactions:tableColumns:v1';
const TXN_TABLE_COLUMNS = [
    { key: 'id', label: 'Id', defaultVisible: true },
    { key: 'party', label: 'Party', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'type', label: 'Type', defaultVisible: true },
    { key: 'branch', label: 'Branch', defaultVisible: true },
    { key: 'account', label: 'Account', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: true },
    { key: 'notes', label: 'Notes', defaultVisible: true },
    { key: 'amount', label: 'Amount', defaultVisible: true },
    { key: 'createdBy', label: 'Created By', defaultVisible: true }
];

const DEFAULT_VISIBLE_TXN_COLUMNS = TXN_TABLE_COLUMNS.reduce((accumulator, column) => {
    accumulator[column.key] = column.defaultVisible;
    return accumulator;
}, {});

const normalizeTxnColumns = (value) => {
    const normalized = { ...DEFAULT_VISIBLE_TXN_COLUMNS };

    if (!value || typeof value !== 'object') {
        return normalized;
    }

    TXN_TABLE_COLUMNS.forEach((column) => {
        if (typeof value[column.key] === 'boolean') {
            normalized[column.key] = value[column.key];
        }
    });

    return normalized;
};

/** Custom tooltip that shows white card with full branch list on hover */
const BranchTooltip = ({ branchNames }) => {
    const [visible, setVisible] = useState(false);
    if (!branchNames || branchNames.length === 0) return <span className="text-gray-400 text-xs">-</span>;
    const displayText = branchNames.join(', ');
    const needsTooltip = branchNames.length > 1 || displayText.length > 18;
    return (
        <span
            className="relative inline-block max-w-[120px]"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-xs font-bold text-primary cursor-default hover:text-primary/80 transition-colors">
                {displayText}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Branches</span>
                    {branchNames.map((b, i) => (
                        <span key={i} className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-gray-700 truncate">{b}</span>
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
};

const PartyTooltip = ({ partyName }) => {
    const [visible, setVisible] = useState(false);
    if (!partyName || partyName === '-') return <span className="text-xs font-bold text-gray-700">-</span>;
    const needsTooltip = partyName.length > 15;
    return (
        <span
            className="relative inline-block max-w-[130px]"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-xs font-bold text-gray-700 cursor-default hover:text-gray-900 transition-colors">
                {partyName}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <span className="text-[12px] font-semibold text-gray-700 whitespace-normal break-words">{partyName}</span>
                    </span>
                </span>
            )}
        </span>
    );
};

const DescriptionTooltip = ({ description }) => {
    const [visible, setVisible] = useState(false);
    if (!description || description === '-') return <span className="text-[13px] font-medium text-gray-400">-</span>;
    const needsTooltip = description.length > 25;
    return (
        <span
            className="relative inline-block w-full max-w-[250px]"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-[13px] font-medium text-gray-800 cursor-default hover:text-gray-900 transition-colors">
                {description}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[12px] font-semibold text-gray-700 whitespace-normal break-words leading-relaxed">{description}</span>
                    </span>
                </span>
            )}
        </span>
    );
};

const enrichTransaction = (txn) => {
    // If already enriched or no entries, return as is (but ensure name fields exist)
    let accountName = txn.account?.name || '-';
    let categoryName = txn.category?.name || '-';

    // If double-entry data exists, override/derive
    if (txn.entries && txn.entries.length > 0) {
        const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
        // 1=Income, 2=Expense, 3=Transfer (using rough heuristics or IDs if available)
        const typeId = txn.txnTypeId;

        if (type === 'expense' || typeId === 2) {
            const exp = txn.entries.find(e => e.debit > 0);
            const asset = txn.entries.find(e => e.credit > 0);
            if (exp && exp.account) categoryName = exp.account.name;
            if (asset && asset.account) accountName = asset.account.name;
        } else if (type === 'income' || typeId === 1) {
            const asset = txn.entries.find(e => e.debit > 0);
            const inc = txn.entries.find(e => e.credit > 0);
            if (asset && asset.account) accountName = asset.account.name;
            if (inc && inc.account) categoryName = inc.account.name;
        } else if (type === 'transfer' || typeId === 4) {
            const to = txn.entries.find(e => e.debit > 0);
            const from = txn.entries.find(e => e.credit > 0);
            if (from && from.account) accountName = from.account.name;
            if (to && to.account) categoryName = to.account.name;
        } else if (type === 'investment' || typeId === 3) {
            // Dr InvestmentAcc (toAccountId), Cr FromAcc (accountId)
            const to = txn.entries.find(e => e.debit > 0);
            const from = txn.entries.find(e => e.credit > 0);
            if (from && from.account) accountName = from.account.name;
            if (to && to.account) categoryName = to.account.name;
        }
    }

    // Return a new object with safely patched account/category objects
    return {
        ...txn,
        account: { ...(txn.account || {}), name: accountName },
        category: { ...(txn.category || {}), name: categoryName }
    };
};

const TransactionFilters = ({ isOpen, onClose, filters, setFilters, uniquePayees, onApply, onReset, anchorRef }) => {
    const [panelPosition, setPanelPosition] = useState(null);

    useLayoutEffect(() => {
        if (!isOpen) {
            setPanelPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!anchorRef?.current) return;

            const rect = anchorRef.current.getBoundingClientRect();
            const viewportPadding = 16;
            const panelWidth = Math.min(600, window.innerWidth - viewportPadding * 2);
            const left = Math.min(
                Math.max(viewportPadding, rect.right - panelWidth),
                window.innerWidth - panelWidth - viewportPadding
            );
            const top = rect.bottom + 8;
            const maxHeight = Math.max(280, window.innerHeight - top - viewportPadding);

            setPanelPosition({
                top,
                left,
                width: panelWidth,
                maxHeight,
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, anchorRef]);

    if (!isOpen) return null;

    const handleChange = (key, value) => {
        setFilters(prev => {
            const updates = { [key]: value };
            // Reset Scope if Money Flow changes
            if (key === 'moneyFlow') {
                updates.scope = 'All Transactions';
                updates.category = 'All'; // Also reset category since it cascades
                updates.payee = 'All';    // Also reset payee
            }
            return { ...prev, ...updates };
        });
    };

    if (!panelPosition || typeof document === 'undefined') return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[110] bg-transparent" onClick={onClose} />
            <div
                className="fixed z-[120] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-2 duration-200"
                style={panelPosition}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-gray-900">Transaction Filters</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Money Flow</label>
                        <CustomSelect
                            dropdownGroup="transaction-filter"
                            value={filters.moneyFlow}
                            onChange={(e) => handleChange('moneyFlow', e.target.value)}
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-black transition-all"
                        >
                            <option value="All">All</option>
                            <option value="In">In</option>
                            <option value="Out">Out</option>
                        </CustomSelect>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Transaction Type</label>
                        <CustomSelect
                            dropdownGroup="transaction-filter"
                            value={filters.scope}
                            onChange={(e) => handleChange('scope', e.target.value)}
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-black transition-all"
                        >
                            <option value="All Transactions">All Transactions</option>
                            {(filters.moneyFlow === 'All' || filters.moneyFlow === 'In') && <option value="Income">Income</option>}
                            {(filters.moneyFlow === 'All' || filters.moneyFlow === 'Out') && <option value="Expense">Expense</option>}
                            {(filters.moneyFlow === 'All' || filters.moneyFlow === 'Out') && <option value="Transfer">Transfer</option>}
                            {(filters.moneyFlow === 'All' || filters.moneyFlow === 'Out') && <option value="Investment">Investment</option>}
                        </CustomSelect>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Time Period</label>
                        <CustomSelect
                            dropdownGroup="transaction-filter"
                            value={filters.timePeriod}
                            onChange={(e) => handleChange('timePeriod', e.target.value)}
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-black transition-all"
                        >
                            <option value="All Time">All Time</option>
                            <option value="This Month">This Month</option>
                            <option value="Last Month">Last Month</option>
                            <option value="Last 6 Months">Last 6 Months</option>
                            <option value="This Year">This Year</option>
                            <option value="Last Year">Last Year</option>
                            <option value="Custom Range">Custom Range</option>
                        </CustomSelect>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Custom Range</label>
                        <div className={cn("transition-all duration-200", filters.timePeriod !== 'Custom Range' && "opacity-50 pointer-events-none grayscale")}>
                            <DateRangePicker
                                startDate={filters.startDate}
                                endDate={filters.endDate}
                                onChange={(dates) => setFilters(prev => ({ ...prev, ...dates }))}
                                placeholder="Select dates..."
                            />
                        </div>
                    </div>


                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payee</label>
                        <CustomSelect
                            dropdownGroup="transaction-filter"
                            value={filters.payee}
                            onChange={(e) => handleChange('payee', e.target.value)}
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-black transition-all"
                        >
                            <option value="All">All Payees</option>
                            {uniquePayees.map(payee => (
                                <option key={payee} value={payee}>{payee}</option>
                            ))}
                        </CustomSelect>
                    </div>

                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-50">
                    <button
                        onClick={onReset}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                    >
                        Reset
                    </button>
                    <button
                        onClick={onApply}
                        className="px-6 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};

const TransactionColumnSettings = ({
    value,
    onApplySelection,
    onBeforeOpen,
    externalCloseSignal
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [anchorMetrics, setAnchorMetrics] = useState(null);

    const normalizedSelection = useMemo(() => normalizeTxnColumns(value), [value]);

    const handleCloseDropdown = React.useCallback(() => {
        setDropdownPosition(null);
        setIsOpen(false);
    }, []);

    useLayoutEffect(() => {
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

    useEffect(() => {
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

    useEffect(() => {
        if (!isOpen || !externalCloseSignal) return undefined;
        handleCloseDropdown();
        return undefined;
    }, [externalCloseSignal, handleCloseDropdown, isOpen]);

    const handleToggleOpen = (event) => {
        if (isOpen) {
            handleCloseDropdown();
            return;
        }

        onBeforeOpen?.();
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
                    className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-xl border transition-all relative z-50",
                        isOpen
                            ? "bg-gray-100 text-gray-700 border-gray-200"
                            : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-200"
                    )}
                    title="Columns"
                >
                    <Settings2 size={18} strokeWidth={2.2} />
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
                        {TXN_TABLE_COLUMNS.map((column) => {
                            const isSelected = normalizedSelection[column.key];
                            return (
                                <button
                                    key={column.key}
                                    type="button"
                                    onClick={() => toggleColumn(column.key)}
                                    className={cn(
                                        "group flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-gray-50",
                                        isSelected ? "font-medium text-gray-900" : "font-medium text-gray-600"
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

const AttachmentPreview = ({ attachmentPath, isOpen, onClose, onViewFullScreen, className = "left-0 top-full mt-2" }) => {
    if (!attachmentPath || !isOpen) return null;

    const isImage = attachmentPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const fileName = attachmentPath.split('/').pop().split('-').slice(5).join('-') || attachmentPath.split('/').pop();
    const fullUrl = buildAttachmentUrl(attachmentPath);

    return (
        <div className={cn(
            "absolute w-72 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-3 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto",
            className
        )}>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3 pb-2 border-b border-gray-100 flex justify-between items-center">
                <span>Attachment</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
                <button
                    type="button"
                    className="flex w-full text-left items-center gap-3 p-2 hover:bg-primary/5 rounded-lg transition-all group/item border border-transparent hover:border-primary/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClose) onClose();
                        if (onViewFullScreen) onViewFullScreen(attachmentPath);
                    }}
                >
                    <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 shadow-sm group-hover/item:border-primary/20 transition-colors">
                        {isImage ? (
                            <img src={fullUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                                <FileText size={18} className="text-gray-400 group-hover/item:text-primary transition-colors" />
                                <span className="text-[8px] font-bold text-gray-300 uppercase">{attachmentPath.split('.').pop()}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-gray-700 truncate group-hover/item:text-primary transition-colors" title={fileName}>{fileName}</div>
                        <div className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <ExternalLink size={10} className="group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5 transition-transform" />
                            <span className="font-semibold uppercase tracking-wider">Open Attachment</span>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
};

const Transactions = () => {
    const navigate = useNavigate();
    const { selectedBranch, branches } = useBranch();
    const { user } = useAuth();
    const { selectedYear } = useYear();
    const { formatCurrency, formatDate } = usePreferences();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

    // 🔥 WebSocket Integration
    const socketBranchId = typeof selectedBranch?.id === 'number' ? selectedBranch.id : null;
    const { on } = useWebSocket(socketBranchId);

    // Toolbar States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const pageSize = 20;
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'txnDate', direction: 'desc' });
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_TXN_COLUMNS);

    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [activeAttachmentTxnId, setActiveAttachmentTxnId] = useState(null); // Keep for legacy if needed, but we use object now
    const [attachmentViewer, setAttachmentViewer] = useState({ isOpen: false, txnId: null, path: null, position: { top: 0, right: 0 } });
    const [fullScreenAttachment, setFullScreenAttachment] = useState({ isOpen: false, path: null });
    const isPrinting = false;
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    const [desktopViewportHeight, setDesktopViewportHeight] = useState(null);
    const [desktopTableHeight, setDesktopTableHeight] = useState(null);
    const filterBoxRef = useRef(null);
    const pageViewportRef = useRef(null);
    const desktopTableRef = useRef(null);
    const toolbarRef = useRef(null);
    const desktopPaginationRef = useRef(null);

    // Filter Logic State
    const [tempFilters, setTempFilters] = useState({
        moneyFlow: 'All',
        scope: 'All Transactions',
        timePeriod: 'All Time',
        startDate: '',
        endDate: '',
        payee: 'All'
    });
    const [appliedFilters, setAppliedFilters] = useState({ ...tempFilters });
    const cacheKey = `transactions:list:v2:${selectedYear?.id || 'fy'}`;
    const columnSettingsKey = `${TXN_TABLE_COLUMN_STORAGE_KEY}:${user?.id || 'user'}`;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    useEffect(() => {
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

    useEffect(() => {
        if (!user?.id) {
            setVisibleColumns(DEFAULT_VISIBLE_TXN_COLUMNS);
            return;
        }

        try {
            const raw = localStorage.getItem(columnSettingsKey);
            if (!raw) {
                setVisibleColumns(DEFAULT_VISIBLE_TXN_COLUMNS);
                return;
            }

            setVisibleColumns(normalizeTxnColumns(JSON.parse(raw)));
        } catch {
            setVisibleColumns(DEFAULT_VISIBLE_TXN_COLUMNS);
        }
    }, [columnSettingsKey, user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        try {
            localStorage.setItem(columnSettingsKey, JSON.stringify(visibleColumns));
        } catch {
            // Ignore storage errors
        }
    }, [columnSettingsKey, user?.id, visibleColumns]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const main = document.querySelector('main');
        if (!main) return undefined;

        let frameId = 0;
        let resizeObserver = null;

        const updateHeight = () => {
            const shouldConstrain = window.innerWidth >= 1024;

            if (!shouldConstrain) {
                setDesktopViewportHeight((prev) => (prev === null ? prev : null));
                return;
            }

            const footer = main.querySelector('footer');
            const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
            const nextHeight = Math.max(0, Math.floor(main.getBoundingClientRect().height - footerHeight));

            setDesktopViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        };

        const scheduleUpdate = () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(updateHeight);
        };

        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);

        if ('ResizeObserver' in window) {
            resizeObserver = new window.ResizeObserver(scheduleUpdate);
            resizeObserver.observe(main);
        }

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener('resize', scheduleUpdate);
            resizeObserver?.disconnect();
        };
    }, []);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let frameId = 0;
        let resizeObserver = null;

        const updateTableHeight = () => {
            const shouldConstrain = window.innerWidth >= 1024;

            if (!shouldConstrain) {
                setDesktopTableHeight((prev) => (prev === null ? prev : null));
                return;
            }

            const pageViewportBottom = pageViewportRef.current?.getBoundingClientRect().bottom || window.innerHeight;
            const tableTop = desktopTableRef.current?.getBoundingClientRect().top || 0;
            const paginationHeight = desktopPaginationRef.current?.getBoundingClientRect().height || 0;
            const viewportGutter = window.innerWidth >= 1280 ? 24 : 16;
            const nextHeight = Math.max(240, Math.floor(pageViewportBottom - tableTop - paginationHeight - viewportGutter));

            setDesktopTableHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        };

        const scheduleUpdate = () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(updateTableHeight);
        };

        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);

        if ('ResizeObserver' in window) {
            resizeObserver = new window.ResizeObserver(scheduleUpdate);
            if (pageViewportRef.current) resizeObserver.observe(pageViewportRef.current);
            if (desktopTableRef.current) resizeObserver.observe(desktopTableRef.current);
            if (toolbarRef.current) resizeObserver.observe(toolbarRef.current);
            if (desktopPaginationRef.current) resizeObserver.observe(desktopPaginationRef.current);
        }

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener('resize', scheduleUpdate);
            resizeObserver?.disconnect();
        };
    }, [desktopViewportHeight]);

    const canEditTxn = (txn) => {
        if (user?.role === 'owner') return true;
        if (user?.role === 'member') {
            const orgBranches = typeof user.branchIds === 'string'
                ? user.branchIds.split(',').map(Number)
                : (Array.isArray(user.branchIds) ? user.branchIds.map(Number) : []);

            // If the transaction has a branchId, check if the member has access to it
            if (txn.branchId) {
                return orgBranches.includes(Number(txn.branchId));
            }
        }
        return true; // Default to true for other roles/cases to maintain existing working
    };

    const fetchTransactions = React.useCallback(async (signal) => {
        if (!user || !selectedYear?.id) return;

        setLoading(true);
        try {
            // Bypass global branch filter: Always fetch 'all' branches
            const response = await apiService.transactions.getAll({
                branchId: 'all',
                financialYearId: selectedYear.id
            }, { signal });

            // Ensure we always have an array
            let data = [];
            if (Array.isArray(response)) {
                data = response;
            } else if (response && Array.isArray(response.data)) {
                data = response.data;
            }
            const enriched = data.map(enrichTransaction);
            setTransactions(enriched);
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(enriched));
            } catch {
                // Ignore storage errors
            }
        } catch (error) {
            if (isIgnorableRequestError(error)) return;
            console.error("Failed to fetch transactions:", error);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setHasFetchedOnce(true);
            }
        }
    }, [cacheKey, user, selectedYear?.id]);


    useEffect(() => {
        const controller = new AbortController();
        fetchTransactions(controller.signal);
        return () => controller.abort();
    }, [fetchTransactions]);

    // 🔥 Listen for real-time transaction updates
    useEffect(() => {
        // Listen for new transactions
        const unsubscribeCreate = on('transaction:created', () => {
            fetchTransactions();
        });

        // Listen for updated transactions
        const unsubscribeUpdate = on('transaction:updated', () => {
            fetchTransactions();
        });

        // Listen for deleted transactions
        const unsubscribeDelete = on('transaction:deleted', () => {
            fetchTransactions();
        });

        return () => {
            unsubscribeCreate();
            unsubscribeUpdate();
            unsubscribeDelete();
        };
    }, [fetchTransactions, on]); // Only depend on stable fetcher and listener binder

    // Sorting Handlers
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };


    const availablePayees = useMemo(() => {
        let filtered = Array.isArray(transactions) ? transactions : [];

        // Same cascading logic for payees
        if (tempFilters.moneyFlow !== 'All') {
            if (tempFilters.moneyFlow === 'In') filtered = filtered.filter(t => (t.type || t.txnType) === 'income');
            else if (tempFilters.moneyFlow === 'Out') filtered = filtered.filter(t => (t.type || t.txnType) === 'expense' || (t.type || t.txnType) === 'transfer');
        }
        if (tempFilters.scope !== 'All Transactions') {
            filtered = filtered.filter(t => (t.type || t.txnType) === tempFilters.scope.toLowerCase());
        }

        const payees = new Set(filtered.map(t => t.contact || t.payee || t.counterpartyName).filter(Boolean));
        return Array.from(payees).sort();
    }, [transactions, tempFilters.moneyFlow, tempFilters.scope]);


    useEffect(() => {
        if (!isFilterOpen) return;
        const handleOutsideClick = (event) => {
            if (event.target?.closest?.('[data-custom-select-dropdown="true"]')) {
                return;
            }
            if (filterBoxRef.current && !filterBoxRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isFilterOpen]);

    const groupedTransactions = useMemo(() => {
        // We bypass the global filter, so it's intrinsically ALWAYS 'multi' mode in terms of grouping logic
        const raw = Array.isArray(transactions) ? transactions : [];
        const groups = [];
        const branchOccurrenceMap = new Map();

        raw.forEach(txn => {
            const date = txn.txnDate || '';
            const amount = Number(txn.amountBaseCurrency || txn.finalAmountLocal || txn.amountBase || 0);
            const amountKey = amount.toFixed(2);
            const party = (txn.contact || txn.payee || txn.counterpartyName || '').trim().toLowerCase();
            const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
            const notes = (txn.notes || txn.description || '').trim().toLowerCase();
            const txnName = (txn.name || '').trim().toLowerCase();
            const accountName = (txn.account?.name || '').trim().toLowerCase();
            const categoryName = (txn.category?.name || '').trim().toLowerCase();
            const subCategoryName = (txn.subCategory?.name || txn.subCategoryName || '').trim().toLowerCase();
            const dataKey = `${date}|${amountKey}|${party}|${type}|${notes}|${txnName}|${accountName}|${categoryName}|${subCategoryName}`;
            const branchName = txn.branch?.name || (branches || []).find(b => String(b.id) === String(txn.branchId))?.name || 'Unknown';
            const branchId = Number(txn.branchId || 0);

            if (!branchOccurrenceMap.has(dataKey)) branchOccurrenceMap.set(dataKey, new Map());
            const branchCounts = branchOccurrenceMap.get(dataKey);
            const occurrenceDelta = (branchCounts.get(branchId) || 0) + 1;
            branchCounts.set(branchId, occurrenceDelta);

            const baseKey = `${dataKey}|${occurrenceDelta}`;
            let foundGroup = groups.find(g => g.baseKey === baseKey);

            if (foundGroup) {
                foundGroup.branchNames.push(branchName);
            } else {
                const newTxn = {
                    ...txn,
                    baseKey,
                    branchNames: [branchName]
                };
                groups.push(newTxn);
            }
        });

        return groups;
    }, [transactions, selectedBranch?.id, branches]);

    // Filtering & Sorting Logic
    const filteredTransactions = useMemo(() => {
        let result = [...groupedTransactions];

        // 1. Search Logic
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(txn =>
                (txn.contact || '').toLowerCase().includes(term) ||
                (txn.counterpartyName || '').toLowerCase().includes(term) ||
                (txn.payee || '').toLowerCase().includes(term) ||
                (txn.name || '').toLowerCase().includes(term) ||
                (txn.notes || '').toLowerCase().includes(term) ||
                (txn.account?.name || '').toLowerCase().includes(term) ||
                (txn.transactionType?.name || txn.txnType || '').toLowerCase().includes(term) ||
                String(txn.status || '').toLowerCase().includes(term) ||
                (txn.txnDate || '').toLowerCase().includes(term) ||
                (txn.amountBase || '').toString().includes(term)
            );
        }

        // 2. Applied Filters logic
        // Money Flow
        if (appliedFilters.moneyFlow !== 'All') {
            if (appliedFilters.moneyFlow === 'In') {
                result = result.filter(t => t.txnType === 'income');
            } else if (appliedFilters.moneyFlow === 'Out') {
                result = result.filter(t => t.txnType === 'expense' || t.txnType === 'transfer' || t.txnType === 'investment');
            }
        }

        // Scope
        if (appliedFilters.scope !== 'All Transactions') {
            result = result.filter(t => (t.transactionType?.name || t.txnType || '').toLowerCase() === appliedFilters.scope.toLowerCase());
        }


        // Payee
        if (appliedFilters.payee !== 'All') {
            result = result.filter(t => (t.contact || t.payee || t.counterpartyName) === appliedFilters.payee);
        }

        // Time Period
        if (appliedFilters.timePeriod !== 'All Time') {
            const now = new Date();

            result = result.filter(t => {
                const date = new Date(t.txnDate);
                if (appliedFilters.timePeriod === 'This Month') {
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last Month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last 6 Months') {
                    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                    return date >= sixMonthsAgo && date <= now;
                }
                if (appliedFilters.timePeriod === 'This Year') {
                    return date.getFullYear() === now.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last Year') {
                    return date.getFullYear() === now.getFullYear() - 1;
                }
                if (appliedFilters.timePeriod === 'Custom Range') {
                    if (appliedFilters.startDate && appliedFilters.endDate) {
                        const start = new Date(appliedFilters.startDate);
                        const end = new Date(appliedFilters.endDate);
                        end.setHours(23, 59, 59, 999);
                        return date >= start && date <= end;
                    }
                    return true;
                }
                return true;
            });
        }

        // 3. Sorting Logic
        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'account') { aValue = a.account?.name || ''; bValue = b.account?.name || ''; }
                if (sortConfig.key === 'category') { aValue = a.category?.name || ''; bValue = b.category?.name || ''; }
                if (sortConfig.key === 'payee') { aValue = a.contact || a.payee || a.counterpartyName || ''; bValue = b.contact || b.payee || b.counterpartyName || ''; }
                if (sortConfig.key === 'type') { aValue = a.transactionType?.name || a.txnType || ''; bValue = b.transactionType?.name || b.txnType || ''; }
                if (sortConfig.key === 'branch') { aValue = (a.branchNames || []).join(', '); bValue = (b.branchNames || []).join(', '); }
                if (sortConfig.key === 'name') { aValue = a.name || ''; bValue = b.name || ''; }
                if (sortConfig.key === 'notes') { aValue = a.notes || ''; bValue = b.notes || ''; }
                if (sortConfig.key === 'status') { aValue = a.status || ''; bValue = b.status || ''; }
                if (sortConfig.key === 'amountBase') {
                    aValue = Number(a.amountBaseCurrency ?? a.finalAmountLocal ?? a.amountBase ?? 0);
                    bValue = Number(b.amountBaseCurrency ?? b.finalAmountLocal ?? b.amountBase ?? 0);
                }

                // Handle string comparison case-insensitively
                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;

    }, [groupedTransactions, searchTerm, appliedFilters, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredTransactions.slice(startIndex, startIndex + pageSize);
    }, [filteredTransactions, currentPage, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);


    const handleFilterApply = () => {
        setAppliedFilters(tempFilters);
        setIsFilterOpen(false);
        setCurrentPage(1);
    };

    const handleFilterReset = () => {
        const defaults = {
            moneyFlow: 'All',
            scope: 'All Transactions',
            timePeriod: 'All Time',
            startDate: '',
            endDate: '',
            payee: 'All'
        };
        setTempFilters(defaults);
        setAppliedFilters(defaults);
        setIsFilterOpen(false);
        setCurrentPage(1);
    };

    const buildExportPayload = (format) => ({
        branchId: 'all',
        financialYearId: selectedYear?.id,
        searchTerm,
        format,
        appliedFilters,
        sortConfig
    });

    const downloadExportFile = (bytes, fileName, mimeType) => {
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Export Handlers
    const handleExportExcel = async () => {
        try {
            const response = await apiService.transactions.export(buildExportPayload('csv'));
            const exportData = response?.data || response;
            const base64Content = exportData?.fileContent;
            const fileName = exportData?.fileName || 'transactions-export.csv';
            const mimeType = exportData?.mimeType || 'text/csv;charset=utf-8';

            if (!base64Content) {
                throw new Error('Missing export file content');
            }

            const binaryString = window.atob(base64Content);
            const fileBytes = new Uint8Array(binaryString.length);
            for (let index = 0; index < binaryString.length; index += 1) {
                fileBytes[index] = binaryString.charCodeAt(index);
            }

            downloadExportFile(fileBytes, fileName, mimeType);
        } catch (error) {
            console.error('Failed to export transactions to Excel:', error);
            alert('Failed to export transactions');
        } finally {
            setActiveDropdown(null);
        }
    };

    const handleExportPDF = async () => {
        try {
            const response = await apiService.transactions.export(buildExportPayload('pdf'), {
                responseType: 'blob'
            });

            const htmlBlob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(htmlBlob);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            console.error('Failed to export transactions to PDF:', error);
            alert('Failed to export transactions');
        } finally {
            setActiveDropdown(null);
        }
    };

    const handleEdit = (txn) => {
        // Find all transactions with the same name + date (siblings created via multi-branch)
        const nameKey = (txn.name || '').toLowerCase().trim();
        const dateKey = txn.txnDate ? new Date(txn.txnDate).toISOString().split('T')[0] : '';
        const siblings = transactions.filter(t =>
            (t.name || '').toLowerCase().trim() === nameKey &&
            (t.txnDate ? new Date(t.txnDate).toISOString().split('T')[0] : '') === dateKey &&
            t.branchId
        );

        const siblingMap = {};
        if (siblings.length > 0) {
            siblings.forEach(t => {
                if (!siblingMap[Number(t.branchId)]) {
                    siblingMap[Number(t.branchId)] = t.id;
                }
            });
        } else {
            siblingMap[Number(txn.branchId)] = txn.id;
        }

        navigate(`/transactions/edit/${txn.id}`, {
            state: {
                originalBranchIds: Object.keys(siblingMap).map(Number),
                siblingMap: siblingMap
            }
        });
    };

    const handleDelete = (e, txn) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteDialog({
            open: true,
            id: txn.id,
            label: String(txn.contact || txn.payee || txn.counterpartyName || txn.name || '').trim(),
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
            await apiService.transactions.delete(deleteDialog.id);
            notifyTransactionDataChanged();
            await fetchTransactions();
            setDeleteDialog(createInitialDeleteDialog());
        } catch (error) {
            console.error("Failed to delete transaction:", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete transaction";
            alert(msg);
            setDeleteDialog((current) => ({ ...current, loading: false }));
        }
    };

    // Calculate totals grouped by currency
    const currencyTotals = useMemo(() => {
        const totals = {};
        filteredTransactions.forEach(t => {
            const currency = t.baseCurrency || t.currencyCode || 'INR';
            const unitAmount = Number(t.amountBaseCurrency || t.finalAmountLocal || t.amountBase || 0);
            const replicationCount = t.branchNames?.length || 1;
            totals[currency] = (totals[currency] || 0) + (unitAmount * replicationCount);
        });
        return totals;
    }, [filteredTransactions]);

    const hasBranchColumn = selectedBranch?.id === 'all' || selectedBranch?.id === 'multi';
    const desktopColumns = useMemo(() => ([
        {
            key: 'id',
            label: 'Id',
            sortKey: 'id',
            headerClassName: 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border',
            cellClassName: 'px-4 py-1.5 text-xs text-gray-500 font-mono',
            render: (_txn, { rowIndex }) => (
                isPrinting ? rowIndex + 1 : (currentPage - 1) * pageSize + rowIndex + 1
            )
        },
        {
            key: 'party',
            label: 'Party',
            sortKey: 'payee',
            headerClassName: 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border max-w-[150px] truncate',
            cellClassName: 'px-2 py-1.5 whitespace-nowrap overflow-visible',
            render: (txn) => <PartyTooltip partyName={txn.contact || txn.payee || txn.counterpartyName} />
        },
        {
            key: 'date',
            label: 'Date',
            sortKey: 'txnDate',
            headerClassName: 'sticky top-0 z-10 px-2 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border min-w-[90px]',
            cellClassName: 'px-2 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap',
            render: (txn) => formatDate(txn.txnDate)
        },
        {
            key: 'type',
            label: 'Type',
            sortKey: 'type',
            headerClassName: 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border min-w-[80px]',
            cellClassName: 'px-4 py-1.5 border-none',
            render: (txn) => (
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'income' && "text-emerald-600",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'expense' && "text-rose-600",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'transfer' && "text-blue-600",
                    !['income', 'expense', 'transfer'].includes((txn.transactionType?.name || txn.txnType)?.toLowerCase()) && "text-gray-700"
                )}>
                    {txn.transactionType?.name || txn.txnType}
                </span>
            )
        },
        {
            key: 'branch',
            label: 'Branch',
            sortKey: 'branch',
            isAvailable: hasBranchColumn,
            headerClassName: 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border',
            cellClassName: 'px-4 py-1.5 whitespace-nowrap overflow-visible',
            render: (txn) => <BranchTooltip branchNames={txn.branchNames} />
        },
        {
            key: 'account',
            label: 'Account',
            sortKey: 'account',
            headerClassName: 'sticky top-0 z-10 px-2 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border',
            cellClassName: 'px-2 py-1.5 text-xs font-medium text-gray-600 whitespace-nowrap',
            render: (txn) => {
                const accountName = txn.accountName ||
                    (typeof txn.account === 'object' && txn.account !== null ? txn.account.name : txn.account) ||
                    txn.method ||
                    '-';
                return (
                    <AccountNameTooltip 
                        name={accountName}
                        textClassName="text-xs font-medium text-gray-600"
                    />
                );
            }
        },
        {
            key: 'category',
            label: 'Category',
            sortKey: 'category',
            headerClassName: 'sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border',
            cellClassName: 'px-4 py-1.5',
            render: (txn) => (
                <div className="text-xs font-semibold text-gray-700">
                    {txn.categoryName || txn.category?.name || '-'}
                    {(txn.subCategoryName || txn.subCategory?.name) && (
                        <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                            {txn.subCategoryName || txn.subCategory?.name}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'notes',
            label: 'Notes',
            sortKey: 'notes',
            headerClassName: 'sticky top-0 z-10 px-2 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border',
            cellClassName: 'px-2 py-1.5',
            render: (txn) => (
                <div className="max-w-[180px]">
                    <DescriptionTooltip description={txn.notes || txn.description} />
                </div>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            sortKey: 'amountBase',
            headerContentClassName: 'justify-end',
            headerClassName: 'txn-amount-header-col sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border text-right',
            cellClassName: 'txn-amount-value-cell py-1.5 text-xs font-bold whitespace-nowrap text-right pl-2 pr-4',
            render: (txn) => (
                <span className={cn(
                    "txn-amount-value-pill inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'income' && "text-emerald-600",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'expense' && "text-rose-600",
                    (txn.transactionType?.name || txn.txnType)?.toLowerCase() === 'transfer' && "text-blue-600",
                    !['income', 'expense', 'transfer'].includes((txn.transactionType?.name || txn.txnType)?.toLowerCase()) && "text-gray-700"
                )}>
                    {formatCurrency(txn.amountBaseCurrency || txn.finalAmountLocal || txn.amountBase, txn.baseCurrency)}
                </span>
            )
        },
        {
            key: 'createdBy',
            label: 'Created By',
            sortKey: 'createdByName',
            headerClassName: cn(
                'sticky top-0 z-10 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 bg-gray-50/95 backdrop-blur-sm group print:bg-transparent print:border-black print:border min-w-[88px] px-2',
                !hasBranchColumn && 'pl-6'
            ),
            cellClassName: cn(
                'py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap min-w-[88px]',
                !hasBranchColumn ? 'px-2 pl-6' : 'px-2'
            ),
            render: (txn) => txn.createdByName || '-'
        }
    ]), [currentPage, formatCurrency, formatDate, hasBranchColumn, isPrinting, pageSize]);

    const visibleDesktopColumns = useMemo(
        () => desktopColumns.filter((column) => (column.isAvailable ?? true) && visibleColumns[column.key]),
        [desktopColumns, visibleColumns]
    );
    const desktopTableColSpan = visibleDesktopColumns.length + 1;
    const totalsAmountColumnIndex = visibleDesktopColumns.findIndex((column) => column.key === 'amount');


    return (
        <div
            ref={pageViewportRef}
            className="flex flex-col h-full min-h-0 overflow-hidden"
            style={desktopViewportHeight ? { height: `${desktopViewportHeight}px` } : undefined}
        >

            <style>{`
                @media print {
                    @page { margin: 12mm; size: landscape; }
                    html, body {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Hide unnecessary elements */
                    nav, aside, header, footer, .sidebar, .print\\:hidden, button {
                        display: none !important;
                    }
                    
                    /* Un-constrain scrolling areas */
                    .min-h-screen, .h-screen { height: auto !important; min-height: 0 !important; }
                    .overflow-hidden, .overflow-y-auto, .overflow-x-auto { overflow: visible !important; }
                    .max-h-\\[720px\\] { max-height: none !important; }
                    .flex-1 { flex: none !important; }
                    
                    /* Only normalize backgrounds inside transaction print surface */
                    .txn-print-surface,
                    .txn-print-surface .bg-white,
                    .txn-print-surface .bg-gray-50,
                    .txn-print-surface .bg-gray-100,
                    .txn-print-surface .bg-gray-50\\/50,
                    .txn-print-surface .bg-gray-50\\/95,
                    .txn-print-surface tr,
                    .txn-print-surface td,
                    .txn-print-surface th {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                    }
                    
                    /* Disable filters that break Chrome PDF rendering (like backdrop-blur) */
                    .txn-print-surface * {
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                    }

                    /* Strictly format the Table */
                    .txn-print-surface table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        table-layout: auto !important;
                        margin-bottom: 20px !important;
                        border: 1px solid #000000 !important;
                    }
                    .txn-print-surface thead { display: table-header-group !important; }
                    /* Prevent tfoot from repeating on every page by treating it as a normal row group in print */
                    .txn-print-surface tfoot { display: table-row-group !important; }
                    .txn-print-surface tbody { display: table-row-group !important; }
                    .txn-print-surface tr, .txn-print-surface tr:nth-child(even), .txn-print-surface tr:nth-child(odd), .txn-print-surface tr:hover { 
                        page-break-inside: avoid !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                    }
                    .txn-print-surface td, .txn-print-surface th {
                        white-space: normal !important;
                        overflow: visible !important;
                        border: 1px solid #000000 !important;
                        border-top: 1px solid #000000 !important;
                        border-bottom: 1px solid #000000 !important;
                        border-left: 1px solid #000000 !important;
                        border-right: 1px solid #000000 !important;
                        padding: 8px !important;
                        color: #000000 !important;
                        background: #ffffff !important;
                    }
                    .txn-print-surface th {
                        font-weight: bold !important;
                        text-transform: uppercase !important;
                        background-color: #ffffff !important;
                    }
                    /* Ensure nested text is black */
                    .txn-print-surface td span, .txn-print-surface th span, .txn-print-surface td div, .txn-print-surface th div, .txn-print-surface td *, .txn-print-surface th * {
                        color: #000000 !important;
                    }
                    .txn-print-surface .truncate { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
                    
                    /* Hide scrollbars explicitly */
                    ::-webkit-scrollbar { display: none !important; }
                    * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                }
            `}</style>
            {/* Backdrop for dropdowns */}
            {(activeDropdown || isFilterOpen || activeAttachmentTxnId) && (
                <div
                    className="fixed inset-0 z-40 bg-black/5 lg:bg-transparent"
                    onClick={() => {
                        setActiveDropdown(null);
                        setIsFilterOpen(false);
                        setActiveAttachmentTxnId(null);
                    }}
                />
            )}

            <PageContentShell
                header={(
                    <PageHeader
                        title="Transactions"
                        breadcrumbs={['Transactions', 'List']}
                    />
                )}
            >
                <div className="flex flex-col min-h-0">

                {/* Print Only Header */}
                <div className="hidden print:block text-center py-6 mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">Transactions List</h1>
                </div>

                {/* Toolbar */}
                <div ref={toolbarRef} className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 relative z-40 print:hidden min-h-[74px]">
                    {isMobileSearchOpen ? (
                        <div className="flex items-center w-full gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                            <Search size={18} className="text-gray-400 shrink-0" />
                            <input
                                autoFocus
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search transactions..."
                                className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-gray-400 h-10"
                            />
                            <button
                                onClick={() => {
                                    setIsMobileSearchOpen(false);
                                    if (!searchTerm) setSearchTerm('');
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Left: Search Bar */}
                            <div className="hidden md:block relative group w-full max-w-sm lg:w-64 lg:max-w-none">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search..."
                                    className="pl-10 pr-4 py-2.5 bg-[#f1f3f9] border border-transparent rounded-xl text-xs font-medium placeholder:text-gray-400 w-full focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                                />
                            </div>

                                {/* Mobile: Search Icon Only */}
                                <button
                                    onClick={() => setIsMobileSearchOpen(true)}
                                    className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-400 hover:bg-gray-50 transition-all active:scale-95"
                                    title="Search"
                                >
                                    <Search size={18} />
                                </button>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end ml-auto">
                                    {/* Add New Button */}
                                    <button
                                        onClick={() => {
                                            navigate('/transactions/create');
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-200"
                                        title="Add New Transaction"
                                    >
                                        <Plus size={18} strokeWidth={2.5} />
                                    </button>

                                    {/* Import Excel Button */}
                                    <button
                                        onClick={() => {
                                            setIsImportModalOpen(true);
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                        title="Import Excel"
                                    >
                                        <FileSpreadsheet size={18} />
                                    </button>

                                    {/* Import PDF Button - Temporarily Hidden
                                    <button
                                        onClick={() => {
                                            // This button is now always disabled as PDF import is not supported for 'all' branches
                                            return;
                                        }}
                                        disabled={true} // Always disabled
                                        className={cn(
                                            "w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm",
                                            "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed" // Always styled as disabled
                                        )}
                                        title="PDF import is not available when viewing all branches"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    */}


                                    {/* Export Dropdown */}
                                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                                        {activeDropdown === 'export' && (
                                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
                                        )}
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'export' ? null : 'export')}
                                            className={cn(
                                                "w-10 h-10 flex items-center justify-center rounded-xl border transition-all relative z-50",
                                                activeDropdown === 'export'
                                                    ? "bg-gray-100 text-gray-700 border-gray-200"
                                                    : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-200"
                                            )}
                                            title="Export"
                                        >
                                            <Download size={18} />
                                        </button>
                                        {activeDropdown === 'export' && (
                                            <div className="absolute top-12 right-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                                                <button onClick={handleExportExcel} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                                    <FileSpreadsheet size={14} className="text-emerald-500" />
                                                    <span>Export to Excel</span>
                                                </button>
                                                <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                                                    <FileText size={14} className="text-rose-500" />
                                                    <span>Download as PDF</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Filter Button */}
                                    <div ref={filterBoxRef} className="relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsFilterOpen(!isFilterOpen);
                                                setActiveDropdown(null);
                                            }}
                                            className={cn(
                                                "w-10 h-10 flex items-center justify-center rounded-xl border transition-all relative z-50",
                                                isFilterOpen
                                                    ? "bg-gray-100 text-gray-700 border-gray-200"
                                                    : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-200"
                                            )}
                                            title="Filters"
                                        >
                                            <Filter size={18} strokeWidth={2.5} />
                                        </button>
                                        <TransactionFilters
                                            isOpen={isFilterOpen}
                                            onClose={() => setIsFilterOpen(false)}
                                            filters={tempFilters}
                                            setFilters={setTempFilters}
                                            uniquePayees={availablePayees}
                                            onApply={handleFilterApply}
                                            onReset={handleFilterReset}
                                            anchorRef={filterBoxRef}
                                        />
                                    </div>

                                    <TransactionColumnSettings
                                        value={visibleColumns}
                                        onApplySelection={(nextValue) => setVisibleColumns(normalizeTxnColumns(nextValue))}
                                        onBeforeOpen={() => {
                                            setActiveDropdown(null);
                                            setIsFilterOpen(false);
                                        }}
                                        externalCloseSignal={activeDropdown || (isFilterOpen ? 'filter' : '')}
                                    />
                                </div>
                        </>
                    )}
                </div>

                    {/* Mobile Card View */}
                    <div className="relative lg:hidden flex-1 p-4 space-y-4 print:hidden overflow-y-auto min-h-0 no-scrollbar" aria-busy={loading}>
                        {showInitialLoader ? (
                            <div className="py-12 flex items-center justify-center">
                                <Loader2 size={26} className="text-gray-500 animate-spin" />
                            </div>
                        ) : paginatedTransactions.length > 0 ? (
                            paginatedTransactions.map((txn, index) => {
                                const descriptionText = String(txn.notes || txn.description || '').trim();
                                const accountText = String(
                                    txn.accountName ||
                                    (typeof txn.account === 'object' && txn.account !== null ? txn.account.name : txn.account) ||
                                    ''
                                ).trim();
                                const categoryText = String(
                                    txn.categoryName ||
                                    (typeof txn.category === 'object' && txn.category !== null ? txn.category.name : txn.category) ||
                                    ''
                                ).trim();
                                const partyText = String(txn.contact || txn.payee || txn.counterpartyName || '').trim();
                                const branchText = String((txn.branchNames || []).join(', ') || '').trim();
                                const hasDescription = Boolean(descriptionText);
                                const hasAccount = Boolean(accountText);
                                const hasCategory = Boolean(categoryText);
                                const hasParty = Boolean(partyText);
                                const hasBranch = Boolean(branchText);
                                return (
                                    <div key={txn.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
                                        <div className="flex justify-between items-start gap-3 mb-1">
                                            <div className="min-w-0 flex items-baseline gap-2">
                                                <div className="shrink-0 text-xs font-semibold text-gray-500 font-mono">
                                                    {((currentPage - 1) * pageSize + index + 1)}
                                                </div>
                                                {hasParty && (
                                                    <h3 className="min-w-0 text-sm font-bold text-gray-800 truncate">{partyText}</h3>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold capitalize text-gray-700 text-right shrink-0">
                                                {txn.transactionType?.name || txn.txnType}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Date</div>
                                                <div className="font-semibold text-gray-800 text-xs">{formatDate(txn.txnDate)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Amount</div>
                                                <div className={cn(
                                                    "font-bold text-sm tabular-nums",
                                                    txn.txnType === 'income' ? "text-emerald-600" :
                                                        txn.txnType === 'expense' ? "text-gray-900" :
                                                            "text-blue-600"
                                                )}>
                                                    {formatCurrency(txn.amountBaseCurrency || txn.finalAmountLocal || txn.amountBase)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {hasDescription && (
                                                <div className="col-span-2">
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Description</div>
                                                    <div className="font-medium text-gray-700 text-xs break-words">{descriptionText}</div>
                                                </div>
                                            )}
                                            {hasAccount && (
                                                <div>
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Account</div>
                                                    <div className="font-medium text-gray-600 text-xs truncate">{accountText}</div>
                                                </div>
                                            )}
                                            {hasCategory && (
                                                <div className="sm:text-right">
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Category</div>
                                                    <div className="font-medium text-gray-600 text-xs truncate">{categoryText}</div>
                                                </div>
                                            )}
                                            {hasBranch && (
                                                <div>
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Branch</div>
                                                    <div className="font-medium text-primary text-xs truncate">{branchText}</div>
                                                </div>
                                            )}
                                            {hasParty && (
                                                <div className="sm:text-right">
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Party</div>
                                                    <div className="font-medium text-gray-600 text-xs truncate">{partyText}</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-end gap-1 pt-2 border-t border-gray-50 mt-2">
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (txn.attachmentPath) {
                                                            setFullScreenAttachment({ isOpen: true, path: txn.attachmentPath });
                                                        }
                                                    }}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-all",
                                                        txn.attachmentPath
                                                            ? "text-gray-400 hover:text-primary hover:bg-primary/5 active:scale-95"
                                                            : "text-gray-200 cursor-not-allowed"
                                                    )}
                                                    title={txn.attachmentPath ? "View Attachment" : "No Attachment"}
                                                    disabled={!txn.attachmentPath}
                                                >
                                                    <Paperclip size={14} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                disabled={!canEditTxn(txn)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    canEditTxn(txn) ? "text-gray-400 hover:text-blue-600 hover:bg-blue-50" : "text-gray-200 cursor-not-allowed"
                                                )}
                                                title={canEditTxn(txn) ? "Edit" : "You do not have access to edit this transaction"}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, txn)}
                                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : hasFetchedOnce ? (
                            <div className="py-12 text-center text-gray-400 font-medium text-sm">
                                No transactions found.
                            </div>
                        ) : null}
                        {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                    </div>

                    {/* Table (Desktop Only) */}
                    <div
                        ref={desktopTableRef}
                        className="txn-print-surface relative hidden lg:block print:block min-h-0 overflow-x-auto overflow-y-auto no-scrollbar txn-laptop-list-table-scroll"
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            ...(desktopTableHeight ? { maxHeight: `${desktopTableHeight}px` } : {})
                        }}
                        aria-busy={loading}
                    >
                        <table className="w-full text-left border-collapse txn-laptop-list-table">
                            <thead className="sticky top-0 z-10 bg-white">
                                <tr className="bg-gray-50/50 border-y border-gray-200">
                                    {visibleDesktopColumns.map((column) => (
                                        <th
                                            key={column.key}
                                            className={column.headerClassName}
                                            onClick={() => handleSort(column.sortKey || column.key)}
                                        >
                                            <div className={cn("flex items-center gap-1", column.headerContentClassName)}>
                                                <span>{column.label}</span>
                                                <ArrowUpDown
                                                    size={10}
                                                    className={cn(
                                                        "print:hidden text-gray-400 group-hover:text-gray-600 transition-opacity",
                                                        sortConfig.key === (column.sortKey || column.key) ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                                                    )}
                                                />
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 bg-gray-50/95 backdrop-blur-sm print:hidden min-w-[88px] w-[88px] sticky top-0 right-0 z-20 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] txn-laptop-action-col"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {showInitialLoader ? (
                                    <tr>
                                        <td colSpan={desktopTableColSpan} className="px-6 py-8">
                                            <div className="flex items-center justify-center">
                                                <Loader2 size={24} className="text-gray-500 animate-spin" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : hasFetchedOnce && (isPrinting ? filteredTransactions : paginatedTransactions).length === 0 ? (
                                    <tr><td colSpan={desktopTableColSpan} className="px-6 py-8 text-center text-sm text-gray-500">No transactions found.</td></tr>
                                ) : (
                                    (isPrinting ? filteredTransactions : paginatedTransactions).map((txn, rowIndex) => {
                                        return (
                                            <tr key={txn.id} className="group hover:bg-gray-50/50">
                                                {visibleDesktopColumns.map((column) => (
                                                    <td key={column.key} className={column.cellClassName}>
                                                        {column.render(txn, { rowIndex })}
                                                    </td>
                                                ))}
                                                <td className="px-2 py-1.5 text-center print:hidden sticky right-0 bg-white z-10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] group-hover:bg-gray-50/50 txn-laptop-action-col">
                                                    <div className="flex items-center justify-center gap-0">
                                                        <div className="relative static">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (txn.attachmentPath) {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setAttachmentViewer({
                                                                            isOpen: attachmentViewer.txnId !== txn.id || !attachmentViewer.isOpen,
                                                                            txnId: txn.id,
                                                                            path: txn.attachmentPath,
                                                                            position: {
                                                                                top: rect.bottom + 5,
                                                                                right: window.innerWidth - rect.right
                                                                            }
                                                                        });
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "p-1.5 rounded-lg transition-all",
                                                                    txn.attachmentPath
                                                                        ? (attachmentViewer.txnId === txn.id && attachmentViewer.isOpen ? "bg-primary text-white" : "text-gray-400 hover:text-primary hover:bg-primary/5 active:scale-95")
                                                                        : "text-gray-200 cursor-not-allowed"
                                                                )}
                                                                title={txn.attachmentPath ? "View Attachment" : "No Attachment"}
                                                                disabled={!txn.attachmentPath}
                                                            >
                                                                <Paperclip size={14} strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => handleEdit(txn)}
                                                            disabled={!canEditTxn(txn)}
                                                            className={cn(
                                                                "p-1.5 rounded-lg transition-all",
                                                                canEditTxn(txn) ? "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" : "text-gray-200 cursor-not-allowed"
                                                            )}
                                                            title={canEditTxn(txn) ? "Edit" : "You do not have access to edit this transaction"}
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDelete(e, txn)}
                                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50/50 border-t border-gray-100">
                                <tr>
                                    {totalsAmountColumnIndex === -1 ? (
                                        <td colSpan={desktopTableColSpan} className="px-4 py-3 text-right text-[12px] font-black text-gray-900 print:border-none">
                                            <span className="mr-3 text-[10px] font-bold tracking-widest">TOTALS:</span>
                                            {Object.entries(currencyTotals).map(([currency, total], index) => (
                                                <span key={currency} className={index > 0 ? 'ml-3' : ''}>
                                                    {formatCurrency(total, currency)}
                                                </span>
                                            ))}
                                        </td>
                                    ) : (
                                        <>
                                            {totalsAmountColumnIndex > 0 && (
                                                <td colSpan={totalsAmountColumnIndex} className="px-4 py-3 text-right text-[10px] font-bold print:border-none print:py-4 tracking-widest text-gray-900 border-none">
                                                    TOTALS:
                                                </td>
                                            )}
                                            <td className="txn-amount-total-cell px-2 py-3 text-right text-[12px] font-black text-gray-900 print:border-none">
                                                {totalsAmountColumnIndex === 0 && (
                                                    <span className="mr-3 text-[10px] font-bold tracking-widest">TOTALS:</span>
                                                )}
                                                {Object.entries(currencyTotals).map(([currency, total], index) => (
                                                    <div key={currency} className={index > 0 ? 'mt-1' : ''}>
                                                        {formatCurrency(total, currency)}
                                                    </div>
                                                ))}
                                            </td>
                                            {visibleDesktopColumns.length - totalsAmountColumnIndex - 1 > 0 && (
                                                <td colSpan={visibleDesktopColumns.length - totalsAmountColumnIndex - 1} className="print:hidden"></td>
                                            )}
                                            <td className="print:hidden"></td>
                                        </>
                                    )}
                                </tr>
                            </tfoot>
                        </table>
                        {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                    </div>

                    {/* Mobile Pagination */}
                    <div className="lg:hidden border-t border-gray-100 p-2 print:hidden">
                        <MobilePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>

                    {/* Global Attachment Preview */}
                    {attachmentViewer.isOpen && attachmentViewer.path && (
                        <div
                            className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200"
                            style={{
                                top: attachmentViewer.position.top,
                                right: attachmentViewer.position.right
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AttachmentPreview
                                attachmentPath={attachmentViewer.path}
                                isOpen={true}
                                onClose={() => setAttachmentViewer(prev => ({ ...prev, isOpen: false }))}
                                onViewFullScreen={(path) => setFullScreenAttachment({ isOpen: true, path })}
                                className="static shadow-2xl border border-gray-100"
                            />
                        </div>
                    )}

                    {/* Full Screen Attachment Viewer */}
                    {fullScreenAttachment.isOpen && fullScreenAttachment.path && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}>
                            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
                                    <h3 className="text-sm font-bold text-gray-800">Attachment Preview</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!fullScreenAttachment.path) return;
                                                void downloadAttachmentFile(fullScreenAttachment.path).catch((error) => {
                                                    console.error('Failed to download attachment:', error);
                                                    alert('Failed to download attachment');
                                                });
                                            }}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors flex items-center justify-center gap-2 px-3 bg-gray-50 hover:text-gray-900 border border-gray-100"
                                            title="Download Attachment"
                                        >
                                            <Download size={14} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Download</span>
                                        </button>
                                        <button
                                            onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}
                                            className="p-1.5 hover:bg-rose-50 rounded-lg text-gray-400 hover:text-rose-600 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center min-h-[50vh]">
                                    {(() => {
                                        const p = fullScreenAttachment.path;
                                        const fullUrl = buildAttachmentUrl(p);
                                        const isImage = p.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                        if (isImage) {
                                            return <img src={fullUrl} alt="Attachment" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />;
                                        } else {
                                            return <iframe src={fullUrl} className="w-full h-[75vh] border-0 rounded-lg shadow-sm bg-white" title="Attachment Preview" />;
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                {/* Desktop Pagination */}
                <div ref={desktopPaginationRef} className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                    <div className="text-[11px] text-gray-500 font-medium">
                        Showing <span className="font-bold text-gray-700">{filteredTransactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredTransactions.length)}</span> of <span className="font-bold text-gray-700">{filteredTransactions.length}</span> results
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
                </div>
            </PageContentShell>


            <ConfirmDialog
                open={deleteDialog.open}
                title="Delete Transaction"
                message={deleteDialog.label
                    ? `Are you sure you want to archive "${deleteDialog.label}"? It will be hidden from active lists.`
                    : 'Are you sure you want to archive this transaction? It will be hidden from active lists.'}
                confirmLabel="Yes, Delete Transaction"
                isSubmitting={deleteDialog.loading}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            />

            {/* Import Excel Modal */}
            <ImportTransactionModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    notifyTransactionDataChanged();
                    // Start a refresh, but don't close immediately (handled by modal)
                    fetchTransactions();
                }}
            />

            {/* Import PDF Modal - Commented out
            <ImportPDFModal
                isOpen={isPDFImportModalOpen}
                onClose={() => setIsPDFImportModalOpen(false)}
                onSuccess={() => {
                    notifyTransactionDataChanged();
                    fetchTransactions();
                }}
            />
            */}
        </div>
    );
};

export default Transactions;
