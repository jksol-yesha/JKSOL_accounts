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
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Refs
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
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
        const isMobileViewport = window.innerWidth < 640;
        const measuredWidth = dropdownRef.current?.offsetWidth || 0;
        const fallbackWidth = presetOptions.length > 0 ? 420 : 230;
        const popupWidth = Math.min(
            measuredWidth || fallbackWidth,
            window.innerWidth - (viewportPadding * 2)
        );
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const showAbove = spaceBelow < 360 && spaceAbove > spaceBelow;

        if (isMobileViewport) {
            setDropdownStyles({
                position: 'fixed',
                left: viewportPadding,
                right: viewportPadding,
                zIndex: 10000,
                ...(showAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
            });
            return;
        }

        const left = Math.max(
            viewportPadding,
            Math.min(rect.left, window.innerWidth - popupWidth - viewportPadding)
        );

        setDropdownStyles({
            position: 'fixed',
            left,
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
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        const parsedDate = new Date(dateStr);
        if (Number.isNaN(parsedDate.getTime())) return null;

        return new Date(
            parsedDate.getFullYear(),
            parsedDate.getMonth(),
            parsedDate.getDate()
        );
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
        if (!isOpen && ['Enter', ' ', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            updatePosition();
            setIsOpen(true);
            setHighlightedIndex(0);
            
            if (presetOptions.length > 0) {
                 const opt = presetOptions[0];
                 setHoveredPreset(opt);
                 if (opt.range?.startDate) {
                     const d = parseLocalDate(opt.range.startDate);
                     if (d) setCurrentMonth(d);
                 }
            }
        } else if (isOpen) {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                    setHoveredPreset(null);
                    inputRef.current?.focus();
                    break;
                case 'ArrowDown':
                    if (presetOptions.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        setHighlightedIndex(prev => {
                            const next = (prev + 1) % presetOptions.length;
                            const opt = presetOptions[next];
                            setHoveredPreset(opt);
                            if (opt.range?.startDate) {
                                const d = parseLocalDate(opt.range.startDate);
                                if (d) setCurrentMonth(d);
                            }
                            return next;
                        });
                    }
                    break;
                case 'ArrowUp':
                    if (presetOptions.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        setHighlightedIndex(prev => {
                            const next = (prev - 1 + presetOptions.length) % presetOptions.length;
                            const opt = presetOptions[next];
                            setHoveredPreset(opt);
                            if (opt.range?.startDate) {
                                const d = parseLocalDate(opt.range.startDate);
                                if (d) setCurrentMonth(d);
                            }
                            return next;
                        });
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    e.stopPropagation();
                    if (highlightedIndex >= 0 && presetOptions[highlightedIndex]) {
                        const opt = presetOptions[highlightedIndex];
                        handlePresetSelect(opt);
                        const appliedRange = {
                            startDate: opt.range.startDate || '',
                            endDate: opt.range.endDate || opt.range.startDate || '',
                            preset: opt.value
                        };
                        if (usesDeferredApply) {
                            onApplyRange(appliedRange);
                        } else {
                            onChange(appliedRange);
                        }
                        setIsOpen(false);
                        setHighlightedIndex(-1);
                        setHoveredPreset(null);
                    } else {
                        handleApply();
                        setHighlightedIndex(-1);
                        setHoveredPreset(null);
                    }
                    break;
            }
        }
    };

    const handlePresetSelect = (option) => {
        if (!option) return;
        setDraftPreset(option.value);
        if (option.range) {
            setDraftRange(option.range);
            if (!usesDeferredApply) {
                onChange?.({
                    ...option.range,
                    preset: option.value
                });
            }
            const date = parseLocalDate(option.range.startDate);
            if (date) setCurrentMonth(date);
        }
    };

    const handleApply = () => {
        const appliedRange = {
            startDate: draftRange.startDate || '',
            endDate: draftRange.endDate || draftRange.startDate || '',
            preset: draftPreset
        };

        if (usesDeferredApply) {
            onApplyRange(appliedRange);
        } else {
            onChange(appliedRange);
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
                className="group relative flex items-center justify-start gap-2 px-3 w-full h-[32px] rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-[#F0F9FF] hover:text-[#4A8AF4] hover:border-[#BAE6FD] focus:outline-none focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                onClick={() => {
                    if (!isOpen) updatePosition();
                    setIsOpen(!isOpen);
                }}
            >
                <CalendarDays size={16} className="text-slate-400 group-hover:text-[#4A8AF4] shrink-0 transition-colors" />
                <div className="flex-1 text-left truncate">
                    {startDate ? (
                        <span className="text-[12px] font-medium text-slate-800 group-hover:text-[#4A8AF4] transition-colors">
                            {formatDisplayDate(startDate)}
                            {endDate && endDate !== startDate ? ` - ${formatDisplayDate(endDate)}` : ''}
                        </span>
                    ) : (
                        <span className="text-[12px] font-medium text-slate-400 transition-colors">{placeholder}</span>
                    )}
                </div>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-date-range-dropdown="true"
                    ref={dropdownRef}
                    style={dropdownStyles}
                    className="w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-md select-none sm:w-max sm:max-w-[calc(100vw-24px)]"
                >
                    <div className="flex flex-col">
                        <div className={presetOptions.length > 0 ? 'flex flex-row gap-3 sm:gap-4' : ''}>
                            {presetOptions.length > 0 && (
                                <div 
                                    className="w-[116px] shrink-0 border-r border-slate-200 py-1 pr-3 sm:w-32 sm:pr-4 md:w-36 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200"
                                    onMouseLeave={() => {
                                        if (effectiveStartDate) {
                                            const d = parseLocalDate(effectiveStartDate);
                                            if (d) setCurrentMonth(d);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col gap-0.5 pb-0">
                                        {presetOptions.map((option, idx) => {
                                            const isSelected = (usesDeferredApply ? draftPreset : selectedPreset) === option.value;
                                            const isHighlighted = highlightedIndex === idx;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => handlePresetSelect(option)}
                                                    onMouseEnter={() => {
                                                        setHoveredPreset(option);
                                                        setHighlightedIndex(idx);
                                                        if (option.range?.startDate) {
                                                            const d = parseLocalDate(option.range.startDate);
                                                            if (d) setCurrentMonth(d);
                                                        }
                                                    }}
                                                    onMouseLeave={() => {
                                                        setHoveredPreset(null);
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    className={`cursor-pointer w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-[11px] leading-tight sm:px-2 sm:text-[12px] transition-colors ${
                                                        isSelected
                                                            ? 'bg-[#EEF0FC] text-[#2F5FC6] font-bold'
                                                            : isHighlighted 
                                                                ? 'bg-[#EEF0FC]/80 text-[#4A8AF4] font-bold ring-1 ring-inset ring-[#CBD4F7]/40'
                                                                : 'text-slate-600 font-medium hover:bg-[#EEF0FC]/60 hover:text-[#4A8AF4]'
                                                    }`}
                                                >
                                                    <span className="truncate">{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="min-w-0 flex-1 py-1">
                                <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
                                    <button type="button" onClick={handlePrevMonth} className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-transparent p-0 opacity-50 transition-opacity hover:bg-slate-100 hover:opacity-100 sm:h-7 sm:w-7">
                                        <ChevronLeft size={16} className="text-slate-600" />
                                    </button>
                                    <div className="truncate text-[13px] font-medium text-slate-900 sm:text-sm">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </div>
                                    <button type="button" onClick={handleNextMonth} className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-transparent p-0 opacity-50 transition-opacity hover:bg-slate-100 hover:opacity-100 sm:h-7 sm:w-7">
                                        <ChevronRight size={16} className="text-slate-600" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-y-1">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} className="w-7 text-center text-[0.72rem] font-medium text-slate-500 sm:w-8 sm:text-[0.8rem] md:w-9">{d}</div>
                                    ))}
                                    
                                    {/* Empty cells before start of month */}
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty-${i}`} className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9" />
                                    ))}
                                    
                                    {Array.from({ length: days }).map((_, i) => {
                                        const day = i + 1;
                                        const isSelected = isDateSelected(day);
                                        const inRange = isDateInRange(day);
                                        const today = isToday(day);
                                        const isHoverPreview = hoveredPreset && !isSelected && !inRange && isDateHoveredRange(day);

                                        // Edge logic for rounding start/end inside range
                                        const currentStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
                                        const startStr = effectiveStartDate ? parseLocalDate(effectiveStartDate)?.toDateString() : null;
                                        const endStr = effectiveEndDate ? parseLocalDate(effectiveEndDate)?.toDateString() : null;
                                        const isRangeStart = startStr === currentStr && startStr !== endStr;
                                        const isRangeEnd = endStr === currentStr && startStr !== endStr;

                                        return (
                                            <div key={day} className={`relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0
                                                ${inRange || isHoverPreview ? 'bg-[#EEF0FC]' : ''}
                                                ${isRangeStart ? 'bg-[#EEF0FC] rounded-l-md' : ''}
                                                ${isRangeEnd ? 'bg-[#EEF0FC] rounded-r-md' : ''}
                                            `}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDateClick(day)}
                                                    className={`
                                                        absolute inset-0 flex items-center justify-center rounded-md text-[11px] font-medium transition-colors sm:text-[12px]
                                                        ${isSelected ? 'bg-[#4A8AF4] text-white shadow-sm ring-1 ring-[#4A8AF4]' : ''}
                                                        ${!isSelected && (inRange || isHoverPreview) ? 'text-[#2F5FC6] bg-transparent rounded-none' : ''}
                                                        ${today && !isSelected ? 'bg-[#EEF0FC] text-[#2F5FC6] font-bold ring-1 ring-[#CBD4F7]' : ''}
                                                        ${!isSelected && !inRange && !isHoverPreview && !today ? 'text-slate-600 hover:bg-[#EEF0FC] hover:text-[#2F5FC6]' : ''}
                                                    `}
                                                >
                                                    {day}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-1.5 px-1 pb-0">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-6 px-3 rounded-md text-[11px] font-semibold text-gray-500 hover:text-[#2F5FC6] hover:bg-[#EEF0FC] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="h-6 rounded-md bg-[#4A8AF4] px-4 text-[11px] font-semibold text-white shadow-sm hover:bg-[#3E79DE] transition-all hover:scale-[1.02] active:scale-[0.98]"
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
