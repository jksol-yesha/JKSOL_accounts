import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { ChevronDown, Building2, Check, Plus, Settings } from 'lucide-react';
import ManageBranchModal from './ManageBranchModal';

const BranchSelector = () => {
    const {
        branches,
        selectedBranch,
        selectedBranchIds,
        setSelectedBranchIds
    } = useBranch();
    const { selectedOrg } = useOrganization();
    const [isOpen, setIsOpen] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [stagedIds, setStagedIds] = useState([]);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    // Sync stagedIds when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setStagedIds(selectedBranchIds);
        }
    }, [isOpen, selectedBranchIds]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const width = 288;
            const viewportWidth = window.innerWidth;
            const left = Math.min(
                Math.max(12, rect.left + rect.width / 2 - width / 2),
                Math.max(12, viewportWidth - width - 12)
            );

            setDropdownPosition({
                top: rect.bottom + 8,
                left
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedTrigger = dropdownRef.current?.contains(event.target);
            const clickedMenu = dropdownMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedMenu) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Hide Branch Selector only if no Organization is selected or no branches exist
    if (!selectedOrg || (branches || []).length === 0) return null;

    const selectedBranchNameList = (branches || [])
        .filter(branch => selectedBranchIds.includes(Number(branch.id)))
        .map(branch => branch.name)
        .filter(Boolean);
    const allBranchNames = (branches || [])
        .filter(branch => branch?.name)
        .map(branch => branch.name);
    const displayNames = selectedBranch?.id === 'all' ? allBranchNames : selectedBranchNameList;
    const allBranchLabel = displayNames.slice(0, 2).join('+');
    const remainingBranchCount = Math.max(0, displayNames.length - 2);

    const isAllStagedSelected = branches.length > 0 && branches.every(b => stagedIds.includes(Number(b.id)));
    const canManageBranches = ['owner', 'admin'].includes(selectedOrg?.role?.toLowerCase());

    const handleApply = () => {
        if (stagedIds.length === 0) {
            return;
        }
        setSelectedBranchIds(stagedIds);
        setIsOpen(false);
    };

    const toggleStagedBranch = (id) => {
        setStagedIds(prev => {
            const exists = prev.includes(Number(id));
            const next = exists ? prev.filter(x => x !== Number(id)) : [...prev, Number(id)];
            return next.length === 0 ? prev : next;
        });
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    className="group relative flex items-center gap-1.5 md:gap-2 px-1.5 py-1 md:px-2 md:py-1.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-100 hover:translate-x-1 hover:shadow-sm transition-all duration-200 text-xs md:text-sm font-medium text-gray-700"
                >
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                        <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    {selectedBranch?.id === 'all' || selectedBranch?.id === 'multi' ? (
                        <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
                            <span className="max-w-[80px] md:max-w-[140px] truncate text-xs md:text-sm font-bold text-slate-800">
                                {allBranchLabel || 'All Branches'}
                            </span>
                            {remainingBranchCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 leading-none shrink-0">
                                    <span>{remainingBranchCount}</span>
                                    <Plus size={9} />
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="max-w-[70px] md:max-w-[120px] truncate text-xs md:text-sm font-bold text-slate-800">
                            {selectedBranch?.name || 'Select Branch'}
                        </span>
                    )}
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ml-0.5 md:ml-1 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <>
                        {dropdownPosition && createPortal(
                            <>
                                <div className="fixed inset-0 z-[90] bg-transparent" onClick={() => setIsOpen(false)} />
                                <div
                                    ref={dropdownMenuRef}
                                    className="fixed w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in-95 duration-200"
                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                >
                                    <div className="px-3 py-1.5 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Switch Branch</p>
                                            <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100 font-medium">
                                                Total-{(branches || []).length}
                                            </span>
                                        </div>
                                        {canManageBranches && (
                                            <button
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    setShowManageModal(true);
                                                }}
                                                className="group inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-all hover:border-gray-200 hover:bg-white hover:text-primary"
                                                title="Branch Settings"
                                            >
                                                <Settings size={15} strokeWidth={1.7} className="transition-colors" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto no-scrollbar py-1">
                                {/* All Branches Aggregation Option */}
                                {branches.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (isAllStagedSelected) {
                                                setStagedIds([Number(branches[0].id)]);
                                            } else {
                                                setStagedIds(branches.map(b => Number(b.id)));
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors group hover:bg-gray-50 border-b border-gray-50`}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAllStagedSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                                <Building2 size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isAllStagedSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    All Branches
                                                </p>
                                            </div>
                                        </div>
                                        {isAllStagedSelected && (
                                            <Check size={16} className="text-primary" />
                                        )}
                                    </button>
                                )}

                                {(branches || []).map(branch => {
                                    const isInactive = branch.status === 'inactive';
                                    const isStaged = stagedIds.includes(Number(branch.id));
                                    return (
                                        <button
                                            key={branch.id}
                                            disabled={isInactive}
                                            onClick={() => {
                                                if (isInactive) return;
                                                toggleStagedBranch(branch.id);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors group ${isInactive
                                                ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                                : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isStaged ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                                    <Building2 size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <p className={`min-w-0 flex-1 truncate text-sm font-medium ${isStaged && !isInactive ? 'text-gray-900' : 'text-gray-600'}`}>
                                                            {branch.name}
                                                        </p>
                                                        {isInactive && (
                                                            <span className="shrink-0 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                        <span className="truncate max-w-[80px] font-medium text-gray-400">{branch.currencyCode}</span>
                                                        {branch.userRole && selectedOrg?.role !== 'owner' && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                <span className="capitalize text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0 rounded text-[10px]">{branch.userRole}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {isStaged && (
                                                <Check size={16} className="text-primary" />
                                            )}
                                        </button>
                                    );
                                })}
                                    </div>

                                    <div className="px-3 py-1.5 border-t border-gray-50 flex justify-end">
                                        <button
                                            onClick={handleApply}
                                            className="bg-black text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-md active:scale-95 transition-all hover:bg-black/90"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </>,
                            document.body
                        )}
                    </>
                )}
            </div>
            <ManageBranchModal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
            />
        </>
    );
};

export default BranchSelector;
