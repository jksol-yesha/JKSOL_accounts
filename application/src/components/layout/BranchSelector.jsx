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
    const isAllBranchesApplied = branches.length > 0 && branches.every(b => selectedBranchIds.includes(Number(b.id)));
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
                    className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <Building2 size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                    {isAllBranchesApplied ? (
                        <span className="max-w-[150px] truncate text-sm font-semibold text-slate-800">
                            All Branches
                        </span>
                    ) : selectedBranch?.id === 'all' || selectedBranch?.id === 'multi' ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="max-w-[120px] truncate text-sm font-semibold text-slate-800">
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
                        <span className="max-w-[120px] truncate text-sm font-semibold text-slate-800">
                            {selectedBranch?.name || 'Select Branch'}
                        </span>
                    )}
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ml-1 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                </button>

                {isOpen && (
                    <>
                        {dropdownPosition && createPortal(
                            <>
                                <div
                                    ref={dropdownMenuRef}
                                    className="fixed min-w-[240px] w-64 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-[100] animate-in fade-in zoom-in-95 duration-200"
                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                >
                                    <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {branches.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        if (isAllStagedSelected) {
                                                            setStagedIds([Number(branches[0].id)]);
                                                        } else {
                                                            setStagedIds(branches.map(b => Number(b.id)));
                                                        }
                                                    }}
                                                    className={`group flex items-center gap-1.5 text-[11px] font-bold transition-colors ${isAllStagedSelected ? 'text-[#2F5FC6]' : 'text-slate-500 hover:text-slate-800'} uppercase tracking-wider`}
                                                >
                                                    <div className="w-4 flex justify-center shrink-0">
                                                        <Check 
                                                            size={14} 
                                                            className={`${isAllStagedSelected ? 'text-[#4A8AF4]' : 'text-slate-200 group-hover:text-slate-300'} transition-colors`} 
                                                            strokeWidth={isAllStagedSelected ? 3 : 2.5} 
                                                        />
                                                    </div>
                                                    Select All
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center">
                                            {canManageBranches && (
                                                <button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setShowManageModal(true);
                                                    }}
                                                    className="bg-slate-100 text-slate-600 hover:bg-[#EEF0FC] hover:text-[#2F5FC6] transition-colors p-1 rounded-md"
                                                    title="Branch Settings"
                                                >
                                                    <Settings size={14} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="max-h-[128px] overflow-y-auto custom-scrollbar py-1">
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
                                            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors group ${isInactive ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:bg-[#EEF0FC]'}`}
                                        >
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <div className="w-4 flex justify-center shrink-0">
                                                    {isStaged && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                                </div>
                                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                    <p className={`min-w-0 truncate tracking-tight text-[13px] ${isStaged && !isInactive ? 'font-bold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
                                                        {branch.name}
                                                    </p>
                                                    {isInactive && (
                                                        <span className="shrink-0 text-[10px] text-rose-500 font-medium ml-1">
                                                            (Inactive)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#4A8AF4]/70 shrink-0 ml-2">
                                                {branch.currencyCode}
                                            </span>
                                        </button>
                                    );
                                })}
                                    </div>

                                    <div className="px-2 pt-1.5 pb-1 border-t border-slate-100 bg-white flex justify-end">
                                        <button
                                            onClick={handleApply}
                                            className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold px-4 py-1.5 rounded-md shadow-sm active:scale-95 transition-all"
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
