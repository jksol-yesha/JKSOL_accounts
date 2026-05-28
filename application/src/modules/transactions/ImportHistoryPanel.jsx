import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, History, FileText, Undo2, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { Loader } from '../../components/common/Loader';
import { usePreferences } from '../../context/PreferenceContext';
import { useToast } from '../../context/ToastContext';

const CLOSE_ANIMATION_MS = 280;

const ImportHistoryPanel = ({ isOpen, onClose, onRefresh }) => {
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const { formatDate } = usePreferences();
    const { showToast } = useToast();
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [revertDialog, setRevertDialog] = useState({ open: false, id: null, filename: '', count: 0, loading: false });

    // Animation state (same pattern as CreateAccount)
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef(null);

    useEffect(() => {
        let openTimer = null;

        if (isOpen) {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
            openTimer = setTimeout(() => {
                setShouldRender(true);
                setIsClosing(false);
            }, 0);
            return () => { if (openTimer) clearTimeout(openTimer); };
        }

        if (!shouldRender) return;

        openTimer = setTimeout(() => { setIsClosing(true); }, 0);

        closeTimerRef.current = setTimeout(() => {
            setShouldRender(false);
            setIsClosing(false);
            closeTimerRef.current = null;
        }, CLOSE_ANIMATION_MS);

        return () => {
            if (openTimer) clearTimeout(openTimer);
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, [isOpen, shouldRender]);

    useEffect(() => {
        return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
    }, []);

    const handleClose = useCallback(() => {
        if (isClosing) return;
        onClose();
    }, [onClose, isClosing]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, selectedBranch, selectedYear]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = {
                financialYearId: selectedYear?.id
            };
            if (selectedBranch?.id !== 'all' && selectedBranch?.id !== 'multi') {
                params.branchId = selectedBranch?.id;
            }
            
            const response = await apiService.transactions.getImports(params);
            if (response.success || response.data) {
                setHistory(response.data || response);
            }
        } catch (err) {
            console.error('Failed to fetch import history:', err);
            setError('Failed to load history.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevertClick = (item) => {
        setRevertDialog({
            open: true,
            id: item.id,
            filename: item.filename,
            count: item.transactionCount,
            loading: false
        });
    };

    const confirmRevert = async () => {
        if (!revertDialog.id) return;
        
        setRevertDialog(prev => ({ ...prev, loading: true }));
        try {
            await apiService.transactions.revertImport(revertDialog.id);
            await fetchHistory();
            if (onRefresh) onRefresh();
            setRevertDialog({ open: false, id: null, filename: '', count: 0, loading: false });
        } catch (err) {
            console.error('Failed to revert import:', err);
            showToast(err.response?.data?.message || err.message || 'Failed to revert import', 'error');
            setRevertDialog(prev => ({ ...prev, loading: false }));
        }
    };

    if (!shouldRender) return null;

    return (
        <div 
            className={`fixed inset-0 z-[100] flex justify-end bg-gray-900/40 backdrop-blur-sm ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={handleClose}
        >
            <div 
                className={`bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-gray-200 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
                onClick={(e) => e.stopPropagation()}
            >

                
                <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                <History size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">Import History</h2>
                                <p className="text-[10px] font-semibold text-slate-500">View and manage imported statements</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose}
                            className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader size="lg" />
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-500 py-10 flex flex-col items-center">
                            <AlertCircle size={32} className="mb-2 opacity-50" />
                            <p className="text-sm font-medium">{error}</p>
                            <button onClick={fetchHistory} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-gray-500 py-12 flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <History size={24} className="text-gray-300" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">No imports yet</h3>
                            <p className="text-xs max-w-[200px] mx-auto">Imported statements will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {history.map((item) => (
                                <div 
                                    key={item.id} 
                                    className={`border rounded-lg px-3 py-2 transition-all ${
                                        item.status === 1 ? 'border-gray-200 bg-white hover:border-blue-300' : 'border-gray-100 bg-gray-50/50 opacity-60'
                                    }`}
                                >
                                    {/* Row 1: Filename + badges + revert */}
                                    <div className="flex items-center gap-2">
                                        <FileText size={13} className={`shrink-0 ${item.status === 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                                        <h4 className={`text-[12px] font-semibold truncate flex-1 ${item.status === 1 ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                                            {item.filename}
                                        </h4>
                                        
                                        {/* Transaction count badge */}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                            item.status === 1 ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {item.transactionCount} txns
                                        </span>
                                        
                                        {/* Parser badge */}
                                        {item.parserType && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                item.parserType === 'OPENAI' 
                                                    ? 'bg-purple-50 text-purple-600' 
                                                    : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                                {item.parserType.replace('_DETERMINISTIC', '')}
                                            </span>
                                        )}
                                        
                                        {item.status === 0 && (
                                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                Reverted
                                            </span>
                                        )}
                                        
                                        {item.status === 1 && (
                                            <button 
                                                onClick={() => handleRevertClick(item)}
                                                className="shrink-0 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                title="Undo Import"
                                            >
                                                <Undo2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Row 2: Meta info */}
                                    <div className="flex items-center gap-1.5 ml-[21px] mt-0.5">
                                        <span className="text-[10px] text-gray-400">{formatDate(item.importedAt)}</span>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <span className="text-[10px] text-gray-400">{item.user?.name || 'Unknown'}</span>
                                        {item.duplicateCount > 0 && (
                                            <>
                                                <span className="text-[10px] text-gray-300">•</span>
                                                <span className="text-[9px] font-semibold text-amber-600">{item.duplicateCount} dup</span>
                                            </>
                                        )}
                                        {item.invalidCount > 0 && (
                                            <>
                                                <span className="text-[10px] text-gray-300">•</span>
                                                <span className="text-[9px] font-semibold text-red-500">{item.invalidCount} invalid</span>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Revert confirmation (inline) */}
                                    {revertDialog.id === item.id && (
                                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <AlertCircle size={12} className="text-rose-500 shrink-0" />
                                                <p className="text-[10px] text-rose-700 font-semibold truncate">
                                                    Delete {item.transactionCount} transactions?
                                                </p>
                                            </div>
                                            <button 
                                                disabled={revertDialog.loading}
                                                onClick={confirmRevert}
                                                className="text-[10px] font-bold py-1 px-2.5 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shrink-0"
                                            >
                                                {revertDialog.loading ? '...' : 'Revert'}
                                            </button>
                                            <button 
                                                disabled={revertDialog.loading}
                                                onClick={() => setRevertDialog({ open: false, id: null, filename: '', count: 0, loading: false })}
                                                className="text-[10px] font-bold py-1 px-2.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>


        </div>
    );
};

export default ImportHistoryPanel;
