import React, { useState, useEffect, useRef } from 'react';
import { Save, ChevronDown, Check, X, Building2 } from 'lucide-react';
import apiService from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../utils/cn';

const COUNTRY_CODES = [
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+358', country: 'Finland', flag: '🇫🇮' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+30', country: 'Greece', flag: '🇬🇷' },
    { code: '+36', country: 'Hungary', flag: '🇭🇺' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
];

const CreatePartyDrawer = ({ isOpen, onClose, party, onSuccess }) => {
    const { showToast } = useToast();
    const isEditing = !!party;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    
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
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const phoneInputRef = useRef(null);

    const [formData, setFormData] = useState({
        companyName: '',
        name: '',
        email: '',
        countryCode: '+91',
        phone: '',
        address: '',
        taxStatus: 'non-taxable',
        gstNo: '',
        gstName: '',
        isActive: true,
    });

    useEffect(() => {
        if (isOpen) {
            if (party) {
                const phoneMatch = (party.phone || '').match(/^(\+\d{1,4})\s*(.*)$/);
                const code = phoneMatch ? phoneMatch[1] : '+91';
                const number = phoneMatch ? phoneMatch[2] : (party.phone || '');
                setFormData({
                    id: party.id,
                    companyName: party.companyName || '',
                    name: party.name || '',
                    email: party.email || '',
                    countryCode: code,
                    phone: number,
                    address: party.address || '',
                    taxStatus: (party.gstNo || party.gstName) ? 'taxable' : 'non-taxable',
                    gstNo: party.gstNo || '',
                    gstName: party.gstName || '',
                    isActive: party.isActive !== undefined ? party.isActive : true,
                });
            } else {
                setFormData({
                    companyName: '',
                    name: '',
                    email: '',
                    countryCode: '+91',
                    phone: '',
                    address: '',
                    taxStatus: 'non-taxable',
                    gstNo: '',
                    gstName: '',
                    isActive: true,
                });
            }
            setErrors({});
            setShowCountryDropdown(false);
        }
    }, [isOpen, party]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCountryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const validateField = (name, value) => {
        let error = null;
        switch (name) {
            case 'companyName':
                if (!value.trim()) error = 'Company Name is required.';
                break;
            case 'email':
                if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format.';
                break;
            case 'phone':
                if (value.trim()) {
                    const digits = value.replace(/\D/g, '');
                    if (digits.length < 7 || digits.length > 15) error = 'Phone No. must be 7-15 digits.';
                }
                break;
            case 'gstNo':
                if (formData.taxStatus !== 'taxable') break;
                if (!value.trim()) {
                    error = 'GST No. is required.';
                } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
                    error = 'Invalid GST format.';
                }
                break;
            case 'gstName':
                if (formData.taxStatus !== 'taxable') break;
                if (!value.trim()) error = 'GST Name is required.';
                else if (value.trim().length < 3) error = 'Min 3 characters.';
                break;
            default:
                break;
        }
        return error;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => {
            const updated = { ...prev, [name]: newValue };
            if (name === 'taxStatus' && newValue === 'non-taxable') {
                updated.gstNo = '';
                updated.gstName = '';
            }
            return updated;
        });

        const fieldError = validateField(name, String(newValue));
        setErrors(prev => {
            const newErrors = { ...prev };
            if (name === 'taxStatus' && newValue === 'non-taxable') {
                delete newErrors.gstNo;
                delete newErrors.gstName;
            }
            if (fieldError) newErrors[name] = fieldError;
            else delete newErrors[name];
            return newErrors;
        });
    };

    const handleTaxToggle = (checked) => {
        const nextTaxStatus = checked ? 'taxable' : 'non-taxable';
        setFormData(prev => ({
            ...prev,
            taxStatus: nextTaxStatus,
            ...(checked ? { gstName: prev.companyName || '' } : { gstNo: '', gstName: '' }),
        }));
        setErrors(prev => {
            const newErrors = { ...prev };
            if (!checked) {
                delete newErrors.gstNo;
                delete newErrors.gstName;
            }
            return newErrors;
        });
    };

    const handleCountryCodeKeyDown = (e) => {
        if (!/^\d$/.test(e.key)) return;

        e.preventDefault();
        const currentPhone = phoneInputRef.current?.value || formData.phone || '';
        const nextPhone = `${currentPhone}${e.key}`;
        setFormData(prev => ({ ...prev, phone: nextPhone }));
        setErrors(prev => {
            const nextErrors = { ...prev };
            const fieldError = validateField('phone', nextPhone);
            if (fieldError) nextErrors.phone = fieldError;
            else delete nextErrors.phone;
            return nextErrors;
        });

        setTimeout(() => {
            const input = phoneInputRef.current;
            if (input && typeof input.focus === 'function') {
                input.focus({ preventScroll: true });
                if (typeof input.setSelectionRange === 'function') {
                    input.setSelectionRange(nextPhone.length, nextPhone.length);
                }
            }
        }, 0);
    };

    const validateForm = () => {
        const newErrors = {};
        const fieldsToValidate = ['companyName'];
        if (formData.taxStatus === 'taxable') {
            fieldsToValidate.push('gstNo', 'gstName');
        }

        fieldsToValidate.forEach(field => {
            const error = validateField(field, String(formData[field] || ''));
            if (error) newErrors[field] = error;
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            showToast?.('Please fix the errors in the form.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const normalizedPhone = (formData.phone || '').trim();
            const phone = normalizedPhone ? `${formData.countryCode} ${normalizedPhone}`.trim() : '';
            const basePayload = { ...formData, phone };
            delete basePayload.id;
            delete basePayload.countryCode;
            delete basePayload.taxStatus;

            if (formData.taxStatus !== 'taxable') {
                basePayload.gstNo = '';
                basePayload.gstName = '';
            }

            let savedParty;
            if (isEditing) {
                const response = await apiService.parties.update(party.id, basePayload);
                savedParty = response?.data || response;
                showToast?.('Party updated successfully', 'success');
            } else {
                const response = await apiService.parties.create(basePayload);
                savedParty = response?.data || response;
                showToast?.('Party created successfully', 'success');
            }

            if (savedParty) {
                onSuccess?.({
                    ...savedParty,
                    isActive: savedParty.isActive !== undefined ? savedParty.isActive : savedParty.status === 1,
                });
            } else {
                onSuccess?.();
            }
            onClose();
        } catch (error) {
            console.error('Failed to save party:', error);
            console.error('API VALIDATION ERROR DETAILS:', JSON.stringify(error.response?.data, null, 2));

            let msg = error.message || 'An unexpected error occurred.';
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    msg = error.response.data;
                } else if (error.response.data.message) {
                    msg = error.response.data.message;
                } else if (error.response.data.errors) {
                    try {
                        const errs = error.response.data.errors;
                        msg = errs.map(e => `${e.path.replace('/', '')} - ${e.message}`).join(', ');
                    } catch (e) {
                         msg = JSON.stringify(error.response.data);
                    }
                } else {
                     msg = JSON.stringify(error.response.data);
                }
            }
            showToast?.(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!shouldRenderDrawer) return null;

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div 
                className={cn(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
                    isClosingDrawer ? "animate-fade-out" : "animate-fade-in"
                )} 
                onClick={onClose} 
            />
            <div 
                className={cn(
                    "bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden",
                    isClosingDrawer ? "animate-slide-out-right" : "animate-slide-in-right"
                )}
            >

                {/* Header */}
                <div className="px-5 py-1 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                            <Building2 size={14} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                {isEditing ? "Edit Party" : "New Party"}
                            </h2>
                            <p className="text-[10px] font-semibold text-slate-500">
                                {isEditing ? "Update party details" : "Create a new party record"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar bg-white">
                        <div className="flex flex-col gap-4">

                            {/* Company Name */}
                            <div className="space-y-1 w-full">
                                <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                    Company Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    placeholder="Company Name"
                                    className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.companyName ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                    autoFocus
                                />
                                {errors.companyName && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.companyName}</p>}
                            </div>

                            {/* Contact Name */}
                            <div className="space-y-1 w-full">
                                <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                    Contact Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Contact Name"
                                    className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.name ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                {/* Phone Number */}
                                <div className="space-y-1 w-full">
                                    <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                        Phone No.
                                    </label>
                                    <div className={cn("relative flex items-center bg-white border rounded-md shadow-sm transition-all h-[34px]", errors.phone ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 focus-within:border-[#4A8AF4] focus-within:ring-2 focus-within:ring-[#4A8AF4]/10")} ref={dropdownRef}>
                                        <button
                                            type="button"
                                            className="h-full px-2 flex items-center justify-center gap-1 focus:outline-none hover:bg-slate-50 rounded-l-md border-r border-slate-200"
                                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                            onKeyDown={handleCountryCodeKeyDown}
                                        >
                                            <span className="text-[13px]">{COUNTRY_CODES.find(c => c.code === formData.countryCode)?.flag || '🌍'}</span>
                                            <ChevronDown size={12} className="text-slate-400" />
                                        </button>

                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            name="phone"
                                            ref={phoneInputRef}
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="0624790960"
                                            className="flex-1 bg-transparent py-1 px-2 text-[13px] font-semibold text-slate-800 outline-none w-full min-w-0"
                                        />

                                        {showCountryDropdown && (
                                            <div className="absolute top-[calc(100%+4px)] left-0 w-[180px] bg-white rounded-md shadow-lg border border-slate-100 py-1 z-50 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                {COUNTRY_CODES.map((country) => (
                                                    <button
                                                        key={country.country}
                                                        type="button"
                                                        className={cn("w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors", formData.countryCode === country.code ? "bg-slate-50 text-[#4A8AF4]" : "text-slate-600")}
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, countryCode: country.code }));
                                                            setShowCountryDropdown(false);
                                                        }}
                                                    >
                                                        <span className="text-[13px] w-5 text-center">{country.flag}</span>
                                                        <span className="text-[12px] font-medium w-10 text-left">{country.code}</span>
                                                        <span className="text-[12px] font-medium truncate">{country.country}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {errors.phone && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.phone}</p>}
                                </div>

                                {/* Email Address */}
                                <div className="space-y-1 w-full">
                                    <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Email address"
                                        className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.email ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                    />
                                    {errors.email && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.email}</p>}
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-1 w-full">
                                <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                    Address
                                </label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Full Address"
                                    rows={2}
                                    className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all resize-none", errors.address ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                ></textarea>
                                {errors.address && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.address}</p>}
                            </div>

                            {/* Switches Segment */}
                            <div className="flex items-center gap-6">
                                <label 
                                    className="flex items-center gap-2 cursor-pointer group outline-none"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleTaxToggle(formData.taxStatus !== 'taxable');
                                        }
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.taxStatus === 'taxable'}
                                        onChange={(e) => handleTaxToggle(e.target.checked)}
                                        className="hidden"
                                    />
                                    <div className={cn(
                                        "w-[30px] h-[16px] rounded-full flex items-center transition-colors px-[2px] shadow-inner group-focus-visible:ring-2 group-focus-visible:ring-[#4A8AF4] group-focus-visible:ring-offset-1 outline-none",
                                        formData.taxStatus === 'taxable' ? "bg-[#4A8AF4]" : "bg-slate-200"
                                    )}>
                                        <div className={cn(
                                            "w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform",
                                            formData.taxStatus === 'taxable' ? "translate-x-[14px]" : "translate-x-0"
                                        )}></div>
                                    </div>
                                    <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-800 select-none">GST Registered</span>
                                </label>

                                <label 
                                    className="flex items-center gap-2 cursor-pointer group outline-none"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleChange({ target: { name: 'isActive', type: 'checkbox', checked: !formData.isActive } });
                                        }
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleChange}
                                        className="hidden"
                                    />
                                    <div className={cn(
                                        "w-[30px] h-[16px] rounded-full flex items-center transition-colors px-[2px] shadow-inner group-focus-visible:ring-2 group-focus-visible:ring-[#4A8AF4] group-focus-visible:ring-offset-1 outline-none",
                                        formData.isActive ? "bg-[#4A8AF4]" : "bg-slate-200"
                                    )}>
                                        <div className={cn(
                                            "w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform",
                                            formData.isActive ? "translate-x-[14px]" : "translate-x-0"
                                        )}></div>
                                    </div>
                                    <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-800 select-none">Active</span>
                                </label>
                            </div>

                            {/* GST Info */}
                            {formData.taxStatus === 'taxable' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1 w-full">
                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                            GST No. <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="gstNo"
                                            value={formData.gstNo}
                                            onChange={handleChange}
                                            placeholder="GST Number"
                                            className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all uppercase", errors.gstNo ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                        />
                                        {errors.gstNo && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstNo}</p>}
                                    </div>

                                    <div className="space-y-1 w-full">
                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                            GST Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="gstName"
                                            value={formData.gstName}
                                            onChange={handleChange}
                                            placeholder="Registered Name"
                                            className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.gstName ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                        />
                                        {errors.gstName && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstName}</p>}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-[#4A8AF4] text-white rounded-md text-[13px] font-bold hover:bg-[#3b78df] shadow-sm shadow-[#4A8AF4]/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saving</span>
                                </>
                            ) : (
                                <span>{isEditing ? 'Update Party' : 'Create Party'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePartyDrawer;
