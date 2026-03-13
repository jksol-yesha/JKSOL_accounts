import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Check, CornerDownRight, Hash, Building2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import CustomSelect from '../../../components/common/CustomSelect';
import { cn } from '../../../utils/cn';
import { useFormNavigation } from '../../../hooks/useFormNavigation';

export const NewCategoryCard = ({ selectedBranch, branches, onCategoryCreate }) => {
    const [catForm, setCatForm] = useState({ name: '', type: 'Expense' });
    const [targetBranchIds, setTargetBranchIds] = useState(() => {
        return branches?.map(b => b.id) || [];
    });
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [branchError, setBranchError] = useState(false);
    const catNameRef = useRef(null);
    const catTypeRef = useRef(null);
    // const catBranchRef = useRef(null); // Removed as it's no longer a direct input for navigation

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setIsBranchDropdownOpen(false);
                setBranchError(false); // clear error on outside click
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCatSubmit = (e) => {
        if (e) e.preventDefault();
        if (!catForm.name || !catForm.type) return;

        // Always create category in all branches; ignore branch selector state.
        const allBranchIds = (branches || []).map(b => Number(b.id)).filter(Boolean);
        if (allBranchIds.length === 0) {
            setBranchError(true);
            return;
        }

        onCategoryCreate(catForm, allBranchIds);

        // Show success state
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 2000);

        setCatForm({ name: '', type: 'Expense' });
        catNameRef.current?.focus();
    };

    const inputs = [catNameRef, catTypeRef]; // Updated inputs array
    const handleKeyDown = useFormNavigation(inputs, () => handleCatSubmit());

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 bg-white mb-6 transition-all hover:shadow-md category-laptop-metric-card">
            <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 category-laptop-metric-content">
                <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-500 shrink-0">
                        <Plus size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-extrabold text-gray-800 uppercase tracking-widest leading-none">New Category</h3>
                        <p className="hidden xs:block text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Main entry classification</p>
                    </div>
                </div>

                <form onSubmit={handleCatSubmit} className="space-y-4 category-laptop-metric-form">
                    <div className="space-y-2.5">
                        <label className="text-sm font-semibold text-slate-600 pl-0.5">Category Name</label>
                        <input
                            ref={catNameRef}
                            type="text"
                            value={catForm.name}
                            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, 0)}
                            placeholder="e.g. Inventory, Stationary"
                            className="w-full  mt-1 px-3.5 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-600 pl-0.5">Type</label>
                            <CustomSelect
                                ref={catTypeRef}
                                value={catForm.type}
                                onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}
                                onKeyDown={(e) => handleKeyDown(e, 1)}
                                className={cn(
                                    "w-full mt-1 px-3.5 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] outline-none focus:bg-white focus:border-slate-900 transition-all",
                                    catForm.type === "" ? "font-bold text-slate-400" : "font-bold text-slate-700"
                                )}
                                required
                            >
                                <option value="" disabled hidden>Select Transaction Type</option>
                                <option value="Expense">Expense</option>
                                <option value="Income">Income</option>
                                <option value="Investment">Investment</option>
                            </CustomSelect>
                        </div>
                    </div>



                    <button
                        type="submit"
                        disabled={isSuccess}
                        className={cn(
                            "w-full mt-2 text-[12px] font-extrabold py-3.5 rounded-lg transition-all shadow-lg active:scale-[0.98] flex items-center justify-center space-x-2 category-laptop-metric-cta",
                            isSuccess
                                ? "bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600"
                                : "bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800"
                        )}
                    >
                        {isSuccess ? (
                            <>
                                <Check size={16} strokeWidth={3} />
                                <span>Category Created!</span>
                            </>
                        ) : (
                            <span>Create Category</span>
                        )}
                    </button>
                </form>
            </div>
        </Card>
    );
};

export const NewSubCategoryCard = ({ selectedBranch, branches, categories, onSubCategoryCreate }) => {
    const [subForm, setSubForm] = useState({ parentId: '', name: '' });
    const [isSuccess, setIsSuccess] = useState(false);
    const subParentRef = useRef(null);
    const subNameRef = useRef(null);
    const subBranchRef = useRef(null);

    const handleSubSubmit = (e) => {
        if (e) e.preventDefault();
        if (!subForm.name || !subForm.parentId) return;

        onSubCategoryCreate(subForm);

        // Show success state
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 2000);

        setSubForm({ ...subForm, name: '' });
        subParentRef.current?.focus();
    };

    const inputs = [subParentRef, subNameRef, subBranchRef];
    const handleKeyDown = useFormNavigation(inputs, () => handleSubSubmit());

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 bg-white transition-all hover:shadow-md category-laptop-metric-card">
            <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 category-laptop-metric-content">
                <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white border-gray-100 text-gray-500 shrink-0">
                        <Plus size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-extrabold text-gray-800 uppercase tracking-widest leading-none">New Sub-Category</h3>
                        <p className="hidden xs:block text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Secondary grouping</p>
                    </div>
                </div>

                <form onSubmit={handleSubSubmit} className="space-y-4 category-laptop-metric-form">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-600 pl-0.5">Parent Category</label>
                        <CustomSelect
                            ref={subParentRef}
                            value={subForm.parentId}
                            onChange={(e) => setSubForm({ ...subForm, parentId: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, 0)}
                            className={cn(
                                "w-full mt-1 px-3.5 py-2 bg-[#f1f3f9] border border-gray-100 rounded-lg text-[13px] outline-none focus:bg-white focus:border-slate-400 transition-all",
                                subForm.parentId === "" ? "font-bold text-slate-400" : "font-bold text-slate-700"
                            )}
                            required
                        >
                            <option value="">Select Parent</option>
                            {categories
                                .filter(cat => cat.status !== 'inactive')
                                .map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                        </CustomSelect>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700  pl-0.5">Sub Name</label>
                        <input
                            ref={subNameRef}
                            type="text"
                            value={subForm.name}
                            onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, 1)}
                            placeholder="e.g. Rent, Grocery"
                            className="w-full mt-1 px-3.5 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-400 transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSuccess}
                        className={cn(
                            "w-full text-[12px] font-extrabold py-3.5 rounded-lg transition-all flex items-center justify-center space-x-2 category-laptop-metric-cta",
                            isSuccess
                                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200"
                                : "bg-[#f1f3f9] text-primary hover:bg-primary/20"
                        )}
                    >
                        {isSuccess ? (
                            <>
                                <Check size={16} strokeWidth={3} />
                                <span>Sub-Category Created!</span>
                            </>
                        ) : (
                            <span>Create Sub-Category</span>
                        )}
                    </button>
                </form>
            </div>
        </Card>
    );
};
