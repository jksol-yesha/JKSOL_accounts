import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useYear } from '../../context/YearContext';
import { generateDatePresets } from '../../utils/constants';
import { cn } from '../../utils/cn';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULT_RANGE_HINT = 'Select start and end date';

const sameDay = (a, b) => Boolean(a && b) && a.toDateString() === b.toDateString();

const chunkIntoWeeks = (days) => {
    const weeks = [];
    for (let index = 0; index < days.length; index += 7) {
        weeks.push(days.slice(index, index + 7));
    }
    return weeks;
};

const getPresetShortLabel = (option) => {
    if (!option) return '';

    const compactLabels = {
        current: 'Current FY',
        last_fy: 'Last FY',
        last_month: 'Last 1 Month',
        last_3_months: 'Last 3 Months',
        last_6_months: 'Last 6 Months',
        last_9_months: 'Last 9 Months'
    };

    return compactLabels[option.value] || option.label;
};

const DateRangePicker = forwardRef(({
    startDate,
    endDate,
    onChange,
    className,
    placeholder = 'Select Date Range',
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
    const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const usesDeferredApply = typeof onApplyRange === 'function';

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        click: () => inputRef.current?.click(),
    }));

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }

        const parsedDate = new Date(dateStr);
        if (Number.isNaN(parsedDate.getTime())) return null;

        return new Date(
            parsedDate.getFullYear(),
            parsedDate.getMonth(),
            parsedDate.getDate()
        );
    };

    const formatStorageDate = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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

    const formatRangeHint = (from, to) => {
        const start = parseLocalDate(from);
        if (!start) return DEFAULT_RANGE_HINT;

        const end = parseLocalDate(to || from);
        if (!end || sameDay(start, end)) {
            return start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        return `${start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    };

    const buildCalendarDays = (monthDate) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPreviousMonth = new Date(year, month, 0).getDate();

        const calendarDays = [];

        for (let index = 0; index < firstDay; index += 1) {
            const day = daysInPreviousMonth - firstDay + index + 1;
            calendarDays.push({
                date: new Date(year, month - 1, day),
                label: day,
                isCurrentMonth: false
            });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            calendarDays.push({
                date: new Date(year, month, day),
                label: day,
                isCurrentMonth: true
            });
        }

        while (calendarDays.length < 42) {
            const day = calendarDays.length - (firstDay + daysInMonth) + 1;
            calendarDays.push({
                date: new Date(year, month + 1, day),
                label: day,
                isCurrentMonth: false
            });
        }

        return chunkIntoWeeks(calendarDays);
    };

    const detectPreset = (range) => {
        if (!range?.startDate || !range?.endDate) return 'custom';
        const matched = presetOptions.find((option) =>
            option.range &&
            option.range.startDate === range.startDate &&
            option.range.endDate === range.endDate
        );
        return matched ? matched.value : 'custom';
    };

    const updatePosition = () => {
        if (!inputRef.current) return;

        const rect = inputRef.current.getBoundingClientRect();
        const viewportPadding = 12;
        const popupWidth = Math.min(
            presetOptions.length > 0 ? 440 : 310,
            window.innerWidth - (viewportPadding * 2)
        );
        const estimatedHeight = 392;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const showAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
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

    useEffect(() => {
        if (!isOpen) {
            setDraftRange({ startDate, endDate });
            setDraftPreset(selectedPreset || 'custom');
            setHoveredPreset(null);
            setHighlightedIndex(-1);
            setIsMonthMenuOpen(false);
        } else if (startDate) {
            const date = parseLocalDate(startDate);
            if (date) setCurrentMonth(date);
        }
    }, [startDate, endDate, selectedPreset, isOpen]);

    useEffect(() => {
        if (!startDate) return;
        const date = parseLocalDate(startDate);
        if (date) setCurrentMonth(date);
    }, [startDate]);

    const effectiveStartDate = usesDeferredApply ? draftRange.startDate : startDate;
    const effectiveEndDate = usesDeferredApply ? draftRange.endDate : endDate;
    const effectivePreset = usesDeferredApply ? draftPreset : selectedPreset;
    const calendarWeeks = buildCalendarDays(currentMonth);

    const handlePrevMonth = () => {
        setIsMonthMenuOpen(false);
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setIsMonthMenuOpen(false);
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handlePrevYear = () => {
        setIsMonthMenuOpen(false);
        setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
    };

    const handleNextYear = () => {
        setIsMonthMenuOpen(false);
        setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
    };

    const handleMonthSelect = (monthIndex) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
        setIsMonthMenuOpen(false);
    };

    const handlePresetSelect = (option) => {
        if (!option?.range) return;
        setIsMonthMenuOpen(false);
        setDraftPreset(option.value);
        setDraftRange(option.range);

        const nextMonth = parseLocalDate(option.range.startDate);
        if (nextMonth) setCurrentMonth(nextMonth);

        if (!usesDeferredApply) {
            onChange?.({
                ...option.range,
                preset: option.value
            });
        }
    };

    const handleDateClick = (date) => {
        setIsMonthMenuOpen(false);
        const dateStr = formatStorageDate(date);
        const rangeStart = effectiveStartDate;
        const rangeEnd = effectiveEndDate;

        if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
            setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }

        if (!rangeStart || (rangeStart && rangeEnd)) {
            const nextRange = { startDate: dateStr, endDate: '' };
            if (usesDeferredApply) {
                setDraftRange(nextRange);
                setDraftPreset('custom');
            } else {
                onChange?.(nextRange);
            }
            return;
        }

        const parsedStart = parseLocalDate(rangeStart);
        const nextRange = parsedStart && date < parsedStart
            ? { startDate: dateStr, endDate: rangeStart }
            : { startDate: rangeStart, endDate: dateStr };
        const nextPreset = detectPreset(nextRange);

        if (usesDeferredApply) {
            setDraftRange(nextRange);
            setDraftPreset(nextPreset);
        } else {
            onChange?.({
                ...nextRange,
                preset: nextPreset
            });
            setIsOpen(false);
        }
    };

    const handleApply = () => {
        setIsMonthMenuOpen(false);
        const appliedRange = {
            startDate: draftRange.startDate || '',
            endDate: draftRange.endDate || draftRange.startDate || '',
            preset: draftPreset
        };

        if (usesDeferredApply) {
            onApplyRange(appliedRange);
        } else {
            onChange?.(appliedRange);
        }
        setIsOpen(false);
    };

    const resetPresetPreview = () => {
        setHoveredPreset(null);
        setHighlightedIndex(-1);

        const activeStartDate = parseLocalDate(effectiveStartDate);
        if (activeStartDate) {
            setCurrentMonth(activeStartDate);
        }
    };

    const handleKeyDownInternal = (event) => {
        onKeyDown?.(event);

        if (!isOpen && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            updatePosition();
            setIsOpen(true);
            if (presetOptions.length > 0) {
                setHighlightedIndex(0);
                setHoveredPreset(presetOptions[0]);
            }
            return;
        }

        if (!isOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();

            if (isMonthMenuOpen) {
                setIsMonthMenuOpen(false);
                return;
            }

            setIsOpen(false);
            setHoveredPreset(null);
            setHighlightedIndex(-1);
            inputRef.current?.focus();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            handlePrevMonth();
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            handleNextMonth();
            return;
        }

        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && presetOptions.length > 0) {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setHighlightedIndex((previous) => {
                const nextIndex = (previous + direction + presetOptions.length) % presetOptions.length;
                const option = presetOptions[nextIndex];
                setHoveredPreset(option);
                if (option?.range?.startDate) {
                    const previewMonth = parseLocalDate(option.range.startDate);
                    if (previewMonth) setCurrentMonth(previewMonth);
                }
                return nextIndex;
            });
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();

            if (highlightedIndex >= 0 && presetOptions[highlightedIndex]) {
                handlePresetSelect(presetOptions[highlightedIndex]);
                return;
            }

            handleApply();
        }
    };

    const getCellState = (date) => {
        const selectedStart = parseLocalDate(effectiveStartDate);
        const selectedEnd = parseLocalDate(effectiveEndDate);
        const previewStart = parseLocalDate(hoveredPreset?.range?.startDate);
        const previewEnd = parseLocalDate(hoveredPreset?.range?.endDate);

        const isSelectedStart = sameDay(date, selectedStart);
        const isSelectedEnd = Boolean(selectedEnd) && sameDay(date, selectedEnd);
        const isSingleSelectedDay = Boolean(selectedStart) && (!selectedEnd || sameDay(selectedStart, selectedEnd)) && sameDay(date, selectedStart);
        const isSelectedRangeDay = Boolean(selectedStart && selectedEnd) && date > selectedStart && date < selectedEnd;

        const hasPreviewRange = Boolean(previewStart && previewEnd);
        const isPreviewStart = hasPreviewRange && sameDay(date, previewStart);
        const isPreviewEnd = hasPreviewRange && sameDay(date, previewEnd);
        const isPreviewRangeDay = hasPreviewRange && date > previewStart && date < previewEnd;

        return {
            isSelectedStart,
            isSelectedEnd,
            isSingleSelectedDay,
            isSelectedRangeDay,
            isPreviewStart,
            isPreviewEnd,
            isPreviewRangeDay
        };
    };

    const rangeSummary = formatRangeHint(draftRange.startDate, draftRange.endDate);

    return (
        <div className={cn('relative', className)} ref={containerRef} onClick={(event) => event.stopPropagation()}>
            <button
                type="button"
                ref={inputRef}
                tabIndex={0}
                onKeyDown={handleKeyDownInternal}
                className="group relative flex h-[32px] w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-gray-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:border-[#BAE6FD] hover:bg-[#F0F9FF] hover:text-[#4A8AF4] focus:outline-none focus-visible:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100"
                onClick={() => {
                    if (!isOpen) updatePosition();
                    setIsMonthMenuOpen(false);
                    setIsOpen((previous) => !previous);
                }}
            >
                <CalendarDays size={16} className="shrink-0 text-gray-400 transition-colors group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]" />
                <div className="min-w-0 flex-1 truncate text-left">
                    {startDate ? (
                        <span className="text-[12px] font-semibold text-slate-800 transition-colors group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]">
                            {formatDisplayDate(startDate)}
                            {endDate && endDate !== startDate ? ` to ${formatDisplayDate(endDate)}` : ''}
                        </span>
                    ) : (
                        <span className="text-[12px] font-semibold text-slate-400">{placeholder}</span>
                    )}
                </div>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-date-range-dropdown="true"
                    style={dropdownStyles}
                    className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_20px_52px_rgba(15,23,42,0.16)]"
                >
                    <div className="flex bg-white">
                        {presetOptions.length > 0 && (
                            <div className="w-[130px] shrink-0 border-r border-slate-100 bg-slate-50/70 px-1.5 py-1.5">
                                <div className="space-y-0.5" onMouseLeave={resetPresetPreview}>
                                    {presetOptions.map((option, index) => {
                                        const isSelected = effectivePreset === option.value;
                                        const isHighlighted = highlightedIndex === index;

                                        return (
                                            <React.Fragment key={option.value}>
                                                {index > 0 && (
                                                    <div className="mx-2 my-0.5 h-px shrink-0 bg-slate-200/80" />
                                                )}
                                                <button
                                                    type="button"
                                                    title={option.label}
                                                    onClick={() => handlePresetSelect(option)}
                                                    onMouseEnter={() => {
                                                        setHoveredPreset(option);
                                                        setHighlightedIndex(index);
                                                        if (option.range?.startDate) {
                                                            const previewMonth = parseLocalDate(option.range.startDate);
                                                            if (previewMonth) setCurrentMonth(previewMonth);
                                                        }
                                                    }}
                                                    className={cn(
                                                        'flex min-h-[32px] w-full items-center gap-1.5 rounded-md py-1 pl-2 pr-3 text-left text-[11px] font-semibold leading-tight transition-colors',
                                                        isSelected
                                                            ? 'bg-transparent text-slate-600'
                                                            : isHighlighted
                                                                ? 'bg-slate-100 text-slate-600'
                                                                : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-600'
                                                    )}
                                                >
                                                    <span className="flex w-[14px] shrink-0 justify-center">
                                                        {isSelected ? <Check size={12} className="stroke-[3] text-[#4A8AF4]" /> : null}
                                                    </span>
                                                    <span className="whitespace-nowrap">{getPresetShortLabel(option)}</span>
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <div className="bg-[#4A8AF4] px-4 pb-2 pt-3 text-white">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrevMonth}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex items-center gap-1 text-[13px] font-semibold tracking-tight">
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsMonthMenuOpen((previous) => !previous)}
                                                className="flex items-center gap-1 rounded-md px-1 py-0.5 text-white transition-colors hover:bg-white/10"
                                            >
                                                <span>{MONTH_NAMES[currentMonth.getMonth()]}</span>
                                                <ChevronDown
                                                    size={13}
                                                    className={cn(
                                                        'text-white/80 transition-transform',
                                                        isMonthMenuOpen && 'rotate-180'
                                                    )}
                                                />
                                            </button>

                                            {isMonthMenuOpen && (
                                                <div className="absolute left-1/2 top-[calc(100%+5px)] z-20 max-h-[104px] w-[128px] -translate-x-1/2 overflow-y-auto rounded-[8px] border border-slate-200 bg-white p-0.5 shadow-[0_8px_22px_rgba(15,23,42,0.14)]">
                                                    {MONTH_NAMES.map((monthName, monthIndex) => {
                                                        const isSelectedMonth = monthIndex === currentMonth.getMonth();

                                                        return (
                                                            <button
                                                                key={monthName}
                                                                type="button"
                                                                onClick={() => handleMonthSelect(monthIndex)}
                                                                className={cn(
                                                                    'flex h-6 w-full items-center rounded-md px-1.5 text-left text-[9px] font-semibold transition-colors',
                                                                    isSelectedMonth
                                                                        ? 'bg-[#4A8AF4] text-white'
                                                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                                                )}
                                                            >
                                                                {monthName}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="group relative flex items-center pr-3">
                                            <span>{currentMonth.getFullYear()}</span>
                                            <div className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 flex-col opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={handleNextYear}
                                                    aria-label="Next year"
                                                    className="flex h-[9px] w-[12px] items-center justify-center"
                                                >
                                                    <span className="h-0 w-0 border-x-[4px] border-x-transparent border-b-[5px] border-b-white/65" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handlePrevYear}
                                                    aria-label="Previous year"
                                                    className="flex h-[9px] w-[12px] items-center justify-center"
                                                >
                                                    <span className="h-0 w-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-white/65" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNextMonth}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="mt-1 grid grid-cols-7 gap-0 text-center">
                                    {WEEKDAY_LABELS.map((label) => (
                                        <div key={label} className="py-0 text-[9px] font-semibold tracking-wide text-white/95 sm:text-[10px]">
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white px-3 pb-1 mt-1">
                                <div className="space-y-0.5">
                                    {calendarWeeks.map((week, weekIndex) => (
                                        <div
                                            key={`week-${weekIndex}`}
                                            className={cn(
                                                'grid grid-cols-7 overflow-hidden rounded-[6px]',
                                                weekIndex % 2 === 0 ? 'bg-slate-50/85' : 'bg-white'
                                            )}
                                        >
                                            {week.map((dayItem) => {
                                                const {
                                                    isSelectedStart,
                                                    isSelectedEnd,
                                                    isSingleSelectedDay,
                                                    isSelectedRangeDay,
                                                    isPreviewStart,
                                                    isPreviewEnd,
                                                    isPreviewRangeDay
                                                } = getCellState(dayItem.date);

                                                const showPreviewOnly = !isSelectedStart && !isSelectedEnd && !isSingleSelectedDay && !isSelectedRangeDay;
                                                const hasRangeFill = isSelectedRangeDay || (showPreviewOnly && (isPreviewStart || isPreviewEnd || isPreviewRangeDay));
                                                const hasSolidSelection = isSingleSelectedDay || isSelectedStart || isSelectedEnd;
                                                const isOutsideMonth = !dayItem.isCurrentMonth;
                                                const isToday = sameDay(dayItem.date, new Date());

                                                return (
                                                    <button
                                                        key={formatStorageDate(dayItem.date)}
                                                        type="button"
                                                        onClick={() => handleDateClick(dayItem.date)}
                                                        className="relative h-7 overflow-hidden text-center outline-none transition-transform hover:scale-[0.99] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#4A8AF4]/35"
                                                    >
                                                        {hasRangeFill && (
                                                            <span
                                                                className={cn(
                                                                    'absolute inset-y-[1px] bg-[#E8ECF8]',
                                                                    isSingleSelectedDay && 'left-[3px] right-[3px] rounded-full',
                                                                    !isSingleSelectedDay && !isSelectedStart && !isSelectedEnd && !isPreviewStart && !isPreviewEnd && 'left-0 right-0',
                                                                    (isSelectedStart || isPreviewStart) && 'left-[3px] right-0 rounded-l-full',
                                                                    (isSelectedEnd || isPreviewEnd) && 'left-0 right-[3px] rounded-r-full'
                                                                )}
                                                            />
                                                        )}

                                                        {hasSolidSelection && (
                                                            <span
                                                                className={cn(
                                                                    'absolute inset-y-[1px] bg-[#4A8AF4]',
                                                                    isSingleSelectedDay && 'left-[3px] right-[3px] rounded-full',
                                                                    isSelectedStart && !isSingleSelectedDay && 'left-[3px] right-0 rounded-l-full',
                                                                    isSelectedEnd && !isSingleSelectedDay && 'left-0 right-[3px] rounded-r-full'
                                                                )}
                                                            />
                                                        )}

                                                        <span
                                                            className={cn(
                                                                'relative z-[1] flex h-full items-center justify-center text-[10px] font-medium transition-colors',
                                                                hasSolidSelection ? 'font-semibold text-white' : 'text-slate-800',
                                                                isOutsideMonth && !hasSolidSelection ? 'text-slate-300' : '',
                                                                hasRangeFill && !hasSolidSelection ? 'text-slate-700' : '',
                                                                isToday && !hasSolidSelection && !hasRangeFill ? 'font-semibold text-[#4A8AF4]' : ''
                                                            )}
                                                        >
                                                            {dayItem.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">
                        <div className="min-w-0 truncate text-[11px] font-medium text-slate-500">
                            {rangeSummary}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-[28px] rounded-md px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="h-[28px] rounded-md bg-[#4A8AF4] px-5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#3E79DE] hover:scale-[1.02] active:scale-[0.98]"
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
