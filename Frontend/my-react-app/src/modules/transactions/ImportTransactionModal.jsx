import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';

const ImportTransactionModal = ({ isOpen, onClose, onSuccess }) => {
    const { selectedBranch, branches } = useBranch();
    const { selectedYear } = useYear();

    // Target Branch state
    const [targetBranchIds, setTargetBranchIds] = useState(() => {
        if (selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') return [Number(selectedBranch.id)];
        return [];
    });
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keep target branches in sync with current scope so upload never starts with an empty selection.
    React.useEffect(() => {
        if (!isOpen) return;

        if (selectedBranch?.id && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') {
            setTargetBranchIds([Number(selectedBranch.id)]);
            return;
        }

        const allIds = (branches || []).map((b) => Number(b.id)).filter(Boolean);
        if (allIds.length > 0) {
            setTargetBranchIds((prev) => (prev.length > 0 ? prev : allIds));
        }
    }, [isOpen, selectedBranch?.id, branches]);
    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null); // { success, totalRows, insertedRows, errors, missingData }
    const [error, setError] = useState('');
    const [step, setStep] = useState('upload'); // 'upload', 'confirm_missing', 'confirm_final', 'result'
    const [missingData, setMissingData] = useState(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile);
                setError('');
                setResult(null);
                setStep('upload');
            } else {
                setError('Please upload a valid Excel file (.xlsx, .xls)');
            }
        }
    };

    const handleUpload = async (autoGenerate = false) => {
        if (!file) {
            setError('Please select a file.');
            return;
        }
        if (targetBranchIds.length === 0) {
            setError('Please select at least one target branch.');
            return;
        }

        setIsLoading(true);
        setError('');
        if (!autoGenerate) setResult(null);

        try {
            let lastResponse = null;
            for (const bId of targetBranchIds) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('branchId', String(bId));
                if (autoGenerate) {
                    formData.append('autoGenerate', 'true');
                }
                if (selectedYear?.id) {
                    formData.append('financialYearId', selectedYear.id);
                }

                const response = await apiService.transactions.import(formData);
                lastResponse = response;

                if (response.missingData) {
                    setMissingData(response.missingData);
                    setStep('confirm_missing');
                    // Stop loop if missing data encountered to let user confirm
                    setIsLoading(false);
                    return;
                }
            }

            if (lastResponse.success || lastResponse.insertedRows > 0) {
                setResult(lastResponse);
                setStep('result');
                if (lastResponse.success && onSuccess) {
                    onSuccess();
                }
            } else {
                setResult(lastResponse);
                setStep('result');
            }
        } catch (err) {
            console.error("Upload failed", err);
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
        setResult(null);
        setMissingData(null);
        setStep('upload');
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const renderMissingList = () => {
        if (!missingData) return null;
        return (
            <div className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Missing Entities Detected
                    </h4>
                    <p className="text-sm text-orange-700 mt-1">
                        The following items were found in your Excel sheet but don't exist in the system. Would you like to auto-create them?
                    </p>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {missingData.accounts?.length > 0 && (
                        <div className="space-y-2">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Missing Accounts</h5>
                            {missingData.accounts.map((acc, i) => (
                                <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center">
                                    <span className="font-medium text-gray-700">{acc.name}</span>
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase font-bold">{acc.accountType}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {missingData.categories?.length > 0 && (
                        <div className="space-y-2">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Missing Categories</h5>
                            {missingData.categories.map((cat, i) => (
                                <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center">
                                    <span className="font-medium text-gray-700">{cat.name}</span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase font-bold">{cat.typeName}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {missingData.subCategories?.length > 0 && (
                        <div className="space-y-2">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Missing Sub-Categories</h5>
                            {missingData.subCategories.map((sc, i) => (
                                <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center">
                                    <span className="font-medium text-gray-700">{sc.name}</span>
                                    <span className="text-[10px] text-gray-400">Under: {sc.categoryName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        {step === 'confirm_missing' || step === 'confirm_final' ? (
                            <AlertCircle size={20} className="text-orange-500" />
                        ) : (
                            <FileSpreadsheet size={20} className="text-emerald-600" />
                        )}
                        {step === 'confirm_missing' ? 'Auto-Generate Entities?' : step === 'confirm_final' ? 'Final Confirmation' : 'Import Transactions'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Branch Selection Dropdown (Only if multiple branches selected globally) */}
                    {(selectedBranch?.id === 'all' || selectedBranch?.id === 'multi') && step === 'upload' && (
                        <div className="space-y-1.5 relative" ref={branchDropdownRef}>
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Branch</label>

                            <button
                                type="button"
                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                className={cn(
                                    "w-full px-4 py-2.5 bg-gray-50 border text-left rounded-xl text-[14px] font-bold outline-none transition-all flex items-center justify-between",
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
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (targetBranchIds.length === branches?.length) {
                                                    setTargetBranchIds([]);
                                                } else {
                                                    setTargetBranchIds(branches.map((b) => Number(b.id)).filter(Boolean));
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
                                            const branchId = Number(b.id);
                                            const isSelected = targetBranchIds.includes(branchId);
                                            return (
                                                <button
                                                    key={branchId}
                                                    type="button"
                                                    onClick={() => {
                                                        setTargetBranchIds(prev =>
                                                            isSelected
                                                                ? prev.filter(id => id !== branchId)
                                                                : [...prev, branchId]
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
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 hover:border-emerald-400 hover:bg-gray-50'
                                }`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const droppedFile = e.dataTransfer.files[0];
                                if (droppedFile) {
                                    if (droppedFile.name.endsWith('.xlsx')) {
                                        setFile(droppedFile);
                                        setError('');
                                    } else {
                                        setError('Invalid file type');
                                    }
                                }
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {file ? (
                                <div className="space-y-3">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <p className="font-medium text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); reset(); }}
                                        className="text-xs font-bold text-red-500 hover:text-red-600 mt-2"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                        <Upload size={24} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-700">Click to upload or drag & drop</p>
                                        <p className="text-xs text-gray-500 mt-1">Excel files (.xlsx) only</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Confirmation of Missing Entities */}
                    {step === 'confirm_missing' && renderMissingList()}

                    {/* Step 3: Final Confirmation */}
                    {step === 'confirm_final' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                                <AlertCircle size={32} />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xl font-bold text-gray-900">Are you absolutely sure?</h4>
                                <p className="text-gray-500">
                                    This will create new accounts and categories in your database. This action cannot be undone automatically.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Result View */}
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
                                            <p className="text-xs opacity-90">Please correct the following errors and try again.</p>
                                        </div>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2">Row</th>
                                                    <th className="px-4 py-2">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {result.errors?.map((err, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-2 font-mono text-xs text-gray-500 w-16 text-center">{err.row}</td>
                                                        <td className="px-4 py-2 text-red-600">{err.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
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
                                onClick={() => handleUpload(false)}
                                disabled={!file || isLoading}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gray-200 active:scale-95 transition-all"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isLoading ? 'Importing...' : 'Upload & Import'}
                            </button>
                        </>
                    )}

                    {step === 'confirm_missing' && (
                        <>
                            <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Start Over</button>
                            <button
                                onClick={() => setStep('confirm_final')}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-100 active:scale-95 transition-all"
                            >
                                Yes, Create & Continue
                            </button>
                        </>
                    )}

                    {step === 'confirm_final' && (
                        <>
                            <button onClick={() => setStep('confirm_missing')} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Back</button>
                            <button
                                onClick={() => handleUpload(true)}
                                disabled={isLoading}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-100 active:scale-95 transition-all flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                {isLoading ? 'Creating...' : 'Confirm & Create'}
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

export default ImportTransactionModal;
