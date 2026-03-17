import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import apiService from '../../services/api';
import {
    Clock,
    User,
    Filter,
    Search,
    RefreshCw,
    Shield,
    FileJson,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    Calendar,
    Loader2
} from 'lucide-react';
import { cn } from '../../utils/cn';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import MobilePagination from '../../components/common/MobilePagination';
import CustomSelect from '../../components/common/CustomSelect';
import { usePreferences } from '../../context/PreferenceContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';

const AuditLogs = () => {
    const navigate = useNavigate();
    const { selectedBranch } = useBranch();
    const { selectedOrg } = useOrganization();
    const { user, isLoading: authLoading } = useAuth();
    const { showToast } = useToast();
    const { formatDateTime } = usePreferences();
    const [logs, setLogs] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const [isDesktopView, setIsDesktopView] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
    );

    // Access Control
    useEffect(() => {
        // Wait for Auth to load
        if (authLoading) return;

        // Check if user has owner or admin role
        const hasPermission = user?.role === 'owner' || user?.role === 'admin';

        if (!hasPermission) {
            // Redirect to dashboard if user doesn't have permissions
            navigate('/dashboard');
            showToast('You do not have permission to view Audit Logs', 'error');
        }
    }, [user, selectedOrg, authLoading, navigate]);

    // Pagination & Search
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);

    // Specific Filters
    const [filters, setFilters] = useState({
        entity: '',
        action: ''
    });

    const [expandedRow, setExpandedRow] = useState(null);
    const cacheKey = `audit:logs:${selectedOrg?.id || 'org'}:${selectedBranch?.id || 'all'}:${currentPage}:${pageSize}:${filters.entity || 'all'}:${filters.action || 'all'}:${searchTerm || ''}`;

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.logs)) {
                setLogs(parsed.logs);
            }
            if (typeof parsed?.totalItems === 'number') {
                setTotalItems(parsed.totalItems);
            }
            if (Array.isArray(parsed?.logs) || typeof parsed?.totalItems === 'number') {
                setHasFetchedOnce(true);
            }
        } catch (error) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    const fetchLogs = async (signal) => {
        setLoading(true);
        try {
            // Calculate offset based on page (backend expects offset)
            const offset = (currentPage - 1) * pageSize;
            const requestConfig =
                signal && typeof signal.addEventListener === 'function'
                    ? { signal }
                    : {};

            const response = await apiService.auditLogs.getAll({
                ...filters,
                limit: pageSize,
                offset: offset,
                search: searchTerm // Assuming backend supports search
            }, requestConfig);

            if (response.success) {
                setLogs(response.data);
                setTotalItems(response.total || 0);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        logs: Array.isArray(response.data) ? response.data : [],
                        totalItems: response.total || 0
                    }));
                } catch (error) {
                    // Ignore storage errors
                }
            } else {
                setLogs([]);
                setTotalItems(0);
            }
        } catch (error) {
            if (isIgnorableRequestError(error)) return;
            console.error(error);
            showToast('Failed to fetch audit logs', 'error');
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setHasFetchedOnce(true);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchLogs(controller.signal);
        return () => controller.abort();
    }, [cacheKey, currentPage, pageSize, filters, selectedBranch?.id ? String(selectedBranch.id) : null]);

    useEffect(() => {
        const handleResize = () => setIsDesktopView(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle Filter Changes
    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
        setCurrentPage(1);
    };

    const toggleExpand = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const hasNextPage = currentPage < totalPages;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <PageContentShell
            header={(
                <PageHeader
                    title="Audit Logs"
                    breadcrumbs={['System', 'Audit Logs']}
                    mobileSticky={false}
                />
            )}
        >
            {/* Backdrop for dropdowns */}
            {(activeDropdown) && (
                <div
                    className="fixed inset-0 z-30 bg-black/5 lg:bg-transparent"
                    onClick={() => setActiveDropdown(null)}
                />
            )}

                    {/* Toolbar */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-4 border-b border-gray-50 relative z-40">
                        {/* Left: Filters */}
                        <div className="contents lg:flex lg:items-center lg:gap-3 lg:overflow-x-auto lg:no-scrollbar">
                            <div className="relative flex items-center justify-center lg:justify-start gap-2 h-10 w-full min-w-0 lg:w-auto px-2 lg:px-0 lg:py-0 bg-white lg:bg-gray-50 rounded-xl border border-gray-100">
                                <Filter className="w-[18px] h-[18px] lg:w-[14px] lg:h-[14px] text-gray-500 lg:text-gray-400 lg:absolute lg:left-3 lg:top-1/2 lg:-translate-y-1/2 lg:pointer-events-none" />
                                <CustomSelect
                                    name="entity"
                                    value={filters.entity}
                                    onChange={handleFilterChange}
                                    className="min-w-0 flex-1 w-full lg:w-auto h-full lg:h-auto px-2 lg:pl-9 lg:pr-3 bg-transparent border-none text-[11px] sm:text-xs lg:font-bold text-gray-600 outline-none"
                                >
                                    <option value="">All Entities</option>
                                    <option value="transaction">Transactions</option>
                                    <option value="account">Accounts</option>
                                    <option value="category">Categories</option>
                                    <option value="branch">Branches</option>
                                </CustomSelect>
                            </div>

                            <div className="relative flex items-center justify-center lg:justify-start gap-2 h-10 w-full min-w-0 lg:w-auto px-2 lg:px-0 lg:py-0 bg-white lg:bg-gray-50 rounded-xl border border-gray-100">
                                <Shield className="w-[18px] h-[18px] lg:w-[14px] lg:h-[14px] text-gray-500 lg:text-gray-400 lg:absolute lg:left-3 lg:top-1/2 lg:-translate-y-1/2 lg:pointer-events-none" />
                                <CustomSelect
                                    name="action"
                                    value={filters.action}
                                    onChange={handleFilterChange}
                                    className="min-w-0 flex-1 w-full lg:w-auto h-full lg:h-auto px-2 lg:pl-9 lg:pr-3 bg-transparent border-none text-[11px] sm:text-xs lg:font-bold text-gray-600 outline-none"
                                >
                                    <option value="">All Actions</option>
                                    <option value="create">Create</option>
                                    <option value="update">Update</option>
                                    <option value="delete">Delete</option>
                                </CustomSelect>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="contents lg:flex lg:items-center lg:gap-3">
                            <button
                                onClick={() => fetchLogs()}
                                className="col-span-2 sm:col-span-1 w-full lg:w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-500 hover:bg-gray-50 transition-all"
                                title="Refresh"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>


                        </div>
                    </div>

                    {/* Mobile Card View */}
                    {!isDesktopView && (
                        <div className="relative flex-1 p-4 space-y-4 min-h-0" aria-busy={loading}>
                            {showInitialLoader ? (
                                <div className="py-8 flex items-center justify-center">
                                    <Loader2 size={26} className="text-gray-500 animate-spin" />
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-8 text-sm text-gray-500">No logs found.</div>
                            ) : (
                                logs.map((log) => {
                                    const hasDetails = Boolean(log.oldValue || log.newValue);
                                    return (
                                <div key={log.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border",
                                                log.action === 'create' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    log.action === 'update' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        log.action === 'delete' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                            'bg-gray-50 text-gray-600 border-gray-100'
                                            )}>
                                                {log.action}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                            <Clock size={10} />
                                            {formatDateTime(log.actionAt)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Entity</div>
                                            <div className="font-bold text-gray-700 text-xs capitalize">{log.entity}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">User</div>
                                            <div className="font-bold text-indigo-600 text-xs">{log.user?.fullName || `User ${log.actionBy}`}</div>
                                        </div>
                                    </div>

                                    {hasDetails && (
                                        <button
                                            onClick={() => toggleExpand(log.id)}
                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-bold text-[10px] hover:bg-gray-100 transition-colors border border-gray-100"
                                        >
                                            <FileJson size={12} />
                                            {expandedRow === log.id ? 'Hide Details' : 'View Details'}
                                            <ChevronDown size={12} className={cn("transition-transform", expandedRow === log.id && "rotate-180")} />
                                        </button>
                                    )}

                                    {hasDetails && expandedRow === log.id && (
                                        <div className="pt-2 space-y-3 animate-in fade-in duration-200">
                                            {log.oldValue && (
                                                <div className="p-2 bg-rose-50/30 rounded-lg border border-rose-100">
                                                    <div className="text-[9px] font-extrabold text-rose-700 uppercase tracking-widest mb-1">Previous</div>
                                                    <pre className="text-[9px] font-mono text-gray-600 overflow-auto max-h-32 custom-scrollbar bg-white p-1.5 rounded border border-rose-50">
                                                        {JSON.stringify(log.oldValue, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            {log.newValue && (
                                                <div className="p-2 bg-emerald-50/30 rounded-lg border border-emerald-100">
                                                    <div className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-widest mb-1">New</div>
                                                    <pre className="text-[9px] font-mono text-gray-600 overflow-auto max-h-32 custom-scrollbar bg-white p-1.5 rounded border border-emerald-50">
                                                        {JSON.stringify(log.newValue, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                    );
                                })
                            )}
                            {showOverlayLoader && <LoadingOverlay label="Loading audit logs..." />}
                        </div>
                    )}

                    {/* Table */}
                    {(isDesktopView || typeof window === 'undefined') && (
                        <div className="relative flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar" aria-busy={loading}>
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-white">
                                <tr className="bg-gray-50/50 border-y border-gray-200">
                                    <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur-sm w-[15%]">Timestamp</th>
                                    <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur-sm w-[15%]">User</th>
                                    <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur-sm w-[10%]">Action</th>
                                    <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur-sm w-[10%]">Entity</th>
                                    <th className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap text-right bg-gray-50/95 backdrop-blur-sm w-[10%]">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {showInitialLoader ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8">
                                            <div className="flex items-center justify-center">
                                                <Loader2 size={24} className="text-gray-500 animate-spin" />
                                            </div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">No logs found.</td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const hasDetails = Boolean(log.oldValue || log.newValue);
                                        return (
                                        <React.Fragment key={log.id}>
                                            <tr
                                                onClick={() => {
                                                    if (hasDetails) toggleExpand(log.id);
                                                }}
                                                className={cn(
                                                    "group transition-colors",
                                                    hasDetails ? "cursor-pointer" : "cursor-default",
                                                    expandedRow === log.id ? "bg-gray-50" : "hover:bg-gray-50/50"
                                                )}
                                            >
                                                <td className="px-4 py-2 text-xs font-bold text-gray-800 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} className="text-gray-300 group-hover:text-primary/50 transition-colors" />
                                                        {formatDateTime(log.actionAt)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-xs font-medium text-gray-800 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-black border border-indigo-100">
                                                            {log.user?.fullName?.[0] || 'U'}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-700">{log.user?.fullName || `User ${log.actionBy}`}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-colors border",
                                                        log.action === 'create' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            log.action === 'update' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                log.action === 'delete' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                                    'bg-gray-50 text-gray-600 border-gray-100'
                                                    )}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-xs font-bold text-gray-600 capitalize">{log.entity}</td>
                                                <td className="px-4 py-2 text-right">
                                                    {hasDetails && (
                                                        <button className={cn(
                                                            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                            expandedRow === log.id ? "text-primary" : "text-gray-400 group-hover:text-primary"
                                                        )}>
                                                            {expandedRow === log.id ? 'Hide' : 'View'}
                                                            <ChevronDown size={12} className={cn("transition-transform", expandedRow === log.id && "rotate-180")} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {/* Expandable Details */}
                                            {hasDetails && expandedRow === log.id && (
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                    <td colSpan="5" className="px-4 py-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                                                            {log.oldValue && (
                                                                <div className="p-3 bg-white rounded-xl border border-rose-100 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-rose-50">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                                        <h4 className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Previous State</h4>
                                                                    </div>
                                                                    <pre className="text-[10px] font-mono text-gray-600 overflow-auto max-h-40 custom-scrollbar">
                                                                        {JSON.stringify(log.oldValue, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {log.newValue && (
                                                                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-emerald-50">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                        <h4 className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">New State</h4>
                                                                    </div>
                                                                    <pre className="text-[10px] font-mono text-gray-600 overflow-auto max-h-40 custom-scrollbar">
                                                                        {JSON.stringify(log.newValue, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
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
                        {showOverlayLoader && <LoadingOverlay label="Loading audit logs..." />}
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                        <div className="text-[11px] text-gray-500 font-medium">
                            Showing <span className="font-bold text-gray-700">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="font-bold text-gray-700">{totalItems}</span> results
                        </div>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                disabled={!hasNextPage}
                                className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    {/* Mobile Pagination (Keep existing) */}
                    <div className="lg:hidden p-4 border-t border-gray-50 flex flex-col items-center justify-between gap-4">
                        <MobilePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
        </PageContentShell>
    );
};

export default AuditLogs;
