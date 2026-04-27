import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';
import { Loader } from '../../components/common/Loader';
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
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[110] animate-fade-in"
                onClick={onClose}
            ></div>

            {/* Sliding Drawer */}
            <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-[480px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col animate-slide-in-right overflow-hidden">
                {/* Drawer Header */}
                <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                <FileText size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                    Import Bank Statement
                                </h2>
                                <p className="text-[10px] font-semibold text-slate-500">
                                    PDF Extraction • Auto Mapping
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

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar bg-white">
                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="flex flex-col gap-3">
                            {/* Account Selector */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 block">
                                    Target Account <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedAccount}
                                    onChange={(e) => setSelectedAccount(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all cursor-pointer"
                                >
                                    <option value="">Select an account</option>
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
                                <p className="text-[10px] font-semibold text-slate-500 mt-1">
                                    All transactions will link to this ledger
                                </p>
                            </div>

                            {/* File Upload */}
                            <div className="mt-2 text-center" onDragOver={(e) => e.preventDefault()}
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
                                }}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {file ? (
                                    <div className="w-full relative border border-slate-200 shadow-sm rounded-lg p-5 bg-slate-50/50 group flex flex-col items-center justify-center">
                                       <div className="absolute top-2 right-2">
                                           <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 bg-white border border-slate-200 shadow-sm rounded-md text-rose-500 hover:bg-rose-50 transition-colors">
                                              <X size={12} strokeWidth={2.5}/>
                                           </button>
                                       </div>
                                       <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4] mb-3">
                                          <FileText size={18} strokeWidth={2.5} />
                                       </div>
                                       <p className="text-[13px] font-extrabold text-slate-900 truncate w-full px-4 text-center">{file.name}</p>
                                       <p className="text-[10px] font-bold text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={"w-full border-2 border-dashed border-slate-200 hover:border-[#4A8AF4] hover:bg-[#4A8AF4]/5 transition-all shadow-sm rounded-lg p-8 cursor-pointer flex flex-col items-center justify-center " + (error ? "border-rose-400 bg-rose-50/30" : "")}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 mb-3 group-hover:text-[#4A8AF4] transition-colors">
                                           <Upload size={18} strokeWidth={2.5} />
                                        </div>
                                        <p className="text-[13px] font-extrabold text-slate-900">Click to upload statement</p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1">or drag and drop PDF file here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Result View */}
                    {step === 'result' && result && (
                        <div className="flex flex-col gap-3">
                            {result.success ? (
                                <div className="border border-emerald-200 bg-emerald-50/50 p-6 rounded-lg flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-white rounded-full border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600 mb-3 block mx-auto">
                                        <CheckCircle size={24} strokeWidth={2.5} />
                                    </div>
                                    <h4 className="text-[14px] font-extrabold text-slate-900 mb-1">Import Successful!</h4>
                                    <p className="text-[11px] font-bold text-slate-600">
                                        Processed {result.totalRows} records. <br/>
                                        <span className="text-emerald-700">Inserted {result.insertedRows} transactions safely.</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-lg flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 shrink-0">
                                            <AlertCircle size={16} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <h4 className="text-[12px] font-extrabold text-slate-900">Extraction Failed</h4>
                                            <p className="text-[11px] font-bold text-slate-600">
                                                {result.message || 'The parser encountered critical formatting errors.'}
                                            </p>
                                        </div>
                                    </div>

                                    {result.errors && result.errors.length > 0 && (
                                        <div className="border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Row Focus</span>
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Detail</span>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto no-scrollbar bg-white">
                                                {result.errors.map((err, idx) => (
                                                    <div key={idx} className="flex px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                        <span className="text-[11px] font-bold text-slate-500 w-12 shrink-0">#{err.row}</span>
                                                        <span className="text-[11px] font-medium text-rose-600 truncate">{err.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 border border-rose-200 bg-rose-50/50 p-2.5 rounded-lg flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-white border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 shrink-0">
                                <AlertCircle size={12} strokeWidth={2.5} />
                           </div>
                           <span className="text-[11px] font-bold text-rose-700">{error}</span>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                    {step === 'upload' && (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || !selectedAccount || isLoading}
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-[#4A8AF4] hover:bg-[#3b76d6] text-white shadow-sm shadow-[#4A8AF4]/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader className="h-3.5 w-3.5 text-white" /> : <Upload size={14} strokeWidth={2.5} />}
                                {isLoading ? 'Extracting...' : 'Import Data'}
                            </button>
                        </>
                    )}

                    {step === 'result' && (
                        <button
                            type="button"
                            onClick={() => { if (result.success) onClose(); else reset(); }}
                            className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-[#4A8AF4] hover:bg-[#3b76d6] text-white shadow-sm shadow-[#4A8AF4]/20 transition-colors flex items-center gap-2"
                        >
                            {result.success ? <CheckCircle size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
                            {result.success ? 'Finish Setup' : 'Try Again'}
                        </button>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default ImportPDFModal;
