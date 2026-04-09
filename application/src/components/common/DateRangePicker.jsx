import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const DateRangePicker = forwardRef(({
    startDate,
    endDate,
    onChange,
    className,
    placeholder = "Select Date Range",
    onKeyDown,
    presetOptions = [],
    selectedPreset = 'custom',
    onApplyRange
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
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
            presetOptions.length > 0 ? 360 : 224,
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

            if (usesDeferredApply) {
                setDraftRange(nextRange);
                setDraftPreset('custom');
            } else {
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
                <Calendar size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
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
                                <div className="w-[128px] border-r border-gray-100 pr-2 py-1 max-h-[214px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
                                    <div className="space-y-0.5">
                                        {presetOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => handlePresetSelect(option)}
                                                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                                                    (usesDeferredApply ? draftPreset : selectedPreset) === option.value
                                                        ? 'bg-black text-white shadow-sm'
                                                        : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="w-[200px] shrink-0 py-1 px-1">
                                <div className="flex items-center justify-between mb-2">
                                    <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200">
                                        <ChevronLeft size={14} className="text-gray-600" />
                                    </button>
                                    <span className="text-[13px] font-bold text-gray-800 tracking-tight">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </span>
                                    <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200">
                                        <ChevronRight size={14} className="text-gray-600" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-0.5 mb-1">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} className="text-center text-[9px] font-bold tracking-wider text-gray-400 uppercase pb-1">{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-0.5">
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty-${i}`} className="h-7 w-7" />
                                    ))}
                                    {Array.from({ length: days }).map((_, i) => {
                                        const day = i + 1;
                                        const isSelected = isDateSelected(day);
                                        const inRange = isDateInRange(day);
                                        const today = isToday(day);

                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => handleDateClick(day)}
                                                className={`
                                                    h-7 w-7 rounded-md text-[12px] font-medium transition-all flex items-center justify-center
                                                    ${isSelected ? 'bg-black text-white shadow-sm ring-1 ring-black ring-offset-1' : ''}
                                                    ${inRange ? 'bg-gray-100 text-gray-800 rounded-none' : ''}
                                                    ${today && !isSelected && !inRange ? 'text-black font-bold bg-gray-100 ring-1 ring-gray-200' : ''}
                                                    ${!isSelected && !inRange && !today ? 'text-gray-600 hover:bg-gray-100' : ''}
                                                `}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end gap-1.5 px-1">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-7 px-2.5 rounded-md text-[12px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="h-7 rounded-md bg-black px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
