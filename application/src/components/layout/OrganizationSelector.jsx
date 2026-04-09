import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Plus, Settings } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import CreateOrganizationModal from './CreateOrganizationModal';
import ManageOrganizationModal from './ManageOrganizationModal';

const OrganizationSelector = ({ isCollapsed }) => {
    const { user } = useAuth();
    const { organizations, selectedOrg, switchOrganization } = useOrganization();
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showManageOrgModal, setShowManageOrgModal] = useState(false);
    const [manageModalConfig, setManageModalConfig] = useState({
        view: 'list',
        tab: 'details',
        org: null
    });
    const dropdownRef = useRef(null);

    // Use GLOBAL ROLE for Creation Permissions
    // Strict Owner-Only Policy (as per Step 2831 request)
    const canCreate = ['owner'].includes(user?.globalRole?.toLowerCase()) || ['owner'].includes(user?.role?.toLowerCase());

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Constraint: Members cannot switch organizations
    const isMember = user?.role?.toLowerCase() === 'member';
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => {
                        if (isMember) return;
                        setIsOpen(!isOpen);
                    }}
                    disabled={isMember}
                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg border border-transparent transition-all duration-200 group relative ${isMember ? 'cursor-default' : 'text-slate-700 hover:bg-slate-200/50'}`}
                >
                    <div className="w-9 h-9 rounded bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden text-slate-500 border border-slate-200 transition-colors relative z-10">
                        {selectedOrg?.logo ? (
                            <img
                                src={selectedOrg.logo}
                                alt={selectedOrg?.name || 'Organization Logo'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <Building2 size={18} strokeWidth={2} />
                        )}
                    </div>
                    {!isCollapsed && (
                        <>
                            <div className="flex flex-col items-start min-w-0 pt-0.5">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Organization</span>
                                <span className="text-[14px] font-bold text-slate-800 text-left truncate leading-none">
                                    {selectedOrg?.name || 'Select Org'}
                                </span>
                            </div>
                            {!isMember && (
                                <ChevronDown size={14} className={`text-slate-400 transition-transform ml-auto group-hover:text-slate-600 ${isOpen ? 'rotate-180' : ''}`} />
                            )}
                        </>
                    )}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full min-w-[260px] bg-white rounded shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-slate-200 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-64 overflow-y-auto no-scrollbar">
                            {organizations
                                .filter(org => !isAdmin || org.id === selectedOrg?.id)
                                .map(org => {
                                    const isActive = selectedOrg?.id === org.id;
                                    return (
                                    <div
                                        key={org.id}
                                        onClick={() => {
                                            if (org.status === 'inactive') return;
                                            switchOrganization(org);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                                            org.status === 'inactive' ? 'opacity-50 cursor-not-allowed bg-slate-50' : isActive ? 'bg-slate-50/50' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-slate-100 text-slate-400 border border-slate-200">
                                                {org.logo ? (
                                                    <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 size={12} strokeWidth={2} />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[13px] truncate leading-tight ${isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                        {org.name}
                                                    </span>
                                                    {org.status === 'inactive' && (
                                                        <span className="text-[10px] text-rose-500 font-medium">(Inactive)</span>
                                                    )}
                                                </div>
                                                {org.role && (
                                                    <span className="text-[11px] text-slate-500 capitalize leading-tight mt-0.5">{org.role}</span>
                                                )}
                                            </div>
                                        </div>
                                        {isActive && <Check size={14} className="text-emerald-600 ml-3 shrink-0" strokeWidth={2.5} />}
                                    </div>
                                )})}
                        </div>

                        {(canCreate || ['owner', 'admin'].includes(selectedOrg?.role?.toLowerCase())) && (
                            <div className="mt-1 flex flex-col py-1 border-t border-slate-100">
                                {canCreate && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowManageOrgModal(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-sky-600 hover:text-sky-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        Manage Organizations
                                    </button>
                                )}
                                {['admin'].includes(selectedOrg?.role?.toLowerCase()) && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            setManageModalConfig({
                                                view: 'edit',
                                                org: selectedOrg
                                            });
                                            setShowManageOrgModal(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-sky-600 hover:text-sky-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        Manage Members
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <CreateOrganizationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                initialMode="create"
                onBackToManage={() => {
                    setShowCreateModal(false);
                    setManageModalConfig({
                        view: 'list',
                        tab: 'details',
                        org: null
                    });
                    setShowManageOrgModal(true);
                }}
            />
            <ManageOrganizationModal
                isOpen={showManageOrgModal}
                onClose={() => setShowManageOrgModal(false)}
                onCreateNew={() => {
                    setShowManageOrgModal(false);
                    setShowCreateModal(true);
                }}
                initialView={manageModalConfig.view}
                initialTab={manageModalConfig.tab}
                initialOrg={manageModalConfig.org}
                userRole={selectedOrg?.role} // Pass role to modal
            />
        </>
    );
};

export default OrganizationSelector;
