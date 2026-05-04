import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Save, Trash2, FileText, List, Info } from 'lucide-react';
import { Loader } from '../../components/common/Loader';
import CustomSelect from '../../components/common/CustomSelect';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { useOrganization } from '../../context/OrganizationContext';
import CreateAccount from '../accounts/components/CreateAccount';
import GstRateDropdown from './components/GstRateDropdown';
import { Landmark } from 'lucide-react';

const ImportReviewModal = ({ isOpen, onClose, parsedData, onSuccess, file }) => {
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const { currentOrganization } = useOrganization();

    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [parties, setParties] = useState([]);
    const [txnTypes, setTxnTypes] = useState([]);

    const [selectedAccount, setSelectedAccount] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [focusedTransactionId, setFocusedTransactionId] = useState(null);
    const [activeRightTab, setActiveRightTab] = useState('edit'); // 'edit' | 'pdf' | 'add-account'

    const targetAccountObj = React.useMemo(() => {
        return selectedAccount ? accounts.find(a => String(a.id) === String(selectedAccount)) : null;
    }, [selectedAccount, accounts]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Auto-clear branch assignment error if fixed
    useEffect(() => {
        const finalBranchId = targetAccountObj?.branchId || targetAccountObj?.branch_id || (selectedBranch?.id !== 'all' ? selectedBranch?.id : null);
        if (finalBranchId && error?.includes('does not have a branch assigned')) {
            setError('');
        }
    }, [targetAccountObj, selectedBranch, error]);

    // Create PDF Blob URL
    useEffect(() => {
        if (file && (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf'))) {
            const url = URL.createObjectURL(file);
            setPdfUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    // Initialize transactions from parsed data
    useEffect(() => {
        if (parsedData?.transactions) {
            const mapped = parsedData.transactions.map((txn, index) => ({
                _id: index,
                selected: true,
                date: txn.date ? new Date(txn.date).toISOString().split('T')[0] : '',
                description: txn.narration || '',
                type: txn.deposit > 0 ? 'Income' : 'Expense',
                amount: txn.deposit > 0 ? txn.deposit : txn.withdrawal,
                accountId: '',
                categoryId: '',
                contactId: '',
                status: 'posted'
            }));
            setTransactions(mapped);
            if (mapped.length > 0) setFocusedTransactionId(mapped[0]._id);
        }
    }, [parsedData]);

    // Fetch Dependencies
    const fetchDependencies = React.useCallback(async () => {
        if (isOpen && selectedBranch?.id) {
            try {
                const [accRes, catRes, partyRes, typesRes] = await Promise.all([
                    apiService.accounts.getAll({ branchId: selectedBranch.id }).catch(() => null),
                    apiService.categories.getAll({ branchId: selectedBranch.id }).catch(() => null),
                    apiService.parties.getAll({ branchId: selectedBranch.id }).catch(() => null),
                    apiService.get('/transactions/types').catch(() => null)
                ]);
                
                if (accRes?.success) setAccounts(accRes.data || []);
                if (catRes?.success) {
                    const cats = [];
                    (catRes.data || []).forEach(c => {
                        cats.push(c);
                        if (c.subCategories) {
                            c.subCategories.forEach(sc => cats.push({ ...sc, name: `${c.name} - ${sc.name}` }));
                        }
                    });
                    setCategories(cats);
                }
                if (partyRes?.success) setParties(partyRes.data || []);
                if (typesRes?.success) setTxnTypes(typesRes.data || []);
            } catch (error) {
                console.error('Failed to fetch dependencies:', error);
            }
        }
    }, [isOpen, selectedBranch?.id]);

    useEffect(() => {
        fetchDependencies();
    }, [fetchDependencies]);

    if (!isOpen) return null;

    const filteredAccounts = accounts?.filter(acc => !acc.branchId || acc.branchId === selectedBranch?.id || acc.accountType === 1) || [];
    
    // Header Stats Computation
    const activeAccountObj = filteredAccounts.find(a => String(a.id) === String(selectedAccount));
    const openingBalance = activeAccountObj ? Number(activeAccountObj.closingBalance || 0) : 0;
    
    const totalCredit = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalDebit = transactions.filter(t => t.type !== 'Income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const closingBalance = openingBalance + totalCredit - totalDebit;

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const handleRemove = (id) => {
        setTransactions(prev => prev.filter(t => t._id !== id));
        if (focusedTransactionId === id) setFocusedTransactionId(null);
    };

    const handleFieldChange = (id, field, value) => {
        setTransactions(prev => prev.map(t => t._id === id ? { ...t, [field]: value } : t));
    };

    const handleCommit = async () => {
        if (!selectedAccount) {
            setError('Please select a global target account for these transactions.');
            return;
        }

        const finalBranchId = targetAccountObj?.branchId || targetAccountObj?.branch_id || (selectedBranch?.id !== 'all' ? selectedBranch?.id : null);

        if (!finalBranchId) {
            setActiveRightTab('add-account');
            setError('The selected bank account does not have a branch assigned. Please assign a branch to continue.');
            return;
        }

        if (transactions.length === 0) {
            setError('There are no transactions to import.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const rows = transactions.map(t => ({
                date: t.date,
                type: t.type,
                amount: t.amount,
                notes: t.description,
                account_id: t.accountId || selectedAccount,
                category_id: t.categoryId,
                contact_id: t.contactId,
                branch_id: finalBranchId
            }));

            const payload = {
                rows,
                accountId: selectedAccount,
                branchId: finalBranchId,
                financialYearId: selectedYear?.id
            };

            const response = await apiService.transactions.importJson(payload);

            if (response.success || response.insertedRows > 0) {
                setResult(response);
                if (response.success && onSuccess) {
                    onSuccess();
                }
            } else {
                setResult(response);
            }
        } catch (err) {
            console.error('Import commit failed', err);
            const data = err.response?.data;
            
            // If the backend returns our structured error object with row errors
            if (data && data.errors && Array.isArray(data.errors) && data.totalRows !== undefined) {
                setResult(data);
                return;
            }
            
            // If it's an Elysia schema validation error
            if (data && data.summary) {
                setError(data.summary);
                return;
            }
            
            setError(data?.message || err.message || 'Import failed');
        } finally {
            setIsLoading(false);
        }
    };

    const focusedTxn = transactions.find(t => t._id === focusedTransactionId);

    const StatBox = ({ label, value, colorClass = "text-slate-800" }) => (
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>
            <span className={`text-sm font-black ${colorClass}`}>{formatCurrency(value)}</span>
        </div>
    );

    const calculateGst = (amount, isTaxable, isInclusive, gstType, gstRate) => {
        if (!isTaxable || !amount || !gstRate) {
            return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0, finalAmount: amount || 0, calculatedBase: amount || 0 };
        }
        
        const parsedAmount = parseFloat(amount) || 0;
        const rate = parseFloat(gstRate) || 0;
        
        let baseAmount = parsedAmount;
        let gstTotal = 0;
        let finalAmount = parsedAmount;
        
        if (isInclusive) {
            baseAmount = parsedAmount / (1 + rate / 100);
            gstTotal = parsedAmount - baseAmount;
            finalAmount = parsedAmount;
        } else {
            gstTotal = baseAmount * (rate / 100);
            finalAmount = baseAmount + gstTotal;
        }
        
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        
        if (Number(gstType === undefined ? 1 : gstType) === 1) { // INTRA
            cgstAmount = gstTotal / 2;
            sgstAmount = gstTotal / 2;
        } else { // INTER
            igstAmount = gstTotal;
        }
        
        return { cgstAmount, sgstAmount, igstAmount, gstTotal, finalAmount, calculatedBase: baseAmount };
    };

    const gstCalc = focusedTxn ? calculateGst(focusedTxn.amount, focusedTxn.isTaxable, focusedTxn.isGstInclusive, focusedTxn.gstType, focusedTxn.gstRate) : null;

    const customSelectClasses = "w-full px-3 h-[36px] bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all flex items-center justify-between";

    return createPortal(
        <>
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[110] animate-fade-in" onClick={onClose}></div>

            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-scale-in transition-all duration-300 ease-in-out h-[90vh] w-[98vw] max-w-[1800px]">
                {/* Global Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white gap-4 flex-none">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#4A8AF4]/10 text-[#4A8AF4] flex items-center justify-center shrink-0">
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Review Bank Statement</h2>
                            <p className="text-[11px] font-medium text-slate-500">
                                {file?.name || 'Parsed Statement'} • {transactions.length} records
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-56 text-left">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Global Target Account <span className="text-rose-500">*</span></label>
                            <CustomSelect
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                isSearchable={true}
                                placeholder="Select an account..."
                                className="w-full px-3 h-[32px] bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-800 shadow-sm outline-none transition-all flex items-center justify-between hover:bg-slate-100"
                                dropdownClassName="z-[150]"
                            >
                                <option value="">Select an account...</option>
                                {filteredAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} - {acc.accountNumber || 'No Num'}</option>
                                ))}
                            </CustomSelect>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors self-start mt-3.5">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex bg-slate-50">
                    {result ? (
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="max-w-md w-full">
                                {result.success ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500 shadow-sm border border-emerald-100">
                                            <CheckCircle size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Import Successful</h3>
                                        <p className="text-slate-600 font-medium">Successfully inserted {result.insertedRows} transactions into your ledger.</p>
                                        <button onClick={onClose} className="mt-6 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors">
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500 shadow-sm border border-rose-100">
                                            <AlertCircle size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Import Failed</h3>
                                        <p className="text-slate-600 font-medium mb-4">{result.message || 'There was a problem importing your transactions.'}</p>
                                        
                                        {result.errors && result.errors.length > 0 && (
                                            <div className="text-left bg-white border border-rose-100 rounded-lg p-3 max-h-40 overflow-y-auto text-xs text-rose-600">
                                                {result.errors.map((err, i) => (
                                                    <div key={i} className="mb-1">Row {err.row}: {err.message}</div>
                                                ))}
                                            </div>
                                        )}

                                        <button onClick={() => setResult(null)} className="mt-6 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors">
                                            Back to Review
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Panel: Table */}
                            <div className={`${activeRightTab === 'pdf' ? 'w-[50%]' : 'w-[70%]'} flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out`}>
                                <div className="flex-1 relative overflow-hidden">
                                    <div className="absolute inset-0 overflow-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Date</th>
                                                    <th className="px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Type</th>
                                                    <th className="px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                                    <th className="px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28 text-right">Amount</th>
                                                    <th className="px-3 py-2 border-b border-slate-200 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {transactions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="px-4 py-12 text-center text-slate-500 text-sm font-medium">No transactions found to review.</td>
                                                    </tr>
                                                ) : (
                                                    transactions.map((txn) => (
                                                        <tr 
                                                            key={txn._id} 
                                                            onClick={(e) => {
                                                                if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                                                                    setFocusedTransactionId(txn._id);
                                                                    setActiveRightTab('edit'); // Switch to edit tab if they click a row
                                                                }
                                                            }}
                                                            className={`cursor-pointer transition-colors ${focusedTransactionId === txn._id ? 'bg-[#4A8AF4]/5 shadow-[inset_3px_0_0_0_#4A8AF4]' : 'hover:bg-slate-50'}`}
                                                        >
                                                            <td className="px-3 py-2 text-xs font-medium text-slate-700">{txn.date}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${txn.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                    {txn.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-xs font-medium text-slate-800 truncate max-w-[180px] xl:max-w-[240px]">{txn.description}</td>
                                                            <td className="px-3 py-2 text-xs font-bold text-slate-800 text-right">{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <button 
                                                                    onClick={() => handleRemove(txn._id)}
                                                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                                                    title="Remove row"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Tabs & Form */}
                            <div className={`${activeRightTab === 'pdf' ? 'w-[50%]' : 'w-[30%]'} flex flex-col bg-slate-50 border-l border-slate-200 transition-all duration-300 ease-in-out`}>
                                <div className="flex gap-1 p-2 bg-white border-b border-slate-200 items-center">
                                    <button 
                                        onClick={() => setActiveRightTab('edit')} 
                                        className={`px-3 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${activeRightTab==='edit' ? 'text-slate-800 bg-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <List size={14} /> Edit
                                    </button>
                                    <button 
                                        onClick={() => setActiveRightTab('add-account')} 
                                        className={`px-3 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${activeRightTab==='add-account' ? 'text-slate-800 bg-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Landmark size={14} /> {targetAccountObj ? 'Edit Account' : 'Add Account'}
                                    </button>
                                    <button 
                                        onClick={() => setActiveRightTab('pdf')} 
                                        className={`px-4 py-1.5 rounded-full text-[13px] font-bold flex items-center gap-2 transition-all ml-auto border shadow-sm ${activeRightTab==='pdf' ? 'bg-[#4A8AF4] border-[#4A8AF4] text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                                    >
                                        <FileText size={14} className={activeRightTab === 'pdf' ? 'text-blue-100' : 'text-slate-400'} /> Original Statement
                                    </button>
                                </div>
                                
                                {error && (
                                    <div className="mx-5 mt-4 mb-0 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg flex items-start gap-2 text-xs font-semibold flex-none">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                                    </div>
                                )}
                                
                                <div className="flex-1 overflow-hidden relative">
                                    {activeRightTab === 'edit' ? (
                                        <div className="absolute inset-0 overflow-y-auto p-5 pt-4">

                                            {focusedTxn ? (
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                                    {/* Type */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">Transaction Type <span className="text-rose-500">*</span></label>
                                                        <CustomSelect 
                                                            value={focusedTxn.type} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'type', e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                            dropdownClassName="z-[130]"
                                                        >
                                                            {txnTypes.length > 0 ? (
                                                                txnTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)
                                                            ) : (
                                                                <>
                                                                    <option value="Income">Income</option>
                                                                    <option value="Expense">Expense</option>
                                                                    <option value="Transfer">Transfer</option>
                                                                    <option value="Investment">Investment</option>
                                                                </>
                                                            )}
                                                        </CustomSelect>
                                                    </div>

                                                    {/* Party */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">Party</label>
                                                        <CustomSelect 
                                                            value={focusedTxn.contactId} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'contactId', e.target.value)} 
                                                            isSearchable={true}
                                                            placeholder="Select Party..."
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                            dropdownClassName="z-[130]"
                                                        >
                                                            <option value="">Select Party...</option>
                                                            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </CustomSelect>
                                                    </div>

                                                    {/* Date */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">Date <span className="text-rose-500">*</span></label>
                                                        <input 
                                                            type="date" 
                                                            value={focusedTxn.date} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'date', e.target.value)} 
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                        />
                                                    </div>

                                                    {/* Target Account Override */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">{focusedTxn.type === 'Expense' ? 'Paid From' : 'Deposit To'} <span className="text-rose-500">*</span></label>
                                                        <CustomSelect 
                                                            value={focusedTxn.accountId} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'accountId', e.target.value)} 
                                                            isSearchable={true}
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                            dropdownClassName="z-[130]"
                                                        >
                                                            <option value="">Use Global Account</option>
                                                            {filteredAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </CustomSelect>
                                                    </div>

                                                    {/* Category */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">Category <span className="text-rose-500">*</span></label>
                                                        <CustomSelect 
                                                            value={focusedTxn.categoryId} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'categoryId', e.target.value)} 
                                                            isSearchable={true}
                                                            placeholder="Select Category..."
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                            dropdownClassName="z-[130]"
                                                        >
                                                            <option value="">Select Category...</option>
                                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </CustomSelect>
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="space-y-1 col-span-1">
                                                        <label className="text-[11px] font-bold text-slate-600 block">Amount <span className="text-rose-500">*</span></label>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={focusedTxn.amount} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'amount', e.target.value)} 
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-bold text-slate-800 text-right shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                                                        />
                                                    </div>


                                                    
                                                    {/* ── GST Section ── */}
                                                    <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={focusedTxn.isTaxable || false}
                                                                        onChange={(e) => handleFieldChange(focusedTxn._id, 'isTaxable', e.target.checked)}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#4A8AF4]/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4A8AF4]"></div>
                                                                </label>
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap leading-none">
                                                                    {focusedTxn.isTaxable ? 'Taxable' : 'Non-Taxable'}
                                                                </span>
                                                            </div>

                                                            {focusedTxn.isTaxable && (
                                                                <div className="flex items-center gap-2 pl-4 border-l border-gray-200 animate-in fade-in zoom-in-95 duration-200">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={focusedTxn.isGstInclusive || false}
                                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'isGstInclusive', e.target.checked)}
                                                                            className="sr-only peer"
                                                                        />
                                                                        <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#4A8AF4]/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#4A8AF4]"></div>
                                                                    </label>
                                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap leading-none" title="Reverse GST calculation from total amount">
                                                                        Inclusive GST
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {focusedTxn.isTaxable && (
                                                            <>
                                                                <div className="grid grid-cols-2 gap-x-5 gap-y-4 mt-4">
                                                                    {/* GST Type */}
                                                                    <div className="space-y-2">
                                                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                                                            Tax Regime <span className="text-rose-500">*</span>
                                                                        </label>
                                                                        <CustomSelect
                                                                            value={focusedTxn.gstType !== undefined ? focusedTxn.gstType : 1}
                                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'gstType', Number(e.target.value))}
                                                                            className="w-full h-[32px] px-3 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all flex items-center justify-between"
                                                                        >
                                                                            <option value={1}>Intra (CGST & SGST)</option>
                                                                            <option value={0}>Inter (IGST Only)</option>
                                                                        </CustomSelect>
                                                                    </div>

                                                                    {/* GST Rate */}
                                                                    <div className="space-y-2">
                                                                        <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                                                            GST Slabs <span className="text-rose-500">*</span>
                                                                        </label>
                                                                        <GstRateDropdown
                                                                            value={String(focusedTxn.gstRate || '')}
                                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'gstRate', e.target.value)}
                                                                            orgId={currentOrganization?.id}
                                                                            branchId={selectedBranch?.id}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* GST Calculation Summary */}
                                                                {(parseFloat(focusedTxn.amount) > 0) && (
                                                                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                                                                        <div className="px-2.5 py-1 border-b border-gray-200 flex items-center gap-2">
                                                                            <span className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">GST Breakdown</span>
                                                                        </div>
                                                                        <div className="px-2.5 py-1.5 space-y-1">
                                                                            {/* Taxable Amount */}
                                                                            <div className="flex items-center justify-between text-[12px]">
                                                                                <span className="text-gray-500 font-normal">Taxable Amount (Base)</span>
                                                                                <span className="font-medium text-gray-700">
                                                                                    INR {(focusedTxn.isGstInclusive && gstCalc.calculatedBase !== undefined ? gstCalc.calculatedBase : (parseFloat(focusedTxn.amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>

                                                                            {/* INTRA breakdown */}
                                                                            {Number(focusedTxn.gstType !== undefined ? focusedTxn.gstType : 1) === 1 ? (
                                                                                <>
                                                                                    <div className="flex items-center justify-between text-[12px]">
                                                                                        <span className="text-gray-500 font-normal">CGST ({(parseFloat(focusedTxn.gstRate || 0) / 2).toFixed(2)}%)</span>
                                                                                        <span className="font-medium text-gray-900">+ INR {gstCalc.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between text-[12px]">
                                                                                        <span className="text-gray-500 font-normal">SGST ({(parseFloat(focusedTxn.gstRate || 0) / 2).toFixed(2)}%)</span>
                                                                                        <span className="font-medium text-gray-900">+ INR {gstCalc.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <div className="flex items-center justify-between text-[12px]">
                                                                                    <span className="text-gray-500 font-normal">IGST ({parseFloat(focusedTxn.gstRate || 0).toFixed(2)}%)</span>
                                                                                    <span className="font-medium text-gray-900">+ INR {gstCalc.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            )}

                                                                            <div className="flex items-center justify-between text-[12px] pt-1 border-t border-gray-200 mt-1">
                                                                                <span className="text-gray-700 font-semibold">Total GST</span>
                                                                                <span className="font-medium text-gray-900">INR {gstCalc.gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
                                                                            <span className="text-slate-300 text-[11px] font-medium uppercase tracking-wider">Total Amount</span>
                                                                            <span className="text-white font-bold text-[12px]">INR {gstCalc.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Description */}
                                                    <div className="space-y-1 col-span-2 mt-4">
                                                        <label className="text-[11px] font-bold text-slate-600 block capitalize">Notes</label>
                                                        <textarea 
                                                            value={focusedTxn.description || ''} 
                                                            onChange={(e) => handleFieldChange(focusedTxn._id, 'description', e.target.value)} 
                                                            rows="2"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-medium text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all resize-none placeholder:text-slate-400 placeholder:font-normal"
                                                            placeholder="Internal memo or description..."
                                                        />
                                                    </div>

                                                    {/* Attachment */}
                                                    <div className="space-y-1 col-span-2 mt-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <label className="text-[11px] font-bold text-slate-600 block capitalize">Attachment (Invoice/Receipt)</label>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <input
                                                                    type="file"
                                                                    onChange={(e) => {
                                                                        if (e.target.files?.[0]) {
                                                                            handleFieldChange(focusedTxn._id, 'attachment', e.target.files[0]);
                                                                        }
                                                                    }}
                                                                    className="block w-full text-sm text-slate-500
                                                                    file:mr-4 file:py-2 file:px-4
                                                                    file:rounded-full file:border-0
                                                                    file:text-xs file:font-semibold
                                                                    file:bg-[#4A8AF4] file:text-white
                                                                    hover:file:bg-[#3b71ca] transition-colors
                                                                    "
                                                                />
                                                            </div>
                                                        </div>
                                                        {focusedTxn.attachment && (
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600 flex items-center gap-1 group relative">
                                                                    {focusedTxn.attachment.name.length > 20 ? focusedTxn.attachment.name.substring(0, 20) + '...' : focusedTxn.attachment.name}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleFieldChange(focusedTxn._id, 'attachment', null)}
                                                                        className="text-gray-400 hover:text-red-500 ml-1 transition-colors"
                                                                        title="Remove attachment"
                                                                    >
                                                                        <X size={12} strokeWidth={3} />
                                                                    </button>
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                                        <List size={28} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-500 text-center">No Transaction Selected</p>
                                                    <p className="text-xs font-medium text-slate-400 text-center mt-2 max-w-[200px]">Select a transaction from the list on the left to edit its details.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : activeRightTab === 'pdf' ? (
                                        <div className="absolute inset-0 bg-slate-50">
                                            {pdfUrl ? (
                                                <iframe src={`${pdfUrl}#navpanes=0&view=FitH`} className="w-full h-full border-none" title="PDF Preview" />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-slate-400 font-medium">
                                                    No PDF document is available for preview.
                                                </div>
                                            )}
                                        </div>
                                    ) : activeRightTab === 'add-account' ? (
                                        <div className="absolute inset-0 bg-white flex flex-col">
                                            <CreateAccount 
                                                isOpen={true} 
                                                onClose={() => {
                                                    setActiveRightTab('edit');
                                                }}
                                                isInline={true}
                                                accountToEdit={targetAccountObj}
                                                onSuccess={() => {
                                                    fetchDependencies();
                                                    setActiveRightTab('edit');
                                                }}
                                                initialData={!targetAccountObj ? {
                                                    accountType: "1", // ASSET
                                                    subtype: "12", // BANK
                                                    accountNumber: parsedData?.accountNumber || '',
                                                    bankName: parsedData?.bankName || '',
                                                    name: parsedData?.bankName ? `${parsedData.bankName} Account` : 'New Bank Account',
                                                    isActive: true
                                                } : undefined}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center flex-none">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    
                    {!result && (
                        <div className="flex-1 flex justify-center gap-12 border-x border-slate-100 mx-6 px-6">
                            <StatBox label="Opening Balance" value={openingBalance} />
                            <StatBox label="Total Credit" value={totalCredit} colorClass="text-emerald-500" />
                            <StatBox label="Total Debit" value={totalDebit} colorClass="text-rose-500" />
                            <StatBox label="Closing Balance" value={closingBalance} colorClass="text-[#4A8AF4]" />
                        </div>
                    )}

                    {!result && (
                        <div className="flex items-center gap-4">
                            <div className="text-right mr-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Records</span>
                                <span className="text-sm font-black text-slate-800">{transactions.length}</span>
                            </div>
                            <button
                                onClick={handleCommit}
                                disabled={isLoading || transactions.length === 0}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[#4A8AF4] hover:bg-[#3b76d6] text-white shadow-md shadow-[#4A8AF4]/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader className="h-4 w-4" /> : <Save size={16} />}
                                {isLoading ? 'Importing...' : 'Commit Transactions'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default ImportReviewModal;
