import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import {
    Plus,
    Search,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Building2,
    Filter,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Mail,
    Phone,
    FileText,
    Copy,
    ArrowUpDown,
    Loader2
} from 'lucide-react';
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

    // Sorting state (default: createdAt desc)
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination state
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);

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

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'branch') {
                    aValue = (a.branchNames || []).join(', ');
                    bValue = (b.branchNames || []).join(', ');
                }

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [parties, searchTerm, sortConfig, branches]);

    const paginatedParties = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const validParties = Array.isArray(filteredParties) ? filteredParties : [];
        return validParties.slice(startIndex, startIndex + pageSize);
    }, [filteredParties, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredParties.length / pageSize);
    const showInitialLoader = isLoading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(isLoading, hasFetchedOnce);

    // Reset to page 1 when search or page size changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

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
                                onClick={() => navigate('/parties/create')}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                                title="Add New Party"
                            >
                                <Plus size={20} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="relative lg:hidden p-4 space-y-3 print:hidden" aria-busy={isLoading}>
                    {showInitialLoader ? (
                        <div className="py-10 flex items-center justify-center">
                            <Loader2 size={26} className="text-gray-500 animate-spin" />
                        </div>
                    ) : paginatedParties.length === 0 ? (
                        <div className="py-10 text-center text-sm text-gray-500">No parties found.</div>
                    ) : (
                        paginatedParties.map((party, index) => (
                            <div key={party.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
                                <div className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2">
                                    <div>
                                        <div className="flex items-center gap-2 text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">
                                            <span className="font-mono">{(currentPage - 1) * pageSize + index + 1}</span>
                                            <span>Company Name</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-800">{party.companyName || '-'}</div>
                                    </div>
                                    <div className="mt-2">
                                        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Contact Name</div>
                                        <div className="text-xs font-semibold text-gray-700">{party.name || '-'}</div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleStatus(party)}
                                        disabled={!canEditParty}
                                        className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors hover:brightness-95",
                                            party.isActive ? "text-emerald-600" : "text-gray-500",
                                            !canEditParty ? "cursor-default opacity-90" : "cursor-pointer"
                                        )}
                                        title={canEditParty ? "Click to toggle status" : "Status"}
                                    >
                                        {party.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                    {party.phone && party.phone !== '-' && (
                                        <div>
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Phone No.</div>
                                            <div className="text-xs font-medium text-gray-600">{party.phone}</div>
                                        </div>
                                    )}
                                    {party.email && party.email !== '-' && (
                                        <div className="sm:text-right">
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Email</div>
                                            <div className="flex items-center justify-start gap-1.5 sm:justify-end">
                                                <div className="text-xs font-medium text-gray-600 break-all">{party.email}</div>
                                                <button
                                                    onClick={() => handleCopy(party.email, 'Email')}
                                                    className="p-1 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors shrink-0"
                                                    title="Copy Email"
                                                >
                                                    <Copy size={12} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {party.gstNo && party.gstNo !== '-' && (
                                        <div>
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">GST No</div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-medium text-gray-600 uppercase">{party.gstNo}</span>
                                                <button
                                                    onClick={() => handleCopy(party.gstNo, 'GST No.')}
                                                    className="p-1 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Copy GST No."
                                                >
                                                    <Copy size={12} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {party.gstName && party.gstName !== '-' && (
                                        <div className="sm:text-right">
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">GST Name</div>
                                            <div className="text-xs font-medium text-gray-600">{party.gstName}</div>
                                        </div>
                                    )}
                                    {party.address && party.address !== '-' && (
                                        <div className="col-span-2">
                                            <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Address</div>
                                            <div className="text-xs text-gray-600 break-words">{party.address}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                    {canEditParty && (
                                        <button
                                            onClick={() => {
                                                navigate('/parties/create', {
                                                    state: {
                                                        party
                                                    }
                                                });
                                            }}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[10px] hover:bg-indigo-100 transition-colors"
                                        >
                                            <Edit size={12} />
                                            Edit
                                        </button>
                                    )}
                                    {canDeleteParty && (
                                        <button
                                            onClick={() => handleDelete(party)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 font-bold text-[10px] hover:bg-rose-100 transition-colors"
                                        >
                                            <Trash2 size={12} />
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {showOverlayLoader && <LoadingOverlay label="Loading parties..." />}
                </div>

                <div className="lg:hidden border-t border-gray-100 p-2 print:hidden">
                    <MobilePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>

                {/* Table Section */}
                <div className="relative hidden lg:block print:block flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar parties-laptop-table-scroll" aria-busy={isLoading}>
                    <table className="w-full text-left border-collapse table-fixed parties-laptop-table">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="bg-gray-50/50 border-y border-gray-200">
                                {(() => {
                                    const baseCols = [
                                        { label: 'ID', key: 'id', width: 'w-[5%]' },
                                        { label: 'Company Name', key: 'companyName', width: 'w-[15%]' },
                                        { label: 'Contact Name', key: 'name', width: 'w-[12%]' },
                                        { label: 'Phone No.', key: 'phone', width: 'w-[11%]' },
                                        { label: 'Email', key: 'email', width: 'w-[14%]' },
                                        { label: 'GST No', key: 'gstNo', width: 'w-[15%]' },
                                        { label: 'Address', key: 'address', width: 'w-[16%]' },
                                        { label: 'Status', key: 'isActive', width: 'w-[6%]' }
                                    ];
                                    return baseCols.map((col) => (
                                        <th
                                            key={col.label}
                                            className={cn(
                                                `${col.width} px-4 py-2 text-[11px] text-left font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/50 group`
                                            )}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>{col.label}</span>
                                                <ArrowUpDown
                                                    size={10}
                                                    className={cn(
                                                        "text-gray-400 group-hover:text-gray-600 transition-opacity",
                                                        sortConfig.key === col.key ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                                                    )}
                                                />
                                            </div>
                                        </th>
                                    ));
                                })()}
                                <th className="w-[6%] pl-6 pr-4 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                    <div className="ml-auto w-12 text-left">Action</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {showInitialLoader ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-8">
                                        <div className="flex items-center justify-center">
                                            <Loader2 size={24} className="text-gray-500 animate-spin" />
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedParties.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">
                                        No parties found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedParties.map((party, index) => (
                                    <tr key={party.id} className="group hover:bg-gray-50/50">
                                        <td className="px-4 py-1.5 whitespace-nowrap">
                                            <span className="text-xs font-bold text-gray-500">{(currentPage - 1) * pageSize + index + 1}</span>
                                        </td>
                                        <td className="px-4 py-1.5 text-xs font-bold text-gray-800">
                                            <span className="text-xs font-bold text-gray-800">{party.companyName || '-'}</span>
                                        </td>
                                        <td className="px-4 py-1.5 text-xs font-semibold text-gray-700">
                                            <span className="text-xs font-semibold text-gray-700">{party.name || '-'}</span>
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap">
                                            <span className="text-xs font-medium text-gray-600">{party.phone}</span>
                                        </td>
                                        <td
                                            className="pl-1 pr-4 py-1.5 whitespace-nowrap cursor-default relative"
                                            onMouseEnter={(e) => {
                                                if (party.email && party.email !== '-') setTooltip({ show: true, text: party.email, x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseMove={(e) => {
                                                if (party.email && party.email !== '-') setTooltip({ show: true, text: party.email, x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-600 truncate max-w-[230px] inline-block hover:text-gray-800 transition-colors">
                                                    {party.email || '-'}
                                                </span>
                                                {party.email && party.email !== '-' && (
                                                    <button
                                                        onClick={() => handleCopy(party.email, 'Email')}
                                                        className="p-1 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors shrink-0"
                                                        title="Copy Email"
                                                    >
                                                        <Copy size={13} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-600 uppercase">
                                                    {party.gstNo || '-'}
                                                </span>
                                                {party.gstNo && typeof party.gstNo === 'string' && party.gstNo !== '-' && (
                                                    <button
                                                        onClick={() => handleCopy(party.gstNo, 'GST No.')}
                                                        className="p-1 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
                                                        title="Copy GST No."
                                                    >
                                                        <Copy size={13} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        <td
                                            className="pl-1 pr-4 py-1.5 whitespace-nowrap cursor-default relative overflow-hidden"
                                            onMouseEnter={(e) => {
                                                if (party.address && party.address !== '-') setTooltip({ show: true, text: party.address, x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseMove={(e) => {
                                                if (party.address && party.address !== '-') setTooltip({ show: true, text: party.address, x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
                                        >
                                            <span className="block w-full max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-default">
                                                {party.address || '-'}
                                            </span>
                                        </td>
                                        <td className="pl-2 pr-3 py-1.5 text-left">
                                            <button
                                                onClick={() => handleToggleStatus(party)}
                                                disabled={!canEditParty}
                                                className={`
                                                inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors hover:brightness-95 cursor-pointer
                                                ${party.isActive ? "text-emerald-600" : "text-gray-500"}
                                                ${!canEditParty ? 'cursor-default opacity-90' : ''}
                                            `}
                                                title={canEditParty ? "Click to toggle status" : "Status"}
                                            >
                                                {party.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="pl-6 pr-4 py-1.5 print:hidden">
                                            <div className="ml-auto flex w-12 items-center gap-0.5">
                                                {canEditParty && (
                                                    <button
                                                        onClick={() => {
                                                            // Build sibling list: all raw parties that share same name
                                                            // party already has branchIds/branchNames from grouping
                                                            navigate('/parties/create', {
                                                                state: {
                                                                    party
                                                                }
                                                            });
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Edit Party"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                {canDeleteParty && (
                                                    <button
                                                        onClick={() => handleDelete(party)}
                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete Party"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {showOverlayLoader && <LoadingOverlay label="Loading parties..." />}
                </div>

                {/* Pagination */}
                <div className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                    <div className="text-[11px] text-gray-500 font-medium">
                        Showing <span className="font-bold text-gray-700">{filteredParties.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredParties.length)}</span> of <span className="font-bold text-gray-700">{filteredParties.length}</span> results
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
