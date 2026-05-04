import React, { useState, useEffect } from 'react';
import { X, History, FileText, Undo2, AlertCircle } from 'lucide-react';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { Loader } from '../../components/common/Loader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePreferences } from '../../context/PreferenceContext';

const ImportHistoryPanel = ({ isOpen, onClose, onRefresh }) => {
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const { formatDate } = usePreferences();
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [revertDialog, setRevertDialog] = useState({ open: false, id: null, filename: '', count: 0, loading: false });

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
            alert(err.response?.data?.message || err.message || 'Failed to revert import');
            setRevertDialog(prev => ({ ...prev, loading: false }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-sm transition-opacity">
            <div 
                className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-gray-200"
                style={{ animation: 'slideInRight 0.3s forwards' }}
            >
                <style>{`
                    @keyframes slideInRight {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                `}</style>
                
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
                            onClick={onClose}
                            className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
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
                        <div className="space-y-4">
                            {history.map((item) => (
                                <div 
                                    key={item.id} 
                                    className={`border rounded-xl p-4 transition-all ${
                                        item.status === 1 ? 'border-gray-200 bg-white shadow-sm hover:border-blue-300' : 'border-gray-100 bg-gray-50/50 opacity-75'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                item.status === 1 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                                <FileText size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className={`text-sm font-semibold truncate ${item.status === 1 ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                                                    {item.filename}
                                                </h4>
                                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                    <span>{formatDate(item.importedAt)}</span>
                                                    <span>•</span>
                                                    <span>{item.user?.name || 'Unknown'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {item.status === 1 && (
                                            <button 
                                                onClick={() => handleRevertClick(item)}
                                                className="shrink-0 p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors tooltip-trigger"
                                                title="Undo Import"
                                            >
                                                <Undo2 size={16} />
                                            </button>
                                        )}
                                        {item.status === 0 && (
                                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                                Reverted
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100/60">
                                        <span className="text-xs font-medium text-gray-500">Transactions</span>
                                        <span className={`text-xs font-bold ${item.status === 1 ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {item.transactionCount}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={revertDialog.open}
                title="Undo Import"
                message={`Are you sure you want to revert the import of "${revertDialog.filename}"? This will permanently delete ${revertDialog.count} transactions and cannot be undone.`}
                confirmLabel="Yes, Revert Import"
                isSubmitting={revertDialog.loading}
                onCancel={() => setRevertDialog(prev => ({ ...prev, open: false }))}
                onConfirm={confirmRevert}
                confirmButtonClass="bg-rose-600 hover:bg-rose-700 text-white"
            />
        </div>
    );
};

export default ImportHistoryPanel;
