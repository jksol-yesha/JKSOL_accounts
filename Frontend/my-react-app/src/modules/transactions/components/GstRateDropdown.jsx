import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Plus, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '../../../utils/cn';

const GstRateDropdown = ({
    value,
    onChange,
    orgId,
    branchId,
    className = '',
    error = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newRate, setNewRate] = useState('');
    const [rates, setRates] = useState(['5', '12', '18', '28']); // Default common rates
    const dropdownRef = useRef(null);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const [dropdownStyles, setDropdownStyles] = useState({});

    const storageKey = useMemo(() => {
        const orgKey = orgId || 'org';
        const branchKey = branchId || 'branch';
        return `gst_rate_options_${orgKey}_${branchKey}`;
    }, [orgId, branchId]);

    // Load rates from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Combine with defaults and deduplicate
                    const combined = Array.from(new Set([...['5', '12', '18', '28'], ...parsed.map(String)]))
                        .sort((a, b) => parseFloat(a) - parseFloat(b));
                    setRates(combined);
                }
            } catch (e) {
                console.error('Failed to parse GST rates', e);
            }
        }
    }, [storageKey]);

    const saveRates = (newRates) => {
        const sorted = [...newRates].sort((a, b) => parseFloat(a) - parseFloat(b));
        setRates(sorted);
        localStorage.setItem(storageKey, JSON.stringify(sorted));
    };

    const handleAddRate = () => {
        if (!newRate || isNaN(parseFloat(newRate))) return;
        const normalized = parseFloat(newRate).toString();
        if (!rates.includes(normalized)) {
            saveRates([...rates, normalized]);
        }
        setNewRate('');
        setIsAdding(false);
    };

    const handleDeleteRate = (rateToDelete, e) => {
        e.stopPropagation();
        const updated = rates.filter(r => r !== rateToDelete);
        saveRates(updated);
        if (value === rateToDelete) {
            onChange({ target: { value: '' } });
        }
    };

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = 250; // Estimated max height
            const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

            setDropdownStyles({
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
                ...(showAbove
                    ? { bottom: window.innerHeight - rect.top + 4 }
                    : { top: rect.bottom + 4 }
                ),
            });
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setIsAdding(false);
            }
        };

        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAdding]);

    const displayValue = value ? `${parseFloat(value).toFixed(2)}%` : 'Select Rate';

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-[14px] font-bold text-slate-700 flex items-center justify-between transition-all outline-none focus:border-black",
                    error ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-100",
                    className
                )}
            >
                <span className={cn(!value && "text-slate-400")}>{displayValue}</span>
                <ChevronDown size={18} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={dropdownStyles}
                    className="bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="max-h-[200px] overflow-y-auto no-scrollbar p-1">
                        {rates.map((rate) => (
                            <div
                                key={rate}
                                onClick={() => {
                                    onChange({ target: { value: rate } });
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "group w-full rounded-lg px-3 py-1.5 text-[13px] text-left transition-colors flex items-center justify-between cursor-pointer",
                                    value === rate ? "bg-slate-50 text-slate-900 font-bold" : "text-slate-600 font-semibold hover:bg-slate-50"
                                )}
                            >
                                <span>{parseFloat(rate).toFixed(0)}%</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteRate(rate, e)}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-50 p-1">
                        {!isAdding ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAdding(true);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                <Plus size={14} className="text-slate-400" />
                                <span>Add New</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1 p-0.5" onClick={(e) => e.stopPropagation()}>
                                <div className="relative flex-1">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Rate %"
                                        value={newRate}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^\d.]/g, '');
                                            setNewRate(val);
                                        }}
                                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[13px] font-bold outline-none focus:border-black"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddRate();
                                            if (e.key === 'Escape') setIsAdding(false);
                                        }}
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">%</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddRate}
                                    className="p-1 bg-black text-white rounded-lg hover:bg-black/90 transition-colors"
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="p-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default GstRateDropdown;
