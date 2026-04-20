import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, X, ChevronDown, Download, ArrowRightLeft } from 'lucide-react';
import PageHeader from '../../../components/layout/PageHeader';
import Card from '../../../components/common/Card';
import CustomSelect from '../../../components/common/CustomSelect';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { useOrganization } from '../../../context/OrganizationContext';
import apiService, { buildAttachmentUrl, downloadAttachmentFile } from '../../../services/api';
import { cn } from '../../../utils/cn';
import GstRateDropdown from './GstRateDropdown';
import { notifyTransactionDataChanged } from '../transactionDataSync';

const TRANSACTIONS_CREATE_SCROLL_MODE_EVENT = 'transactions-create-scroll-mode';

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

const getDefaultCategory = (categories) => {
    const categoryList = categories || [];
    const firstActiveCategory = categoryList.find((category) => !isCategoryInactive(category));
    return firstActiveCategory || categoryList[0] || null;
};

const getDefaultSubCategoryId = (category) => {
    const subCategories = category?.subCategories || [];
    const firstActiveSubCategory = subCategories.find((subCategory) => !isCategoryInactive(subCategory));
    const fallbackSubCategory = firstActiveSubCategory || subCategories[0];
    return fallbackSubCategory ? String(fallbackSubCategory.id) : '';
};

const isAccountInactive = (account) => {
    if (!account) return false;
    if (typeof account.isActive === 'boolean') return !account.isActive;
    if (typeof account.status === 'string') return account.status.trim().toLowerCase() === 'inactive';
    if (typeof account.status === 'number') return account.status === 2;
    return false;
};

const isBranchInactive = (branch) => {
    if (!branch) return false;
    if (typeof branch.isActive === 'boolean') return !branch.isActive;
    if (typeof branch.status === 'string') {
        const normalizedStatus = branch.status.trim().toLowerCase();
        return normalizedStatus === 'inactive' || normalizedStatus === 'disabled';
    }
    if (typeof branch.status === 'number') return branch.status === 2;
    return false;
};

const CreateTransaction = ({ isOpen, onClose, transactionToEdit, onSuccess }) => {
    const navigate = useNavigate();
    const id = transactionToEdit?.id;
    const location = useLocation();
    const isEditMode = !!id;
    const { selectedBranch, branches } = useBranch();
    const { selectedYear } = useYear();
    const { selectedOrg } = useOrganization();

    const resolveDefaultGstRate = () => {
        return '18';
    };

    const stateOriginalBranchIds = (transactionToEdit?.originalBranchIds || []).map(Number).filter(Boolean);
    const stateSiblingMap = transactionToEdit?.siblingMap || {};
    const editingBranchIdFromState = Object.entries(stateSiblingMap).find(([, txnId]) => Number(txnId) === Number(id))?.[0];
    const activeBranches = branches.filter(branch => !isBranchInactive(branch));
    const activeBranchIds = activeBranches.map(branch => Number(branch.id));
    const hasExplicitSelectedBranch = selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi';
    const selectedBranchRecord = hasExplicitSelectedBranch
        ? branches.find(branch => Number(branch.id) === Number(selectedBranch.id))
        : null;
    const canUseSelectedBranchAsDefault = Boolean(hasExplicitSelectedBranch && !isBranchInactive(selectedBranchRecord || selectedBranch));

    const prioritizeBranchId = (branchIds = [], preferredBranchId) => {
        const normalizedIds = branchIds.map(Number).filter(Boolean);
        const uniqueIds = Array.from(new Set(normalizedIds));
        const normalizedPreferred = Number(preferredBranchId);

        if (!Number.isFinite(normalizedPreferred) || normalizedPreferred <= 0) {
            return uniqueIds;
        }

        if (!uniqueIds.includes(normalizedPreferred)) {
            return [normalizedPreferred, ...uniqueIds];
        }

        return [normalizedPreferred, ...uniqueIds.filter(branchId => branchId !== normalizedPreferred)];
    };

    // Target Branch state — user picks ONE branch this transaction belongs to
    const [targetBranchIds, setTargetBranchIds] = useState(() => {
        if (isEditMode) {
            if (stateOriginalBranchIds.length > 0) {
                return prioritizeBranchId(stateOriginalBranchIds, editingBranchIdFromState);
            }
            if (editingBranchIdFromState) {
                return [Number(editingBranchIdFromState)];
            }
            return [];
        }
        // Default to the currently selected branch, or first available
        if (canUseSelectedBranchAsDefault) {
            return [Number(selectedBranch.id)];
        }
        return activeBranches.length > 0 ? [Number(activeBranches[0].id)] : [];
    });
    const visibleBranches = isEditMode
        ? branches.filter(branch => !isBranchInactive(branch) || targetBranchIds.includes(Number(branch.id)))
        : activeBranches;

    const formRef = useRef(null);
    const scrollAreaRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "unset";
            };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isEditMode) return;

        setTargetBranchIds(prev => {
            const normalizedPrev = prev.map(Number).filter(id => activeBranchIds.includes(id));
            if (normalizedPrev.length > 0) return [normalizedPrev[0]];
            if (canUseSelectedBranchAsDefault) return [Number(selectedBranch.id)];
            if (activeBranchIds.length > 0) return [activeBranchIds[0]];
            return [];
        });
    }, [isEditMode, canUseSelectedBranchAsDefault, selectedBranch?.id, activeBranchIds.join(',')]);

    const [initialData, setInitialData] = useState(null); // State to hold initial transaction data for edit mode

    // This referenceId will be used to fetch dependencies (accounts, categories, parties)
    // It should be a single branch ID, typically the first selected one, or the currently active branch
    // if not in multi-select mode.
    const referenceBranchId = (() => {
        if (targetBranchIds.length > 0) return Number(targetBranchIds[0]);
        if (isEditMode && editingBranchIdFromState) return Number(editingBranchIdFromState);
        if (isEditMode && initialData?.branchId) return Number(initialData.branchId);
        if (canUseSelectedBranchAsDefault) return Number(selectedBranch.id);
        return null;
    })();

    const [txnTypes, setTxnTypes] = useState([]);

    const initialBranch = branches.find(b => Number(b.id) === referenceBranchId) || selectedBranchRecord || selectedBranch;
    const transactionBranchCurrency = initialBranch?.currencyCode || 'INR';
    const transactionCurrencyOptions = Array.from(new Set([
        transactionBranchCurrency,
        'INR',
        'USD',
        'EUR',
        'GBP'
    ].filter(Boolean)));

    const createEmptyFormData = (currencyCode = transactionBranchCurrency) => ({
        txnDate: new Date().toISOString().split('T')[0],
        txnTypeId: 2,
        name: '',
        accountId: '',
        attachmentPath: '',
        categoryId: '',
        subCategoryId: '',
        amountLocal: '',
        contact: '',
        contactId: '',
        notes: '',
        status: 1,
        currencyCode,
        fxRate: '1',
        fromAccountId: '',
        toAccountId: '',
        isTaxable: false,
        gstType: 1,
        gstRate: resolveDefaultGstRate(),
    });

    const [formData, setFormData] = useState(() => createEmptyFormData());

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
        && formData.currencyCode === transactionBranchCurrency;

    const sanitizeDecimalInput = (value) => {
        let sanitized = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
        const firstDot = sanitized.indexOf('.');
        if (firstDot !== -1) {
            sanitized = `${sanitized.slice(0, firstDot + 1)}${sanitized.slice(firstDot + 1).replace(/\./g, '')}`;
        }
        return sanitized;
    };

    const resolveTransactionCurrencyCode = (txn, fallbackCurrency) =>
        txn?.currencyCode || txn?.currency?.code || fallbackCurrency;

    const handleAmountLocalChange = (e) => {
        setFormData(prev => ({ ...prev, amountLocal: sanitizeDecimalInput(e.target.value) }));
    };

    const getBranchCurrencyCode = (branchId) =>
        branches.find(branch => Number(branch.id) === Number(branchId))?.currencyCode || '';

    const handleCurrencyCodeChange = (currencyCode) => {
        setFormData(prev => ({
            ...prev,
            currencyCode,
            fxRate: '1'
        }));
    };

    const normalizedTransactionCurrencyCode = String(formData.currencyCode || '').trim().toUpperCase();
    const normalizedTransactionBranchCurrency = String(transactionBranchCurrency || '').trim().toUpperCase();
    const isForeignCurrencyTransaction = Boolean(
        normalizedTransactionCurrencyCode &&
        normalizedTransactionBranchCurrency &&
        normalizedTransactionCurrencyCode !== normalizedTransactionBranchCurrency
    );

    const formatExchangeRateText = () => {
        if (!isForeignCurrencyTransaction) return '';
        if (fxLoading) {
            return `Fetching exchange rate for ${normalizedTransactionCurrencyCode}...`;
        }

        const parsedRate = Number(formData.fxRate || 1);
        const safeRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 1;
        return `Exchange rate: 1 ${normalizedTransactionCurrencyCode} = ${safeRate.toLocaleString('en-IN', {
            minimumFractionDigits: safeRate % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 6
        })} ${normalizedTransactionBranchCurrency}`;
    };

    const renderForeignExchangeHelper = () => {
        if (!isForeignCurrencyTransaction) return null;

        return (
            <p className="text-[11px] font-semibold text-emerald-600/90">
                {formatExchangeRateText()}
            </p>
        );
    };

    const handleTargetBranchChange = (branchId) => {
        const nextBranchId = Number(branchId);
        const nextBranchCurrency = String(getBranchCurrencyCode(nextBranchId) || '').toUpperCase();
        const previousBranchCurrency = String(transactionBranchCurrency || '').toUpperCase();

        setTargetBranchIds([nextBranchId]);
        setFormData(prev => {
            const currentCurrency = String(prev.currencyCode || '').toUpperCase();
            const shouldFollowBranchCurrency = !currentCurrency || currentCurrency === previousBranchCurrency;

            if ((shouldFollowBranchCurrency || currentCurrency === nextBranchCurrency) && nextBranchCurrency) {
                return {
                    ...prev,
                    currencyCode: nextBranchCurrency,
                    fxRate: '1'
                };
            }

            return {
                ...prev,
                fxRate: '1'
            };
        });
    };




    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [parties, setParties] = useState([]);
    const [attachment, setAttachment] = useState(null);
    const [fullScreenAttachment, setFullScreenAttachment] = useState({ isOpen: false, path: null });

    const [loading, setLoading] = useState(false);
    const [fxLoading, setFxLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [errors, setErrors] = useState({});

    const previousTransactionBranchCurrencyRef = useRef(transactionBranchCurrency);

    // Keep the form aligned with the branch chosen inside the transaction form,
    // not the dashboard-level branch selector.
    useEffect(() => {
        const previousBranchCurrency = previousTransactionBranchCurrencyRef.current;
        const nextBranchCurrency = transactionBranchCurrency;

        setFormData(prev => {
            const currentCurrency = prev.currencyCode || '';
            const shouldFollowBranchCurrency = !currentCurrency || currentCurrency === previousBranchCurrency;

            if (!shouldFollowBranchCurrency) {
                return prev;
            }

            if (currentCurrency === nextBranchCurrency && prev.fxRate === '1') {
                return prev;
            }

            return {
                ...prev,
                currencyCode: nextBranchCurrency,
                fxRate: '1'
            };
        });

        previousTransactionBranchCurrencyRef.current = nextBranchCurrency;
    }, [transactionBranchCurrency]);

    useEffect(() => {
        if (isEditMode) return;

        setInitialData(null);
        setAttachment(null);
        setFullScreenAttachment({ isOpen: false, path: null });
        setFormData(createEmptyFormData(transactionBranchCurrency));
    }, [isEditMode, id]);

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

                // Keep same-name categories separate when they belong to different transaction types.
                const uniqueCatsMap = new Map();
                categoriesList.forEach(c => {
                    const catNameKey = (c.name || '').toLowerCase().trim();
                    const catTypeKey = (c.txnType || c.transactionType?.name || c.type || '').toLowerCase().trim();
                    const categoryIdentityKey = `${catNameKey}::${catTypeKey}`;
                    if (!uniqueCatsMap.has(categoryIdentityKey)) {
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
                        uniqueCatsMap.set(categoryIdentityKey, newCat);
                    }
                });
                const uniqueCategoriesList = Array.from(uniqueCatsMap.values());
                setCategories(uniqueCategoriesList);

                const partiesList = Array.isArray(partyRes) ? partyRes : (partyRes?.data || []);
                const uniquePartiesMap = new Map();
                partiesList.forEach(p => {
                    // Parties are organization-wide; use ID to ensure all distinct parties are shown.
                    if (!uniquePartiesMap.has(p.id)) uniquePartiesMap.set(p.id, { ...p });
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
                        name: txn.name || '',
                        accountId: accountId ? String(accountId) : '',
                        categoryId: categoryId ? String(categoryId) : '',
                        subCategoryId: txn.subCategoryId ? String(txn.subCategoryId) : '',
                        amountLocal: txn.amountLocal || txn.amountBase,

                        contact: txn.contact || txn.counterpartyName || '',
                        contactId: txn.contactId ? String(txn.contactId) : '',
                        notes: txn.notes || '',
                        status: Number(txn.status) === 1 ? 1 : 0,
                        currencyCode: resolveTransactionCurrencyCode(txn, transactionBranchCurrency),
                        fxRate: txn.fxRate || '1',
                        attachmentPath: txn.attachmentPath,
                        fromAccountId: fromAccountId ? String(fromAccountId) : '',
                        toAccountId: toAccountId ? String(toAccountId) : '',

                        // GST fields
                        isTaxable: txn.isTaxable === true || txn.isTaxable === 1,
                        gstType: txn.gstType != null ? Number(txn.gstType) : 1,
                        gstRate: txn.gstRate != null ? String(txn.gstRate) : resolveDefaultGstRate(),
                    });
                    if (txn.attachmentPath) {
                        setAttachment(txn.attachmentPath);
                    } else {
                        setAttachment(null);
                    }
                    setTargetBranchIds(
                        stateOriginalBranchIds.length > 0
                            ? prioritizeBranchId(stateOriginalBranchIds, txn.branchId)
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
    }, [id, isEditMode, editingBranchIdFromState]);

    const effectiveDefaultGstRate = resolveDefaultGstRate();

    // Smart GST Engine (Auto-set default GST values without branch-specific tax fields)
    const prevBranchGstRateRef = useRef(effectiveDefaultGstRate);
    const prevIsTaxableRef = useRef(formData.isTaxable);
    const hasInitializedEditRef = useRef(false);

    useEffect(() => {
        // Prevent overwriting data on initial edit load
        if (isEditMode && !hasInitializedEditRef.current) {
            if (initialData) hasInitializedEditRef.current = true;
            prevBranchGstRateRef.current = effectiveDefaultGstRate;
            prevIsTaxableRef.current = formData.isTaxable;
            return;
        }

        if (!isGstEligible || !formData.isTaxable) {
            prevBranchGstRateRef.current = effectiveDefaultGstRate;
            prevIsTaxableRef.current = formData.isTaxable;
            return;
        }

        // Only trigger auto-calc when the GST defaults become relevant.
        const branchGstRateChanged = prevBranchGstRateRef.current !== effectiveDefaultGstRate;
        const becameTaxable = !prevIsTaxableRef.current && formData.isTaxable;

        if (branchGstRateChanged || becameTaxable) {
            const determinedRate = effectiveDefaultGstRate;

            setFormData(prev => ({
                ...prev,
                gstType: prev.gstType ?? 1,
                gstRate: determinedRate
            }));
        }

        prevBranchGstRateRef.current = effectiveDefaultGstRate;
        prevIsTaxableRef.current = formData.isTaxable;

    }, [effectiveDefaultGstRate, formData.isTaxable, isGstEligible, isEditMode, initialData]);

    // GST Auto-Calculation
    useEffect(() => {
        if (!formData.isTaxable || !isGstEligible) {
            const base = parseFloat(formData.amountLocal) || 0;
            setGstCalc({ cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0, finalAmount: base });
            return;
        }
        const base = parseFloat(formData.amountLocal) || 0;
        const rate = parseFloat(formData.gstRate) || 0;
        if (Number(formData.gstType) === 1) {
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
        let isActive = true;
        const requiresConversion = isForeignCurrencyTransaction;

        setFormData(prev => (
            prev.fxRate === '1'
                ? prev
                : { ...prev, fxRate: '1' }
        ));

        const fetchRate = async () => {
            if (!requiresConversion) {
                return;
            }

            if (isActive) {
                setFxLoading(true);
            }

            try {
                const response = await apiService.exchangeRates.get(normalizedTransactionCurrencyCode, normalizedTransactionBranchCurrency);
                const fetchedRate = Number(response?.data?.rate);

                if (isActive) {
                    setFormData(prev => ({
                        ...prev,
                        fxRate: Number.isFinite(fetchedRate) && fetchedRate > 0 ? String(fetchedRate) : '1'
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch exchange rate:", error);
                if (isActive) {
                    setFormData(prev => ({ ...prev, fxRate: '1' }));
                }
            } finally {
                if (isActive) {
                    setFxLoading(false);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            fetchRate();
        }, 500);

        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [isForeignCurrencyTransaction, normalizedTransactionCurrencyCode, normalizedTransactionBranchCurrency]);


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
                    contactId: formData.contactId || undefined,
                    accountId: formData.accountId || null,
                    categoryId: formData.categoryId || null,
                    subCategoryId: formData.subCategoryId || null,
                    fromAccountId: formData.fromAccountId || null,
                    toAccountId: formData.toAccountId || null,
                    branchId: bId,
                    financialYearId: selectedYear.id,
                    txnTypeId: Number(formData.txnTypeId),
                    fxRate: String(
                        String(formData.currencyCode || '').toUpperCase() === String(getBranchCurrencyCode(bId) || '').toUpperCase()
                            ? 1
                            : (formData.fxRate || '1')
                    ),
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
                    if (isNewFile || typeof attachment === 'string') {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined && key !== 'attachmentPath') {
                                formDataObj.append(key, payload[key]);
                            }
                        });
                        if (payload.subCategoryId === null) formDataObj.append('subCategoryId', '');
                        if (isNewFile) {
                            formDataObj.append('attachments', attachment);
                        } else if (typeof attachment === 'string') {
                            formDataObj.append('attachmentPath', attachment);
                        }
                        await apiService.transactions.update(txnIdToUpdate, formDataObj);
                    } else {
                        await apiService.transactions.update(txnIdToUpdate, payload);
                    }
                } else if (isEditMode) {
                    // CREATE in a newly added branch
                    if (isNewFile || typeof attachment === 'string') {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined && key !== 'attachmentPath') {
                                formDataObj.append(key, payload[key]);
                            }
                        });
                        if (payload.subCategoryId === null) formDataObj.append('subCategoryId', '');
                        if (isNewFile) {
                            formDataObj.append('attachments', attachment);
                        } else if (typeof attachment === 'string') {
                            formDataObj.append('attachmentPath', attachment);
                        }
                        await apiService.transactions.create(formDataObj);
                    } else {
                        await apiService.transactions.create(payload);
                    }
                } else {
                    // Pure CREATE mode
                    if (isNewFile) {
                        const formDataObj = new FormData();
                        Object.keys(payload).forEach(key => {
                            if (payload[key] !== null && payload[key] !== undefined && key !== 'attachmentPath') {
                                formDataObj.append(key, payload[key]);
                            }
                        });
                        if (payload.subCategoryId === null) formDataObj.append('subCategoryId', '');
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

            notifyTransactionDataChanged();
            setShowSuccess(true);
            setTimeout(() => {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
            }, 1000);

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
    const getCategoryPoolForType = (typeId) => {
        const normalizedTypeId = Number(typeId);
        const typeName = txnTypes.find((type) => type.id === normalizedTypeId)?.name?.toLowerCase();

        if (normalizedTypeId === 1 || typeName === 'income') return incomeCategories;
        if (normalizedTypeId === 2 || typeName === 'expense') return expenseCategories;
        if (normalizedTypeId === 3 || typeName === 'investment') return investmentCategories;
        return [];
    };

    const selectedCategoryObj = categories.find(c => c.id === Number(formData.categoryId));
    const currentSubcategories = selectedCategoryObj?.subCategories || [];

    const handleTypeChange = (typeId) => {
        const categoryPool = getCategoryPoolForType(typeId);
        const defaultCategory = getDefaultCategory(categoryPool);

        setFormData(prev => ({
            ...prev,
            txnTypeId: Number(typeId),
            accountId: '',
            categoryId: defaultCategory ? String(defaultCategory.id) : '',
            subCategoryId: defaultCategory ? getDefaultSubCategoryId(defaultCategory) : '',
            fromAccountId: '',
            toAccountId: '',
            // Reset tax when switching to non-eligible type
            isTaxable: [1, 2].includes(Number(typeId)) ? prev.isTaxable : false,
        }));
    };

    useEffect(() => {
        const categoryPool = getCategoryPoolForType(formData.txnTypeId);
        const defaultCategory = getDefaultCategory(categoryPool);

        if (!defaultCategory) return;
        if (!formData.categoryId) {
            setFormData((prev) => ({
                ...prev,
                categoryId: String(defaultCategory.id),
                subCategoryId: getDefaultSubCategoryId(defaultCategory)
            }));
            return;
        }

        const selectedCategory = categoryPool.find(
            (category) => String(category.id) === String(formData.categoryId)
        );

        if (!selectedCategory) {
            setFormData((prev) => ({
                ...prev,
                categoryId: String(defaultCategory.id),
                subCategoryId: getDefaultSubCategoryId(defaultCategory)
            }));
        }
    }, [categories, txnTypes, formData.txnTypeId, formData.categoryId]);

    useEffect(() => {
        if (!formData.categoryId) {
            if (formData.subCategoryId) {
                setFormData((prev) => ({ ...prev, subCategoryId: '' }));
            }
            return;
        }
        if (categories.length === 0) return;
        if (!selectedCategoryObj) {
            if (formData.subCategoryId) {
                setFormData((prev) => ({ ...prev, subCategoryId: '' }));
            }
            return;
        }

        const defaultSubCategoryId = getDefaultSubCategoryId(selectedCategoryObj);

        if (!formData.subCategoryId) return;

        const isCurrentSubcategoryValid = currentSubcategories.some(
            (subCategory) => String(subCategory.id) === String(formData.subCategoryId)
        );

        if (!isCurrentSubcategoryValid) {
            setFormData((prev) => ({ ...prev, subCategoryId: defaultSubCategoryId || '' }));
        }
    }, [categories.length, formData.categoryId, selectedCategoryObj, currentSubcategories, formData.subCategoryId]);

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

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] transition-opacity"
                onClick={onClose}
            />

            {/* Drawer Container */}
            <div className="fixed inset-y-0 right-0 z-[120] w-[480px] max-w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 text-slate-600 shadow-sm shadow-[#4A8AF4]/5">
                            <ArrowRightLeft size={14} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold text-slate-800 leading-tight">
                                {isEditMode ? "Edit Transaction" : "New Transaction"}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide">
                                {isEditMode ? "Update the details of your transaction" : "Create a new accounting entry"}
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

                <form ref={formRef} noValidate onSubmit={handleSubmit} onKeyDown={handleFormKeyNavigation} className="flex-1 flex flex-col min-h-0">
                    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar bg-white">
                        <div className="flex flex-col gap-3">


                                {/* Branch selector */}
                                {visibleBranches.length > 1 && (
                                    <div className="space-y-1 w-full">
                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                            Branch <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={targetBranchIds[0] ?? ''}
                                            onChange={(e) => handleTargetBranchChange(e.target.value)}
                                            className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.targetBranchIds ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                        >
                                            {visibleBranches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </CustomSelect>
                                        {errors.targetBranchIds && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.targetBranchIds}</p>}
                                    </div>
                                )}

                                {/* Row 1: Type & Party */}
                                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                    <div className="space-y-1 w-full">
                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                            Transaction Type <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={formData.txnTypeId ?? ""}
                                            onChange={(e) => handleTypeChange(Number(e.target.value))}
                                            className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all capitalize", errors.txnTypeId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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
                                        <div className="space-y-1 w-full">
                                            <label className="text-[11px] font-bold text-slate-600 block capitalize">Party</label>
                                            <CustomSelect
                                                value={formData.contactId ?? ""}
                                                onChange={(e) => {
                                                    const selectedId = e.target.value;
                                                    const party = parties.find(p => String(p.id) === String(selectedId));
                                                    setFormData({
                                                        ...formData,
                                                        contactId: selectedId,
                                                        contact: party ? party.companyName : ''
                                                    });
                                                }}
                                                className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.contact ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                            >
                                                <option value="">Select Party</option>
                                                {/* If current contact label exists but ID is missing (fallback), show it */}
                                                {!formData.contactId && formData.contact && (
                                                    <option value="" disabled>{formData.contact}</option>
                                                )}
                                                {parties.map(p => {
                                                    const inactive = isPartyInactive(p);
                                                    return (
                                                        <option key={p.id} value={p.id} disabled={inactive}>
                                                            {p.companyName}{inactive ? ' (Inactive)' : ''}
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
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Amount <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <CustomSelect
                                                        value={formData.currencyCode ?? ""}
                                                        onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                                        className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                    >
                                                        {transactionCurrencyOptions.map(c => (
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
                                                        className="flex-1 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {renderForeignExchangeHelper()}
                                                {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1 relative z-[60]">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    From Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.fromAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.fromAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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
                                            <div className="space-y-1 relative z-[50]">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    To Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.toAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.toAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    From Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.accountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.accountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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

                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Investment Account <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.toAccountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.toAccountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Investment Category <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.categoryId ?? ""}
                                                    onChange={(e) => {
                                                        const categoryId = e.target.value;
                                                        const selectedCategory = investmentCategories.find((category) => String(category.id) === String(categoryId));
                                                        setFormData({
                                                            ...formData,
                                                            categoryId,
                                                            subCategoryId: getDefaultSubCategoryId(selectedCategory)
                                                        });
                                                    }}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.categoryId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                >
                                                    {investmentCategories.length === 0 && <option value="">Select Category</option>}
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

                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Amount <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <CustomSelect
                                                        value={formData.currencyCode ?? ""}
                                                        onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                                        className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                    >
                                                        {transactionCurrencyOptions.map(c => (
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
                                                        className={cn("flex-1 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {renderForeignExchangeHelper()}
                                                {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    // Income / Expense
                                    <>
                                        {/* Row 2: Date & Account */}
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    data-nav-field="true"
                                                    required
                                                    value={formData.txnDate}
                                                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.txnDate ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                />
                                                {errors.txnDate && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.txnDate}</p>}
                                            </div>

                                            {/* Payment Wrapper */}
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    {Number(formData.txnTypeId) === 1 ? 'Deposit To' : 'Paid From'} <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    required
                                                    value={formData.accountId ?? ""}
                                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.accountId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
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
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                            {/* Always show Category First */}
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                    {Number(formData.txnTypeId) === 1 ? 'Income Category' : 'Expense Category'} <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    value={formData.categoryId ?? ""}
                                                    onChange={(e) => {
                                                        const categoryId = e.target.value;
                                                        const categoryPool = Number(formData.txnTypeId) === 1 ? incomeCategories : expenseCategories;
                                                        const selectedCategory = categoryPool.find((category) => String(category.id) === String(categoryId));
                                                        setFormData({
                                                            ...formData,
                                                            categoryId,
                                                            subCategoryId: getDefaultSubCategoryId(selectedCategory)
                                                        });
                                                    }}
                                                    className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.categoryId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                    required
                                                >
                                                    {(Number(formData.txnTypeId) === 1 ? incomeCategories : expenseCategories).length === 0 && <option value="">Select Category</option>}
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
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                        Sub-Category
                                                    </label>
                                                    <CustomSelect
                                                        value={formData.subCategoryId ?? ""}
                                                        onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                                    >
                                                        <option value="">No Sub-Category</option>
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
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                        Amount <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                            <CustomSelect
                                                            value={formData.currencyCode ?? ""}
                                                            onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                                            className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                        >
                                                            {transactionCurrencyOptions.map(c => (
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
                                                            className={cn("flex-1 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                                </div>
                                            )}
                                        </div>

                                        {/* If Sub-category exists, place Amount below */}
                                        {currentSubcategories.length > 0 && (
                                            <div className="">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600 block capitalize">
                                                        Amount <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="flex gap-2">
                                                            <CustomSelect
                                                            value={formData.currencyCode ?? ""}
                                                            onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                                            className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                        >
                                                            {transactionCurrencyOptions.map(c => (
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
                                                            className={cn("flex-1 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.amountLocal ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                                {errors.amountLocal && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.amountLocal}</p>}
                                            </div>
                                        )}

                                        {/* ── GST Section ── */}
                                        <div className="flex items-center justify-between gap-4 mt-4">
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
                                            {renderForeignExchangeHelper()}
                                        </div>

                                        {/* GST Fields — only when Taxable */}
                                        {formData.isTaxable && (
                                            <>
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                                    {/* GST Type */}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                                            GST Type <span className="text-rose-500">*</span>
                                                        </label>
                                                        <CustomSelect
                                                            value={formData.gstType ?? ""}
                                                            onChange={(e) => setFormData({ ...formData, gstType: e.target.value })}
                                                            className={cn("w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", errors.gstType ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100")}
                                                        >
                                                            <option value={1}>Intra-State (CGST + SGST)</option>
                                                            <option value={0}>Inter-State (IGST)</option>
                                                        </CustomSelect>
                                                        {errors.gstType && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1">{errors.gstType}</p>}
                                                    </div>

                                                    {/* GST Rate */}
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                                            GST Rate (%) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <GstRateDropdown
                                                            value={formData.gstRate}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, gstRate: e.target.value }))}
                                                            orgId={selectedOrg?.id}
                                                            branchId={referenceBranchId}
                                                            error={!!errors.gstRate}
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



                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 block capitalize">Notes</label>
                                    <textarea
                                        rows="2"
                                        data-nav-field="true"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all resize-none"
                                        placeholder="Add notes..."
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-[11px] font-bold text-slate-600 block capitalize">Attachment (Invoice/Receipt)</label>
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
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setFullScreenAttachment({ isOpen: true, path: attachment });
                                                                }}
                                                                className="hover:underline flex items-center gap-1 text-left"
                                                            >
                                                                {fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName}
                                                            </button>
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
                        </div>
                
                    {/* Drawer Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[13px] font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Save size={16} strokeWidth={2.5} />
                            <span>{loading ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Success Popup */}
            {showSuccess && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {isEditMode ? "Transaction Updated" : "Transaction Created"}
                        </h3>
                        <p className="text-gray-500 text-center text-sm">Closing...</p>
                    </div>
                </div>
            )}

            {/* Full Screen Attachment Viewer */}
            {fullScreenAttachment.isOpen && fullScreenAttachment.path && createPortal(
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
                    onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white">
                            <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">Attachment</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!fullScreenAttachment.path) return;
                                        void downloadAttachmentFile(fullScreenAttachment.path);
                                    }}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Download size={14} strokeWidth={2.5} />
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest">Download</span>
                                </button>
                                <button
                                    onClick={() => setFullScreenAttachment({ isOpen: false, path: null })}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                    <X size={16} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex items-center justify-center">
                            {(() => {
                                const p = fullScreenAttachment.path;
                                const fullUrl = buildAttachmentUrl(p);
                                const isImage = p.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                if (isImage) {
                                    return <img src={fullUrl} alt="Attachment" className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-200 shadow-sm bg-white" />;
                                } else {
                                    return <iframe src={fullUrl} className="w-full h-[75vh] bg-white rounded-lg border border-slate-200 shadow-sm" />;
                                }
                            })()}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default CreateTransaction;
