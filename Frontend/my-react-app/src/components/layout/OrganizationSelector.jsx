import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Plus, Settings } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import CreateOrganizationModal from './CreateOrganizationModal';
import ManageOrganizationModal from './ManageOrganizationModal';

const DEFAULT_ORG_LOGO = 'https://cdn.jkcdns.com/logo/jksol_120x120.jpg';

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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isMember ? 'cursor-default' : 'text-gray-900 hover:bg-gray-100 hover:translate-x-1 hover:shadow-sm'
                        }`}
                >
                    <div className="w-[40px] h-[40px] rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-200 overflow-hidden shrink-0 ring-2 ring-white">
                        <img
                            src={selectedOrg?.logo || DEFAULT_ORG_LOGO}
                            alt={selectedOrg?.name || 'Organization Logo'}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {!isCollapsed && (
                        <>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-lg font-bold text-left truncate text-gray-900 leading-tight">
                                    {selectedOrg?.name || 'Select Org'}
                                </span>
                            </div>
                            {!isMember && (
                                <ChevronDown size={14} className={`text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`} />
                            )}
                        </>
                    )}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in-95 duration-100 min-w-[200px]">
                        <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Organizations</p>
                            <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                                {isAdmin ? 1 : organizations.length} total
                            </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto no-scrollbar py-1">
                            {organizations
                                .filter(org => !isAdmin || org.id === selectedOrg?.id)
                                .map(org => (
                                    <div
                                        key={org.id}
                                        onClick={() => {
                                            if (org.status === 'inactive') return;
                                            switchOrganization(org);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-gray-50 transition-colors group cursor-pointer ${org.status === 'inactive' ? 'opacity-50 cursor-not-allowed bg-gray-50/50' : ''}`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0 ${selectedOrg?.id === org.id
                                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                                : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                                                }`}>
                                                <img src={org.logo || DEFAULT_ORG_LOGO} alt={org.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-xs font-bold ${selectedOrg?.id === org.id ? 'text-gray-900' : 'text-gray-600'}`}>
                                                        {org.name}
                                                    </p>
                                                    {org.status === 'inactive' && (
                                                        <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0 rounded font-bold uppercase tracking-wider">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                {org.role && (
                                                    <p className="text-[9px] text-gray-400 capitalize">{org.role}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">

                                            {selectedOrg?.id === org.id && (
                                                <Check size={12} className="text-primary" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>


                        {(canCreate || ['owner', 'admin'].includes(selectedOrg?.role?.toLowerCase())) && (
                            <div className="p-2 border-t border-gray-100 mt-1 space-y-1">
                                {canCreate && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowManageOrgModal(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg border border-dashed border-gray-300 hover:border-primary/50 transition-all group"
                                    >
                                        <Plus size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                                        Manage Organization
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
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg border border-transparent hover:border-gray-200 transition-all group"
                                    >
                                        <Settings size={17} strokeWidth={1.5} className="text-gray-400 group-hover:text-primary transition-colors" />
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
