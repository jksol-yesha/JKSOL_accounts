import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Building2, User } from 'lucide-react';
import apiService from '../../services/api';
import CustomSelect from '../../components/common/CustomSelect';
import Profile from '../profile/Profile';

const Settings = () => {
    const [view, setView] = useState('profile');
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', role: 'member', baseCurrency: 'USD' });

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

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData({
                name: item.name || item.fullName || '',
                email: item.email || '',
                role: String(getRole(item)).toLowerCase() || 'member',
                baseCurrency: item.baseCurrency || 'USD'
            });
        } else {
            setFormData({ name: '', email: '', role: 'member', baseCurrency: 'USD' });
        }
        setIsModalOpen(true);
        setTimeout(() => setIsMounted(true), 10);
    };

    const handleCloseModal = () => {
        setIsMounted(false);
        setTimeout(() => {
            setIsModalOpen(false);
            setEditingItem(null);
        }, 200);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        // Placeholder for actual save logic
        // await apiService...
        handleCloseModal();
        fetchData(); // Refresh list after save
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
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4A8AF4] text-white text-[13px] font-bold rounded hover:bg-[#3b7eed] transition-all active:scale-95 shadow-sm"
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        New {view === 'organizations' ? 'Organization' : 'User'}
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
                                            <td className="px-6 py-3.5 text-[13px] font-semibold text-[#4A8AF4] group-hover:underline">{item.name}</td>
                                            <td className="px-6 py-3.5 text-[13px] font-medium text-gray-600">{item.baseCurrency || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600">{getCreatedBy(item)}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-right">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    Active
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-3.5 text-[13px] font-semibold text-[#4A8AF4] group-hover:underline">{item.name || item.fullName || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] font-medium text-gray-600">{item.email || '-'}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600 capitalize">
                                                {String(getRole(item)).toLowerCase()}
                                            </td>
                                            <td className="px-6 py-3.5 text-[13px] text-gray-600">{getAddedBy(item)}</td>
                                            <td className="px-6 py-3.5 text-[13px] text-right">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    Active
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
                                            <input 
                                                type="text" 
                                                required
                                                maxLength={3}
                                                value={formData.baseCurrency}
                                                onChange={(e) => setFormData({...formData, baseCurrency: e.target.value.toUpperCase()})}
                                                placeholder="USD"
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all uppercase"
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
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all"
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
                                                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[12px] font-semibold text-gray-600">Role</label>
                                            <CustomSelect
                                                value={formData.role}
                                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                                                className="w-full h-[36px] bg-white border border-gray-200 rounded-md focus-within:border-[#4A8AF4] focus-within:ring-2 focus-within:ring-[#4A8AF4]/20 transition-all text-[13px]"
                                            >
                                                <option value="owner">Owner</option>
                                                <option value="admin">Admin</option>
                                                <option value="member">Member</option>
                                            </CustomSelect>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm min-w-[70px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-[12px] font-semibold text-white bg-[#4A8AF4] border border-[#4A8AF4] rounded-md hover:bg-[#3E79DE] hover:border-[#3E79DE] transition-colors shadow-sm min-w-[70px]"
                                >
                                    Save
                                </button>
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
