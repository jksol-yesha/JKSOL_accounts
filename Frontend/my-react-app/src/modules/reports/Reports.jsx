import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Filter,
    ArrowUpCircle,
    ArrowDownCircle,
    PieChart,
    Wallet,
    Printer,
    Search,
    ChevronRight,
    BarChart3,
    TrendingUp,
    ChevronDown,
    Download,
    X,
    RefreshCw
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import CustomSelect from '../../components/common/CustomSelect';
import StatCard from '../dashboard/components/StatCard';
import { cn } from '../../utils/cn';
import { getTransactions, getCategories, getAccounts } from '../../utils/storage';
import ReportTableScreen from './components/ReportTableScreen';
import ReportTablePrint from './components/ReportTablePrint';
import DateRangePicker from '../../components/common/DateRangePicker';
import { usePreferences } from '../../context/PreferenceContext';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';

const Reports = () => {
    const { formatCurrency, preferences } = usePreferences();
    const { selectedBranch } = useBranch();
    const { selectedOrg, loading: orgLoading } = useOrganization();
    const { user } = useAuth();
    // State for filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: 'All Types',
        category: 'All Categories',
        account: 'All Accounts',
        party: 'All Parties',
        reportType: 'Summary'
    });

    // Refs for keyboard navigation
    const dateRangeRef = useRef(null);
    const typeRef = useRef(null);
    const categoryRef = useRef(null);
    const accountRef = useRef(null);
    const partyRef = useRef(null);
    const reportTypeRef = useRef(null);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isPrinting, setIsPrinting] = useState(false);

    // Data state
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [parties, setParties] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [isGenerated, setIsGenerated] = useState(false);

    const getDefaultDateRange = () => {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        return { firstDay, lastDay };
    };

    // Set default date range once
    useEffect(() => {
        const { firstDay, lastDay } = getDefaultDateRange();
        setFilters(prev => ({
            ...prev,
            startDate: firstDay,
            endDate: lastDay
        }));
    }, []);

    // Load initial filter data when branch context changes
    useEffect(() => {
        // Avoid fetching before org context is ready; otherwise we can cache empty results.
        if (orgLoading || !selectedOrg?.id) return;

        const branchFilter = (user?.role === 'member' || user?.role === 'owner') ? 'all' : (selectedBranch?.id || 'all');

        const controller = new AbortController();

        const extractList = (response) => {
            if (Array.isArray(response)) return response;
            if (Array.isArray(response?.data)) return response.data;
            if (Array.isArray(response?.data?.data)) return response.data.data;
            if (Array.isArray(response?.list)) return response.list;
            return [];
        };

        const fetchInitialData = async () => {
            try {
                if (!branchFilter) {
                    setCategories([]);
                    setAccounts([]);
                    setParties([]);
                    return;
                }

                const params = { branchId: branchFilter };
                const [catResponse, accResponse, partyResponse] = await Promise.all([
                    apiService.categories.getAll(params, { signal: controller.signal }),
                    apiService.accounts.getAll(params, { signal: controller.signal }),
                    apiService.parties.getAll(params, { signal: controller.signal }),
                ]);

                if (controller.signal.aborted) return;

                const categoryList = extractList(catResponse);
                setCategories(Array.isArray(categoryList) ? categoryList : []);

                const accountList = extractList(accResponse);
                setAccounts(Array.isArray(accountList) ? accountList : []);

                const partyList = extractList(partyResponse);
                setParties(Array.isArray(partyList) ? partyList : []);
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch initial data:", error);
            }
        };

        fetchInitialData();
        return () => controller.abort();
    }, [selectedOrg?.id, orgLoading]);

    // Filter Categories and Accounts based on Type
    const filteredCategories = useMemo(() => {
        if (filters.type === 'All Types') return categories;
        return categories.filter(c => {
            // Check all possible field names for type and normalization
            const type = c.txn_type || c.txnType || c.type;
            return type && type.trim().toLowerCase() === filters.type.trim().toLowerCase();
        });
    }, [categories, filters.type]);

    const categoryDropdownOptions = useMemo(() => {
        const seen = new Map();
        filteredCategories.forEach((c) => {
            const name = (c?.name || '').toString().trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!seen.has(key)) seen.set(key, name);
        });
        return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    }, [filteredCategories]);

    const partyDropdownOptions = useMemo(() => {
        const seen = new Map();
        parties.forEach((p) => {
            const name = (p?.name || '').toString().trim();
            if (!name || name === '-') return;
            const key = name.toLowerCase();
            if (!seen.has(key)) seen.set(key, name);
        });
        return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    }, [parties]);

    // Reset filters when Type changes
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            category: 'All Categories',
            // We might want to reset account too if needed, but accounts aren't strictly typed in storage yet
        }));
    }, [filters.type]);


    // Reset UI
    useEffect(() => {
        setReportData(null);
        setIsGenerated(false);
        setSearchTerm('');
        setCurrentPage(1);
    }, [filters.reportType]);


    // Auto-refresh when currency preference changes
    useEffect(() => {
        // console.log("Currency changed to:", preferences.currency, "isGenerated:", isGenerated);
        if (isGenerated) {
            handleGenerateReport();
        }
    }, [preferences.currency]);

    // Print Handler Effect
    useEffect(() => {
        if (isPrinting) {
            const timer = setTimeout(() => {
                window.print();
                setIsPrinting(false);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isPrinting]);

    const handleGenerateReport = async () => {
        // console.log("Generating Report... Prefs:", preferences);
        const branchFilter = (user?.role === 'member' || user?.role === 'owner') ? 'all' : (selectedBranch?.id || 'all');

        const { firstDay, lastDay } = getDefaultDateRange();
        const startDate = filters.startDate || firstDay;
        const endDate = filters.endDate || lastDay;
        const selectedReportType = filters.reportType || 'Summary';
        const reportType = selectedReportType === 'P/L' ? 'Profit/Loss' : selectedReportType;

        try {
            // Map frontend filters to API params
            let txnType = undefined;
            let categoryId = undefined;
            let accountId = undefined;
            let party = undefined;

            if (filters.type !== 'All Types') txnType = filters.type;

            if (filters.category !== 'All Categories') {
                const match = categories.find(c => c.name === filters.category);
                if (match) categoryId = match.id;
            }

            if (filters.account !== 'All Accounts') {
                const match = accounts.find(a => (a.bankName || a.name) === filters.account);
                if (match) accountId = match.id;
            }
            if (filters.party !== 'All Parties') {
                party = filters.party;
            }

            const params = {
                branchId: branchFilter,
                startDate,
                endDate,
                type: reportType, // Backend expects canonical report labels
                txnType,
                categoryId,
                accountId,
                party,
                targetCurrency: preferences?.currency // Pass user preferred currency
            };

            // console.log("Calling API with Params:", params);
            const response = await apiService.reports.get(params);
            // console.log("API Response Success:", response.success);

            if (response.success) {
                let data = response.data;

                // Helper to map transaction items
                const mapTransaction = (item) => ({
                    ...item,
                    date: item.txnDate || item.date,
                    type: item.txnType ? item.txnType.charAt(0).toUpperCase() + item.txnType.slice(1) : (item.type || '-'),
                    amount: item.amountBase ?? item.amountLocal ?? item.amount, // Strict null check to prefer Base
                    method: item.account?.name || (typeof item.account === 'string' ? item.account : '-') || item.method || '-'
                });

                if (filters.reportType === 'Summary' && data.tableData) {
                    data.tableData = data.tableData.map(mapTransaction);
                } else if (filters.reportType === 'Detailed' && data.tableData) {
                    data.tableData = data.tableData.map(mapTransaction);
                } else if (filters.reportType === 'Debit/Credit' && data.tableData) {
                    // Ledger uses 'data' from backend but controller maps it to 'tableData'
                    // Ledger items have 'debit', 'credit', 'balance', 'txnDate'
                    data.tableData = data.tableData.map(item => ({
                        ...item,
                        date: item.txnDate || item.date,
                        // Amount/Type not strictly needed for ledger view columns (Debit/Credit columns used)
                    }));
                } else if ((filters.reportType === 'P/L' || filters.reportType === 'Profit/Loss' || filters.reportType === 'Profit & Loss')) {
                    const income = Array.isArray(data.income) ? data.income : [];
                    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
                    const flatten = (section, groups) => groups.flatMap(group =>
                        (group.items || []).map(item => ({
                            section,
                            category: group.category,
                            subCategory: item.subCategory,
                            account: item.account,
                            amount: Number(item.amount || 0)
                        }))
                    );

                    data = {
                        ...data,
                        type: 'profit-loss',
                        income,
                        expenses,
                        summary: {
                            ...data.summary,
                            totalIncome: Number(data?.summary?.totalIncome ?? data?.summary?.income ?? 0),
                            totalExpense: Number(data?.summary?.totalExpense ?? data?.summary?.expense ?? 0),
                            netProfit: Number(data?.summary?.netProfit ?? data?.summary?.net ?? 0),
                            income: Number(data?.summary?.totalIncome ?? data?.summary?.income ?? 0),
                            expense: Number(data?.summary?.totalExpense ?? data?.summary?.expense ?? 0),
                            net: Number(data?.summary?.netProfit ?? data?.summary?.net ?? 0),
                        },
                        tableData: [...flatten('income', income), ...flatten('expense', expenses)]
                    };
                }

                setReportData(data);
                setIsGenerated(true);
            } else {
                const message = response?.message || "Failed to generate report";
                console.error("Report generation returned failure:", message, response);
                alert(message);
            }
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to generate report";
            console.error("Report generation failed:", error);
            alert(message);
        }
    };

    const handleKeyDown = useFormNavigation([dateRangeRef, typeRef, categoryRef, accountRef, partyRef, reportTypeRef], handleGenerateReport);

    const handleResetFilters = () => {
        const { firstDay, lastDay } = getDefaultDateRange();
        setFilters({
            startDate: firstDay,
            endDate: lastDay,
            type: 'All Types',
            category: 'All Categories',
            account: 'All Accounts',
            party: 'All Parties',
            reportType: 'Summary'
        });
        setReportData(null);
        setIsGenerated(false);
        setSearchTerm('');
        setCurrentPage(1);
        setPageSize(10);
    };

    // Helper to resolve Category Name safely
    const resolveCategoryName = (item) => {
        if (filters.reportType === 'Category-wise') return item.name;

        let val = item.category;
        if (!val) return null;
        if (typeof val === 'object') return val.name;

        // If string, try to find in loaded categories
        const match = categories.find(c => c.id === val || c.name === val);
        return match ? match.name : val;
    };

    const hasValidCategory = (item) => {
        const name = (resolveCategoryName(item) || '').toString().trim();
        return Boolean(name && name !== '-');
    };

    // Helper to resolve Account Name safely
    const resolveAccountName = (item) => {
        if (filters.reportType === 'Account-wise') return item.name;

        let val = item.account || item.method;
        if (!val) return null;
        if (typeof val === 'object') return val.name || val.bankName;

        // If string, try to find in loaded accounts
        const match = accounts.find(a => a.id === val || a.bankName === val);
        return match ? match.bankName : val;
    };

    // Derived Unique Options from Data
    const uniqueOptions = useMemo(() => {
        if (!reportData || !reportData.tableData) return { types: [], categories: [], accounts: [], parties: [] };

        const types = new Set();
        const cats = new Map();
        const accs = new Map();
        const partySet = new Map();

        reportData.tableData.forEach(item => {
            // Type
            const t = item.type || item.txnType;
            if (t) types.add(t);

            // Check if item matches current Type Filter for dependent dropdowns
            const typeMatch = filters.type === 'All Types' || (t && t.toLowerCase() === filters.type.toLowerCase());

            if (typeMatch) {
                // Category
                const c = resolveCategoryName(item);
                if (c && String(c).trim() !== '-') {
                    const label = String(c).trim();
                    const key = label.toLowerCase();
                    if (!cats.has(key)) cats.set(key, label);
                }

                // Account
                const a = resolveAccountName(item);
                if (a) {
                    const label = String(a).trim();
                    const key = label.toLowerCase();
                    if (label && !accs.has(key)) accs.set(key, label);
                }

                const p = (item.party || item.contact || '').toString().trim();
                if (p && p !== '-') {
                    const key = p.toLowerCase();
                    if (!partySet.has(key)) partySet.set(key, p);
                }
            }
        });

        return {
            types: Array.from(types).sort(),
            categories: Array.from(cats.values()).sort((a, b) => a.localeCompare(b)),
            accounts: Array.from(accs.values()).sort((a, b) => a.localeCompare(b)),
            parties: Array.from(partySet.values()).sort((a, b) => a.localeCompare(b))
        };
    }, [reportData, filters.type, categories, accounts, filters.reportType]);

    const typeFilterOptions = useMemo(() => {
        const baseTypes = ['Income', 'Expense', 'Transfer', 'Investment', 'Borrow', 'Lend'];
        const dynamicTypes = (uniqueOptions.types || [])
            .map((t) => (t || '').toString().trim())
            .filter(Boolean);

        const seen = new Set();
        const merged = [];

        [...baseTypes, ...dynamicTypes].forEach((type) => {
            const key = type.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(type);
        });

        return merged;
    }, [uniqueOptions.types]);

    // Filtered Report Data (Client-side Search only)
    const filteredReportData = useMemo(() => {
        if (!reportData || !reportData.tableData) return null;

        // Server-side filtering is now in place for Type, Category, and Account.
        // We only need to handle Search here if we want strictly local searching only.

        let data = [...reportData.tableData];

        if (reportData.type === 'categories') {
            data = data.filter(hasValidCategory);
        }

        // We DO NOT filter by Type, Category, Account here anymore 
        // because the API returns filtered data. 
        // Applying client-side filter broke Category/Account views 
        // because they don't have 'type' fields etc.

        return { ...reportData, tableData: data };
    }, [reportData, categories, filters.reportType]);

    const { paginatedData, totalPages, totalItems } = useMemo(() => {
        if (!filteredReportData || !filteredReportData.tableData) return { paginatedData: [], totalPages: 0, totalItems: 0 };

        let data = [...filteredReportData.tableData];

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item => {
                if (filteredReportData.type === 'transactions' || filteredReportData.type === 'ledger') {
                    const categoryText = typeof item.category === 'object' && item.category !== null
                        ? (item.category.name || '')
                        : (item.category || '');
                    return (item.description || '').toLowerCase().includes(lower) ||
                        String(categoryText).toLowerCase().includes(lower) ||
                        (item.party || item.contact || '').toLowerCase().includes(lower);
                } else if (filteredReportData.type === 'categories' || filteredReportData.type === 'accounts') {
                    return (item.name || '').toLowerCase().includes(lower);
                } else if (filteredReportData.type === 'profit-loss') {
                    return (item.name || '').toLowerCase().includes(lower) ||
                        (item.type || '').toLowerCase().includes(lower);
                }
                return false;
            });
        }

        const totalItems = data.length;
        const currentSize = isPrinting ? totalItems : pageSize;
        const totalPages = Math.ceil(totalItems / currentSize);
        const startIndex = (currentPage - 1) * currentSize;
        const section = data.slice(startIndex, startIndex + currentSize);

        return { paginatedData: section, totalPages, totalItems };
    }, [filteredReportData, searchTerm, currentPage, pageSize, isPrinting]);

    const netProfit = useMemo(() => {
        if (!reportData?.summary) return 0;
        const income = Number(reportData.summary.income) || 0;
        const expense = Number(reportData.summary.expense) || 0;
        return income - expense;
    }, [reportData]);

    const selectedPeriodLabel = useMemo(() => {
        const formatPeriodDate = (value) => {
            if (!value) return '';
            const [year, month, day] = String(value).split('-').map(Number);
            if (!year || !month || !day) return '';
            const date = new Date(year, month - 1, day);
            return new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).format(date);
        };

        if (filters.startDate && filters.endDate) {
            return `${formatPeriodDate(filters.startDate)} to ${formatPeriodDate(filters.endDate)}`;
        }
        return 'Selected Period';
    }, [filters.startDate, filters.endDate]);

    return (
        <div className="flex flex-col min-h-full">
            {/* Print Styles */}
            <style>{`
                @media print {
                    @page { margin: 12mm; size: landscape; }
                    body { -webkit-print-color-adjust: exact; background: white !important; }
                    
                    /* Global Hide of App Shell Elements */
                    nav, aside, header, footer, .sidebar, .page-header {
                        display: none !important;
                    }

                    /* Content Hiding Classes */
                    .no-print, .report-filters, .stat-cards, .table-toolbar, .pagination-footer, .mobile-card-view, .search-bar, .action-buttons {
                        display: none !important;
                    }

                    /* Print Visibility Enforcers */
                    .print-only { display: block !important; }
                    .desktop-table-view { display: block !important; max-height: none !important; overflow: visible !important; }

                    /* Reset Main Contsiners layout for Print flow */
                    body, #root, main, .min-h-screen, .h-screen, .flex, .flex-col, .flex-1, .w-full {
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* Table Styling */
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-family: 'Inter', sans-serif; font-size: 10px; table-layout: fixed; }
                    thead { display: table-header-group; }
                    tbody { display: table-row-group; }
                    tfoot { display: table-row-group; }
                    tr { break-inside: avoid; }
                    th { 
                        text-align: left;
                        padding: 12px 8px;
                        font-weight: 700;
                        color: #000 !important;
                        text-transform: uppercase;
                        font-size: 8px;
                        letter-spacing: 1px;
                        white-space: nowrap;
                    }
                    td { 
                        padding: 12px 8px;
                        color: #111 !important;
                        vertical-align: middle;
                        font-size: 9px;
                        word-wrap: break-word;
                    }

                    
                    .card-styles { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
                }
                .print-only { display: none; }
            `}</style>
            {!isPrinting && (
                <>
                    <div className="no-print page-header flex-none">
                        <PageHeader
                            title="Financial Reports"
                            breadcrumbs={['Portal', 'Reports']}
                        />
                    </div>

                    <div className="reports-tablet-page flex-1 p-4 xl:p-8 space-y-6 animate-in fade-in duration-500 print:hidden">
                        {/* Filters Section */}
                        <Card noPadding className="reports-tablet-filters-card border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 xl:p-6 no-print report-filters overflow-visible">
                            <div className="flex items-center gap-2 mb-4 xl:mb-6">
                                <Filter size={16} className="text-primary" />
                                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Report Filters</h2>
                            </div>
                            <div className="reports-tablet-filter-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 xl:gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Date Range</label>
                                    <DateRangePicker
                                        ref={dateRangeRef}
                                        startDate={filters.startDate}
                                        endDate={filters.endDate}
                                        onChange={(range) => setFilters({ ...filters, ...range })}
                                        onKeyDown={(e) => handleKeyDown(e, 0)}
                                        className="reports-tablet-filter-input w-full"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Type</label>
                                    <CustomSelect
                                        ref={typeRef}
                                        value={filters.type}
                                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, 1)}
                                        className="reports-tablet-filter-input w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                                    >
                                        <option value="All Types">All Types</option>
                                        {typeFilterOptions.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Category</label>
                                    <CustomSelect
                                        ref={categoryRef}
                                        value={filters.category}
                                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, 2)}
                                        className="reports-tablet-filter-input w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                                    >
                                        <option value="All Categories">All Categories</option>
                                        {uniqueOptions.categories.length > 0 ? (
                                            uniqueOptions.categories.map(c => <option key={c} value={c}>{c}</option>)
                                        ) : (
                                            categoryDropdownOptions.map((name) => <option key={name} value={name}>{name}</option>)
                                        )}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Account</label>
                                    <CustomSelect
                                        ref={accountRef}
                                        value={filters.account}
                                        onChange={(e) => setFilters({ ...filters, account: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, 3)}
                                        className="reports-tablet-filter-input w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                                    >
                                        <option value="All Accounts">All Accounts</option>
                                        {uniqueOptions.accounts.length > 0 ? (
                                            uniqueOptions.accounts.map(a => <option key={a} value={a}>{a}</option>)
                                        ) : (
                                            accounts.map(a => <option key={a.id} value={a.bankName || a.name}>{a.bankName || a.name}</option>)
                                        )}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Party</label>
                                    <CustomSelect
                                        ref={partyRef}
                                        value={filters.party}
                                        onChange={(e) => setFilters({ ...filters, party: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, 4)}
                                        className="reports-tablet-filter-input w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                                    >
                                        <option value="All Parties">All Parties</option>
                                        {uniqueOptions.parties.length > 0 ? (
                                            uniqueOptions.parties.map(p => <option key={p} value={p}>{p}</option>)
                                        ) : (
                                            partyDropdownOptions.map((name) => <option key={name} value={name}>{name}</option>)
                                        )}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">Report Type</label>
                                    <CustomSelect
                                        ref={reportTypeRef}
                                        value={filters.reportType}
                                        onChange={(e) => setFilters({ ...filters, reportType: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, 5)}
                                        dropdownContentClassName="max-h-none overflow-visible"
                                        className="reports-tablet-filter-input w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-xs lg:text-sm font-medium focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                                    >
                                        <option value="Summary">Summary</option>
                                        <option value="Detailed">Detailed</option>
                                        <option value="Category-wise">Category-wise</option>
                                        <option value="Account-wise">Account-wise</option>
                                        <option value="Debit/Credit">Debit/Credit</option>
                                        <option value="P/L">P/L</option>
                                    </CustomSelect>
                                </div>
                            </div>
                            <div className="reports-tablet-filter-actions mt-6 flex flex-col sm:flex-row xl:justify-end gap-3">
                                <button
                                    onClick={handleResetFilters}
                                    className="w-full sm:w-[190px] h-10 flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-6 rounded-xl text-sm font-bold transition-all active:scale-95 outline-none"
                                >
                                    <span>Reset</span>
                                </button>
                                <button onClick={handleGenerateReport} className="w-full sm:w-[190px] h-10 flex items-center justify-center space-x-2 bg-black hover:bg-gray-800 focus:bg-gray-800 text-white px-6 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl focus:ring-4 focus:ring-gray-200 transition-all active:scale-95 outline-none">
                                    {isGenerated ? <RefreshCw size={18} /> : <BarChart3 size={18} />}
                                    <span>{isGenerated ? 'Update Report' : 'Generate Report'}</span>
                                </button>
                            </div>
                        </Card>

                        {/* Report Content */}
                        {isGenerated && reportData && (
                            <div className="space-y-6">

                                {/* Summary Cards */}
                                {filters.reportType === 'Summary' && reportData.summary && (
                                    <div className="reports-tablet-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4 no-print stat-cards">
                                        <StatCard title="Net Profit" amount={formatCurrency(netProfit, preferences.currency)} icon={Wallet} iconBgColor="#e0e7ff" iconColor="#6366f1" trendType="up" linkText={selectedPeriodLabel} />
                                        <StatCard title="Total Income" amount={formatCurrency(reportData.summary.income, preferences.currency)} icon={ArrowUpCircle} iconBgColor="#dbeafe" iconColor="#3b82f6" trendType="up" linkText={selectedPeriodLabel} />
                                        <StatCard title="Total Expense" amount={formatCurrency(reportData.summary.expense, preferences.currency)} icon={ArrowDownCircle} iconBgColor="#ffe4e6" iconColor="#f43f5e" trendType="down" linkText={selectedPeriodLabel} />
                                        <StatCard title="Total Investment" amount={formatCurrency(reportData.summary.investment, preferences.currency)} icon={TrendingUp} iconBgColor="#fef3c7" iconColor="#f59e0b" trendType="up" linkText={selectedPeriodLabel} />
                                    </div>
                                )}
                                {(filters.reportType === 'P/L' || filters.reportType === 'Profit/Loss' || filters.reportType === 'Profit & Loss') && reportData.summary && (
                                    <div className="reports-tablet-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4 no-print stat-cards">
                                        <StatCard title="Net Profit" amount={formatCurrency(reportData.summary.netProfit ?? reportData.summary.net, preferences.currency)} icon={Wallet} iconBgColor="#e0e7ff" iconColor="#6366f1" trendType="up" linkText={selectedPeriodLabel} />
                                        <StatCard title="Total Income" amount={formatCurrency(reportData.summary.totalIncome ?? reportData.summary.income, preferences.currency)} icon={ArrowUpCircle} iconBgColor="#dbeafe" iconColor="#3b82f6" trendType="up" linkText={selectedPeriodLabel} />
                                        <StatCard title="Total Expense" amount={formatCurrency(reportData.summary.totalExpense ?? reportData.summary.expense, preferences.currency)} icon={ArrowDownCircle} iconBgColor="#ffe4e6" iconColor="#f43f5e" trendType="down" linkText={selectedPeriodLabel} />
                                    </div>
                                )}

                                {/* Report Table Screen */}
                                <div className="no-print">
                                    <ReportTableScreen
                                        reportData={filteredReportData}
                                        paginatedData={paginatedData}
                                        searchTerm={searchTerm}
                                        setSearchTerm={setSearchTerm}
                                        currentPage={currentPage}
                                        setCurrentPage={setCurrentPage}
                                        totalPages={totalPages}
                                        pageSize={pageSize}
                                        totalItems={totalItems}
                                        onPrint={() => setIsPrinting(true)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Report Table Print - Rendered outside scroll container for better print handling */}
            {isGenerated && reportData && (
                <ReportTablePrint
                    reportData={filteredReportData}
                    filters={filters}
                />
            )}
        </div>
    );
};

export default Reports;
