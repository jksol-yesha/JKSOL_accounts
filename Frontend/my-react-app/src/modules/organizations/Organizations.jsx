
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Edit,
    Plus,
    Search,
    ArrowUpDown,
    Download,
    FileSpreadsheet,
    FileText,
    LayoutGrid,
    X,
    Building2,
    Trash2
} from 'lucide-react';
import { cn } from '../../utils/cn';
import MobilePagination from '../../components/common/MobilePagination';
import Card from '../../components/common/Card';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import PageHeader from '../../components/layout/PageHeader';
import apiService from '../../services/api'; // Using API instead of storage

const Organizations = () => {
    const navigate = useNavigate();
    const [organizations, setOrganizations] = useState([]);
    const [pageSize, setPageSize] = useState(20);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [isLoading, setIsLoading] = useState(true);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const cacheKey = 'organizations:list';

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setOrganizations(parsed);
                setHasFetchedOnce(true);
                setIsLoading(false);
            }
        } catch (error) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, []);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        setIsLoading(true);
        try {
            const response = await apiService.orgs.getAll();
            const data = response.data || response;
            // The API returns { ok: true, orgs: [{ role, org: {...} }] }
            const orgList = (data.orgs || []).map(item => item.org || item);
            setOrganizations(orgList);
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(orgList));
            } catch (error) {
                // Ignore storage errors
            }
        } catch (error) {
            console.error("Failed to fetch organizations:", error);
            setOrganizations([]);
        } finally {
            setIsLoading(false);
            setHasFetchedOnce(true);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this organization?")) return;

        try {
            await apiService.orgs.delete(id);
            fetchOrganizations(); // Refresh list
        } catch (error) {
            console.error("Failed to delete organization:", error);
            alert("Failed to delete organization");
        }
    };

    const MONTHS_MAP = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
        7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedOrgs = useMemo(() => {
        let sortableItems = [...organizations];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [organizations, sortConfig]);

    const filteredOrgs = useMemo(() => {
        return sortedOrgs.filter(org => {
            const term = searchTerm.toLowerCase();
            return (
                (org.name || '').toLowerCase().includes(term) ||
                (org.baseCurrency || '').toLowerCase().includes(term) ||
                (org.defaultBranchName || '').toLowerCase().includes(term)
            );
        });
    }, [sortedOrgs, searchTerm]);

    const paginatedOrgs = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredOrgs.slice(startIndex, startIndex + pageSize);
    }, [filteredOrgs, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredOrgs.length / pageSize);
    const showInitialLoader = isLoading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(isLoading, hasFetchedOnce);

    return (
        <div className="flex flex-col min-h-screen">
            {activeDropdown && (
                <div
                    className="fixed inset-0 z-30 bg-black/5 lg:bg-transparent"
                    onClick={() => setActiveDropdown(null)}
                />
            )}

            <div className="print:hidden">
                <PageHeader
                    title="Organizations"
                    breadcrumbs={['Settings', 'Organizations']}
                />
            </div>

            <div className="p-4 lg:p-8 space-y-6 animate-in fade-in duration-500">
                <Card noPadding className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible">
                    <div className="px-6 py-3 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-t-2xl">
                        <div className="w-full flex items-center justify-between">
                            <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/organizations/create')}>
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-500 hover:bg-gray-50 transition-all active:scale-95">
                                    <Plus size={18} strokeWidth={2} />
                                </button>
                                <span className="hidden lg:block text-[14px] font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                                    Create New Organization
                                </span>
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* Search */}
                                <div className="relative hidden lg:block">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search organizations..."
                                        className="pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-xs w-64 focus:ring-2 focus:ring-black/5 focus:border-black/10 outline-none transition-all"
                                    />
                                </div>

                                {/* Download Button */}
                                <button
                                    className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                                    title="Download"
                                >
                                    <Download size={18} strokeWidth={2} />
                                </button>

                                {/* View Options */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === 'view' ? null : 'view');
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                                        title="View Options"
                                    >
                                        <LayoutGrid size={18} strokeWidth={2} />
                                    </button>

                                    {activeDropdown === 'view' && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-gray-100 p-2 z-40 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">
                                                Rows per page
                                            </div>
                                            {[10, 20, 50, 100].map(size => (
                                                <button
                                                    key={size}
                                                    onClick={() => {
                                                        setPageSize(size);
                                                        setActiveDropdown(null);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between",
                                                        pageSize === size ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"
                                                    )}
                                                >
                                                    <span>{size} rows</span>
                                                    {pageSize === size && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block overflow-x-auto relative" aria-busy={isLoading}>
                        {/* Table container with fixed height for scrolling (approx 14 rows) */}
                        <div className="max-h-[700px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        {[
                                            { label: 'Name', key: 'name' },
                                            { label: 'Base Currency', key: 'baseCurrency' },
                                            { label: 'FY Start', key: 'fyStartMonth' },
                                            { label: 'Action', key: null }
                                        ].map((col) => (
                                            <th key={col.label} onClick={() => col.key && handleSort(col.key)} className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors bg-gray-50/50">
                                                <div className="flex items-center space-x-1">
                                                    <span>{col.label}</span>
                                                    {col.key && <ArrowUpDown size={10} className={sortConfig.key === col.key ? "opacity-100" : "opacity-30"} />}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {showInitialLoader ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-sm text-gray-500">Loading organizations...</td></tr>
                                    ) : paginatedOrgs.length > 0 ? (
                                        paginatedOrgs.map((org) => (
                                            <tr key={org.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-1.5 text-sm font-bold text-gray-800">{org.name}</td>
                                                <td className="px-4 py-1.5 text-xs font-medium text-gray-600">{org.baseCurrency}</td>
                                                <td className="px-4 py-1.5 text-xs font-medium text-gray-600">{MONTHS_MAP[org.fyStartMonth] || org.fyStartMonth}</td>
                                                <td className="px-4 py-1.5">
                                                    <button
                                                        onClick={() => handleDelete(org.id)}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete Organization"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="4" className="p-8 text-center text-sm text-gray-400">No organizations found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {showOverlayLoader && <LoadingOverlay label="Loading organizations..." />}
                    </div>

                    {/* Mobile Pagination (Custom Design) */}
                    <div className="lg:hidden border-t border-gray-100 p-2 print:hidden">
                        <MobilePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>

                    {/* Desktop Pagination (Original Layout) */}
                    <div className="hidden lg:flex items-center justify-between px-4 py-1 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                        <div className="text-[10px] text-gray-500 font-medium">
                            Showing <span className="font-bold text-gray-700">{filteredOrgs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredOrgs.length)}</span> of <span className="font-bold text-gray-700">{filteredOrgs.length}</span> results
                        </div>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-2 py-0.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                                Previous
                            </button>

                            {/* Desktop: Full Pagination */}
                            <div className="hidden sm:flex items-center space-x-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            "w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold transition-all",
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
                                className="px-2 py-0.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Organizations;
