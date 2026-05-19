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

const normalizePartyRecord = (party) => ({
    ...party,
    isActive: party?.isActive !== undefined ? party.isActive : party?.status === 1
});

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
        menuTabs: [],
        cellStyle: { fontSize: '12px' }
    }), []);

    const colDefs = useMemo(() => [
        {
            headerName: "ID",
            valueGetter: "node.rowIndex + 1",
            maxWidth: 70,
            cellRenderer: (params) => (
                <span className="text-[12px] font-bold text-gray-400">{params.value}</span>
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
                <span className="text-[12px] font-medium text-gray-600">{params.value || '-'}</span>
            )
        },
        {
            headerName: "Email",
            field: "email",
            flex: 1.5,
            minWidth: 180,
            cellRenderer: (params) => (
                <div className="flex items-center gap-2 h-full w-full">
                    <span className="text-[12px] font-medium text-gray-600 truncate max-w-[150px]" title={params.value}>
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
                    <span className="text-[12px] font-medium text-gray-600 uppercase" title={params.value}>
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
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
                            params.value ? "text-emerald-600" : "text-gray-500",
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

    const gridTheme = useMemo(() => themeQuartz.withParams({
        headerFontSize: 12,
    }), []);

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

    const handlePartySaved = (savedParty) => {
        if (!savedParty?.id) return;

        const normalizedParty = normalizePartyRecord(savedParty);
        setParties(prev => {
            const exists = prev.some(p => p.id === normalizedParty.id);
            const updated = exists
                ? prev.map(p => (p.id === normalizedParty.id ? normalizedParty : p))
                : [normalizedParty, ...prev];

            updated.sort((a, b) => b.id - a.id);
            localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setEditingParty(null);
    };

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <PageContentShell
                header={(
                    <PageHeader
                        title="Parties"
                        breadcrumbs={['Transactions', 'Parties']}
                        onBack={() => navigate('/transactions')}
                    />
                )}
                className="!overflow-visible lg:!overflow-visible"
                contentClassName="p-0 lg:p-0 !overflow-visible lg:!overflow-visible"
                cardClassName="border-none shadow-none rounded-none !overflow-visible max-h-none lg:!max-h-none bg-white"
            >

                {/* Toolbar */}
                <div className="px-5 py-3 flex flex-row items-center justify-between gap-4 relative print:hidden min-h-[60px]">
                    {/* Left: Actions */}
                    <div className="flex items-center gap-3">
                        {canCreateParty && (
                            <button
                                onClick={() => { setEditingParty(null); setIsDrawerOpen(true); }}
                                className="group h-[32px] px-3 flex items-center gap-1.5 justify-center rounded-md border border-blue-200 bg-blue-50/50 text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all text-[12px] font-medium"
                                title="Add Party"
                            >
                                <Plus size={14} strokeWidth={2.5} className="text-[#4A8AF4]/80 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                                <span className="text-[#3B6FC8] group-hover:text-[#2F5FC6] transition-colors">Add Party</span>
                            </button>
                        )}
                    </div>

                    {/* Right: Search */}
                    <div className="flex items-center gap-3">
                        <div className="relative group w-[240px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4A8AF4] transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                }}
                                placeholder="Search"
                                className="w-full pl-9 pr-3 h-[32px] bg-white border border-gray-200 rounded-md text-[13px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#BAE6FD] outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div
                    className="parties-grid-shell relative w-full px-5 pb-1 flex flex-col"
                    style={{ height: '760px' }}
                >
                    <div className="h-full w-full relative">
                        <div className="absolute inset-0">
                            <AgGridReact
                                ref={gridRef}
                                theme={gridTheme}
                                rowData={filteredParties}
                                columnDefs={colDefs}
                                defaultColDef={defaultColDef}
                                rowHeight={42}
                                headerHeight={44}
                                animateRows={true}
                                suppressCellFocus={true}
                                suppressRowClickSelection={true}
                                pagination={true}
                                paginationPageSize={50}
                                paginationPageSizeSelector={[25, 50, 100, 200]}
                                overlayLoadingTemplate='<span class="ag-overlay-loading-center text-primary font-medium text-sm">Loading parties...</span>'
                                overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center text-gray-500 font-medium text-sm">No parties found</span>'
                            />
                        </div>
                    </div>
                </div>

                <CreatePartyDrawer
                    isOpen={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    party={editingParty}
                    onSuccess={handlePartySaved}
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
