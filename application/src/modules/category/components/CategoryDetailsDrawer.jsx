import React, { useState, useEffect } from 'react';
import { Save, X, ShoppingBag, CornerDownRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

const CategoryDetailsDrawer = ({ 
    isOpen, 
    onClose, 
    categoryToEdit, 
    parentCategory, // if present, means we are creating/editing a subcategory
    onSave 
}) => {
    const isEditing = !!categoryToEdit;
    const isSubCategory = !!parentCategory || !!categoryToEdit?.parentId;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameError, setNameError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        type: 'Expense',
        status: 1,
    });

    useEffect(() => {
        if (isOpen) {
            if (categoryToEdit) {
                setFormData({
                    name: categoryToEdit.name || '',
                    type: categoryToEdit.txnType 
                        ? (categoryToEdit.txnType.charAt(0).toUpperCase() + categoryToEdit.txnType.slice(1)) 
                        : (categoryToEdit.type || 'Expense'),
                    status: (categoryToEdit.status === 2 || categoryToEdit.status === 'inactive') ? 2 : 1,
                });
            } else {
                setFormData({
                    name: '',
                    type: parentCategory ? parentCategory.type : 'Expense',
                    status: 1,
                });
            }
            setNameError('');
        }
    }, [isOpen, categoryToEdit, parentCategory]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setNameError('');

        if (!formData.name.trim()) {
            setNameError('Name is required');
            return;
        }

        const payload = { ...formData };
        if (isSubCategory) {
            payload.parentId = parentCategory?.id || categoryToEdit.parentId;
        }

        if (isEditing) {
            const originalType = categoryToEdit.txnType
                ? (categoryToEdit.txnType.charAt(0).toUpperCase() + categoryToEdit.txnType.slice(1))
                : (categoryToEdit.type || 'Expense');
            const hasTypeChanged = formData.type !== originalType;
            const transactionCount = Number(categoryToEdit.transactionCount || 0);

            if (hasTypeChanged && transactionCount > 0) {
                const shouldContinue = window.confirm(
                    `This category is already used in ${transactionCount} transaction${transactionCount === 1 ? '' : 's'}. Changing the type will also update those linked transactions. Do you want to continue?`
                );
                if (!shouldContinue) return;
            }
        }

        setIsSubmitting(true);
        try {
            await onSave(isEditing ? categoryToEdit.id : null, payload, !!isSubCategory);
            onClose();
        } catch (error) {
            const message = error?.message || 'Failed to save';
            if (message.toLowerCase().includes('already exists')) {
                setNameError(message);
            } else {
                setNameError(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 text-slate-600 shadow-sm shadow-[#4A8AF4]/5">
                            {isSubCategory ? <CornerDownRight size={14} strokeWidth={2.5}/> : <ShoppingBag size={14} strokeWidth={2.5} />}
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold text-slate-800 leading-tight">
                                {isEditing ? `Edit ${isSubCategory ? 'Sub-Category' : 'Category'}` : `New ${isSubCategory ? 'Sub-Category' : 'Category'}`}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide flex items-center gap-1">
                                {isSubCategory && parentCategory && (
                                    <>
                                        Under <span className="text-slate-600 font-extrabold">{parentCategory.name}</span>
                                    </>
                                )}
                                {!isSubCategory && (
                                    isEditing ? "Update category details" : "Create a new category"
                                )}
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

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar bg-white">
                        <div className="flex flex-col gap-5">
                            
                            {/* Name */}
                            <div className="space-y-1 w-full relative">
                                <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                    Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value });
                                        if (nameError) setNameError('');
                                    }}
                                    placeholder="e.g. Office Supplies"
                                    className={cn("w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all", nameError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200")}
                                    autoFocus
                                />
                                {nameError && <p className="text-[10px] font-bold text-rose-500 mt-0.5 pl-1 absolute -bottom-4">{nameError}</p>}
                            </div>

                            {!isSubCategory && (
                                <div className="space-y-1 w-full pt-2">
                                    <label className="text-[11px] font-bold text-slate-600 block capitalize pl-1">
                                        Type
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Expense', 'Income', 'Investment'].map((typeOption) => (
                                            <button
                                                key={typeOption}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type: typeOption })}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-md text-[12px] font-bold border transition-all text-center",
                                                    formData.type === typeOption 
                                                        ? (typeOption === 'Expense' ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' : 
                                                           typeOption === 'Income' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' : 
                                                           'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm')
                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                )}
                                            >
                                                {typeOption}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Switches Segment */}
                            <div className="flex items-center gap-6 py-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={formData.status === 1}
                                        onChange={(e) => setFormData({...formData, status: e.target.checked ? 1 : 2})}
                                        className="hidden"
                                    />
                                    <div className={cn(
                                        "w-[30px] h-[16px] rounded-full flex items-center transition-colors px-[2px] shadow-inner",
                                        formData.status === 1 ? "bg-emerald-500" : "bg-slate-200"
                                    )}>
                                        <div className={cn(
                                            "w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-transform",
                                            formData.status === 1 ? "translate-x-[14px]" : "translate-x-0"
                                        )}></div>
                                    </div>
                                    <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-800 select-none">Active</span>
                                </label>
                            </div>

                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-[#4A8AF4] text-white rounded-md text-[13px] font-bold hover:bg-[#3b78df] shadow-sm shadow-[#4A8AF4]/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saving</span>
                                </>
                            ) : (
                                <span>Save {isSubCategory ? 'Sub-Category' : 'Category'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryDetailsDrawer;
