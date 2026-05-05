import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Save, Check, Camera, X, Building2, Users as UsersIcon, Store, MapPin, Edit2, ChevronDown, Plus, AlertCircle, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useOrganization } from '../../context/OrganizationContext';
import apiService from '../../services/api';
import { cn } from '../../utils/cn';
import { PreferenceSettingsFields } from '../settings/components/PreferenceSettingsSection';
import CustomSelect from '../../components/common/CustomSelect';
import { isValidEmail } from '../../utils/validation';
import ManageOrganizationModal from '../../components/layout/ManageOrganizationModal';

import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);
const customTheme = themeQuartz.withParams({
  browserColorScheme: "light",
  headerBackgroundColor: "#F9F9FB",
  headerTextColor: "#374151",
  headerFontSize: "11px",
  headerFontWeight: "600",
  rowBorderColor: "transparent",
  cellTextColor: "#4b5563",
  wrapperBorderRadius: "0px",
  rowHoverColor: "#ffffff",
  selectedRowBackgroundColor: "#ffffff",
});

const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  cellClass: "font-medium text-gray-600",
  cellStyle: { fontSize: "12px", display: 'flex', alignItems: 'center' },
  headerClass: "text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-[#F9F9FB] !bg-[#F9F9FB]",
};

const Profile = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const { showToast } = useToast();
    const { selectedOrg } = useOrganization();
    const { preferences, updatePreferences } = usePreferences();
    
    const [activeTab, setActiveTab] = useState('Personal');
    const [isEditing, setIsEditing] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        profilePhoto: ''
    });
    const [draftPreferences, setDraftPreferences] = useState(preferences);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteOption, setShowDeleteOption] = useState(false);
    const [error, setError] = useState('');
    const [organizations, setOrganizations] = useState([]);
    const [orgUsers, setOrgUsers] = useState([]);
    const [orgBranches, setOrgBranches] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const fileInputRef = useRef(null);

    const [isAddingUser, setIsAddingUser] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMemberEmailError, setInviteMemberEmailError] = useState('');
    const [selectedOrgRole, setSelectedOrgRole] = useState("3");
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [requestError, setRequestError] = useState('');

    const [memberToEdit, setMemberToEdit] = useState(null);
    const [editingAccessData, setEditingAccessData] = useState({ roleId: 3, branchIds: [] });
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [shouldRenderAddUserDrawer, setShouldRenderAddUserDrawer] = useState(false);
    const [isClosingAddUserDrawer, setIsClosingAddUserDrawer] = useState(false);
    const closeAnimationTimerRef = useRef(null);

    useEffect(() => {
        let openStateTimer = null;
        if (isAddingUser) {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
            openStateTimer = setTimeout(() => {
                setShouldRenderAddUserDrawer(true);
                setIsClosingAddUserDrawer(false);
            }, 0);
            return () => {
                if (openStateTimer) clearTimeout(openStateTimer);
            };
        }

        if (!shouldRenderAddUserDrawer) return;

        openStateTimer = setTimeout(() => {
            setIsClosingAddUserDrawer(true);
        }, 0);

        closeAnimationTimerRef.current = setTimeout(() => {
            setShouldRenderAddUserDrawer(false);
            setIsClosingAddUserDrawer(false);
            closeAnimationTimerRef.current = null;
        }, 280);

        return () => {
            if (openStateTimer) clearTimeout(openStateTimer);
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
        };
    }, [isAddingUser, shouldRenderAddUserDrawer]);

    useEffect(() => {
        return () => {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
            }
        };
    }, []);

    const [isEditingUser, setIsEditingUser] = useState(false);
    const [shouldRenderEditUserDrawer, setShouldRenderEditUserDrawer] = useState(false);
    const [isClosingEditUserDrawer, setIsClosingEditUserDrawer] = useState(false);
    const closeEditAnimationTimerRef = useRef(null);

    // Organization Modal State
    const [isManageOrgModalOpen, setIsManageOrgModalOpen] = useState(false);
    const [manageOrgModalView, setManageOrgModalView] = useState('list');
    const [orgToEditFromProfile, setOrgToEditFromProfile] = useState(null);

    useEffect(() => {
        let openStateTimer = null;
        if (isEditingUser) {
            if (closeEditAnimationTimerRef.current) {
                clearTimeout(closeEditAnimationTimerRef.current);
                closeEditAnimationTimerRef.current = null;
            }
            openStateTimer = setTimeout(() => {
                setShouldRenderEditUserDrawer(true);
                setIsClosingEditUserDrawer(false);
            }, 0);
            return () => {
                if (openStateTimer) clearTimeout(openStateTimer);
            };
        }

        if (!shouldRenderEditUserDrawer) return;

        openStateTimer = setTimeout(() => {
            setIsClosingEditUserDrawer(true);
        }, 0);

        closeEditAnimationTimerRef.current = setTimeout(() => {
            setShouldRenderEditUserDrawer(false);
            setIsClosingEditUserDrawer(false);
            setMemberToEdit(null);
            closeEditAnimationTimerRef.current = null;
        }, 280);

        return () => {
            if (openStateTimer) clearTimeout(openStateTimer);
            if (closeEditAnimationTimerRef.current) {
                clearTimeout(closeEditAnimationTimerRef.current);
                closeEditAnimationTimerRef.current = null;
            }
        };
    }, [isEditingUser, shouldRenderEditUserDrawer]);

    useEffect(() => {
        return () => {
            if (closeEditAnimationTimerRef.current) {
                clearTimeout(closeEditAnimationTimerRef.current);
            }
        };
    }, []);

    const orgColumnDefs = React.useMemo(() => [
        {
            headerName: 'Id',
            valueGetter: (params) => params.node.rowIndex + 1,
            width: 70,
        },
        {
            headerName: 'Organization',
            field: 'name',
            flex: 2,
            cellRenderer: (params) => {
                const org = params.data;
                if (!org) return null;
                return (
                    <div className="flex items-center gap-3 w-full h-full">
                        <div className="w-[28px] h-[28px] shrink-0 rounded-[6px] bg-white border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                            {org.logo ? (
                                <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
                            ) : (
                                <Building2 size={14} strokeWidth={2} className="text-slate-400" />
                            )}
                        </div>
                        <span className="text-[12px] font-bold text-slate-700 leading-tight">
                            {org.name}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: 'Role',
            field: 'role',
            flex: 1,
            cellRenderer: (params) => {
                const role = params.value || 'Member';
                const roleLower = role.toLowerCase();
                return (
                    <span className="px-2 py-[3px] rounded-md text-[9px] font-extrabold uppercase tracking-wide inline-block text-slate-500">
                        {role}
                    </span>
                );
            }
        },
        {
            headerName: 'Currency',
            valueGetter: (params) => params.data?.baseCurrency || params.data?.settings?.currency || 'INR',
            flex: 1,
            cellRenderer: (params) => {
                return <span className="text-[11px] font-bold text-slate-600">{params.value}</span>;
            }
        },
        {
            headerName: 'Action',
            width: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params) => {
                const org = params.data;
                if (!org) return null;
                return (
                    <div className="flex items-center justify-end gap-1 w-full h-full">
                        <button
                            onClick={() => {
                                setManageOrgModalView('edit');
                                setOrgToEditFromProfile(org);
                                setIsManageOrgModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#4A8AF4] hover:bg-[#EEF3FF] rounded-md transition-all outline-none"
                        >
                            <Edit size={13.5} strokeWidth={2.5}/>
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to archive organization "${org.name}"? It will be removed from active lists but kept in history.`)) {
                                    try {
                                        await apiService.organizations.delete(org.id);
                                        setOrganizations(prev => prev.filter(o => o.id !== org.id));
                                        if (selectedOrg?.id === org.id) window.location.reload();
                                    } catch (err) {
                                        console.error('Failed to delete org:', err);
                                        alert(err.response?.data?.message || 'Failed to archive organization.');
                                    }
                                }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all outline-none"
                            title="Archive Organization"
                        >
                            <Trash2 size={13.5} strokeWidth={2.5}/>
                        </button>
                    </div>
                );
            }
        }
    ], [selectedOrg]);

    const usersColumnDefs = React.useMemo(() => [
        {
            headerName: 'Id',
            valueGetter: (params) => params.node.rowIndex + 1,
            width: 70,
        },
        {
            headerName: 'Name',
            field: 'name',
            flex: 2,
            cellRenderer: (params) => {
                const member = params.data;
                if (!member) return null;
                return (
                    <div className="flex items-center gap-3 w-full h-full">
                        <div className="h-[28px] w-[28px] shrink-0 flex items-center justify-center rounded-[6px] bg-[#EBF3FF] text-[#4A8AF4]">
                            <UsersIcon size={14} fill="currentColor" strokeWidth={1} />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[12px] font-bold text-slate-700 leading-tight mb-0.5">
                                {member.name || member.email?.split('@')[0]}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium leading-none">
                                {member.email}
                            </span>
                        </div>
                    </div>
                );
            }
        },
        {
            headerName: 'Role',
            field: 'role',
            flex: 1,
            cellRenderer: (params) => {
                const role = params.value || 'Member';
                const roleLower = role.toLowerCase();
                return (
                    <span className="px-2 py-[3px] rounded-md text-[9px] font-extrabold uppercase tracking-wide inline-block text-slate-500">
                        {roleLower === 'admin' ? 'Admin' : roleLower === 'owner' ? 'Owner' : 'Member'}
                    </span>
                );
            }
        },
        {
            headerName: 'Branch',
            flex: 2,
            cellRenderer: (params) => {
                const member = params.data;
                if (!member) return null;
                const getBranchText = () => {
                    if (member.role?.toLowerCase() === 'admin' || member.role?.toLowerCase() === 'owner') return "All Branches";
                    const memberBranchIds = parseMemberSelectedBranchIds(member);
                    const allBranchIds = orgBranches.map(b => Number(b.id)).filter(Boolean);
                    if (allBranchIds.length > 0 && memberBranchIds.length === allBranchIds.length) return "All Branches";
                    if (memberBranchIds.length > 0) {
                        const assigned = orgBranches.filter(b => memberBranchIds.includes(Number(b.id))).map(b => b.name);
                        return assigned.length > 0 ? assigned.join(", ") : "None";
                    }
                    return "None";
                };
                return <span className="text-[11px] text-slate-600 font-bold truncate block">{getBranchText()}</span>;
            }
        },
        {
            headerName: 'Status',
            field: 'status',
            width: 100,
            cellRenderer: (params) => {
                const member = params.data;
                if (!member) return null;
                const isActive = member.status === 'Active' || member.isActive !== false;
                return (
                    <span className={cn(
                        "px-2 py-[3px] rounded-md text-[9px] font-extrabold uppercase tracking-wide inline-block",
                        isActive ? "text-[#72B7A1]" : "text-red-500"
                    )}>
                        {member.status || 'Active'}
                    </span>
                );
            }
        },
        {
            headerName: 'Action',
            width: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params) => {
                const member = params.data;
                if (!member || member.id === user?.id) return null;
                return (
                    <div className="flex items-center justify-end gap-1 w-full h-full">
                        <button
                            onClick={() => {
                                setMemberToEdit(member);
                                const roleId = member.role?.toLowerCase() === 'owner' ? 1 : member.role?.toLowerCase() === 'admin' ? 2 : 3;
                                const memberBranches = parseMemberSelectedBranchIds(member);
                                const filteredForOrg = memberBranches.filter(id => orgBranches.some(b => Number(b.id) === id));
                                setEditingAccessData({
                                    roleId,
                                    branchIds: filteredForOrg
                                });
                                setIsEditingUser(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#4A8AF4] hover:bg-[#EEF3FF] rounded-md transition-all outline-none"
                        >
                            <Edit size={13.5} strokeWidth={2.5}/>
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to remove user "${member.name || member.email}" from the organization?`)) {
                                    await handleRemoveMember(member.id);
                                }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all outline-none"
                        >
                            <Trash2 size={13.5} strokeWidth={2.5} />
                        </button>
                    </div>
                );
            }
        }
    ], [orgBranches, user]);

    useEffect(() => {
        const fetchRelatedData = async () => {
            setIsLoadingData(true);
            try {
                const [orgsResponse, usersResponse, branchesResponse] = await Promise.all([
                    apiService.orgs.getAll().catch(() => ({ orgs: [] })),
                    selectedOrg?.id ? apiService.organizations.getMembers(selectedOrg.id).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
                    selectedOrg?.id ? apiService.branches.getAll({ headers: { 'x-org-id': selectedOrg.id } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
                ]);

                let listData = orgsResponse?.data || orgsResponse;
                let rawList = Array.isArray(listData) ? listData : (listData?.orgs || listData?.organizations || []);
                let orgList = rawList.map(item => item.org || item);
                if (orgList.length === 0 && selectedOrg) {
                    orgList = [selectedOrg];
                } else if (!orgList.some(o => o.id === selectedOrg?.id) && selectedOrg) {
                    orgList.unshift(selectedOrg);
                }
                setOrganizations(orgList);

                const usersList = Array.isArray(usersResponse?.data) ? usersResponse.data : Array.isArray(usersResponse) ? usersResponse : [];
                setOrgUsers(usersList);

                const branchesList = Array.isArray(branchesResponse?.data) ? branchesResponse.data : Array.isArray(branchesResponse) ? branchesResponse : [];
                setOrgBranches(branchesList);
            } catch (err) {
                console.error("Failed to load related data:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        if (selectedOrg) {
            fetchRelatedData();
        }
    }, [selectedOrg]);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                profilePhoto: user.profilePhoto || ''
            });
        }
    }, [user]);

    useEffect(() => {
        setDraftPreferences(preferences);
    }, [preferences]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size should be less than 5MB');
                showToast('Image size should be less than 5MB', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result;
                setFormData(prev => ({ ...prev, profilePhoto: base64data }));

                if (!isEditing) {
                    // Auto-save if they change photo while not in full edit mode
                    setIsLoading(true);
                    try {
                        await updateUser({ profilePhoto: base64data });
                        showToast('Profile photo updated', 'success');
                    } catch (err) {
                        showToast('Failed to update photo', 'error');
                    } finally {
                        setIsLoading(false);
                    }
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = async (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        setFormData(prev => ({ ...prev, profilePhoto: '' }));
        setShowDeleteOption(false);
        
        if (!isEditing) {
            setIsLoading(true);
            try {
                await updateUser({ profilePhoto: null });
                showToast('Profile photo removed', 'success');
            } catch (err) {
                showToast('Failed to remove photo', 'error');
            } finally {
                setIsLoading(false);
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
    
    const getInviteMemberEmailError = (email = '') => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return 'Member email is required.';
        if (!isValidEmail(normalizedEmail)) return 'Please enter a valid email address.';
        return '';
    };

    const isRegisteredUserEmail = async (email) => {
        try {
            const response = await apiService.auth.getUsers();
            const users = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.users) ? response.users : [];
            const targetEmail = normalizeEmail(email);
            return users.some((u) => normalizeEmail(u?.email) === targetEmail);
        } catch (error) {
            console.error('Failed to validate invite email:', error);
            return false;
        }
    };

    const resetMemberInviteForm = () => {
        setInviteEmail('');
        setInviteName('');
        setInviteMemberEmailError('');
        setSelectedOrgRole("3");
        setSelectedBranchIds([]);
        setRequestError('');
    };

    const parseMemberSelectedBranchIds = (member) => {
        let parsedBranchIds = [];
        if (member.branchIds && typeof member.branchIds === 'string') {
            if (member.branchIds.startsWith('[') || member.branchIds.startsWith('{')) {
                try {
                    parsedBranchIds = JSON.parse(member.branchIds);
                } catch {
                    parsedBranchIds = [];
                }
            } else {
                parsedBranchIds = member.branchIds.split(',').filter(Boolean).map(Number);
            }
        } else if (Array.isArray(member.branchIds)) {
            parsedBranchIds = member.branchIds;
        } else if (member.branchRoles && Array.isArray(member.branchRoles)) {
            parsedBranchIds = member.branchRoles.map(b => b.branchId);
        } else if (member.branchAccess && Array.isArray(member.branchAccess)) {
            parsedBranchIds = member.branchAccess.map(b => b.branchId);
        }
        return Array.isArray(parsedBranchIds) ? parsedBranchIds.map(Number).filter(Boolean) : [];
    };

    const handleRemoveMember = async (idToRemove) => {
        const targetId = typeof idToRemove === 'number' || typeof idToRemove === 'string' ? idToRemove : memberToRemove?.id;
        if (!targetId || !selectedOrg) return;
        try {
            await apiService.organizations.removeMember(selectedOrg.id, targetId);
            if (!(typeof idToRemove === 'number' || typeof idToRemove === 'string')) setMemberToRemove(null);
            
            // Refresh
            const response = await apiService.organizations.getMembers(selectedOrg.id);
            setOrgUsers(Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
            
            showToast('Member removed successfully', 'success');
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to remove member.");
            setMemberToRemove(null);
        }
    };

    const handleUpdateMemberAccess = async () => {
        if (!memberToEdit || !selectedOrg) return;
        setActionLoading(true);
        try {
            const payload = {
                role: editingAccessData.roleId === 1 ? 'owner' : (editingAccessData.roleId === 2 ? 'admin' : 'member'),
                branchIds: editingAccessData.roleId === 3 ? editingAccessData.branchIds : null
            };
            await apiService.organizations.updateMemberAccess(selectedOrg.id, memberToEdit.id, payload);
            setIsEditingUser(false);
            
            // Refresh
            const response = await apiService.organizations.getMembers(selectedOrg.id);
            setOrgUsers(Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
            
            showToast('Member access updated successfully', 'success');
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to update member access.");
        } finally {
            setActionLoading(false);
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
                setInviteLoading(false);
                return;
            }

            await apiService.organizations.invite(selectedOrg.id, {
                email: emailToInvite,
                name: inviteName,
                branchIds: finalBranchIds,
                role: roleId === 1 ? 'owner' : (roleId === 2 ? 'admin' : 'member')
            });
            showToast(`Invitation sent to ${emailToInvite}`, 'success');
            resetMemberInviteForm();
            setIsAddingUser(false);
            
            const usersResponse = await apiService.organizations.getMembers(selectedOrg.id);
            setOrgUsers(Array.isArray(usersResponse?.data) ? usersResponse.data : Array.isArray(usersResponse) ? usersResponse : []);
        } catch (err) {
            setRequestError(err.response?.data?.message || "Failed to invite user.");
        } finally {
            setInviteLoading(false);
        }
    };

    const handlePreferenceChange = (e) => {
        const { name, value } = e.target;
        setDraftPreferences((prev) => ({ ...prev, [name]: value }));
        setIsEditing(true);
    };

    const allOrgBranchIds = orgBranches.map(branch => Number(branch.id)).filter(Boolean);
    const inviteAllBranchesSelected = allOrgBranchIds.length > 0 && selectedBranchIds.length === allOrgBranchIds.length;

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsLoading(true);
        setError('');

        try {
            const profileChanges = {};
            if ((formData.name || '') !== (user?.name || '')) profileChanges.name = formData.name;
            if ((formData.email || '') !== (user?.email || '')) profileChanges.email = formData.email;
            if ((formData.profilePhoto || '') !== (user?.profilePhoto || '')) profileChanges.profilePhoto = formData.profilePhoto;

            const preferenceChanges = Object.entries(draftPreferences || {}).reduce((acc, [key, value]) => {
                if (preferences?.[key] !== value) {
                    acc[key] = value;
                }
                return acc;
            }, {});

            if (Object.keys(profileChanges).length > 0) {
                await updateUser(profileChanges);
            }

            if (Object.keys(preferenceChanges).length > 0) {
                await updatePreferences(preferenceChanges);
            }

            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save changes', error);
            setError(error.response?.data?.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = ['Personal', 'Preferences', 'Organization', 'Users'];

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden relative bg-white">
            {/* Top Navigation Tabs matching screenshot */}
            <div className="bg-white px-6 pt-6 border-b border-gray-100 flex gap-12 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "pb-3 text-[13px] font-semibold transition-colors relative",
                            activeTab === tab 
                                ? "text-[#4A8AF4]" 
                                : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#4A8AF4]" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                <div className="p-4 lg:p-6 lg:pt-6 w-full animate-in fade-in duration-300">
                    
                    {error && (
                        <div className="bg-red-50 text-red-500 text-sm p-3 rounded mb-4 w-full">
                            {error}
                        </div>
                    )}

                    {activeTab === 'Personal' && (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Edit Button Header Area */}
                            <div className="flex justify-end items-center">
                                {!isEditing ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-blue-50 text-blue-500 text-[11px] font-bold tracking-wide hover:bg-blue-100 transition-colors pointer-events-auto"
                                    >
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                // Reset local changes
                                                setFormData({
                                                    name: user?.name || '',
                                                    email: user?.email || '',
                                                    profilePhoto: user?.profilePhoto || ''
                                                });
                                                setError('');
                                            }}
                                            className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wide hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={cn(
                                                "h-[30px] px-5 inline-flex items-center justify-center gap-1.5 rounded bg-[#4A8AF4] text-white text-[11px] font-bold tracking-wide transition-colors pointer-events-auto shadow-sm",
                                                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-600"
                                            )}
                                        >
                                            {isLoading ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Main Card */}
                            <div className="bg-white border border-gray-100 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
                                
                                {/* Photo Row */}
                                <div className={cn("flex px-6 py-4 border-b border-gray-100/60 transition-colors items-center", !isEditing && "hover:bg-slate-50/30")}>
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        User Profile
                                    </div>
                                    <div className="flex-1 flex items-center">
                                        <div 
                                            className={cn("relative group/profile-img", isEditing && "cursor-pointer")}
                                            onClick={() => { if(isEditing) fileInputRef.current?.click(); }}
                                        >
                                            <div className="w-[42px] h-[42px] rounded-full overflow-hidden ring-1 ring-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                                                {formData.profilePhoto ? (
                                                    <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={20} className="text-slate-400 stroke-[1.5]" />
                                                )}
                                            </div>
                                            
                                            {isEditing && (
                                                <div className="absolute -bottom-1 -right-1 bg-white text-gray-600 p-0.5 rounded-full border border-gray-200 shadow-sm cursor-pointer hover:text-[#4A8AF4]">
                                                    <Edit2 size={10} strokeWidth={2.5} />
                                                </div>
                                            )}
                                            {isEditing && formData.profilePhoto && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleRemovePhoto(e)}
                                                    className="absolute -top-1 -right-1 hidden group-hover/profile-img:flex bg-red-100 text-red-500 rounded-full p-0.5 z-10"
                                                >
                                                    <X size={10} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                                    </div>
                                </div>

                                {/* Name Row */}
                                <div className={cn("flex px-6 border-b border-gray-100/60 transition-colors items-center h-[44px]", !isEditing && "hover:bg-slate-50/30")}>
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        Name
                                    </div>
                                    <div className="flex-1 flex items-center self-stretch py-1">
                                        {!isEditing ? (
                                            <div className="text-[13px] text-gray-500 font-medium">{formData.name}</div>
                                        ) : (
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="w-full max-w-md px-3 h-full bg-white border border-slate-200 shadow-sm rounded-md text-[13px] font-semibold text-gray-700 focus:outline-none focus:border-primary/20 focus:ring-1 focus:ring-primary/10 transition-all placeholder:text-gray-400"
                                                placeholder="Enter your full name"
                                                required
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Email Row */}
                                <div className={cn("flex px-6 transition-colors items-center h-[44px]", !isEditing && "hover:bg-slate-50/30")}>
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        Email
                                    </div>
                                    <div className="flex-1 flex items-center self-stretch py-1">
                                        {!isEditing ? (
                                            <div className="text-[13px] text-gray-500 font-medium">{formData.email}</div>
                                        ) : (
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                className="w-full max-w-md px-3 h-full bg-white border border-slate-200 shadow-sm rounded-md text-[13px] font-semibold text-gray-700 focus:outline-none focus:border-primary/20 focus:ring-1 focus:ring-primary/10 transition-all placeholder:text-gray-400"
                                                placeholder="Enter your email"
                                                required
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}

                    {activeTab === 'Preferences' && (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex justify-end items-center">
                                {!isEditing ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-blue-50 text-blue-500 text-[11px] font-bold tracking-wide hover:bg-blue-100 transition-colors"
                                    >
                                        Edit Preferences
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setDraftPreferences(preferences);
                                                setError('');
                                            }}
                                            className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wide hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={cn(
                                                "h-[30px] px-5 inline-flex items-center justify-center gap-1.5 rounded bg-[#4A8AF4] text-white text-[11px] font-bold tracking-wide transition-colors shadow-sm",
                                                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-600"
                                            )}
                                        >
                                            {isLoading ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white border border-gray-100 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] pt-2 pb-4 px-4 lg:px-6">
                                <PreferenceSettingsFields
                                    draftPreferences={draftPreferences}
                                    onChange={handlePreferenceChange}
                                />
                            </div>
                        </form>
                    )}

                    {activeTab === 'Organization' && (
                        <div className="w-full relative">
                            {/* Add Org Section */}
                            <div className="mb-4">
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => {
                                            setManageOrgModalView('create');
                                            setOrgToEditFromProfile(null);
                                            setIsManageOrgModalOpen(true);
                                        }}
                                        className="h-[32px] px-4 inline-flex items-center justify-center rounded bg-[#EBF3FF] text-[#4A8AF4] text-[12px] font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                        Add Organization
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-white flex flex-col h-[500px]">
                                {isLoadingData ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Loader className="h-5 w-5 text-[#4A8AF4]" />
                                    </div>
                                ) : (
                                    <div className="ag-theme-quartz flex-1 overflow-hidden">
                                        <AgGridReact
                                            theme={customTheme}
                                            rowData={organizations}
                                            columnDefs={orgColumnDefs}
                                            defaultColDef={defaultColDef}
                                            rowHeight={54}
                                            headerHeight={44}
                                            animateRows={true}
                                            suppressCellFocus={true}
                                            overlayNoRowsTemplate='<span class="text-slate-400 text-[12px]">No organizations found</span>'
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Users' && (
                        <div className="w-full relative">
                            
                            {/* Add User Section */}
                            <div className="mb-4">
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => setIsAddingUser(true)}
                                        className="h-[32px] px-4 inline-flex items-center justify-center rounded bg-[#EBF3FF] text-[#4A8AF4] text-[12px] font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                        Add User
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-white flex flex-col h-[500px]">
                                {isLoadingData ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Loader className="h-5 w-5 text-[#4A8AF4]" />
                                    </div>
                                ) : (
                                    <div className="ag-theme-quartz flex-1 overflow-hidden">
                                        <AgGridReact
                                            theme={customTheme}
                                            rowData={orgUsers}
                                            columnDefs={usersColumnDefs}
                                            defaultColDef={defaultColDef}
                                            rowHeight={54}
                                            headerHeight={44}
                                            animateRows={true}
                                            suppressCellFocus={true}
                                            overlayNoRowsTemplate='<span class="text-slate-400 text-[12px]">No users found</span>'
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add User Sidebar Overlay */}
            {shouldRenderAddUserDrawer && (
                <div className="fixed inset-0 z-[110] flex justify-end">
                    <div 
                        className={cn(
                            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
                            isClosingAddUserDrawer ? "animate-fade-out" : "animate-fade-in"
                        )} 
                        onClick={() => {
                            setIsAddingUser(false);
                            // Give time for animation before resetting
                            setTimeout(() => resetMemberInviteForm(), 300);
                        }} 
                    />
                    <div className={cn(
                        "bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden",
                        isClosingAddUserDrawer ? "animate-slide-out-right" : "animate-slide-in-right"
                    )}>
                        {/* Header */}
                        <div className="flex flex-col px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                        <UsersIcon size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                            Invite New Member
                                        </h2>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5 tracking-wide">
                                            Send an email invitation to join this organization
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddingUser(false);
                                        // Give time for animation before resetting
                                        setTimeout(() => resetMemberInviteForm(), 300);
                                    }}
                                    className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                                >
                                    <X size={15} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar bg-white flex flex-col gap-5">
                            {requestError && (
                                <div className="p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-md border border-red-100 flex items-center gap-2">
                                    <AlertCircle size={16} /> {requestError}
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 block">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4A8AF4] transition-colors" size={15} />
                                        <input
                                            type="text"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full pl-9 pr-4 h-[38px] bg-slate-50/50 border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 block">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4A8AF4] transition-colors" size={15} />
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="john@example.com"
                                            className={cn(
                                                "w-full pl-9 pr-4 h-[38px] bg-slate-50/50 border rounded-md text-[13px] font-semibold text-slate-800 outline-none focus:bg-white transition-all placeholder:text-slate-400",
                                                inviteMemberEmailError ? "border-rose-300 focus:ring-rose-500/10" : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10"
                                            )}
                                        />
                                    </div>
                                    {inviteMemberEmailError && <p className="text-[10px] font-bold text-red-500">{inviteMemberEmailError}</p>}
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[11px] font-bold text-slate-600 block">Organization Role</label>
                                    <CustomSelect
                                        value={selectedOrgRole}
                                        onChange={(e) => setSelectedOrgRole(e.target.value)}
                                        className="w-full h-[38px] py-1.5 px-3 bg-slate-50/50 border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all cursor-pointer"
                                    >
                                        <option value="3">Member (Limited Access)</option>
                                        <option value="2">Admin (Full Access)</option>
                                    </CustomSelect>
                                </div>

                                {parseInt(selectedOrgRole) === 3 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                                Branch Access <span className="text-rose-400 text-lg leading-none">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => inviteAllBranchesSelected ? setSelectedBranchIds([]) : setSelectedBranchIds(allOrgBranchIds)}
                                                className="text-[10px] font-bold text-[#4A8AF4] hover:underline"
                                            >
                                                {inviteAllBranchesSelected ? "Deselect All" : "Select All"}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar p-1 border border-slate-100 rounded-md bg-slate-50/30">
                                            {orgBranches.map((branch) => {
                                                const isSelected = selectedBranchIds.includes(branch.id);
                                                return (
                                                    <div
                                                        key={branch.id}
                                                        onClick={() => setSelectedBranchIds(prev => prev.includes(branch.id) ? prev.filter(id => id !== branch.id) : [...prev, branch.id])}
                                                        className={cn(
                                                            "flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all",
                                                            isSelected ? "bg-[#EEF3FF] border-[#4A8AF4]/30" : "bg-white border-slate-200 hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 shrink-0 rounded flex items-center justify-center transition-all border",
                                                            isSelected ? "bg-[#4A8AF4] border-[#4A8AF4] text-white" : "border-slate-300 bg-slate-50"
                                                        )}>
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{branch.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    setIsAddingUser(false);
                                    // Give time for animation before resetting
                                    setTimeout(() => resetMemberInviteForm(), 300);
                                }}
                                className="px-4 py-2 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={inviteLoading || !inviteName.trim() || !inviteEmail.trim() || (parseInt(selectedOrgRole) === 3 && selectedBranchIds.length === 0)}
                                className="h-[36px] px-6 bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold rounded shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {inviteLoading ? "Sending..." : "Send Invitation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Sidebar Overlay */}
            {shouldRenderEditUserDrawer && memberToEdit && (
                <div className="fixed inset-0 z-[110] flex justify-end">
                    <div 
                        className={cn(
                            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
                            isClosingEditUserDrawer ? "animate-fade-out" : "animate-fade-in"
                        )} 
                        onClick={() => setIsEditingUser(false)} 
                    />
                    <div className={cn(
                        "bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden",
                        isClosingEditUserDrawer ? "animate-slide-out-right" : "animate-slide-in-right"
                    )}>
                        {/* Header */}
                        <div className="flex flex-col px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                        <Edit size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                            Edit Access
                                        </h2>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5 tracking-wide truncate max-w-[250px]">
                                            {memberToEdit.name || memberToEdit.email}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingUser(false)}
                                    className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                                >
                                    <X size={15} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar bg-white flex flex-col gap-5">
                            {requestError && (
                                <div className="p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-md border border-red-100 flex items-center gap-2">
                                    <AlertCircle size={16} /> {requestError}
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 block">Role</label>
                                    <CustomSelect
                                        value={editingAccessData.roleId.toString()}
                                        onChange={(e) =>
                                            setEditingAccessData((prev) => ({
                                                ...prev,
                                                roleId: parseInt(e.target.value),
                                            }))
                                        }
                                        className="w-full h-[38px] py-1.5 px-3 bg-slate-50/50 border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all cursor-pointer"
                                    >
                                        {selectedOrg?.role?.toLowerCase() === 'owner' && (
                                            <option value="1">Owner</option>
                                        )}
                                        {selectedOrg?.role?.toLowerCase() === 'owner' && (
                                            <option value="2">Admin</option>
                                        )}
                                        <option value="3">Member (Limited Access)</option>
                                    </CustomSelect>
                                </div>

                                {editingAccessData.roleId === 3 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                                Branch Access <span className="text-rose-400 text-lg leading-none">*</span>
                                            </label>
                                            {orgBranches.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allBranchIds = orgBranches.map(b => Number(b.id)).filter(Boolean);
                                                        const editSelectedBranchIds = Array.isArray(editingAccessData.branchIds) ? editingAccessData.branchIds.map(Number) : [];
                                                        const editAllBranchesSelected = allBranchIds.length > 0 && editSelectedBranchIds.length === allBranchIds.length;
                                                        setEditingAccessData((prev) => ({
                                                            ...prev,
                                                            branchIds: editAllBranchesSelected ? [] : allBranchIds,
                                                        }));
                                                    }}
                                                    className="text-[10px] font-bold text-[#4A8AF4] hover:underline"
                                                >
                                                    {(orgBranches.length > 0 && Array.isArray(editingAccessData.branchIds) && editingAccessData.branchIds.length === orgBranches.length) ? "Deselect All" : "Select All"}
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar p-1 border border-slate-100 rounded-md bg-slate-50/30">
                                            {orgBranches.map((branch) => {
                                                const normalizedBranchId = Number(branch.id);
                                                const editSelectedBranchIds = Array.isArray(editingAccessData.branchIds) ? editingAccessData.branchIds.map(Number) : [];
                                                const isSelected = editSelectedBranchIds.includes(normalizedBranchId);
                                                
                                                return (
                                                    <div
                                                        key={branch.id}
                                                        onClick={() => {
                                                            setEditingAccessData((prev) => {
                                                                const currentIds = Array.isArray(prev.branchIds) ? prev.branchIds.map(Number) : [];
                                                                return {
                                                                    ...prev,
                                                                    branchIds: currentIds.includes(normalizedBranchId)
                                                                        ? currentIds.filter((id) => id !== normalizedBranchId)
                                                                        : [...currentIds, normalizedBranchId],
                                                                };
                                                            });
                                                        }}
                                                        className={cn(
                                                            "flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all",
                                                            isSelected ? "bg-[#EEF3FF] border-[#4A8AF4]/30" : "bg-white border-slate-200 hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 shrink-0 rounded flex items-center justify-center transition-all border",
                                                            isSelected ? "bg-[#4A8AF4] border-[#4A8AF4] text-white" : "border-slate-300 bg-slate-50"
                                                        )}>
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{branch.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2 shrink-0">
                            <button
                                onClick={() => setIsEditingUser(false)}
                                className="px-4 py-2 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateMemberAccess}
                                disabled={actionLoading || (editingAccessData.roleId === 3 && editingAccessData.branchIds.length === 0)}
                                className="h-[36px] px-6 bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold rounded shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {actionLoading ? "Saving..." : "Update Access"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Organization Modal */}
            <ManageOrganizationModal
                isOpen={isManageOrgModalOpen}
                onClose={() => {
                    setIsManageOrgModalOpen(false);
                    // Refresh orgs
                    setTimeout(() => {
                        if (selectedOrg) {
                            apiService.orgs.getAll()
                                .then(response => {
                                    let listData = response?.data || response;
                                    let rawList = Array.isArray(listData) ? listData : (listData?.orgs || listData?.organizations || []);
                                    let orgList = rawList.map(item => item.org || item);
                                    if (!orgList.some(o => o.id === selectedOrg.id)) orgList.unshift(selectedOrg);
                                    setOrganizations(orgList);
                                }).catch(console.error);
                        }
                    }, 500);
                }}
                initialView={manageOrgModalView}
                initialOrg={orgToEditFromProfile}
            />
        </div>
    );
};

export default Profile;
