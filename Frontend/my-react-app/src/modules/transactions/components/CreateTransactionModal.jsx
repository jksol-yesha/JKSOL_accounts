import React, { useEffect, useState, useRef } from 'react';
import { X, Save, Calendar, DollarSign, Wallet, Check, ChevronDown } from 'lucide-react';
import CustomSelect from '../../../components/common/CustomSelect';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
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

const CreateTransactionModal = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { selectedBranch, branches } = useBranch();
    const { selectedYear } = useYear();

    // Target Branch state
    const [targetBranchIds, setTargetBranchIds] = useState(() => {
        if (initialData?.branchId) return [initialData.branchId];
        if (selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') return [Number(selectedBranch.id)];
        return branches.length > 0 ? [branches[0].id] : [];
    });
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [txnTypes, setTxnTypes] = useState([]);
    const [formData, setFormData] = useState({
        txnDate: new Date().toISOString().split('T')[0],
        txnTypeId: 2, // Default Expense
        name: '', // Transaction Name
        accountId: '', // For Income/Expense: Paid From / Deposit To (Asset/Liability)
        categoryId: '', // For Income/Expense: Expense Acc / Income Acc
        fromAccountId: '', // For Transfer: Account money is moved from
        toAccountId: '', // For Transfer: Account money is moved to
        amountLocal: '',
        contact: '',
        notes: '',
        status: 1, // Default Posted
        fxRate: '1'
    });
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [parties, setParties] = useState([]);
    const [attachment, setAttachment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fxLoading, setFxLoading] = useState(false);

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

    useEffect(() => {
        if (isOpen) {
            const loadData = async () => {
                // Dependency fetch moved to its own useEffect based on targetBranchId
                if (initialData) {
                    const formattedDate = initialData.txnDate ? new Date(initialData.txnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    const typeId = Number(initialData.txnTypeId || (initialData.transactionType?.id) || 2);

                    // Parse Entries to determine Account fields
                    let accountId = '';
                    let categoryId = '';
                    let fromAccountId = '';
                    let toAccountId = '';

                    // Try to use existing simple fields if available (legacy support)
                    // If backend refactor is live, we rely on ENTRIES
                    if (initialData.entries && initialData.entries.length > 0) {
                        const entries = initialData.entries;
                        const typeName = (initialData.txnType || initialData.transactionType?.name || '').toLowerCase(); // Assuming verified

                        if (typeName === 'expense' || typeId === 2) { // 2 = Expense
                            // Dr Expense (Category), Cr Asset (Account)
                            const exp = entries.find(e => e.debit > 0);
                            const asset = entries.find(e => e.credit > 0);
                            categoryId = exp?.accountId || '';
                            accountId = asset?.accountId || '';
                        } else if (typeName === 'income' || typeId === 1) { // 1 = Income
                            // Dr Asset (Account), Cr Income (Category)
                            const asset = entries.find(e => e.debit > 0);
                            const inc = entries.find(e => e.credit > 0);
                            accountId = asset?.accountId || '';
                            categoryId = inc?.accountId || '';
                        } else if (typeName === 'transfer' || typeId === 4) { // 4 = Transfer
                            // Dr ToAccount, Cr FromAccount
                            const to = entries.find(e => e.debit > 0);
                            const from = entries.find(e => e.credit > 0);
                            toAccountId = to?.accountId || '';
                            fromAccountId = from?.accountId || '';
                        }
                    } else {
                        // Fallback to legacy fields
                        accountId = initialData.accountId || '';
                        categoryId = initialData.categoryId || '';
                    }

                    setFormData({
                        txnDate: formattedDate,
                        txnTypeId: typeId,
                        name: initialData.name || '',
                        accountId,
                        categoryId,
                        fromAccountId,
                        toAccountId,
                        amountLocal: initialData.amountLocal || initialData.amountBase,
                        contact: initialData.contact || initialData.counterpartyName || '',
                        notes: initialData.notes || '',
                        status: Number(initialData.status) === 1 ? 1 : 0,
                        currencyCode: initialData.currencyCode || selectedBranch?.currencyCode || 'INR',
                        fxRate: initialData.fxRate || '1'
                    });
                    if (initialData.attachmentPath) setAttachment(initialData.attachmentPath);
                } else {
                    setFormData({
                        txnDate: new Date().toISOString().split('T')[0],
                        txnTypeId: 2,
                        name: '',
                        accountId: '',
                        categoryId: '',
                        fromAccountId: '',
                        toAccountId: '',
                        amountLocal: '',
                        contact: '',
                        notes: '',
                        status: 1,
                        fxRate: '1'
                    });
                    setAttachment(null);
                }
            };
            loadData();
        }
    }, [isOpen, selectedBranch, initialData]);

    // ... (Keep Fx Rate Effect same) ...
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

    useEffect(() => {
        if (isOpen && targetBranchIds.length > 0) {
            fetchDependencies();
        }
    }, [targetBranchIds[0], isOpen]);

    const fetchDependencies = async () => {
        try {
            const bId = targetBranchIds[0];
            if (!bId) return;
            // Fetch Types
            const typesRes = await apiService.get('/transactions/types');
            if (typesRes.success) {
                setTxnTypes(typesRes.data);
            }

            const [accRes, catRes, partyRes] = await Promise.all([
                apiService.accounts.getAll({ branchId: bId }).catch(() => null),
                apiService.categories.getAll({ branchId: bId }).catch(() => null),
                apiService.parties.getAll({ branchId: bId }).catch(() => null)
            ]);

            const accountsList = Array.isArray(accRes) ? accRes : (accRes?.data || []);
            setAccounts(Array.isArray(accountsList) ? accountsList : []);

            const categoriesList = Array.isArray(catRes) ? catRes : (catRes?.data || []);
            setCategories(Array.isArray(categoriesList) ? categoriesList : []);

            const partiesList = Array.isArray(partyRes) ? partyRes : (partyRes?.data || []);
            setParties(Array.isArray(partiesList) ? partiesList : []);
        } catch (error) {
            console.error("Failed to load dependencies", error);
        }
    };

    const handleTypeChange = (typeId) => {
        setFormData(prev => ({
            ...prev,
            txnTypeId: Number(typeId),
            // Reset accounts on type change to avoid confusion
            accountId: '',
            categoryId: '',
            fromAccountId: '',
            toAccountId: ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const targetIds = initialData ? [initialData.branchId || targetBranchIds[0]] : targetBranchIds;
            if (targetIds.length === 0) {
                alert("Please select at least one target branch.");
                setLoading(false);
                return;
            }
            const { txnTypeId } = formData;
            // Validate based on type
            // 2=Expense, 1=Income, 3=Transfer (Assuming IDs)
            // Use IDs directly or mapped names. Assuming standard IDs:
            // 1: Income, 2: Expense, 3: Transfer

            // Mapping Logic for Payload
            let finalAccountId = formData.accountId;
            let finalCategoryId = formData.categoryId;
            let finalFromId = formData.fromAccountId;
            let finalToId = formData.toAccountId;

            // Validation
            if (Number(txnTypeId) === 4) { // Transfer
                if (!finalFromId || !finalToId) {
                    alert("Please select both From and To accounts.");
                    setLoading(false); return;
                }
                if (finalFromId === finalToId) {
                    alert("From and To accounts cannot be the same.");
                    setLoading(false); return;
                }
            } else if (Number(txnTypeId) === 2) { // Expense
                if (!finalAccountId || !finalCategoryId) {
                    alert("Please select both Expense Category and Payment Account.");
                    setLoading(false); return;
                }
            } else if (Number(txnTypeId) === 3 || txnTypes.find(t => t.id === Number(txnTypeId))?.name?.toLowerCase() === 'investment') { // Investment
                if (!finalAccountId || !finalToId) { // From Account -> accountId, Investment Account -> toAccountId
                    alert("Please select both Payment Account and Investment Account.");
                    setLoading(false); return;
                }
            } else if (Number(txnTypeId) === 1) { // Income
                if (!finalAccountId || !finalCategoryId) {
                    alert("Please select both Income Category and Deposit Account.");
                    setLoading(false); return;
                }
            }

            for (const bId of targetIds) {
                const isTransferType = Number(formData.txnTypeId) === 4;
                const payload = {
                    ...formData,
                    name: isTransferType ? '' : (formData.contact || 'Transaction'),
                    accountId: finalAccountId,
                    categoryId: finalCategoryId,
                    subCategoryId: formData.subCategoryId || null,
                    fromAccountId: finalFromId,
                    toAccountId: finalToId,
                    branchId: bId,
                    financialYearId: selectedYear.id,
                    txnTypeId: Number(formData.txnTypeId)
                };

                // ... file handling inside loop or before ...
                // Actually if it's a file, we need to send it with each.

                const isNewFile = attachment && typeof attachment !== 'string';
                if (isNewFile || (initialData && attachment)) {
                    const formDataObj = new FormData();
                    Object.keys(payload).forEach(key => {
                        if (payload[key] !== null && payload[key] !== undefined && key !== 'attachmentPath') {
                            formDataObj.append(key, payload[key]);
                        }
                    });
                    if (isNewFile) {
                        formDataObj.append('attachments', attachment);
                    } else if (initialData && typeof attachment === 'string') {
                        formDataObj.append('attachmentPath', attachment);
                    }

                    if (initialData) {
                        await apiService.transactions.update(initialData.id, formDataObj);
                        break; // Only once for edit
                    } else {
                        await apiService.transactions.create(formDataObj);
                    }
                } else {
                    if (initialData) {
                        await apiService.transactions.update(initialData.id, payload);
                        break; // Only once for edit
                    } else {
                        await apiService.transactions.create(payload);
                    }
                }
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to save transaction:", error);
            alert("Failed to save transaction: " + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchTxnDetails = async () => {
            if (initialData?.id) {
                try {
                    const response = await apiService.transactions.getById(initialData.id);
                    if (response.success && response.data) {
                        const txn = response.data;
                        const typeId = txn.txnTypeId;

                        let accountId = '';
                        let categoryId = '';
                        let fromAccountId = '';
                        let toAccountId = '';

                        if (txn.entries && txn.entries.length > 0) {
                            const entries = txn.entries;
                            const typeName = (txn.txnType || txn.transactionType?.name || '').toLowerCase();

                            if (typeName === 'expense' || typeId === 2) {
                                const exp = entries.find(e => e.debit > 0);
                                const asset = entries.find(e => e.credit > 0);
                                categoryId = exp?.accountId || '';
                                accountId = asset?.accountId || '';
                            } else if (typeName === 'income' || typeId === 1) {
                                const asset = entries.find(e => e.debit > 0);
                                const inc = entries.find(e => e.credit > 0);
                                accountId = asset?.accountId || '';
                                categoryId = inc?.accountId || '';
                            } else if (typeName === 'transfer' || typeId === 3) {
                                const to = entries.find(e => e.debit > 0);
                                const from = entries.find(e => e.credit > 0);
                                toAccountId = to?.accountId || '';
                                fromAccountId = from?.accountId || '';
                            } else if (typeName === 'investment' || typeId === 3) {
                                // Dr InvestmentAcc (toAccountId), Cr FromAcc (accountId)
                                const to = entries.find(e => e.debit > 0);
                                const from = entries.find(e => e.credit > 0);
                                toAccountId = to?.accountId || '';
                                accountId = from?.accountId || '';
                            }
                        } else {
                            accountId = txn.accountId || '';
                            categoryId = txn.categoryId || '';
                            toAccountId = txn.toAccountId || '';
                        }

                        setFormData({
                            txnDate: txn.txnDate ? new Date(txn.txnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            txnTypeId: Number(txn.txnTypeId),
                            name: txn.name || '',
                            accountId,
                            categoryId,
                            fromAccountId,
                            toAccountId,
                            amountLocal: txn.amountLocal || txn.amountBase,
                            contact: txn.contact || txn.counterpartyName || '',
                            notes: txn.notes || '',
                            status: Number(txn.status) === 1 ? 1 : 0,
                            currencyCode: txn.currencyCode || selectedBranch?.currencyCode || 'INR',
                            fxRate: txn.fxRate || '1',
                            attachmentPath: txn.attachmentPath
                        });
                        if (txn.branchId) setTargetBranchIds([txn.branchId]);
                        if (txn.attachmentPath) setAttachment(txn.attachmentPath);
                    }
                } catch (error) {
                    console.error("Failed to fetch transaction details:", error);
                }
            }
        };
        if (isOpen && initialData) fetchTxnDetails();
    }, [isOpen, initialData, selectedBranch]);

    if (!isOpen) return null;

    // Helper options
    // Filter accounts by type for better UX
    // Filter accounts by type for better UX
    const assetAccounts = accounts.filter(a => Number(a.accountType) === 1);
    const transferAccounts = accounts;
    const investmentAccounts = accounts.filter(a => Number(a.accountType) === 1 && Number(a.subtype) === 14);

    const investmentTypeId = txnTypes.find(t => t.name?.toLowerCase() === 'investment')?.id;
    const incomeCategories = categories.filter(c => c.transactionType?.name?.toLowerCase() === 'income' || Number(c.txnTypeId) === 1);
    const expenseCategories = categories.filter(c => c.transactionType?.name?.toLowerCase() === 'expense' || Number(c.txnTypeId) === 2);
    const investmentCategories = categories.filter(c => c.transactionType?.name?.toLowerCase() === 'investment' || Number(c.txnTypeId) === (investmentTypeId || 3));

    const currentSubcategories = formData.categoryId
        ? categories.find(c => String(c.id) === String(formData.categoryId))?.subCategories || []
        : [];

    return createPortal(
        <div className={cn("fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md transition-opacity", isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
            <div className={cn("bg-white rounded-2xl shadow-xl w-full max-w-2xl transform transition-all duration-300 flex flex-col max-h-[90vh]", isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4")}>
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Transaction' : 'Record Transaction'}</h2>
                        <p className="text-sm text-gray-500 mt-1">{initialData ? 'Update transaction details' : 'Enter the details of the new transaction'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* Branch Selection Dropdown (Only if multiple branches selected globally or editing) */}
                    {(selectedBranch?.id === 'all' || selectedBranch?.id === 'multi' || initialData) && (
                        <div className="space-y-1.5 relative" ref={branchDropdownRef}>
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Branch</label>

                            {initialData ? (
                                /* Custom Dropdown for Edit Mode (Single Select) */
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                        className={cn(
                                            "w-full px-4 py-2 bg-gray-50 border text-left rounded-xl text-[14px] font-bold outline-none transition-all flex items-center justify-between",
                                            isBranchDropdownOpen ? "border-black bg-white" : "border-gray-100 text-slate-700"
                                        )}
                                    >
                                        <span className="truncate">
                                            {branches.find(b => b.id === Number(targetBranchIds[0]))?.name || 'Select branch'}
                                        </span>
                                        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isBranchDropdownOpen ? "rotate-180" : "")} />
                                    </button>

                                    {isBranchDropdownOpen && (
                                        <div className="absolute left-0 right-0 z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                {branches?.map(b => {
                                                    const isSelected = targetBranchIds.includes(b.id);
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTargetBranchIds([b.id]);
                                                                setIsBranchDropdownOpen(false);
                                                            }}
                                                            className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50 rounded-lg text-left transition-colors group"
                                                        >
                                                            <div className={cn(
                                                                "w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors flex-shrink-0",
                                                                isSelected ? "bg-black border-black text-white" : "border-gray-300 group-hover:border-gray-400"
                                                            )}>
                                                                {isSelected && <Check size={10} strokeWidth={4} />}
                                                            </div>
                                                            <span className={cn("truncate font-bold", isSelected ? "text-gray-900" : "text-gray-500")}>
                                                                {b.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Multi-select for Create Mode */
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                        className={cn(
                                            "w-full px-4 py-2 bg-gray-50 border text-left rounded-xl text-[14px] font-bold outline-none transition-all flex items-center justify-between",
                                            isBranchDropdownOpen ? "border-black bg-white" : "border-gray-100 text-slate-700"
                                        )}
                                    >
                                        <span className="truncate">
                                            {targetBranchIds.length === 0 ? 'Select branches' :
                                                targetBranchIds.length === branches?.length ? 'All Branches' :
                                                    `${targetBranchIds.length} branch${targetBranchIds.length > 1 ? 'es' : ''} selected`}
                                        </span>
                                        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isBranchDropdownOpen ? "rotate-180" : "")} />
                                    </button>

                                    {isBranchDropdownOpen && (
                                        <div className="absolute left-0 right-0 z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (targetBranchIds.length === branches?.length) {
                                                            setTargetBranchIds([]);
                                                        } else {
                                                            setTargetBranchIds(branches.map(b => b.id));
                                                        }
                                                    }}
                                                    className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50 rounded-lg text-left transition-colors mb-1 border-b border-gray-50 font-bold text-gray-700"
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors flex-shrink-0",
                                                        targetBranchIds.length === branches?.length ? "bg-black border-black text-white" : "border-gray-300"
                                                    )}>
                                                        {targetBranchIds.length === branches?.length && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                    All branch
                                                </button>

                                                {branches?.map(b => {
                                                    const isSelected = targetBranchIds.includes(b.id);
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTargetBranchIds(prev =>
                                                                    isSelected
                                                                        ? prev.filter(id => id !== b.id)
                                                                        : [...prev, b.id]
                                                                );
                                                            }}
                                                            className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50 rounded-lg text-left transition-colors group"
                                                        >
                                                            <div className={cn(
                                                                "w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors flex-shrink-0",
                                                                isSelected ? "bg-black border-black text-white" : "border-gray-300 group-hover:border-gray-400"
                                                            )}>
                                                                {isSelected && <Check size={10} strokeWidth={4} />}
                                                            </div>
                                                            <span className={cn("truncate font-bold", isSelected ? "text-gray-900" : "text-gray-500")}>
                                                                {b.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {/* Top Row: Type and Party */}
                    <div className="flex gap-4">
                        <div className="space-y-1.5 w-1/3">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Transaction Type</label>
                            <CustomSelect
                                value={formData.txnTypeId ?? ""}
                                onChange={(e) => handleTypeChange(Number(e.target.value))}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all capitalize"
                            >
                                {txnTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </CustomSelect>
                        </div>

                        <div className="space-y-1.5 flex-1">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Party</label>
                            <CustomSelect
                                value={formData.contact ?? ""}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                            >
                                <option value="">Select Party</option>
                                {parties.map(p => {
                                    const inactive = isPartyInactive(p);
                                    return (
                                        <option key={p.id} value={p.name} disabled={inactive}>
                                            {p.name}{inactive ? ' (Inactive)' : ''}
                                        </option>
                                    );
                                })}
                            </CustomSelect>
                        </div>
                    </div>

                    {/* Shared: Date and Amount Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Date</label>
                            <input
                                type="date"
                                required
                                value={formData.txnDate}
                                onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Amount</label>
                            <div className="flex gap-2">
                                <CustomSelect
                                    value={formData.currencyCode ?? ""}
                                    onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                                    className="w-24 px-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                >
                                    {[selectedBranch?.currencyCode, 'INR', 'USD', 'EUR', 'GBP'].filter(Boolean).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </CustomSelect>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    value={formData.amountLocal}
                                    onChange={handleAmountLocalChange}
                                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Foreign Exchange Logic */}
                    {formData.currencyCode && selectedBranch?.currencyCode && formData.currencyCode !== selectedBranch?.currencyCode && (
                        <div className="p-4 bg-amber-50 rounded-xl flex items-center justify-between gap-4 border border-amber-100">
                            <div className="text-sm font-medium text-amber-800">
                                <span className="block font-bold">Foreign Transaction Detected</span>
                                <span className="text-xs opacity-75">1 {formData.currencyCode} = ? {selectedBranch?.currencyCode}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                                    {fxLoading ? 'Fetching...' : 'Ex. Rate:'}
                                </label>
                                <input
                                    type="number"
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

                    {/* Dynamic Fields Section */}
                    {Number(formData.txnTypeId) === 4 ? (
                        /* Transfer UI */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">From Account</label>
                                <CustomSelect
                                    required
                                    value={formData.fromAccountId ?? ""}
                                    onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                >
                                    <option value="">Select Account</option>
                                    {transferAccounts.filter(a => a.id !== Number(formData.toAccountId)).map(a => {
                                        const inactive = isAccountInactive(a);
                                        return (
                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                {a.name} ({a.typeLabel || a.accountType}){inactive ? ' (Inactive)' : ''}
                                            </option>
                                        );
                                    })}
                                </CustomSelect>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">To Account</label>
                                <CustomSelect
                                    required
                                    value={formData.toAccountId ?? ""}
                                    onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                >
                                    <option value="">Select Account</option>
                                    {transferAccounts.filter(a => a.id !== Number(formData.fromAccountId)).map(a => {
                                        const inactive = isAccountInactive(a);
                                        return (
                                            <option key={a.id} value={a.id} disabled={inactive}>
                                                {a.name} ({a.typeLabel || a.accountType}){inactive ? ' (Inactive)' : ''}
                                            </option>
                                        );
                                    })}
                                </CustomSelect>
                            </div>
                        </div>
                    ) : Number(formData.txnTypeId) === (investmentTypeId || 3) || txnTypes.find(t => t.id === Number(formData.txnTypeId))?.name?.toLowerCase() === 'investment' ? (
                        /* Investment UI */
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">From Account (Paying Asset)</label>
                                    <CustomSelect
                                        required
                                        value={formData.accountId ?? ""}
                                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        <option value="">Select Account</option>
                                        {assetAccounts.map(a => {
                                            const inactive = isAccountInactive(a);
                                            return (
                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                    {a.name} ({a.typeLabel}){inactive ? ' (Inactive)' : ''}
                                                </option>
                                            );
                                        })}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Investment Account</label>
                                    <CustomSelect
                                        required
                                        value={formData.toAccountId ?? ""}
                                        onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        <option value="">Select Account</option>
                                        {investmentAccounts.map(a => {
                                            const inactive = isAccountInactive(a);
                                            return (
                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                    {a.name} ({a.typeLabel} - {a.subtypeLabel}){inactive ? ' (Inactive)' : ''}
                                                </option>
                                            );
                                        })}
                                    </CustomSelect>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Investment Category</label>
                                    <CustomSelect
                                        required
                                        value={formData.categoryId ?? ""}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        <option value="">Select Category</option>
                                        {investmentCategories.map(a => {
                                            const inactive = isCategoryInactive(a);
                                            return (
                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                    {a.name}{inactive ? ' (Inactive)' : ''}
                                                </option>
                                            );
                                        })}
                                    </CustomSelect>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Income / Expense UI */
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Category</label>
                                    <CustomSelect
                                        required
                                        value={formData.categoryId ?? ""}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        <option value="">Select Category</option>
                                        {(Number(formData.txnTypeId) === 1 ? incomeCategories : expenseCategories).map(cat => {
                                            const inactive = isCategoryInactive(cat);
                                            return (
                                                <option key={cat.id} value={cat.id} disabled={inactive}>
                                                    {cat.name}{inactive ? ' (Inactive)' : ''}
                                                </option>
                                            );
                                        })}
                                    </CustomSelect>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">
                                        {Number(formData.txnTypeId) === 1 ? 'Deposit To' : 'Paid From'}
                                    </label>
                                    <CustomSelect
                                        required
                                        value={formData.accountId ?? ""}
                                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                    >
                                        <option value="">Select Account</option>
                                        {(Number(formData.txnTypeId) === 1 ? accounts : assetAccounts).map(a => {
                                            const inactive = isAccountInactive(a);
                                            return (
                                                <option key={a.id} value={a.id} disabled={inactive}>
                                                    {a.name} ({a.typeLabel || a.accountType}){inactive ? ' (Inactive)' : ''}
                                                </option>
                                            );
                                        })}
                                    </CustomSelect>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentSubcategories.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Sub-Category</label>
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
                            )}
                                {currentSubcategories.length === 0 && <div className="hidden md:block" />}
                            </div>
                        </>
                    )}

                    {/* Shared Fields Area */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Notes / Description</label>
                        <textarea
                            rows="2"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all resize-none"
                            placeholder="Enter transaction details..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Attachments</label>
                        <input
                            type="file"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setAttachment(e.target.files[0]);
                                }
                            }}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                        />
                        {attachment && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(() => {
                                    const isUrl = typeof attachment === 'string';
                                    const fileName = isUrl ? attachment.split('/').pop() : attachment.name;
                                    return (
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600 flex items-center gap-1 group relative">
                                            {isUrl ? (
                                                <a href={`/api${attachment}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                    {fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName}
                                                </a>
                                            ) : (
                                                fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName
                                            )}
                                            <button type="button" onClick={() => setAttachment(null)} className="hover:text-red-500">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex space-x-3">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 text-[13px] font-extrabold py-3 rounded-xl hover:bg-gray-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 bg-black text-white text-[13px] font-extrabold py-3 rounded-xl shadow-lg active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-70">
                            <Save size={18} />
                            <span>{loading ? 'Saving...' : 'Save'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateTransactionModal;
