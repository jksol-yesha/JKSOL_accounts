
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AgGridReact } from "ag-grid-react";
import {
    ModuleRegistry,
    AllCommunityModule,
    themeQuartz,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);
import {
    Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Wallet, Building2, Calendar, FileText, Edit, Trash2,
    Download, X, FileSpreadsheet, ChevronDown, ArrowUpDown, Paperclip, Eye, ExternalLink, User, Settings2, RefreshCcw, Check, TrendingUp, ChevronUp, PieChart as PieChartIcon, Activity, Users, ShoppingBag, History, MoreVertical
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import apiService, { buildAttachmentUrl, downloadAttachmentFile } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { usePreferences } from '../../context/PreferenceContext';
import { Loader } from '../../components/common/Loader';


import { useAuth } from '../../context/AuthContext';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';


import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import { cn } from '../../utils/cn';
import LoadingOverlay from '../../components/common/LoadingOverlay';

import ConfirmDialog from '../../components/common/ConfirmDialog';
import CustomSelect from '../../components/common/CustomSelect';
import ImportTransactionModal from './ImportTransactionModal';
import CreateTransaction from './components/CreateTransaction';
import ImportReviewModal from './ImportReviewModal';
import DateRangePicker from '../../components/common/DateRangePicker';
import BranchSelector from '../../components/layout/BranchSelector';
import CurrencySelector from '../../components/layout/CurrencySelector';
import { generateDatePresets } from '../../utils/constants';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import AccountNameTooltip from '../../components/common/AccountNameTooltip';
import { notifyTransactionDataChanged } from './transactionDataSync';
import ImportHistoryPanel from './ImportHistoryPanel';

const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    label: '',
    loading: false
});

const TXN_TABLE_COLUMN_STORAGE_KEY = 'transactions:tableColumns:v2';
const TXN_COLUMN_DROPDOWN_VISIBLE_OPTION_COUNT = 4;
const TXN_TABLE_COLUMNS = [
    { key: 'id', label: 'Id', defaultVisible: false },
    { key: 'party', label: 'Party', defaultVisible: true },
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'type', label: 'Type', defaultVisible: false },
    { key: 'branch', label: 'Branch', defaultVisible: false },
    { key: 'account', label: 'Account', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: false },
    { key: 'notes', label: 'Notes', defaultVisible: false },
    { key: 'amount', label: 'Amount', defaultVisible: true },
    { key: 'createdBy', label: 'Created By', defaultVisible: false }
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
        <div
            className="relative flex items-center w-full min-w-0 h-full"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-xs font-bold text-primary cursor-default hover:text-primary/80 transition-colors w-full">
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
        </div>
    );
};

const ColumnVisibilityDropdown = ({ columns, visibleColumns, setVisibleColumns, defaultVisibleColumns, isHeader }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [localVisibleColumns, setLocalVisibleColumns] = useState(visibleColumns);

    useEffect(() => {
        let timer;
        if (isOpen) {
            setLocalVisibleColumns(visibleColumns);
            setSearchQuery('');
            timer = setTimeout(() => setIsMounted(true), 10);
        } else {
            setIsMounted(false);
        }
        return () => clearTimeout(timer);
    }, [isOpen, visibleColumns]);

    const filteredColumns = columns.filter(col => col.label.toLowerCase().includes(searchQuery.toLowerCase()));

    const toggleColumn = (key) => {
        setLocalVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleClose = () => {
        setIsMounted(false);
        setTimeout(() => {
            setIsOpen(false);
        }, 200);
    };

    const handleSave = () => {
        setIsMounted(false);
        setTimeout(() => {
            setVisibleColumns(localVisibleColumns);
            setIsOpen(false);
        }, 200);
    };

    return (
        <div className="relative inline-block text-left whitespace-nowrap">
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={isHeader 
                    ? "flex items-center justify-center p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                    : "group h-[30px] flex items-center gap-1 justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-medium text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"}
            >
                <Settings2 size={14} className={isHeader ? "" : "group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors"} />
                {!isHeader && <span className="hidden sm:inline">Columns</span>}
            </button>
            {isOpen && createPortal(
                <div className={`fixed inset-0 z-[9999] bg-black/30 flex justify-center items-start pb-4 px-4 transition-opacity duration-200 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
                    <div className={`bg-white rounded-lg shadow-2xl w-full max-w-[360px] flex flex-col overflow-hidden max-h-[350px] transition-all duration-200 transform ${isMounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                            <div className="flex items-center gap-2">
                                <Settings2 size={16} className="text-gray-500" />
                                <h2 className="text-[14px] font-semibold text-gray-800">Customize Columns</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-sm">
                                    {Object.values(localVisibleColumns).filter(Boolean).length} of {columns.length} Selected
                                </span>
                                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-md">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="px-4 py-2 border-b border-gray-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search columns..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all placeholder:text-gray-400 shadow-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 py-2 bg-slate-50/30">
                            {filteredColumns.map((col) => (
                                <button
                                    key={col.key}
                                    onClick={() => toggleColumn(col.key)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100/80 rounded-md transition-colors text-left group border border-transparent hover:border-gray-200"
                                >
                                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${localVisibleColumns[col.key] ? 'bg-[#4A8AF4] border-[#4A8AF4] text-white shadow-sm' : 'border-gray-300 bg-white group-hover:border-[#4A8AF4]'}`}>
                                        {localVisibleColumns[col.key] && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-[13px] ${localVisibleColumns[col.key] ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                                        {col.label}
                                    </span>
                                </button>
                            ))}
                            {filteredColumns.length === 0 && (
                                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                                    <Search size={20} className="text-gray-300" />
                                    <span className="text-xs text-gray-500 font-medium">No columns match your search</span>
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <button
                                onClick={() => setLocalVisibleColumns({ ...defaultVisibleColumns })}
                                className="text-[12px] font-semibold text-[#4A8AF4] hover:text-[#3E79DE] transition-colors"
                            >
                                Reset to Default
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm min-w-[70px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-1.5 text-[12px] font-semibold text-white bg-[#4A8AF4] border border-[#4A8AF4] rounded-md hover:bg-[#3E79DE] hover:border-[#3E79DE] transition-colors shadow-sm min-w-[70px]"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const PartyTooltip = ({ partyName }) => {
    const [visible, setVisible] = useState(false);
    if (!partyName || partyName === '-') return <span className="text-xs font-bold text-gray-700">-</span>;
    const needsTooltip = partyName.length > 15;
    return (
        <div
            className="relative flex items-center w-full h-full min-w-0"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="truncate text-[13px] font-bold text-gray-700 cursor-default hover:text-gray-900 transition-colors">
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
        </div>
    );
};

const DescriptionTooltip = ({ description }) => {
    const [visible, setVisible] = useState(false);
    if (!description || description === '-') return <span className="text-[12px] font-medium text-gray-400">-</span>;
    const needsTooltip = description.length > 25;
    return (
        <div
            className="relative flex items-center w-full h-full min-w-0"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="truncate text-[12px] font-medium text-gray-800 cursor-default hover:text-gray-900 transition-colors">
                {description}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[12px] font-semibold text-gray-700 whitespace-normal break-words leading-relaxed">{description}</span>
                    </span>
                </span>
            )}
        </div>
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

const FilterDropdown = ({
    value,
    onChange,
    options,
    variant = "default",
    hideIcon = false,
    placeholder = "",
    showSelectAll = false,
    selectAllLabel = "Select All",
    allDisplayLabel = selectAllLabel,
    allValue = "all",
    isMultiSelect = false,
    hideApplyButton = false,
    buttonClassName = "",
    showOptionTicksWhenAllSelected = false,
    flatSelectAll = false,
    showApplyFooter = false,
    keepButtonNeutral = false,
    neutralCountBadge = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [stagedValues, setStagedValues] = useState([]);
    const [stagedSingleValue, setStagedSingleValue] = useState(value);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    useEffect(() => {
        if (!isOpen) return;

        if (isMultiSelect) {
            if (value === allValue) setStagedValues([allValue]);
            else setStagedValues(Array.isArray(value) ? value : [value]);
            return;
        }

        if (showApplyFooter) {
            setStagedSingleValue(value);
        }
    }, [isOpen, value, isMultiSelect, allValue, showApplyFooter]);

    useLayoutEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDropdownPosition(null);
            return;
        }
        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8,
                left: rect.left,
                minWidth: Math.max(160, rect.width),
            });
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                !dropdownRef.current?.contains(event.target) &&
                !dropdownMenuRef.current?.contains(event.target)
            ) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isSelectAllActive = isMultiSelect ? (value === allValue || (Array.isArray(value) && value.length === options.length)) : value === allValue;

    let displayLabel = placeholder || options[0]?.label;
    let remainingCount = 0;

    if (isMultiSelect) {
        if (isSelectAllActive) {
            displayLabel = allDisplayLabel;
        } else if (Array.isArray(value) && value.length > 0) {
            const activeOptions = value.map(v => options.find(o => o.value === v)).filter(Boolean);
            if (activeOptions.length > 0) {
                displayLabel = activeOptions.slice(0, 1).map(o => o.label).join(', ');
                remainingCount = activeOptions.length - 1;
            }
        }
    } else {
        const found = options.find((opt) => opt.value === value);
        if (found) displayLabel = found.label;
        else if (showSelectAll && value === allValue) displayLabel = allDisplayLabel;
    }

    const selectedOption = { label: displayLabel, remainingCount };
    const isTitleVar = variant === "title";
    const internalOptions = isMultiSelect ? options : (showSelectAll ? [{ isSelectAll: true }, ...options] : options);
    const isStagedAll = isMultiSelect && (stagedValues.includes(allValue) || stagedValues.length === options.length);
    const renderedSingleValue = showApplyFooter ? stagedSingleValue : value;
    const hasFooter = isMultiSelect ? !hideApplyButton : showApplyFooter;
    const isAllPartiesDropdown = selectAllLabel === 'All Parties' || allDisplayLabel === 'All Parties';
    const isRenderedSelectAllActive = !isMultiSelect && renderedSingleValue === allValue;
    const triggerClassName = !isTitleVar
        ? keepButtonNeutral || isSelectAllActive
            ? "bg-white text-gray-600 border-gray-200 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4]"
            : "bg-white border-[#BAE6FD] text-[#4A8AF4] hover:bg-[#F0F9FF]"
        : "";
    const getInitialHighlightedIndex = () => {
        if (isMultiSelect) {
            if (isSelectAllActive) {
                return showSelectAll ? 0 : -1;
            }

            const selectedValues = Array.isArray(value)
                ? value
                : value != null && value !== allValue
                    ? [value]
                    : [];
            const firstSelectedIndex = options.findIndex((option) => selectedValues.includes(option.value));

            if (firstSelectedIndex >= 0) {
                return showSelectAll ? firstSelectedIndex + 1 : firstSelectedIndex;
            }

            return showSelectAll ? 0 : 0;
        }

        const activeValue = showApplyFooter ? stagedSingleValue : value;
        const activeSelectAll = showApplyFooter ? value === allValue : isSelectAllActive;
        const matchedIndex = internalOptions.findIndex((option) => option.isSelectAll ? activeSelectAll : option.value === activeValue);

        return matchedIndex >= 0 ? matchedIndex : 0;
    };

    const handleApply = () => {
        if (isMultiSelect) {
            let toApply = stagedValues;
            if (stagedValues.length === 0 || isStagedAll || stagedValues.includes(allValue)) {
                toApply = allValue;
            }
            onChange(toApply);
            setIsOpen(false);
            return;
        }

        onChange(stagedSingleValue ?? allValue);
        setIsOpen(false);
    };

    const toggleStagedValue = (val) => {
        let nextVal;
        if (stagedValues.includes(allValue)) {
            nextVal = [val];
        } else {
            const exists = stagedValues.includes(val);
            nextVal = exists ? stagedValues.filter(x => x !== val) : [...stagedValues, val];
        }

        if (nextVal.length === 0 || nextVal.length === options.length) {
            nextVal = [allValue];
        }

        setStagedValues(nextVal);
        if (hideApplyButton) {
            onChange(nextVal.includes(allValue) ? allValue : nextVal);
        }
    };

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(getInitialHighlightedIndex());
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const totalItems = isMultiSelect ? options.length + 2 : internalOptions.length + (showApplyFooter ? 1 : 0);
                setHighlightedIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                const itemsCount = isMultiSelect ? options.length + 2 : internalOptions.length + (showApplyFooter ? 1 : 0);
                setHighlightedIndex(prev => (prev - 1 + itemsCount) % itemsCount);
                break;
            case 'Enter':
                e.preventDefault();
                if (isMultiSelect) {
                    if (highlightedIndex === 0 && showSelectAll) {
                        const nextVal = isStagedAll ? [] : [allValue];
                        setStagedValues(nextVal);
                        if (hideApplyButton) {
                            onChange(nextVal.length === 0 ? allValue : nextVal);
                        }
                    } else if (highlightedIndex > 0 && highlightedIndex <= options.length) {
                        const opt = options[highlightedIndex - 1];
                        toggleStagedValue(opt.value);
                    } else if (highlightedIndex === options.length + 1 && !hideApplyButton) {
                        handleApply();
                    }
                } else {
                    if (highlightedIndex >= 0 && highlightedIndex < internalOptions.length && internalOptions[highlightedIndex]) {
                        const opt = internalOptions[highlightedIndex];
                        if (showApplyFooter) {
                            setStagedSingleValue(opt.isSelectAll ? allValue : opt.value);
                        } else {
                            onChange(opt.isSelectAll ? allValue : opt.value);
                            setIsOpen(false);
                            setHighlightedIndex(-1);
                        }
                    } else if (showApplyFooter && highlightedIndex === internalOptions.length) {
                        handleApply();
                        setHighlightedIndex(-1);
                    }
                }
                if (isMultiSelect) {
                    setHighlightedIndex(-1);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                buttonRef.current?.focus();
                break;
            case 'Tab':
                if (isMultiSelect || showApplyFooter) handleApply();
                else setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={() => {
                    const nextIsOpen = !isOpen;
                    setIsOpen(nextIsOpen);
                    if (nextIsOpen) {
                        setHighlightedIndex(getInitialHighlightedIndex());
                    } else {
                        setHighlightedIndex(-1);
                    }
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                    "group relative flex items-center justify-between gap-1 transition-colors focus:outline-none",
                    isTitleVar
                        ? "px-1 py-1 text-[18px] md:text-[20px] font-extrabold text-slate-800 hover:text-primary"
                        : `h-[32px] px-3 text-[12px] font-medium rounded-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] border focus-visible:ring-2 focus-visible:ring-blue-100 ${triggerClassName}`,
                    buttonClassName,
                )}
            >
                <div
                    className={`flex items-center gap-1.5 min-w-0 ${!isTitleVar ? "" : "font-extrabold"}`}
                >
                    <span className={`max-w-[120px] truncate ${!isTitleVar ? "transition-colors text-inherit" : ""}`}>{selectedOption?.label}</span>
                    {selectedOption?.remainingCount > 0 && (
                        <span
                            className={cn(
                                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[12px] font-bold leading-none shrink-0 transition-colors",
                                neutralCountBadge
                                    ? "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70"
                                    : "bg-blue-100/50 text-[#4A8AF4] group-hover:bg-blue-100/80",
                            )}
                        >
                            <span>{selectedOption.remainingCount}</span>
                            <Plus size={9} strokeWidth={3} />
                        </span>
                    )}
                </div>
                {!hideIcon && (
                    <ChevronDown
                        size={isTitleVar ? 16 : 14}
                        className={`transition-transform duration-200 ml-1 ${isOpen ? "rotate-180" : ""} ${isTitleVar ? "text-slate-400 group-hover:text-primary" : "text-gray-400 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]"} ${!isSelectAllActive && !isTitleVar ? "text-[#4A8AF4]" : ""}`}
                    />
                )}
            </button>

            {isOpen &&
                dropdownPosition &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={dropdownMenuRef}
                        className={`fixed bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 ${hasFooter ? (isAllPartiesDropdown ? 'pt-1 pb-0' : 'pt-1.5 pb-0') : 'py-1.5'} z-[9999] animate-in fade-in zoom-in-95 duration-200`}
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            minWidth: dropdownPosition.minWidth,
                        }}
                    >
                        {isMultiSelect ? (
                            <>
                                {showSelectAll && (
                                    <div className={`px-3 border-b border-slate-100 flex items-center justify-between ${isAllPartiesDropdown ? 'py-1' : 'py-1.5'}`}>
                                        <button
                                            onClick={() => {
                                                const nextVal = isStagedAll ? [] : [allValue];
                                                setStagedValues(nextVal);
                                                if (hideApplyButton) {
                                                    onChange(nextVal.length === 0 ? allValue : nextVal);
                                                }
                                            }}
                                            className={`group flex items-center gap-1.5 font-bold transition-colors uppercase tracking-wider rounded-md px-2 ${isAllPartiesDropdown ? 'py-0.5 text-[11px]' : 'py-1 text-[12px]'} ${isStagedAll ? 'text-[#2F5FC6]' : 'text-slate-500 hover:text-slate-800'} ${!flatSelectAll && highlightedIndex === 0 ? 'bg-slate-200/50' : ''}`}
                                        >
                                            <div className="w-4 flex justify-center shrink-0">
                                                <Check
                                                    size={14}
                                                    className={`${isStagedAll ? 'text-[#4A8AF4]' : 'text-slate-200 group-hover:text-slate-300'} transition-colors`}
                                                    strokeWidth={isStagedAll ? 3 : 2.5}
                                                />
                                            </div>
                                            {selectAllLabel}
                                        </button>
                                    </div>
                                )}
                                <div className="max-h-[160px] overflow-y-auto custom-scrollbar py-1">
                                    {options.map((option, idx) => {
                                        const isStaged = stagedValues.includes(option.value);
                                        const isHighlighted = highlightedIndex === idx + 1;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => toggleStagedValue(option.value)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors group ${isHighlighted ? 'bg-[#EEF0FC]' : 'hover:bg-[#EEF0FC]'}`}
                                            >
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <div className="w-4 flex justify-center shrink-0">
                                                        {isStaged && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                        <p className={`min-w-0 truncate tracking-tight text-[12px] ${isStaged ? 'font-bold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
                                                            {option.label}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {!hideApplyButton && (
                                    <div className={`border-t border-slate-100 bg-white flex justify-end gap-1.5 px-1 ${isAllPartiesDropdown ? 'py-1.5' : 'py-1'}`}>
                                        <button
                                            onClick={handleApply}
                                            className={`h-6 rounded-md bg-[#4A8AF4] px-4 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#3E79DE] hover:scale-[1.02] active:scale-[0.98] ${highlightedIndex === options.length + 1 ? 'ring-2 ring-[#4A8AF4]/20 ring-offset-1' : ''}`}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-1 max-h-[145px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
                            {internalOptions.map((option, idx) => {
                                const isHighlighted = idx === highlightedIndex;
                                if (option.isSelectAll) {
                                    return (
                                        <div key="select-all" className={`px-3 py-1.5 border-b border-slate-100 ${flatSelectAll ? '' : 'bg-slate-50/50'}`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (showApplyFooter) {
                                                        setStagedSingleValue(allValue);
                                                    } else {
                                                        onChange(allValue);
                                                        setIsOpen(false);
                                                    }
                                                }}
                                                className={`group flex w-full items-center gap-1.5 text-[12px] font-bold transition-colors uppercase tracking-wider rounded-md px-2 py-1 ${isRenderedSelectAllActive ? "text-[#2F5FC6]" : "text-slate-500 hover:text-slate-800"} ${!flatSelectAll && isHighlighted ? 'bg-slate-200/50' : ''}`}
                                            >
                                                <div className="w-4 flex justify-center shrink-0">
                                                    <Check
                                                        size={14}
                                                        className={`${isRenderedSelectAllActive ? "text-[#4A8AF4]" : "text-slate-200 group-hover:text-slate-300"} transition-colors`}
                                                        strokeWidth={isRenderedSelectAllActive ? 3 : 2.5}
                                                    />
                                                </div>
                                                {selectAllLabel}
                                            </button>
                                        </div>
                                    );
                                }

                                const isOptionVisuallySelected =
                                    renderedSingleValue === option.value ||
                                    (showOptionTicksWhenAllSelected && isRenderedSelectAllActive);

                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            if (showApplyFooter) {
                                                setStagedSingleValue(option.value);
                                            } else {
                                                onChange(option.value);
                                                setIsOpen(false);
                                            }
                                        }}
                                        className={`flex items-center gap-2 w-full text-left px-3 py-2 transition-colors ${isHighlighted ? "bg-[#EEF0FC]" : "hover:bg-[#EEF0FC]"} group`}
                                    >
                                        <span
                                            className={`text-[12px] w-full flex items-center gap-2 ${(renderedSingleValue === option.value && !isRenderedSelectAllActive) || isHighlighted ? "font-bold text-[#4A8AF4]" : "font-medium text-slate-700"}`}
                                        >
                                            <div className="w-4 flex justify-center shrink-0">
                                                {isOptionVisuallySelected && (
                                                    <Check
                                                        size={14}
                                                        className="text-[#4A8AF4]"
                                                        strokeWidth={2.5}
                                                    />
                                                )}
                                            </div>
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                            </div>
                        )}
                        {!isMultiSelect && showApplyFooter && (
                            <div className="mt-1 pt-1 border-t border-slate-100 bg-white flex justify-end gap-1.5 px-1 pb-0.5">
                                <button
                                    onClick={handleApply}
                                    className={`h-6 rounded-md bg-[#4A8AF4] px-4 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#3E79DE] hover:scale-[1.02] active:scale-[0.98] ${highlightedIndex === internalOptions.length ? 'ring-2 ring-[#4A8AF4]/20 ring-offset-1' : ''}`}
                                >
                                    Apply
                                </button>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
};

const DateCellRenderer = (props) => {
    const { value, data, context } = props;
    if (!value) return null;
    return (
        <span className="text-[12px] font-medium text-gray-600">
            {context.formatDate ? context.formatDate(value) : value}
        </span>
    );
};

const AmountCellRenderer = (props) => {
    const { value, data, context } = props;
    if (!data) return null;
    const isIncome = data.txnType === 'income' || data.transactionType?.name === 'income';
    const isExpense = data.txnType === 'expense' || data.transactionType?.name === 'expense';

    const parseAmount = (val) => {
        if (!val) return 0;
        const parsed = parseFloat(String(val).replace(/,/g, ''));
        return isNaN(parsed) ? 0 : Math.abs(parsed);
    };

    let amountVal = parseAmount(data.amountBaseCurrency ?? data.amountBase ?? data.finalAmountLocal ?? data.amountLocal);

    // Natively prioritize the backend-converted dynamic reporting currency (`amountBaseCurrency` / `amountBase`)
    let displayAmount = amountVal;

    const baseColor = isIncome ? "text-emerald-600" : isExpense ? "text-rose-600" : "text-gray-900";

    return (
        <div className={cn(props.className, "flex items-center justify-end gap-2.5 w-full h-full")}>
            <span className={cn(baseColor, "font-bold shrink-0 tabular-nums relative text-[12px]")}>
                {context.formatCurrency ? context.formatCurrency(displayAmount) : displayAmount}
            </span>
        </div>
    );
};

const ColumnSettingsHeader = (props) => {
    return (
        <div className="w-full h-full flex items-center justify-between gap-1 group">
            <div className="flex items-center gap-1.5 -ml-3">
                <ColumnVisibilityDropdown
                    columns={TXN_TABLE_COLUMNS}
                    visibleColumns={props.context.visibleColumns}
                    setVisibleColumns={props.context.setVisibleColumns}
                    defaultVisibleColumns={DEFAULT_VISIBLE_TXN_COLUMNS}
                    isHeader={true}
                />
                <span className="font-medium">{props.displayName}</span>
            </div>
            {props.enableMenu && (
                <button 
                    onClick={(e) => props.showColumnMenu(e.currentTarget)} 
                    className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors opacity-0 group-hover:opacity-100"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6"></line>
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                </button>
            )}
        </div>
    );
};

const Transactions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedBranch, selectedBranchIds, branches } = useBranch();
    const { user } = useAuth();
    const { selectedYear, financialYears } = useYear();
    const { preferences, formatCurrency, formatDate, updatePreferences } = usePreferences();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);


    // Toolbar States
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_TXN_COLUMNS);



    const colDefs = useMemo(() => {
        const baseDefs = [
            {
                field: 'id',
                headerName: 'ID',
                hide: !visibleColumns.id,
                minWidth: 60,
                maxWidth: 80,
                checkboxSelection: false,
                valueGetter: params => (typeof params.node?.rowIndex === 'number' ? params.node.rowIndex + 1 : '')
            },
            { field: 'party', headerName: 'Party', hide: !visibleColumns.party, minWidth: 150, cellRenderer: (params) => <PartyTooltip partyName={params.value} />, flex: 1.5, valueGetter: params => params.data?.contact || params.data?.payee || params.data?.counterpartyName || params.data?.party || '-' },
            { field: 'date', headerName: 'Date', hide: !visibleColumns.date, valueGetter: params => params.data?.txnDate, cellRenderer: DateCellRenderer, minWidth: 120, flex: 1, sort: 'desc' },
            { field: 'type', headerName: 'Type', hide: !visibleColumns.type, valueGetter: params => params.data?.transactionType?.name || params.data?.txnType || '-', minWidth: 120, flex: 1, cellRenderer: (params) => <span className="text-[12px] font-medium text-gray-700">{params.value}</span> },
            { field: 'branch', headerName: 'Branch', hide: !visibleColumns.branch, cellRenderer: (params) => <BranchTooltip branchNames={params.data?.branchNames} />, minWidth: 140, flex: 1 },
            { field: 'account', headerName: 'Account', hide: !visibleColumns.account, valueGetter: params => params.data?.account?.name || '-', minWidth: 150, flex: 1, cellRenderer: (params) => <AccountNameTooltip name={params.value} /> },
            { field: 'category', headerName: 'Category', hide: !visibleColumns.category, valueGetter: params => params.data?.category?.name || '-', minWidth: 150, flex: 1, cellRenderer: (params) => <AccountNameTooltip name={params.value} textClassName="text-[12px] font-medium text-gray-700" /> },
            { field: 'notes', headerName: 'Notes', hide: !visibleColumns.notes, cellRenderer: (params) => <DescriptionTooltip description={params.data?.notes || params.data?.description || '-'} />, flex: 2, minWidth: 200 },
            { field: 'amount', headerName: 'Amount', hide: !visibleColumns.amount, valueGetter: params => params.data?.amountBaseCurrency ?? params.data?.amountBase ?? params.data?.finalAmountLocal ?? params.data?.amountLocal, cellRenderer: AmountCellRenderer, minWidth: 120, flex: 1, type: 'rightAligned' },
            { field: 'createdBy', headerName: 'Created By', hide: !visibleColumns.createdBy, valueGetter: params => params.data?.createdByName || params.data?.createdByDisplayName || params.data?.creatorName || '-', cellClass: 'text-[12px] font-medium text-gray-400', minWidth: 130 }
        ];

        const firstVisibleIndex = baseDefs.findIndex(col => !col.hide);
        if (firstVisibleIndex !== -1) {
            const currentCellClass = baseDefs[firstVisibleIndex].cellClass;
            baseDefs[firstVisibleIndex] = {
                ...baseDefs[firstVisibleIndex],
                headerComponent: ColumnSettingsHeader,
                cellClass: (params) => {
                    const baseClass = typeof currentCellClass === 'function' ? currentCellClass(params) : (currentCellClass || '');
                    return `${baseClass} !pl-[36px]`.trim();
                }
            };
        }

        return baseDefs;
    }, [visibleColumns]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: [],
        cellClass: 'font-medium text-gray-600',
        cellStyle: { fontSize: '12px' }
    }), []);


    // Original state:
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportReviewModalOpen, setIsImportReviewModalOpen] = useState(false);
    const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);
    const [parsedStatementData, setParsedStatementData] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isUploadingStatement, setIsUploadingStatement] = useState(false);
    const [activeAttachmentTxnId, setActiveAttachmentTxnId] = useState(null); // Keep for legacy if needed, but we use object now
    const [attachmentViewer, setAttachmentViewer] = useState({ isOpen: false, txnId: null, path: null, position: { top: 0, right: 0 } });
    const [fullScreenAttachment, setFullScreenAttachment] = useState({ isOpen: false, path: null });
    const isPrinting = false;
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const exportDropdownRef = useRef(null);
    const gridRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
                setIsExportDropdownOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // CreateTransaction Drawer State
    const [drawerState, setDrawerState] = useState({ open: false, transaction: null });

    // Filter Logic State
    const [appliedFilters, setAppliedFilters] = useState(() => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        return {
            type: 'all',
            dateRange: null,
            currency: preferences?.currency || 'INR',
            party: 'all',
            accountId: params.get('accountId') || 'all'
        };
    });

    // Listen for URL param changes (like navigating from Accounts page)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const accountId = params.get('accountId') || 'all';
        setAppliedFilters(prev => ({ ...prev, accountId }));
    }, [location.search]);

    // Date Presets Generation
    const datePresets = useMemo(() => {
        const sortedFinancialYears = [...(financialYears || [])].sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
        const selectedYearIndex = sortedFinancialYears.findIndex((y) => Number(y.id) === Number(selectedYear?.id));
        const prevYear = selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;
        return generateDatePresets(selectedYear, prevYear);
    }, [selectedYear, financialYears]);

    // Auto-select Current FY by default on load & year toggle
    useEffect(() => {
        if (!selectedYear || datePresets.length === 0) return;
        const currentFyPreset = datePresets.find(p => p.value === 'current');
        if (currentFyPreset?.range) {
            setAppliedFilters(prev => ({ ...prev, dateRange: currentFyPreset.range }));
        }
    }, [selectedYear, datePresets]);

    const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);
    const [pagingPanel, setPagingPanel] = useState(null);

    useEffect(() => {
        const interval = setInterval(() => {
            const panel = document.querySelector('.transactions-grid-shell .ag-paging-panel');
            if (panel && !pagingPanel) {
                setPagingPanel(panel);
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [pagingPanel]);
    const cacheKey = `transactions:list:v2:${selectedYear?.id || 'fy'}:${appliedFilters.currency || 'INR'}`;
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
            const payload = {
                branchId: 'all',
                financialYearId: selectedYear.id,
                targetCurrency: appliedFilters.currency
            };
            if (appliedFilters.dateRange?.startDate) {
                payload.startDate = appliedFilters.dateRange.startDate;
                payload.endDate = appliedFilters.dateRange.endDate || appliedFilters.dateRange.startDate;
            }

            const response = await apiService.transactions.getAll(payload, { signal });

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
    }, [appliedFilters.currency, cacheKey, user, selectedYear?.id, appliedFilters.dateRange?.startDate, appliedFilters.dateRange?.endDate]);


    useEffect(() => {
        const controller = new AbortController();
        fetchTransactions(controller.signal);
        return () => controller.abort();
    }, [fetchTransactions]);



    // Sorting Handlers





    const groupedTransactions = useMemo(() => {
        // We bypass the global filter, so it's intrinsically ALWAYS 'multi' mode in terms of grouping logic
        const raw = Array.isArray(transactions) ? transactions : [];

        return raw.map((txn, index) => {
            const rawBranchId = txn.branchId || txn.branch_id || txn.branch?.id || 0;
            const branchName = txn.branch?.name || (branches || []).find(b => String(b.id) === String(rawBranchId))?.name || 'Unknown';
            const branchId = Number(rawBranchId);

            return {
                ...txn,
                baseKey: `txn_${txn.id}_${index}`, // Ensures uniqueness even if the ID is missing
                branchNames: [branchName],
                originalTxnIds: [txn.id],
                groupBranchIds: branchId ? [branchId] : []
            };
        });
    }, [transactions, selectedBranch?.id, branches]);

    // Page-level filters feed both the table and the insights charts.
    const scopedTransactions = useMemo(() => {
        let result = [...groupedTransactions];

        // Time Period via DateRange
        if (appliedFilters.dateRange?.startDate) {
            const startStr = appliedFilters.dateRange.startDate;
            const endStr = appliedFilters.dateRange.endDate || startStr;

            result = result.filter(t => {
                if (!t.txnDate) return false;

                let txnDateStr = String(t.txnDate);
                // Standardize to YYYY-MM-DD
                if (txnDateStr.includes('T')) {
                    const d = new Date(t.txnDate);
                    if (!isNaN(d)) {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        txnDateStr = `${year}-${month}-${day}`;
                    }
                } else if (txnDateStr.includes(' ')) {
                    txnDateStr = txnDateStr.split(' ')[0];
                }

                return txnDateStr >= startStr && (endStr === startStr ? txnDateStr <= endStr : txnDateStr <= endStr);
            });
        }

        // Branch Context filtering
        if (selectedBranch?.id || (Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0)) {
            const allowed = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
                ? selectedBranchIds.map(String)
                : [String(selectedBranch?.id)];
            
            const allowedNames = (branches || [])
                .filter(b => allowed.includes(String(b.id)))
                .map(b => String(b.name).toLowerCase().trim());

            // Support reverse lookup if DB IDs shifted
            const allowedIdsFromName = (branches || [])
                .filter(b => allowedNames.includes(String(b.name).toLowerCase().trim()))
                .map(b => String(b.id));

            if (!allowed.includes('all') && !allowed.includes('multi')) {
                result = result.filter(t => {
                    const rawTBranchId = String(t.branchId || t.branch_id || t.branch?.id || "");
                    const groupBranchIds = t.groupBranchIds || t.originalBranchIds || (t.siblingMap ? Object.keys(t.siblingMap) : [rawTBranchId]);
                    
                    const hasAllowedBranchId = groupBranchIds.some(id => allowed.includes(String(id)) || allowedIdsFromName.includes(String(id)));
                    const directMatch = allowed.includes(rawTBranchId) || allowedIdsFromName.includes(rawTBranchId);
                    const nestedBranchMatch = t.branch?.id && (allowed.includes(String(t.branch.id)) || allowedIdsFromName.includes(String(t.branch.id)));
                    
                    const txnBranchNameRaw = t.branchNames?.length ? t.branchNames[0] : (t.branch?.name || (branches || []).find(b => String(b.id) === String(rawTBranchId))?.name || '');
                    const normalizedTxnName = String(txnBranchNameRaw).toLowerCase().trim();
                    const hasAllowedBranchName = allowedNames.includes(normalizedTxnName) || t.branchNames?.some(name => allowedNames.includes(String(name).toLowerCase().trim()));
                    
                    return hasAllowedBranchId || directMatch || hasAllowedBranchName || nestedBranchMatch;
                });
            }
        }

        // Party Filter
        if (Array.isArray(appliedFilters.party) ? appliedFilters.party.length > 0 : appliedFilters.party !== 'all') {
            const parties = Array.isArray(appliedFilters.party) ? appliedFilters.party : [appliedFilters.party];
            if (!parties.includes('all')) {
                result = result.filter(txn => {
                    const p = (txn.contact || txn.payee || txn.counterpartyName || txn.party || '').trim();
                    return parties.includes(p);
                });
            }
        }

        // Account Filter
        if (appliedFilters.accountId !== 'all') {
            const targetId = String(appliedFilters.accountId);
            result = result.filter(txn => {
                const accountsAssociated = [];
                if (txn.accountId) accountsAssociated.push(String(txn.accountId));
                if (txn.fromAccountId) accountsAssociated.push(String(txn.fromAccountId));
                if (txn.toAccountId) accountsAssociated.push(String(txn.toAccountId));
                if (txn.account?.id) accountsAssociated.push(String(txn.account.id));

                if (txn.entries && txn.entries.length > 0) {
                    txn.entries.forEach(e => accountsAssociated.push(String(e.accountId)));
                }

                return accountsAssociated.includes(targetId);
            });
        }

        return result;

    }, [groupedTransactions, appliedFilters, selectedBranchIds, selectedBranch, branches]);

    // Table-only filters should not affect the insights charts above the grid.
    const filteredTransactions = useMemo(() => {
        let result = [...scopedTransactions];

        if (Array.isArray(appliedFilters.type) ? appliedFilters.type.length > 0 : appliedFilters.type !== 'all') {
            const types = Array.isArray(appliedFilters.type) ? appliedFilters.type : [appliedFilters.type];
            if (!types.includes('all')) {
                result = result.filter((txn) => {
                    const typeName = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
                    return types.includes(typeName);
                });
            }
        }

        if (!searchTerm) return result;

        const term = searchTerm.toLowerCase();
        return result.filter(txn =>
            (txn.contact || '').toLowerCase().includes(term) ||
            (txn.counterpartyName || '').toLowerCase().includes(term) ||
            (txn.payee || '').toLowerCase().includes(term) ||
            (txn.name || '').toLowerCase().includes(term) ||
            (txn.notes || '').toLowerCase().includes(term) ||
            (txn.account?.name || '').toLowerCase().includes(term) ||
            (txn.category?.name || '').toLowerCase().includes(term) ||
            (txn.transactionType?.name || txn.txnType || '').toLowerCase().includes(term) ||
            String(txn.status || '').toLowerCase().includes(term) ||
            (txn.txnDate || '').toLowerCase().includes(term) ||
            String(txn.amountBaseCurrency ?? txn.amountBase ?? txn.finalAmountLocal ?? txn.amountLocal ?? '').includes(term.replace(/,/g, '').trim())
        );
    }, [scopedTransactions, appliedFilters.type, searchTerm]);

    const insightsData = useMemo(() => {
        const trendMap = {};
        const gstTrendMap = {};
        const categoryMap = {};
        let totalIncome = 0;
        let totalExpense = 0;
        let totalGstPaid = 0;
        let taxableExpenseCount = 0;
        let totalCgstPaid = 0;
        let totalSgstPaid = 0;
        let totalIgstPaid = 0;

        scopedTransactions.forEach(t => {
            const rawDate = new Date(t.txnDate || new Date());
            const dateStr = !isNaN(rawDate) ? rawDate.toISOString().split('T')[0] : 'Unknown';
            const amount = Number(t.amountBaseCurrency ?? t.finalAmountLocal ?? t.amountBase ?? 0);
            const localDisplayAmount = Number(t.finalAmountLocal ?? t.amountLocal ?? t.amountBase ?? 0);
            const displayRate = localDisplayAmount > 0 ? amount / localDisplayAmount : 1;
            const type = (t.transactionType?.name || t.txnType || '').toLowerCase();

            if (!trendMap[dateStr]) trendMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
            if (!gstTrendMap[dateStr]) gstTrendMap[dateStr] = { date: dateStr, gstPaid: 0 };

            if (type === 'income') {
                trendMap[dateStr].income += amount;
                totalIncome += amount;
            } else if (type === 'expense') {
                trendMap[dateStr].expense += amount;
                totalExpense += amount;

                const catName = t.category?.name || 'Uncategorized';
                if (!categoryMap[catName]) categoryMap[catName] = 0;
                categoryMap[catName] += amount;

                const safeDisplayRate = Number.isFinite(displayRate) && displayRate > 0 ? displayRate : 1;
                const gstTotal = Number(t.gstTotal ?? 0) * safeDisplayRate;
                const cgstAmount = Number(t.cgstAmount ?? 0) * safeDisplayRate;
                const sgstAmount = Number(t.sgstAmount ?? 0) * safeDisplayRate;
                const igstAmount = Number(t.igstAmount ?? 0) * safeDisplayRate;

                if (gstTotal > 0 || cgstAmount > 0 || sgstAmount > 0 || igstAmount > 0) {
                    taxableExpenseCount += 1;
                }

                gstTrendMap[dateStr].gstPaid += gstTotal;
                totalGstPaid += gstTotal;
                totalCgstPaid += cgstAmount;
                totalSgstPaid += sgstAmount;
                totalIgstPaid += igstAmount;
            }
        });

        const trendData = Object.values(trendMap)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(d => ({
                ...d,
                displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));

        const gstTrendData = Object.values(gstTrendMap)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((d) => ({
                ...d,
                displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));

        const categoryData = Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const gstBreakdownData = [
            { name: 'CGST', value: totalCgstPaid, color: '#4A8AF4' },
            { name: 'SGST', value: totalSgstPaid, color: '#22C55E' },
            { name: 'IGST', value: totalIgstPaid, color: '#F59E0B' }
        ].filter((entry) => entry.value > 0);

        // Anomalies logic removed-----

        return {
            trendData,
            gstTrendData,
            gstBreakdownData,
            categoryData,
            totalIncome,
            totalExpense,
            totalGstPaid,
            totalCgstPaid,
            totalSgstPaid,
            totalIgstPaid,
            taxableExpenseCount,
            netFlow: totalIncome - totalExpense
        };
    }, [scopedTransactions]);

    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];


    const handleFilterReset = () => {
        setAppliedFilters({
            type: 'all',
            dateRange: null,
            currency: preferences?.currency || 'INR',
            party: 'all'
        });
    };

    const availableParties = useMemo(() => {
        const uniqueSet = new Set();
        transactions.forEach(txn => {
            const p = (txn.contact || txn.payee || txn.counterpartyName || txn.party || '').trim();
            if (p) uniqueSet.add(p);
        });
        const arr = Array.from(uniqueSet).sort((a, b) => a.localeCompare(b));
        return arr.map(p => ({ label: p, value: p }));
    }, [transactions]);

    const buildExportPayload = (format) => {
        const normalizedBranchIds = Array.isArray(selectedBranchIds)
            ? selectedBranchIds.map(Number).filter(Boolean)
            : [];
        const normalizedPartyFilter = Array.isArray(appliedFilters.party)
            ? appliedFilters.party.filter(Boolean).join(',')
            : appliedFilters.party;

        const exportBranchId = normalizedBranchIds.length > 1
            ? normalizedBranchIds
            : normalizedBranchIds.length === 1
                ? normalizedBranchIds[0]
                : selectedBranch?.id
                    ? Number(selectedBranch.id)
                    : 'all';

        const normalizedAppliedFilters = {
            ...(normalizedPartyFilter && normalizedPartyFilter !== 'all' ? { payee: normalizedPartyFilter } : {}),
            ...(appliedFilters.dateRange?.startDate
                ? {
                    timePeriod: 'Custom Range',
                    startDate: appliedFilters.dateRange.startDate,
                    endDate: appliedFilters.dateRange.endDate || appliedFilters.dateRange.startDate
                }
                : {})
        };

        return {
            branchId: exportBranchId,
            financialYearId: selectedYear?.id,
            searchTerm,
            format,
            targetCurrency: appliedFilters.currency,
            appliedFilters: normalizedAppliedFilters
        };
    };

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
    const handleClientExportExcel = () => {
        if (!gridRef.current || !gridRef.current.api) return;

        // Dynamically load xlsx from CDN to generate native .xlsx without backend
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => executeExcelExport();
            document.head.appendChild(script);
        } else {
            executeExcelExport();
        }
    };

    const executeExcelExport = () => {
        if (!gridRef.current || !gridRef.current.api) return;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const fileName = `transactions_export_${yyyy}-${mm}-${dd}.xlsx`;

        let rowData = [];

        // Push Header Row
        const headers = TXN_TABLE_COLUMNS.filter(col => visibleColumns[col.key]).map(col => col.label);
        rowData.push(headers);

        // Push Data Rows
        let count = 0;
        gridRef.current.api.forEachNodeAfterFilterAndSort(node => {
            if (!node.data) return;
            const txn = node.data;
            let row = [];

            TXN_TABLE_COLUMNS.forEach(col => {
                if (!visibleColumns[col.key]) return;

                let val = '-';
                if (col.key === 'date') val = formatDate(txn.txnDate);
                if (col.key === 'party') val = txn.contact || txn.payee || txn.counterpartyName || txn.party || '-';
                if (col.key === 'type') val = txn.transactionType?.name || txn.txnType || '-';
                if (col.key === 'branch') val = txn.branchNames?.length > 0 ? txn.branchNames.join(', ') : '-';
                if (col.key === 'account') val = txn.account?.name || '-';
                if (col.key === 'category') val = txn.category?.name || '-';
                if (col.key === 'notes') val = txn.notes || txn.description || '-';
                if (col.key === 'amount') val = Number(txn.amountBaseCurrency ?? txn.amountBase ?? txn.finalAmountLocal ?? txn.amountLocal) || 0;
                if (col.key === 'createdBy') val = txn.createdByName || txn.createdByDisplayName || txn.creatorName || '-';
                if (col.key === 'id') val = count + 1;

                row.push(val);
            });
            rowData.push(row);
            count++;
        });

        const ws = window.XLSX.utils.aoa_to_sheet(rowData);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        window.XLSX.writeFile(wb, fileName);
    };

    const handleClientExportPDF = () => {
        const printContainer = document.getElementById('txn-print-container');
        if (printContainer && gridRef.current && gridRef.current.api) {
            let html = '<h1 style="font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 15px; color: #000; text-transform: uppercase; letter-spacing: 1px;">JKSOL</h1><table><thead><tr>';
            TXN_TABLE_COLUMNS.forEach(col => {
                if (visibleColumns[col.key]) {
                    html += `<th class="${col.key === 'amount' ? 'text-right' : 'text-left'}">${col.label}</th>`;
                }
            });
            html += '</tr></thead><tbody>';

            let count = 0;
            gridRef.current.api.forEachNodeAfterFilterAndSort(node => {
                if (!node.data) return;
                const txn = node.data;
                html += '<tr>';
                TXN_TABLE_COLUMNS.forEach(col => {
                    if (!visibleColumns[col.key]) return;

                    let val = '-';
                    if (col.key === 'date') val = formatDate(txn.txnDate);
                    if (col.key === 'party') val = `<span class="truncate block max-w-[200px]">${txn.contact || txn.payee || txn.counterpartyName || txn.party || '-'}</span>`;
                    if (col.key === 'type') val = txn.transactionType?.name || txn.txnType || '-';
                    if (col.key === 'branch') val = txn.branchNames?.length > 0 ? txn.branchNames.join(', ') : '-';
                    if (col.key === 'account') val = txn.account?.name || '-';
                    if (col.key === 'category') val = txn.category?.name || '-';
                    if (col.key === 'notes') val = `<span class="truncate block max-w-[200px]">${txn.notes || txn.description || '-'}</span>`;
                    if (col.key === 'amount') val = `<span class="font-medium">${formatCurrency(txn.amountBaseCurrency ?? txn.amountBase ?? txn.finalAmountLocal ?? txn.amountLocal)}</span>`;
                    if (col.key === 'createdBy') val = txn.createdByName || txn.createdByDisplayName || txn.creatorName || '-';
                    if (col.key === 'id') val = count + 1;

                    html += `<td class="${col.key === 'amount' ? 'text-right' : ''}">${val}</td>`;
                });
                html += '</tr>';
                count++;
            });

            if (count === 0) {
                const colCount = Object.values(visibleColumns).filter(Boolean).length || 1;
                html += `<tr><td colspan="${colCount}" class="text-center py-4">No transactions found</td></tr>`;
            }
            html += '</tbody></table>';
            printContainer.innerHTML = html;
        }
        window.print();
    };

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

        setDrawerState({
            open: true,
            transaction: {
                ...txn,
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

    // Global Escape Key Listener to focus Sidebar Navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Prevent intercepting if they are actively working in an open modal
            if (e.key === 'Escape') {
                if (isImportModalOpen || isImportReviewModalOpen || deleteDialog.open || drawerState.open || attachmentViewer.isOpen || fullScreenAttachment.isOpen) {
                    return;
                }

                const sidebar = document.getElementById('app-main-sidebar');
                if (sidebar) {
                    sidebar.focus({ preventScroll: true });
                    // Specifically target the transactions menu link in the sidebar
                    const txnLink = sidebar.querySelector('a[href*="/transactions"]');
                    if (txnLink) {
                        txnLink.focus({ preventScroll: true });
                    } else {
                        // Fallback if not found
                        const firstBtn = sidebar.querySelector('[data-sidebar-focusable="true"], button, a');
                        if (firstBtn) firstBtn.focus({ preventScroll: true });
                    }
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isImportModalOpen, isImportReviewModalOpen, deleteDialog.open, drawerState.open, attachmentViewer.isOpen, fullScreenAttachment.isOpen]);

    // Calculate totals grouped by currency
    const currencyTotals = useMemo(() => {
        const totals = {};
        scopedTransactions.forEach(t => {
            const currency = t.baseCurrency || t.currencyCode || 'INR';
            const unitAmount = Number(t.amountBaseCurrency || t.finalAmountLocal || t.amountBase || 0);
            const replicationCount = t.branchNames?.length || 1;
            totals[currency] = (totals[currency] || 0) + (unitAmount * replicationCount);
        });
        return totals;
    }, [scopedTransactions]);

    const hasBranchColumn = selectedBranch?.id === 'all' || selectedBranch?.id === 'multi';


    return (
        <div className="transactions-tablet-page flex flex-col min-h-full overflow-visible">

            <style>{`
                @media print {
                    @page { margin: 0; size: landscape; }
                    html, body {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        padding: 12mm !important;
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
                        padding: 4px 6px !important;
                        font-size: 10px !important;
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
            {/* Backdrop for explicit modals */}
            {activeAttachmentTxnId && (
                <div
                    className="fixed inset-0 z-40 bg-black/5 lg:bg-transparent"
                    onClick={() => {
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
                className="!overflow-visible lg:!overflow-visible"
                contentClassName="p-0 lg:p-0 !overflow-visible lg:!overflow-visible"
                cardClassName="border-none shadow-none rounded-none !overflow-visible max-h-none lg:!max-h-none bg-white"
            >
                <div className="flex flex-col min-h-full h-auto">

                    {/* Print Only Header */}
                    <div className="hidden text-center py-6 mb-4">
                        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">Transactions List</h1>
                    </div>

                    {/* Global Filters & Actions Row */}
                    <div className="px-5 pt-3 pb-4 flex flex-col xl:flex-row justify-between xl:items-center gap-4 print:hidden relative z-20 w-full bg-transparent border-b border-gray-100">
                        {/* LEFT SIDE: Core Filters */}
                        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                            <DateRangePicker
                                startDate={appliedFilters.dateRange?.startDate}
                                endDate={appliedFilters.dateRange?.endDate}
                                selectedPreset={appliedFilters.dateRange?.preset}
                                presetOptions={datePresets}
                                onApplyRange={(range) => setAppliedFilters(prev => ({ ...prev, dateRange: range }))}
                                className="h-[32px]"
                            />

                            <BranchSelector flatSelectAll hideSettings />

                            <CurrencySelector
                                value={appliedFilters.currency}
                                onChange={(val) => {
                                    setAppliedFilters(prev => ({ ...prev, currency: val }));
                                    updatePreferences({ currency: val });
                                }}
                                triggerTextClassName="text-[12px]"
                                optionTextClassName="text-[12px]"
                            />

                            <FilterDropdown
                                value={appliedFilters.party}
                                onChange={(val) => setAppliedFilters(prev => ({ ...prev, party: val }))}
                                placeholder="Party"
                                options={availableParties}
                                isMultiSelect
                                showSelectAll
                                flatSelectAll
                                keepButtonNeutral
                                neutralCountBadge
                                selectAllLabel="All Parties"
                                allDisplayLabel="All Parties"
                                buttonClassName="w-[120px] text-slate-800 h-[32px]"
                            />

                            <FilterDropdown
                                value={appliedFilters.type}
                                onChange={(val) => setAppliedFilters(prev => ({ ...prev, type: val }))}
                                placeholder="Type"
                                options={[
                                    { label: "Income", value: "income" },
                                    { label: "Expense", value: "expense" },
                                    { label: "Transfer", value: "transfer" },
                                    { label: "Investment", value: "investment" },
                                ]}
                                isMultiSelect={true}
                                showSelectAll={false}
                                hideApplyButton={true}
                                keepButtonNeutral
                                neutralCountBadge
                                allDisplayLabel="All Types"
                                buttonClassName="w-[110px] h-[32px]"
                            />


                            <button
                                type="button"
                                onClick={() => setIsInsightsExpanded(!isInsightsExpanded)}
                                className={`group flex items-center justify-center gap-1.5 px-3 rounded-md ml-1 outline-none transition-all h-[32px] border font-medium text-[12px] ${isInsightsExpanded ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'}`}
                            >
                                <Activity size={14} className={isInsightsExpanded ? "text-blue-500" : "text-gray-400 group-hover:text-[#4A8AF4] transition-colors"} />
                                <span>{isInsightsExpanded ? "Hide Chart" : "Show Chart"}</span>
                            </button>
                        </div>

                        {/* RIGHT SIDE: Utilities & Search */}
                        <div className="shrink-0 flex flex-wrap items-center justify-start xl:justify-end gap-2 flex-none mt-2 xl:mt-0">
                            <label className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-blue-200 bg-blue-50/50 text-blue-600 hover:bg-blue-50 hover:border-blue-300 focus-within:bg-blue-50 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all font-medium text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer">
                                <input 
                                    type="file" 
                                    accept=".pdf" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setIsUploadingStatement(true);
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const res = await apiService.transactions.uploadStatement(formData);
                                                if (res.success) {
                                                    setUploadedFile(file);
                                                    setParsedStatementData(res.data);
                                                    setIsImportReviewModalOpen(true);
                                                }
                                            } catch (error) {
                                                console.error('Failed to parse statement', error);
                                                alert(error.response?.data?.message || 'Failed to parse statement');
                                            } finally {
                                                setIsUploadingStatement(false);
                                                e.target.value = null;
                                            }
                                        }
                                    }}
                                />
                                {isUploadingStatement ? (
                                    <span className="font-medium text-blue-400">Parsing...</span>
                                ) : (
                                    <span className="font-medium">Import Statement</span>
                                )}
                            </label>

                            <div className="relative" ref={exportDropdownRef}>
                                <button
                                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                    className="group h-[32px] px-2 flex items-center justify-center rounded-md text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all"
                                >
                                    <MoreVertical size={16} className="text-gray-500 group-hover:text-[#4A8AF4] transition-colors" />
                                </button>

                                {isExportDropdownOpen && (
                                    <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={() => {
                                                setIsExportDropdownOpen(false);
                                                setIsImportHistoryOpen(true);
                                            }}
                                            className="w-full text-left px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-[#EEF0FC] hover:text-[#4A8AF4] transition-colors flex items-center gap-2 group"
                                        >
                                            <History size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                                            Import History
                                        </button>
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Export As</div>
                                        <button
                                            onClick={() => {
                                                setIsExportDropdownOpen(false);
                                                handleClientExportExcel();
                                            }}
                                            className="w-full text-left px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-[#EEF0FC] hover:text-[#4A8AF4] transition-colors flex items-center gap-2 group"
                                        >
                                            <Download size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                                            Excel Document
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsExportDropdownOpen(false);
                                                handleClientExportPDF();
                                            }}
                                            className="w-full text-left px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-[#EEF0FC] hover:text-[#4A8AF4] transition-colors flex items-center gap-2 group"
                                        >
                                            <Download size={14} className="text-gray-400 group-hover:text-[#4A8AF4] transition-colors" />
                                            PDF Document
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Conditionally Visible Charts */}
                    <div className="px-5 w-full print:hidden">
                        <div 
                            className={`grid transition-all duration-300 ease-in-out ${
                                isInsightsExpanded 
                                    ? "grid-rows-[1fr] opacity-100 mb-0" 
                                    : "grid-rows-[0fr] opacity-0 mb-3"
                            }`}
                        >
                            <div className="overflow-hidden">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 pb-6 border-b border-gray-200">
                                    <div className="lg:col-span-6">
                                        <h3 className="text-[13px] font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            <TrendingUp size={14} className="text-primary" /> Cash Flow Trend
                                        </h3>
                                        <div className="h-[220px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={insightsData.trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2} barSize={8}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                    <XAxis dataKey="displayDate" axisLine={{ stroke: "#f3f4f6" }} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }}
                                                        tickFormatter={(val) => {
                                                            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                                            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                                            return val;
                                                        }}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: 'transparent' }}
                                                        content={({ active, payload, label }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-xl shadow-gray-200/50">
                                                                        <div className="text-[11px] font-bold text-gray-500 uppercase mb-2">{label}</div>
                                                                        {payload.map((entry, index) => (
                                                                            <div key={index} className="flex items-center gap-3 text-[13px] font-bold mb-1">
                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                                <span className="text-gray-600 w-16">{entry.name}:</span>
                                                                                <span className={entry.dataKey === 'income' ? "text-emerald-600" : "text-rose-600"}>
                                                                                    {formatCurrency(entry.value)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-6">
                                        <h3 className="text-[13px] font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            <FileText size={14} className="text-black" /> Tax Paid
                                        </h3>
                                        <div className="h-[220px] w-full">
                                            {insightsData.totalGstPaid > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={insightsData.gstTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={12}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                        <XAxis dataKey="displayDate" axisLine={{ stroke: "#f3f4f6" }} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }} dy={8} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }}
                                                            tickFormatter={(val) => {
                                                                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                                                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                                                return val;
                                                            }}
                                                        />
                                                        <Tooltip
                                                            cursor={{ fill: 'transparent' }}
                                                            content={({ active, payload, label }) => {
                                                                if (active && payload && payload.length) {
                                                                    return (
                                                                        <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-xl shadow-gray-200/50 flex flex-col gap-1">
                                                                            <div className="text-[11px] font-bold text-gray-500 uppercase mb-1">{label}</div>
                                                                            <div className="flex items-center justify-between gap-4">
                                                                                <span className="text-[13px] font-medium text-gray-600">Tax Paid:</span>
                                                                                <span className="text-[14px] font-bold text-black">{formatCurrency(payload[0].value)}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                        <Bar dataKey="gstPaid" name="Tax Paid" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center text-[12px] font-medium text-gray-400 gap-2">
                                                    <FileText size={24} className="text-gray-200" />
                                                    <span>No tax paid in this view</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div
                        className="transactions-grid-shell w-full px-5 pb-1 relative flex flex-col print:hidden"
                        style={{ height: 'calc(100vh - 135px)', minHeight: '400px' }}
                        aria-busy={loading}
                    >
                        <div className="h-full w-full relative">
                            <div className="absolute inset-0">
                                <AgGridReact
                                    ref={gridRef}
                                    theme={themeQuartz}
                                    rowData={filteredTransactions}
                                    columnDefs={colDefs}
                                    defaultColDef={defaultColDef}
                                    rowSelection="multiple"
                                    rowHeight={36}
                                    headerHeight={44}
                                    animateRows={true}
                                    pagination={true}
                                    paginationPageSize={50}
                                    paginationPageSizeSelector={[25, 50, 100, 200]}
                                    onRowClicked={(event) => {
                                        if (canEditTxn(event.data)) {
                                            handleEdit(event.data);
                                        }
                                    }}
                                    context={{
                                        handleEdit,
                                        handleDelete,
                                        canEditTxn,
                                        setFullScreenAttachment,
                                        formatCurrency,
                                        formatDate,
                                        visibleColumns,
                                        setVisibleColumns
                                    }}
                                    overlayNoRowsTemplate={
                                        loading ? '<span class="ag-overlay-loading-center text-primary font-medium text-sm">Loading transactions...</span>' : '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No transactions found</span>'
                                    }
                                />
                            </div>
                        </div>

                        {/* Summary Overlay portalled into AG Grid Footer */}
                        {pagingPanel && createPortal(
                            <div className="flex items-center gap-6 print:hidden mr-auto pl-5 h-full pointer-events-auto" style={{ order: -1 }}>
                                <div className="flex items-center gap-2.5 min-w-fit">
                                    <div className="">
                                        <ArrowDownLeft size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-gray-500 mb-[2px] leading-none">Total Inflow</div>
                                        <div className="text-[13px] font-extrabold text-gray-900 whitespace-nowrap leading-none">{formatCurrency(insightsData.totalIncome)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 min-w-fit">
                                    <div className="">
                                        <ArrowUpRight size={16} className="text-rose-600" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-gray-500 mb-[2px] leading-none">Total Outflow</div>
                                        <div className="text-[13px] font-extrabold text-gray-900 whitespace-nowrap leading-none">{formatCurrency(insightsData.totalExpense)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 min-w-fit pl-5 border-l border-gray-200">
                                    <div className="">
                                        <Activity size={16} className={insightsData.netFlow >= 0 ? "text-primary" : "text-red-600"} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-gray-500 mb-[2px] leading-none">Net Flow</div>
                                        <div className={cn("text-[13px] font-extrabold whitespace-nowrap leading-none", insightsData.netFlow >= 0 ? "text-primary" : "text-red-600")}>
                                            {formatCurrency(insightsData.netFlow)}
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            pagingPanel
                        )}
                    </div>

                    {/* Print Only Simple HTML Table (Dynamically Built) */}
                    <div id="txn-print-container" className="hidden print:block txn-print-surface w-full"></div>
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

            {isImportReviewModalOpen && (
                <ImportReviewModal
                    isOpen={isImportReviewModalOpen}
                    onClose={() => {
                        setIsImportReviewModalOpen(false);
                        setParsedStatementData(null);
                        setUploadedFile(null);
                    }}
                    parsedData={parsedStatementData}
                    file={uploadedFile}
                    onSuccess={() => {
                        setIsImportReviewModalOpen(false);
                        setParsedStatementData(null);
                        setUploadedFile(null);
                        fetchTransactions();
                    }}
                />
            )}

            {isImportHistoryOpen && (
                <ImportHistoryPanel
                    isOpen={isImportHistoryOpen}
                    onClose={() => setIsImportHistoryOpen(false)}
                    onRefresh={fetchTransactions}
                />
            )}

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

            <CreateTransaction
                isOpen={drawerState.open}
                onClose={() => setDrawerState({ open: false, transaction: null })}
                transactionToEdit={drawerState.transaction}
                onSuccess={() => {
                    setDrawerState({ open: false, transaction: null });
                    notifyTransactionDataChanged();
                    fetchTransactions();
                }}
            />

            {/* Full Screen Attachment Viewer */}
            {fullScreenAttachment.isOpen && fullScreenAttachment.path && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white">
                            <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">Attachment</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!fullScreenAttachment.path) return;
                                        void downloadAttachmentFile(fullScreenAttachment.path);
                                    }}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Download size={14} strokeWidth={2.5} />
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest">Download</span>
                                </button>
                                <button
                                    onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                    <X size={16} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex items-center justify-center">
                            {(() => {
                                const p = fullScreenAttachment.path;
                                const fullUrl = buildAttachmentUrl(p);
                                const isImage = p.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                if (isImage) {
                                    return <img src={fullUrl} alt="Attachment" className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-200 shadow-sm bg-white" />;
                                } else {
                                    return <iframe src={fullUrl} className="w-full h-[75vh] bg-white rounded-lg border border-slate-200 shadow-sm" />;
                                }
                            })()}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Transactions;
