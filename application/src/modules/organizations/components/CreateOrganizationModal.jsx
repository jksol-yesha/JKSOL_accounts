import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Check, ChevronDown, List, Plus } from 'lucide-react';
import apiService from '../../../services/api';
import { useCurrencyOptions } from '../../../hooks/useCurrencyOptions';

const CreateOrganizationModal = ({ isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        baseCurrency: 'INR',
        fyStartMonth: 'April',
        defaultBranchName: 'Main Branch',
        defaultBranchCurrency: 'INR'
    });

    // Refs for navigation
    const nameRef = useRef(null);
    const currencyRef = useRef(null);
    const fyRef = useRef(null);
    const branchNameRef = useRef(null);
    const branchCurrencyRef = useRef(null);
    const submitRef = useRef(null);

    const [viewMode, setViewMode] = useState('create'); // 'create' | 'list'
    const [orgsList, setOrgsList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFetchingOrgs, setIsFetchingOrgs] = useState(false);
    const { currencyOptions } = useCurrencyOptions();

    useEffect(() => {
        if (isOpen) {
            setViewMode('create');
            setFormData({
                name: '',
                baseCurrency: 'INR',
                fyStartMonth: 'April',
                defaultBranchName: 'Main Branch',
                defaultBranchCurrency: 'INR'
            });
            setError('');
            setShowSuccess(false);
            setTimeout(() => nameRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const fetchOrgs = async () => {
        setIsFetchingOrgs(true);
        try {
            const response = await apiService.orgs.getAll();
            let data = [];
            if (Array.isArray(response)) {
                data = response;
            } else if (response?.data && Array.isArray(response.data)) {
                data = response.data;
            } else if (response?.orgs && Array.isArray(response.orgs)) {
                data = response.orgs;
            }
            setOrgsList(data.map(item => item.org || item));
        } catch (err) {
            console.error("Failed to fetch orgs", err);
        } finally {
            setIsFetchingOrgs(false);
        }
    };

    const handleViewToggle = () => {
        if (viewMode === 'create') {
            setViewMode('list');
            fetchOrgs();
        } else {
            setViewMode('create');
            setTimeout(() => nameRef.current?.focus(), 100);
        }
    };

    const filteredOrgs = orgsList.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ... (keep existing handleKeyDown)

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextRef && nextRef.current) {
                nextRef.current.focus();
            } else {
                handleSubmit();
            }
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');

        if (!formData.name) {
            setError('Organization Name is required');
            return;
        }

        const MONTHS = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
            'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
        };

        const payload = {
            ...formData,
            fyStartMonth: MONTHS[formData.fyStartMonth] || 4
        };

        setIsLoading(true);
        try {
            const response = await apiService.orgs.create(payload);
            setShowSuccess(true);
            setTimeout(() => {
                // Handle different response structures
                const newOrg = response.data || response;
                onSuccess(newOrg);
                onClose();
            }, 1000);
        } catch (err) {
            console.error("Failed to create organization:", err);
            setError(err.response?.data?.message || 'Failed to create organization');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                            {viewMode === 'create' ? 'Create Organization' : 'All Organizations'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {viewMode === 'create' ? 'Enter details for the new organization' : 'View and manage your organizations'}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleViewToggle}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors mr-2"
                        >
                            {viewMode === 'create' ? <List size={16} /> : <Plus size={16} />}
                            <span>{viewMode === 'create' ? 'View All' : 'Create New'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-full transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {showSuccess ? (
                        <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 animate-[bounce_1s_infinite]">
                                <Check size={32} strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Organization Created!</h3>
                            <p className="text-gray-500 text-center text-sm">
                                Adding to your list...
                            </p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Search organizations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all placeholder:text-gray-400"
                                autoFocus
                            />

                            {isFetchingOrgs ? (
                                <div className="flex justify-center py-8">
                                    <span className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                </div>
                            ) : filteredOrgs.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredOrgs.map(org => (
                                        <div key={org.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-black/10 transition-all group">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{org.name}</span>
                                                <span className="text-xs text-gray-400">{org.baseCurrency} • Fy Start: {org.fyStartMonth}</span>
                                            </div>
                                            {/* Could add edit/delete actions here later */}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <p>No organizations found.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm font-medium text-center border border-red-100">
                                    {error}
                                </div>
                            )}

                            {/* Organization Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                    Organization Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    onKeyDown={(e) => handleKeyDown(e, currencyRef)}
                                    placeholder="e.g. Acme Corp"
                                    className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all placeholder:text-gray-400 placeholder:font-normal"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Base Currency */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                        Base Currency
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={currencyRef}
                                            name="baseCurrency"
                                            value={formData.baseCurrency}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, fyRef)}
                                            className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {currencyOptions.map(opt => (
                                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* FY Start Month */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                        FY Start Month
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={fyRef}
                                            name="fyStartMonth"
                                            value={formData.fyStartMonth}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, branchNameRef)}
                                            className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Default Branch Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                        Branch Name
                                    </label>
                                    <input
                                        ref={branchNameRef}
                                        type="text"
                                        name="defaultBranchName"
                                        value={formData.defaultBranchName}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, branchCurrencyRef)}
                                        placeholder="e.g. Head Office"
                                        className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all placeholder:text-gray-400 placeholder:font-normal"
                                    />
                                </div>

                                {/* Default Branch Currency */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                        Branch Currency
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={branchCurrencyRef}
                                            name="defaultBranchCurrency"
                                            value={formData.defaultBranchCurrency}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, submitRef)}
                                            className="w-full px-4 h-11 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {currencyOptions.map(opt => (
                                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer - Fixed */}
                {!showSuccess && viewMode === 'create' && (
                    <div className="p-6 border-t border-gray-50 bg-white sticky bottom-0 z-20">
                        <button
                            ref={submitRef}
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full bg-black hover:bg-black/90 text-white text-[15px] font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    <span>Create Organization</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateOrganizationModal;
