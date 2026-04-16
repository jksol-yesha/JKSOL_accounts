import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Check, ArrowLeft, Trash2, AlertCircle, Plus, ChevronRight, ChevronDown, Users, Mail, UserPlus, Shield, Loader2, Settings, Edit, Power, GitBranch } from 'lucide-react';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';
import CustomSelect from '../common/CustomSelect';
import { cn } from '../../utils/cn';
import { isValidEmail } from '../../utils/validation';

const CurrencyOption = ({ symbol, code, isSelected }) => (
    <div className="flex items-center gap-2 w-full pr-1">
        <span className={cn(
            "text-[13px] min-w-[16px] text-right font-medium whitespace-nowrap",
            isSelected ? "text-slate-900" : "text-slate-400"
        )}>
            {symbol}
        </span>
        <span className={cn(
            "text-[12px] tracking-wide whitespace-nowrap",
            isSelected ? "font-bold text-slate-900" : "font-medium text-slate-700"
        )}>
            {code}
        </span>
    </div>
);

const TimezoneOption = ({ label, isSelected }) => (
    <div className="flex items-center gap-2 w-full">
        <span className={cn(
            "text-[12px] tracking-wide whitespace-nowrap",
            isSelected ? "font-bold text-slate-900" : "font-medium text-slate-700"
        )}>
            {label}
        </span>
    </div>
);

const parseMemberBranchIds = (branchIds) => {
    if (!branchIds) return [];
    if (Array.isArray(branchIds)) return branchIds.map(Number).filter(Boolean);
    if (typeof branchIds === 'string') {
        try {
            const parsed = JSON.parse(branchIds);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const parseMemberSelectedBranchIds = (member) => {
    const ids = new Set(parseMemberBranchIds(member?.branchIds));

    if (Array.isArray(member?.branches)) {
        member.branches.forEach((branch) => {
            const id = Number(branch?.id ?? branch?.branchId);
            if (Number.isFinite(id) && id > 0) ids.add(id);
        });
    }

    if (Array.isArray(member?.branchRoles)) {
        member.branchRoles.forEach((branchRole) => {
            const id = Number(branchRole?.branchId);
            if (Number.isFinite(id) && id > 0) ids.add(id);
        });
    }

    if (member?.branchId !== undefined && member?.branchId !== null) {
        const id = Number(member.branchId);
        if (Number.isFinite(id) && id > 0) ids.add(id);
    }

    return Array.from(ids);
};

const parseMemberBranchNames = (member, allBranches = []) => {
    const names = new Set();
    const memberBranchIds = parseMemberBranchIds(member?.branchIds);

    allBranches
        .filter(branch => memberBranchIds.includes(Number(branch.id)))
        .forEach(branch => {
            if (branch?.name) names.add(branch.name);
        });

    if (Array.isArray(member?.branchNames)) {
        member.branchNames.forEach(name => {
            if (name) names.add(String(name));
        });
    } else if (typeof member?.branchNames === 'string') {
        try {
            const parsed = JSON.parse(member.branchNames);
            if (Array.isArray(parsed)) {
                parsed.forEach(name => {
                    if (name) names.add(String(name));
                });
            } else if (member.branchNames.trim()) {
                member.branchNames.split(',').forEach(name => {
                    const trimmed = name.trim();
                    if (trimmed) names.add(trimmed);
                });
            }
        } catch {
            member.branchNames.split(',').forEach(name => {
                const trimmed = name.trim();
                if (trimmed) names.add(trimmed);
            });
        }
    }

    if (Array.isArray(member?.branches)) {
        member.branches.forEach(branch => {
            if (branch?.name) names.add(String(branch.name));
        });
    }

    if (Array.isArray(member?.branchRoles)) {
        member.branchRoles.forEach(branchRole => {
            if (branchRole?.branchName) names.add(String(branchRole.branchName));
        });
    }

    if (member?.branchName) {
        names.add(String(member.branchName));
    }

    return Array.from(names);
};

const MemberBranchTooltip = ({ branchNames = [], children }) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);

    useLayoutEffect(() => {
        if (!branchNames.length || !visible || !triggerRef.current) return;

        const updatePosition = () => {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                left: Math.max(12, rect.right - 220)
            });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [branchNames.length, visible]);

    if (!branchNames.length) return children;

    return (
        <span
            ref={triggerRef}
            className="inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && position && createPortal(
                <span
                    className="fixed z-[160] min-w-[170px] max-w-[240px] bg-white border border-gray-100 rounded-md shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none"
                    style={{ top: `${position.top}px`, left: `${position.left}px` }}
                >
                    <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Branch Access</span>
                    {branchNames.map((branchName, index) => (
                        <span key={`${branchName}-${index}`} className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-gray-700 truncate">{branchName}</span>
                        </span>
                    ))}
                </span>,
                document.body
            )}
        </span>
    );
};

const ManageOrganizationModal = ({ isOpen, onClose, onCreateNew, initialView = 'list', initialOrg = null }) => {
    const { selectedOrg, setSelectedOrg, refreshOrganizations, organizations } = useOrganization();
    const { user } = useAuth(); // Needed? Maybe for checks later
    const { currencyOptions } = useCurrencyOptions();

    // View State: 'list' | 'manage'
    const [view, setView] = useState(initialView === 'edit' || initialView === 'settings' ? 'manage' : 'list');
    const [editingOrg, setEditingOrg] = useState(initialOrg);

    const [requestError, setRequestError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Member Management State
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMemberEmailError, setInviteMemberEmailError] = useState('');
    const [inviteOwnerEmailError, setInviteOwnerEmailError] = useState('');
    const [selectedOrgRole, setSelectedOrgRole] = useState("3"); // 3=Member
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [allBranches, setAllBranches] = useState([]);
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [memberToEdit, setMemberToEdit] = useState(null);
    const [editingAccessData, setEditingAccessData] = useState({ roleId: 3, branchIds: [] });

    const resetMemberInviteForm = () => {
        setInviteEmail('');
        setInviteName('');
        setInviteMemberEmailError('');
        setInviteOwnerEmailError('');
        setSelectedOrgRole("3");
        setSelectedBranchIds([]);
        setRequestError('');
        setSuccessMessage('');
    };

    // Inline Add Organization State
    const [isAddingOrg, setIsAddingOrg] = useState(initialView === 'create');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        name: '',
        baseCurrency: 'INR',
        timezone: 'Asia/Kolkata',
        logo: null
    });
    const [createLogoPreview, setCreateLogoPreview] = useState(null);

    // Organization Details Form State (for editing)
    const [formData, setFormData] = useState({
        name: '',
        baseCurrency: 'USD',
        timezone: 'Asia/Kolkata',
        logo: null
    });
    const [logoPreview, setLogoPreview] = useState(null);
    const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
    const getInviteEmailError = (email = '', label = 'Email') => {
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail) {
            return `${label} is required.`;
        }

        if (!isValidEmail(normalizedEmail)) {
            return 'Please enter a valid email address.';
        }

        return '';
    };

    const getInviteOwnerEmailError = (email = '') => getInviteEmailError(email, 'Owner email');
    const getInviteMemberEmailError = (email = '') => getInviteEmailError(email, 'Member email');

    const isRegisteredUserEmail = async (email) => {
        try {
            const response = await apiService.auth.getUsers();
            const users =
                Array.isArray(response) ? response :
                    Array.isArray(response?.data) ? response.data :
                        Array.isArray(response?.users) ? response.users : [];

            const targetEmail = normalizeEmail(email);
            return users.some((u) => normalizeEmail(u?.email) === targetEmail);
        } catch (error) {
            console.error('Failed to validate invite email against users list:', error);
            return false;
        }
    };

    // Reset loop when opening
    useEffect(() => {
        if (isOpen) {
            const isManage = initialView === 'edit' || initialView === 'settings' || initialView === 'manage';
            const isOrgAdmin = initialOrg?.role?.toLowerCase() === 'admin';

            setView(isManage ? 'manage' : 'list');
            setEditingOrg(initialOrg || null);

            setFormData({
                name: initialOrg?.name || '',
                baseCurrency: initialOrg?.baseCurrency || 'USD',
                timezone: initialOrg?.timezone || 'Asia/Kolkata',
                logo: initialOrg?.logo || null
            });
            setLogoPreview(initialOrg?.logo || null);

            resetMemberInviteForm();
            setMemberToRemove(null);
            setMemberToEdit(null);
            setEditingAccessData({ roleId: 3, branchIds: [] });
        } else {
            setView('list');
            setEditingOrg(null);
            setRequestError('');
            setSuccessMessage('');
            setMemberToRemove(null);
            setMemberToEdit(null);
        }
    }, [isOpen, initialView, initialOrg]);



    // Fetch Members when in manage view
    useEffect(() => {
        if (view === 'manage' && editingOrg) {
            fetchMembers();
            fetchBranches();
        } else {
            resetMemberInviteForm();
        }
    }, [view, editingOrg]);

    const fetchMembers = async () => {
        setLoadingMembers(true);
        try {
            const response = await apiService.organizations.getMembers(editingOrg.id);
            setMembers(response.data || []);
        } catch (err) {
            console.error("Failed to fetch members:", err);
            setRequestError("Failed to load members.");
        } finally {
            setLoadingMembers(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await apiService.branches.getAll({
                headers: { 'x-org-id': editingOrg.id }
            });
            setAllBranches(response.data || []);
        } catch (err) {
            console.error("Failed to fetch branches:", err);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        const emailToInvite = normalizeEmail(inviteEmail);
        const memberEmailError = getInviteMemberEmailError(emailToInvite);

        if (memberEmailError) {
            setInviteMemberEmailError(memberEmailError);
            return;
        }

        const roleId = parseInt(selectedOrgRole);
        let finalBranchIds = null;

        if (roleId === 3) {
            if (selectedBranchIds.length === 0) {
                setRequestError("Members must be assigned to at least one branch.");
                return;
            }
            finalBranchIds = selectedBranchIds;
        }

        setInviteLoading(true);
        setRequestError('');
        setInviteMemberEmailError('');
        try {
            const emailAlreadyRegistered = await isRegisteredUserEmail(emailToInvite);
            if (emailAlreadyRegistered) {
                setRequestError('This email is already registered. Invitation was not sent.');
                return;
            }

            await apiService.organizations.invite(editingOrg.id, {
                email: emailToInvite,
                name: inviteName,
                branchIds: finalBranchIds,
                role: roleId === 1 ? 'owner' : (roleId === 2 ? 'admin' : 'member')
            });
            setSuccessMessage(`Invitation sent to ${emailToInvite}`);
            setInviteEmail('');
            setInviteName('');
            setInviteMemberEmailError('');
            setSelectedBranchIds([]);
            setSelectedOrgRole(3);
            fetchMembers();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to invite user.");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;
        try {
            await apiService.organizations.removeMember(editingOrg.id, memberToRemove.id);
            setSuccessMessage(`${memberToRemove.name || 'Member'} removed successfully.`);
            setMemberToRemove(null);
            fetchMembers();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to remove member.");
            setMemberToRemove(null);
        }
    };

    const handleUpdateMemberAccess = async () => {
        if (!memberToEdit) return;
        setIsLoading(true);
        try {
            // Transform roleId to role string for backend
            const payload = {
                role: editingAccessData.roleId === 1 ? 'owner' : (editingAccessData.roleId === 2 ? 'admin' : 'member'),
                branchIds: editingAccessData.roleId === 3 ? editingAccessData.branchIds : null
            };
            await apiService.organizations.updateMemberAccess(editingOrg.id, memberToEdit.id, payload);
            setSuccessMessage(`Access updated successfully.`);
            setMemberToEdit(null);
            fetchMembers();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to update member access.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = async (e, org) => {
        e.stopPropagation();
        const newStatus = org.status === 1 ? 2 : 1;
        const action = newStatus === 1 ? 'Activate' : 'Deactivate';

        if (!window.confirm(`Are you sure you want to ${action} organization "${org.name}"?`)) {
            return;
        }

        setIsLoading(true);
        try {
            await apiService.organizations.update(org.id, { status: newStatus });
            refreshOrganizations();
            setSuccessMessage(`Organization '${org.name}' ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error(`Failed to ${action} org:`, error);
            setRequestError(error.response?.data?.message || `Failed to ${action} organization.`);
        } finally {
            setIsLoading(false);
        }
    };
    const handleDeleteOrg = async (e, org) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to archive organization "${org.name}"? It will be removed from active lists but kept in history.`)) {
            return;
        }

        setIsLoading(true);
        try {
            await apiService.organizations.delete(org.id);
            if (selectedOrg?.id === org.id) {
                window.location.reload();
            } else {
                refreshOrganizations();
                setSuccessMessage(`Organization '${org.name}' archived successfully.`);
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Failed to delete org:', error);
            setRequestError(error.response?.data?.message || 'Failed to delete organization.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateOrg = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setRequestError('');
        try {
            await apiService.organizations.update(editingOrg.id, formData);
            setSuccessMessage(`Organization '${formData.name}' updated successfully!`);
            refreshOrganizations();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setRequestError(err.response?.data?.message || 'Update failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setRequestError("Logo must be less than 2MB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, logo: reader.result });
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const openOrganizationManager = (org) => {
        // Auto-select the organization globally
        localStorage.setItem('selectedOrgManual', '1');
        setSelectedOrg(org);
        
        // Removed setView('manage') to stay on the list view as requested
    };





    // Permission Helpers
    // Admins can see this modal, but what can they do?
    // Owners: Delete Org, Invite Admin/Member, Remove Admin/Member
    // Admins: Invite Member, Remove Member (Cannot touch Admins/Owners)
    const canManageMembers = ['owner', 'admin'].includes(editingOrg?.role?.toLowerCase());
    const isEditingOrgOwner = editingOrg?.role?.toLowerCase() === 'owner';
    const allBranchIds = allBranches.map(branch => Number(branch.id)).filter(Boolean);
    const inviteAllBranchesSelected = allBranchIds.length > 0 && selectedBranchIds.length === allBranchIds.length;
    const editSelectedBranchIds = Array.isArray(editingAccessData.branchIds) ? editingAccessData.branchIds.map(Number) : [];
    const editAllBranchesSelected = allBranchIds.length > 0 && editSelectedBranchIds.length === allBranchIds.length;
    const handleCreateFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setRequestError("Logo must be less than 2MB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setCreateFormData({ ...createFormData, logo: reader.result });
                setCreateLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateOrg = async (e) => {
        if (e) e.preventDefault();
        if (!createFormData.name.trim()) return;

        setIsLoading(true);
        setRequestError('');
        try {
            await apiService.organizations.create(createFormData);
            await refreshOrganizations();
            setIsAddingOrg(false);
            setCreateFormData({
                name: '',
                baseCurrency: 'INR',
                timezone: 'Asia/Kolkata',
                logo: null
            });
            setCreateLogoPreview(null);
            setSuccessMessage('Organization created successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setRequestError(err.response?.data?.message || 'Failed to create organization');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-[12px] animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    "manage-org-modal-shell bg-white h-full w-full md:w-[420px] shadow-[0_0_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500 ease-in-out relative flex flex-col",
                    view === 'manage' ? "manage-org-modal-manage" : ""
                )}
            >

                {/* Header */}
                <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-20">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                <Building2 size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                    Manage Organization
                                </h2>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-5 border-b border-gray-200 bg-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.05)] z-20">
                    <button
                        onClick={() => {
                            setView('list');
                        }}
                        className={cn(
                            "px-5 py-3.5 text-[13px] font-bold transition-all relative",
                            view === 'list' ? "text-gray-900" : "text-[#8FA0B4] hover:text-gray-600"
                        )}
                    >
                        Organization
                        {view === 'list' && (
                            <div className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full bg-[#4A8AF4]" />
                        )}
                    </button>
                    <button
                        onClick={() => {
                            if (!editingOrg && selectedOrg) {
                                setEditingOrg(selectedOrg);
                            }
                            setView('manage');
                        }}
                        className={cn(
                            "px-5 py-3.5 text-[13px] font-bold transition-all relative",
                            view === 'manage' ? "text-gray-900" : "text-[#8FA0B4] hover:text-gray-600"
                        )}
                    >
                        Users
                        {view === 'manage' && (
                            <div className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full bg-[#4A8AF4]" />
                        )}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-white">

                    {/* LIST VIEW */}
                    {view === 'list' && (
                        <div className="p-5 space-y-6">
                            {successMessage && (
                                <div className="p-3 bg-green-50 text-green-700 text-sm font-bold rounded-md border border-green-100 flex items-center gap-2">
                                    <Check size={16} /> {successMessage}
                                </div>
                            )}

                            {requestError && (
                                <div className="p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-md border border-red-100 flex items-center gap-2">
                                    <AlertCircle size={16} /> {requestError}
                                </div>
                            )}
                            
                            {/* Add Organization Collapsible */}
                            <div className="bg-white rounded-md overflow-hidden transition-all duration-300 mb-2">
                                <button
                                    onClick={() => setIsAddingOrg(!isAddingOrg)}
                                    className={cn(
                                        "w-full px-4 py-2.5 flex items-center justify-between transition-all group",
                                        isAddingOrg ? "bg-white" : "bg-slate-50/50 hover:bg-slate-100/50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 bg-white border border-slate-200 rounded-md shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                            <Plus size={16} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-[13px] font-extrabold text-slate-900 tracking-tight">Add Organization</span>
                                    </div>
                                    <ChevronDown 
                                        size={14} 
                                        strokeWidth={2.5}
                                        className={cn(
                                            "text-slate-400 transition-transform duration-300",
                                            isAddingOrg ? "rotate-180" : ""
                                        )} 
                                    />
                                </button>

                                {isAddingOrg && (
                                    <div className="px-4 pt-2 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-300">

                                        
                                        {/* Logo Section */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-14 h-14 rounded-md border-[1.5px] border-dashed border-[#4A8AF4]/40 bg-white flex items-center justify-center relative overflow-hidden group/logo">
                                                {createLogoPreview ? (
                                                    <img src={createLogoPreview} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-[#8FA0B4]"><Plus size={20} strokeWidth={2} /></div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleCreateFileChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <h5 className="text-[13.5px] font-bold text-gray-900">Organization Logo</h5>
                                                <p className="text-[11.5px] text-[#8FA0B4] font-medium leading-tight">Square logo recommended. PNG or JPG up to 2MB.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2.5">
                                            <input
                                                type="text"
                                                value={createFormData.name}
                                                onChange={e => setCreateFormData({ ...createFormData, name: e.target.value })}
                                                placeholder="Organization Name"
                                                className="w-full px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 rounded-md text-[13px] font-semibold text-gray-800 outline-none focus:border-[#4A8AF4] transition-all placeholder:text-gray-300 placeholder:font-medium"
                                            />

                                            <CustomSelect
                                                value={createFormData.baseCurrency}
                                                onChange={e => setCreateFormData({ ...createFormData, baseCurrency: e.target.value })}
                                                showSelectedCheck
                                                className="w-full px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 rounded-md text-[13px] font-semibold text-gray-800 outline-none focus:border-[#4A8AF4] transition-all"
                                            >
                                                {currencyOptions
                                                    .filter(c => ['INR', 'USD', 'EUR', 'GBP', 'AED'].includes(c.code))
                                                    .map((currency) => (
                                                    <option key={currency.code} value={currency.code}>
                                                        <CurrencyOption symbol={currency.symbol} code={currency.code} isSelected={createFormData.baseCurrency === currency.code} />
                                                    </option>
                                                ))}
                                            </CustomSelect>

                                            <CustomSelect
                                                value={createFormData.timezone}
                                                onChange={e => setCreateFormData({ ...createFormData, timezone: e.target.value })}
                                                showSelectedCheck
                                                className="w-full px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 rounded-md text-[13px] font-semibold text-gray-800 outline-none focus:border-[#4A8AF4] transition-all"
                                            >
                                                <option value="Asia/Kolkata">
                                                    <TimezoneOption label="Asia/Kolkata" isSelected={createFormData.timezone === 'Asia/Kolkata'} />
                                                </option>
                                                <option value="UTC">
                                                    <TimezoneOption label="UTC" isSelected={createFormData.timezone === 'UTC'} />
                                                </option>
                                                <option value="America/New_York">
                                                    <TimezoneOption label="New York" isSelected={createFormData.timezone === 'America/New_York'} />
                                                </option>
                                                <option value="Europe/London">
                                                    <TimezoneOption label="London" isSelected={createFormData.timezone === 'Europe/London'} />
                                                </option>
                                            </CustomSelect>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-1">
                                            <button
                                                onClick={() => setIsAddingOrg(false)}
                                                className="px-5 py-1.5 text-[12.5px] font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreateOrg}
                                                disabled={isLoading || !createFormData.name.trim()}
                                                className="px-5 py-1.5 text-[12.5px] font-bold text-white bg-[#4A8AF4] rounded-md hover:bg-[#3B7AE6] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Organizations List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8FA0B4]">Organizations</h4>
                                </div>
                                <div className="bg-white rounded-md overflow-hidden divide-y divide-slate-100">
                                    {(organizations || []).map(org => {
                                        const isSelected = selectedOrg?.id === org.id;
                                        return (
                                            <button
                                                key={org.id}
                                                onClick={() => openOrganizationManager(org)}
                                                className={cn(
                                                    "w-full px-4 py-3 transition-all flex items-center gap-4 text-left group/item",
                                                    isSelected 
                                                        ? "bg-[#EEF3FF]" 
                                                        : "bg-white hover:bg-slate-50"
                                                )}
                                            >
                                                {/* Selection Checkmark on Left */}
                                                <div className="w-4 shrink-0 flex items-center justify-center">
                                                    {isSelected && (
                                                        <Check size={16} className="text-[#4A8AF4]" strokeWidth={3} />
                                                    )}
                                                </div>

                                                {/* Organization Icon/Logo */}
                                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-gray-500 font-bold shrink-0 overflow-hidden">
                                                    {org.logo ? (
                                                        <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Building2 size={16} strokeWidth={2} className="text-slate-400 font-black" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className={cn(
                                                        "truncate text-[13px] leading-tight",
                                                        isSelected ? "font-extrabold text-[#4A8AF4]" : "font-bold text-slate-700"
                                                    )}>
                                                        {org.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-400 mt-0.5">
                                                        <span className="capitalize">{org.role || 'Member'}</span>
                                                        <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                                        <span>{org.baseCurrency || 'INR'}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INVITE OWNER VIEW */}
                    {view === 'invite-owner' && (
                        <div className="flex flex-col h-full bg-white">
                            <div className="p-6 space-y-6 flex-1">

                                {successMessage && (
                                    <div className="p-3 bg-green-50 text-green-700 text-sm font-bold rounded-lg border border-green-100 flex items-center gap-2">
                                        <Check size={16} /> {successMessage}
                                    </div>
                                )}

                                {requestError && (
                                    <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-2">
                                        <AlertCircle size={16} /> {requestError}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">Full Name</label>
                                        <div className="relative group">
                                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
                                            <input
                                                type="text"
                                                required
                                                value={inviteName}
                                                onChange={(e) => setInviteName(e.target.value)}
                                                placeholder="Enter full name"
                                                className="w-full pl-10 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[13px] font-semibold outline-none focus:border-[#4A8AF4] focus:bg-white transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">New Owner Email</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
                                            <input
                                                type="email"
                                                required
                                                value={inviteEmail}
                                                onChange={(e) => {
                                                    const nextValue = e.target.value;
                                                    setInviteEmail(nextValue);
                                                    setInviteOwnerEmailError(
                                                        nextValue.trim() ? getInviteOwnerEmailError(nextValue) : ''
                                                    );
                                                    if (requestError) setRequestError('');
                                                }}
                                                onBlur={() => {
                                                    setInviteOwnerEmailError(
                                                        inviteEmail.trim() ? getInviteOwnerEmailError(inviteEmail) : ''
                                                    );
                                                }}
                                                placeholder="Enter email address"
                                                className={cn(
                                                    "w-full pl-10 pr-4 py-1.5 bg-gray-50 border rounded-md text-[13px] font-semibold outline-none focus:bg-white transition-all shadow-sm",
                                                    inviteOwnerEmailError
                                                        ? "border-red-300 text-red-600 focus:border-red-500"
                                                        : "border-gray-200 focus:border-[#4A8AF4]"
                                                )}
                                            />
                                        </div>
                                        {inviteOwnerEmailError && (
                                            <p className="px-1 text-xs font-bold text-red-500">{inviteOwnerEmailError}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-4 mt-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView('list');
                                        setRequestError('');
                                        setSuccessMessage('');
                                        setInviteEmail('');
                                        setInviteName('');
                                        setInviteOwnerEmailError('');
                                    }}
                                    className="flex-1 py-1.5 rounded-md text-[12.5px] font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const emailToInvite = normalizeEmail(inviteEmail);
                                        const ownerEmailError = getInviteOwnerEmailError(emailToInvite);

                                        if (!inviteName.trim()) return;

                                        if (ownerEmailError) {
                                            setInviteOwnerEmailError(ownerEmailError);
                                            return;
                                        }

                                        setInviteLoading(true);
                                        setRequestError('');
                                        setInviteOwnerEmailError('');
                                        try {
                                            const emailAlreadyRegistered = await isRegisteredUserEmail(emailToInvite);
                                            if (emailAlreadyRegistered) {
                                                setRequestError('This email is already registered. Invitation was not sent.');
                                                return;
                                            }

                                            await apiService.organizations.inviteOwner(emailToInvite, inviteName);
                                            setSuccessMessage(`Invitation sent to ${emailToInvite}`);
                                            setInviteEmail('');
                                            setInviteName('');
                                            setInviteOwnerEmailError('');
                                            setTimeout(() => {
                                                setSuccessMessage('');
                                                setView('list');
                                            }, 2000);
                                        } catch (err) {
                                            setRequestError(err.response?.data?.message || "Failed to invite owner.");
                                        } finally {
                                            setInviteLoading(false);
                                        }
                                    }}
                                    disabled={inviteLoading || !inviteName.trim() || Boolean(getInviteOwnerEmailError(inviteEmail))}
                                    className="flex-1 py-3.5 rounded-md text-[13px] font-extrabold text-white bg-black hover:bg-black/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {inviteLoading && <Loader2 size={16} className="animate-spin" />}
                                    Send Invite
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MANAGE VIEW (Users Content) */}
                    {view === 'manage' && editingOrg && (
                        <div className="flex flex-col h-full overflow-hidden bg-white">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="p-5 space-y-6 animate-in fade-in duration-300">
                                        {successMessage && (
                                            <div className="p-3 bg-green-50 text-green-700 text-sm font-bold rounded-md border border-green-100 flex items-center gap-2">
                                                <Check size={16} /> {successMessage}
                                            </div>
                                        )}

                                        {requestError && (
                                            <div className="p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-md border border-red-100 flex items-center gap-2">
                                                <AlertCircle size={16} /> {requestError}
                                            </div>
                                        )}

                                        {/* Add User Collapsible */}
                                        {canManageMembers && (
                                            <div className="bg-white rounded-md overflow-hidden transition-all duration-300 mb-2">
                                                <button
                                                    onClick={() => setIsAddingUser(!isAddingUser)}
                                                    className={cn(
                                                        "w-full px-4 py-2.5 flex items-center justify-between transition-all group",
                                                        isAddingUser ? "bg-white" : "bg-slate-50/50 hover:bg-slate-100/50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 bg-white border border-slate-200 rounded-md shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                                            <Plus size={16} strokeWidth={2.5} />
                                                        </div>
                                                        <span className="text-[13px] font-extrabold text-slate-900 tracking-tight">Add User</span>
                                                    </div>
                                                    <ChevronDown 
                                                        size={14} 
                                                        strokeWidth={2.5}
                                                        className={cn(
                                                            "text-slate-400 transition-transform duration-300",
                                                            isAddingUser ? "rotate-180" : ""
                                                        )} 
                                                    />
                                                </button>

                                                {isAddingUser && (
                                                    <div className="px-4 pt-2 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-300">

                                                        
                                                        <div className="space-y-2.5">
                                                            <div className="relative group">
                                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#4A8AF4] transition-colors" size={17} />
                                                                <input
                                                                    type="text"
                                                                    value={inviteName}
                                                                    onChange={e => setInviteName(e.target.value)}
                                                                    placeholder="Full Name"
                                                                    className="w-full pl-10 pr-4 py-1.5 bg-white border border-gray-200 rounded-md text-[13px] font-semibold text-gray-800 outline-none focus:border-[#4A8AF4] hover:border-gray-300 transition-all placeholder:text-gray-300 placeholder:font-medium"
                                                                />
                                                            </div>

                                                            <div>
                                                                <div className="relative group">
                                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#4A8AF4] transition-colors" size={17} />
                                                                    <input
                                                                        type="email"
                                                                        value={inviteEmail}
                                                                        onChange={e => setInviteEmail(e.target.value)}
                                                                        placeholder="Email Address"
                                                                        className={cn(
                                                                            "w-full pl-10 pr-4 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-gray-800 outline-none transition-all hover:border-gray-300 placeholder:text-gray-300 placeholder:font-medium",
                                                                            inviteMemberEmailError ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-[#4A8AF4]"
                                                                        )}
                                                                    />
                                                                </div>
                                                                {inviteMemberEmailError && <p className="text-[11px] font-bold text-red-500 pl-1 mt-1">{inviteMemberEmailError}</p>}
                                                            </div>

                                                            <CustomSelect
                                                                value={selectedOrgRole}
                                                                onChange={e => setSelectedOrgRole(e.target.value)}
                                                                showSelectedCheck
                                                                className="w-full px-4 py-1.5 bg-white border border-gray-200 rounded-md text-[13px] font-semibold text-gray-800 hover:border-gray-300 outline-none focus:border-[#4A8AF4] transition-all"
                                                            >
                                                                <option value="3">Member</option>
                                                                {(isEditingOrgOwner || editingOrg?.role?.toLowerCase() === 'admin') && <option value="2">Admin</option>}
                                                                {isEditingOrgOwner && <option value="1">Owner</option>}
                                                            </CustomSelect>

                                                            {parseInt(selectedOrgRole) === 3 && (
                                                                <div className="space-y-3 pt-1">
                                                                    <div className="flex items-center justify-between px-1">
                                                                        <label className="text-[10px] font-bold text-[#8FA0B4] uppercase tracking-widest flex items-center gap-2">
                                                                            Branch Access <span className="text-red-400">*</span>
                                                                        </label>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (inviteAllBranchesSelected) {
                                                                                    setSelectedBranchIds([]);
                                                                                } else {
                                                                                    setSelectedBranchIds(allBranchIds);
                                                                                }
                                                                            }}
                                                                            className="text-[10px] font-bold text-[#4A8AF4] hover:text-[#3B7AE6] transition-colors"
                                                                        >
                                                                            {inviteAllBranchesSelected ? "Deselect All" : "Select All"}
                                                                        </button>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-2 max-h-[136px] overflow-y-auto custom-scrollbar pr-1">
                                                                        {allBranches.map(branch => {
                                                                            const isSelected = selectedBranchIds.includes(branch.id);
                                                                            return (
                                                                                <div key={branch.id}
                                                                                    onClick={() => {
                                                                                        setSelectedBranchIds(prev =>
                                                                                            prev.includes(branch.id) ? prev.filter(id => id !== branch.id) : [...prev, branch.id]
                                                                                        );
                                                                                    }}
                                                                                    className={cn(
                                                                                        "flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-all overflow-hidden",
                                                                                        isSelected ? "bg-[#EEF3FF] border-[#4A8AF4]/30" : "bg-white border-gray-200 hover:border-gray-300"
                                                                                    )}
                                                                                >
                                                                                    <div className={cn(
                                                                                        "w-4 h-4 shrink-0 rounded-[4px] border-2 flex items-center justify-center transition-all",
                                                                                        isSelected ? "bg-[#4A8AF4] border-[#4A8AF4] text-white" : "border-gray-300 bg-white"
                                                                                    )}>
                                                                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                                                                    </div>
                                                                                    <span className="text-[13px] font-bold text-gray-800 truncate">{branch.name}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-3 pt-1">
                                                            <button
                                                                onClick={() => {
                                                                    setIsAddingUser(false);
                                                                    resetMemberInviteForm();
                                                                }}
                                                                className="flex-1 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleInvite}
                                                                disabled={inviteLoading || !inviteName.trim() || !inviteEmail.trim() || (parseInt(selectedOrgRole) === 3 && selectedBranchIds.length === 0)}
                                                                className="flex-1 py-1.5 text-[12.5px] font-bold text-white bg-[#4A8AF4] rounded-md hover:bg-[#3B7AE6] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                            >
                                                                {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={16} /> Add</>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Users List Header */}
                                        <div className="flex items-center justify-between px-1">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Users</h4>
                                            <span className="text-[10px] font-bold text-slate-300">{members.length}</span>
                                        </div>

                                        {/* Users List */}
                                        <div className="bg-white rounded-md overflow-hidden divide-y divide-slate-100">
                                            {loadingMembers && members.length === 0 ? (
                                                <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                                            ) : members.length > 0 ? members.map(member => (
                                                <div key={member.id} className="group relative flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[13px] shadow-sm shrink-0 ${member.role === 'owner' ? 'bg-amber-100 text-amber-600' : member.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {member.name?.[0] || member.email?.[0] || '?'}
                                                        </div>
                                                        <div className="space-y-0.5 min-w-0">
                                                            <div className="text-[13px] font-bold text-slate-900 leading-tight truncate">{member.name || 'Pending User'}</div>
                                                            <div className="text-[10px] text-slate-400 font-medium leading-tight truncate">{member.email}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <span className={cn(
                                                            "text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase",
                                                            member.role === 'owner' ? "bg-amber-100 text-amber-600" : 
                                                            member.role === 'admin' ? "bg-indigo-100 text-indigo-600" : 
                                                            "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {member.role === 'owner' ? 'OWNER' : member.role === 'admin' ? 'ADMIN' : 'MEMBER'}
                                                        </span>

                                                        {canManageMembers && member.id !== user?.id && (
                                                            <div className="flex items-center gap-0.5 mt-0.5">
                                                                <button
                                                                    onClick={() => {
                                                                        setMemberToEdit(member);
                                                                        const roleId = member.role === 'owner' ? 1 : (member.role === 'admin' ? 2 : 3);
                                                                        setEditingAccessData({ roleId, branchIds: parseMemberSelectedBranchIds(member) });
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-[#4A8AF4] hover:bg-[#EEF3FF] rounded-md transition-all"
                                                                >
                                                                    <Edit size={13} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setMemberToRemove({ id: member.id, name: member.name })}
                                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Remove Overlay */}
                                                    {memberToRemove?.id === member.id && (
                                                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-md flex items-center justify-between px-4 z-10 animate-in fade-in duration-200">
                                                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Remove User?</span>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setMemberToRemove(null)} className="text-[10px] font-black text-slate-400 px-3 py-1.5 bg-gray-50 rounded-md">No</button>
                                                                <button onClick={handleRemoveMember} className="text-[10px] font-black text-white bg-red-500 px-4 py-1.5 rounded-md shadow-md">Yes, Remove</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )) : (
                                                <div className="text-center py-12 text-slate-400 text-xs font-bold italic">No members found</div>
                                            )}
                                        </div>
                                    </div>
                            </div>

                            {/* EDIT MEMBER SUB-MODAL */}
                            {memberToEdit && (
                                <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 rounded-md">
                                    <div className="bg-white w-full max-w-[312px] rounded-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300">
                                        <div className="p-4 space-y-4 text-left">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-base font-black text-gray-900 uppercase tracking-tight">Edit Access</h4>
                                                    <p className="text-xs text-gray-500 font-bold truncate max-w-[200px]">{memberToEdit.name || memberToEdit.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => setMemberToEdit(null)}
                                                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all"
                                                >
                                                    <X size={14} strokeWidth={2.5} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Role</label>
                                                    <CustomSelect
                                                        value={editingAccessData.roleId}
                                                        onChange={(e) => setEditingAccessData(prev => ({ ...prev, roleId: parseInt(e.target.value) }))}
                                                        className="w-full px-4 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[13px] font-semibold transition-all outline-none focus:border-[#4A8AF4] focus:bg-white"
                                                    >
                                                        {isEditingOrgOwner && <option value="1">Owner</option>}
                                                        {isEditingOrgOwner && <option value="2">Admin</option>}
                                                        <option value="3">Member</option>
                                                    </CustomSelect>
                                                </div>

                                                {editingAccessData.roleId === 3 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-3 pl-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Branch Access</label>
                                                            {allBranches.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingAccessData(prev => ({
                                                                            ...prev,
                                                                            branchIds: editAllBranchesSelected ? [] : allBranchIds
                                                                        }));
                                                                    }}
                                                                    className="flex items-center gap-2 text-left"
                                                                >
                                                                    <div className={`w-4 h-4 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${editAllBranchesSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                        {editAllBranchesSelected && <Check size={10} strokeWidth={3.5} />}
                                                                    </div>
                                                                    <span className="truncate text-[11px] font-bold text-gray-600">Select All</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="bg-gray-50 border border-gray-100 rounded-md p-2.5 shadow-sm">
                                                            <div className="grid grid-cols-1 gap-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                                                            {allBranches.map(branch => {
                                                                const normalizedBranchId = Number(branch.id);
                                                                const isSelected = editSelectedBranchIds.includes(normalizedBranchId);
                                                                return (
                                                                    <div
                                                                        key={branch.id}
                                                                        onClick={() => {
                                                                            setEditingAccessData(prev => {
                                                                                const currentIds = Array.isArray(prev.branchIds) ? prev.branchIds.map(Number) : [];
                                                                                return {
                                                                                    ...prev,
                                                                                    branchIds: currentIds.includes(normalizedBranchId)
                                                                                        ? currentIds.filter(id => id !== normalizedBranchId)
                                                                                        : [...currentIds, normalizedBranchId]
                                                                                };
                                                                            });
                                                                        }}
                                                                        className={`flex min-w-0 items-center gap-4 p-2.5 rounded-md border cursor-pointer transition-all ${isSelected ? 'bg-[#EEF3FF] border-[#4A8AF4]/30' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'}`}
                                                                    >
                                                                        <div className={`w-5 h-5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                            {isSelected && <Check size={12} strokeWidth={3.5} />}
                                                                        </div>
                                                                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-700">{branch.name}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={() => setMemberToEdit(null)}
                                                    className="flex-1 text-[12.5px] font-bold text-gray-700 bg-white py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleUpdateMemberAccess}
                                                    disabled={isLoading || (editingAccessData.roleId === 3 && editingAccessData.branchIds.length === 0)}
                                                    className="flex-1 text-[12.5px] font-bold text-white bg-[#4A8AF4] py-1.5 rounded-md shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Update'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                )}
            </div>
        </div>
    </div>,
    document.body
);
};

export default ManageOrganizationModal;
