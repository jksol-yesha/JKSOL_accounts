import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Globe, Clock, Loader2, Upload, Plus, Edit2, Power, Check, ArrowLeft, AlertCircle, Users, Mail, UserPlus, Trash2, GitBranch, Shield, ChevronDown } from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import apiService from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomSelect from '../common/CustomSelect';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';

const CreateOrganizationModal = ({ isOpen, onClose, initialMode = 'list', onBackToManage = null }) => {
    const { organizations, createOrganization, refreshOrganizations, selectedOrg, switchOrganization } = useOrganization();
    const { user } = useAuth();
    const { currencyOptions } = useCurrencyOptions();

    // View State
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [activeTab, setActiveTab] = useState('details'); // 'details' | 'members'

    // Form State (Org)
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        baseCurrency: 'USD',
        timezone: 'Asia/Kolkata',
        status: 1
    });
    const [logoPreview, setLogoPreview] = useState(null);

    // Member State
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);

    // Branch Roles State
    const [allBranches, setAllBranches] = useState([]);
    // V2: Multi-Branch & Org Role Support
    const [selectedBranchIds, setSelectedBranchIds] = useState([]); // Array of IDs
    const [selectedOrgRole, setSelectedOrgRole] = useState(3); // 1=Owner, 2=Admin, 3=Member
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [memberToRemove, setMemberToRemove] = useState(null); // { id, name }
    const [memberToEdit, setMemberToEdit] = useState(null); // { id, name, role, branchIds }
    const [editingAccessData, setEditingAccessData] = useState({ roleId: 3, branchIds: [] });
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

    useEffect(() => {
        if (isOpen) {
            refreshOrganizations();
            resetView();
            if (initialMode === 'create') {
                setIsCreating(true);
            }
        }
    }, [isOpen, initialMode]);

    useEffect(() => {
        if (isCreating && editingId && activeTab === 'members') {
            fetchMembers();
            fetchBranches();
        }
    }, [isCreating, editingId, activeTab]);

    const fetchMembers = async () => {
        if (!editingId) return;
        setLoadingMembers(true);
        try {
            const response = await apiService.organizations.getMembers(editingId);
            setMembers(response.data || []);
        } catch (err) {
            console.error("Failed to fetch members:", err);
            setError("Failed to load members.");
        } finally {
            setLoadingMembers(false);
        }
    };

    const fetchBranches = async () => {
        if (!editingId) return;
        try {
            const response = await apiService.branches.getAll({
                headers: { 'x-org-id': editingId }
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

        // Validation based on Role
        const roleId = parseInt(selectedOrgRole);
        let finalBranchIds = null;

        if (roleId === 3) {
            // Member Check: Must select at least one branch
            if (selectedBranchIds.length === 0) {
                setError("Members must be assigned to at least one branch.");
                return;
            }
            finalBranchIds = selectedBranchIds;
        } else {
            // Owner/Admin: Implicit Access
            finalBranchIds = null;
        }

        setInviteLoading(true);
        setError(null);
        try {
            const emailAlreadyRegistered = await isRegisteredUserEmail(emailToInvite);
            if (emailAlreadyRegistered) {
                setError('This email is already registered. Invitation was not sent.');
                return;
            }

            const payload = {
                email: emailToInvite,
                name: inviteName,
                branchIds: finalBranchIds, // Send Array or Null
                role: roleId === 1 ? 'owner' : (roleId === 2 ? 'admin' : 'member')
            };

            await apiService.organizations.invite(editingId, payload);
            setSuccessMessage(`Invitation sent to ${emailToInvite}`);
            // Reset
            setInviteEmail('');
            setInviteName('');
            setSelectedBranchIds([]);
            setSelectedOrgRole(3); // Reset to Member
            fetchMembers(); // Refresh list
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to invite user.");
        } finally {
            setInviteLoading(false);
        }
    };



    const handleRemoveMember = async () => {
        if (!memberToRemove) return;
        const { id: memberId, name: memberName } = memberToRemove;

        try {
            await apiService.organizations.removeMember(editingId, memberId);
            setSuccessMessage(`${memberName} removed successfully.`);
            setMemberToRemove(null);
            fetchMembers(); // Refresh list
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error("Failed to remove member:", err);
            setError(err.response?.data?.message || "Failed to remove member.");
            setMemberToRemove(null);
        }
    };

    const handleUpdateMemberAccess = async () => {
        if (!memberToEdit) return;
        setLoading(true);
        setError(null);
        try {
            // Ensure branchIds is always an array when needed
            const branchIdsArray = Array.isArray(editingAccessData.branchIds) ? editingAccessData.branchIds : [];

            // Transform roleId to role string for backend
            const payload = {
                role: editingAccessData.roleId === 2 ? 'admin' : 'member',
                branchIds: editingAccessData.roleId === 3 ? branchIdsArray : null
            };
            await apiService.organizations.updateMemberAccess(editingId, memberToEdit.id, payload);
            setSuccessMessage(`Access for ${memberToEdit.name} updated successfully.`);
            setMemberToEdit(null);
            fetchMembers(); // Refresh list
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error("Failed to update member access:", err);
            setError(err.response?.data?.message || "Failed to update member access.");
        } finally {
            setLoading(false);
        }
    };

    const orgsArray = Array.isArray(organizations) ? organizations : [];
    const currentOrgRole = orgsArray.find(o => o.id === editingId)?.role || 'member';

    const resetView = () => {
        setIsCreating(false);
        setEditingId(null);
        setActiveTab('details');
        setError(null);
        setSuccessMessage('');
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            name: '',
            baseCurrency: 'USD',
            timezone: 'Asia/Kolkata',
            status: 1
        });
        setLogoPreview(null);
        setInviteEmail('');
        setInviteName('');
        setSelectedBranchIds([]);
        setSelectedOrgRole(3);
        setMembers([]);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError("Logo must be less than 2MB");
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

    const handleEdit = (org) => {
        setEditingId(org.id);
        setFormData({
            name: org.name,
            baseCurrency: org.baseCurrency || 'USD',
            timezone: org.timezone || 'Asia/Kolkata',
            status: org.status || 1,
            logo: org.logo
        });
        setLogoPreview(org.logo);
        setIsCreating(true);
        setActiveTab('details');
        setError(null);
        setSuccessMessage('');
    };

    const handleExitCreateView = () => {
        if (!editingId && typeof onBackToManage === 'function') {
            resetView();
            onBackToManage();
            return;
        }

        setIsCreating(false);
        setEditingId(null);
        resetForm();
        setError('');
        setSuccessMessage('');
    };

    const handleToggleStatus = async (e, org) => {
        e.stopPropagation();
        const newStatus = org.status === 1 ? 2 : 1;
        const action = newStatus === 1 ? 'Activate' : 'Deactivate';

        if (!window.confirm(`Are you sure you want to ${action} organization "${org.name}"?`)) {
            return;
        }

        try {
            await apiService.organizations.update(org.id, { status: newStatus });
            refreshOrganizations();
        } catch (error) {
            console.error(`Failed to ${action} org:`, error);
            alert(`Failed to ${action} organization.`);
        }
    };

    const handleDeleteOrg = async (e, org) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete organization "${org.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await apiService.organizations.delete(org.id);
            if (selectedOrg?.id === org.id) {
                window.location.reload();
            } else {
                refreshOrganizations();
                setSuccessMessage(`Organization '${org.name}' deleted successfully.`);
            }
        } catch (error) {
            console.error('Failed to delete org:', error);
            alert(error.response?.data?.message || 'Failed to delete organization.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            if (editingId) {
                await apiService.organizations.update(editingId, formData);
                setSuccessMessage(`Organization '${formData.name}' updated successfully!`);
            } else {
                await createOrganization(formData);
                setSuccessMessage(`Organization '${formData.name}' created successfully!`);
            }
            refreshOrganizations();
            if (!editingId) resetForm();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Operation failed');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="bg-white rounded-2xl w-full max-w-[92vw] md:max-w-[760px] shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white z-20 sticky top-0">
                    <div className="flex items-center gap-2">
                        {isCreating && (
                            <button
                                onClick={handleExitCreateView}
                                className="mr-2 text-gray-400 hover:text-black transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <h2 className="text-[17px] font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                            <Building2 size={20} className="text-black" />
                            {isCreating ? (editingId ? 'Edit Organization' : 'Create Organization') : 'Manage Organizations'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-lg transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto min-h-0 md:min-h-[300px] flex flex-col h-full">
                    {successMessage ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-300 p-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 mb-2">Success!</h4>
                            <p className="text-gray-600 mb-6">{successMessage}</p>
                            <button
                                onClick={() => {
                                    setSuccessMessage('');
                                    if (editingId) {
                                        setIsCreating(false);
                                        setEditingId(null);
                                    } else {
                                        setIsCreating(false);
                                    }
                                }}
                                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium border border-transparent"
                            >
                                Back to List
                            </button>
                        </div>
                    ) : !isCreating ? (
                        <div className="p-6 space-y-6">
                            {['owner', 'admin'].includes(user?.globalRole?.toLowerCase()) || ['owner', 'admin'].includes(user?.role?.toLowerCase()) && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-black hover:text-white border border-gray-200 rounded-xl transition-all group shadow-sm"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm">Add New Organization</span>
                                        <span className="text-xs text-gray-500 group-hover:text-gray-300 font-medium">Create a new business entity</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center transition-colors">
                                        <Plus size={18} />
                                    </div>
                                </button>
                            )}

                            <div className="relative border-t border-gray-100 my-2"></div>

                            <div className="space-y-3">
                                <h4 className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Your Organizations</h4>
                                <div className="space-y-2">
                                    {orgsArray.map(org => (
                                        <div
                                            key={org.id}
                                            onClick={() => switchOrganization(org)}
                                            className={`flex items-center justify-between p-3 border rounded-xl transition-all group cursor-pointer ${selectedOrg?.id === org.id ? 'bg-slate-50 border-slate-200 ring-1 ring-slate-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                {org.logo ? (
                                                    <img
                                                        src={org.logo}
                                                        alt={org.name}
                                                        className="w-9 h-9 rounded-lg object-cover bg-gray-100 border border-gray-200"
                                                    />
                                                ) : (
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${selectedOrg?.id === org.id ? 'bg-white text-black' : 'bg-gray-100 text-gray-500'}`}>
                                                        <Building2 size={16} />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className={`truncate text-sm font-bold ${selectedOrg?.id === org.id ? 'text-black' : 'text-gray-700'}`}>
                                                        {org.name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-medium flex gap-2">
                                                        <span>{org.baseCurrency}</span>
                                                        <span>•</span>
                                                        <span>{org.role || 'Member'}</span>
                                                        {org.status === 2 && <span className="text-red-500">• Inactive</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(org); }}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleToggleStatus(e, org)}
                                                    className={`p-1.5 rounded-lg transition-colors ${org.status === 1 ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                                    title={org.status === 1 ? "Deactivate" : "Activate"}
                                                >
                                                    <Power size={14} className={org.status === 1 ? "" : "text-green-600"} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteOrg(e, org)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete Organization"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Tabs */}
                            {editingId && (
                                <div className="flex px-6 border-b border-gray-100">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Details
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('members')}
                                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'members' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <Users size={16} />
                                        Members
                                    </button>
                                </div>
                            )}

                            {activeTab === 'details' ? (
                                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                                    <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                                        {/* Error Display */}
                                        {error && (
                                            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-2">
                                                <AlertCircle size={16} className="shrink-0" />
                                                {error}
                                            </div>
                                        )}
                                        {/* Logo Upload */}
                                        <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100 border-dashed">
                                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center border border-gray-200 bg-white overflow-hidden relative shrink-0 shadow-sm ${!logoPreview ? 'text-gray-300' : ''}`}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Upload size={24} />
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Organization Logo</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Recommended: Square, Max 2MB</p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Organization Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all placeholder:text-gray-300"
                                                placeholder="e.g. Acme Corp"
                                            />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="space-y-1.5 flex-1">
                                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Base Currency</label>
                                                <CustomSelect
                                                    dropdownGroup="create-org"
                                                    value={formData.baseCurrency}
                                                    onChange={e => setFormData({ ...formData, baseCurrency: e.target.value })}
                                                    className="w-full h-[42px] px-4 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                >
                                                    {currencyOptions.map((currency) => (
                                                        <option key={currency.code} value={currency.code}>{currency.label}</option>
                                                    ))}
                                                </CustomSelect>
                                            </div>
                                            <div className="space-y-1.5 flex-1">
                                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Timezone</label>
                                                <CustomSelect
                                                    dropdownGroup="create-org"
                                                    value={formData.timezone}
                                                    onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                                    className="w-full h-[42px] px-4 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                >
                                                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                                                    <option value="UTC">UTC</option>
                                                    <option value="America/New_York">New York</option>
                                                    <option value="Europe/London">London</option>
                                                </CustomSelect>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 rounded-b-2xl mt-auto">
                                        <button
                                            type="button"
                                            onClick={handleExitCreateView}
                                            className="flex-1 bg-white border border-gray-200 text-gray-700 text-[13px] font-extrabold py-3 rounded-xl transition-all hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 bg-black text-white text-[13px] font-extrabold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            <span>{editingId ? 'Update' : 'Create'}</span>
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                // MEMBERS TAB
                                <div className="flex flex-col flex-1 min-h-0">
                                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">

                                        {/* Invite Form */}
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 transition-all focus-within:ring-2 focus-within:ring-black/5">
                                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1 mb-3 flex items-center gap-2">
                                                <UserPlus size={14} /> Invite New Member
                                            </label>
                                            <form onSubmit={handleInvite} className="space-y-4">
                                                <div className="space-y-3">
                                                    {/* Name Input */}
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

                                                    {/* Email Input */}
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

                                                {/* Organization Role Selection */}
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 ml-1">
                                                        <Shield size={12} /> Assign Organization Role
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={selectedOrgRole}
                                                            onChange={(e) => setSelectedOrgRole(parseInt(e.target.value))}
                                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all appearance-none cursor-pointer"
                                                        >
                                                            <option value="3">Member</option>
                                                            <option value="2">Admin</option>
                                                            <option value="1">Owner</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 pl-1">
                                                        {selectedOrgRole === 3 && "Restricted to specific branches."}
                                                        {selectedOrgRole === 2 && "Full access to all branches within this organization."}
                                                        {selectedOrgRole === 1 && "Full access + Can manage organization settings."}
                                                    </div>
                                                </div>

                                                {/* Conditional Branch Selection */}
                                                {selectedOrgRole === 3 ? (
                                                    <div className="pt-2">
                                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                            <GitBranch size={12} /> Assign Branch Access <span className="text-red-500">*</span>
                                                        </label>

                                                        {allBranches.length === 0 ? (
                                                            <div className="p-3 text-xs text-gray-500 bg-gray-100 rounded-lg border border-gray-200 text-center">
                                                                No branches found. Please create a branch first.
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                                {allBranches.map(branch => {
                                                                    const isSelected = selectedBranchIds.includes(branch.id);
                                                                    return (
                                                                        <div key={branch.id}
                                                                            onClick={() => {
                                                                                // Toggle Selection
                                                                                if (isSelected) {
                                                                                    setSelectedBranchIds(prev => prev.filter(id => id !== branch.id));
                                                                                } else {
                                                                                    setSelectedBranchIds(prev => [...prev, branch.id]);
                                                                                }
                                                                            }}
                                                                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'}`}>
                                                                                    {isSelected && <Check size={10} />}
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className={`text-[13px] font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                                                        {branch.name}
                                                                                    </span>
                                                                                    <span className="text-[10px] text-gray-400">{branch.currencyCode}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-indigo-500 font-medium mt-2 text-center">
                                                            {selectedBranchIds.length} branch(es) selected
                                                        </p>
                                                    </div>
                                                ) : null}

                                                <button
                                                    type="submit"
                                                    disabled={inviteLoading || !inviteEmail || (selectedOrgRole === 3 && selectedBranchIds.length === 0)}
                                                    className="w-full bg-black text-white py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                                    Send Invitation
                                                </button>
                                            </form>

                                            {(error || successMessage) && (
                                                <div className="mt-3">
                                                    {error && <p className="text-red-500 text-xs font-bold flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
                                                    {successMessage && <p className="text-green-600 text-xs font-bold flex items-center gap-1"><Check size={12} /> {successMessage}</p>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Member List */}
                                        {/* Member List */}
                                        <div className="relative">
                                            <h4 className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1 mb-3">Current Members ({members.length})</h4>

                                            {loadingMembers ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 size={24} className="animate-spin text-gray-300" />
                                                </div>
                                            ) : members.length === 0 ? (
                                                <div className="text-center py-8 text-gray-400 text-sm">No members found</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {members.map(member => (
                                                        <div key={member.id} className="relative group">
                                                            <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-300 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                                        {member.name?.[0] || member.email?.[0] || '?'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-gray-900">{member.name || 'Unknown'}</div>
                                                                        <div className="text-xs text-gray-500">{member.email}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${member.role === 'owner' ? 'bg-amber-50 text-amber-600' :
                                                                            member.role === 'admin' ? 'bg-indigo-50 text-indigo-600' :
                                                                                'bg-slate-50 text-slate-600'
                                                                            }`}>
                                                                            {member.role}
                                                                        </span>
                                                                        {member.branchRoles && member.branchRoles.length > 0 && (
                                                                            <div className="flex flex-col items-end gap-0.5">
                                                                                {member.branchRoles.map((br, idx) => (
                                                                                    <span key={idx} className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 flex items-center gap-1">
                                                                                        <span className="font-semibold text-gray-600">{br.branchName}</span>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Action Buttons (Hover visible) */}
                                                            {currentOrgRole === 'owner' && member.role !== 'owner' && (
                                                                <div className="absolute -top-1.5 -right-1.5 flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity z-10">
                                                                    <button
                                                                        onClick={() => {
                                                                            setMemberToEdit({
                                                                                id: member.id,
                                                                                name: member.name || member.email,
                                                                                role: member.role,
                                                                                branchIds: member.branchRoles?.map(br => br.branchId) || []
                                                                            });
                                                                            setEditingAccessData({
                                                                                roleId: member.role === 'admin' ? 2 : 3,
                                                                                branchIds: member.branchRoles?.map(br => br.branchId) || []
                                                                            });
                                                                        }}
                                                                        className="w-5 h-5 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-100 hover:bg-blue-50 shadow-sm transition-all"
                                                                        title="Edit Access"
                                                                    >
                                                                        <Edit2 size={10} strokeWidth={3} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setMemberToRemove({ id: member.id, name: member.name || member.email })}
                                                                        className="w-5 h-5 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 shadow-sm transition-all"
                                                                        title="Remove Member"
                                                                    >
                                                                        <X size={10} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Confirmation Popover */}
                                                            {memberToRemove?.id === member.id && (
                                                                <div className="absolute top-0 right-0 mt-8 w-48 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <AlertCircle size={14} className="text-amber-500" />
                                                                        <span className="text-[11px] font-bold text-gray-700">Remove this user?</span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => setMemberToRemove(null)}
                                                                            className="flex-1 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={handleRemoveMember}
                                                                            className="flex-1 py-1.5 text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm shadow-red-100 transition-colors"
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Edit Access Modal (Overlay) */}
                {memberToEdit && createPortal(
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setMemberToEdit(null)} />
                        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-20">
                                <div className="flex items-center gap-2">
                                    <Shield size={20} className="text-black" />
                                    <h3 className="text-[17px] font-extrabold text-slate-800 tracking-tight">Edit Member Access</h3>
                                </div>
                                <button onClick={() => setMemberToEdit(null)} className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-lg transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                                    <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base shadow-sm">
                                        {memberToEdit.name?.[0] || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[15px] font-bold text-gray-900 truncate">{memberToEdit.name}</div>
                                        <div className="text-[11px] text-gray-500 font-medium">Organization Security Level & Branch Access</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <Shield size={14} /> Organization Role
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={editingAccessData.roleId}
                                            onChange={(e) => setEditingAccessData({ ...editingAccessData, roleId: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="3">Member</option>
                                            <option value="2">Admin</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                    <div className="text-[10px] text-gray-400 pl-1 font-medium">
                                        {editingAccessData.roleId === 3 && "Restricted to specific branches assigned below."}
                                        {editingAccessData.roleId === 2 && "Full administrative access across all branches."}
                                    </div>
                                </div>

                                {editingAccessData.roleId === 3 && (
                                    <div className="space-y-2 pt-1">
                                        <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                            <GitBranch size={14} /> Branch Access <span className="text-red-500">*</span>
                                        </label>
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {allBranches.length === 0 ? (
                                                <div className="p-4 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-200 text-center italic">
                                                    No branches found
                                                </div>
                                            ) : (
                                                allBranches.map(branch => {
                                                    const isSelected = editingAccessData.branchIds.includes(branch.id);
                                                    return (
                                                        <div key={branch.id}
                                                            onClick={() => {
                                                                const newIds = isSelected
                                                                    ? editingAccessData.branchIds.filter(id => id !== branch.id)
                                                                    : [...editingAccessData.branchIds, branch.id];
                                                                setEditingAccessData({ ...editingAccessData, branchIds: newIds });
                                                            }}
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'}`}>
                                                                    {isSelected && <Check size={10} />}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className={`text-[13px] font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                                        {branch.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-medium">{branch.currencyCode}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <p className="text-[10px] text-indigo-500 font-bold mt-2 text-center">
                                            {editingAccessData.branchIds.length} branch(es) selected
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                                <button
                                    onClick={() => setMemberToEdit(null)}
                                    className="flex-1 bg-white border border-gray-200 text-gray-700 text-[13px] font-extrabold py-3 rounded-xl transition-all hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateMemberAccess}
                                    disabled={loading || (editingAccessData.roleId === 3 && editingAccessData.branchIds.length === 0)}
                                    className="flex-1 bg-black text-white text-[13px] font-extrabold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading && <Loader2 size={16} className="animate-spin" />}
                                    <span>Update Access</span>
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div >
        </div >,
        document.body
    );
};

export default CreateOrganizationModal;
