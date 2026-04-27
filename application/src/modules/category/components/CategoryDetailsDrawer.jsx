import React, { useState, useEffect, useRef } from 'react';
import { Save, X, ShoppingBag, CornerDownRight } from 'lucide-react';
import { Loader } from '../../../components/common/Loader';
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
    
    // Animation States
    const [shouldRenderDrawer, setShouldRenderDrawer] = useState(isOpen);
    const [isClosingDrawer, setIsClosingDrawer] = useState(false);
    const closeAnimationTimerRef = useRef(null);

    useEffect(() => {
        let openStateTimer = null;
        if (isOpen) {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
            openStateTimer = setTimeout(() => {
                setShouldRenderDrawer(true);
                setIsClosingDrawer(false);
            }, 0);
            return () => {
                if (openStateTimer) clearTimeout(openStateTimer);
            };
        }

        if (!shouldRenderDrawer) return;

        openStateTimer = setTimeout(() => {
            setIsClosingDrawer(true);
        }, 0);

        closeAnimationTimerRef.current = setTimeout(() => {
            setShouldRenderDrawer(false);
            setIsClosingDrawer(false);
            closeAnimationTimerRef.current = null;
        }, 280);

        return () => {
            if (openStateTimer) clearTimeout(openStateTimer);
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
                closeAnimationTimerRef.current = null;
            }
        };
    }, [isOpen, shouldRenderDrawer]);

    useEffect(() => {
        return () => {
            if (closeAnimationTimerRef.current) {
                clearTimeout(closeAnimationTimerRef.current);
            }
        };
    }, []);

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

    if (!shouldRenderDrawer) return null;

    return (
        <div className="fixed inset-0 z-[110] flex justify-end">
            <div 
                className={cn(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity",
                    isClosingDrawer ? "animate-fade-out" : "animate-fade-in"
                )} 
                onClick={onClose} 
            />
            <div 
                className={cn(
                    "bg-white w-[480px] max-w-full h-full shadow-2xl flex flex-col relative z-[120] overflow-hidden",
                    isClosingDrawer ? "animate-slide-out-right" : "animate-slide-in-right"
                )}
            >

                {/* Header */}
                <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                                {isSubCategory ? <CornerDownRight size={14} strokeWidth={2.5} /> : <ShoppingBag size={14} strokeWidth={2.5} />}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                                    {isEditing ? `Edit ${isSubCategory ? 'Sub-Category' : 'Category'}` : `New ${isSubCategory ? 'Sub-Category' : 'Category'}`}
                                </h2>
                                <p className="text-[10px] font-semibold text-slate-500 mt-0.5 tracking-wide flex items-center gap-1">
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
                            className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </div>
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

                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.status === 1}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 1 : 2 })}
                                    tabIndex={-1}
                                    className="sr-only peer"
                                />
                                <div className="relative h-4 w-7 rounded-full bg-slate-200 shadow-inner transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-300 peer-checked:bg-[#4A8AF4] before:absolute before:left-[2px] before:top-[2px] before:h-3 before:w-3 before:rounded-full before:bg-white before:shadow-sm before:transition-transform before:duration-200 peer-checked:before:translate-x-3"></div>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 select-none group-hover:text-slate-900 transition-colors">
                                {formData.status === 1 ? 'Active' : 'Inactive'}
                            </span>
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold px-4 py-1.5 rounded-md shadow-sm active:scale-95 transition-all flex items-center gap-1.5 outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader className="h-3.5 w-3.5 text-white" />
                                        <span>Saving</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={13} strokeWidth={2.5} />
                                        <span>{isEditing ? 'Update' : 'Save'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryDetailsDrawer;
