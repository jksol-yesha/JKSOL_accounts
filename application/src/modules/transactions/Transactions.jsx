
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    Download, X, FileSpreadsheet, ChevronDown, ArrowUpDown, Paperclip, Eye, ExternalLink, User, Loader2, Settings2, RefreshCcw, Check, TrendingUp, ChevronUp, PieChart as PieChartIcon, Activity, ListMinus, ShoppingBag, Users
} from 'lucide-react';

const transactionTabs = [
    { label: 'Transactions', key: 'transactions', path: '/transactions', icon: ListMinus },
    { label: 'Categories', key: 'categories', path: '/category', icon: ShoppingBag },
    { label: 'Parties', key: 'parties', path: '/parties', icon: Users }
];
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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

import ConfirmDialog from '../../components/common/ConfirmDialog';
import CustomSelect from '../../components/common/CustomSelect';
import ImportTransactionModal from './ImportTransactionModal';
import CreateTransaction from './components/CreateTransaction';
// import ImportPDFModal from './ImportPDFModal';
import DateRangePicker from '../../components/common/DateRangePicker';
import BranchSelector from '../../components/layout/BranchSelector';
import CurrencySelector from '../../components/layout/CurrencySelector';
import { generateDatePresets } from '../../utils/constants';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';
import AccountNameTooltip from '../../components/common/AccountNameTooltip';
import { notifyTransactionDataChanged } from './transactionDataSync';

const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    ids: [],
    label: '',
    loading: false
});

const TXN_TABLE_COLUMN_STORAGE_KEY = 'transactions:tableColumns:v2';
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

const PortalTooltip = ({ content, children, maxWidth = 120 }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const ref = useRef(null);

    const handleMouseEnter = () => {
        if (!ref.current) return;
        // Only show if the text is physically getting clipped
        if (ref.current.scrollWidth <= ref.current.clientWidth + 1) return;
        
        const rect = ref.current.getBoundingClientRect();
        let left = rect.left;
        // Keep inside viewport if it bleeds right
        if (left + 300 > window.innerWidth) {
            left = window.innerWidth - 320;
        }
        setPos({ top: rect.bottom + 6, left });
        setVisible(true);
    };

    return (
        <span 
            ref={ref} 
            className="block truncate cursor-default transition-colors w-full"
            style={{ maxWidth }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && createPortal(
                <span 
                    style={{ top: pos.top, left: pos.left }}
                    className="fixed z-[99999] max-w-[300px] w-max bg-slate-800 text-white text-[11px] font-medium px-3 py-2 rounded-sm shadow-md pointer-events-none whitespace-normal break-words leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    {content}
                </span>,
                document.body
            )}
        </span>
    );
};

/** Custom tooltip that shows dark card natively escaping AG Grid map */
const BranchTooltip = ({ branchNames }) => {
    if (!branchNames || branchNames.length === 0) return <span className="text-gray-400 text-xs">-</span>;
    const displayText = branchNames.join(', ');
    return (
        <PortalTooltip content={displayText} maxWidth={120}>
            <span className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                {displayText}
            </span>
        </PortalTooltip>
    );
};

const ColumnVisibilityDropdown = ({ columns, visibleColumns, setVisibleColumns }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const popupRef = useRef(null);
    const [position, setPosition] = useState(null);

    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        
        const handleClickOutside = (e) => {
            if (!buttonRef.current?.contains(e.target) && !popupRef.current?.contains(e.target)) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(0);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % columns.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + columns.length) % columns.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && columns[highlightedIndex]) {
                    toggleColumn(columns[highlightedIndex].key);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                buttonRef.current?.focus();
                break;
            case 'Tab':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    return (
        <div className="relative inline-block text-left whitespace-nowrap">
            <button
                ref={buttonRef}
                onClick={() => {
                    const next = !isOpen;
                    setIsOpen(next);
                    setHighlightedIndex(next ? 0 : -1);
                }}
                onKeyDown={handleKeyDown}
                className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-medium text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
                <Settings2 size={14} className="group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                <span className="hidden sm:inline">Columns</span>
            </button>
            {isOpen && createPortal(
                <div
                    ref={popupRef}
                    style={{ position: 'fixed', top: position?.top, right: position?.right, zIndex: 9999 }}
                    className="w-48 bg-white border border-gray-200 rounded-lg shadow-xl shadow-gray-200/50 py-1.5 z-[100]"
                >
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Toggle Columns</span>
                    </div>
                    {columns.map((col, idx) => {
                        const isHighlighted = highlightedIndex === idx;
                        return (
                            <button
                                key={col.key}
                                onClick={() => toggleColumn(col.key)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onMouseLeave={() => setHighlightedIndex(-1)}
                                className={`w-full px-3 py-1.5 flex items-center gap-2 text-[13px] font-medium transition-colors ${
                                    isHighlighted ? 'bg-slate-100/80 ring-1 ring-inset ring-slate-200/50 text-slate-800' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <div className={cn("w-4 h-4 rounded flex items-center justify-center transition-colors border", visibleColumns[col.key] ? "bg-primary border-primary" : "border-gray-300 bg-white")}>
                                    {visibleColumns[col.key] && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                {col.label}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

const PartyTooltip = ({ partyName }) => {
    if (!partyName || partyName === '-') return <span className="text-[11px] font-medium text-gray-400">-</span>;
    return (
        <PortalTooltip content={partyName} maxWidth={130}>
            <span className="text-[12px] font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                {partyName}
            </span>
        </PortalTooltip>
    );
};

const DescriptionTooltip = ({ description }) => {
    if (!description || description === '-') return <span className="text-[11px] font-medium text-gray-400">-</span>;
    return (
        <PortalTooltip content={description} maxWidth={250}>
            <span className="text-[11px] font-medium text-inherit hover:text-gray-900 transition-colors">
                {description}
            </span>
        </PortalTooltip>
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
    darkActiveState = false,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
  
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
  
    const selectedOption =
      options.find((opt) => opt.value === value) ||
      (showSelectAll && value === allValue
        ? { label: allDisplayLabel }
        : {
            label: placeholder || options[0]?.label,
          });
    const isTitleVar = variant === "title";
    const isSelectAllActive = value === allValue;
    const internalOptions = showSelectAll ? [{ isSelectAll: true }, ...options] : options;

    const handleKeyDown = (e) => {
      if (!isOpen) {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          setIsOpen(true);
          const idx = internalOptions.findIndex(o => o.isSelectAll ? isSelectAllActive : o.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % internalOptions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + internalOptions.length) % internalOptions.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && internalOptions[highlightedIndex]) {
            const opt = internalOptions[highlightedIndex];
            onChange(opt.isSelectAll ? allValue : opt.value);
          }
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          buttonRef.current?.focus();
          break;
        case 'Tab':
          setIsOpen(false);
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
                  const idx = internalOptions.findIndex(o => o.isSelectAll ? isSelectAllActive : o.value === value);
                  setHighlightedIndex(idx >= 0 ? idx : 0);
              } else {
                  setHighlightedIndex(-1);
              }
          }}
          onKeyDown={handleKeyDown}
          className={`group relative flex items-center justify-between gap-1 transition-colors focus:outline-none ${isTitleVar ? "px-1 py-1 text-[18px] md:text-[20px] font-extrabold text-slate-800 hover:text-primary" : `h-[32px] px-3 text-[13px] rounded-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] border focus-visible:ring-2 focus-visible:ring-blue-100 ${!isSelectAllActive ? "bg-[#F0F9FF] border-[#BAE6FD] text-[#4A8AF4] font-medium hover:bg-blue-50" : darkActiveState ? "bg-white text-slate-800 font-semibold border-gray-200 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4]" : "bg-white text-gray-600 font-medium border-gray-200 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4]"}`}`}
        >
          <div
            className={`flex items-center gap-1.5 ${!isTitleVar ? "" : "font-extrabold"}`}
          >
            <span className={!isTitleVar ? "transition-colors text-inherit" : ""}>{selectedOption?.label}</span>
          </div>
          {!hideIcon && (
            <ChevronDown
              size={isTitleVar ? 16 : 14}
              className={`transition-transform duration-200 ml-1 ${isOpen ? "rotate-180" : ""} ${isTitleVar ? "text-slate-400 group-hover:text-primary" : "text-slate-500 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]"} ${!isSelectAllActive && !isTitleVar ? "text-[#4A8AF4]" : ""}`}
            />
          )}
        </button>
  
        {isOpen &&
          dropdownPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownMenuRef}
              className="fixed bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                minWidth: dropdownPosition.minWidth,
              }}
            >
              {internalOptions.map((option, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  if (option.isSelectAll) {
                      return (
                        <div key="select-all" className="px-3 py-1.5 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              onChange(allValue);
                              setIsOpen(false);
                            }}
                            className={`group flex w-full items-center gap-1.5 text-[11px] font-bold transition-colors uppercase tracking-wider rounded-md px-2 py-1 ${isSelectAllActive ? (darkActiveState ? "text-[#2F5FC6]" : "text-[#4A8AF4]") : "text-slate-500 hover:text-slate-800"} ${isHighlighted ? 'bg-slate-200/50' : ''}`}
                          >
                            <div className="w-4 flex justify-center shrink-0">
                              <Check
                                size={14}
                                className={`${isSelectAllActive ? "text-[#4A8AF4]" : "text-slate-200 group-hover:text-slate-300"} transition-colors`}
                                strokeWidth={isSelectAllActive ? 3 : 2.5}
                              />
                            </div>
                            {selectAllLabel}
                          </button>
                        </div>
                      );
                  }

                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 transition-colors ${value === option.value || isHighlighted ? "bg-[#EEF0FC]" : "hover:bg-[#EEF0FC]"}`}
                    >
                      <span
                        className={`text-[13px] w-full flex items-center gap-2 ${value === option.value ? (darkActiveState ? "font-bold text-[#2F5FC6]" : "font-bold text-[#4A8AF4]") : isHighlighted ? "font-bold text-[#4A8AF4]" : "font-medium text-slate-700"}`}
                      >
                        <div className="w-4 flex justify-center shrink-0">
                          {value === option.value && (
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
        <span className="font-medium text-inherit">
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

    const isOutlier = context.outliers && amountVal > 0 && 
                      (amountVal >= context.outliers.upper || amountVal <= context.outliers.lower) && 
                      context.outliers.upper !== Infinity;

    // Detect if this specific transaction is part of a frequency anomaly or a duplicate collision
    const isDuplicate = context.duplicateTransactions && context.duplicateTransactions.has(data.id);
    const isFrequencyAnomaly = !isDuplicate && context.anomalousPartyDays && context.anomalousPartyDays.has(data.id);

    const baseColor = isIncome ? "text-emerald-600" : isExpense ? "text-rose-600" : "text-gray-900";

    return (
        <div className={cn(props.className, "flex items-center justify-end gap-2.5 w-full h-full")}>
            {(isOutlier || isFrequencyAnomaly || isDuplicate) && (
                <div className="group relative flex shrink-0 items-center cursor-pointer">
                    <Activity size={14} strokeWidth={2.5} className={isDuplicate ? "text-purple-500" : isFrequencyAnomaly ? "text-rose-500" : "text-amber-500"} />
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[50] scale-95 group-hover:scale-100">
                        <div className="bg-slate-800 text-white text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-md shadow-md whitespace-nowrap">
                            {isDuplicate ? "Duplicate Detected" : isFrequencyAnomaly ? "High Frequency" : (amountVal >= context.outliers?.upper ? "Highest Amount" : "Lowest Amount")}
                        </div>
                    </div>
                </div>
            )}
            <span className={cn(baseColor, "font-semibold shrink-0 tabular-nums relative text-[12px]")}>
                {context.formatCurrency ? context.formatCurrency(displayAmount) : displayAmount}
            </span>
        </div>
    );
};

const ActionCellRenderer = (props) => {
    const { data, context } = props;
    if (!data) return null;

    return (
        <div className="flex justify-end gap-1 px-1">
            <div className="relative">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (data.attachmentPath && context.setFullScreenAttachment) {
                            context.setFullScreenAttachment({ isOpen: true, path: data.attachmentPath });
                        }
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                        data.attachmentPath
                            ? "text-gray-400 hover:text-primary hover:bg-primary/5 active:scale-95"
                            : "text-gray-200 cursor-not-allowed"
                    }`}
                    title={data.attachmentPath ? "View Attachment" : "No Attachment"}
                    disabled={!data.attachmentPath}
                >
                    <Paperclip size={14} strokeWidth={2.5} />
                </button>
            </div>
            <button
                onClick={() => context.handleEdit && context.handleEdit(data)}
                disabled={!context.canEditTxn || !context.canEditTxn(data)}
                className={`p-1.5 rounded-lg transition-colors ${
                    (context.canEditTxn && context.canEditTxn(data)) ? "text-gray-400 hover:text-blue-600 hover:bg-blue-50" : "text-gray-200 cursor-not-allowed"
                }`}
                title={(context.canEditTxn && context.canEditTxn(data)) ? "Edit" : "You do not have access to edit this transaction"}
            >
                <Edit size={14} />
            </button>
            <button
                type="button"
                onClick={(e) => context.handleDelete && context.handleDelete(e, data)}
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Delete"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

const Transactions = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { selectedBranch, selectedBranchIds, branches } = useBranch();
    const { user } = useAuth();
    const { selectedYear, financialYears } = useYear();
    const { preferences, formatCurrency, formatDate, updatePreferences } = usePreferences();
    const gridRef = useRef(null);

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

    // 🔥 WebSocket Integration
    const socketBranchId = typeof selectedBranch?.id === 'number' ? selectedBranch.id : null;
    const { on } = useWebSocket(socketBranchId);

    // Toolbar States
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_TXN_COLUMNS);


    
    const colDefs = useMemo(() => {
        return [
            {
                field: 'id',
                headerName: 'Id',
                hide: !visibleColumns.id,
                minWidth: 80,
                maxWidth: 100,
                valueGetter: params => (typeof params.node?.rowIndex === 'number' ? params.node.rowIndex + 1 : '')
            },
            { field: 'party', headerName: 'Party', hide: !visibleColumns.party, minWidth: 150, cellRenderer: (params) => <PartyTooltip partyName={params.value} />, flex: 1.5, valueGetter: params => params.data?.contact || params.data?.payee || params.data?.counterpartyName || params.data?.party || '-' },
            { field: 'date', headerName: 'Date', hide: !visibleColumns.date, valueGetter: params => params.data?.txnDate, cellRenderer: DateCellRenderer, minWidth: 120, flex: 1, sort: 'desc' },
            { field: 'type', headerName: 'Type', hide: !visibleColumns.type, valueGetter: params => params.data?.transactionType?.name || params.data?.txnType || '-', minWidth: 120, flex: 1, cellRenderer: (params) => <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-gray-500">{params.value}</span> },
            { field: 'branch', headerName: 'Branch', hide: !visibleColumns.branch, cellRenderer: (params) => <BranchTooltip branchNames={params.data?.branchNames} />, minWidth: 140, flex: 1 },
            { field: 'account', headerName: 'Account', hide: !visibleColumns.account, valueGetter: params => params.data?.account?.name || '-', minWidth: 150, flex: 1, cellRenderer: (params) => <AccountNameTooltip name={params.value} /> },
            { field: 'category', headerName: 'Category', hide: !visibleColumns.category, valueGetter: params => params.data?.category?.name || '-', minWidth: 150, flex: 1, cellRenderer: (params) => <AccountNameTooltip name={params.value} /> },
            { field: 'notes', headerName: 'Notes', hide: !visibleColumns.notes, cellRenderer: (params) => <DescriptionTooltip description={params.data?.notes || params.data?.description || '-'} />, flex: 2, minWidth: 200 },
            { field: 'amount', headerName: 'Amount', hide: !visibleColumns.amount, valueGetter: params => params.data?.amountBaseCurrency ?? params.data?.amountBase ?? params.data?.finalAmountLocal ?? params.data?.amountLocal, cellRenderer: AmountCellRenderer, minWidth: 120, flex: 1, type: 'rightAligned', headerClass: 'text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-[#F9F9FB] !bg-[#F9F9FB] ag-right-aligned-header' },
            { field: 'createdBy', headerName: 'Created By', hide: !visibleColumns.createdBy, valueGetter: params => params.data?.createdByName || params.data?.createdByDisplayName || params.data?.creatorName || '-', minWidth: 130, cellClass: 'text-[11px] font-medium text-gray-400 truncate' },
            { headerName: 'Actions', field: 'actions', minWidth: 100, maxWidth: 100, cellRenderer: ActionCellRenderer, sortable: false, filter: false }
        ];
    }, [visibleColumns]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: [],
        cellClass: "text-[11px] font-medium text-gray-600 truncate",
        headerClass: "text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-[#F9F9FB] !bg-[#F9F9FB]"
    }), []);
    

    // Original state:
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const importBtnRef = useRef(null);
    const previousImportModalState = useRef(isImportModalOpen);

    useEffect(() => {
        if (previousImportModalState.current && !isImportModalOpen) {
            // Wait slightly for the modal's unmount cycle to clear out before regaining focus
            setTimeout(() => {
                importBtnRef.current?.focus({ preventScroll: true });
            }, 10);
        }
        previousImportModalState.current = isImportModalOpen;
    }, [isImportModalOpen]);
    const [activeAttachmentTxnId, setActiveAttachmentTxnId] = useState(null); // Keep for legacy if needed, but we use object now
    const [attachmentViewer, setAttachmentViewer] = useState({ isOpen: false, txnId: null, path: null, position: { top: 0, right: 0 } });
    const [fullScreenAttachment, setFullScreenAttachment] = useState({ isOpen: false, path: null });
    const isPrinting = false;
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    
    // CreateTransaction Drawer State
    const [drawerState, setDrawerState] = useState({ open: false, transaction: null });

    // Filter Logic State
    const [appliedFilters, setAppliedFilters] = useState({
        type: 'all',
        dateRange: null,
        currency: preferences?.currency || 'INR',
        party: 'all',
        accountId: searchParams.get('accountId') || null
    });
    
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
            const response = await apiService.transactions.getAll({
                branchId: 'all',
                financialYearId: selectedYear.id,
                targetCurrency: appliedFilters.currency,
                limit: -1,
                ...(appliedFilters.accountId ? { accountId: Number(appliedFilters.accountId) } : {})
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
    }, [appliedFilters.currency, appliedFilters.accountId, cacheKey, user, selectedYear?.id]);


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
    




    const groupedTransactions = useMemo(() => {
        // We bypass the global filter, so it's intrinsically ALWAYS 'multi' mode in terms of grouping logic
        const raw = Array.isArray(transactions) ? transactions : [];
        const groups = [];

        raw.forEach(txn => {
            const date = txn.txnDate ? new Date(txn.txnDate).toISOString().split('T')[0] : '';
            const amount = Number(txn.amountLocal ?? txn.amountBaseCurrency ?? txn.finalAmountLocal ?? txn.amountBase ?? 0);
            const amountKey = amount.toFixed(2);
            const party = (txn.contact || txn.payee || txn.counterpartyName || '').trim().toLowerCase();
            const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
            const notes = (txn.notes || txn.description || '').trim().toLowerCase();
            
            const dataKey = `${date}|${amountKey}|${party}|${type}|${notes}`;
            const branchName = txn.branch?.name || (branches || []).find(b => String(b.id) === String(txn.branchId))?.name || 'Unknown';
            const branchId = Number(txn.branchId || 0);

            const baseKey = `${dataKey}`;
            // Find a group with the same baseKey WHERE this branch hasn't already contributed a row
            let foundGroup = groups.find(g => g.baseKey === baseKey && !(g.groupBranchIds || []).includes(branchId));

            if (foundGroup) {
                if (!foundGroup.branchNames.includes(branchName)) {
                    foundGroup.branchNames.push(branchName);
                }
                if (!foundGroup.originalTxnIds) foundGroup.originalTxnIds = [];
                if (!foundGroup.groupBranchIds) foundGroup.groupBranchIds = [];
                foundGroup.originalTxnIds.push(txn.id);
                if (branchId) foundGroup.groupBranchIds.push(branchId);
            } else {
                const newTxn = {
                    ...txn,
                    baseKey,
                    branchNames: [branchName],
                    originalTxnIds: [txn.id],
                    groupBranchIds: branchId ? [branchId] : []
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

        // 2. Toolbar Macro Filters
        if (appliedFilters.type !== 'all') {
            result = result.filter(t => (t.transactionType?.name || t.txnType || '').toLowerCase() === appliedFilters.type);
        }

        // Time Period via DateRange
        if (appliedFilters.dateRange?.startDate) {
            const startStr = appliedFilters.dateRange.startDate;
            const endStr = appliedFilters.dateRange.endDate || startStr;
            const start = new Date(startStr).getTime();
            const end = new Date(endStr).setHours(23, 59, 59, 999);

            result = result.filter(t => {
                const tzDate = t.txnDate ? new Date(t.txnDate).getTime() : 0;
                return tzDate >= start && tzDate <= end;
            });
        }
        
        // Branch Context filtering
        if (selectedBranch?.id || (Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0)) {
            const allowed = Array.isArray(selectedBranchIds) && selectedBranchIds.length > 0
                ? selectedBranchIds.map(String)
                : [String(selectedBranch?.id)];

            if (!allowed.includes('all') && !allowed.includes('multi')) {
                result = result.filter(t => {
                    const groupBranchIds = t.groupBranchIds || t.originalBranchIds || (t.siblingMap ? Object.keys(t.siblingMap) : [t.branchId]);
                    const hasAllowedBranch = groupBranchIds.some(id => allowed.includes(String(id)));
                    return hasAllowedBranch || allowed.includes(String(t.branchId));
                });
            }
        }

        // Party Filter
        if (appliedFilters.party !== 'all') {
            result = result.filter(txn => {
                const p = (txn.contact || txn.payee || txn.counterpartyName || txn.party || '').trim();
                return p === appliedFilters.party;
            });
        }

        // 6. Explicit Account Drill-down Filter
        if (appliedFilters.accountId) {
            const isolateId = String(appliedFilters.accountId);
            result = result.filter(txn => {
                // If it explicitly maps to the primary UI fields
                if (String(txn.accountId) === isolateId || 
                    (txn.account?.id && String(txn.account.id) === isolateId) ||
                    (txn.fromAccountId && String(txn.fromAccountId) === isolateId) ||
                    (txn.toAccountId && String(txn.toAccountId) === isolateId)) {
                    return true;
                }
                
                // Deep-check the double-entry accounting array
                if (txn.entries && Array.isArray(txn.entries)) {
                    return txn.entries.some(entry => String(entry.accountId) === isolateId || String(entry.account?.id) === isolateId);
                }
                
                return false;
            });
        }

        return result;

    }, [groupedTransactions, searchTerm, appliedFilters]);

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

        filteredTransactions.forEach(t => {
            const rawDate = new Date(t.txnDate || new Date());
            const dateStr = !isNaN(rawDate) ? rawDate.toISOString().split('T')[0] : 'Unknown';
            const baseAmountVal = Number(t.amountBaseCurrency ?? t.finalAmountLocal ?? t.amountBase ?? 0);
            const localDisplayAmount = Number(t.finalAmountLocal ?? t.amountLocal ?? t.amountBase ?? 0);
            
            const rowCount = Array.isArray(t.originalTxnIds) && t.originalTxnIds.length > 0 ? t.originalTxnIds.length : 1;
            const amount = baseAmountVal * rowCount;
            
            const displayRate = localDisplayAmount > 0 ? baseAmountVal / localDisplayAmount : 1;
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
                const gstTotal = Number(t.gstTotal ?? 0) * safeDisplayRate * rowCount;
                const cgstAmount = Number(t.cgstAmount ?? 0) * safeDisplayRate * rowCount;
                const sgstAmount = Number(t.sgstAmount ?? 0) * safeDisplayRate * rowCount;
                const igstAmount = Number(t.igstAmount ?? 0) * safeDisplayRate * rowCount;

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
            .sort((a,b) => new Date(a.date) - new Date(b.date))
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

        // Outlier Detection (Z-Score Method for better small-N support)
        const parseAmount = (val) => {
            if (!val) return 0;
            const parsed = parseFloat(String(val).replace(/,/g, ''));
            return isNaN(parsed) ? 0 : Math.abs(parsed);
        };

        const amounts = filteredTransactions
            .map(t => parseAmount(t.amountBaseCurrency ?? t.amountBase ?? t.finalAmountLocal ?? t.amountLocal))
            .filter(a => a > 0);
            
        let outliers = { lower: -1, upper: Infinity }; // default to impossible bounds
        if (amounts.length >= 2) {
            const maxVal = Math.max(...amounts);
            const minVal = Math.min(...amounts);
            
            // Only flag if there is a distinct difference between values
            if (maxVal > minVal) {
                outliers = { 
                    lower: minVal, 
                    upper: maxVal 
                };
            }
        }

        // --- Frequency Anomaly Logic ---
        const partyDayCounts = {};
        filteredTransactions.forEach(t => {
            const categoryName = typeof t.category === 'object' ? t.category?.name : String(t.category || t.categoryId || '');
            const groupingKey = (t.contact || t.payee || t.counterpartyName || t.party || categoryName || '').trim();
            if (!groupingKey) return;
            const dateStr = t.date ? String(t.date).split('T')[0] : null;
            if (!dateStr) return;
            
            if (!partyDayCounts[groupingKey]) partyDayCounts[groupingKey] = { totalTx: 0, days: {} };
            if (!partyDayCounts[groupingKey].days[dateStr]) partyDayCounts[groupingKey].days[dateStr] = 0;
            partyDayCounts[groupingKey].days[dateStr]++;
            partyDayCounts[groupingKey].totalTx++;
        });

        const anomalousPartyDays = new Set();
        Object.entries(partyDayCounts).forEach(([party, data]) => {
            const uniqueDays = Object.keys(data.days).length;
            if (uniqueDays > 0) { 
                const avgPerDay = data.totalTx / uniqueDays;
                Object.entries(data.days).forEach(([day, count]) => {
                    // Flag as anomaly if there are 3+ transactions on a single day,
                    // AND it's strictly > 2.5x the average daily rate.
                    if (count >= 3 && count > 2.5 * avgPerDay) {
                        anomalousPartyDays.add(`${party}|${day}`);
                    }
                });
            }
        });
        // -------------------------------

        // --- Duplicate Transaction Anomaly ---
        const duplicateTransactions = new Set();
        const transactionFingerprints = new Map();
        
        filteredTransactions.forEach(t => {
            const categoryName = typeof t.category === 'object' ? t.category?.name : String(t.category || t.categoryId || '');
            const partyKey = (t.contact || t.payee || t.counterpartyName || t.party || '').trim();
            
            const rawDate = t.txnDate || t.date;
            const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : null;
            
            const amountVal = parseAmount(t.amountBaseCurrency ?? t.amountBase ?? t.finalAmountLocal ?? t.amountLocal);
            const branchName = Array.isArray(t.branchNames) && t.branchNames.length > 0 
                ? t.branchNames[0] 
                : (typeof t.branch === 'object' ? t.branch?.name : String(t.branch || ''));
            
            if (dateStr && amountVal > 0) {
                const fingerprint = `${dateStr}|${amountVal}|${partyKey}|${categoryName}|${branchName}`;
                if (!transactionFingerprints.has(fingerprint)) {
                    transactionFingerprints.set(fingerprint, [t.id]);
                } else {
                    transactionFingerprints.get(fingerprint).push(t.id);
                }
            }
        });

        transactionFingerprints.forEach((ids) => {
            if (ids.length > 1) {
                ids.forEach(id => duplicateTransactions.add(id));
            }
        });
        // ------------------------------------

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
            outliers,
            anomalousPartyDays,
            duplicateTransactions,
            netFlow: totalIncome - totalExpense
        };
    }, [filteredTransactions]);

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
        const arr = Array.from(uniqueSet).sort((a,b) => a.localeCompare(b));
        return arr.map(p => ({ label: p, value: p }));
    }, [transactions]);

    const buildExportPayload = (format) => {
        const normalizedBranchIds = Array.isArray(selectedBranchIds)
            ? selectedBranchIds.map(Number).filter(Boolean)
            : [];

        const exportBranchId = normalizedBranchIds.length > 1
            ? normalizedBranchIds
            : normalizedBranchIds.length === 1
                ? normalizedBranchIds[0]
                : selectedBranch?.id
                    ? Number(selectedBranch.id)
                    : 'all';

        let mappedRows = undefined;
        if (gridRef.current?.api) {
            mappedRows = [];
            gridRef.current.api.forEachNodeAfterFilterAndSort(node => {
                const d = node.data;
                if (!d) return;

                mappedRows.push({
                    id: d.id,
                    name: d.name || '',
                    txnDate: d.txnDate || null,
                    txnType: (d.transactionType?.name || d.txnType || '').toLowerCase(),
                    status: d.status ?? null,
                    contact: d.contact || d.payee || d.counterpartyName || d.party || '',
                    accountName: d.account?.name || '-',
                    categoryName: d.category?.name || '-',
                    notes: d.notes || d.description || '',
                    amount: Number(d.amountLocal ?? d.amountBaseCurrency ?? d.finalAmountLocal ?? d.amountBase ?? 0),
                    branchNames: Array.isArray(d.groupBranchIds) 
                        ? d.groupBranchIds.map(id => branches?.find(b => String(b.id) === String(id))?.name || 'Unknown')
                        : (d.branch?.name ? [d.branch.name] : ['Unknown']),
                    createdByName: d.createdByName || d.createdByDisplayName || d.creatorName || '-'
                });
            });
        }

        const normalizedAppliedFilters = {
            ...(appliedFilters.type !== 'all' ? { scope: appliedFilters.type } : {}),
            ...(appliedFilters.party !== 'all' ? { payee: appliedFilters.party } : {}),
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
            appliedFilters: normalizedAppliedFilters,
            mappedRows,
            visibleColumns: Object.keys(visibleColumns).filter(k => visibleColumns[k])
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
    const handleExportExcel = async () => {
        try {
            const response = await apiService.transactions.export(buildExportPayload('xlsx'));
            const exportData = response?.data || response;
            const base64Content = exportData?.fileContent;
            const fileName = exportData?.fileName || `transactions-${new Date().toISOString().split('T')[0]}.xlsx`;
            const mimeType = exportData?.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            if (!base64Content) throw new Error('Missing export file content');

            const binaryString = window.atob(base64Content);
            const fileBytes = new Uint8Array(binaryString.length);
            for (let index = 0; index < binaryString.length; index += 1) {
                fileBytes[index] = binaryString.charCodeAt(index);
            }

            downloadExportFile(fileBytes, fileName, mimeType);
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to export to Excel';
            console.error('Excel export failed:', error);
            alert(message);
        }
    };

    const handleExportPDF = async () => {
        try {
            const response = await apiService.transactions.export(buildExportPayload('pdf'), {
                responseType: 'blob'
            });

            const textResponse = await response.data.text();
            // The backend HTML includes a <script> that auto-prints. We strip it here to avoid double print dialogs.
            const cleanHtml = textResponse.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            iframe.contentDocument.open();
            iframe.contentDocument.write(cleanHtml);
            iframe.contentDocument.close();

            // Wait a tiny bit for the browser to render the written HTML
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                
                // Cleanup after a delay to allow the print dialog to appear
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 10000);
            }, 500);
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
            ids: txn.originalTxnIds?.length > 0 ? txn.originalTxnIds : [txn.id],
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
        if (!deleteDialog.id && (!deleteDialog.ids || deleteDialog.ids.length === 0)) return;

        setDeleteDialog((current) => ({ ...current, loading: true }));

        try {
            const idsToDelete = deleteDialog.ids?.length > 0 ? deleteDialog.ids : [deleteDialog.id];
            await Promise.all(idsToDelete.map(id => apiService.transactions.delete(id)));
            notifyTransactionDataChanged();
            await fetchTransactions();
            setDeleteDialog(createInitialDeleteDialog());
        } catch (error) {
            console.error("Failed to delete transaction(s):", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete transaction(s)";
            alert(msg);
            setDeleteDialog((current) => ({ ...current, loading: false }));
        }
    };

    // Global Escape Key Listener to focus Sidebar Navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Prevent intercepting if they are actively working in an open modal
            if (e.key === 'Escape') {
                if (isImportModalOpen || deleteDialog.open || drawerState.open || attachmentViewer.isOpen || fullScreenAttachment.isOpen) {
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
    }, [isImportModalOpen, deleteDialog.open, drawerState.open, attachmentViewer.isOpen, fullScreenAttachment.isOpen]);

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
    

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">

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
                        tabs={transactionTabs}
                        activeTab="transactions"
                    />
                )}
                className="flex-1 flex flex-col min-h-0 lg:overflow-y-auto"
                contentClassName="p-0 lg:p-0 lg:overflow-visible"
                cardClassName="border-none shadow-none rounded-none overflow-visible lg:overflow-visible bg-transparent lg:max-h-none"
            >
                <div className="flex flex-col min-h-full h-auto">

                {/* Print Only Header */}
                <div className="hidden print:block text-center py-6 mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">Transactions List</h1>
                </div>

                {/* Global Filters Row */}
                <div className="px-5 pt-3 pb-1.5 flex flex-wrap items-center gap-3 print:hidden relative z-20 w-full bg-transparent">
                    <DateRangePicker 
                        startDate={appliedFilters.dateRange?.startDate}
                        endDate={appliedFilters.dateRange?.endDate}
                        selectedPreset={appliedFilters.dateRange?.preset}
                        presetOptions={datePresets}
                        onApplyRange={(range) => setAppliedFilters(prev => ({ ...prev, dateRange: range }))}
                        className="h-[32px]"
                    />
                    
                    <BranchSelector hideSettings={true} />

                    <CurrencySelector 
                        value={appliedFilters.currency}
                        onChange={(val) => {
                            setAppliedFilters(prev => ({ ...prev, currency: val }));
                            updatePreferences({ currency: val });
                        }}
                    />

                    <FilterDropdown
                        value={appliedFilters.party}
                        onChange={(val) => setAppliedFilters(prev => ({ ...prev, party: val }))}
                        placeholder="Party"
                        options={availableParties}
                        showSelectAll
                        selectAllLabel="Select All"
                        allDisplayLabel="All Parties"
                        darkActiveState={true}
                    />
                </div>

                {appliedFilters.accountId && (
                    <div className="px-5 pb-2 text-xs print:hidden animate-in fade-in duration-300">
                        <span className="inline-flex items-center gap-1.5 bg-[#EEF0FC] text-[#4A8AF4] px-2.5 py-1 rounded-md font-semibold border border-[#D5DDFB]">
                            Isolated Account View
                            <button 
                                onClick={() => {
                                    setAppliedFilters(p => ({ ...p, accountId: null }));
                                    // Remove from URL gracefully
                                    const params = new URLSearchParams(searchParams);
                                    params.delete('accountId');
                                    navigate(`?${params.toString()}`, { replace: true });
                                }} 
                                className="hover:text-blue-900 ml-1 focus:outline-none"
                            >
                                <X size={12} className="stroke-[3px]" />
                            </button>
                        </span>
                    </div>
                )}

                {/* Always-Visible KPI Strip & Conditionally Visible Charts */}
                <div className="px-5 pt-2 pb-0 w-full animate-in fade-in duration-300 relative z-10">
                    <div className="px-2 py-2">
                        {/* Metrics Row */}
                        <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg border border-white/60 bg-emerald-50 flex items-center justify-center shrink-0">
                                    <ArrowDownLeft size={16} className="text-emerald-600" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-gray-500 mb-0.5">Total Inflow</div>
                                    <div className="text-[17px] font-bold text-gray-800 tracking-tight whitespace-nowrap">{formatCurrency(insightsData.totalIncome)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg border border-white/60 bg-rose-50 flex items-center justify-center shrink-0">
                                    <ArrowUpRight size={16} className="text-rose-600" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-gray-500 mb-0.5">Total Outflow</div>
                                    <div className="text-[17px] font-bold text-gray-800 tracking-tight whitespace-nowrap">{formatCurrency(insightsData.totalExpense)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={cn("w-9 h-9 rounded-lg border border-white/60 flex items-center justify-center shrink-0", insightsData.netFlow >= 0 ? "bg-primary/10" : "bg-red-50")}>
                                    <Activity size={16} className={insightsData.netFlow >= 0 ? "text-primary" : "text-red-600"} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-gray-500 mb-0.5">Net Flow</div>
                                    <div className={cn("text-[17px] font-bold tracking-tight whitespace-nowrap", insightsData.netFlow >= 0 ? "text-primary" : "text-red-600")}>
                                        {formatCurrency(insightsData.netFlow)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Toggle */}
                        <div className="mt-4 border-t border-gray-50 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setIsInsightsExpanded(!isInsightsExpanded)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md -ml-2 text-[12px] font-semibold text-primary outline-none focus:bg-[#F0F9FF] focus:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:text-[#4A8AF4] transition-all"
                            >
                                <TrendingUp size={14} />
                                {isInsightsExpanded ? "Hide Charts" : "Show Charts"}
                                {isInsightsExpanded ? (
                                    <ChevronUp size={14} />
                                ) : (
                                    <ChevronDown size={14} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Charts Area */}
                    {isInsightsExpanded && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 pb-6 border-b border-gray-200 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="lg:col-span-4">
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

                            <div className="lg:col-span-4">
                                <h3 className="text-[13px] font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <FileText size={14} className="text-indigo-600" /> GST Paid Trend
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
                                                                        <span className="text-[13px] font-medium text-gray-600">GST Paid:</span>
                                                                        <span className="text-[14px] font-bold text-indigo-600">{formatCurrency(payload[0].value)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="gstPaid" name="GST Paid" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-[12px] font-medium text-gray-400 gap-2">
                                            <FileText size={24} className="text-gray-200" />
                                            <span>No GST paid in this view</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="lg:col-span-4">
                                <h3 className="text-[13px] font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <PieChartIcon size={14} className="text-primary" /> Top Expense Categories
                                </h3>
                                <div className="h-[220px] w-full flex items-center justify-center relative">
                                    {insightsData.categoryData.length > 0 ? (
                                        <React.Fragment>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={insightsData.categoryData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {insightsData.categoryData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-white border border-gray-100 px-3 py-2 rounded-lg shadow-xl shadow-gray-200/50">
                                                                        <div className="text-[11px] font-bold text-gray-500 mb-1">{payload[0].name}</div>
                                                                        <div className="text-[13px] font-bold text-rose-600">{formatCurrency(payload[0].value)}</div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            
                                            {/* Custom Legend / Summary */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Top 5</div>
                                                <div className="text-[14px] font-extrabold text-gray-900 leading-tight">
                                                    {formatCurrency(insightsData.categoryData.reduce((acc, curr) => acc + curr.value, 0))}
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ) : (
                                        <div className="text-[12px] font-medium text-gray-400 text-center flex flex-col items-center gap-2">
                                            <PieChartIcon size={24} className="text-gray-200" />
                                            <span>No expenses logged for this view</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom List Header (Table Actions) */}
                <div className="px-5 pb-4 pt-1.5 flex flex-col xl:flex-row xl:items-center justify-between print:hidden gap-4 relative z-10 w-full">
                    {/* LEFT SIDE: Search & Primary Action */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="relative group w-full sm:w-[240px]">
                                <Search
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 group-focus-within:text-blue-600 transition-colors"
                                />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search"
                                    className="w-full pl-8 pr-3 h-[32px] bg-white border border-gray-200 rounded-md text-[13px] font-medium placeholder:text-gray-400 placeholder:transition-colors group-hover:placeholder:text-blue-400 hover:border-blue-300 hover:bg-[#F0F9FF] focus:bg-[#F0F9FF] focus:border-blue-400 focus:placeholder:text-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                />
                            </div>

                            <button
                                onClick={() => fetchTransactions()}
                                className="w-[32px] h-[32px] shrink-0 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                                title="Refresh table data"
                            >
                                <RefreshCcw
                                    size={14}
                                    strokeWidth={2}
                                    className={cn(loading && "animate-spin text-primary")}
                                />
                            </button>

                        </div>
                    </div>

                    {/* RIGHT SIDE: Import / Export / View Controls */}
                    <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2 w-full xl:w-auto">
                        <button
                            ref={importBtnRef}
                            onClick={() => setIsImportModalOpen(true)}
                            className="h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-medium text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        >
                            <FileSpreadsheet size={14} className="text-emerald-600" />
                            <span className="hidden sm:inline">Import</span>
                        </button>

                        <div className="flex border border-gray-200 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-white divide-x divide-gray-200 shrink-0">
                            <button
                                onClick={handleExportExcel}
                                className="group h-[32px] px-3 flex items-center gap-1.5 justify-center text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-medium text-[13px] rounded-l-md"
                                title="Export to Excel"
                            >
                                <Download size={14} className="group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                                <span className="hidden sm:inline">Excel</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="group h-[32px] px-3 flex items-center gap-1.5 justify-center text-gray-600 hover:text-rose-600 hover:bg-rose-50 focus:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-100 transition-all font-medium text-[13px] rounded-r-md"
                                title="Export to PDF"
                            >
                                <FileText size={14} className="group-hover:text-rose-500 group-focus-visible:text-rose-500 transition-colors" />
                                <span className="hidden sm:inline">PDF</span>
                            </button>
                        </div>

                        
                        <FilterDropdown
                            value={appliedFilters.type}
                            onChange={(val) => setAppliedFilters(prev => ({ ...prev, type: val }))}
                            placeholder="Type"
                            options={[
                                { label: "All Types", value: "all" },
                                { label: "Income", value: "income" },
                                { label: "Expense", value: "expense" },
                                { label: "Transfer", value: "transfer" },
                                { label: "Investment", value: "investment" },
                            ]}
                        />
                        
                        <ColumnVisibilityDropdown 
                            columns={TXN_TABLE_COLUMNS}
                            visibleColumns={visibleColumns}
                            setVisibleColumns={setVisibleColumns}
                        />

                        <button
                            onClick={() => setDrawerState({ open: true, transaction: null })}
                            className="group w-[32px] h-[32px] flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                            title="Add Transaction"
                        >
                            <Plus size={16} strokeWidth={2.5} className="group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                        </button>
                    </div>
                </div>

                <div className="w-full px-5 pb-8 relative" aria-busy={loading}>
                    <div 
                        style={{ height: "600px", width: "100%" }} 
                        className={`border border-gray-200 rounded-lg overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}
                    >
                            <AgGridReact
                                ref={gridRef}
                                theme={themeQuartz}
                                rowData={filteredTransactions}
                                columnDefs={colDefs}
                                defaultColDef={defaultColDef}
                                rowSelection="multiple"
                                rowHeight={42}
                                headerHeight={44}
                                animateRows={true}
                                pagination={true}
                                paginationPageSize={50}
                                paginationPageSizeSelector={[25, 50, 100, 200]}
                                context={{
                                    handleEdit,
                                    handleDelete,
                                    canEditTxn,
                                    setFullScreenAttachment,
                                    formatCurrency,
                                    formatDate,
                                    outliers: insightsData.outliers,
                                    anomalousPartyDays: insightsData.anomalousPartyDays,
                                    duplicateTransactions: insightsData.duplicateTransactions
                                }}
                                overlayNoRowsTemplate={
                                    loading ? '<span class="ag-overlay-loading-center text-primary font-medium text-sm">Loading transactions...</span>' : '<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No transactions found</span>'
                                }
                            />
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
