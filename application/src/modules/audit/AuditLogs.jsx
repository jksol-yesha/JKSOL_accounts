import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import apiService from '../../services/api';
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);
import {
    Clock,
    Filter,
    RefreshCw,
    Shield,
    FileJson,
    ChevronDown,
    Loader2,
    Eye,
    X,
    ArrowRight
} from 'lucide-react';
import { cn } from '../../utils/cn';
import PageHeader from '../../components/layout/PageHeader';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import MobilePagination from '../../components/common/MobilePagination';
import CustomSelect from '../../components/common/CustomSelect';
import { usePreferences } from '../../context/PreferenceContext';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';

/* --- SMART DIFF LOGIC --- */

const flattenObject = (obj, prefix = '') => {
    let result = {};
    if (!obj || typeof obj !== 'object') return { [prefix]: obj };
    
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(result, flattenObject(obj[key], newKey));
        } else {
            result[newKey] = obj[key];
        }
    }
    return result;
};

const getAuditDiffs = (oldRaw, newRaw) => {
    const normalizeAuditValue = (value) => {
        let currentValue = value;
        for (let depth = 0; depth < 3; depth += 1) {
            if (typeof currentValue !== 'string') break;
            const trimmed = currentValue.trim();
            if (!trimmed) break;
            const looksJsonLike =
                (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'));
            if (!looksJsonLike) break;
            try { currentValue = JSON.parse(trimmed); } catch { break; }
        }
        return currentValue;
    };

    const oldObj = flattenObject(normalizeAuditValue(oldRaw) || {});
    const newObj = flattenObject(normalizeAuditValue(newRaw) || {});
    
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const diffs = [];
    
    allKeys.forEach(key => {
        // Strip out noisy internal fields that shouldn't clutter visually
        if (key.includes('created_at') || key.includes('updated_at') || key === 'id') return;
        
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        
        if (oldStr !== newStr) {
            diffs.push({ key, oldVal, newVal });
        }
    });
    
    return diffs;
};

const AuditDiffRow = ({ logKey, oldVal, newVal, action }) => {
    const formatVal = (v) => {
        if (v === undefined || v === null) return <span className="italic text-gray-400">null</span>;
        if (typeof v === 'boolean') return <span className={v ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{v ? 'true' : 'false'}</span>;
        if (typeof v === 'string' && v.trim() === '') return <span className="italic text-gray-400">empty</span>;
        return <span className="text-gray-700">{String(v)}</span>;
    };

    return (
        <div className="space-y-1 mb-3">
            <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                {logKey.replace(/_+/g, ' ')}
            </label>
            
            <div className="flex items-center gap-2 w-full">
                {action !== 'create' && (
                    <div className="flex-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {formatVal(oldVal)}
                    </div>
                )}
                
                {action === 'update' && (
                    <ArrowRight size={14} className="text-gray-400 shrink-0 mx-1" strokeWidth={2} />
                )}
                
                {action !== 'delete' && (
                    <div className="flex-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {formatVal(newVal)}
                    </div>
                )}
            </div>
        </div>
    );
};

const AuditDetailsModal = ({ log, onClose }) => {
    if (!log) return null;
    
    // Process diffs safely out of hook line to ensure order since log can be null
    const oldValueSafe = log.oldValue;
    const newValueSafe = log.newValue;
    const diffs = useMemo(() => getAuditDiffs(oldValueSafe, newValueSafe), [oldValueSafe, newValueSafe]);
    
    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 text-slate-600 shadow-sm shadow-[#4A8AF4]/5">
                            <FileJson size={14} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold text-slate-800 leading-tight flex items-center gap-2">
                                <span className="capitalize">{log.entity}</span> Record Changes
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                                    log.action === 'create' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    log.action === 'update' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-rose-50 text-rose-600 border-rose-100'
                                )}>
                                    {log.action}
                                </span>
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide">
                                Modified by {log.user?.fullName || `User ${log.actionBy}`}
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                
                {/* Body: Visual Diff List */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {diffs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-500 italic">No significant data changes detected.</div>
                    ) : (
                        <div className="space-y-1">
                            {diffs.map((diff, idx) => (
                                <AuditDiffRow 
                                    key={idx} 
                                    logKey={diff.key} 
                                    oldVal={diff.oldVal} 
                                    newVal={diff.newVal} 
                                    action={log.action} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* --- MAIN COMPONENT --- */

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

    const [selectedLog, setSelectedLog] = useState(null);

    // Access Control
    useEffect(() => {
        if (authLoading) return;
        const hasPermission = user?.role === 'owner' || user?.role === 'admin';
        if (!hasPermission) {
            navigate('/dashboard');
            showToast('You do not have permission to view Audit Logs', 'error');
        }
    }, [user, selectedOrg, authLoading, navigate, showToast]);

    // Pagination & Search Filters
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const searchTerm = '';
    const [filters, setFilters] = useState({ entity: '', action: '' });
    
    // AG Grid Setup
    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: []
    }), []);

    const colDefs = useMemo(() => [
        {
            headerName: "Timestamp",
            field: "actionAt",
            flex: 1.5,
            minWidth: 150,
            sort: 'desc',
            cellRenderer: (params) => (
                 <div className="flex items-center gap-2 h-full">
                     <Clock size={12} className="text-gray-400" />
                     {formatDateTime(params.value, 'UTC')}
                 </div>
            )
        },
        {
            headerName: "User",
            field: "user",
            flex: 1.5,
            minWidth: 150,
            cellRenderer: (params) => {
                 const log = params.data;
                 return (
                     <div className="flex items-center gap-2 h-full">
                         <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-black border border-indigo-100">
                             {log.user?.fullName?.[0] || 'U'}
                         </div>
                         <span className="text-xs font-medium text-gray-700">{log.user?.fullName || `User ${log.actionBy}`}</span>
                     </div>
                 );
            }
        },
        {
            headerName: "Action",
            field: "action",
            flex: 1,
            minWidth: 100,
            cellRenderer: (params) => {
                const action = params.value;
                return (
                     <div className="flex items-center h-full">
                         <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                             {action}
                         </span>
                     </div>
                );
            }
        },
        {
            headerName: "Entity",
            field: "entity",
            flex: 1,
            minWidth: 100,
            cellRenderer: (params) => (
                <div className="flex items-center h-full text-xs font-bold text-gray-600 capitalize">
                    {params.value}
                </div>
            )
        },
        {
            headerName: "Details",
            field: "details_action",
            flex: 1,
            minWidth: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params) => {
                const hasDetails = Boolean(params.data.oldValue || params.data.newValue);
                if (!hasDetails) return null;
                return (
                    <div className="flex items-center justify-end h-full w-full pr-4">
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedLog(params.data); 
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-primary transition-colors focus:outline-none"
                        >
                            View <ChevronDown size={12} className="-rotate-90"/>
                        </button>
                    </div>
                );
            }
        }
    ], [formatDateTime]);

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
        } catch {
            // Ignore cache parse errors
        }
    }, [cacheKey]);

    const fetchLogs = async (signal) => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * pageSize;
            const requestConfig = signal && typeof signal.addEventListener === 'function' ? { signal } : {};

            const response = await apiService.auditLogs.getAll({
                ...filters, limit: pageSize, offset: offset, search: searchTerm
            }, requestConfig);

            if (response.success) {
                setLogs(response.data);
                setTotalItems(response.total || 0);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        logs: Array.isArray(response.data) ? response.data : [],
                        totalItems: response.total || 0
                    }));
                } catch {
                    // Ignore storage errors
                }
            } else {
                setLogs([]);
                setTotalItems(0);
            }
        } catch (error) {
            if (isIgnorableRequestError(error)) return;
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

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const hasNextPage = currentPage < totalPages;
    const showInitialLoader = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);

    return (
        <div className="flex flex-col h-full min-h-0 bg-slate-50/30 relative">
            <div className="flex-none">
                <PageHeader
                    title="User Activity"
                    breadcrumbs={['System', 'User Activity']}
                />
            </div>
            
            <div className="flex-1 relative overflow-y-auto px-4 md:px-4 xl:px-6 pt-1 pb-4 animate-in fade-in duration-500 flex flex-col gap-3 md:gap-4 xl:gap-3 z-10">

                {/* Top Action Row */}
                <div className="sticky top-0 z-20 -mx-4 -mt-1 mb-0 bg-slate-50/50 backdrop-blur supports-[backdrop-filter]:bg-slate-50/50 md:-mx-4 xl:-mx-6">
                    <div className="dashboard-header-pattern px-4 pt-2 pb-1 md:px-4 xl:px-6">
                        <div className="flex flex-col md:flex-row justify-end items-end md:items-center gap-2 md:gap-3">
                            
                            <div className="flex-shrink-0">
                                <CustomSelect
                                    name="entity"
                                    value={filters.entity}
                                    onChange={handleFilterChange}
                                    className="h-9 w-full md:w-auto rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All Entities</option>
                                    <option value="transaction">Transactions</option>
                                    <option value="account">Accounts</option>
                                    <option value="category">Categories</option>
                                    <option value="branch">Branches</option>
                                </CustomSelect>
                            </div>
                            
                            <div className="flex-shrink-0">
                                <CustomSelect
                                    name="action"
                                    value={filters.action}
                                    onChange={handleFilterChange}
                                    className="h-9 w-full md:w-auto rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All Actions</option>
                                    <option value="create">Create</option>
                                    <option value="update">Update</option>
                                    <option value="delete">Delete</option>
                                </CustomSelect>
                            </div>
                            
                            <div className="flex-shrink-0">
                                <button
                                    onClick={() => fetchLogs()}
                                    className="h-9 px-3 flex flex-row items-center justify-center gap-2 rounded-md border bg-white border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-all outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    title="Refresh Logs"
                                >
                                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                    <span className="md:hidden lg:inline">Refresh</span>
                                </button>
                            </div>
                            
                        </div>
                    </div>
                </div>

                {/* Mobile Card View */}
                {!isDesktopView && (
                    <div className="relative flex-1 space-y-4 min-h-0" aria-busy={loading}>
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
                                                {formatDateTime(log.actionAt, 'UTC')}
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
                                                onClick={() => setSelectedLog(log)}
                                                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-bold text-[10px] hover:bg-gray-100 transition-colors border border-gray-100"
                                            >
                                                <FileJson size={12} />
                                                View Payload Diffs
                                                <ArrowRight size={12} className="text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        {showOverlayLoader && <LoadingOverlay label="Loading audit logs..." />}
                    </div>
                )}

                {/* AG Grid Desktop View */}
                {(isDesktopView || typeof window === 'undefined') && (
                    <div className="relative flex-1 min-h-[400px] bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col" aria-busy={loading}>
                        {showInitialLoader ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                <Loader2 size={24} className="text-gray-500 animate-spin" />
                            </div>
                        ) : null}
                        <div className="flex-1 w-full" style={{ "--ag-font-family": "inherit" }}>
                            <AgGridReact
                                theme={themeQuartz.withParams({
                                    backgroundColor: '#ffffff',
                                    foregroundColor: '#374151',
                                    headerBackgroundColor: '#f8fafc',
                                    headerTextColor: '#475569',
                                    rowBorderColor: '#f1f5f9',
                                    cellHorizontalPadding: '16px',
                                    fontSize: '12px',
                                })}
                                rowData={logs}
                                columnDefs={colDefs}
                                defaultColDef={defaultColDef}
                                rowHeight={48}
                                headerHeight={40}
                                suppressCellFocus={true}
                                animateRows={false}
                                domLayout='normal'
                                className="h-full w-full custom-ag-grid no-border-grid"
                                overlayNoRowsTemplate='<span class="text-sm text-gray-500">No logs found</span>'
                                onRowClicked={(e) => {
                                    if(e.data && (e.data.oldValue || e.data.newValue)) {
                                        setSelectedLog(e.data);
                                    }
                                }}
                            />
                        </div>
                        {showOverlayLoader && <LoadingOverlay label="Loading audit logs..." />}
                    </div>
                )}

                {/* Desktop Pagination */}
                <div className="hidden lg:flex items-center justify-between px-2 pt-4 pb-2 flex-none gap-3 sm:gap-0 print:hidden mt-auto">
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

                {/* Mobile Pagination */}
                <div className="lg:hidden py-4 flex flex-col items-center justify-between gap-4">
                    <MobilePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>
            
            {/* Diff Modal overlay */}
            {selectedLog && (
                <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
            )}
        </div>
    );
};

export default AuditLogs;
