import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Check, ArrowLeft, Trash2, AlertCircle, Plus, ChevronRight, ChevronDown, Users, Mail, UserPlus, Shield, Loader2, Settings, Edit, Power, GitBranch } from 'lucide-react';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import CustomSelect from '../common/CustomSelect';
import { cn } from '../../utils/cn';

const parseMemberBranchIds = (branchIds) => {
    if (!branchIds) return [];
    if (Array.isArray(branchIds)) return branchIds.map(Number).filter(Boolean);
    if (typeof branchIds === 'string') {
        try {
            const parsed = JSON.parse(branchIds);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
        } catch (error) {
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
        } catch (error) {
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

    if (!branchNames.length) return children;

    useLayoutEffect(() => {
        if (!visible || !triggerRef.current) return;

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
    }, [visible]);

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
                    className="fixed z-[160] min-w-[170px] max-w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none"
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
    const { selectedOrg, refreshOrganizations, switchOrganization, organizations } = useOrganization();
    const { user } = useAuth(); // Needed? Maybe for checks later

    // View State: 'list' | 'manage'
    const [view, setView] = useState(initialView === 'edit' || initialView === 'settings' ? 'manage' : 'list');
    const [activeTab, setActiveTab] = useState(initialView === 'edit' ? 'members' : 'details');
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
    const [selectedOrgRole, setSelectedOrgRole] = useState("3"); // 3=Member
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [allBranches, setAllBranches] = useState([]);
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [memberToEdit, setMemberToEdit] = useState(null);
    const [editingAccessData, setEditingAccessData] = useState({ roleId: 3, branchIds: [] });

    const resetMemberInviteForm = () => {
        setInviteEmail('');
        setInviteName('');
        setSelectedOrgRole("3");
        setSelectedBranchIds([]);
        setRequestError('');
        setSuccessMessage('');
    };

    // Organization Details Form State
    const [formData, setFormData] = useState({
        name: '',
        baseCurrency: 'USD',
        timezone: 'Asia/Kolkata',
        logo: null
    });
    const [logoPreview, setLogoPreview] = useState(null);
    const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

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
            setActiveTab((initialView === 'edit' || isOrgAdmin) ? 'members' : 'details');
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
            setActiveTab('details');
            setEditingOrg(null);
            setRequestError('');
            setSuccessMessage('');
            setMemberToRemove(null);
            setMemberToEdit(null);
        }
    }, [isOpen, initialView, initialOrg]);



    // Fetch Members when in manage view
    useEffect(() => {
        if (view === 'manage' && editingOrg && activeTab === 'members') {
            fetchMembers();
            fetchBranches();
        }
    }, [view, editingOrg, activeTab]);

    useEffect(() => {
        if (view === 'manage' && activeTab !== 'members') {
            resetMemberInviteForm();
        }
    }, [view, activeTab]);

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
        const emailToInvite = inviteEmail.trim();
        if (!emailToInvite) return;

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
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete organization "${org.name}"? This cannot be undone.`)) {
            return;
        }

        setIsLoading(true);
        try {
            await apiService.organizations.delete(org.id);
            if (selectedOrg?.id === org.id) {
                window.location.reload();
            } else {
                refreshOrganizations();
                setSuccessMessage(`Organization '${org.name}' deleted successfully.`);
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
        const isOrgAdmin = org?.role?.toLowerCase() === 'admin';
        setEditingOrg(org);
        setFormData({
            name: org?.name || '',
            baseCurrency: org?.baseCurrency || 'USD',
            timezone: org?.timezone || 'Asia/Kolkata',
            logo: org?.logo || null
        });
        setLogoPreview(org?.logo || null);
        setActiveTab(isOrgAdmin ? 'members' : 'details');
        setView('manage');
    };





    // Permission Helpers
    // Admins can see this modal, but what can they do?
    // Owners: Delete Org, Invite Admin/Member, Remove Admin/Member
    // Admins: Invite Member, Remove Member (Cannot touch Admins/Owners)
    const canManageMembers = ['owner', 'admin'].includes(editingOrg?.role?.toLowerCase());
    const isEditingOrgOwner = editingOrg?.role?.toLowerCase() === 'owner';
    const allBranchIds = allBranches.map(branch => Number(branch.id)).filter(Boolean);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn(
                "bg-white rounded-2xl w-full max-w-[92vw] md:max-w-[760px] shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden flex flex-col transition-all",
                view === 'manage' ? "h-[55vh]" : "max-h-[88vh]"
            )}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-none bg-white rounded-t-2xl z-20">
                    <div className="flex items-center gap-2">

                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            {view === 'list' ? (
                                <>
                                    <Building2 className="text-gray-900" size={24} />
                                    Manage Organizations
                                </>
                            ) : view === 'invite-owner' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setView('list');
                                            setRequestError('');
                                            setSuccessMessage('');
                                            setInviteEmail('');
                                            setInviteName('');
                                        }}
                                        className="mr-1 p-1 text-gray-400 hover:text-black transition-colors"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <Building2 className="text-gray-900" size={24} />
                                    Add Owner
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setView('list');
                                            setActiveTab('details');
                                            setRequestError('');
                                            setSuccessMessage('');
                                            setMemberToRemove(null);
                                            setMemberToEdit(null);
                                        }}
                                        className="mr-1 p-1 text-gray-400 hover:text-black transition-colors"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <Building2 className="text-gray-900" size={24} />
                                    {editingOrg?.role?.toLowerCase() === 'admin' ? 'Manage Members' : 'Edit Organization'}
                                </>
                            )}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50">

                    {/* LIST VIEW */}
                    {view === 'list' && (
                        <div className="p-6 space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Your Organizations</h4>
                                <div className="space-y-3">
                                    {(organizations || []).map(org => (
                                        <button
                                            key={org.id}
                                            onClick={() => openOrganizationManager(org)}
                                            className="w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-center gap-4 group text-left relative overflow-hidden"
                                        >
                                            {/* Organization Icon/Logo */}
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0 border border-gray-200 group-hover:border-gray-300 overflow-hidden">
                                                {org.logo ? (
                                                    <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 size={20} />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">{org.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                                    <span className="uppercase font-medium">{org.role || 'Member'}</span>
                                                    {org.baseCurrency && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <span>{org.baseCurrency}</span>
                                                        </>
                                                    )}
                                                    {org.status === 2 && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-red-300" />
                                                            <span className="text-red-500 font-bold uppercase tracking-tight">Inactive</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {['owner', 'admin'].includes(org.role?.toLowerCase()) && (
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openOrganizationManager(org);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title={org.role?.toLowerCase() === 'admin' ? "Manage Members" : "Edit Organization"}
                                                    >
                                                        {org.role?.toLowerCase() === 'admin' ? <Users size={14} /> : <Edit size={14} />}
                                                    </div>
                                                )}
                                                {org.role?.toLowerCase() === 'owner' && (
                                                    <>
                                                        <div
                                                            onClick={(e) => handleToggleStatus(e, org)}
                                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${org.status === 1 ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                                            title={org.status === 1 ? "Deactivate" : "Activate"}
                                                        >
                                                            <Power size={14} className={org.status === 1 ? "" : "text-green-600"} />
                                                        </div>
                                                        <div
                                                            onClick={(e) => handleDeleteOrg(e, org)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Delete Organization"
                                                        >
                                                            <Trash2 size={14} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Add Owner Button */}
                            {organizations.some(org => org.role?.toLowerCase() === 'owner') && (
                                <button
                                    onClick={() => setView('invite-owner')}
                                    className="w-full bg-gray-50 hover:bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-center justify-between group text-left"
                                >
                                    <div>
                                        <h4 className="text-sm font-bold text-black group-hover:text-primary transition-colors">Add Owner</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Grant full access to all your organizations</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-400 group-hover:scale-110 transition-transform shadow-sm">
                                        <UserPlus size={16} />
                                    </div>
                                </button>
                            )}

                            {organizations.some(org => org.role?.toLowerCase() === 'owner') && onCreateNew && (
                                <div className="h-px bg-gray-200 mx-1" />
                            )}

                            {/* Add New Card */}
                            {onCreateNew && (
                                <button
                                    onClick={onCreateNew}
                                    className="w-full bg-gray-50 hover:bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-center justify-between group text-left"
                                >
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">Add New Organization</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Create a new business entity</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-white transition-colors">
                                        <Plus size={16} />
                                    </div>
                                </button>
                            )}
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
                                                className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-black focus:bg-white transition-all shadow-sm"
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
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="Enter email address"
                                                className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                            />
                                        </div>
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
                                    }}
                                    className="flex-1 py-3.5 rounded-2xl text-sm font-extrabold text-gray-700 bg-white border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const emailToInvite = inviteEmail.trim();
                                        if (!emailToInvite || !inviteName) return;
                                        setInviteLoading(true);
                                        setRequestError('');
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
                                    disabled={inviteLoading || !inviteEmail}
                                    className="flex-1 py-3.5 rounded-2xl text-[13px] font-extrabold text-white bg-black hover:bg-black/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {inviteLoading && <Loader2 size={16} className="animate-spin" />}
                                    Send Invite
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MANAGE VIEW (Details & Members Tabs) */}
                    {view === 'manage' && editingOrg && (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Tabs - Only visible for Owners */}
                            {isEditingOrgOwner && (
                                <div className="flex px-6 border-b border-gray-100 bg-white">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'details' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            Details
                                        </div>
                                        {activeTab === 'details' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('members')}
                                        className={`px-4 py-3 text-sm font-bold transition-all relative ${activeTab === 'members' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users size={16} /> Members
                                        </div>
                                        {activeTab === 'members' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {activeTab === 'details' ? (
                                    <form onSubmit={handleUpdateOrg} className="flex flex-col h-full min-h-full bg-white">
                                        <div className="flex-1 p-6 space-y-6">
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

                                            {/* Logo + Name Section */}
                                            <div className="p-6 min-h-[160px] bg-gray-50/30 rounded-2xl border border-gray-100 border-dashed space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-20 h-20 rounded-xl flex items-center justify-center border border-gray-200 bg-white overflow-hidden relative shrink-0 shadow-sm transition-all hover:border-gray-300 ${!logoPreview ? 'text-gray-300' : ''}`}>
                                                        {logoPreview ? (
                                                            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Plus size={20} />
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleFileChange}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-500 font-medium">Recommended: Square logo, Max 2MB</p>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">Organization Name</label>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            required
                                                            value={formData.name}
                                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                            placeholder="Enter organization name"
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-base font-bold text-slate-700 transition-all outline-none focus:border-black focus:bg-white shadow-sm group-hover:bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                {/* Currency & Timezone Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">Base Currency</label>
                                                        <CustomSelect
                                                            value={formData.baseCurrency}
                                                            onChange={e => setFormData({ ...formData, baseCurrency: e.target.value })}
                                                            dropdownContentClassName="max-h-[102px] overflow-y-auto"
                                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                                        >
                                                            <option value="USD">USD ($)</option>
                                                            <option value="EUR">EUR (€)</option>
                                                            <option value="GBP">GBP (£)</option>
                                                            <option value="INR">INR (₹)</option>
                                                            <option value="AUD">AUD ($)</option>
                                                            <option value="CAD">CAD ($)</option>
                                                            <option value="SGD">SGD ($)</option>
                                                            <option value="AED">AED (dh)</option>
                                                        </CustomSelect>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">Timezone</label>
                                                        <CustomSelect
                                                            value={formData.timezone}
                                                            onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                                            dropdownContentClassName="max-h-[102px] overflow-y-auto"
                                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                                        >
                                                            <option value="Asia/Kolkata">Asia/Kolkata</option>
                                                            <option value="UTC">UTC</option>
                                                            <option value="America/New_York">New York</option>
                                                            <option value="Europe/London">London</option>
                                                        </CustomSelect>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setView('list')}
                                                className="flex-1 py-3.5 rounded-2xl text-sm font-extrabold text-gray-700 bg-white border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="flex-1 py-3.5 rounded-2xl text-sm font-extrabold text-white bg-black hover:bg-gray-900 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isLoading && <Loader2 size={16} className="animate-spin" />}
                                                Update
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="px-3 py-4 space-y-6 animate-in slide-in-from-right-4 duration-300">
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

                                        <div className={`w-full grid gap-4 items-start ${canManageMembers ? 'lg:grid-cols-[minmax(0,0.72fr)_minmax(0,0.84fr)]' : 'grid-cols-1'}`}>
                                            {/* INVITATION FORM */}
                                            {canManageMembers && (
                                                <div className="space-y-6">
                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1 flex items-center gap-2">
                                                        <UserPlus size={14} /> Invite New Member
                                                    </h4>
                                                    <form onSubmit={handleInvite} className="space-y-5">
                                                        <div className="space-y-4">
                                                            <div className="relative group">
                                                                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={16} />
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    value={inviteName}
                                                                    onChange={(e) => setInviteName(e.target.value)}
                                                                    placeholder="Enter full name"
                                                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-[13px] font-bold outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                                                />
                                                            </div>
                                                            <div className="relative group">
                                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={16} />
                                                                <input
                                                                    type="email"
                                                                    required
                                                                    value={inviteEmail}
                                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                                    placeholder="Enter email address"
                                                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-[13px] font-bold outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                                                />
                                                            </div>

                                                            <div className="space-y-1.5 pt-1">
                                                                <CustomSelect
                                                                    value={selectedOrgRole}
                                                                    onChange={(e) => setSelectedOrgRole(parseInt(e.target.value))}
                                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-[13px] font-bold outline-none focus:border-black focus:bg-white transition-all shadow-sm"
                                                                >
                                                                    <option value="3">Member</option>
                                                                    {(isEditingOrgOwner || editingOrg?.role?.toLowerCase() === 'admin') && <option value="2">Admin</option>}
                                                                </CustomSelect>
                                                            </div>

                                                            {parseInt(selectedOrgRole) === 3 && (
                                                                <div className="space-y-3 pt-1.5">
                                                                    <div className="flex items-center justify-between px-1">
                                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                                                                            <GitBranch size={14} className="rotate-90" /> Assign Branch Access <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <span className="text-[10px] font-bold text-indigo-600">{selectedBranchIds.length} branch(es) selected</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                                                        {allBranches.length > 0 ? (
                                                                            <>
                                                                                <div
                                                                                    onClick={() => {
                                                                                        setSelectedBranchIds(prev => (
                                                                                            prev.length === allBranchIds.length ? [] : allBranchIds
                                                                                        ));
                                                                                    }}
                                                                                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border cursor-pointer transition-all ${selectedBranchIds.length === allBranchIds.length ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'}`}
                                                                                >
                                                                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedBranchIds.length === allBranchIds.length ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                                        {selectedBranchIds.length === allBranchIds.length && <Check size={12} strokeWidth={3} />}
                                                                                    </div>
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[13px] font-bold text-gray-900">Select All Branches</span>
                                                                                    </div>
                                                                                </div>
                                                                                {allBranches.map(branch => {
                                                                            const isSelected = selectedBranchIds.includes(branch.id);
                                                                            return (
                                                                                <div key={branch.id}
                                                                                    onClick={() => {
                                                                                        setSelectedBranchIds(prev =>
                                                                                            prev.includes(branch.id)
                                                                                                ? prev.filter(id => id !== branch.id)
                                                                                                : [...prev, branch.id]
                                                                                        );
                                                                                    }}
                                                                                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'}`}
                                                                                >
                                                                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                                                                    </div>
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[13px] font-bold text-gray-900">{branch.name}</span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                            </>
                                                                        ) : (
                                                                            <div className="p-4 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                                                                                <p className="text-xs text-gray-400 font-bold italic">No branches available</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="submit"
                                                            disabled={inviteLoading || !inviteEmail || (parseInt(selectedOrgRole) === 3 && selectedBranchIds.length === 0)}
                                                            className="w-full mt-[-4px] bg-black text-white py-2.5 rounded-2xl font-extrabold text-[12px] hover:bg-black/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                                                        >
                                                            {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : (
                                                                <>
                                                                    <UserPlus size={18} className="group-hover:scale-110 transition-transform" />
                                                                    Send Invitation
                                                                </>
                                                            )}
                                                        </button>
                                                    </form>
                                                </div>
                                            )}

                                            {/* MEMBER LIST */}
                                            <div className={`space-y-4 ${canManageMembers ? 'pt-0' : 'pt-2'}`}>
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-1">Current Members ({members.length})</h4>

                                                <div className="relative min-h-[80px]">
                                                    {loadingMembers && members.length === 0 ? (
                                                        <div className="min-h-[220px] flex items-center justify-center">
                                                            <Loader2 className="animate-spin text-gray-500" size={26} />
                                                        </div>
                                                    ) : (
                                                    <div className="space-y-2.5 max-h-[430px] overflow-y-auto custom-scrollbar pr-1">
                                                        {members.length > 0 ? members.map(member => {
                                                            const memberBranchIds = parseMemberSelectedBranchIds(member);
                                                            const memberBranchNames = parseMemberBranchNames(member, allBranches);

                                                            return (
                                                            <div key={member.id} className="group relative flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[13px] shadow-sm ${member.role === 'owner' ? 'bg-amber-100 text-amber-700' : member.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {member.name?.[0] || member.email?.[0] || '?'}
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <div className="text-[13px] font-extrabold text-gray-900 leading-tight">{member.name || 'Pending User'}</div>
                                                                    <div className="text-xs text-gray-400 font-medium leading-tight">{member.email}</div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                {member.role === 'member' && memberBranchNames.length > 0 ? (
                                                                    <MemberBranchTooltip branchNames={memberBranchNames}>
                                                                        <span className="text-[10px] uppercase font-black px-2 py-1 rounded-lg tracking-wider bg-gray-100 text-gray-500 cursor-default">
                                                                            {member.role}
                                                                        </span>
                                                                    </MemberBranchTooltip>
                                                                ) : (
                                                                    <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-lg tracking-wider ${member.role === 'owner' ? 'bg-amber-50 text-amber-600' : member.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {member.role}
                                                                    </span>
                                                                )}

                                                                {canManageMembers && (member.id !== user?.id) && (
                                                                    (isEditingOrgOwner || (editingOrg?.role === 'admin' && member.role === 'member')) ? (
                                                                        <div className="absolute top-0 right-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 z-10">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setMemberToEdit(member);
                                                                                    const roleId = member.role === 'owner' ? 1 : (member.role === 'admin' ? 2 : 3);
                                                                                    setEditingAccessData({ roleId, branchIds: memberBranchIds.map(Number) });
                                                                                }}
                                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-bl-md transition-all"
                                                                                title="Edit Member"
                                                                            >
                                                                                <Edit size={12} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setMemberToRemove({ id: member.id, name: member.name })}
                                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-bl-md rounded-tr-2xl transition-all"
                                                                                title="Remove Member"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ) : null
                                                                )}
                                                            </div>

                                                            {/* Overlays (Remove) */}
                                                            {memberToRemove?.id === member.id && (
                                                                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-between px-4 z-10 animate-in fade-in duration-200">
                                                                    <span className="text-xs font-black text-red-600 uppercase tracking-wider">Remove this user?</span>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => setMemberToRemove(null)} className="text-xs font-black text-gray-500 px-3 py-2 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                                                        <button onClick={handleRemoveMember} className="text-xs font-black text-white bg-red-600 px-4 py-2 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all">Confirm</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            </div>
                                                        )}) : !loadingMembers ? (
                                                            <div className="text-center py-8 text-sm text-gray-400 font-medium">
                                                                No members found.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    )}
                                                    {loadingMembers && members.length > 0 && (
                                                        <div className="absolute inset-0 z-10 bg-white/35 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center">
                                                            <Loader2 className="animate-spin text-gray-500" size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* EDIT MEMBER SUB-MODAL */}
                            {memberToEdit && (
                                <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 rounded-2xl">
                                    <div className="bg-white w-full max-w-[312px] rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300">
                                        <div className="p-4 space-y-4 text-left">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-base font-black text-gray-900 uppercase tracking-tight">Edit Access</h4>
                                                    <p className="text-xs text-gray-500 font-bold truncate max-w-[200px]">{memberToEdit.name || memberToEdit.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => setMemberToEdit(null)}
                                                    className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Role</label>
                                                    <CustomSelect
                                                        value={editingAccessData.roleId}
                                                        onChange={(e) => setEditingAccessData(prev => ({ ...prev, roleId: parseInt(e.target.value) }))}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold transition-all outline-none focus:border-black focus:bg-white"
                                                    >
                                                        {isEditingOrgOwner && <option value="1">Owner</option>}
                                                        {isEditingOrgOwner && <option value="2">Admin</option>}
                                                        <option value="3">Member</option>
                                                    </CustomSelect>
                                                </div>

                                                {editingAccessData.roleId === 3 && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Branch Access</label>
                                                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-2.5 shadow-sm">
                                                            <div className="grid grid-cols-1 gap-2.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                                            <div
                                                                onClick={() => {
                                                                    setEditingAccessData(prev => ({
                                                                        ...prev,
                                                                        branchIds: prev.branchIds.length === allBranchIds.length ? [] : allBranchIds
                                                                    }));
                                                                }}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${editingAccessData.branchIds.length === allBranchIds.length ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                                                            >
                                                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${editingAccessData.branchIds.length === allBranchIds.length ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                    {editingAccessData.branchIds.length === allBranchIds.length && <Check size={12} strokeWidth={3.5} />}
                                                                </div>
                                                                <span className="truncate text-sm font-bold text-gray-700">Select All Branches</span>
                                                            </div>
                                                            {allBranches.map(branch => {
                                                                const normalizedBranchId = Number(branch.id);
                                                                const normalizedSelectedIds = Array.isArray(editingAccessData.branchIds)
                                                                    ? editingAccessData.branchIds.map(Number)
                                                                    : [];
                                                                const isSelected = normalizedSelectedIds.includes(normalizedBranchId);
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
                                                                        className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                                                                    >
                                                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                                            {isSelected && <Check size={12} strokeWidth={3.5} />}
                                                                        </div>
                                                                        <span className="truncate text-sm font-bold text-gray-700">{branch.name}</span>
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
                                                    className="flex-1 text-xs font-black text-gray-500 bg-gray-50 py-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleUpdateMemberAccess}
                                                    disabled={isLoading || (editingAccessData.roleId === 3 && editingAccessData.branchIds.length === 0)}
                                                    className="flex-1 text-xs font-black text-white bg-black py-4 rounded-2xl shadow-xl shadow-black/10 hover:shadow-black/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
