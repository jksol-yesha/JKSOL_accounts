import React, { useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import ManageOrganizationModal from './ManageOrganizationModal';

const OrganizationSelector = ({ isCollapsed }) => {
    const { user } = useAuth();
    const { selectedOrg } = useOrganization();
    const [showManageOrgDrawer, setShowManageOrgDrawer] = useState(false);

    const normalizedUserRole = String(user?.role || '').toLowerCase();
    const normalizedGlobalRole = String(user?.globalRole || '').toLowerCase();
    const isMember = normalizedUserRole === 'member';
    const canOpenManageOrg = ['owner', 'admin'].includes(normalizedUserRole) || normalizedGlobalRole === 'owner';

    const handleOpenManageOrg = () => {
        if (isMember || !canOpenManageOrg) return;
        setShowManageOrgDrawer(true);
    };

    return (
        <>
            <button
                onClick={handleOpenManageOrg}
                disabled={isMember || !canOpenManageOrg}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-2.5'} py-2.5 rounded-lg border border-transparent transition-all duration-200 group relative ${isMember || !canOpenManageOrg ? 'cursor-default' : 'text-slate-700 hover:bg-slate-200/50'}`}
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
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                                Organization
                            </span>
                            <span className="text-[14px] font-bold text-slate-800 text-left truncate leading-none">
                                {selectedOrg?.name || 'Select Org'}
                            </span>
                        </div>
                        {!isMember && canOpenManageOrg && (
                            <ChevronDown size={14} className="text-slate-400 transition-colors ml-auto group-hover:text-slate-600" />
                        )}
                    </>
                )}
            </button>

            <ManageOrganizationModal
                isOpen={showManageOrgDrawer}
                onClose={() => setShowManageOrgDrawer(false)}
                initialView={selectedOrg ? 'manage' : 'list'}
                initialOrg={selectedOrg}
            />
        </>
    );
};

export default OrganizationSelector;
