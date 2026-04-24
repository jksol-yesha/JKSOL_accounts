import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
    RefreshCw,
    ArrowUpRight,
    ArrowDownLeft,
    Activity,
    FileSpreadsheet,
    FileText
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import CustomSelect from '../../components/common/CustomSelect';
import StatCard from '../dashboard/components/StatCard';
import ReportTableScreen from './components/ReportTableScreen';
import ReportTablePrint from './components/ReportTablePrint';
import DateRangePicker from '../../components/common/DateRangePicker';
import BranchSelector from '../../components/layout/BranchSelector';
import { usePreferences } from '../../context/PreferenceContext';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useYear } from '../../context/YearContext';
import { generateDatePresets } from '../../utils/constants';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';

const Reports = () => {
    const { formatCurrency, preferences } = usePreferences();
    const { branches, selectedBranch, getBranchFilterValue } = useBranch();
    const { selectedOrg, loading: orgLoading } = useOrganization();
    const { user } = useAuth();
    const { selectedYear, financialYears } = useYear();

    const { reportId } = useParams();

    // Convert URL slug to backend report type
    const reportTypeMapping = useMemo(() => ({
        'detailed': 'Detailed',
        'category': 'Category-wise',
        'account': 'Account-wise',
        'party': 'Party-wise',
        'debit_credit': 'Debit/Credit',
        'pl': 'P/L'
    }), []);

    const initialReportType = reportTypeMapping[reportId] || 'Summary';

    const sortedFinancialYears = useMemo(() => {
        return [...(financialYears || [])].sort((a, b) => {
            const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
            const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
            return aDate - bDate;
        });
    }, [financialYears]);

    const previousYear = useMemo(() => {
        const selectedYearIndex = sortedFinancialYears.findIndex((year) => Number(year.id) === Number(selectedYear?.id));
        return selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;
    }, [sortedFinancialYears, selectedYear?.id]);

    const datePresets = useMemo(() => generateDatePresets(selectedYear, previousYear), [selectedYear, previousYear]);

    // State for filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        datePreset: 'current',
        type: 'All Types',
        category: 'All Categories',
        account: 'All Accounts',
        party: 'All Parties',
        branch: 'All Branches',
        reportType: initialReportType
    });

    const [isDesktopView, setIsDesktopView] = useState(
        typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
    );

    useEffect(() => {
        const handleResize = () => setIsDesktopView(window.innerWidth >= 1280);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (reportId) {
            const rt = reportTypeMapping[reportId];
            if (rt) {
                setFilters(f => ({ ...f, reportType: rt }));
                // Auto reset generation state on report type switch
                setReportData(null);
                setIsGenerated(false);
            }
        }
    }, [reportId, reportTypeMapping]);

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
    const [appliedFilters, setAppliedFilters] = useState(null);
    const reportsContextReady = Boolean(
        !orgLoading &&
        selectedOrg?.id &&
        selectedYear?.id &&
        (
            user?.role === 'member' ||
            user?.role === 'owner' ||
            selectedBranch?.id
        )
    );

    const formatDateForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const normalizeSingleDateRange = (range, fallbackRange = null) => {
        const fallbackStartDate = fallbackRange?.startDate || '';
        const fallbackEndDate = fallbackRange?.endDate || fallbackStartDate;
        const nextStartDate = range?.startDate || range?.endDate || fallbackStartDate;
        const nextEndDate = range?.endDate || range?.startDate || fallbackEndDate;

        return {
            startDate: nextStartDate,
            endDate: nextEndDate
        };
    };

    // Set default filters (Date and Branch sync)
    useEffect(() => {
        if (selectedYear?.startDate && !filters.startDate) {
            setFilters(prev => ({
                ...prev,
                startDate: selectedYear.startDate,
                endDate: selectedYear.endDate || new Date().toISOString().split('T')[0],
                datePreset: 'current'
            }));
        }
    }, [selectedYear]);

    // Load initial filter data when branch context changes
    useEffect(() => {
        // Avoid fetching before org context is ready; otherwise we can cache empty results.
        if (orgLoading || !selectedOrg?.id) return;

        const branchFilter = getBranchFilterValue() || 'all';

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
    }, [selectedOrg?.id, orgLoading, getBranchFilterValue()]);

    // Filter Categories and Accounts based on Type
    const filteredCategories = useMemo(() => {
        if (filters.type === 'All Types') return categories;
        return categories.filter(c => {
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
            const name = (p?.companyName || p?.name || '').toString().trim();
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


    // Reset UI and Trigger Auto-fetch
    useEffect(() => {
        setReportData(null);
        setIsGenerated(false);
        setSearchTerm('');
        setCurrentPage(1);
    }, [filters.reportType]);


    // Auto-refresh when any filter changes
    useEffect(() => {
        if (reportsContextReady) {
            handleGenerateReport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        preferences.currency,
        reportsContextReady,
        filters.reportType,
        filters.startDate,
        filters.endDate,
        getBranchFilterValue(),
        filters.type,
        filters.category,
        filters.account,
        filters.party
    ]);

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
        if (!reportsContextReady) {
            return;
        }
        const branchFilter = getBranchFilterValue() || 'all';

        const fallbackStartDate = selectedYear?.startDate || '';
        const fallbackEndDate = selectedYear?.endDate || new Date().toISOString().split('T')[0];

        const { startDate, endDate } = normalizeSingleDateRange(
            { startDate: filters.startDate, endDate: filters.endDate },
            { startDate: fallbackStartDate, endDate: fallbackEndDate }
        );

        if (!startDate || !endDate) return;

        const selectedReportType = filters.reportType || 'Summary';
        const reportType = selectedReportType === 'P/L' ? 'Profit/Loss' : selectedReportType;
        const nextAppliedFilters = {
            ...filters,
            startDate,
            endDate,
            branchFilter,
            reportType: selectedReportType
        };

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
            const response = await apiService.reports.get(params);

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
                    const d = data.data || {};
                    const incomes = Array.isArray(d.incomes) ? d.incomes : [];
                    const expenses = Array.isArray(d.expenses) ? d.expenses : [];

                    const flatten = (section, groups) => groups.flatMap(group =>
                        (group.items || []).map(item => ({
                            section,
                            category: group.category,
                            subCategory: item.subCategory,
                            amount: Number(item.amount || 0)
                        }))
                    );

                    data = {
                        ...data,
                        type: 'profit-loss',
                        data: d, // Preserve the nested data for components that need it
                        summary: {
                            ...data.summary,
                            totalIncome: Number(d.totalIncome || 0),
                            totalExpense: Number(d.totalExpense || 0),
                            netProfit: Number(d.netProfit || 0),
                            netLoss: Number(d.netLoss || 0),
                            totalLeft: Number(d.totalLeft || 0),
                            totalRight: Number(d.totalRight || 0),
                        },
                        tableData: [...flatten('income', incomes), ...flatten('expense', expenses)]
                    };
                }

                setReportData(data);
                setAppliedFilters(nextAppliedFilters);
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

    const buildExportPayload = (format) => {
        const exportFilters = appliedFilters || filters;
        const branchFilter = exportFilters.branchFilter || getBranchFilterValue() || 'all';
        const fallbackStartDate = selectedYear?.startDate || '';
        const fallbackEndDate = selectedYear?.endDate || new Date().toISOString().split('T')[0];

        const { startDate, endDate } = normalizeSingleDateRange(
            { startDate: exportFilters.startDate, endDate: exportFilters.endDate },
            { startDate: fallbackStartDate, endDate: fallbackEndDate }
        );
        const selectedReportType = exportFilters.reportType || 'Summary';
        const reportType = selectedReportType === 'P/L' ? 'Profit/Loss' : selectedReportType;

        let txnType = undefined;
        let categoryId = undefined;
        let accountId = undefined;
        let party = undefined;

        if (exportFilters.type !== 'All Types') txnType = exportFilters.type;
        if (exportFilters.category !== 'All Categories') {
            const match = categories.find(c => c.name === exportFilters.category);
            if (match) categoryId = match.id;
        }
        if (exportFilters.account !== 'All Accounts') {
            const match = accounts.find(a => (a.bankName || a.name) === exportFilters.account);
            if (match) accountId = match.id;
        }
        if (exportFilters.party !== 'All Parties') {
            party = exportFilters.party;
        }

        return {
            branchId: branchFilter,
            startDate,
            endDate,
            type: reportType,
            txnType,
            categoryId,
            accountId,
            party,
            targetCurrency: preferences?.currency,
            searchTerm,
            format
        };
    };

    const handleExportExcel = async () => {
        try {
            const response = await apiService.reports.export(buildExportPayload('csv'));
            const exportData = response?.data || response;
            const base64Content = exportData?.fileContent;
            const fileName = exportData?.fileName || 'report.csv';
            const mimeType = exportData?.mimeType || 'text/csv;charset=utf-8';

            if (!base64Content) throw new Error('Missing export file content');

            const binaryString = window.atob(base64Content);
            const fileBytes = new Uint8Array(binaryString.length);
            for (let index = 0; index < binaryString.length; index += 1) {
                fileBytes[index] = binaryString.charCodeAt(index);
            }

            const blob = new Blob([fileBytes], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to export report';
            console.error('Report Excel export failed:', error);
            alert(message);
        }
    };

    const handleExportPdf = async () => {
        try {
            const response = await apiService.reports.export(buildExportPayload('pdf'), {
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
            const message = error?.response?.data?.message || error?.message || 'Failed to export report';
            console.error('Report PDF export failed:', error);
            alert(message);
        }
    };

    const handleDateRangeChange = (range) => {
        const normalizedRange = normalizeSingleDateRange(range);
        setFilters((prev) => ({
            ...prev,
            ...normalizedRange,
            datePreset: 'custom'
        }));
    };

    const handleKeyDown = useFormNavigation([dateRangeRef, typeRef, categoryRef, accountRef, partyRef, reportTypeRef], handleGenerateReport);

    const handleResetFilters = () => {
        setFilters(prev => ({
            ...prev,
            startDate: selectedYear?.startDate || '',
            endDate: selectedYear?.endDate || new Date().toISOString().split('T')[0],
            datePreset: 'current',
            type: 'All Types',
            category: 'All Categories',
            account: 'All Accounts',
            party: 'All Parties',
            reportType: initialReportType
        }));
        setReportData(null);
        setIsGenerated(false);
        setAppliedFilters(null);
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

                const p = (item.party || item.companyName || item.contact || '').toString().trim();
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
        } else if (reportData.type === 'accounts' || reportData.type === 'parties') {
            data = data.filter(item => {
                const name = (item.name || '').toString().trim();
                return Boolean(name && name !== '-');
            });
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
                } else if (filteredReportData.type === 'categories' || filteredReportData.type === 'accounts' || filteredReportData.type === 'parties') {
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
    const displayFilters = isGenerated && appliedFilters ? appliedFilters : filters;


    const extraFiltersNode = (
        <>
                                {filters.reportType === 'P/L' && (
                                    <div className="w-full sm:w-auto mt-1 lg:mt-0 lg:ml-1 hidden xl:block">
                                        <button 
                                            onClick={handleExportPdf} 
                                            className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-gray-200 bg-white hover:bg-[#F0F9FF] hover:border-[#BAE6FD] hover:text-[#4A8AF4] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 transition-all font-semibold text-slate-800 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] no-print" 
                                            title="Export Report"
                                        >
                                            <Download size={14} className="text-slate-600 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                                            <span className="hidden sm:inline">Export</span>
                                        </button>
                                    </div>
                                )}
                                {filters.reportType !== 'P/L' && (
                                    <div className="w-full sm:w-auto hidden xl:block">
                                        <CustomSelect
                                            ref={typeRef}
                                            value={filters.type}
                                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, 1)}
                                            buttonLabelClassName="text-[14px] !important" dropdownItemClassName="text-[14px] !important" className="reports-tablet-filter-input w-full sm:w-[110px] px-3 h-[32px] bg-white border border-gray-200 rounded-md text-[14px] text-slate-800 font-semibold focus:outline-none focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 hover:bg-[#F0F9FF] hover:border-[#BAE6FD] hover:text-[#4A8AF4] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                                        >
                                            <option value="All Types">All Types</option>
                                            {typeFilterOptions.map((t) => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </CustomSelect>
                                    </div>
                                )}
                                {filters.reportType === 'Category-wise' && (
                                    <div className="w-full sm:w-auto hidden xl:block">
                                        <CustomSelect
                                            ref={categoryRef}
                                            value={filters.category}
                                            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, 2)}
                                            buttonLabelClassName="text-[14px] !important" dropdownItemClassName="text-[14px] !important" className="reports-tablet-filter-input min-w-[150px] w-full px-3 h-[32px] bg-white border border-gray-200 rounded-md text-[14px] text-slate-800 font-semibold focus:outline-none focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 hover:bg-[#F0F9FF] hover:border-[#BAE6FD] hover:text-[#4A8AF4] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                                        >
                                            <option value="All Categories">All Categories</option>
                                            {uniqueOptions.categories.length > 0 ? (
                                                uniqueOptions.categories.map(c => <option key={c} value={c}>{c}</option>)
                                            ) : (
                                                categoryDropdownOptions.map((name) => <option key={name} value={name}>{name}</option>)
                                            )}
                                        </CustomSelect>
                                    </div>
                                )}
                                {filters.reportType === 'Account-wise' && (
                                    <div className="w-full sm:w-auto hidden xl:block">
                                        <CustomSelect
                                            ref={accountRef}
                                            value={filters.account}
                                            onChange={(e) => setFilters({ ...filters, account: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, 3)}
                                            buttonLabelClassName="text-[14px] !important" dropdownItemClassName="text-[14px] !important" className="reports-tablet-filter-input min-w-[150px] w-full px-3 h-[32px] bg-white border border-gray-200 rounded-md text-[14px] text-slate-800 font-semibold focus:outline-none focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 hover:bg-[#F0F9FF] hover:border-[#BAE6FD] hover:text-[#4A8AF4] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                                        >
                                            <option value="All Accounts">All Accounts</option>
                                            {uniqueOptions.accounts.length > 0 ? (
                                                uniqueOptions.accounts.map(a => <option key={a} value={a}>{a}</option>)
                                            ) : (
                                                accounts.map(a => <option key={a.id} value={a.bankName || a.name}>{a.bankName || a.name}</option>)
                                            )}
                                        </CustomSelect>
                                    </div>
                                )}
                                {filters.reportType === 'Party-wise' && (
                                    <div className="w-full sm:w-auto hidden xl:block">
                                        <CustomSelect
                                            ref={partyRef}
                                            value={filters.party}
                                            onChange={(e) => setFilters({ ...filters, party: e.target.value })}
                                            onKeyDown={(e) => handleKeyDown(e, 4)}
                                            buttonLabelClassName="text-[14px] !important" dropdownItemClassName="text-[14px] !important" className="reports-tablet-filter-input min-w-[150px] w-full px-3 h-[32px] bg-white border border-gray-200 rounded-md text-[14px] text-slate-800 font-semibold focus:outline-none focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 hover:bg-[#F0F9FF] hover:border-[#BAE6FD] hover:text-[#4A8AF4] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                                        >
                                            <option value="All Parties">All Parties</option>
                                            {uniqueOptions.parties.length > 0 ? (
                                                uniqueOptions.parties.map(p => <option key={p} value={p}>{p}</option>)
                                            ) : (
                                                partyDropdownOptions.map((name) => <option key={name} value={name}>{name}</option>)
                                            )}
                                        </CustomSelect>
                                    </div>
                                )}
        </>
    );

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
                            title={`${filters.reportType} Report`}
                            breadcrumbs={['Portal', { label: 'Reports Hub', path: '/reports' }, filters.reportType]}
                        />
                    </div>

                    <div className="reports-tablet-page flex-1 p-4 md:p-4 xl:px-6 xl:pt-2 xl:pb-4 space-y-4 animate-in fade-in duration-500 print:hidden">
                        {/* Filters & Inline Summary Section */}
                        <div className="no-print report-filters flex flex-col xl:flex-row xl:justify-between items-start xl:items-center gap-4 border-b border-gray-100 xl:border-none px-5 pb-4 xl:pb-0 mb-4 xl:mb-0 w-full transition-all">
                            
                            {/* LEFT SIDE: Transaction Summary Metrics */}
                            {isGenerated && reportData && reportData.summary ? (
                                <div className="flex flex-row items-center gap-x-6 lg:gap-x-8 gap-y-3 shrink-0 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 hide-scroll-indicator">
                                    {/* Opening */}
                                    <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg border border-slate-200/60 bg-slate-50 flex items-center justify-center shrink-0">
                                            <Wallet size={16} className="text-slate-600" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] lg:text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Opening</div>
                                            <div className="text-[14px] lg:text-[15px] font-bold text-gray-800 tracking-tight whitespace-nowrap">{formatCurrency(reportData.summary.openingBalance, preferences.currency)}</div>
                                        </div>
                                    </div>
                                    {/* Debit */}
                                    <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg border border-white/60 bg-rose-50 flex items-center justify-center shrink-0">
                                            <ArrowUpRight size={16} className="text-rose-600" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] lg:text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Debit</div>
                                            <div className="text-[14px] lg:text-[15px] font-bold text-gray-800 tracking-tight whitespace-nowrap">{formatCurrency(reportData.summary.expense + reportData.summary.investment, preferences.currency)}</div>
                                        </div>
                                    </div>
                                    {/* Credit */}
                                    <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg border border-white/60 bg-emerald-50 flex items-center justify-center shrink-0">
                                            <ArrowDownLeft size={16} className="text-emerald-600" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] lg:text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Credit</div>
                                            <div className="text-[14px] lg:text-[15px] font-bold text-gray-800 tracking-tight whitespace-nowrap">{formatCurrency(reportData.summary.income, preferences.currency)}</div>
                                        </div>
                                    </div>
                                    {/* Closing */}
                                    <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg border border-slate-200/60 bg-slate-100 flex items-center justify-center shrink-0">
                                            <Activity size={16} className="text-slate-700" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] lg:text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Closing</div>
                                            <div className="text-[14px] lg:text-[15px] font-bold text-slate-800 tracking-tight whitespace-nowrap">{formatCurrency(reportData.summary.closingBalance, preferences.currency)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="hidden xl:block flex-1" />
                            )}

                            {/* RIGHT SIDE: FILTERS */}
                            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-3 w-full xl:w-auto shrink-0 justify-end">
                                <div className="w-full sm:w-auto">
                                <DateRangePicker
                                    ref={dateRangeRef}
                                    startDate={filters.startDate}
                                    endDate={filters.endDate}
                                    onChange={handleDateRangeChange}
                                    selectedPreset={filters.datePreset || 'current'}
                                    presetOptions={datePresets}
                                    onApplyRange={({ startDate, endDate, preset }) => {
                                        const normalizedRange = normalizeSingleDateRange({ startDate, endDate });
                                        setFilters((prev) => ({
                                            ...prev,
                                            ...normalizedRange,
                                            datePreset: preset || 'custom'
                                        }));
                                    }}
                                    onKeyDown={(e) => handleKeyDown(e, 0)}
                                    buttonLabelClassName="text-[14px] !important" dropdownItemClassName="text-[14px] !important" className="reports-tablet-filter-input w-full min-w-[220px]"
                                />
                            </div>
                            <div className="w-full sm:w-auto mt-1 lg:mt-0 lg:ml-1">
                                <BranchSelector />
                            </div>
                            {isDesktopView && extraFiltersNode}
                        </div>
                        </div>

                        {/* Report Content */}
                        {isGenerated && reportData && (
                            <div className="space-y-6">

                                {/* Summary Cards (Legacy layout replaced by inline headers for Summary) */}
                                {displayFilters.reportType === 'Summary' && reportData.summary ? null : null}


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
                                        onExportExcel={handleExportExcel}
                                        onExportPdf={handleExportPdf}
                                        filters={displayFilters}
                                        renderExtraFilters={!isDesktopView ? extraFiltersNode : null}
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
                    filters={displayFilters}
                />
            )}
        </div>
    );
};

export default Reports;
