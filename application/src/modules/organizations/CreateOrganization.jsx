import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, Building2, ChevronDown } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import { Loader } from '../../components/common/Loader';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';
import apiService from '../../services/api';

const CreateOrganization = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');
    const { currencyOptions } = useCurrencyOptions();

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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

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
            await apiService.orgs.create(payload);
            setShowSuccess(true);
            setTimeout(() => {
                navigate('/organizations');
            }, 1500);
        } catch (err) {
            console.error("Failed to create organization:", err);
            setError(err.response?.data?.message || 'Failed to create organization');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen relative">
            <PageHeader
                title="Create Organization"
                breadcrumbs={['Settings', 'Organizations', 'Create New']}
            />

            <div className="p-4 lg:p-8 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleSubmit}>
                    <Card className="space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                        <div className="flex items-center space-x-4 border-b border-gray-50 pb-6">
                            <button
                                type="button"
                                onClick={() => navigate('/organizations')}
                                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-500"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Organization Details</h2>
                                <p className="text-sm text-gray-500">Enter the details for the new organization</p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-5">
                            {/* Organization Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                                    className="w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 transition-all placeholder:text-gray-400 placeholder:font-normal"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Base Currency */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Base Currency
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={currencyRef}
                                            name="baseCurrency"
                                            value={formData.baseCurrency}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, fyRef)}
                                            className="w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {currencyOptions.map(opt => (
                                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* FY Start Month */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        FY Start Month
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={fyRef}
                                            name="fyStartMonth"
                                            value={formData.fyStartMonth}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, branchNameRef)}
                                            className="w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Default Branch Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                                        className="w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 transition-all"
                                    />
                                </div>

                                {/* Default Branch Currency */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Branch Currency
                                    </label>
                                    <div className="relative">
                                        <select
                                            ref={branchCurrencyRef}
                                            name="defaultBranchCurrency"
                                            value={formData.defaultBranchCurrency}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleKeyDown(e, submitRef)}
                                            className="w-full px-3 h-10 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-black/10 focus:ring-2 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {currencyOptions.map(opt => (
                                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-50 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate('/organizations')}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                ref={submitRef}
                                type="submit"
                                disabled={isLoading}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-black hover:bg-black/90 transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2"
                            >
                                {isLoading ? (
                                    <Loader className="h-4 w-4 text-white" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        <span>Create Organization</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </Card>
                </form>
            </div>

            {/* Success Popup */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 animate-[bounce_1s_infinite]">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Organization created successfully. Redirecting...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateOrganization;
