import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);
import CreatePartyDrawer from './components/CreatePartyDrawer';

import {
    Plus,
    Search,
    Edit,
    Trash2,
    Copy,
    Loader2,
    ListMinus,
    ShoppingBag,
    Users
} from 'lucide-react';

const transactionTabs = [
    { label: 'Transactions', key: 'transactions', path: '/transactions', icon: ListMinus },
    { label: 'Categories', key: 'categories', path: '/category', icon: ShoppingBag },
    { label: 'Parties', key: 'parties', path: '/parties', icon: Users }
];

import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import MobilePagination from '../../components/common/MobilePagination';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useDelayedOverlayLoader from '../../hooks/useDelayedOverlayLoader';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import apiService from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import isIgnorableRequestError from '../../utils/isIgnorableRequestError';

const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    name: '',
    loading: false
});

const isUsedPartyDeleteError = (message) => {
    const value = String(message || '');
    return /cannot delete this party because it is used in associated records/i.test(value)
        || /modify (the )?status to 'inactive'/i.test(value);
};

const Parties = () => {
    const navigate = useNavigate();
    const { branches, selectedBranch, getBranchFilterValue } = useBranch();
    const { selectedOrg } = useOrganization();
    const { showToast } = useToast();

    const handleCopy = (text, item) => {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        showToast(`${item} copied to clipboard!`, 'success');
    };

    const socketBranchId = typeof selectedBranch?.id === 'number' ? selectedBranch.id : null;
    const { on } = useWebSocket(socketBranchId);

    const canCreateParty = usePermission('PARTIES_MANAGE');
    const canEditParty = usePermission('PARTIES_MANAGE');
    const canDeleteParty = usePermission('PARTIES_MANAGE');

    const [parties, setParties] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingParty, setEditingParty] = useState(null);

    const gridRef = useRef(null);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
        menuTabs: []
    }), []);

    const myTheme = useMemo(() => themeQuartz.withParams({
        headerHeight: 40,
        rowHeight: 48,
        headerBackgroundColor: '#ffffff',
        headerTextColor: '#9ca3af',
        headerFontWeight: 800,
        headerFontSize: 11,
        rowBorder: { style: 'solid', width: 1, color: '#f3f4f6' },
        wrapperBorder: false,
        wrapperBorderRadius: 0,
        cellHorizontalPadding: 16,
    }), []);

    const colDefs = useMemo(() => [
        {
            headerName: "ID",
            valueGetter: "node.rowIndex + 1",
            maxWidth: 70,
            cellRenderer: (params) => (
                <span className="text-[11px] font-bold text-gray-400">{params.value}</span>
            )
        },
        {
            headerName: "Company Name",
            field: "companyName",
            flex: 1.5,
            minWidth: 150,
            cellRenderer: (params) => (
                <span className="text-[12px] font-bold text-gray-800">{params.value || '-'}</span>
            )
        },
        {
            headerName: "Contact Name",
            field: "name",
            flex: 1.2,
            minWidth: 120,
            cellRenderer: (params) => (
                <span className="text-[12px] font-semibold text-gray-700">{params.value || '-'}</span>
            )
        },
        {
            headerName: "Phone No.",
            field: "phone",
            flex: 1.2,
            minWidth: 120,
            cellRenderer: (params) => (
                <span className="text-[11px] font-medium text-gray-600">{params.value || '-'}</span>
            )
        },
        {
            headerName: "Email",
            field: "email",
            flex: 1.5,
            minWidth: 180,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2 h-full w-full">
                    <span className="text-[11px] font-medium text-gray-600 truncate max-w-[150px]" title={params.value}>
                        {params.value || '-'}
                    </span>
                    {params.value && params.value !== '-' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(params.value, 'Email'); }}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                        >
                            <Copy size={11} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            )
        },
        {
            headerName: "GST No",
            field: "gstNo",
            flex: 1.5,
            minWidth: 160,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2 h-full w-full">
                    <span className="text-[11px] font-medium text-gray-600 uppercase" title={params.value}>
                        {params.value || '-'}
                    </span>
                    {params.value && params.value !== '-' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(params.value, 'GST No.'); }}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                        >
                            <Copy size={11} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            )
        },
        {
            headerName: "Status",
            field: "isActive",
            maxWidth: 100,
            cellRenderer: (params) => (
                <div className="flex items-center h-full">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(params.data); }}
                        disabled={!canEditParty}
                        className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors",
                            params.value ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500",
                            !canEditParty ? "cursor-default opacity-80" : "cursor-pointer hover:brightness-95"
                        )}
                    >
                        {params.value ? 'Active' : 'Inactive'}
                    </button>
                </div>
            )
        },
        {
            headerName: "Action",
            maxWidth: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params) => (
                <div className="flex items-center gap-1 h-full">
                    {canEditParty && (
                        <button
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingParty(params.data);
                                setIsDrawerOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        >
                            <Edit size={12} strokeWidth={2.5} />
                        </button>
                    )}
                    {canDeleteParty && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(params.data); }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                            <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            )
        }
    ], [canEditParty, canDeleteParty]);

    // Tooltip State
    const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);

    const CACHE_KEY = `parties_cache_${selectedOrg?.id}_global`;

    useEffect(() => {
        const controller = new AbortController();

        const fetchParties = async () => {
            if (!selectedOrg) {
                setIsLoading(false);
                return;
            }
            try {
                // Try cache first
                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    setParties(JSON.parse(cachedData));
                    setHasFetchedOnce(true);
                    setIsLoading(false);
                }

                setIsLoading(!cachedData);

                const response = await apiService.parties.getAll(
                    {},
                    { signal: controller.signal, headers: { 'x-org-id': selectedOrg.id } }
                );

                const finalParties = (response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : []);

                // Ensure a base sort so the list is stable
                finalParties.sort((a, b) => b.id - a.id);

                setParties(finalParties);
                localStorage.setItem(CACHE_KEY, JSON.stringify(finalParties));

            } catch (error) {
                if (isIgnorableRequestError(error)) {
                    return; // Ignore component unmount
                }
                console.error('Failed to fetch parties:', error);
                if (error.response?.status !== 401 && error.message !== 'Logout in progress') {
                    showToast('Failed to load parties. Please try again.', 'error');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                    setHasFetchedOnce(true);
                }
            }
        };
        fetchParties();

        return () => {
            controller.abort();
        };
    }, [selectedOrg?.id]);

    // WebSocket Real-time Updates
    useEffect(() => {
        if (!selectedOrg) return;

        const handlePartyCreated = (data) => {
            setParties(prev => {
                // Check if already exists to prevent duplicates
                if (prev.some(p => p.id === data.id)) return prev;
                const updated = [data, ...prev];
                localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
                return updated;
            });
        };

        const handlePartyUpdated = (data) => {
            setParties(prev => {
                const updated = prev.map(p => p.id === data.id ? data : p);
                localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
                return updated;
            });
        };

        const handlePartyDeleted = (data) => {
            setParties(prev => {
                const updated = prev.filter(p => p.id !== data.id);
                localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
                return updated;
            });
        };

        const unsubCreate = on('party:created', handlePartyCreated);
        const unsubUpdate = on('party:updated', handlePartyUpdated);
        const unsubDelete = on('party:deleted', handlePartyDeleted);

        return () => {
            if (unsubCreate) unsubCreate();
            if (unsubUpdate) unsubUpdate();
            if (unsubDelete) unsubDelete();
        };
    }, [selectedOrg, on, CACHE_KEY]);

    const filteredParties = useMemo(() => {
        let result = Array.isArray(parties) ? [...parties] : [];

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.name?.toLowerCase().includes(lowerSearch) ||
                p.email?.toLowerCase().includes(lowerSearch) ||
                p.phone?.toLowerCase().includes(lowerSearch) ||
                p.gstNo?.toLowerCase().includes(lowerSearch) ||
                p.gstName?.toLowerCase().includes(lowerSearch)
            );
        }

        return result;
    }, [parties, searchTerm]);

    const showInitialLoader = isLoading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(isLoading, hasFetchedOnce);

    const handleDelete = (party) => {
        setDeleteDialog({
            open: true,
            id: party.id,
            name: party.name || '',
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
            await apiService.parties.delete(deleteDialog.id);
            setParties(prev => prev.filter(p => p.id !== deleteDialog.id));
            setDeleteDialog(createInitialDeleteDialog());
            showToast('Party archived successfully.', 'success');
        } catch (error) {
            console.error("Failed to delete party:", error);
            const msg = error.response?.data?.message || "Failed to delete party";
            setDeleteDialog(createInitialDeleteDialog());
            showToast(
                msg,
                'error',
                isUsedPartyDeleteError(msg)
                    ? {
                        persistent: true,
                        duration: 0
                    }
                    : undefined
            );
        }
    };

    const handleToggleStatus = async (party) => {
        if (!canEditParty) {
            showToast("You don't have permission to edit parties.", 'error');
            return;
        }

        try {
            const newStatus = party.isActive ? false : true;

            // Optimistic update
            setParties(prev => prev.map(p =>
                p.id === party.id ? { ...p, isActive: newStatus, status: newStatus ? 1 : 2 } : p
            ));

            await apiService.parties.update(party.id, { isActive: newStatus });
            showToast(`Party status updated to ${newStatus ? 'Active' : 'Inactive'}`, 'success');

        } catch (error) {
            console.error("Failed to update status:", error);
            // Revert on failure
            setParties(prev => prev.map(p =>
                p.id === party.id ? { ...p, isActive: party.isActive, status: party.status } : p
            ));
            showToast(error.response?.data?.message || "Failed to update party status", "error");
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <PageContentShell
                header={(
                    <PageHeader
                        title="Parties"
                        breadcrumbs={['Dashboard', 'Parties']}
                        tabs={transactionTabs}
                        activeTab="parties"
                    />
                )}
            >

                {/* Toolbar */}
                <div className="p-4 flex flex-row items-center justify-between gap-4 border-b border-gray-50 relative print:hidden min-h-[74px]">
                    {/* Left: Search */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative group w-full lg:w-64 max-w-sm lg:max-w-none">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search parties..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f9] border border-transparent rounded-xl text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Create Button */}
                        {canCreateParty && (
                            <button
                                onClick={() => { setEditingParty(null); setIsDrawerOpen(true); }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                                title="Add New Party"
                            >
                                <Plus size={20} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Table Section */}
                <div className="relative flex-1 min-h-[400px] bg-white w-full overflow-hidden">
                    <style>{`
                        .custom-parties-grid .ag-root-wrapper { border: none !important; }
                        .custom-parties-grid .ag-header { border-bottom: 1px solid #f3f4f6 !important; }
                        .custom-parties-grid .ag-header-cell {
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                    `}</style>
                    <div className="absolute inset-0 custom-parties-grid">
                        <AgGridReact
                            ref={gridRef}
                            theme={myTheme}
                            rowData={filteredParties}
                            columnDefs={colDefs}
                            defaultColDef={defaultColDef}
                            animateRows={true}
                            suppressCellFocus={true}
                            suppressRowClickSelection={true}
                            overlayLoadingTemplate='<div class="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 class="animate-spin mb-2" size=24/><span>Loading parties...</span></div>'
                            overlayNoRowsTemplate='<div class="flex flex-col items-center justify-center h-full text-slate-500 text-sm">No parties found</div>'
                        />
                    </div>
                </div>

                <CreatePartyDrawer 
                    isOpen={isDrawerOpen} 
                    onClose={() => setIsDrawerOpen(false)} 
                    party={editingParty}
                    onSuccess={() => { }}
                />
            </PageContentShell>

            <ConfirmDialog
                open={deleteDialog.open}
                title="Delete Party"
                message={deleteDialog.name
                    ? `Are you sure you want to archive "${deleteDialog.name}"? It will be hidden from active lists.`
                    : 'Are you sure you want to archive this party? It will be hidden from active lists.'}
                confirmLabel="Yes, Delete Party"
                isSubmitting={deleteDialog.loading}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            />

            {/* Global Tooltip */}
            {tooltip.show && (
                <div
                    className="fixed z-[99999] px-3 py-2 bg-white text-gray-800 text-[11px] font-semibold rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 break-words pointer-events-none w-max max-w-[280px]"
                    style={{
                        left: Math.min(tooltip.x + 15, window.innerWidth - 300) + 'px',
                        top: Math.min(tooltip.y + 20, window.innerHeight - 80) + 'px',
                    }}
                >
                    {tooltip.text}
                </div>
            )}
        </div>
    );
};

export default Parties;
