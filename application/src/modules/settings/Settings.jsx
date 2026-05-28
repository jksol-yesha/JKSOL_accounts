import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Building2, User, Upload, Check, Save } from 'lucide-react';
import apiService from '../../services/api';
import CurrencySelector from '../../components/layout/CurrencySelector';
import CustomSelect from '../../components/common/CustomSelect';
import Profile from '../profile/Profile';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';

const Settings = () => {
    const { selectedOrg, setSelectedOrg } = useOrganization();
    const { showToast } = useToast();
    const [view, setView] = useState('profile');
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', role: 'member', baseCurrency: 'INR', logo: null, status: 1 });
    const [logoPreview, setLogoPreview] = useState(null);
    const [availableBranches, setAvailableBranches] = useState([]);
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showToast("Logo must be less than 2MB", "error");
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

    useEffect(() => {
        fetchData();
    }, [view]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (view === 'organizations') {
                const response = await apiService.orgs.getAll();
                let list = [];
                if (Array.isArray(response)) {
                    list = response;
                } else if (response?.data && Array.isArray(response.data)) {
                    list = response.data;
                } else if (response?.orgs && Array.isArray(response.orgs)) {
                    list = response.orgs;
                } else if (response?.organizations && Array.isArray(response.organizations)) {
                    list = response.organizations;
                } else if (response?.data?.orgs && Array.isArray(response.data.orgs)) {
                    list = response.data.orgs;
                } else if (response?.data?.organizations && Array.isArray(response.data.organizations)) {
                    list = response.data.organizations;
                }
                
                setItems(list.map(item => item.org || item));
            } else {
                const response = await apiService.auth.getUsers();
                let list = [];
                if (Array.isArray(response)) list = response;
                else if (response?.data && Array.isArray(response.data)) list = response.data;
                else if (response?.users && Array.isArray(response.users)) list = response.users;
                else if (response?.data?.users && Array.isArray(response.data.users)) list = response.data.users;
                
                setItems(list);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getRole = (item) => {
        if (typeof item.role === 'string') return item.role;
        if (item.role?.name) return item.role.name;
        if (typeof item.globalRole === 'string') return item.globalRole;
        if (item.globalRole?.name) return item.globalRole.name;
        if (item.orgs && item.orgs.length > 0 && item.orgs[0].role) {
            return typeof item.orgs[0].role === 'string' ? item.orgs[0].role : item.orgs[0].role.name;
        }
        return '-';
    };

    const getAddedBy = (item) => {
        if (typeof item.addedBy === 'string') return item.addedBy;
        if (item.addedBy?.name) return item.addedBy.name;
        if (typeof item.createdBy === 'string') return item.createdBy;
        if (item.createdBy?.name) return item.createdBy.name;
        if (item.creator?.name) return item.creator.name;
        return 'Admin'; // Default fallback since usually added by admin
    };

    const getCreatedBy = (item) => {
        if (typeof item.createdBy === 'string') return item.createdBy;
        if (item.createdBy?.name) return item.createdBy.name;
        if (item.creator?.name) return item.creator.name;
        if (item.owner?.name) return item.owner.name;
        return item.ownerEmail || 'System';
    };

    const handleOpenModal = async (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData({
                name: item.name || item.fullName || '',
                email: item.email || '',
                role: String(getRole(item)).toLowerCase() || 'member',
                baseCurrency: item.baseCurrency || 'INR',
                logo: item.logo || null,
                status: item.status || 1
            });
            setLogoPreview(item.logo || null);
            if (view === 'users') {
                const bIds = item.branchIds;
                let parsedIds = [];
                if (bIds) {
                    if (Array.isArray(bIds)) parsedIds = bIds.map(Number).filter(Boolean);
                    else if (typeof bIds === 'string') {
                        try {
                            const parsed = JSON.parse(bIds);
                            if (Array.isArray(parsed)) parsedIds = parsed.map(Number).filter(Boolean);
                            else parsedIds = bIds.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
                        } catch {
                            parsedIds = bIds.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
                        }
                    }
                }
                const ids = new Set(parsedIds);
                if (Array.isArray(item.branches)) {
                    item.branches.forEach(b => {
                        const id = Number(b?.id ?? b?.branchId);
                        if (Number.isFinite(id) && id > 0) ids.add(id);
                    });
                }
                if (Array.isArray(item.branchRoles)) {
                    item.branchRoles.forEach(br => {
                        const id = Number(br?.branchId);
                        if (Number.isFinite(id) && id > 0) ids.add(id);
                    });
                }
                if (item.branchId !== undefined && item.branchId !== null) {
                    const id = Number(item.branchId);
                    if (Number.isFinite(id) && id > 0) ids.add(id);
                }
                setSelectedBranchIds(Array.from(ids));
            } else {
                setSelectedBranchIds([]);
            }
        } else {
            setFormData({ name: '', email: '', role: 'member', baseCurrency: 'INR', logo: null, status: 1 });
            setLogoPreview(null);
            setSelectedBranchIds([]);
        }

        if (view !== 'organizations' && selectedOrg) {
            try {
                const response = await apiService.branches.getAll({ headers: { 'x-org-id': selectedOrg.id } });
                setAvailableBranches(response.data || []);
            } catch (err) {
                console.error("Failed to fetch branches:", err);
            }
        }

        setIsModalOpen(true);
        setTimeout(() => setIsMounted(true), 10);
    };

    const handleCloseModal = () => {
        setIsMounted(false);
        setTimeout(() => {
            setIsModalOpen(false);
            setEditingItem(null);
            setSelectedBranchIds([]);
            setAvailableBranches([]);
        }, 200);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (view === 'organizations') {
                if (editingItem) {
                    await apiService.orgs.update(editingItem.id, {
                        name: formData.name,
                        baseCurrency: formData.baseCurrency,
                        logo: formData.logo,
                        status: formData.status
                    });
                } else {
                    await apiService.orgs.create({
                        name: formData.name,
                        baseCurrency: formData.baseCurrency,
                        logo: formData.logo,
                        status: formData.status
                    });
                }
            } else {
                // If it's for user, handle user save here
                if (editingItem) {
                    if (selectedOrg) {
                        if (formData.role === 'member' && selectedBranchIds.length === 0) {
                            showToast("Members must be assigned to at least one branch.", "error");
                            setIsLoading(false);
                            return;
                        }

                        try {
                            await apiService.organizations.updateMemberAccess(selectedOrg.id, editingItem.id, {
                                role: formData.role,
                                branchIds: formData.role === 'member' ? selectedBranchIds.filter(id => availableBranches.some(b => b.id === id)) : undefined,
                                status: formData.status,
                                name: formData.name,
                                email: formData.email
                            });
                        } catch (updateError) {
                            console.error("Update failed:", updateError);
                            showToast(updateError.response?.data?.message || "Failed to update user", "error");
                            setIsLoading(false);
                            return;
                        }
                    } else {
                        showToast("No organization selected to update the user in.", "error");
                        setIsLoading(false);
                        return;
                    }
                } else {
                    // Creating a new user or inviting
                    if (selectedOrg) {
                        if (formData.role === 'member' && selectedBranchIds.length === 0) {
                            showToast("Members must be assigned to at least one branch.", "error");
                            setIsLoading(false);
                            return;
                        }
                        
                        try {
                            await apiService.orgs.invite(selectedOrg.id, {
                                email: formData.email,
                                role: formData.role,
                                name: formData.name,
                                branchIds: formData.role === 'member' ? selectedBranchIds : undefined
                            });
                        } catch (inviteError) {
                            console.error("Invite failed:", inviteError);
                            showToast(inviteError.response?.data?.message || "Failed to invite user", "error");
                            setIsLoading(false);
                            return;
                        }
                    } else {
                        showToast("No organization selected to invite the user to.", "error");
                        setIsLoading(false);
                        return;
                    }
                }
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            console.error("Save failed:", error);
            showToast(error.response?.data?.message || "Failed to save", "error");
            setIsLoading(false);
        }
    };

    const handleQuickStatusToggle = async (item, isUser) => {
        if (isUser && !selectedOrg) {
            showToast("No organization selected.", "error");
            return;
        }

        const newStatus = Number(item.status) === 1 ? 2 : 1;
        
        // Optimistic UI update
        setItems(prevItems => prevItems.map(obj => 
            obj.id === item.id ? { ...obj, status: newStatus } : obj
        ));
        
        try {
            if (isUser) {
                // Reconstruct branch IDs precisely
                const bIds = item.branchIds;
                let parsedIds = [];
                if (bIds) {
                    if (Array.isArray(bIds)) parsedIds = bIds.map(Number).filter(Boolean);
                    else if (typeof bIds === 'string') {
                        try {
                            const parsed = JSON.parse(bIds);
                            if (Array.isArray(parsed)) parsedIds = parsed.map(Number).filter(Boolean);
                            else parsedIds = bIds.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
                        } catch {
                            parsedIds = bIds.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
                        }
                    }
                }
                const ids = new Set(parsedIds);
                if (Array.isArray(item.branches)) {
                    item.branches.forEach(b => {
                        const id = Number(b?.id ?? b?.branchId);
                        if (Number.isFinite(id) && id > 0) ids.add(id);
                    });
                }
                if (Array.isArray(item.branchRoles)) {
                    item.branchRoles.forEach(br => {
                        const id = Number(br?.branchId);
                        if (Number.isFinite(id) && id > 0) ids.add(id);
                    });
                }
                if (item.branchId !== undefined && item.branchId !== null) {
                    const id = Number(item.branchId);
                    if (Number.isFinite(id) && id > 0) ids.add(id);
                }
                
                const currentBranchIds = Array.from(ids).filter(id => availableBranches.some(b => b.id === id));
                
                await apiService.organizations.updateMemberAccess(selectedOrg.id, item.id, {
                    role: getRole(item).toLowerCase(),
                    branchIds: getRole(item).toLowerCase() === 'member' ? currentBranchIds : undefined,
                    status: newStatus,
                    name: item.name || item.fullName || '',
                    email: item.email || ''
                });
            } else {
                await apiService.orgs.update(item.id, {
                    name: item.name,
                    baseCurrency: item.baseCurrency,
                    logo: item.logo,
                    status: newStatus
                });
            }
        } catch (error) {
            // Revert on failure
            setItems(prevItems => prevItems.map(obj => 
                obj.id === item.id ? { ...obj, status: item.status } : obj
            ));
            console.error("Status toggle failed:", error);
            showToast(error.response?.data?.message || "Failed to toggle status", "error");
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-white animate-in fade-in duration-300 relative">
            {/* Top Bar with Tabs ONLY */}
            <div className="flex items-end px-4 pt-4 border-b border-gray-200 bg-white md:px-4 xl:px-6">
                <div className="flex space-x-8 h-full items-end">
                    <button
                        className={`pb-3 text-[14px] font-bold transition-colors border-b-2 ${view === 'profile' ? 'text-[#4A8AF4] border-[#4A8AF4]' : 'text-gray-500 border-transparent hover:text-gray-800'}`}
                        onClick={() => setView('profile')}
                    >
                        Profile
                    </button>
                    <button
                        className={`pb-3 text-[14px] font-bold transition-colors border-b-2 ${view === 'users' ? 'text-[#4A8AF4] border-[#4A8AF4]' : 'text-gray-500 border-transparent hover:text-gray-800'}`}
                        onClick={() => setView('users')}
                    >
                        Users
                    </button>
                    <button
                        className={`pb-3 text-[14px] font-bold transition-colors border-b-2 ${view === 'organizations' ? 'text-[#4A8AF4] border-[#4A8AF4]' : 'text-gray-500 border-transparent hover:text-gray-800'}`}
                        onClick={() => setView('organizations')}
                    >
                        Organizations
                    </button>
                </div>
            </div>

            {/* Body Part */}
            <div className="flex-1 flex flex-col min-h-0">
                {view === 'profile' ? (
                    <Profile />
                ) : (
                    <>
                        {/* Action Bar */}
                <div className="flex justify-end px-6 py-3">
                    <button 
                        onClick={() => handleOpenModal()}
                        className="group h-[32px] px-3.5 flex items-center gap-1.5 justify-center rounded-md border border-blue-200 bg-blue-50/50 hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all text-[13px] font-semibold"
                    >
                        <Plus size={15} strokeWidth={2.5} className="text-[#4A8AF4]/80 group-hover:text-[#4A8AF4] transition-colors" />
                        <span className="text-[#3B6FC8] group-hover:text-[#2F5FC6] transition-colors">
                            New {view === 'organizations' ? 'Organization' : 'User'}
                        </span>
                    </button>
                </div>

                {/* Table Area */}
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-[#fcfcfc] border-b border-gray-100">
                            <tr>
                                {view === 'organizations' ? (
                                    <>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Base Currency</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Created By</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Status</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Added By</th>
                                        <th className="px-6 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-gray-500">Loading...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-gray-500">No {view} found.</td>
                                </tr>
                            ) : items.map((item, idx) => (
                                <tr 
                                    key={item.id || idx} 
                                    onClick={() => handleOpenModal(item)}
                                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                >
                                    {view === 'organizations' ? (
                                        <>
                                            <td 
                                                className="px-6 py-3.5 text-[13px] font-medium text-gray-600 hover:underline cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-5 h-5 shrink-0 flex items-center justify-center cursor-pointer rounded hover:bg-gray-100 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            localStorage.setItem('selectedOrgManual', '1');
                                                            setSelectedOrg(item);
                                                        }}
                                                    >
                                                        {selectedOrg?.id === item.id && (
                                                            <Check size={16} className="text-[#4A8AF4]" strokeWidth={3} />
                                                        )}
                                                    </div>
                                                    {item.logo ? (
                                                        <img src={item.logo} alt="" className="w-5 h-5 rounded object-cover border border-gray-200" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
                                                            <Building2 size={10} className="text-gray-400" />
                                                        </div>
                                                    )}
                                                    {item.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5 text-[13px] font-medium text-gray-600">{item.baseCurrency || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600">{getCreatedBy(item)}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-right">
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickStatusToggle(item, false);
                                                    }}
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:brightness-95 transition-colors ${Number(item.status) === 2 ? 'text-gray-500' : 'text-emerald-600'}`}
                                                >
                                                    {Number(item.status) === 2 ? 'Inactive' : 'Active'}
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-3.5 text-[13px] font-medium text-gray-600 group-hover:underline">{item.name || item.fullName || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] font-medium text-gray-600">{item.email || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600 capitalize">
                                                {String(getRole(item)).toLowerCase()}
                                            </td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600">{getAddedBy(item)}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-right">
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickStatusToggle(item, true);
                                                    }}
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:brightness-95 transition-colors ${Number(item.status) === 2 ? 'text-gray-500' : 'text-emerald-600'}`}
                                                >
                                                    {Number(item.status) === 2 ? 'Inactive' : 'Active'}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                    </>
                )}
            </div>

            {/* Center Modal Form */}
            {isModalOpen && createPortal(
                <div className={`fixed inset-0 z-[9999] bg-black/30 flex justify-center items-center px-4 transition-opacity duration-200 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
                    <div className={`bg-white rounded-lg shadow-2xl w-full max-w-[400px] flex flex-col overflow-hidden transition-all duration-200 transform ${isMounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                            <div className="flex items-center gap-2 text-gray-800">
                                {view === 'organizations' ? <Building2 size={18} className="text-gray-500" /> : <User size={18} className="text-gray-500" />}
                                <h2 className="text-[15px] font-semibold">
                                    {editingItem ? 'Edit' : 'New'} {view === 'organizations' ? 'Organization' : 'User'}
                                </h2>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-md">
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Form Body */}
                        <form onSubmit={handleSave} className="flex flex-col">
                            <div className="px-5 py-5 space-y-4 bg-white">
                                {view === 'organizations' ? (
                                    <>
                                        <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100 border-dashed">
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border border-gray-200 bg-white overflow-hidden relative shrink-0 shadow-sm ${!logoPreview ? 'text-gray-300' : ''}`}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Upload size={20} />
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-semibold text-gray-600">Organization Logo</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">Recommended: Square, Max 2MB</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Organization Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                placeholder="e.g. Acme Corp"
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Base Currency</label>
                                            <CurrencySelector
                                                value={formData.baseCurrency}
                                                onChange={(val) => setFormData({...formData, baseCurrency: val})}
                                                className="w-full h-[36px] bg-white border border-gray-200 rounded-md focus-within:border-[#4A8AF4] focus-within:ring-2 focus-within:ring-[#4A8AF4]/20 transition-all justify-between px-3 shadow-none cursor-pointer"
                                                triggerTextClassName="text-[13px] font-medium"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Full Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                placeholder="John Doe"
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md hover:border-[#BAE6FD] hover:bg-[#F0F9FF] focus:outline-none focus:bg-[#F0F9FF] focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Email Address</label>
                                            <input 
                                                type="email" 
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                placeholder="john@example.com"
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md hover:border-[#BAE6FD] hover:bg-[#F0F9FF] focus:outline-none focus:bg-[#F0F9FF] focus:border-[#BAE6FD] focus:ring-2 focus:ring-blue-100 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Role</label>
                                            <CustomSelect
                                                value={formData.role}
                                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                                                className="w-full h-[36px] px-3 bg-white border border-gray-200 rounded-md focus-within:border-[#4A8AF4] focus-within:ring-2 focus-within:ring-[#4A8AF4]/20 transition-all text-[13px]"
                                            >
                                                <option value="owner">Owner</option>
                                                <option value="admin">Admin</option>
                                                <option value="member">Member</option>
                                            </CustomSelect>
                                        </div>
                                        {formData.role === 'member' && (
                                            <div className="space-y-1.5 mt-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[12px] font-semibold text-gray-600">Assign Branches</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (selectedBranchIds.length === availableBranches.length && availableBranches.length > 0) {
                                                                setSelectedBranchIds([]);
                                                            } else {
                                                                setSelectedBranchIds(availableBranches.map(b => b.id));
                                                            }
                                                        }}
                                                        className="text-[11px] font-medium text-[#4A8AF4] hover:underline"
                                                    >
                                                        {selectedBranchIds.length === availableBranches.length && availableBranches.length > 0 ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="max-h-[120px] overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50/50 custom-scrollbar">
                                                    {availableBranches.map(branch => (
                                                        <label key={branch.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded cursor-pointer transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedBranchIds.includes(Number(branch.id))}
                                                                onChange={(e) => {
                                                                    const bId = Number(branch.id);
                                                                    if (e.target.checked) {
                                                                        setSelectedBranchIds([...selectedBranchIds, bId]);
                                                                    } else {
                                                                        setSelectedBranchIds(selectedBranchIds.filter(id => id !== bId));
                                                                    }
                                                                }}
                                                                className="w-3.5 h-3.5 rounded border-gray-300 text-[#4A8AF4] focus:ring-[#4A8AF4]"
                                                            />
                                                            <span className="text-[12px] text-gray-700 font-medium">{branch.name}</span>
                                                        </label>
                                                    ))}
                                                    {availableBranches.length === 0 && (
                                                        <p className="text-[11px] text-gray-500 text-center py-2">No branches available.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({...prev, status: prev.status === 1 ? 2 : 1}))}
                                        className={`relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4A8AF4] focus:ring-offset-1 ${formData.status === 1 ? 'bg-[#4A8AF4]' : 'bg-gray-300'}`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${formData.status === 1 ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                                        />
                                    </button>
                                    <span className="text-[12px] font-bold text-gray-700">
                                        {formData.status === 1 ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="text-[12px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 text-[12px] font-bold text-white bg-[#4A8AF4] rounded-lg hover:bg-[#3E79DE] transition-colors shadow-sm flex items-center gap-1.5"
                                    >
                                        <Save size={14} strokeWidth={2.5} />
                                        Save
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Settings;
