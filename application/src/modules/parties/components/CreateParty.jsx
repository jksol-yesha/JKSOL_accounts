import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Link as LinkIcon, ChevronDown, Check } from 'lucide-react';

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
import PageHeader from '../../../components/layout/PageHeader';
import { useToast } from '../../../context/ToastContext';
import apiService from '../../../services/api';
import { cn } from '../../../utils/cn';

const PARTIES_CREATE_SCROLL_MODE_EVENT = 'parties-create-scroll-mode';

const CreateParty = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    // Check if we're editing an existing party  (must come FIRST — used in useState initializers below)
    const editingParty = location.state?.party;
    const isEditing = !!editingParty;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const fieldRefs = useRef({});
    const [needsWholePageScroll, setNeedsWholePageScroll] = useState(false);
    const pageHeaderRef = useRef(null);
    const shellRef = useRef(null);
    const cardRef = useRef(null);
    const mainStyleSnapshotRef = useRef(null);

    const setFieldRef = (name) => (el) => {
        if (el) fieldRefs.current[name] = el;
    };

    const getNavigationRows = () => {
        const rows = [];
        rows.push(['companyName']);
        rows.push(['name']);
        rows.push(['phone']);
        rows.push(['email']);
        rows.push(['address']);
        rows.push(['taxStatus']);
        if (formData.taxStatus === 'taxable') {
            rows.push(['gstNo', 'gstName']);
        }
        rows.push(['isActive']);
        return rows;
    };

    const focusField = (fieldName) => {
        if (!fieldName) return false;
        const el = fieldRefs.current[fieldName];
        if (!el || el.disabled) return false;
        el.focus();
        return true;
    };

    const focusNextLinear = (flatFields, startIndex, step) => {
        let i = startIndex + step;
        while (i >= 0 && i < flatFields.length) {
            if (focusField(flatFields[i])) return true;
            i += step;
        }
        return false;
    };

    const handleFieldKeyDown = (e, fieldName) => {
        const rows = getNavigationRows();
        const flatFields = rows.flat();
        const currentFlatIndex = flatFields.indexOf(fieldName);
        if (currentFlatIndex === -1) return;

        const rowIndex = rows.findIndex((r) => r.includes(fieldName));
        const colIndex = rowIndex >= 0 ? rows[rowIndex].indexOf(fieldName) : -1;

        if (e.key === 'Enter') {
            e.preventDefault();
            const moved = focusNextLinear(flatFields, currentFlatIndex, 1);
            if (!moved) {
                e.currentTarget.form?.requestSubmit();
            }
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const target = rows[rowIndex]?.[colIndex + 1];
            if (!focusField(target)) {
                focusNextLinear(flatFields, currentFlatIndex, 1);
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const target = rows[rowIndex]?.[colIndex - 1];
            if (!focusField(target)) {
                focusNextLinear(flatFields, currentFlatIndex, -1);
            }
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            let targetRow = rowIndex + step;

            while (targetRow >= 0 && targetRow < rows.length) {
                const target = rows[targetRow][Math.min(colIndex, rows[targetRow].length - 1)];
                if (focusField(target)) return;
                targetRow += step;
            }

            focusNextLinear(flatFields, currentFlatIndex, step);
        }
    };

    const appendPhoneDigit = (digit) => {
        const currentPhone = fieldRefs.current.phone?.value || formData.phone || '';
        const nextPhone = `${currentPhone}${digit}`;

        setFormData(prev => ({ ...prev, phone: nextPhone }));
        setErrors(prev => {
            const nextErrors = { ...prev };
            const fieldError = validateField('phone', nextPhone);
            if (fieldError) nextErrors.phone = fieldError;
            else delete nextErrors.phone;
            return nextErrors;
        });

        setTimeout(() => {
            const input = fieldRefs.current.phone;
            if (input && typeof input.focus === 'function') {
                input.focus({ preventScroll: true });
                if (typeof input.setSelectionRange === 'function') {
                    input.setSelectionRange(nextPhone.length, nextPhone.length);
                }
            }
        }, 0);
    };

    const handleCountryCodeKeyDown = (e) => {
        if (/^\d$/.test(e.key)) {
            e.preventDefault();
            appendPhoneDigit(e.key);
            return;
        }

        handleFieldKeyDown(e, 'countryCode');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCountryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let frameId = null;
        const main = document.querySelector('main');
        const pageHeader = pageHeaderRef.current;
        const shell = shellRef.current;
        const card = cardRef.current;
        if (!main || !pageHeader || !shell || !card) return undefined;

        const scheduleMeasurement = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                const requiredHeight = pageHeader.getBoundingClientRect().height + shell.scrollHeight;
                const availableHeight = main.clientHeight;
                const shouldUseWholePageScroll = requiredHeight > availableHeight + 1;

                setNeedsWholePageScroll((current) => (
                    current === shouldUseWholePageScroll ? current : shouldUseWholePageScroll
                ));

                window.dispatchEvent(new CustomEvent(PARTIES_CREATE_SCROLL_MODE_EVENT, {
                    detail: { shouldUseWholePageScroll }
                }));
            });
        };

        scheduleMeasurement();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => scheduleMeasurement())
            : null;

        resizeObserver?.observe(main);
        resizeObserver?.observe(pageHeader);
        resizeObserver?.observe(shell);
        resizeObserver?.observe(card);

        window.addEventListener('resize', scheduleMeasurement);

        return () => {
            window.removeEventListener('resize', scheduleMeasurement);
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            resizeObserver?.disconnect();
            window.dispatchEvent(new CustomEvent(PARTIES_CREATE_SCROLL_MODE_EVENT, {
                detail: { shouldUseWholePageScroll: false }
            }));
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const main = document.querySelector('main');
        if (!main) return undefined;

        if (!mainStyleSnapshotRef.current) {
            mainStyleSnapshotRef.current = {
                overflow: main.style.overflow,
                overflowX: main.style.overflowX,
                overflowY: main.style.overflowY,
                overscrollBehavior: main.style.overscrollBehavior,
            };
        }

        const previousStyles = mainStyleSnapshotRef.current;

        const syncScrollLock = () => {
            const shouldLockScroll = window.innerWidth >= 1280 && !needsWholePageScroll;

            if (shouldLockScroll) {
                main.style.overflow = 'hidden';
                main.style.overflowX = 'hidden';
                main.style.overflowY = 'hidden';
                main.style.overscrollBehavior = 'none';
                return;
            }

            main.style.overflow = previousStyles.overflow;
            main.style.overflowX = previousStyles.overflowX;
            main.style.overflowY = previousStyles.overflowY;
            main.style.overscrollBehavior = previousStyles.overscrollBehavior;
        };

        syncScrollLock();
        window.addEventListener('resize', syncScrollLock);

        return () => {
            window.removeEventListener('resize', syncScrollLock);
            main.style.overflow = previousStyles.overflow;
            main.style.overflowX = previousStyles.overflowX;
            main.style.overflowY = previousStyles.overflowY;
            main.style.overscrollBehavior = previousStyles.overscrollBehavior;
        };
    }, [needsWholePageScroll]);

    const [formData, setFormData] = useState(() => {
        if (editingParty) {
            const phoneMatch = (editingParty.phone || '').match(/^(\+\d{1,4})\s*(.*)$/);
            const code = phoneMatch ? phoneMatch[1] : '+91';
            const number = phoneMatch ? phoneMatch[2] : (editingParty.phone || '');
            return {
                id: editingParty.id,
                companyName: editingParty.companyName || '',
                name: editingParty.name || '',
                email: editingParty.email || '',
                countryCode: code,
                phone: number,
                address: editingParty.address || '',
                taxStatus: (editingParty.gstNo || editingParty.gstName) ? 'taxable' : 'non-taxable',
                gstNo: editingParty.gstNo || '',
                gstName: editingParty.gstName || '',
                isActive: editingParty.isActive !== undefined ? editingParty.isActive : true,
            };
        }
        return {
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
        };
    });

    const validateField = (name, value) => {
        let error = null;
        switch (name) {
            case 'companyName':
                if (!value.trim()) error = 'Company Name is compulsory.';
                break;
            case 'name':
                // Optional
                break;
            case 'email':
                if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format.';
                break;
            case 'phone':
                if (value.trim()) {
                    const digits = value.replace(/\D/g, '');
                    if (digits.length < 7 || digits.length > 15) error = 'Phone No. must be between 7 and 15 digits.';
                }
                break;
            case 'gstNo':
                if (formData.taxStatus !== 'taxable') break;
                if (!value.trim()) {
                    error = 'GST No. is compulsory.';
                } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
                    error = 'Invalid format (e.g., 22AAAAA0000A1Z5)';
                }
                break;
            case 'gstName':
                if (formData.taxStatus !== 'taxable') break;
                if (!value.trim()) error = 'GST Name is compulsory.';
                else if (value.trim().length < 3) error = 'GST Name must be at least 3 characters.';
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

        // Clear error when user types
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
            showToast?.('Please fix the errors in the form before submitting.', 'error');
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

            if (isEditing) {
                await apiService.parties.update(editingParty.id, basePayload);
                showToast?.('Party updated successfully', 'success');
            } else {
                await apiService.parties.create(basePayload);
                showToast?.('Party created successfully', 'success');
            }

            navigate('/parties');
        } catch (error) {
            console.error('Failed to save party:', error);
            const msg = error.response?.data?.message || error.message || 'An unexpected error occurred.';
            showToast?.(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className={cn(
            "parties-create-page flex flex-col min-h-full bg-white",
            needsWholePageScroll && "parties-create-page-scroll"
        )}>
            <div ref={pageHeaderRef}>
                <PageHeader
                    title={isEditing ? "Edit Party" : "New Party"}
                    breadcrumbs={[
                        { label: 'Parties', path: '/parties' },
                        { label: isEditing ? "Edit" : "New", active: true }
                    ]}
                />
            </div>

            <div
                ref={shellRef}
                className={cn(
                    "parties-create-shell p-4 lg:p-8 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500",
                    needsWholePageScroll && "parties-create-shell-scroll"
                )}
            >
                <form onSubmit={handleSubmit} className="parties-create-form">
                    <div ref={cardRef} className="parties-create-card bg-white rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100 p-6 md:p-10 space-y-4">
                        {/* Header inside the box */}
                        <div className="parties-create-card-header flex items-center gap-3 mb-1">
                            <button
                                type="button"
                                onClick={() => navigate('/parties')}
                                className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-900 transition-all"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h2 className="text-lg font-bold text-gray-900">{isEditing ? "Edit Party" : "New Party"}</h2>
                        </div>


                        {/* Company Name */}
                        <div className="parties-create-field space-y-1">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                Company Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="companyName"
                                ref={setFieldRef('companyName')}
                                value={formData.companyName}
                                onChange={handleChange}
                                onKeyDown={(e) => handleFieldKeyDown(e, 'companyName')}
                                placeholder="Company Name"
                                className={`w-full px-4 py-2 bg-gray-50 border ${errors.companyName ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                autoFocus
                            />
                            {errors.companyName && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.companyName}</p>}
                        </div>

                        {/* Contact Name */}
                        <div className="parties-create-field space-y-1">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                Contact Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                ref={setFieldRef('name')}
                                value={formData.name}
                                onChange={handleChange}
                                onKeyDown={(e) => handleFieldKeyDown(e, 'name')}
                                placeholder="Contact Name"
                                className={`w-full px-4 py-2 bg-gray-50 border ${errors.name ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                            />
                            {errors.name && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.name}</p>}
                        </div>

                        <div className="parties-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4">

                            {/* Phone */}
                            <div className="parties-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Phone No.
                                </label>
                                <div className={`parties-create-phone-wrap relative flex items-stretch bg-gray-50 border ${errors.phone ? 'border-rose-500' : 'border-gray-50 focus-within:border-black'} rounded-xl transition-all h-[40px]`} ref={dropdownRef}>
                                    <div className="flex-shrink-0">
                                        <button
                                            type="button"
                                            ref={setFieldRef('countryCode')}
                                            className="h-full px-4 flex items-center justify-center gap-2 focus:outline-none hover:bg-gray-100 rounded-l-xl transition-colors"
                                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                            onKeyDown={handleCountryCodeKeyDown}
                                        >
                                            <span className="text-base leading-none">{COUNTRY_CODES.find(c => c.code === formData.countryCode)?.flag || '🌍'}</span>
                                            <ChevronDown size={14} className="text-gray-600" />
                                            <span className="text-[13px] font-extrabold text-gray-900 ml-1">{formData.countryCode}</span>
                                        </button>
                                    </div>

                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        name="phone"
                                        ref={setFieldRef('phone')}
                                        value={formData.phone}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'phone')}
                                        placeholder="0624790960"
                                        className="flex-1 bg-transparent py-2 px-2 text-[14px] font-bold text-slate-700 outline-none w-full"
                                    />

                                    {showCountryDropdown && (
                                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {COUNTRY_CODES.map((country) => (
                                                <button
                                                    key={country.country}
                                                    type="button"
                                                    className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 transition-colors ${formData.countryCode === country.code ? 'bg-blue-50/80 text-blue-600' : 'text-gray-600'}`}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, countryCode: country.code }));
                                                        setShowCountryDropdown(false);
                                                    }}
                                                >
                                                    <span className="text-base leading-none w-6 text-center">{country.flag}</span>
                                                    <span className="text-[13px] font-medium w-12 text-left">{country.code}</span>
                                                    <span className="text-[13px] font-medium">{country.country}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {errors.phone && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.phone}</p>}
                            </div>

                            {/* Email */}
                            <div className="parties-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    ref={setFieldRef('email')}
                                    value={formData.email}
                                    onChange={handleChange}
                                    onKeyDown={(e) => handleFieldKeyDown(e, 'email')}
                                    placeholder="Email address"
                                    className={`w-full px-4 py-2 bg-gray-50 border ${errors.email ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                />
                                {errors.email && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.email}</p>}
                            </div>

                        </div>

                        {/* Address */}
                        <div className="parties-create-field space-y-1">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                Address
                            </label>
                            <textarea
                                name="address"
                                ref={setFieldRef('address')}
                                value={formData.address}
                                onChange={handleChange}
                                onKeyDown={(e) => handleFieldKeyDown(e, 'address')}
                                placeholder="Full Address"
                                rows={3}
                                className={`w-full px-4 py-2 bg-gray-50 border ${errors.address ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all resize-none`}
                            ></textarea>
                            {errors.address && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.address}</p>}
                        </div>

                        {/* Taxable / Party Status Row (Non-taxable) */}
                        <div className="parties-create-toggle-row flex items-center justify-between pt-2 pb-1">
                            <div className="flex items-center justify-start gap-2">
                                <h3 className="text-xs font-bold text-gray-900">GST No</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        ref={setFieldRef('taxStatus')}
                                        checked={formData.taxStatus === 'taxable'}
                                        onChange={(e) => handleTaxToggle(e.target.checked)}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'taxStatus')}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4A8AF4]"></div>
                                </label>
                            </div>

                            {formData.taxStatus !== 'taxable' && (
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold text-gray-900">Party Status</h3>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            ref={setFieldRef('isActive')}
                                            checked={formData.isActive}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleFieldKeyDown(e, 'isActive')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4A8AF4]"></div>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* GST Info */}
                        {formData.taxStatus === 'taxable' && (
                            <div className="parties-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4 -mt-2 mb-5">
                                <div className="parties-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        GST No. <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="gstNo"
                                        ref={setFieldRef('gstNo')}
                                        value={formData.gstNo}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'gstNo')}
                                        placeholder="GST Identification Number"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.gstNo ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all uppercase`}
                                    />
                                    {errors.gstNo && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstNo}</p>}
                                </div>

                                <div className="parties-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        GST Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="gstName"
                                        ref={setFieldRef('gstName')}
                                        value={formData.gstName}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'gstName')}
                                        placeholder="Name registered with GST"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.gstName ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                    />
                                    {errors.gstName && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstName}</p>}
                                </div>
                            </div>
                        )}

                        {/* Party Status Row (Taxable) */}
                        {formData.taxStatus === 'taxable' && (
                            <div className="parties-create-toggle-row flex items-center justify-start">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold text-gray-900">Party Status</h3>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="isActive"
                                            ref={setFieldRef('isActive')}
                                            checked={formData.isActive}
                                            onChange={handleChange}
                                            onKeyDown={(e) => handleFieldKeyDown(e, 'isActive')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4A8AF4]"></div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="parties-create-actions pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/parties')}
                                className="px-6 py-2 rounded-xl text-[12px] font-extrabold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-2.5 bg-black text-white text-[12px] font-extrabold rounded-xl shadow-lg active:scale-95 flex items-center gap-2 hover:bg-gray-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>{isEditing ? 'Update Party' : 'Save Party'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form >
            </div >
        </div >
    );
};

export default CreateParty;
