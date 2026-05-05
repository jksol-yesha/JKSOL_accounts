import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Plus, ChevronDown, Check, ArrowLeft, Edit2, Trash2, AlertCircle, Power, Search, Save } from 'lucide-react';
import { Loader } from '../common/Loader';
import { cn } from '../../utils/cn';
import apiService from '../../services/api';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';
import { useBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';

const ManageBranchModal = ({ isOpen, onClose }) => {
    const { selectedBranch, setSelectedBranch, selectedBranchIds, refreshBranches } = useBranch();
    const { selectedOrg } = useOrganization();
    const { currencyOptions } = useCurrencyOptions();
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [countrySearch, setCountrySearch] = useState('');
    const [currencySearch, setCurrencySearch] = useState('');
    const countryRef = useRef(null);
    const currencyRef = useRef(null);

    // Animation States
    const [shouldRenderDrawer, setShouldRenderDrawer] = useState(isOpen);
    const [isClosingDrawer, setIsClosingDrawer] = useState(false);
    const closeAnimationTimerRef = useRef(null);

    useEffect(() => {
        let openStateTimer = null;
        if (isOpen) {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
            openStateTimer = setTimeout(() => {
                setShouldRenderDrawer(true);
                setIsClosingDrawer(false);
            }, 0);
            return () => {
                if (openStateTimer) clearTimeout(openStateTimer);
            };
        }

        if (!shouldRenderDrawer) return;

        openStateTimer = setTimeout(() => {
            setIsClosingDrawer(true);
        }, 0);

        closeAnimationTimerRef.current = setTimeout(() => {
            setShouldRenderDrawer(false);
            setIsClosingDrawer(false);
            closeAnimationTimerRef.current = null;
        }, 280);

        return () => {
            if (openStateTimer) clearTimeout(openStateTimer);
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
        };
    }, [isOpen, shouldRenderDrawer]);

    useEffect(() => {
        return () => {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
            }
        };
    }, []);

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
        setCountrySearch('');
        setCurrencySearch('');
    };

    const exitFormView = () => {
        setIsCreating(false);
        setEditingId(null);
        resetForm();
        setSuccessMessage('');
        setRequestError('');
        setShowCountryDropdown(false);
        setShowCurrencyDropdown(false);
    };

    const filteredCountries = countries.filter(c =>
        c.countryName.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const filteredCurrencies = currencyOptions.filter(c =>
        c.code.toLowerCase().includes(currencySearch.toLowerCase())
    );

    const selectCountry = (country) => {
        setFormData(prev => ({
            ...prev,
            country: country.countryName,
            currencyCode: country.countryCurrency || prev.currencyCode
        }));
        setCountrySearch(country.countryName);
        setShowCountryDropdown(false);
    };

    const selectCurrency = (currencyCode) => {
        setFormData(prev => ({
            ...prev,
            currencyCode
        }));
        setCurrencySearch(currencyCode);
        setShowCurrencyDropdown(false);
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
        setCountrySearch(branch.country || '');
        setCurrencySearch(branch.currencyCode || '');
        setIsCreating(true); // Re-use the creation view for editing
        setRequestError('');
        setSuccessMessage('');
    };

    const handleToggleStatus = async (e, branch) => {
        e.stopPropagation();
        const newStatus = branch.status === 1 ? 2 : 1;
        const action = newStatus === 1 ? 'Activate' : 'Deactivate';

        try {
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

        if (!window.confirm(`Are you sure you want to archive branch "${branch.name}"? It will be hidden from active lists.`)) {
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
            alert(error.response?.data?.message || 'Failed to archive branch.');
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
                const { orgId: _orgId, ...updateData } = formData;
                const response = await apiService.branches.update(editingId, updateData);
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

    if (!shouldRenderDrawer) return null;

    return createPortal(
        <>
            <div
                className={cn(
                    "fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[110]",
                    isClosingDrawer ? "animate-fade-out" : "animate-fade-in"
                )}
                onClick={onClose}
            ></div>

            <div className={cn(
                "fixed inset-y-0 right-0 z-[120] w-full max-w-[480px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden",
                isClosingDrawer ? "animate-slide-out-right" : "animate-slide-in-right"
            )}>
                {/* Header */}
                <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                {isCreating ? (
                                    <button onClick={exitFormView} className="hover:text-black transition-colors outline-none"><ArrowLeft size={14} strokeWidth={2.5} /></button>
                                ) : (
                                    <Building2 size={14} strokeWidth={2.5} />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                    {isCreating ? (editingId ? 'Update Branch' : 'New Branch') : 'Manage Branch'}
                                </h2>
                                <p className="text-[10px] font-semibold text-slate-500">
                                    {isCreating ? 'Add branch location to organize access' : 'Manage your organization\'s locations'}
                                </p>
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

                {/* Body - Scrollable */}
                <div className={`flex-1 px-5 py-5 min-h-0 ${!isCreating ? 'overflow-y-auto custom-scrollbar bg-white' : 'overflow-y-auto custom-scrollbar bg-white'}`}>
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
                                            <Loader className="h-6 w-6 text-[#4A8AF4]" />
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
                                            <Loader className="h-[22px] w-[22px] text-[#4A8AF4]" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex h-full flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto py-5 no-scrollbar bg-white">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Branch Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="w-full px-3 h-[34px] text-[13px] rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 focus:border-[#4A8AF4]"
                                            placeholder="Enter branch name"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative" ref={countryRef}>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Country</label>
                                            <input type="hidden" name="country" value={formData.country} required />
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                                <input
                                                    type="text"
                                                    value={showCountryDropdown ? countrySearch : formData.country}
                                                    onFocus={() => {
                                                        setShowCountryDropdown(true);
                                                        setShowCurrencyDropdown(false);
                                                        setCountrySearch('');
                                                    }}
                                                    onChange={(e) => {
                                                        setCountrySearch(e.target.value);
                                                        setShowCountryDropdown(true);
                                                        setShowCurrencyDropdown(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (filteredCountries.length > 0) {
                                                                selectCountry(filteredCountries[0]);
                                                            }
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setShowCountryDropdown(false);
                                                        }
                                                    }}
                                                    placeholder="Search country"
                                                    className="w-full pl-8 pr-7 h-[34px] rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 focus:border-[#4A8AF4] bg-white text-[13px] font-medium text-slate-800 placeholder:text-gray-400"
                                                />
                                                <ChevronDown size={14} className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                                            </div>

                                            {showCountryDropdown && (
                                                <div className="absolute z-50 w-full top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                        {filteredCountries.length > 0 ? (
                                                            filteredCountries.map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    onClick={() => selectCountry(c)}
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
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Currency</label>
                                            <input type="hidden" name="currencyCode" value={formData.currencyCode} required />
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                                <input
                                                    type="text"
                                                    value={showCurrencyDropdown ? currencySearch : formData.currencyCode}
                                                    onFocus={() => {
                                                        setShowCurrencyDropdown(true);
                                                        setShowCountryDropdown(false);
                                                        setCurrencySearch('');
                                                    }}
                                                    onChange={(e) => {
                                                        setCurrencySearch(e.target.value);
                                                        setShowCurrencyDropdown(true);
                                                        setShowCountryDropdown(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (filteredCurrencies.length > 0) {
                                                                selectCurrency(filteredCurrencies[0].code);
                                                            }
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setShowCurrencyDropdown(false);
                                                        }
                                                    }}
                                                    placeholder="Search currency"
                                                    className="w-full pl-8 pr-7 h-[34px] rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 focus:border-[#4A8AF4] bg-white text-[13px] font-medium text-slate-800 placeholder:text-gray-400"
                                                />
                                                <ChevronDown size={14} className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                                            </div>

                                            {showCurrencyDropdown && (
                                                <div className="absolute z-50 w-full top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                        {filteredCurrencies.length > 0 ? (
                                                            filteredCurrencies.map(c => (
                                                                <button
                                                                    key={c.code}
                                                                    type="button"
                                                                    onClick={() => selectCurrency(c.code)}
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

                                    {requestError && (
                                        <div className="p-3 bg-rose-50 text-rose-600 text-[11px] font-bold rounded-md border border-rose-100 flex items-start gap-2">
                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                            <span>{requestError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="py-2 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            name="status"
                                            checked={formData.status === 1}
                                            onChange={(e) => handleInputChange({ target: { name: 'status', value: e.target.checked ? 1 : 2 } })}
                                            tabIndex={-1}
                                            className="sr-only peer"
                                        />
                                        <div className="relative h-4 w-7 rounded-full bg-slate-200 shadow-inner transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-300 peer-checked:bg-[#4A8AF4] before:absolute before:left-[2px] before:top-[2px] before:h-3 before:w-3 before:rounded-full before:bg-white before:shadow-sm before:transition-transform before:duration-200 peer-checked:before:translate-x-3"></div>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600 select-none group-hover:text-slate-900 transition-colors">
                                        {formData.status === 1 ? 'Active' : 'Inactive'}
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={exitFormView}
                                        className="px-3 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold px-4 py-1 rounded-md shadow-sm active:scale-95 transition-all flex items-center gap-1.5 outline-none focus:ring-2 focus:ring-[#4A8AF4]/30"
                                    >
                                        <Save size={13} strokeWidth={2.5} />
                                        <span>{editingId ? 'Update' : 'Save'}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer only for List View */}
                {!isCreating && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
};

export default ManageBranchModal;
