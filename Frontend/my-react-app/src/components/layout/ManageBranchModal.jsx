import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Plus, ChevronDown, Check, ArrowLeft, Edit2, Trash2, AlertCircle, Power, Search, Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';

const ManageBranchModal = ({ isOpen, onClose }) => {
    const { selectedBranch, setSelectedBranch, selectedBranchIds, refreshBranches } = useBranch();
    const { user } = useAuth();
    const { selectedOrg } = useOrganization();
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [countrySearch, setCountrySearch] = useState('');
    const [currencySearch, setCurrencySearch] = useState('');
    const countryRef = useRef(null);
    const currencyRef = useRef(null);

    // Handle click outside dropdowns to close them
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (countryRef.current && !countryRef.current.contains(event.target)) {
                setShowCountryDropdown(false);
            }
            if (currencyRef.current && !currencyRef.current.contains(event.target)) {
                setShowCurrencyDropdown(false);
            }
        };

        if (showCountryDropdown || showCurrencyDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCountryDropdown, showCurrencyDropdown]);

    // Form State
    const [formData, setFormData] = useState({
        orgId: selectedOrg?.id || 1,
        name: '',
        currencyCode: '',
        country: '',
        status: 1
    });

    const [requestError, setRequestError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [branchesList, setBranchesList] = useState([]);
    const [countries, setCountries] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'status' ? parseInt(value) : value
        }));
    };

    const fetchBranches = async () => {
        setIsLoading(true);
        try {
            const [branchRes, countryRes] = await Promise.all([
                apiService.branches.getAll(),
                apiService.countries.getAll().catch(() => ({ data: [] }))
            ]);

            const branchesData = branchRes.data?.data || branchRes.data || branchRes || [];
            setBranchesList(Array.isArray(branchesData) ? branchesData : []);

            const countriesData = countryRes.data || [];
            setCountries(countriesData);

            // Extract unique currencies from the countries list and format them for the dropdown
            const uniqueCurrencies = [...new Set(countriesData.map(c => c.countryCurrency).filter(Boolean))].sort();
            setCurrencies(uniqueCurrencies.map(code => ({ code, name: code })));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
            setHasLoadedOnce(true);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setHasLoadedOnce(false);
            fetchBranches();
            // Reset state on open
            setIsCreating(false);
            setEditingId(null);
            setSuccessMessage('');
            setRequestError('');
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setFormData({
            orgId: selectedOrg?.id || 1,
            name: '',
            currencyCode: '',
            country: '',
            status: 1
        });
    };

    const handleEdit = (branch) => {
        setEditingId(branch.id);
        setFormData({
            orgId: branch.orgId || selectedOrg?.id || 1,
            name: branch.name,
            currencyCode: branch.currencyCode || '',
            country: branch.country || '',
            status: branch.status || 1
        });
        setIsCreating(true); // Re-use the creation view for editing
        setRequestError('');
        setSuccessMessage('');
    };

    const handleToggleStatus = async (e, branch) => {
        e.stopPropagation();
        const newStatus = branch.status === 1 ? 2 : 1;
        const action = newStatus === 1 ? 'Activate' : 'Deactivate';

        try {
            // console.log(`[ManageBranch] Toggling status for ${branch.name} to ${newStatus}`);
            const response = await apiService.branches.update(branch.id, { status: newStatus });

            // Update list locally
            const updatedBranch = response.data;
            setBranchesList(prev => prev.map(b => b.id === branch.id ? updatedBranch : b));

            // If updating currently selected branch
            if (selectedBranch?.id === branch.id) {
                setSelectedBranch(updatedBranch);
            }

            // Refresh global branch list
            if (refreshBranches) {
                await refreshBranches();
            }
        } catch (error) {
            console.error(`Failed to ${action} branch:`, error);
            // alert(`Failed to ${action} branch.`); // Silent fail or show toast better, but removing alert for now.
        }
    };

    const handleDeleteBranch = async (e, branch) => {
        e.stopPropagation();

        if (!window.confirm(`Are you sure you want to PERMANENTLY delete branch "${branch.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await apiService.branches.delete(branch.id);
            // Update list locally
            setBranchesList(prev => prev.filter(b => b.id !== branch.id));

            // If deleted currently selected branch
            if (selectedBranch?.id === branch.id) {
                const remaining = branchesList.find(b => b.id !== branch.id);
                setSelectedBranch(remaining || null);
                if (remaining) {
                    localStorage.setItem('selectedBranch', JSON.stringify(remaining));
                } else {
                    localStorage.removeItem('selectedBranch');
                    // Might need to force a reload or redirect if app breaks without branch
                    window.location.reload();
                }
            }

            // Refresh global branch list
            if (refreshBranches) {
                await refreshBranches();
            }
        } catch (error) {
            console.error('Failed to delete branch:', error);
            alert(error.response?.data?.message || 'Failed to delete branch. Ensure it has no active accounts.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setRequestError('');
        setSuccessMessage('');

        // Validation: Country
        if (!formData.country) {
            setRequestError('Please select a country');
            return;
        }

        // Validation: Currency
        if (!formData.currencyCode) {
            setRequestError('Please select a currency');
            return;
        }

        if (formData.currencyCode.length < 3) {
            setRequestError('Currency code must be at least 3 characters');
            return;
        }

        // Validation 2: Unique Name
        const nameExists = branchesList.some(b =>
            b.name.toLowerCase() === formData.name.toLowerCase() && b.id !== editingId
        );
        if (nameExists) {
            setRequestError('A branch with this name already exists in the organization.');
            return;
        }

        try {
            if (editingId) {
                // Update
                // Exclude orgId from the update payload as it's not allowed in the schema
                const { orgId, ...updateData } = formData;
                const response = await apiService.branches.update(editingId, updateData);
                // console.log('Branch updated:', response.data);
                setSuccessMessage(`Branch '${response.data.name}' updated successfully!`);

                // Update list locally
                setBranchesList(prev => prev.map(b => b.id === editingId ? response.data : b));

                // If updating currently selected branch, update context
                if (selectedBranch?.id === editingId) {
                    setSelectedBranch(response.data);
                }

                // Refresh global list
                if (refreshBranches) await refreshBranches();
            } else {
                // Create
                const response = await apiService.branches.create(formData);
                // console.log('Branch created:', response.data);
                setSuccessMessage(`Branch '${response.data.name}' created successfully!`);

                // Append locally
                setBranchesList(prev => [...prev, response.data]);

                // Refresh global list
                if (refreshBranches) await refreshBranches();

                // Reset form for next entry
                resetForm();
            }
        } catch (error) {
            console.error('Operation failed:', error);
            setRequestError(error.response?.data?.message || error.message || 'Operation failed');
        }
    };

    // Branch selection happens only in the BranchSelector dropdown now.

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-visible flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-none bg-white rounded-t-2xl z-20">
                    <div className="flex items-center gap-2">
                        {isCreating && (
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingId(null);
                                    resetForm();
                                    setSuccessMessage('');
                                    setRequestError('');
                                }}
                                className="mr-2 text-gray-400 hover:text-black transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 className="text-gray-900" size={24} />
                            {isCreating ? (editingId ? 'Update Branch' : 'New Branch') : 'Manage Branch'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className={`p-6 min-h-0 ${!isCreating ? 'overflow-y-auto' : 'overflow-visible'}`}>
                    {successMessage ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 mb-2">Success!</h4>
                            <p className="text-gray-600 mb-6">{successMessage}</p>
                            <button
                                onClick={() => {
                                    setSuccessMessage('');
                                    setIsCreating(false);
                                    setEditingId(null);
                                }}
                                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                            >
                                Back to List
                            </button>
                        </div>
                    ) : !isCreating ? (
                        <div className="space-y-6">
                            {/* Add New Branch Option */}
                            {['owner', 'admin'].includes(selectedOrg?.role?.toLowerCase()) && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all group shadow-sm hover:shadow"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm text-gray-800">Add New Branch</span>
                                        <span className="text-xs text-gray-500 font-medium">Register a new location</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white text-gray-500 border border-gray-200 flex items-center justify-center group-hover:text-black group-hover:border-gray-300 transition-colors">
                                        <Plus size={18} />
                                    </div>
                                </button>
                            )}

                            <div className="relative border-t border-gray-100 my-2"></div>

                            {/* Branch List */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Branches</h4>
                                <div className="relative">
                                    {isLoading && branchesList.length === 0 ? (
                                        <div className="min-h-[180px] flex items-center justify-center">
                                            <Loader2 size={24} className="text-gray-500 animate-spin" />
                                        </div>
                                    ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                        {branchesList.length === 0 && hasLoadedOnce && !isLoading ? (
                                        <div className="text-center py-4 text-gray-400 text-xs">No branches found.</div>
                                    ) : (
                                        branchesList.map((branch) => {
                                            const isSelected = selectedBranchIds?.includes(Number(branch.id)) || false;
                                            return (
                                                <div
                                                    key={branch.id}
                                                    className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-300 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3 flex-1">
                                                        {/* Selection Dot */}
                                                        <div
                                                            className={`w-2 h-2 rounded-full ${isSelected ? 'bg-black' : 'bg-transparent'}`}
                                                        />

                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-sm font-bold text-gray-700">
                                                                    {branch.name}
                                                                </div>
                                                                {/* Status Indicator */}
                                                                {branch.status === 2 && (
                                                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 font-medium flex gap-2">
                                                                <span>{branch.country || 'Unknown Country'}</span>
                                                                <span>•</span>
                                                                <span>{branch.currencyCode}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {['owner', 'admin'].includes(selectedOrg?.role?.toLowerCase()) && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEdit(branch); }}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit Branch"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleToggleStatus(e, branch)}
                                                                className={`p-1.5 rounded-lg transition-colors ${branch.status === 1
                                                                    ? 'text-emerald-500 hover:text-rose-600 hover:bg-rose-50'
                                                                    : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                                    }`}
                                                                title={branch.status === 1 ? "Deactivate Branch" : "Activate Branch"}
                                                            >
                                                                <Power size={14} className={branch.status === 1 ? "fill-current" : ""} />
                                                            </button>

                                                            {/* Delete Button */}
                                                            <button
                                                                onClick={(e) => handleDeleteBranch(e, branch)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete Branch"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    </div>
                                    )}
                                    {isLoading && branchesList.length > 0 && (
                                        <div className="absolute inset-0 z-10 bg-white/85 rounded-xl flex flex-col items-center justify-center">
                                            <Loader2 size={22} className="text-gray-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Branch Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                    placeholder="Enter branch name"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative" ref={countryRef}>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Country</label>
                                    <input type="hidden" name="country" value={formData.country} required />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCountryDropdown(!showCountryDropdown);
                                            setShowCurrencyDropdown(false);
                                            setCountrySearch('');
                                        }}
                                        className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white flex justify-between items-center"
                                    >
                                        <span className={formData.country ? "text-black" : "text-gray-400 font-medium"}>
                                            {formData.country || "Select Country"}
                                        </span>
                                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showCountryDropdown && (
                                        <div className="absolute z-50 w-full top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0">
                                                <div className="relative group">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                    <input
                                                        type="text"
                                                        value={countrySearch}
                                                        onChange={(e) => setCountrySearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const filtered = countries.filter(c =>
                                                                    c.countryName.toLowerCase().includes(countrySearch.toLowerCase())
                                                                );
                                                                if (filtered.length > 0) {
                                                                    const first = filtered[0];
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        country: first.countryName,
                                                                        currencyCode: first.countryCurrency || prev.currencyCode
                                                                    }));
                                                                    setShowCountryDropdown(false);
                                                                    setCountrySearch('');
                                                                }
                                                            }
                                                        }}
                                                        placeholder="Search countries..."
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md outline-none focus:border-gray-400 placeholder-gray-400 transition-all"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                {countries.filter(c => c.countryName.toLowerCase().includes(countrySearch.toLowerCase())).length > 0 ? (
                                                    countries.filter(c => c.countryName.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const targetCountry = c.countryName;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    country: targetCountry,
                                                                    currencyCode: c.countryCurrency || prev.currencyCode
                                                                }));
                                                                setShowCountryDropdown(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${formData.country === c.countryName ? 'bg-gray-50 font-bold text-black border-r-2 border-black' : 'text-gray-700'}`}
                                                        >
                                                            {c.countryName}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-gray-400 font-bold italic">No countries found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative" ref={currencyRef}>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Currency</label>
                                    <input type="hidden" name="currencyCode" value={formData.currencyCode} required />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCurrencyDropdown(!showCurrencyDropdown);
                                            setShowCountryDropdown(false);
                                            setCurrencySearch('');
                                        }}
                                        className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white flex justify-between items-center"
                                    >
                                        <span className={formData.currencyCode ? "text-black" : "text-gray-400 font-medium"}>
                                            {formData.currencyCode || "Select Currency"}
                                        </span>
                                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showCurrencyDropdown && (
                                        <div className="absolute z-50 w-full top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0">
                                                <div className="relative group">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                    <input
                                                        type="text"
                                                        value={currencySearch}
                                                        onChange={(e) => setCurrencySearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const filtered = currencies.filter(c =>
                                                                    c.code.toLowerCase().includes(currencySearch.toLowerCase())
                                                                );
                                                                if (filtered.length > 0) {
                                                                    const first = filtered[0];
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        currencyCode: first.code
                                                                    }));
                                                                    setShowCurrencyDropdown(false);
                                                                    setCurrencySearch('');
                                                                }
                                                            }
                                                        }}
                                                        placeholder="Search currencies..."
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md outline-none focus:border-gray-400 placeholder-gray-400 transition-all"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                {currencies.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase())).length > 0 ? (
                                                    currencies.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase())).map(c => (
                                                        <button
                                                            key={c.code}
                                                            type="button"
                                                            onClick={() => {
                                                                const targetValue = c.code;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    currencyCode: targetValue
                                                                }));
                                                                setShowCurrencyDropdown(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${formData.currencyCode === c.code ? 'bg-gray-50 font-bold text-black border-r-2 border-black' : 'text-gray-700'}`}
                                                        >
                                                            {c.code}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-gray-400 font-bold italic">No currencies found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700">Status</h3>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="status"
                                        checked={formData.status === 1}
                                        onChange={(e) => handleInputChange({ target: { name: 'status', value: e.target.checked ? 1 : 2 } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                                </label>
                            </div>

                            {requestError && (
                                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-start gap-2">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <span>{requestError}</span>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
                                >
                                    {editingId ? 'Update Branch' : 'Create Branch'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer only for List View */}
                {!isCreating && (
                    <div className="bg-gray-50 px-6 py-4 flex justify-end rounded-b-2xl flex-none">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div >,
        document.body
    );
};

export default ManageBranchModal;
