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
        return branches ? branches.map(b => Number(b.id)) : [];
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
    const [step, setStep] = useState('upload');
    const [missingData, setMissingData] = useState(null);

    const insertedRows = Number(result?.insertedRows || 0);
    const errorCount = Number(result?.errors?.length || 0);
    const isPartialResult = Boolean(result && (result.partialSuccess || (insertedRows > 0 && errorCount > 0)));
    const isSuccessfulResult = Boolean(result && result.success && insertedRows > 0 && errorCount === 0 && !isPartialResult);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile);
                setError('');
                setResult(null);
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

            if (lastResponse) {
                setResult(lastResponse);
                setStep('result');
                if ((Number(lastResponse.insertedRows) || 0) > 0 && onSuccess) {
                    onSuccess();
                }
            } else {
                setError('Import failed. No response was returned by the server.');
            }
        } catch (err) {
            console.error("Upload failed", err);
            if (err.response?.data) {
                setResult(err.response.data);
                setStep('result');
                if ((Number(err.response.data.insertedRows) || 0) > 0 && onSuccess) {
                    onSuccess();
                }
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
        const initialStep = 'upload';
        setStep(initialStep);
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
                                <FileSpreadsheet size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                    {step === 'confirm_missing' ? 'Auto-Generate Entities?' : step === 'confirm_final' ? 'Final Confirmation' : 'Import Transactions'}
                                </h2>
                                <p className="text-[10px] font-semibold text-slate-500">
                                    Excel Upload • Branch Mapping
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
                <div className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar bg-white flex flex-col gap-4">
                    {/* Step 1: Upload (Merged with Branch Selection) */}
                    {step === 'upload' && (() => {
                        const isAllSelected = branches?.length > 0 && branches.every(b => targetBranchIds.includes(Number(b.id)));
                        return (
                            <div className="flex flex-col gap-5">
                                {/* Component: Branch Selector */}
                                <div className="flex flex-col">
                                    <div className="mb-3">
                                        <label className="text-[11px] font-bold text-slate-600 block">Target Branch <span className="text-rose-500">*</span></label>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Where would you like to map these statements?</p>
                                    </div>
        
                                    <div className="flex flex-col overflow-hidden border border-slate-200 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-white">
                                        {/* Action Bar */}
                                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                            <button
                                                onClick={() => {
                                                    if (isAllSelected) {
                                                        setTargetBranchIds(branches.length > 0 ? [Number(branches[0].id)] : []);
                                                    } else {
                                                        setTargetBranchIds(branches.map(b => Number(b.id)));
                                                    }
                                                }}
                                                className={`group flex items-center gap-1.5 text-[11px] font-bold transition-colors ${isAllSelected ? 'text-[#2F5FC6]' : 'text-slate-500 hover:text-slate-800'} uppercase tracking-wider`}
                                            >
                                                <div className="w-4 flex justify-center shrink-0">
                                                    <Check 
                                                        size={14} 
                                                        className={`${isAllSelected ? 'text-[#4A8AF4]' : 'text-slate-200 group-hover:text-slate-300'} transition-colors`} 
                                                        strokeWidth={isAllSelected ? 3 : 2.5} 
                                                    />
                                                </div>
                                                Select All
                                            </button>
                                        </div>
                                        
                                        {/* Branch List */}
                                        <div className="flex flex-col max-h-[140px] overflow-y-auto no-scrollbar py-1">
                                            {branches?.map(b => {
                                                const branchId = Number(b.id);
                                                const isSelected = targetBranchIds.includes(branchId);
                                                const toggleBranch = (id) => {
                                                    setTargetBranchIds(prev => {
                                                        const exists = prev.includes(id);
                                                        const next = exists ? prev.filter(x => x !== id) : [...prev, id];
                                                        return next.length === 0 ? prev : next;
                                                    });
                                                };
                                                return (
                                                    <button
                                                        key={branchId}
                                                        onClick={() => toggleBranch(branchId)}
                                                        className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors group hover:bg-[#EEF0FC]"
                                                    >
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                            <div className="w-4 flex justify-center shrink-0">
                                                                {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                                <p className={`min-w-0 truncate tracking-tight text-[13px] ${isSelected ? 'font-bold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
                                                                    {b.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#4A8AF4]/70 shrink-0 ml-2">
                                                            {b.currencyCode || `ID: ${b.id}`}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Component: Upload */}
                                <div className="flex flex-col">
                                    <div className="mb-2">
                                        <label className="text-[11px] font-bold text-slate-600 block">Spreadsheet <span className="text-rose-500">*</span></label>
                                    </div>
                                    <div className="mt-1 text-center" onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const droppedFile = e.dataTransfer.files[0];
                                            if (droppedFile) {
                                                if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
                                                    setFile(droppedFile);
                                                    setError('');
                                                } else {
                                                    setError('Invalid file type');
                                                }
                                            }
                                        }}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {file ? (
                                    <div className="w-full relative border border-slate-200 shadow-sm rounded-lg p-5 bg-slate-50/50 group flex flex-col items-center justify-center">
                                       <div className="absolute top-2 right-2">
                                           <button onClick={(e) => { e.stopPropagation(); setFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 bg-white border border-slate-200 shadow-sm rounded-md text-rose-500 hover:bg-rose-50 transition-colors">
                                              <X size={12} strokeWidth={2.5}/>
                                           </button>
                                       </div>
                                       <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4] mb-3">
                                          <FileSpreadsheet size={18} strokeWidth={2.5} />
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
                                        <p className="text-[10px] font-bold text-slate-500 mt-1">Excel files (.xlsx, .xls) only</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                        );
                    })()}

                    {/* Step 2: Confirmation of Missing Entities */}
                    {step === 'confirm_missing' && renderMissingList()}

                    {/* Step 3: Final Confirmation */}
                    {step === 'confirm_final' && (
                        <div className="border border-rose-200 bg-rose-50 p-6 rounded-lg flex flex-col items-center text-center mt-4">
                            <div className="w-12 h-12 bg-white rounded-full border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 mb-3 block mx-auto">
                                <AlertCircle size={24} strokeWidth={2.5} />
                            </div>
                            <h4 className="text-[14px] font-extrabold text-slate-900 mb-1">Are you absolutely sure?</h4>
                            <p className="text-[11px] font-bold text-rose-700">
                                This will auto-create new missing accounts and categories in your database. This action cannot be undone automatically.
                            </p>
                        </div>
                    )}

                    {/* Step 4: Result View */}
                    {step === 'result' && result && (
                        <div className="flex flex-col gap-4">
                            {isSuccessfulResult ? (
                                <div className="border border-emerald-200 bg-emerald-50/50 p-6 rounded-lg flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-white rounded-full border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600 mb-3 block mx-auto">
                                        <CheckCircle size={24} strokeWidth={2.5} />
                                    </div>
                                    <h4 className="text-[14px] font-extrabold text-slate-900 mb-1">Import Successful!</h4>
                                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                                        Processed {result.totalRows} records. <br/>
                                        <span className="text-emerald-700">Inserted {result.insertedRows} transactions safely.</span>
                                    </p>
                                    {result.message ? (
                                        <p className="text-[10px] font-bold text-emerald-700 mt-2">{result.message}</p>
                                    ) : null}
                                </div>
                            ) : isPartialResult ? (
                                <div className="flex flex-col gap-3">
                                    <div className="border border-amber-200 bg-amber-50/50 p-4 rounded-lg flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white border border-amber-200 shadow-sm flex items-center justify-center text-amber-600 shrink-0">
                                            <AlertCircle size={16} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <h4 className="text-[12px] font-extrabold text-slate-900">Completed with Issues</h4>
                                            <p className="text-[11px] font-bold text-amber-700">
                                                {result.message || `Inserted ${result.insertedRows} out of ${result.totalRows} rows.`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 border border-emerald-200 bg-emerald-50 rounded-lg flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest mb-1">Inserted</span>
                                            <span className="text-[20px] font-black text-emerald-700">{result.insertedRows}</span>
                                        </div>
                                        <div className="p-3 border border-rose-200 bg-rose-50 rounded-lg flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest mb-1">Failed</span>
                                            <span className="text-[20px] font-black text-rose-700">{errorCount}</span>
                                        </div>
                                    </div>

                                    {errorCount > 0 && (
                                        <div className="border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Row Focus</span>
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Error Detail</span>
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
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-lg flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 shrink-0">
                                            <AlertCircle size={16} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <h4 className="text-[12px] font-extrabold text-slate-900">Import Failed</h4>
                                            <p className="text-[11px] font-bold text-rose-700">
                                                {result.message || 'The parser encountered critical formatting errors.'}
                                            </p>
                                        </div>
                                    </div>

                                    {result.totalRows ? (
                                        <div className="px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-[11px] font-bold text-slate-600 text-center">
                                            Processed {result.totalRows} rows. Inserted {result.insertedRows || 0} transactions.
                                        </div>
                                    ) : null}

                                    {errorCount > 0 && (
                                        <div className="border border-slate-200 shadow-sm rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Row Focus</span>
                                               <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Error Detail</span>
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
                        <div className="mt-2 border border-rose-200 bg-rose-50 p-2.5 rounded-lg flex items-center gap-2">
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
                                onClick={() => handleUpload(false)}
                                disabled={!file || isLoading || targetBranchIds.length === 0}
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-[#4A8AF4] hover:bg-[#3b76d6] text-white shadow-sm shadow-[#4A8AF4]/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} strokeWidth={2.5} />}
                                {isLoading ? 'Extracting...' : 'Start Import'}
                            </button>
                        </>
                    )}

                    {step === 'confirm_missing' && (
                        <>
                            <button 
                                type="button"
                                onClick={reset} 
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep('confirm_final')}
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-colors"
                            >
                                Map & Continue
                            </button>
                        </>
                    )}

                    {step === 'confirm_final' && (
                        <>
                            <button 
                                type="button"
                                onClick={() => setStep('confirm_missing')} 
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => handleUpload(true)}
                                disabled={isLoading}
                                className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} strokeWidth={2.5} />}
                                {isLoading ? 'Creating...' : 'Confirm'}
                            </button>
                        </>
                    )}

                    {step === 'result' && (
                        <button
                            type="button"
                            onClick={() => { if (insertedRows > 0) onClose(); else reset(); }}
                            className="px-5 py-1.5 rounded-md text-[13px] font-bold bg-[#4A8AF4] hover:bg-[#3b76d6] text-white shadow-sm shadow-[#4A8AF4]/20 transition-colors flex items-center gap-2"
                        >
                            {insertedRows > 0 ? <Check size={14} strokeWidth={2.5}/> : <AlertCircle size={14} strokeWidth={2.5}/>}
                            {insertedRows > 0 ? 'Finish Setup' : 'Try Again'}
                        </button>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default ImportTransactionModal;
