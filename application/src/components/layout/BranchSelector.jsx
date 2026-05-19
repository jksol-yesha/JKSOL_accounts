import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import { ChevronDown, Building2, Check, Plus, Settings } from 'lucide-react';
import ManageBranchModal from './ManageBranchModal';

const BranchSelector = ({ hideSettings = false, flatSelectAll = false, compactLaptop = false }) => {
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
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

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

    // Traversal logic
    const totalItems = (branches?.length || 0) > 0 ? branches.length + 2 : 0;
    // 0: Select All
    // 1 to N: Branches
    // N + 1: Apply

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(0); // Start at Select All
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex === 0) {
                    if (isAllStagedSelected) {
                        setStagedIds([Number(branches[0].id)]);
                    } else {
                        setStagedIds(branches.map(b => Number(b.id)));
                    }
                } else if (highlightedIndex > 0 && highlightedIndex <= branches.length) {
                    const branch = branches[highlightedIndex - 1];
                    if (branch.status !== 'inactive') {
                        toggleStagedBranch(branch.id);
                    }
                } else if (highlightedIndex === branches.length + 1) {
                    handleApply();
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                buttonRef.current?.focus();
                break;
            case 'Tab':
                // Cleanly close and apply if they natively tab away
                handleApply();
                setHighlightedIndex(-1);
                break;
        }
    };

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
    const triggerCompactClassName = compactLaptop ? 'lg:px-2 lg:gap-1.5 2xl:px-3 2xl:gap-2' : '';
    const allBranchesLabelClassName = compactLaptop
        ? 'max-w-[150px] lg:max-w-[118px] 2xl:max-w-[150px]'
        : 'max-w-[150px]';
    const selectionLabelClassName = compactLaptop
        ? 'max-w-[120px] lg:max-w-[94px] 2xl:max-w-[120px]'
        : 'max-w-[120px]';
    const selectionRowCompactClassName = compactLaptop ? 'lg:gap-1 2xl:gap-1.5' : '';
    const chevronCompactClassName = compactLaptop ? 'lg:ml-0.5 2xl:ml-1' : 'ml-1';

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
                    onClick={() => {
                        const next = !isOpen;
                        setIsOpen(next);
                        if (next) setHighlightedIndex(0);
                        else setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    className={`group relative flex items-center gap-2 px-3 h-[32px] rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all ${triggerCompactClassName}`}
                >
                    <Building2 size={16} className="text-gray-400 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors" />
                    {isAllBranchesApplied ? (
                        <span className={`${allBranchesLabelClassName} truncate text-[12px] font-medium text-slate-800`}>
                            All Branches
                        </span>
                    ) : selectedBranch?.id === 'all' || selectedBranch?.id === 'multi' ? (
                        <div className={`flex items-center gap-1.5 min-w-0 ${selectionRowCompactClassName}`}>
                            <span className={`${selectionLabelClassName} truncate text-[12px] font-medium text-slate-800`}>
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
                        <span className={`${selectionLabelClassName} truncate text-[12px] font-medium text-slate-800`}>
                            {selectedBranch?.name || 'Select Branch'}
                        </span>
                    )}
                    <ChevronDown size={14} className={`transition-transform ${chevronCompactClassName} ${isOpen ? 'rotate-180 text-[#4A8AF4]' : 'text-gray-400 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]'}`} />
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
                                    <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
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
                                                    className={`group flex items-center gap-1.5 text-[11px] font-bold transition-colors uppercase tracking-wider rounded-md px-2 py-1 -ml-2 ${isAllStagedSelected ? 'text-[#2F5FC6]' : 'text-slate-500 hover:text-slate-800'}`}
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
                                            {!hideSettings && canManageBranches && (
                                                <button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setShowManageModal(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-[#4A8AF4] border border-transparent hover:border-[#BAE6FD] hover:bg-[#F0F9FF] rounded-md transition-colors"
                                                    title="Manage Branches"
                                                >
                                                    <Settings size={13} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="max-h-[128px] overflow-y-auto custom-scrollbar py-1">
                                {(branches || []).map((branch, idx) => {
                                    const isInactive = branch.status === 'inactive';
                                    const isStaged = stagedIds.includes(Number(branch.id));
                                    const isHighlighted = highlightedIndex === idx + 1;
                                    return (
                                        <button
                                            key={branch.id}
                                            disabled={isInactive}
                                            onClick={() => {
                                                if (isInactive) return;
                                                toggleStagedBranch(branch.id);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors group ${isInactive ? 'opacity-50 bg-slate-50 cursor-not-allowed' : isHighlighted ? 'bg-[#EEF0FC]' : 'hover:bg-[#EEF0FC]'}`}
                                        >
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <div className="w-4 flex justify-center shrink-0">
                                                    {isStaged && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                                </div>
                                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                    <p className={`min-w-0 truncate tracking-tight text-[12px] ${isStaged && !isInactive ? 'font-bold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
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

                                    <div className="mt-1 pt-1 border-t border-slate-100 bg-white flex justify-end gap-1.5 px-1 pb-0.5">
                                        <button
                                            onClick={handleApply}
                                            className={`h-6 rounded-md bg-[#4A8AF4] px-4 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#3E79DE] hover:scale-[1.02] active:scale-[0.98] ${highlightedIndex === branches.length + 1 ? 'ring-2 ring-[#4A8AF4]/20 ring-offset-1' : ''}`}
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
