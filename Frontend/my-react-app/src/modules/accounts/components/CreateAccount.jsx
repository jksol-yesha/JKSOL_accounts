import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Check, ChevronDown } from 'lucide-react';
import PageHeader from '../../../components/layout/PageHeader';
import CustomSelect from '../../../components/common/CustomSelect';
import apiService from '../../../services/api';
import { useOrganization } from '../../../context/OrganizationContext';
import { useBranch } from '../../../context/BranchContext';
import {
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_SUBTYPE_LABELS,
    ACCOUNT_TYPES,
    ACCOUNT_SUBTYPES,
    SUBTYPE_GROUPS
} from '../constants';

const formatDateForInput = (value) => {
    if (!value) return new Date().toISOString().split('T')[0];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
    return parsed.toISOString().split('T')[0];
};

const shouldUseBankFields = (data) => (
    Number(data.accountType) === ACCOUNT_TYPES.ASSET &&
    Number(data.subtype) === ACCOUNT_SUBTYPES.BANK
);

const CURRENCY_OPTIONS = [
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'AED', label: 'AED - UAE Dirham' },
];

const IFSC_BANK_REGISTRY = {
    HDFC: { bankName: 'HDFC Bank', bankLogoKey: 'hdfc' },
    ICIC: { bankName: 'ICICI Bank', bankLogoKey: 'icici' },
    UTIB: { bankName: 'Axis Bank', bankLogoKey: 'axis' },
    BARB: { bankName: 'Bank of Baroda', bankLogoKey: 'bob' },
    SBIN: { bankName: 'State Bank of India', bankLogoKey: null },
    PUNB: { bankName: 'Punjab National Bank', bankLogoKey: null },
    KKBK: { bankName: 'Kotak Mahindra Bank', bankLogoKey: null },
    YESB: { bankName: 'Yes Bank', bankLogoKey: null },
    IDIB: { bankName: 'Indian Bank', bankLogoKey: null },
    IDFB: { bankName: 'IDFC First Bank', bankLogoKey: null },
    CNRB: { bankName: 'Canara Bank', bankLogoKey: null },
    UBIN: { bankName: 'Union Bank of India', bankLogoKey: null },
    IOBA: { bankName: 'Indian Overseas Bank', bankLogoKey: null },
    BKID: { bankName: 'Bank of India', bankLogoKey: null },
    MAHB: { bankName: 'Bank of Maharashtra', bankLogoKey: null },
    PSIB: { bankName: 'Punjab & Sind Bank', bankLogoKey: null },
    INDB: { bankName: 'IndusInd Bank', bankLogoKey: null },
    CSBK: { bankName: 'CSB Bank', bankLogoKey: null },
    KVBL: { bankName: 'Karur Vysya Bank', bankLogoKey: null },
    FDRL: { bankName: 'Federal Bank', bankLogoKey: null },
    SIBL: { bankName: 'South Indian Bank', bankLogoKey: null },
    TMBL: { bankName: 'Tamilnad Mercantile Bank', bankLogoKey: null },
    RATN: { bankName: 'RBL Bank', bankLogoKey: null },
    DBSS: { bankName: 'DBS Bank India', bankLogoKey: null },
    FINO: { bankName: 'Fino Payments Bank', bankLogoKey: null },
    IPOS: { bankName: 'India Post Payments Bank', bankLogoKey: null },
    AUBL: { bankName: 'AU Small Finance Bank', bankLogoKey: null },
    ESFB: { bankName: 'Equitas Small Finance Bank', bankLogoKey: null },
    SVCB: { bankName: 'SVC Co-operative Bank', bankLogoKey: null },
    NKGS: { bankName: 'NKGSB Co-operative Bank', bankLogoKey: null },
};

const resolveBankFromIfsc = (ifsc = '') => {
    const normalized = String(ifsc || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) return null;
    const bankCode = normalized.slice(0, 4);
    return {
        bankCode,
        ...(IFSC_BANK_REGISTRY[bankCode] || { bankName: bankCode, bankLogoKey: null })
    };
};

const clearAccountRelatedCaches = () => {
    if (typeof window === 'undefined') return;

    const cachePrefixes = [
        'dashboard:rankings:',
        'dashboard:stats:',
        'accounts:'
    ];

    Object.keys(window.sessionStorage).forEach((key) => {
        if (cachePrefixes.some((prefix) => key.startsWith(prefix))) {
            window.sessionStorage.removeItem(key);
        }
    });
};

const getInitialFormData = (account) => {
    if (!account) {
        return {
            name: '',
            accountType: ACCOUNT_TYPES.ASSET.toString(),
            subtype: '',
            currencyCode: 'INR',
            accountNumber: '',
            ifsc: '',
            swiftCode: '',
            bankBranchName: '',
            openingBalance: '0.00',
            openingBalanceDate: new Date().toISOString().split('T')[0],
            description: '',
            isActive: true
        };
    }

    return {
        name: account.name || '',
        accountType: (account.accountType ?? account.type ?? ACCOUNT_TYPES.ASSET)?.toString() || ACCOUNT_TYPES.ASSET.toString(),
        subtype: (account.subtype ?? account.subType ?? '')?.toString() || '',
        currencyCode: account.currencyCode || account.baseCurrency || 'INR',
        accountNumber: account.accountNumber || account.account_number || '',
        ifsc: account.ifsc || '',
        swiftCode: account.swiftCode || account.zipCode || account.zip_code || '',
        bankBranchName: account.bankBranchName || account.bank_branch_name || account.branchName || '',
        openingBalance: account.openingBalance ?? '0.00',
        openingBalanceDate: formatDateForInput(account.openingBalanceDate),
        description: account.description || '',
        isActive: account.isActive !== undefined ? account.isActive : (account.status === 1)
    };
};

const CreateAccount = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedOrg } = useOrganization();
    const { selectedBranch, branches } = useBranch();
    const [showSuccess, setShowSuccess] = useState(false);
    const [errors, setErrors] = useState({});


    // Edit Mode
    const editingAccount = location.state?.account;
    const siblingAccounts = location.state?.siblingAccounts || []; // other branches with same account name
    const isEditMode = !!editingAccount;

    const [formData, setFormData] = useState(() => getInitialFormData(editingAccount));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const main = document.querySelector('main');
        if (!main) return undefined;

        const previousStyles = {
            overflow: main.style.overflow,
            overflowX: main.style.overflowX,
            overflowY: main.style.overflowY,
            overscrollBehavior: main.style.overscrollBehavior,
        };

        const syncScrollLock = () => {
            const shouldLockScroll = window.innerWidth >= 1024;

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
    }, []);

    // Filtered Subtypes based on selected Type
    const filteredSubtypes = useMemo(() => {
        const typeId = parseInt(formData.accountType);
        const subtypeIds = SUBTYPE_GROUPS[typeId] || [];
        return subtypeIds.map(id => ({ id: id.toString(), label: ACCOUNT_SUBTYPE_LABELS[id] }));
    }, [formData.accountType]);

    const isAssetBank = shouldUseBankFields(formData);
    const detectedBank = useMemo(() => resolveBankFromIfsc(formData.ifsc), [formData.ifsc]);
    const fieldRefs = useRef({});

    const setFieldRef = (name, variant = 'default') => (el) => {
        if (!el) return;
        if (!fieldRefs.current[name] || typeof fieldRefs.current[name]?.focus !== 'function') {
            fieldRefs.current[name] = {};
        }
        fieldRefs.current[name][variant] = el;
    };

    const getNavigationRows = () => {
        const rows = [];
        rows.push(
            ['name', 'currencyCode'],
            ['accountType', 'subtype']
        );
        if (isAssetBank) {
            rows.push(['accountNumber', 'ifsc']);
            rows.push(['swiftCode', 'bankBranchName']);
        }
        rows.push(['openingBalance', 'openingBalanceDate']);
        rows.push(['description']);
        rows.push(['isActive']);
        return rows;
    };

    const focusField = (fieldName) => {
        if (!fieldName) return false;
        const refEntry = fieldRefs.current[fieldName];
        const candidates = refEntry && typeof refEntry.focus === 'function'
            ? [refEntry]
            : [refEntry?.custom, refEntry?.native, refEntry?.default];

        const el = candidates.find((node) => {
            if (!node || node.disabled) return false;
            // Prefer visible/focusable element so hidden native/custom variants don't break nav.
            return node.offsetParent !== null || node.getClientRects?.().length > 0;
        });

        if (!el) return false;
        if (typeof el.focus === 'function') el.focus();
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

        const rowIndex = rows.findIndex(r => r.includes(fieldName));
        const colIndex = rowIndex >= 0 ? rows[rowIndex].indexOf(fieldName) : -1;

        if (e.key === 'Enter') {
            e.preventDefault();
            const moved = focusNextLinear(flatFields, currentFlatIndex, 1);
            if (!moved) {
                // If there is no next focusable field, submit the form.
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

    const validateField = (name, value, currentFormData = formData) => {
        let error = '';
        switch (name) {
            case 'name':
                if (!value.trim()) error = 'Required';
                break;
            case 'accountType':
                if (!value) error = 'Required';
                break;
            case 'subtype':
                // Optional
                break;
            case 'accountNumber':
                if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !String(value || '').trim()
                ) error = 'Required for Bank accounts';
                else if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !/^\d{6,20}$/.test(String(value || '').trim())
                ) error = 'Account No must be 6-20 digits';
                break;
            case 'ifsc':
                if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !String(value || '').trim()
                ) error = 'Required for Bank accounts';
                else if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value || '').trim().toUpperCase())
                ) error = 'Invalid IFSC format (e.g. HDFC0001234)';
                break;
            case 'swiftCode':
                if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !String(value || '').trim()
                ) error = 'Required for Bank accounts';
                else if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !/^[A-Z0-9]{8,11}$/.test(String(value || '').trim().toUpperCase())
                ) error = 'SWIFT Code must be 8-11 letters/numbers';
                break;
            case 'bankBranchName':
                if (
                    Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
                    Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
                    !String(value || '').trim()
                ) error = 'Required for Bank accounts';
                break;
            case 'openingBalance':
                if (value === '' || value === null) error = 'Required';
                else if (!/^\d+(\.\d{0,2})?$/.test(String(value).trim())) error = 'Enter valid amount (up to 2 decimals)';
                break;
            case 'openingBalanceDate':
                if (!value) error = 'Required';
                break;
        }
        return error;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;
        if (name === 'ifsc' && typeof newValue === 'string') {
            newValue = newValue.toUpperCase();
        }
        if (name === 'swiftCode' && typeof newValue === 'string') {
            newValue = newValue.toUpperCase();
        }
        if (name === 'openingBalance' && typeof newValue === 'string') {
            // Keep decimal input stable and prevent auto mutations from number-style parsing.
            let sanitized = newValue.replace(/,/g, '').replace(/[^\d.]/g, '');
            const firstDot = sanitized.indexOf('.');
            if (firstDot !== -1) {
                sanitized = `${sanitized.slice(0, firstDot + 1)}${sanitized.slice(firstDot + 1).replace(/\./g, '')}`;
            }
            newValue = sanitized;
        }

        let updatedData = { ...formData, [name]: newValue };

        if (name === 'accountType') {
            updatedData.subtype = '';
        }

        if (!shouldUseBankFields(updatedData)) {
            updatedData.accountNumber = '';
            updatedData.ifsc = '';
            updatedData.swiftCode = '';
            updatedData.bankBranchName = '';
        }

        setFormData(updatedData);

        const error = validateField(name, newValue, updatedData);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};
        const keysToValidate = isAssetBank
            ? Object.keys(formData)
            : Object.keys(formData).filter(k => !['accountNumber', 'ifsc', 'swiftCode', 'bankBranchName'].includes(k));
        keysToValidate.forEach(key => {
            const err = validateField(key, formData[key]);
            if (err) newErrors[key] = err;
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            // Build base payload — openingBalance MUST be a string to satisfy backend schema
            const p = {
                ...formData,
                accountType: parseInt(formData.accountType),
                subtype: (formData.subtype && formData.subtype !== '0') ? parseInt(formData.subtype) : null,
                parentAccountId: null,
                openingBalance: String(formData.openingBalance ?? '0'),
            };

            if (isAssetBank) {
                p.accountNumber = formData.accountNumber || '';
                p.ifsc = formData.ifsc || '';
                p.zipCode = formData.swiftCode || '';
                p.bankBranchName = formData.bankBranchName || '';
            }

            if (isEditMode) {
                await apiService.accounts.update(editingAccount.id, p);
            } else {
                await apiService.accounts.create(p, { orgId: selectedOrg?.id });
            }

            clearAccountRelatedCaches();

            // console.log("🚀 Account processed globally");

            setShowSuccess(true);
            setTimeout(() => {
                navigate('/accounts');
            }, 1500);
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save: " + (error.response?.data?.message || error.message));
        }

    };

    return (
        <div className="accounts-create-page flex flex-col min-h-screen bg-gray-50/50">
            <PageHeader
                title={isEditMode ? "Edit Account" : "Create Account"}
                breadcrumbs={[
                    { label: 'Accounts', path: '/accounts' },
                    { label: isEditMode ? 'Edit' : 'New', active: true }
                ]}
            />

            <div className="accounts-create-shell p-4 lg:p-8 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleSubmit} className="accounts-create-form">
                    <div className="accounts-create-card bg-white rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100 p-6 md:p-10 space-y-4">
                        {/* Header inside the box */}
                        <div className="accounts-create-card-header flex items-center gap-3 mb-1">
                            <button
                                type="button"
                                onClick={() => navigate('/accounts')}
                                className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-900 transition-all"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h2 className="text-lg font-bold text-gray-900">{isEditMode ? "Edit Account" : "New Account"}</h2>
                        </div>

                        <div className="accounts-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 1. Account Name */}
                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Account Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    ref={setFieldRef('name')}
                                    value={formData.name}
                                    onChange={handleChange}
                                    onKeyDown={(e) => handleFieldKeyDown(e, 'name')}
                                    placeholder="Enter account name"
                                    className={`w-full px-4 py-2 bg-gray-50 border ${errors.name ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                    autoFocus
                                />
                                {errors.name && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.name}</p>}
                            </div>

                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Base Currency
                                </label>
                                <div className="relative">
                                    <CustomSelect
                                        name="currencyCode"
                                        ref={setFieldRef('currencyCode', 'default')}
                                        value={formData.currencyCode}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'currencyCode')}
                                        className="accounts-create-select w-full px-4 py-2 bg-gray-50 border border-gray-50 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        {CURRENCY_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </CustomSelect>
                                </div>
                            </div>
                        </div>

                        <div className="accounts-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 2. Type */}
                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Account Type <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <CustomSelect
                                        name="accountType"
                                        ref={setFieldRef('accountType', 'default')}
                                        value={formData.accountType}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'accountType')}
                                        className={cn(
                                            "accounts-create-select w-full px-4 py-2 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all",
                                            errors.accountType ? 'border-rose-500' : 'border-gray-50 focus:border-black'
                                        )}
                                    >
                                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([id, label]) => (
                                            <option key={id} value={id}>{label}</option>
                                        ))}
                                    </CustomSelect>
                                </div>
                                {errors.accountType && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.accountType}</p>}
                            </div>

                            {/* 3. Subtype */}
                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Subtype <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <CustomSelect
                                        name="subtype"
                                        ref={setFieldRef('subtype', 'default')}
                                        value={formData.subtype}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'subtype')}
                                        disabled={!formData.accountType}
                                        className={cn(
                                            "accounts-create-select w-full px-4 py-2 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all disabled:opacity-50 disabled:bg-gray-100",
                                            errors.subtype ? 'border-rose-500' : 'border-gray-50 focus:border-black'
                                        )}
                                    >
                                        <option value="">Select Subtype</option>
                                        {filteredSubtypes.map(st => (
                                            <option key={st.id} value={st.id}>{st.label}</option>
                                        ))}
                                    </CustomSelect>
                                </div>
                                {errors.subtype && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.subtype}</p>}
                            </div>
                        </div>

                        {isAssetBank && (
                            <div className="accounts-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="accounts-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        Account Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="accountNumber"
                                        ref={setFieldRef('accountNumber')}
                                        value={formData.accountNumber}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'accountNumber')}
                                        placeholder="Enter account number"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.accountNumber ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                    />
                                    {errors.accountNumber && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.accountNumber}</p>}
                                </div>

                                <div className="accounts-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        IFSC Code <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="ifsc"
                                        ref={setFieldRef('ifsc')}
                                        value={formData.ifsc}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'ifsc')}
                                        placeholder="Enter IFSC code"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.ifsc ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                    />
                                    {errors.ifsc && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.ifsc}</p>}
                                </div>

                                <div className="accounts-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        Swift Code <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="swiftCode"
                                        ref={setFieldRef('swiftCode')}
                                        value={formData.swiftCode}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'swiftCode')}
                                        placeholder="Enter SWIFT code"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.swiftCode ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all uppercase`}
                                    />
                                    {errors.swiftCode && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.swiftCode}</p>}
                                </div>

                                <div className="accounts-create-field space-y-1">
                                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        Branch Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="bankBranchName"
                                        ref={setFieldRef('bankBranchName')}
                                        value={formData.bankBranchName}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'bankBranchName')}
                                        placeholder="Enter branch name"
                                        className={`w-full px-4 py-2 bg-gray-50 border ${errors.bankBranchName ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all`}
                                    />
                                    {errors.bankBranchName && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.bankBranchName}</p>}
                                </div>
                            </div>
                        )}

                        <div className="accounts-create-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 6. Opening Balance */}
                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    Opening Balance <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="accounts-create-balance-prefix absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[13px]">{formData.currencyCode}</span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="openingBalance"
                                        ref={setFieldRef('openingBalance')}
                                        value={formData.openingBalance}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleFieldKeyDown(e, 'openingBalance')}
                                        placeholder="0.00"
                                        className={`w-full pl-12 pr-4 py-2 bg-gray-50 border ${errors.openingBalance ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-emerald-600 outline-none transition-all`}
                                    />
                                </div>
                                {errors.openingBalance && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.openingBalance}</p>}
                            </div>

                            {/* 7. Opening Balance Date */}
                            <div className="accounts-create-field space-y-1">
                                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                    As of Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="openingBalanceDate"
                                    ref={setFieldRef('openingBalanceDate')}
                                    value={formData.openingBalanceDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={handleChange}
                                    onKeyDown={(e) => handleFieldKeyDown(e, 'openingBalanceDate')}
                                    className={`w-full px-4 py-2 bg-gray-50 border ${errors.openingBalanceDate ? 'border-rose-500' : 'border-gray-50 focus:border-black'} rounded-xl text-[14px] font-bold text-slate-700 outline-none transition-all accounts-laptop-date-input`}
                                />
                                {errors.openingBalanceDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.openingBalanceDate}</p>}
                            </div>
                        </div>

                        {/* 8. Description */}
                        <div className="accounts-create-field space-y-1">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                Description / Notes
                            </label>
                            <textarea
                                name="description"
                                ref={setFieldRef('description')}
                                value={formData.description}
                                onChange={handleChange}
                                onKeyDown={(e) => handleFieldKeyDown(e, 'description')}
                                rows={1}
                                placeholder="Enter account details..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-50 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all resize-none"
                            />
                        </div>

                        {/* 9. Active Toggle */}
                        <div className="accounts-create-status flex items-center justify-start gap-2 p-0 bg-transparent border-0 rounded-none">
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
                                <div className="relative h-7 w-[50px] rounded-full bg-[#dfe4ec] transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-300 peer-checked:bg-black before:absolute before:left-[3px] before:top-[3px] before:h-[22px] before:w-[22px] before:rounded-full before:border before:border-gray-200 before:bg-white before:shadow-[0_1px_4px_rgba(15,23,42,0.18)] before:transition-transform before:duration-200 before:content-[''] peer-checked:before:translate-x-[22px] peer-checked:before:border-white"></div>
                            </label>
                            <h3 className="text-xs font-bold text-gray-900">Account Status</h3>
                        </div>

                        {/* Actions */}
                        <div className="accounts-create-actions pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/accounts')}
                                className="px-6 py-2 rounded-xl text-[12px] font-extrabold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 bg-black text-white text-[12px] font-extrabold rounded-xl shadow-lg active:scale-95 flex items-center gap-2 hover:bg-gray-900 transition-all"
                            >
                                <Save size={16} />
                                <span>{isEditMode ? "Update Account" : "Save Account"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Success Popup */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{isEditMode ? "Account Updated" : "Account Created"}</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Redirecting to account list...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateAccount;
