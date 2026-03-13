import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, X, ChevronDown } from 'lucide-react';
import PageHeader from '../../../components/layout/PageHeader';
import Card from '../../../components/common/Card';
import CustomSelect from '../../../components/common/CustomSelect';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import apiService from '../../../services/api';
import { cn } from '../../../utils/cn';

const isPartyInactive = (party) => {
    if (!party) return false;
    if (typeof party.isActive === 'boolean') return !party.isActive;
    if (typeof party.status === 'string') return party.status.trim().toLowerCase() === 'inactive';
    if (typeof party.status === 'number') return party.status === 2;
    return false;
};

const isCategoryInactive = (category) => {
    if (!category) return false;
    if (typeof category.isActive === 'boolean') return !category.isActive;
    if (typeof category.status === 'string') return category.status.trim().toLowerCase() === 'inactive';
    if (typeof category.status === 'number') return category.status === 2;
    return false;
};

const isAccountInactive = (account) => {
    if (!account) return false;
    if (typeof account.isActive === 'boolean') return !account.isActive;
    if (typeof account.status === 'string') return account.status.trim().toLowerCase() === 'inactive';
    if (typeof account.status === 'number') return account.status === 2;
    return false;
};

const CreateTransaction = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const isEditMode = !!id;
    const { selectedBranch, branches } = useBranch();
    const { selectedYear } = useYear();
    const { preferences } = usePreferences();
    const { selectedOrg } = useOrganization();
    const isAllOrMultiBranchScope = selectedBranch?.id === 'all' || selectedBranch?.id === 'multi';

    const resolveDefaultGstRate = (branch) => {
        const resolved = isAllOrMultiBranchScope
            ? (preferences?.defaultGstRate ?? branch?.defaultGstRate)
            : (branch?.defaultGstRate ?? preferences?.defaultGstRate);
        return String(resolved ?? '18');
    };

    // Branch IDs passed from the list page (siblings detected by name+date match)
    const stateOriginalBranchIds = (location.state?.originalBranchIds || []).map(Number).filter(Boolean);
    const stateSiblingMap = location.state?.siblingMap || {};

    // Target Branch state — user picks ONE branch this transaction belongs to
    const [targetBranchIds, setTargetBranchIds] = useState(() => {
        if (isEditMode && stateOriginalBranchIds.length > 0) return stateOriginalBranchIds;
        // Default to the currently selected branch, or first available
        if (selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') {
            return [Number(selectedBranch.id)];
        }
        return branches.length > 0 ? [Number(branches[0].id)] : [];
    });

    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef(null);
    const formRef = useRef(null);
    const hasGstRateEditedRef = useRef(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [initialData, setInitialData] = useState(null); // State to hold initial transaction data for edit mode

    // This referenceId will be used to fetch dependencies (accounts, categories, parties)
    // It should be a single branch ID, typically the first selected one, or the currently active branch
    // if not in multi-select mode.
    const referenceBranchId = (() => {
        if (isEditMode && initialData?.branchId) return Number(initialData.branchId);
        if (selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') return Number(selectedBranch.id);
        if (targetBranchIds.length > 0) return Number(targetBranchIds[0]);
        return null;
    })();

    const [txnTypes, setTxnTypes] = useState([]);

    const initialBranch = branches.find(b => Number(b.id) === referenceBranchId) || selectedBranch;

    const [formData, setFormData] = useState({
        txnDate: new Date().toISOString().split('T')[0],
        txnTypeId: 2, // Default to Expense (ID 2 usually)
        name: '',
        accountId: '',
        attachmentPath: '',
        categoryId: '',
        subCategoryId: '',
        amountLocal: '',

        contact: '', // Will store the Party's name
        notes: '',
        status: 1, // Default Posted
        currencyCode: 'INR',
        fxRate: '1',
        fromAccountId: '',
        toAccountId: '',

        // GST fields
        isTaxable: false,
        gstType: 'INTRA',
        gstRate: resolveDefaultGstRate(initialBranch),
    });

    // Computed GST values (derived from formData, not stored in formData)
    const [gstCalc, setGstCalc] = useState({
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        gstTotal: 0,
        finalAmount: 0,
    });

    // GST is only applicable to Income (1) and Expense (2) in the branch's base currency
    const isGstEligible = [1, 2].includes(Number(formData.txnTypeId))
        && formData.currencyCode === (selectedBranch?.currencyCode || 'INR');

    const sanitizeDecimalInput = (value) => {
        let sanitized = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
        const firstDot = sanitized.indexOf('.');
        if (firstDot !== -1) {
            sanitized = `${sanitized.slice(0, firstDot + 1)}${sanitized.slice(firstDot + 1).replace(/\./g, '')}`;
        }
        return sanitized;
    };

    const handleAmountLocalChange = (e) => {
        setFormData(prev => ({ ...prev, amountLocal: sanitizeDecimalInput(e.target.value) }));
    };

    const handleGstRateChange = (e) => {
        hasGstRateEditedRef.current = true;
        setFormData(prev => ({ ...prev, gstRate: sanitizeDecimalInput(e.target.value) }));
    };

    const persistManualGstRateToSettings = () => {
        if (!hasGstRateEditedRef.current) return;

        const parsed = Number.parseFloat(formData.gstRate);
        if (!Number.isFinite(parsed) || parsed < 0) {
            hasGstRateEditedRef.current = false;
            return;
        }

        const normalizedRate = parsed.toString();
        const orgKey = selectedOrg?.id || 'org';
        const branchKeys = new Set();

        targetBranchIds
            .map((id) => Number(id))
            .filter(Boolean)
            .forEach((id) => branchKeys.add(String(id)));

        if (selectedBranch?.id != null) {
            branchKeys.add(String(selectedBranch.id));
        }

        branchKeys.add('branch');

        const upsertRate = (storageKey) => {
            let existing = [];
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const parsedRaw = JSON.parse(raw);
                    if (Array.isArray(parsedRaw)) existing = parsedRaw;
                }
            } catch {
                existing = [];
            }

            const cleaned = Array.from(
                new Set(
                    [...existing, normalizedRate]
                        .map((rate) => {
                            const num = Number.parseFloat(rate);
                            if (!Number.isFinite(num) || num < 0) return null;
                            return num.toString();
                        })
                        .filter(Boolean)
                )
            ).sort((a, b) => Number(a) - Number(b));

            localStorage.setItem(storageKey, JSON.stringify(cleaned));
        };

        branchKeys.forEach((branchKey) => {
            upsertRate(`gst_rate_options_${orgKey}_${branchKey}`);
        });

        hasGstRateEditedRef.current = false;
    };


    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [parties, setParties] = useState([]);
    const [attachment, setAttachment] = useState(null);

    const [loading, setLoading] = useState(false);
    const [fxLoading, setFxLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [errors, setErrors] = useState({});

    // Update currency when branch loads
    useEffect(() => {
        if (!isEditMode && selectedBranch?.currencyCode) {
            setFormData(prev => ({
                ...prev,
                currencyCode: selectedBranch.currencyCode
            }));
        }
    }, [selectedBranch, isEditMode]);

    // Fetch Dependencies
    useEffect(() => {
        const controller = new AbortController();

        const fetchDependencies = async (referenceId) => {
            try {
                if (!referenceId) return;

                // Fetch Transaction Types (Only if not already loaded)
                if (txnTypes.length === 0) {
                    const typesRes = await apiService.get('/transactions/types', { signal: controller.signal });
                    if (typesRes.success && Array.isArray(typesRes.data)) {
                        setTxnTypes(typesRes.data);
                        if (!isEditMode && typesRes.data.length > 0) {
                            // Default to Expense or first
                            const expense = typesRes.data.find(t => t.name.toLowerCase() === 'expense');
                            setFormData(prev => ({ ...prev, txnTypeId: expense ? expense.id : typesRes.data[0].id }));
                        }
                    }
                }

                // Fetch Accounts, Categories, Parties for all branches
                const [accRes, catRes, partyRes] = await Promise.all([
                    apiService.accounts.getAll({ branchId: 'all' }, { signal: controller.signal }).catch(e => { if (e.name !== 'CanceledError') console.error(e); return null; }),
                    apiService.categories.getAll({ branchId: 'all' }, { signal: controller.signal }).catch(e => { if (e.name !== 'CanceledError') console.error(e); return null; }),
                    apiService.parties.getAll({ branchId: 'all' }, { signal: controller.signal }).catch(e => { if (e.name !== 'CanceledError') console.error(e); return null; })
                ]);

                if (controller.signal.aborted) return;

                const accountsList = Array.isArray(accRes) ? accRes : (accRes?.data || []);
                const uniqueAccountsMap = new Map();
                accountsList.forEach(a => {
                    const nameKey = (a.name || '').toLowerCase().trim();
                    if (!uniqueAccountsMap.has(nameKey)) uniqueAccountsMap.set(nameKey, { ...a });
                });
                setAccounts(Array.from(uniqueAccountsMap.values()));

                const categoriesList = Array.isArray(catRes) ? catRes : (catRes?.data || []);

                // Deduplicate Categories and Sub-categories by name (case-insensitive)
                const uniqueCatsMap = new Map();
                categoriesList.forEach(c => {
                    const catNameKey = (c.name || '').toLowerCase().trim();
                    if (!uniqueCatsMap.has(catNameKey)) {
                        // Deep clone to avoid mutating original
                        const newCat = { ...c };
                        if (c.subCategories) {
                            const uniqueSubsMap = new Map();
                            c.subCategories.forEach(s => {
                                const subNameKey = (s.name || '').toLowerCase().trim();
                                if (!uniqueSubsMap.has(subNameKey)) {
                                    uniqueSubsMap.set(subNameKey, { ...s });
                                }
                            });
                            newCat.subCategories = Array.from(uniqueSubsMap.values());
                        }
                        uniqueCatsMap.set(catNameKey, newCat);
                    }
                });
                const uniqueCategoriesList = Array.from(uniqueCatsMap.values());
                setCategories(uniqueCategoriesList);

                const partiesList = Array.isArray(partyRes) ? partyRes : (partyRes?.data || []);
                const uniquePartiesMap = new Map();
                partiesList.forEach(p => {
                    const nameKey = (p.name || '').toLowerCase().trim();
                    if (!uniquePartiesMap.has(nameKey)) uniquePartiesMap.set(nameKey, { ...p });
                });
                setParties(Array.from(uniquePartiesMap.values()));
            } catch (error) {
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
                console.error("Failed to load dependencies:", error);
            }
        };

        if (referenceBranchId) {
            fetchDependencies(referenceBranchId);
        }

        return () => controller.abort();
    }, [referenceBranchId, isEditMode]); // React to referenceBranchId changes

    // Load Transaction Data for Edit
    useEffect(() => {
        const fetchTransaction = async () => {
            if (!isEditMode) return;

            try {
                const response = await apiService.transactions.getById(id);
                if (response.success && response.data) {
                    const txn = response.data;
                    const typeId = Number(txn.txnTypeId || txn.transactionType?.id || 2);
                    const typeName = (txn.txnType || txn.transactionType?.name || '').toLowerCase();

                    // Derive account fields from double-entry rows (fallback to legacy fields).
                    let accountId = txn.accountId || '';
                    let categoryId = txn.categoryId || '';
                    let fromAccountId = txn.fromAccountId || '';
                    let toAccountId = txn.toAccountId || '';

                    if (Array.isArray(txn.entries) && txn.entries.length > 0) {
                        const entries = txn.entries;
                        if (typeName === 'expense' || typeId === 2) {
                            // Dr Expense(Category), Cr Asset(Account)
                            const exp = entries.find(e => Number(e.debit) > 0);
                            const asset = entries.find(e => Number(e.credit) > 0);
                            categoryId = exp?.accountId || categoryId;
                            accountId = asset?.accountId || accountId;
                        } else if (typeName === 'income' || typeId === 1) {
                            // Dr Asset(Account), Cr Income(Category)
                            const asset = entries.find(e => Number(e.debit) > 0);
                            const inc = entries.find(e => Number(e.credit) > 0);
                            accountId = asset?.accountId || accountId;
                            categoryId = inc?.accountId || categoryId;
                        } else if (typeName === 'transfer' || typeId === 4) {
                            // Dr To, Cr From
                            const to = entries.find(e => Number(e.debit) > 0);
                            const from = entries.find(e => Number(e.credit) > 0);
                            toAccountId = to?.accountId || toAccountId;
                            fromAccountId = from?.accountId || fromAccountId;
                        } else if (typeName === 'investment' || typeId === 3) {
                            // Dr InvestmentAccount(to), Cr PaidFrom(account)
                            const to = entries.find(e => Number(e.debit) > 0);
                            const from = entries.find(e => Number(e.credit) > 0);
                            toAccountId = to?.accountId || toAccountId;
                            accountId = from?.accountId || accountId;
                        }
                    }

                    setFormData({
                        txnDate: txn.txnDate ? new Date(txn.txnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        txnTypeId: typeId, // Fallback to Expense
                        name: txn.name || txn.referenceNo || '',   // Fallback to refNo if name empty
                        accountId: accountId ? String(accountId) : '',
                        categoryId: categoryId ? String(categoryId) : '',
                        subCategoryId: txn.subCategoryId ? String(txn.subCategoryId) : '',
                        amountLocal: txn.amountLocal || txn.amountBase,

                        contact: txn.contact || txn.counterpartyName || '',
                        notes: txn.notes || '',
                        status: Number(txn.status) === 1 ? 1 : 0,
                        currencyCode: txn.currencyCode || selectedBranch?.currencyCode || 'INR',
                        fxRate: txn.fxRate || '1',
                        referenceNo: txn.referenceNo || '',
                        attachmentPath: txn.attachmentPath,
                        fromAccountId: fromAccountId ? String(fromAccountId) : '',
                        toAccountId: toAccountId ? String(toAccountId) : '',

                        // GST fields
                        isTaxable: txn.isTaxable === true || txn.isTaxable === 1,
                        gstType: txn.gstType || 'INTRA',
                        gstRate: txn.gstRate != null ? String(txn.gstRate) : resolveDefaultGstRate(initialBranch),
                    });
                    if (txn.attachmentPath) {
                        setAttachment(txn.attachmentPath);
                    } else {
                        setAttachment(null);
                    }
                    setTargetBranchIds(
                        stateOriginalBranchIds.length > 0
                            ? stateOriginalBranchIds
                            : [Number(txn.branchId)]
                    );
                    setInitialData(txn);
                }
            } catch (error) {
                console.error("Failed to fetch transaction details:", error);
                setErrorMsg("Failed to load transaction details.");
            }
        };
        fetchTransaction();
    }, [id, isEditMode, selectedBranch]);


    const actualReferenceBranch = branches.find(b => Number(b.id) === referenceBranchId) || selectedBranch;
    const effectiveDefaultGstRate = resolveDefaultGstRate(actualReferenceBranch);

    // Smart GST Engine (Auto-determine Type and Rate)
    const prevContactRef = useRef(formData.contact);
    const prevBranchStateRef = useRef(actualReferenceBranch?.state);
    const prevBranchGstRateRef = useRef(effectiveDefaultGstRate);
    const prevIsTaxableRef = useRef(formData.isTaxable);
    const hasInitializedEditRef = useRef(false);

    useEffect(() => {
        // Prevent overwriting data on initial edit load
        if (isEditMode && !hasInitializedEditRef.current) {
            if (initialData) hasInitializedEditRef.current = true;
            prevContactRef.current = formData.contact;
            prevBranchStateRef.current = actualReferenceBranch?.state;
            prevBranchGstRateRef.current = effectiveDefaultGstRate;
            prevIsTaxableRef.current = formData.isTaxable;
            return;
        }

        if (!isGstEligible || !formData.isTaxable) {
            prevContactRef.current = formData.contact;
            prevBranchStateRef.current = actualReferenceBranch?.state;
            prevBranchGstRateRef.current = effectiveDefaultGstRate;
            prevIsTaxableRef.current = formData.isTaxable;
            return;
        }

        // Only trigger auto-calc if one of the true dependencies changed
        const contactChanged = prevContactRef.current !== formData.contact;
        const branchStateChanged = prevBranchStateRef.current !== actualReferenceBranch?.state;
        const branchGstRateChanged = prevBranchGstRateRef.current !== effectiveDefaultGstRate;
        const becameTaxable = !prevIsTaxableRef.current && formData.isTaxable;

        if (contactChanged || branchStateChanged || branchGstRateChanged || becameTaxable) {
            const safeContact = (formData.contact || '').trim().toLowerCase();
            const selectedParty = parties.find(p => (p.name || '').trim().toLowerCase() === safeContact);

            let determinedType = 'INTRA'; // Default fallback
            const branchState = (actualReferenceBranch?.state || '').trim().toLowerCase();
            const partyState = (selectedParty?.state || '').trim().toLowerCase();

            if (branchState && partyState) {
                determinedType = branchState === partyState ? 'INTRA' : 'INTER';
            }

            // console.log('--- Smart GST Auto-Engine ---', {
            //     contact: formData.contact,
            //     partyFound: !!selectedParty,
            //     rawPartyState: selectedParty?.state,
            //     branchState,
            //     partyState,
            //     determinedType
            // });

            const determinedRate = effectiveDefaultGstRate;

            setFormData(prev => ({
                ...prev,
                gstType: determinedType,
                gstRate: determinedRate
            }));
        }

        prevContactRef.current = formData.contact;
        prevBranchStateRef.current = actualReferenceBranch?.state;
        prevBranchGstRateRef.current = effectiveDefaultGstRate;
        prevIsTaxableRef.current = formData.isTaxable;

    }, [formData.contact, actualReferenceBranch?.state, effectiveDefaultGstRate, formData.isTaxable, isGstEligible, parties, isEditMode, initialData]);

    // GST Auto-Calculation
    useEffect(() => {
        if (!formData.isTaxable || !isGstEligible) {
            const base = parseFloat(formData.amountLocal) || 0;
            setGstCalc({ cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0, finalAmount: base });
            return;
        }
        const base = parseFloat(formData.amountLocal) || 0;
        const rate = parseFloat(formData.gstRate) || 0;
        if (formData.gstType === 'INTRA') {
            const half = rate / 2;
            const cgst = Math.round(base * half / 100 * 100) / 100;
            const sgst = cgst;
            setGstCalc({ cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0, gstTotal: cgst + sgst, finalAmount: base + cgst + sgst });
        } else {
            const igst = Math.round(base * rate / 100 * 100) / 100;
            setGstCalc({ cgstAmount: 0, sgstAmount: 0, igstAmount: igst, gstTotal: igst, finalAmount: base + igst });
        }
    }, [formData.amountLocal, formData.isTaxable, formData.gstType, formData.gstRate, isGstEligible]);

    // Auto-fetch Exchange Rate
    useEffect(() => {
        const fetchRate = async () => {
            if (formData.currencyCode && selectedBranch?.currencyCode && formData.currencyCode !== selectedBranch.currencyCode) {
                setFxLoading(true);
                try {
                    const res = await fetch(`https://api.frankfurter.app/latest?amount=1&from=${formData.currencyCode}&to=${selectedBranch.currencyCode}`);
                    const data = await res.json();
                    if (data && data.rates && data.rates[selectedBranch.currencyCode]) {
                        setFormData(prev => ({ ...prev, fxRate: data.rates[selectedBranch.currencyCode] }));
                    }
                } catch (error) {
                    console.error("Failed to fetch exchange rate:", error);
                } finally {
                    setFxLoading(false);
                }
            } else {
                setFormData(prev => ({ ...prev, fxRate: '1' }));
            }
        };

        const timeoutId = setTimeout(() => {
            fetchRate();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.currencyCode, selectedBranch]);


    const handleTypeChange = (typeId) => {
        setFormData(prev => ({
            ...prev,
            txnTypeId: Number(typeId),
            accountId: '',
            categoryId: '',
            subCategoryId: '',
            fromAccountId: '',
            toAccountId: '',
            // Reset tax when switching to non-eligible type
            isTaxable: [1, 2].includes(Number(typeId)) ? prev.isTaxable : false,
        }));
    };

    const getValidationErrors = () => {
        const newErrors = {};
        const isInvalidId = (val) => !val || val === 'null' || val === 'undefined' || val === '';

        if (targetBranchIds.length === 0) newErrors.targetBranchIds = "Please select at least one branch";
        if (!formData.txnTypeId) newErrors.txnTypeId = "Type is required";
        if (Number(formData.txnTypeId) !== 4 && !String(formData.contact || '').trim()) newErrors.contact = "Party is required";
        if (!formData.txnDate) newErrors.txnDate = "Date is required";
        if (!formData.amountLocal || parseFloat(formData.amountLocal) <= 0) newErrors.amountLocal = "Valid Amount is required";

        if (Number(formData.txnTypeId) === 4) { // Transfer
            if (isInvalidId(formData.fromAccountId)) newErrors.fromAccountId = "From Account is required";
            if (isInvalidId(formData.toAccountId)) newErrors.toAccountId = "To Account is required";
            if (!isInvalidId(formData.fromAccountId) && !isInvalidId(formData.toAccountId) && formData.fromAccountId === formData.toAccountId) {
                newErrors.toAccountId = "Must be different from 'From Account'";
            }
        } else if (Number(formData.txnTypeId) === 2) { // Expense
            if (isInvalidId(formData.accountId)) newErrors.accountId = "Payment Account is required";
            if (isInvalidId(formData.categoryId)) newErrors.categoryId = "Category is required";
        } else if (Number(formData.txnTypeId) === 3 || txnTypes.find(t => t.id === Number(formData.txnTypeId))?.name?.toLowerCase() === 'investment') { // Investment
            if (isInvalidId(formData.accountId)) newErrors.accountId = "Payment Account is required";
            if (isInvalidId(formData.toAccountId)) newErrors.toAccountId = "Investment Account is required";
            if (isInvalidId(formData.categoryId)) newErrors.categoryId = "Category is required";
        } else if (Number(formData.txnTypeId) === 1) { // Income
            if (isInvalidId(formData.accountId)) newErrors.accountId = "Deposit Account is required";
            if (isInvalidId(formData.categoryId)) newErrors.categoryId = "Category is required";
        }

        // GST Validation
        if (isGstEligible && formData.isTaxable) {
            if (!formData.gstType) newErrors.gstType = "GST Type is required";
            const rate = parseFloat(formData.gstRate);
            if (isNaN(rate) || rate < 0 || rate > 100) newErrors.gstRate = "Valid Rate is required";
        }

        return newErrors;
    };

    // Auto-clear field highlights when values become valid.
    useEffect(() => {
        if (!errors || Object.keys(errors).length === 0) return;

        const latestErrors = getValidationErrors();
        const remainingErrors = {};
        Object.keys(errors).forEach((key) => {
            if (latestErrors[key]) remainingErrors[key] = latestErrors[key];
        });

        const hasChanged = JSON.stringify(remainingErrors) !== JSON.stringify(errors);
        if (!hasChanged) return;

        setErrors(remainingErrors);
        if (Object.keys(remainingErrors).length === 0) {
            setErrorMsg((prev) => (prev?.includes('Please complete all compulsory fields') ? '' : prev));
        }
    }, [formData, targetBranchIds, isGstEligible, txnTypes, errors]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        persistManualGstRateToSettings();
        setLoading(true);
        setErrorMsg('');

        if (!selectedYear?.id) { setErrorMsg("Financial Year not selected."); setLoading(false); return; }

        const newErrors = getValidationErrors();

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setErrorMsg("Please complete all compulsory fields highlighted in red.");
            setLoading(false);
            return;
        }

        setErrors({});

        try {
            // Entities are global — use the selected IDs directly without per-branch re-mapping
            for (const bId of targetBranchIds) {
                const isTransferType = Number(formData.txnTypeId) === 4;
                const payload = {
                    ...formData,
                    name: isTransferType ? '' : (formData.contact || 'Transaction'),
                    accountId: formData.accountId || null,
                    categoryId: formData.categoryId || null,
                    subCategoryId: formData.subCategoryId || null,
                    fromAccountId: formData.fromAccountId || null,
                    toAccountId: formData.toAccountId || null,
                    branchId: bId,
                    financialYearId: selectedYear.id,
                    txnTypeId: Number(formData.txnTypeId),
                    // GST payload
                    isTaxable: isGstEligible && formData.isTaxable,
                    gstType: isGstEligible && formData.isTaxable ? formData.gstType : null,
                    gstRate: isGstEligible && formData.isTaxable ? parseFloat(formData.gstRate) : null,
                    cgstAmount: isGstEligible && formData.isTaxable ? gstCalc.cgstAmount : null,
                    sgstAmount: isGstEligible && formData.isTaxable ? gstCalc.sgstAmount : null,
                    igstAmount: isGstEligible && formData.isTaxable ? gstCalc.igstAmount : null,
                    gstTotal: isGstEligible && formData.isTaxable ? gstCalc.gstTotal : null,
                    finalAmount: gstCalc.finalAmount,
                };

                const isNewFile = attachment && typeof attachment !== 'string';
                const isOriginalBranch = isEditMode && stateOriginalBranchIds.includes(Number(bId));
                const txnIdToUpdate = isOriginalBranch ? (stateSiblingMap[Number(bId)] || id) : null;

                if (isOriginalBranch && txnIdToUpdate) {
                    // UPDATE the existing transaction in the original branch
                    if (isNewFile || attachment) {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined) formDataObj.append(key, payload[key]);
                        });
                        if (attachment) formDataObj.append('attachments', attachment);
                        await apiService.transactions.update(txnIdToUpdate, formDataObj);
                    } else {
                        await apiService.transactions.update(txnIdToUpdate, payload);
                    }
                } else if (isEditMode) {
                    // CREATE in a newly added branch
                    if (isNewFile || attachment) {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined) formDataObj.append(key, payload[key]);
                        });
                        if (attachment) formDataObj.append('attachments', attachment);
                        await apiService.transactions.create(formDataObj);
                    } else {
                        await apiService.transactions.create(payload);
                    }
                } else {
                    // Pure CREATE mode
                    if (isNewFile) {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined) formDataObj.append(key, payload[key]);
                        });
                        if (attachment) formDataObj.append('attachments', attachment);
                        await apiService.transactions.create(formDataObj);
                    } else {
                        await apiService.transactions.create(payload);
                    }
                }
            }

            // If editing and original branch was de-selected → delete transaction from original branch
            if (isEditMode) {
                for (const origBranchId of stateOriginalBranchIds) {
                    if (!targetBranchIds.map(Number).includes(origBranchId)) {
                        const deleteId = stateSiblingMap[origBranchId] || (origBranchId === Number(initialData?.branchId) ? id : null);
                        if (deleteId) {
                            await apiService.transactions.delete(deleteId);
                        }
                    }
                }
            }

            setShowSuccess(true);
            setTimeout(() => {
                navigate('/transactions');
            }, 1500);

        } catch (error) {
            console.error("Failed to save transaction:", error);
            setErrorMsg(error.response?.data?.message || error.message || "Failed to save transaction");
        } finally {
            setLoading(false);
        }
    };


    // Helper options
    const isAssetAccount = (a) => (Number(a.type || a.accountType) === 1 || a.accountType === 'Asset' || a.typeLabel === 'Asset');
    // Allow currently selected values so edit mode never loses prefilled options.
    const assetAccounts = accounts.filter(a => isAssetAccount(a) || a.id === Number(formData.accountId) || a.id === Number(formData.fromAccountId) || a.id === Number(formData.toAccountId));
    const transferAccounts = accounts;
    const investmentAccounts = accounts.filter(a => (isAssetAccount(a) && Number(a.subtype) === 14) || a.id === Number(formData.toAccountId));
    const selectedTxnType = txnTypes.find(t => t.id === Number(formData.txnTypeId));
    const isInvestmentSelected = Number(formData.txnTypeId) === 3 || selectedTxnType?.name?.toLowerCase() === 'investment';

    const expenseCategories = categories.filter(c => (c.txnType && c.txnType.toLowerCase() === 'expense') || c.transactionType?.name?.toLowerCase() === 'expense');
    const incomeCategories = categories.filter(c => (c.txnType && c.txnType.toLowerCase() === 'income') || c.transactionType?.name?.toLowerCase() === 'income');
    const investmentCategories = categories.filter(c => (c.txnType && c.txnType.toLowerCase() === 'investment') || c.transactionType?.name?.toLowerCase() === 'investment');

    const selectedCategoryObj = categories.find(c => c.id === Number(formData.categoryId));
    const currentSubcategories = selectedCategoryObj?.subCategories || [];

    const getNavigableFields = () => {
        if (!formRef.current) return [];
        return Array.from(
            formRef.current.querySelectorAll('[data-nav-field="true"], [data-custom-select-trigger="true"]')
        ).filter((el) => {
            if (!el || el.disabled) return false;
            return el.offsetParent !== null || el.getClientRects?.().length > 0;
        });
    };

    const handleFormKeyNavigation = (e) => {
        const navKeys = ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'];
        if (!navKeys.includes(e.key)) return;

        const current = e.target.closest('[data-nav-field="true"], [data-custom-select-trigger="true"]');
        if (!current) return;

        const fields = getNavigableFields();
        const currentIndex = fields.indexOf(current);
        if (currentIndex === -1) return;

        e.preventDefault();

        const step = (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 1;
        const nextIndex = currentIndex + step;
        const next = fields[nextIndex];

        if (next) {
            next.focus();
            return;
        }

        if (e.key === 'Enter') {
            e.currentTarget.requestSubmit();
        }
    };

    return (
        <div className="flex flex-col min-h-screen relative bg-gray-50/50">
            <PageHeader
                title={isEditMode ? "Edit Transaction" : "Create Transaction"}
                breadcrumbs={['Transactions', isEditMode ? 'Edit Transaction' : 'Create New']}
                className="shrink-0"
            />

            <div className="p-4 lg:p-6 max-w-3xl mx-auto w-full flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form ref={formRef} noValidate onSubmit={handleSubmit} onKeyDown={handleFormKeyNavigation} className="flex flex-col min-h-0 txn-desktop-form txn-laptop-form txn-mobile-form">
                    <Card className="flex flex-col h-full min-h-0 max-h-[calc(100dvh-130px)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none p-0 overflow-hidden txn-desktop-card txn-laptop-card txn-mobile-card">
                        <div className="flex flex-col h-full min-h-0 p-4 lg:p-6">
                            <div className="flex-1 min-h-0 space-y-5 overflow-y-auto pr-2 pb-4 no-scrollbar txn-desktop-form-scroll txn-laptop-form-scroll txn-mobile-form-scroll">
                                <div className="flex items-center space-x-4 border-b border-gray-50 pb-4 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/transactions')}
                                        className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-500"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">{isEditMode ? "Edit Transaction" : "New Transaction"}</h2>
                                        <p className="text-sm text-gray-500">{isEditMode ? "Update transaction details" : "Enter the details for the new transaction"}</p>
                                    </div>
                                </div>


                                {/* Branch selector */}
                                {branches && branches.length > 1 && (
                                    <div className="space-y-1.5 w-full">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                            Branch <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={targetBranchIds[0] ?? ''}
                                            onChange={(e) => setTargetBranchIds([Number(e.target.value)])}
                                            className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.targetBranchIds ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </CustomSelect>
                                        {errors.targetBranchIds && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.targetBranchIds}</p>}
                                    </div>
                                )}

                                {/* Row 1: Type & Party */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-1.5 w-full">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                            Transaction Type <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={formData.txnTypeId ?? ""}
                                            onChange={(e) => handleTypeChange(Number(e.target.value))}
                                            className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all capitalize", errors.txnTypeId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                        >
                                            {txnTypes.length > 0 ? (
                                                txnTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))
                                            ) : (
                                                ['Income', 'Expense', 'Transfer', 'Investment'].map((t, i) => (
                                                    <option key={t} value={i + 1}>{t}</option>
                                                ))
                                            )}
                                        </CustomSelect>
                                        {errors.txnTypeId && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnTypeId}</p>}
                                    </div>

                                    {Number(formData.txnTypeId) !== 4 && (
                                        <div className="space-y-1.5 w-full">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Party</label>
                                            <CustomSelect
                                                value={formData.contact ?? ""}
                                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                                className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.contact ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                            >
                                                <option value="">Select Party</option>
                                                {formData.contact && !parties.some(p => p.name === formData.contact) && (
                                                    <option value={formData.contact ?? ""}>{formData.contact}</option>
                                                )}
                                                {parties.map(p => {
                                                    const inactive = isPartyInactive(p);
                                                    return (
                                                        <option key={p.id} value={p.name} disabled={inactive}>
                                                            {p.name}{inactive ? ' (Inactive)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </CustomSelect>
                                            {errors.contact && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.contact}</p>}
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Fields */}
                                {Number(formData.txnTypeId) === 4 ? (
                                    // Transfer
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Amount <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <CustomSelect
                                                        value={formData.currencyCode ?? ""}
                                                        onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                                                        className="w-24 px-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                    >
                                                        <option value={selectedBranch?.currencyCode}>{selectedBranch?.currencyCode}</option>
                                                        {['INR', 'USD', 'EUR', 'GBP']
                                                            .filter(c => c !== selectedBranch?.currencyCode)
                                                            .map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                    </CustomSelect>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        data-nav-field="true"
                                                        required
                                                        value={formData.amountLocal}
                                                        onChange={handleAmountLocalChange}
                                                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                            </div>
                                        </div>

                                        {/* Exchange Rate Input */}
                                        {formData.currencyCode && selectedBranch?.currencyCode && formData.currencyCode !== selectedBranch?.currencyCode && (
                                            <div className="p-4 bg-amber-50 rounded-xl flex items-center justify-between gap-4 border border-amber-100 mt-5">
                                                <div className="text-sm font-medium text-amber-800">
                                                    <span className="block font-bold">Foreign Transaction Detected</span>
                                                    <span className="text-xs opacity-75">1 {formData.currencyCode} = ? {selectedBranch?.currencyCode}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                                                        {fxLoading ? 'Fetching...' : 'Exchange Rate:'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        data-nav-field="true"
                                                        required
                                                        min="0.000001"
                                                        step="0.000001"
                                                        value={formData.fxRate || ''}
                                                        onChange={(e) => setFormData({ ...formData, fxRate: e.target.value })}
                                                        className="w-28 px-3 py-2 bg-white border border-amber-200 rounded-lg text-[14px] font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-right"
                                                        placeholder="e.g 83.50"
                                                        disabled={fxLoading}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                            <div className="space-y-1.5 relative z-[60]">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    From Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.fromAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-white border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.fromAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Select Account</option>
                                                    {transferAccounts.filter(a => a.id !== Number(formData.toAccountId)).map(a => {
                                                        const inactive = isAccountInactive(a);
                                                        return (
                                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                                {a.name}{inactive ? ' (Inactive)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </CustomSelect>
                                                {errors.fromAccountId && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.fromAccountId}</p>}
                                            </div>
                                            <div className="space-y-1.5 relative z-[50]">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    To Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.toAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-white border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.toAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Select Account</option>
                                                    {transferAccounts.filter(a => a.id !== Number(formData.fromAccountId)).map(a => {
                                                        const inactive = isAccountInactive(a);
                                                        return (
                                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                                {a.name}{inactive ? ' (Inactive)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </CustomSelect>
                                                {errors.toAccountId && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.toAccountId}</p>}
                                            </div>
                                        </div>
                                    </>
                                ) : isInvestmentSelected ? (
                                    // Investment
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    From Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.accountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.accountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Select Account</option>
                                                    {assetAccounts.map(a => {
                                                        const inactive = isAccountInactive(a);
                                                        return (
                                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                                {a.name}{inactive ? ' (Inactive)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </CustomSelect>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Investment Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.toAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.toAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Select Account</option>
                                                    {investmentAccounts.map(a => {
                                                        const inactive = isAccountInactive(a);
                                                        return (
                                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                                {a.name}{inactive ? ' (Inactive)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </CustomSelect>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Investment Category <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.categoryId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.categoryId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Select Category</option>
                                                    {investmentCategories.map(c => {
                                                        const inactive = isCategoryInactive(c);
                                                        return (
                                                            <option key={c.id} value={c.id} disabled={inactive}>
                                                                {c.name}{inactive ? ' (Inactive)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </CustomSelect>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Amount <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <CustomSelect
                                                        value={formData.currencyCode ?? ""}
                                                        onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                                                        className="w-24 px-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                    >
                                                        <option value={selectedBranch?.currencyCode}>{selectedBranch?.currencyCode}</option>
                                                        {['INR', 'USD', 'EUR', 'GBP']
                                                            .filter(c => c !== selectedBranch?.currencyCode)
                                                            .map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                    </CustomSelect>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        data-nav-field="true"
                                                        required
                                                        value={formData.amountLocal}
                                                        onChange={handleAmountLocalChange}
                                                        className={cn("flex-1 px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                            </div>
                                        </div>

                                        {formData.currencyCode && selectedBranch?.currencyCode && formData.currencyCode !== selectedBranch?.currencyCode && (
                                            <div className="p-4 bg-amber-50 rounded-xl flex items-center justify-between gap-4 border border-amber-100 mt-5">
                                                <div className="text-sm font-medium text-amber-800">
                                                    <span className="block font-bold">Foreign Transaction Detected</span>
                                                    <span className="text-xs opacity-75">1 {formData.currencyCode} = ? {selectedBranch?.currencyCode}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                                                        {fxLoading ? 'Fetching...' : 'Exchange Rate:'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        data-nav-field="true"
                                                        required
                                                        min="0.000001"
                                                        step="0.000001"
                                                        value={formData.fxRate || ''}
                                                        onChange={(e) => setFormData({ ...formData, fxRate: e.target.value })}
                                                        className="w-28 px-3 py-2 bg-white border border-amber-200 rounded-lg text-[14px] font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-right"
                                                        placeholder="e.g 83.50"
                                                        disabled={fxLoading}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // Income / Expense
                                    <>
                                        {/* Row 2: Date & Account */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>

                                            {/* Payment Wrapper */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    {Number(formData.txnTypeId) === 1 ? 'Deposit To' : 'Paid From'} <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.accountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.accountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    <option value="">Account</option>
                                                    {Number(formData.txnTypeId) === 1 ? (
                                                        accounts.map(a => {
                                                            const inactive = isAccountInactive(a);
                                                            return (
                                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                                    {a.name}{inactive ? ' (Inactive)' : ''}
                                                                </option>
                                                            );
                                                        })
                                                    ) : (
                                                        assetAccounts.map(a => {
                                                            const inactive = isAccountInactive(a);
                                                            return (
                                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                                    {a.name}{inactive ? ' (Inactive)' : ''}
                                                                </option>
                                                            );
                                                        })
                                                    )}
                                                </CustomSelect>
                                                {errors.accountId && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.accountId}</p>}
                                            </div>
                                        </div>

                                        {/* Dynamic Rows based on Sub-Category existence */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                            {/* Always show Category First */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                    {Number(formData.txnTypeId) === 1 ? 'Income Category' : 'Expense Category'} <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    value={formData.categoryId ?? ""}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' });
                                                    }}
                                                    className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.categoryId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                    required
                                                >
                                                    <option value="">Select Category</option>
                                                    {Number(formData.txnTypeId) === 1 ? (
                                                        incomeCategories.map(c => {
                                                            const inactive = isCategoryInactive(c);
                                                            return (
                                                                <option key={c.id} value={c.id} disabled={inactive}>
                                                                    {c.name}{inactive ? ' (Inactive)' : ''}
                                                                </option>
                                                            );
                                                        })
                                                    ) : (
                                                        expenseCategories.map(c => {
                                                            const inactive = isCategoryInactive(c);
                                                            return (
                                                                <option key={c.id} value={c.id} disabled={inactive}>
                                                                    {c.name}{inactive ? ' (Inactive)' : ''}
                                                                </option>
                                                            );
                                                        })
                                                    )}
                                                </CustomSelect>
                                                {errors.categoryId && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.categoryId}</p>}
                                            </div>

                                            {/* If Subcategories exist, show Sub-Category. Else, show Amount on right side. */}
                                            {currentSubcategories.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Sub-Category
                                                    </label>
                                                    <CustomSelect
                                                        value={formData.subCategoryId ?? ""}
                                                        onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                    >
                                                        <option value="">Select Sub-Category</option>
                                                        {currentSubcategories.map(s => {
                                                            const inactive = isCategoryInactive(s);
                                                            return (
                                                                <option key={s.id} value={s.id} disabled={inactive}>
                                                                    {s.name}{inactive ? ' (Inactive)' : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </CustomSelect>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Amount <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <CustomSelect
                                                            value={formData.currencyCode ?? ""}
                                                            onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                                                            className="w-24 px-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                        >
                                                            <option value={selectedBranch?.currencyCode}>{selectedBranch?.currencyCode}</option>
                                                            {['INR', 'USD', 'EUR', 'GBP']
                                                                .filter(c => c !== selectedBranch?.currencyCode)
                                                                .map(c => (
                                                                    <option key={c} value={c}>{c}</option>
                                                                ))}
                                                        </CustomSelect>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            data-nav-field="true"
                                                            required
                                                            value={formData.amountLocal}
                                                            onChange={handleAmountLocalChange}
                                                            className={cn("flex-1 px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* If Sub-category exists, place Amount below */}
                                        {currentSubcategories.length > 0 && (
                                            <div className="mt-5">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Amount <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <CustomSelect
                                                            value={formData.currencyCode ?? ""}
                                                            onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                                                            className="w-24 px-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                        >
                                                            <option value={selectedBranch?.currencyCode}>{selectedBranch?.currencyCode}</option>
                                                            {['INR', 'USD', 'EUR', 'GBP']
                                                                .filter(c => c !== selectedBranch?.currencyCode)
                                                                .map(c => (
                                                                    <option key={c} value={c}>{c}</option>
                                                                ))}
                                                        </CustomSelect>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            data-nav-field="true"
                                                            required
                                                            value={formData.amountLocal}
                                                            onChange={handleAmountLocalChange}
                                                            className={cn("flex-1 px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}


                                        {/* Exchange Rate Input */}
                                        {formData.currencyCode && selectedBranch?.currencyCode && formData.currencyCode !== selectedBranch?.currencyCode && (
                                            <div className="p-4 bg-amber-50 rounded-xl flex items-center justify-between gap-4 border border-amber-100 mt-5">
                                                <div className="text-sm font-medium text-amber-800">
                                                    <span className="block font-bold">Foreign Transaction Detected</span>
                                                    <span className="text-xs opacity-75">1 {formData.currencyCode} = ? {selectedBranch?.currencyCode}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                                                        {fxLoading ? 'Fetching...' : 'Exchange Rate:'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        data-nav-field="true"
                                                        required
                                                        min="0.000001"
                                                        step="0.000001"
                                                        value={formData.fxRate || ''}
                                                        onChange={(e) => setFormData({ ...formData, fxRate: e.target.value })}
                                                        className="w-28 px-3 py-2 bg-white border border-amber-200 rounded-lg text-[14px] font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-right"
                                                        placeholder="e.g 83.50"
                                                        disabled={fxLoading}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── GST Section ── */}
                                        <div className="flex items-center justify-start mt-4">
                                            <div className="flex items-center gap-2">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        data-nav-field="true"
                                                        checked={formData.isTaxable}
                                                        onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                                                </label>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap leading-none">
                                                    {formData.isTaxable ? 'Taxable' : 'Non-Taxable'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* GST Fields — only when Taxable */}
                                        {formData.isTaxable && (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                                    {/* GST Type */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                                            GST Type <span className="text-rose-500">*</span>
                                                        </label>
                                                        <CustomSelect
                                                            value={formData.gstType ?? ""}
                                                            onChange={(e) => setFormData({ ...formData, gstType: e.target.value })}
                                                            className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.gstType ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                        >
                                                            <option value={1}>Intra-State (CGST + SGST)</option>
                                                            <option value={0}>Inter-State (IGST)</option>
                                                        </CustomSelect>
                                                        {errors.gstType && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstType}</p>}
                                                    </div>

                                                    {/* GST Rate */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                                                            GST Rate (%) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            data-nav-field="true"
                                                            value={formData.gstRate}
                                                            onChange={handleGstRateChange}
                                                            onBlur={persistManualGstRateToSettings}
                                                            className={cn("w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all", errors.gstRate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                            placeholder="18"
                                                        />
                                                        {errors.gstRate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstRate}</p>}
                                                    </div>
                                                </div>

                                                {/* GST Calculation Summary */}
                                                {(parseFloat(formData.amountLocal) > 0) && (
                                                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                                                        <div className="px-2.5 py-1 border-b border-gray-200 flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">GST Breakdown</span>
                                                        </div>
                                                        <div className="px-2.5 py-1.5 space-y-1">
                                                            {/* Taxable Amount */}
                                                            <div className="flex items-center justify-between text-[12px]">
                                                                <span className="text-gray-500 font-normal">Taxable Amount</span>
                                                                <span className="font-medium text-gray-700">
                                                                    {formData.currencyCode} {(parseFloat(formData.amountLocal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>

                                                            {/* INTRA breakdown */}
                                                            {Number(formData.gstType) === 1 ? (
                                                                <>
                                                                    <div className="flex items-center justify-between text-[12px]">
                                                                        <span className="text-gray-500 font-normal">CGST ({(parseFloat(formData.gstRate) / 2).toFixed(2)}%)</span>
                                                                        <span className="font-medium text-gray-900">+ {formData.currencyCode} {gstCalc.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[12px]">
                                                                        <span className="text-gray-500 font-normal">SGST ({(parseFloat(formData.gstRate) / 2).toFixed(2)}%)</span>
                                                                        <span className="font-medium text-gray-900">+ {formData.currencyCode} {gstCalc.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center justify-between text-[12px]">
                                                                    <span className="text-gray-500 font-normal">IGST ({parseFloat(formData.gstRate).toFixed(2)}%)</span>
                                                                    <span className="font-medium text-gray-900">+ {formData.currencyCode} {gstCalc.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}

                                                            {/* GST Amount */}
                                                            <div className="flex items-center justify-between text-[12px] border-t border-gray-200 pt-1">
                                                                <span className="text-gray-500 font-normal">GST Amount</span>
                                                                <span className="font-medium text-gray-900">{formData.currencyCode} {gstCalc.gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            </div>

                                                            {/* Final Amount */}
                                                            <div className="flex items-center justify-between rounded-lg bg-gray-900 px-2.5 py-1.5 mt-1">
                                                                <span className="text-white font-medium text-[12px]">Final Amount</span>
                                                                <span className="text-white font-bold text-[12px]">{formData.currencyCode} {gstCalc.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Non-Taxable: show plain amount */}
                                        {!formData.isTaxable && parseFloat(formData.amountLocal) > 0 && (
                                            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                                <span className="text-sm font-medium text-gray-500">Amount (No GST)</span>
                                                <span className="text-base font-extrabold text-gray-800">
                                                    {formData.currencyCode} {(parseFloat(formData.amountLocal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}



                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
                                    <textarea
                                        rows="2"
                                        data-nav-field="true"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all resize-none"
                                        placeholder="Add notes..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attachment (Invoice/Receipt)</label>
                                    </div>
                                    <div className={cn(
                                        "flex flex-col sm:flex-row sm:items-center gap-2"
                                    )}>
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="file"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        setAttachment(e.target.files[0]);
                                                        // A new file should replace any previously stored URL/path.
                                                        setFormData(prev => ({ ...prev, attachmentPath: null }));
                                                    }
                                                }}
                                                className="block w-full text-sm text-slate-500
                                          file:mr-4 file:py-2 file:px-4
                                          file:rounded-full file:border-0
                                          file:text-xs file:font-semibold
                                          file:bg-black file:text-white
                                          hover:file:bg-gray-800
                                        "
                                            />
                                        </div>
                                    </div>
                                    {attachment && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {(() => {
                                                const isUrl = typeof attachment === 'string';
                                                const fileName = isUrl ? attachment.split('/').pop() : attachment.name;
                                                return (
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600 flex items-center gap-1 group relative">
                                                        {isUrl ? (
                                                            <a href={`/api${attachment}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                                                {fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName}
                                                            </a>
                                                        ) : (
                                                            fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAttachment(null);
                                                                // Explicit remove signal for update API.
                                                                setFormData(prev => ({ ...prev, attachmentPath: null }));
                                                            }}
                                                            className="hover:text-red-500"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {errorMsg && (
                                    <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-start gap-2">
                                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:space-x-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => navigate('/transactions')}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-black hover:bg-black/90 transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-70"
                                >
                                    <Save size={18} />
                                    <span>{loading ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}</span>
                                </button>
                            </div>
                        </div>
                    </Card>
                </form>
            </div>

            {/* Success Popup Overlay */}
            {
                showSuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 animate-[bounce_1s_infinite]">
                                <Check size={32} strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{isEditMode ? "Transaction Updated!" : "Transaction Saved!"}</h3>
                            <p className="text-gray-500 text-center text-sm">
                                Your transaction has been successfully {isEditMode ? "updated" : "recorded"}. Redirecting...
                            </p>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default CreateTransaction;
