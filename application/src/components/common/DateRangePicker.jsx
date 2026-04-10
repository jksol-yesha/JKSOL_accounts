import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useYear } from '../../context/YearContext';
import { generateDatePresets } from '../../utils/constants';

const DateRangePicker = forwardRef(({
    startDate,
    endDate,
    onChange,
    className,
    placeholder = "Select Date Range",
    onKeyDown,
    presetOptions: externalPresetOptions,
    selectedPreset = 'custom',
    onApplyRange
}, ref) => {
    const { financialYears, selectedYear } = useYear();

    const sortedFinancialYears = [...(financialYears || [])].sort((a, b) => {
        const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
        return aDate - bDate;
    });
    const selectedYearIndex = sortedFinancialYears.findIndex((year) => Number(year.id) === Number(selectedYear?.id));
    const previousYear = selectedYearIndex > 0 ? sortedFinancialYears[selectedYearIndex - 1] : null;

    const presetOptions = externalPresetOptions || generateDatePresets(selectedYear, previousYear);

    const [isOpen, setIsOpen] = useState(false);
    const [hoveredPreset, setHoveredPreset] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(startDate ? new Date(startDate) : new Date());
    const [dropdownStyles, setDropdownStyles] = useState({});
    const [draftRange, setDraftRange] = useState({ startDate, endDate });
    const [draftPreset, setDraftPreset] = useState(selectedPreset);

    // Refs
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const usesDeferredApply = typeof onApplyRange === 'function';

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        click: () => inputRef.current?.click(),
    }));

    // Handle Outside Click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                if (event.target?.closest?.('[data-date-range-dropdown="true"]')) {
                    return;
                }
                setIsOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);

    const updatePosition = () => {
        if (!inputRef.current) return;

        const rect = inputRef.current.getBoundingClientRect();
        const viewportPadding = 12;
        const popupWidth = Math.min(
            presetOptions.length > 0 ? 440 : 260,
            window.innerWidth - (viewportPadding * 2)
        );
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const showAbove = spaceBelow < 360 && spaceAbove > spaceBelow;
        const left = Math.max(
            viewportPadding,
            Math.min(rect.left, window.innerWidth - popupWidth - viewportPadding)
        );

        setDropdownStyles({
            position: 'fixed',
            left,
            width: popupWidth,
            zIndex: 10000,
            ...(showAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition, true);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition, true);
        };
    }, [isOpen]);

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatDisplayDate = (dateStr) => {
        const date = parseLocalDate(dateStr);
        if (!date) return '';
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    useEffect(() => {
        if (startDate) {
            const date = parseLocalDate(startDate);
            if (date) setCurrentMonth(date);
        }
    }, [startDate]);

    useEffect(() => {
        if (!isOpen) {
            setDraftRange({ startDate, endDate });
            setDraftPreset(selectedPreset || 'custom');
        } else if (startDate) {
            const date = parseLocalDate(startDate);
            if (date) setCurrentMonth(date);
        }
    }, [startDate, endDate, selectedPreset, isOpen]);

    const effectiveStartDate = usesDeferredApply ? draftRange.startDate : startDate;
    const effectiveEndDate = usesDeferredApply ? draftRange.endDate : endDate;

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const detectPreset = (range) => {
        if (!range || !range.startDate || !range.endDate) return 'custom';
        const matched = presetOptions.find(opt => 
            opt.range && 
            opt.range.startDate === range.startDate && 
            opt.range.endDate === range.endDate
        );
        return matched ? matched.value : 'custom';
    };

    const handleDateClick = (day) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const year = clickedDate.getFullYear();
        const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
        const d = String(clickedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;

        const nextStartDate = effectiveStartDate;
        const nextEndDate = effectiveEndDate;

        if (!nextStartDate || (nextStartDate && nextEndDate)) {
            const nextRange = { startDate: dateStr, endDate: '' };
            if (usesDeferredApply) {
                setDraftRange(nextRange);
                setDraftPreset('custom');
            } else {
                onChange(nextRange);
            }
        } else {
            const start = parseLocalDate(nextStartDate);
            let nextRange;
            if (clickedDate < start) {
                nextRange = { startDate: dateStr, endDate: nextStartDate };
            } else {
                nextRange = { startDate: nextStartDate, endDate: dateStr };
            }
            
            const nextPreset = detectPreset(nextRange);

            if (usesDeferredApply) {
                setDraftRange(nextRange);
                setDraftPreset(nextPreset);
            } else {
                nextRange.preset = nextPreset;
                onChange(nextRange);
                setIsOpen(false);
            }
        }
    };

    const isDateSelected = (day) => {
        if (!effectiveStartDate) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const start = parseLocalDate(effectiveStartDate);
        const end = parseLocalDate(effectiveEndDate);

        const isStart = start && current.toDateString() === start.toDateString();
        const isEnd = end && current.toDateString() === end.toDateString();
        return isStart || isEnd;
    };

    const isDateInRange = (day) => {
        if (!effectiveStartDate || !effectiveEndDate) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const start = parseLocalDate(effectiveStartDate);
        const end = parseLocalDate(effectiveEndDate);
        return current > start && current < end;
    };

    const isToday = (day) => {
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const today = new Date();
        return current.toDateString() === today.toDateString();
    };

    const isDateHoveredRange = (day) => {
        if (!hoveredPreset || !hoveredPreset.range.startDate || !hoveredPreset.range.endDate) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const start = parseLocalDate(hoveredPreset.range.startDate);
        const end = parseLocalDate(hoveredPreset.range.endDate);
        return current >= start && current <= end;
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const handleKeyDownInternal = (e) => {
        if (onKeyDown) onKeyDown(e);
    };

    const handlePresetSelect = (option) => {
        if (!option) return;
        setDraftPreset(option.value);
        if (option.range) {
            setDraftRange(option.range);
            const date = parseLocalDate(option.range.startDate);
            if (date) setCurrentMonth(date);
        }
    };

    const handleApply = () => {
        if (usesDeferredApply) {
            onApplyRange({
                startDate: draftRange.startDate,
                endDate: draftRange.endDate,
                preset: draftPreset
            });
        } else {
            onChange(draftRange);
        }
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                ref={inputRef}
                tabIndex={0}
                onKeyDown={handleKeyDownInternal}
                className="group relative flex items-center gap-2 px-3 w-full h-[38px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                onClick={() => {
                    if (!isOpen) updatePosition();
                    setIsOpen(!isOpen);
                }}
            >
                <CalendarDays size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                <div className="flex-1 text-left truncate">
                    {startDate ? (
                        <span className="text-sm font-semibold text-slate-800">
                            {formatDisplayDate(startDate)}
                            {endDate && endDate !== startDate ? ` to ${formatDisplayDate(endDate)}` : ''}
                        </span>
                    ) : (
                        <span className="text-sm font-semibold text-slate-400">{placeholder}</span>
                    )}
                </div>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-date-range-dropdown="true"
                    style={dropdownStyles}
                    className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-max"
                >
                    <div className="flex flex-col">
                        <div className={presetOptions.length > 0 ? 'flex gap-2' : ''}>
                            {presetOptions.length > 0 && (
                                <div 
                                    className="w-[180px] border-r border-gray-100 pr-2 py-1 max-h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300"
                                    onMouseLeave={() => {
                                        if (effectiveStartDate) {
                                            const d = parseLocalDate(effectiveStartDate);
                                            if (d) setCurrentMonth(d);
                                        }
                                    }}
                                >
                                    <div className="space-y-0.5">
                                        {presetOptions.map((option) => {
                                            const isActive = (usesDeferredApply ? draftPreset : selectedPreset) === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => handlePresetSelect(option)}
                                                    onMouseEnter={() => {
                                                        setHoveredPreset(option);
                                                        if (option.range?.startDate) {
                                                            const d = parseLocalDate(option.range.startDate);
                                                            if (d) setCurrentMonth(d);
                                                        }
                                                    }}
                                                    onMouseLeave={() => setHoveredPreset(null)}
                                                    className={`group cursor-pointer w-full flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                                                        isActive
                                                            ? 'bg-emerald-50/50'
                                                            : 'hover:bg-emerald-50/50'
                                                    }`}
                                                >
                                                    <div className="w-4 flex justify-center shrink-0">
                                                        {isActive && <Check size={16} className="text-emerald-600" strokeWidth={2.5} />}
                                                    </div>
                                                    <span className={`text-[13px] tracking-tight truncate ${isActive ? 'font-bold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
                                                        {option.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="w-[260px] shrink-0 py-1 px-3">
                                <div className="flex items-center justify-between mb-3">
                                    <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200">
                                        <ChevronLeft size={16} className="text-gray-600" />
                                    </button>
                                    <span className="text-[14px] font-bold text-gray-800 tracking-tight">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </span>
                                    <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200">
                                        <ChevronRight size={16} className="text-gray-600" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} className="text-center text-[10px] font-bold tracking-wider text-gray-400 uppercase pb-1">{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty-${i}`} className="h-8 w-8" />
                                    ))}
                                    {Array.from({ length: days }).map((_, i) => {
                                        const day = i + 1;
                                        const isSelected = isDateSelected(day);
                                        const inRange = isDateInRange(day);
                                        const today = isToday(day);
                                        const isHoverPreview = hoveredPreset && !isSelected && !inRange && isDateHoveredRange(day);

                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => handleDateClick(day)}
                                                className={`
                                                    h-8 w-8 rounded-md text-[13px] font-medium transition-all flex items-center justify-center
                                                    ${isSelected ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600' : ''}
                                                    ${inRange ? 'bg-emerald-50 text-emerald-800 rounded-none' : ''}
                                                    ${isHoverPreview ? 'bg-emerald-50/40 text-slate-600 rounded-none border border-dashed border-emerald-200' : ''}
                                                    ${today && !isSelected && !inRange && !isHoverPreview ? 'text-emerald-700 font-bold bg-emerald-50/50 ring-1 ring-emerald-200' : ''}
                                                    ${!isSelected && !inRange && !isHoverPreview && !today ? 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700' : ''}
                                                `}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2 px-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-8 px-4 rounded-md text-[13px] font-semibold text-gray-500 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="h-8 rounded-md bg-emerald-600 px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

export default DateRangePicker;
