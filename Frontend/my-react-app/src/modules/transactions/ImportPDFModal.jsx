import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';

const ImportPDFModal = ({ isOpen, onClose, onSuccess }) => {
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const fileInputRef = useRef(null);

    const [accounts, setAccounts] = useState([]);
    const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);

    const [file, setFile] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null); // { success, totalRows, insertedRows, errors }
    const [error, setError] = useState('');
    const [step, setStep] = useState('upload'); // 'upload', 'result'

    // Fetch accounts when modal opens
    useEffect(() => {
        if (!isOpen || !selectedBranch?.id || selectedBranch.id === 'all' || selectedBranch.id === 'multi') return;

        const controller = new AbortController();
        const fetchAccounts = async () => {
            setIsFetchingAccounts(true);
            try {
                const response = await apiService.accounts.getAll({
                    branchId: selectedBranch.id,
                    limit: 1000
                }, { signal: controller.signal });

                if (!controller.signal.aborted) {
                    setAccounts(response.data || []);
                }
            } catch (error) {
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
                console.error('Failed to fetch accounts in PDF modal:', error);
                if (!controller.signal.aborted) {
                    setAccounts([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsFetchingAccounts(false);
                }
            }
        };

        fetchAccounts();

        return () => controller.abort();
    }, [isOpen, selectedBranch?.id]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.pdf')) {
                setFile(selectedFile);
                setError('');
                setResult(null);
                setStep('upload');
            } else {
                setError('Please upload a valid PDF file');
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file.');
            return;
        }
        if (!selectedAccount) {
            setError('Please select an account.');
            return;
        }
        if (!selectedBranch?.id || selectedBranch.id === 'all' || selectedBranch.id === 'multi') {
            setError('Please select a single branch.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('accountId', selectedAccount);
        formData.append('branchId', selectedBranch.id);
        if (selectedYear?.id) {
            formData.append('financialYearId', selectedYear.id);
        }

        try {
            const response = await apiService.transactions.importPDF(formData);

            if (response.success || response.insertedRows > 0) {
                setResult(response);
                setStep('result');
                if (response.success && onSuccess) {
                    onSuccess();
                }
            } else {
                setResult(response);
                setStep('result');
            }
        } catch (err) {
            console.error("PDF Upload failed", err);
            if (err.response?.data?.errors) {
                setResult(err.response.data);
                setStep('result');
            } else {
                setError(err.response?.data?.message || err.message || 'Upload failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setSelectedAccount('');
        setResult(null);
        setStep('upload');
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Filter accounts for the selected branch
    const filteredAccounts = accounts?.filter(acc => acc.branchId === selectedBranch?.id) || [];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FileText size={20} className="text-red-600" />
                        Import Bank Statement (PDF)
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            {/* Account Selector */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Select Account <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedAccount}
                                    onChange={(e) => setSelectedAccount(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium text-gray-700 hover:border-gray-300 transition-all cursor-pointer"
                                >
                                    <option value="">Choose the account for this statement</option>
                                    {isFetchingAccounts ? (
                                        <option disabled>Loading accounts...</option>
                                    ) : (
                                        filteredAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} - {acc.accountNumber || 'No Number'}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1.5">
                                    All transactions in the PDF will be linked to this account
                                </p>
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Upload PDF Statement <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? 'border-red-500 bg-red-50/30' : 'border-gray-200 hover:border-red-400 hover:bg-gray-50'
                                        }`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const droppedFile = e.dataTransfer.files[0];
                                        if (droppedFile) {
                                            if (droppedFile.name.endsWith('.pdf')) {
                                                setFile(droppedFile);
                                                setError('');
                                            } else {
                                                setError('Invalid file type - PDF only');
                                            }
                                        }
                                    }}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {file ? (
                                        <div className="space-y-3">
                                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                                                <FileText size={24} />
                                            </div>
                                            <p className="font-medium text-gray-900">{file.name}</p>
                                            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                className="text-xs font-bold text-red-500 hover:text-red-600 mt-2"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                                                <Upload size={24} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-700">Click to upload or drag & drop</p>
                                                <p className="text-xs text-gray-500 mt-1">PDF bank statement files only</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">
                                    Currently supports SBI bank statements
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Result View */}
                    {step === 'result' && result && (
                        <div className="space-y-4">
                            {result.success ? (
                                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex flex-col items-center text-center space-y-2">
                                    <CheckCircle size={32} />
                                    <h4 className="font-bold text-lg">Import Successful!</h4>
                                    <p className="text-sm">
                                        Processed <b>{result.totalRows}</b> rows.<br />
                                        Successfully inserted <b>{result.insertedRows}</b> transactions.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
                                        <AlertCircle size={24} />
                                        <div>
                                            <h4 className="font-bold">Import Failed</h4>
                                            <p className="text-xs opacity-90">
                                                {result.message || 'Please correct the following errors and try again.'}
                                            </p>
                                        </div>
                                    </div>

                                    {result.errors && result.errors.length > 0 && (
                                        <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2">Row</th>
                                                        <th className="px-4 py-2">Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {result.errors.map((err, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50">
                                                            <td className="px-4 py-2 font-mono text-xs text-gray-500 w-16 text-center">{err.row}</td>
                                                            <td className="px-4 py-2 text-red-600">{err.message}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 transition-all">
                    {step === 'upload' && (
                        <>
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || !selectedAccount || isLoading}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gray-200 active:scale-95 transition-all"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isLoading ? 'Importing...' : 'Import from PDF'}
                            </button>
                        </>
                    )}

                    {step === 'result' && (
                        <button
                            onClick={() => { if (result.success) onClose(); else reset(); }}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black text-white hover:bg-gray-800 flex items-center gap-2 shadow-lg shadow-gray-200 active:scale-95 transition-all"
                        >
                            {result.success ? 'Done' : 'Try Again'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportPDFModal;
