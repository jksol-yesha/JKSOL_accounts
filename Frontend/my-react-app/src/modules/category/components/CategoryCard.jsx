import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, ChevronDown } from 'lucide-react';
import Card from '../../../components/common/Card';
import CustomSelect from '../../../components/common/CustomSelect';
import { cn } from '../../../utils/cn';
import { useFormNavigation } from '../../../hooks/useFormNavigation';

export const NewCategoryCard = ({ onCategoryCreate }) => {
    const [catForm, setCatForm] = useState({ name: '', type: 'Expense', pnlClassification: '' });
    const [isSuccess, setIsSuccess] = useState(false);
    const [nameError, setNameError] = useState('');
    const catNameRef = useRef(null);
    const catTypeRef = useRef(null);
    const isCategorySubmitDisabled = isSuccess || !catForm.name.trim() || !catForm.type;

    const handleCatSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!catForm.name || !catForm.type) return;
        setNameError('');

        try {
            await onCategoryCreate(catForm);

            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 2000);
            setCatForm({ name: '', type: 'Expense', pnlClassification: '' });
            catNameRef.current?.focus();
        } catch (error) {
            const message = error?.message || 'Failed to create category';
            if (message.toLowerCase().includes('already exists')) {
                setNameError(message);
                catNameRef.current?.focus();
                return;
            }
            alert(message);
        }
    };

    const inputs = [catNameRef, catTypeRef]; // Updated inputs array
    const handleKeyDown = useFormNavigation(inputs, () => handleCatSubmit());

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 bg-white mb-6 transition-all hover:shadow-md category-laptop-metric-card">
            <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 category-laptop-metric-content">
                <div>
                    <h3 className="text-[14px] font-extrabold text-gray-800 uppercase tracking-widest leading-none">New Category</h3>
                    <p className="hidden xs:block text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Main entry classification</p>
                </div>

                <form onSubmit={handleCatSubmit} className="space-y-4 category-laptop-metric-form">
                    <div className="space-y-2.5">
                        <label className="text-sm font-semibold text-slate-600 pl-0.5">Category Name</label>
                        <input
                            ref={catNameRef}
                            type="text"
                            value={catForm.name}
                            onChange={(e) => {
                                setCatForm({ ...catForm, name: e.target.value });
                                if (nameError) setNameError('');
                            }}
                            onKeyDown={(e) => handleKeyDown(e, 0)}
                            placeholder="e.g. Inventory, Stationary"
                            className={cn(
                                "w-full mt-1 px-3.5 py-2 bg-[#f1f3f9] border rounded-xl text-[13px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-4 transition-all",
                                nameError
                                    ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100"
                                    : "border-gray-100 focus:border-slate-900 focus:ring-slate-900/5"
                            )}
                            required
                        />
                        {nameError && (
                            <p className="mt-1 text-[11px] font-semibold text-rose-500">{nameError}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-600 pl-0.5">Type</label>
                            <CustomSelect
                                ref={catTypeRef}
                                value={catForm.type}
                                onChange={(e) => setCatForm({ ...catForm, type: e.target.value, pnlClassification: '' })}
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
                        disabled={isCategorySubmitDisabled}
                        className={cn(
                            "w-full mt-2 text-[12px] font-extrabold py-3.5 rounded-lg transition-all shadow-lg active:scale-[0.98] flex items-center justify-center space-x-2 category-laptop-metric-cta",
                            isSuccess
                                ? "bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600"
                                : isCategorySubmitDisabled
                                    ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
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

export const NewSubCategoryCard = ({ categories, onSubCategoryCreate }) => {
    const DROPDOWN_GAP = 6;
    const DROPDOWN_VIEWPORT_PADDING = 12;
    const DROPDOWN_MAX_HEIGHT = 204;
    const [subForm, setSubForm] = useState({ parentId: '', name: '' });
    const [isSuccess, setIsSuccess] = useState(false);
    const [nameError, setNameError] = useState('');
    const [parentSearch, setParentSearch] = useState('');
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [parentDropdownPosition, setParentDropdownPosition] = useState(null);
    const subParentRef = useRef(null);
    const subNameRef = useRef(null);
    const parentDropdownTriggerRef = useRef(null);
    const parentDropdownMenuRef = useRef(null);

    const formatParentCategoryLabel = (category) => {
        const typeLabel = category?.type || (category?.txnType ? `${category.txnType.charAt(0).toUpperCase()}${category.txnType.slice(1)}` : '');
        return typeLabel ? `${category.name} (${typeLabel})` : category.name;
    };

    const activeCategories = categories.filter(cat => cat.status !== 'inactive');
    const selectedParentCategory = activeCategories.find((cat) => String(cat.id) === String(subForm.parentId)) || null;
    const filteredParentCategories = activeCategories.filter((cat) =>
        cat.name.toLowerCase().includes(parentSearch.toLowerCase()) ||
        String(cat.type || cat.txnType || '').toLowerCase().includes(parentSearch.toLowerCase())
    );
    const isSubCategorySubmitDisabled = isSuccess || !subForm.parentId || !subForm.name.trim();
    const displayedParentValue = isParentDropdownOpen
        ? parentSearch
        : (selectedParentCategory ? formatParentCategoryLabel(selectedParentCategory) : parentSearch);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedTrigger = parentDropdownTriggerRef.current?.contains(event.target);
            const clickedDropdown = parentDropdownMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedDropdown) {
                setIsParentDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useLayoutEffect(() => {
        if (!isParentDropdownOpen) {
            setParentDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!parentDropdownTriggerRef.current) return;

            const rect = parentDropdownTriggerRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const desiredWidth = rect.width;
            const width = Math.min(desiredWidth, viewportWidth - (DROPDOWN_VIEWPORT_PADDING * 2));
            const left = Math.min(
                Math.max(DROPDOWN_VIEWPORT_PADDING, rect.left),
                Math.max(DROPDOWN_VIEWPORT_PADDING, viewportWidth - width - DROPDOWN_VIEWPORT_PADDING)
            );
            const availableBelow = viewportHeight - rect.bottom - DROPDOWN_GAP - DROPDOWN_VIEWPORT_PADDING;
            const availableAbove = rect.top - DROPDOWN_GAP - DROPDOWN_VIEWPORT_PADDING;
            const shouldOpenAbove = availableBelow < 140 && availableAbove > availableBelow;
            const maxHeight = Math.max(
                96,
                Math.min(
                    DROPDOWN_MAX_HEIGHT,
                    shouldOpenAbove ? availableAbove : availableBelow
                )
            );

            setParentDropdownPosition({
                left,
                width,
                maxHeight,
                top: shouldOpenAbove ? undefined : rect.bottom + DROPDOWN_GAP,
                bottom: shouldOpenAbove ? (viewportHeight - rect.top) + DROPDOWN_GAP : undefined
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [DROPDOWN_GAP, DROPDOWN_MAX_HEIGHT, DROPDOWN_VIEWPORT_PADDING, isParentDropdownOpen]);

    const handleSelectParentCategory = (category) => {
        setSubForm((prev) => ({ ...prev, parentId: String(category.id) }));
        setParentSearch('');
        setIsParentDropdownOpen(false);
        subNameRef.current?.focus();
    };

    const openParentDropdown = () => {
        if (selectedParentCategory) {
            setParentSearch('');
        }
        setIsParentDropdownOpen(true);
    };

    const handleSubSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!subForm.name || !subForm.parentId) return;
        setNameError('');

        try {
            await onSubCategoryCreate(subForm);
            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 2000);
            setSubForm({ ...subForm, name: '' });
            subParentRef.current?.focus();
        } catch (error) {
            const message = error?.message || 'Failed to create subcategory';
            if (message.toLowerCase().includes('already exists')) {
                setNameError(message);
                subNameRef.current?.focus();
                return;
            }
            alert(message);
        }
    };

    const inputs = [subParentRef, subNameRef];
    const handleKeyDown = useFormNavigation(inputs, () => handleSubSubmit());

    return (
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-0 bg-white overflow-visible transition-all hover:shadow-md category-laptop-metric-card">
            <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 category-laptop-metric-content">
                <div>
                    <h3 className="text-[14px] font-extrabold text-gray-800 uppercase tracking-widest leading-none">New Sub-Category</h3>
                    <p className="hidden xs:block text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Secondary grouping</p>
                </div>

                <form onSubmit={handleSubSubmit} className="space-y-4 category-laptop-metric-form">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-600 pl-0.5">Parent Category</label>
                        <div ref={parentDropdownTriggerRef} className="relative mt-1">
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Search size={14} />
                                </div>
                                <input
                                    type="text"
                                    ref={subParentRef}
                                    value={displayedParentValue}
                                    onFocus={openParentDropdown}
                                    onClick={() => {
                                        if (!isParentDropdownOpen) openParentDropdown();
                                    }}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        setParentSearch(nextValue);
                                        setIsParentDropdownOpen(true);
                                        if (subForm.parentId) {
                                            setSubForm((prev) => ({ ...prev, parentId: '' }));
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setIsParentDropdownOpen(true);
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (isParentDropdownOpen) {
                                                if (filteredParentCategories.length > 0) {
                                                    handleSelectParentCategory(filteredParentCategories[0]);
                                                }
                                                return;
                                            }
                                            if (!selectedParentCategory) {
                                                openParentDropdown();
                                                return;
                                            }
                                            handleKeyDown(e, 0);
                                            return;
                                        }
                                        if (e.key === 'Escape') {
                                            setIsParentDropdownOpen(false);
                                            return;
                                        }
                                        handleKeyDown(e, 0);
                                    }}
                                    placeholder="Search parent category"
                                    className={cn(
                                        "w-full rounded-lg border border-gray-100 bg-[#f1f3f9] py-2 pl-9 pr-9 text-[13px] outline-none transition-all focus:bg-white focus:border-slate-400",
                                        subForm.parentId === "" ? "font-bold text-slate-500" : "font-bold text-slate-700"
                                    )}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <ChevronDown size={16} className={cn("transition-transform", isParentDropdownOpen && "rotate-180")} />
                                </div>
                            </div>
                            {isParentDropdownOpen && parentDropdownPosition && createPortal(
                                <div
                                    ref={parentDropdownMenuRef}
                                    className="fixed z-[240] overflow-y-auto rounded-xl border border-gray-100 bg-white p-1.5 shadow-[0_14px_35px_rgba(15,23,42,0.08)]"
                                    style={{
                                        left: `${parentDropdownPosition.left}px`,
                                        width: `${parentDropdownPosition.width}px`,
                                        maxHeight: `${parentDropdownPosition.maxHeight}px`,
                                        top: parentDropdownPosition.top !== undefined ? `${parentDropdownPosition.top}px` : undefined,
                                        bottom: parentDropdownPosition.bottom !== undefined ? `${parentDropdownPosition.bottom}px` : undefined
                                    }}
                                >
                                    {filteredParentCategories.length > 0 ? (
                                        filteredParentCategories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => handleSelectParentCategory(cat)}
                                                className={cn(
                                                    "w-full rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold transition-colors",
                                                    String(subForm.parentId) === String(cat.id)
                                                        ? "bg-slate-100 text-slate-800"
                                                        : "text-slate-700 hover:bg-slate-50"
                                                )}
                                            >
                                                {formatParentCategoryLabel(cat)}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-[12px] font-medium text-slate-400">
                                            No matching categories
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700  pl-0.5">Sub Name</label>
                        <input
                            ref={subNameRef}
                            type="text"
                            value={subForm.name}
                            onChange={(e) => {
                                setSubForm({ ...subForm, name: e.target.value });
                                if (nameError) setNameError('');
                            }}
                            onKeyDown={(e) => handleKeyDown(e, 1)}
                            placeholder="e.g. Rent, Grocery"
                            className={cn(
                                "w-full mt-1 px-3.5 py-2 bg-[#f1f3f9] border rounded-xl text-[13px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white transition-all",
                                nameError
                                    ? "border-rose-200 focus:border-rose-400"
                                    : "border-gray-100 focus:border-slate-400"
                            )}
                            required
                        />
                        {nameError && (
                            <p className="mt-1 text-[11px] font-semibold text-rose-500">{nameError}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubCategorySubmitDisabled}
                        className={cn(
                            "w-full text-[12px] font-extrabold py-3.5 rounded-lg transition-all flex items-center justify-center space-x-2 category-laptop-metric-cta",
                            isSuccess
                                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200"
                                : isSubCategorySubmitDisabled
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
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
