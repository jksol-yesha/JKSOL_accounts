import React, { useState, useEffect, useRef, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const parsedDate = new Date(dateStr);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
};

const formatForDisplay = (dateStr) => {
    const date = parseLocalDate(dateStr);
    if (!date) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

/** Auto-format: inserts slashes as user types digits. "2705" → "27/05", "27052026" → "27/05/2026" */
const autoFormatDateInput = (raw, prevRaw) => {
    // Only digits and slashes
    const digits = raw.replace(/[^\d]/g, '');
    
    // If user is deleting (backspace), don't auto-format aggressively
    if (raw.length < prevRaw.length) {
        return raw;
    }
    
    let result = '';
    for (let i = 0; i < digits.length && i < 8; i++) {
        if (i === 2 || i === 4) result += '/';
        result += digits[i];
    }
    return result;
};

const parseTypedDate = (raw) => {
    const cleaned = raw.replace(/\s/g, '');
    let match;

    // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    match = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) {
        const [, d, m, y] = match;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(date.getTime()) && date.getDate() === Number(d) && date.getMonth() === Number(m) - 1) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // ddmmyyyy (8 digits)
    match = cleaned.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (match) {
        const [, d, m, y] = match;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(date.getTime()) && date.getDate() === Number(d) && date.getMonth() === Number(m) - 1) {
            return `${y}-${m}-${d}`;
        }
    }

    // yyyy-mm-dd (ISO)
    match = cleaned.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (match) {
        const [, y, m, d] = match;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(date.getTime()) && date.getDate() === Number(d) && date.getMonth() === Number(m) - 1) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    return null;
};

const CustomDatePicker = forwardRef(({
    value,
    onChange,
    name,
    min,
    max,
    className = '',
    error,
    placeholder = 'DD/MM/YYYY',
    onKeyDown,
    onBlur,
    required,
    disabled,
    'data-nav-field': dataNavField,
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = parseLocalDate(value);
        return d || new Date();
    });
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [calendarView, setCalendarView] = useState('days'); // 'days' | 'months' | 'years'
    const [yearRangeStart, setYearRangeStart] = useState(() => {
        const d = parseLocalDate(value);
        const y = d ? d.getFullYear() : new Date().getFullYear();
        return y - (y % 12);
    });

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    useImperativeHandle(ref, () => inputRef.current);

    // Sync display text when value changes externally
    useEffect(() => {
        if (!isTyping) {
            setInputText(formatForDisplay(value));
        }
    }, [value, isTyping]);

    // Sync calendar month when value changes
    useEffect(() => {
        const d = parseLocalDate(value);
        if (d) {
            setCurrentMonth(d);
            setYearRangeStart(d.getFullYear() - (d.getFullYear() % 12));
        }
    }, [value]);

    // Click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setCalendarView('days');
                commitTypedValue();
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [inputText, value]);

    // Position the dropdown
    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }
        const updatePosition = () => {
            if (!inputRef.current) return;
            const rect = inputRef.current.getBoundingClientRect();
            const popupWidth = 288;
            const popupHeight = 380;
            const spaceBelow = window.innerHeight - rect.bottom;
            const showAbove = spaceBelow < popupHeight && rect.top > spaceBelow;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8));

            setDropdownPosition({
                position: 'fixed',
                left,
                zIndex: 10000,
                ...(showAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
            });
        };
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition, true);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition, true);
        };
    }, [isOpen]);

    const commitTypedValue = () => {
        setIsTyping(false);
        if (!inputText.trim()) return;
        const parsed = parseTypedDate(inputText);
        if (parsed && parsed !== value) {
            if (min && parsed < min) return setInputText(formatForDisplay(value));
            if (max && parsed > max) return setInputText(formatForDisplay(value));
            fireChange(parsed);
        } else if (!parsed) {
            setInputText(formatForDisplay(value));
        }
    };

    const fireChange = (dateStr) => {
        if (onChange) {
            const syntheticEvent = {
                target: { name: name || '', value: dateStr },
                currentTarget: { name: name || '', value: dateStr },
                preventDefault: () => {},
                stopPropagation: () => {},
            };
            onChange(syntheticEvent);
        }
    };

    const handleDateClick = (day) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        if (min && dateStr < min) return;
        if (max && dateStr > max) return;
        fireChange(dateStr);
        setIsOpen(false);
        setCalendarView('days');
        setIsTyping(false);
        inputRef.current?.focus();
    };

    const handleMonthSelect = (monthIndex) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
        setCalendarView('days');
    };

    const handleYearSelect = (year) => {
        setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
        setCalendarView('months');
    };

    const handleInputChange = (e) => {
        setIsTyping(true);
        const newVal = autoFormatDateInput(e.target.value, inputText);
        setInputText(newVal);
        
        // If full date typed, auto-commit
        const parsed = parseTypedDate(newVal);
        if (parsed) {
            const valid = !(min && parsed < min) && !(max && parsed > max);
            if (valid) {
                fireChange(parsed);
                const d = parseLocalDate(parsed);
                if (d) setCurrentMonth(d);
            }
        }
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitTypedValue();
            setIsOpen(false);
            setCalendarView('days');
            onKeyDown?.(e);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            setCalendarView('days');
            setIsTyping(false);
            setInputText(formatForDisplay(value));
            return;
        }
        if (e.key === 'Tab') {
            commitTypedValue();
            setIsOpen(false);
            setCalendarView('days');
            onKeyDown?.(e);
            return;
        }
        onKeyDown?.(e);
    };

    const handleInputFocus = () => {
        setInputText(formatForDisplay(value));
    };

    const handleInputBlurInternal = (e) => {
        setTimeout(() => {
            if (
                !containerRef.current?.contains(document.activeElement) &&
                !dropdownRef.current?.contains(document.activeElement)
            ) {
                commitTypedValue();
            }
        }, 150);
        onBlur?.(e);
    };

    const handleCalendarToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            const next = !isOpen;
            setIsOpen(next);
            if (!next) setCalendarView('days');
        }
    };

    const handlePrevMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (calendarView === 'years') {
            setYearRangeStart(prev => prev - 12);
        } else if (calendarView === 'months') {
            setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
        } else {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
        }
    };

    const handleNextMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (calendarView === 'years') {
            setYearRangeStart(prev => prev + 12);
        } else if (calendarView === 'months') {
            setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
        } else {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
        }
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const isDateSelected = (day) => {
        if (!value) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const selected = parseLocalDate(value);
        return selected && current.toDateString() === selected.toDateString();
    };

    const isToday = (day) => {
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return current.toDateString() === new Date().toDateString();
    };

    const isDateDisabled = (day) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        if (min && dateStr < min) return true;
        if (max && dateStr > max) return true;
        return false;
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);

    const getHeaderLabel = () => {
        if (calendarView === 'years') {
            return `${yearRangeStart} – ${yearRangeStart + 11}`;
        }
        if (calendarView === 'months') {
            return String(currentMonth.getFullYear());
        }
        return `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    };

    const handleHeaderClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (calendarView === 'days') {
            setCalendarView('months');
        } else if (calendarView === 'months') {
            setYearRangeStart(currentMonth.getFullYear() - (currentMonth.getFullYear() % 12));
            setCalendarView('years');
        }
    };

    // Render year grid
    const renderYearGrid = () => {
        const years = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);
        const selectedDate = parseLocalDate(value);
        const currentYear = new Date().getFullYear();

        return (
            <div className="grid grid-cols-3 gap-1.5 py-1">
                {years.map(year => {
                    const isSelected = selectedDate && selectedDate.getFullYear() === year;
                    const isCurrent = year === currentYear;
                    return (
                        <button
                            key={year}
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleYearSelect(year); }}
                            className={`
                                h-9 rounded-md text-[12px] font-medium transition-colors
                                ${isSelected ? 'bg-[#4A8AF4] text-white shadow-sm' : ''}
                                ${isCurrent && !isSelected ? 'bg-[#EEF0FC] text-[#2F5FC6] font-bold ring-1 ring-[#CBD4F7]' : ''}
                                ${!isSelected && !isCurrent ? 'text-slate-600 hover:bg-[#EEF0FC] hover:text-[#2F5FC6]' : ''}
                            `}
                        >
                            {year}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Render month grid
    const renderMonthGrid = () => {
        const selectedDate = parseLocalDate(value);
        const currentDate = new Date();
        const isCurrentYear = currentMonth.getFullYear() === currentDate.getFullYear();

        return (
            <div className="grid grid-cols-3 gap-1.5 py-1">
                {MONTH_SHORT.map((month, idx) => {
                    const isSelected = selectedDate &&
                        selectedDate.getFullYear() === currentMonth.getFullYear() &&
                        selectedDate.getMonth() === idx;
                    const isCurrent = isCurrentYear && idx === currentDate.getMonth();
                    return (
                        <button
                            key={month}
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMonthSelect(idx); }}
                            className={`
                                h-9 rounded-md text-[12px] font-medium transition-colors
                                ${isSelected ? 'bg-[#4A8AF4] text-white shadow-sm' : ''}
                                ${isCurrent && !isSelected ? 'bg-[#EEF0FC] text-[#2F5FC6] font-bold ring-1 ring-[#CBD4F7]' : ''}
                                ${!isSelected && !isCurrent ? 'text-slate-600 hover:bg-[#EEF0FC] hover:text-[#2F5FC6]' : ''}
                            `}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Render day grid
    const renderDayGrid = () => (
        <>
            <div className="grid grid-cols-7 gap-y-1 mb-1">
                {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-slate-400 w-9 h-7 flex items-center justify-center">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-9 w-9" />
                ))}
                {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const selected = isDateSelected(day);
                    const today = isToday(day);
                    const dayDisabled = isDateDisabled(day);

                    return (
                        <button
                            key={day}
                            type="button"
                            disabled={dayDisabled}
                            onClick={() => handleDateClick(day)}
                            className={`
                                h-9 w-9 flex items-center justify-center text-[12px] font-medium rounded-md transition-colors
                                ${selected ? 'bg-[#4A8AF4] text-white shadow-sm ring-1 ring-[#4A8AF4]' : ''}
                                ${today && !selected ? 'bg-[#EEF0FC] text-[#2F5FC6] font-bold ring-1 ring-[#CBD4F7]' : ''}
                                ${!selected && !today && !dayDisabled ? 'text-slate-600 hover:bg-[#EEF0FC] hover:text-[#2F5FC6]' : ''}
                                ${dayDisabled ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </>
    );

    return (
        <div className="relative" ref={containerRef}>
            <div className={`flex items-center w-full bg-white border rounded-md shadow-sm transition-all ${error ? 'border-rose-500 focus-within:ring-rose-500/20' : 'border-slate-200 focus-within:border-[#4A8AF4] focus-within:ring-2 focus-within:ring-[#4A8AF4]/10'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    name={name}
                    data-nav-field={dataNavField}
                    required={required}
                    disabled={disabled}
                    placeholder={placeholder}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlurInternal}
                    autoComplete="off"
                    className="flex-1 px-3 py-1.5 bg-transparent text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={handleCalendarToggle}
                    disabled={disabled}
                    className="px-2 py-1.5 text-slate-400 hover:text-[#4A8AF4] transition-colors shrink-0 outline-none"
                >
                    <CalendarDays size={16} />
                </button>
            </div>

            {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    data-custom-datepicker-dropdown="true"
                    style={dropdownPosition}
                    className="bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 p-3 w-[288px] select-none animate-in fade-in zoom-in-95 duration-200"
                >
                    {/* Header: Navigation + Label */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-slate-200 rounded-md flex items-center justify-center transition-opacity hover:bg-slate-100"
                        >
                            <ChevronLeft size={16} className="text-slate-600" />
                        </button>
                        <button
                            type="button"
                            onClick={handleHeaderClick}
                            className="text-sm font-semibold text-slate-900 hover:text-[#4A8AF4] hover:bg-[#EEF0FC] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                        >
                            {getHeaderLabel()}
                        </button>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-slate-200 rounded-md flex items-center justify-center transition-opacity hover:bg-slate-100"
                        >
                            <ChevronRight size={16} className="text-slate-600" />
                        </button>
                    </div>

                    {/* Calendar body */}
                    {calendarView === 'years' && renderYearGrid()}
                    {calendarView === 'months' && renderMonthGrid()}
                    {calendarView === 'days' && renderDayGrid()}

                    {/* Today shortcut */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const yyyy = today.getFullYear();
                                const mm = String(today.getMonth() + 1).padStart(2, '0');
                                const dd = String(today.getDate()).padStart(2, '0');
                                const dateStr = `${yyyy}-${mm}-${dd}`;
                                if (!(min && dateStr < min) && !(max && dateStr > max)) {
                                    fireChange(dateStr);
                                    setIsOpen(false);
                                    setCalendarView('days');
                                    setIsTyping(false);
                                }
                            }}
                            className="text-[11px] font-semibold text-[#4A8AF4] hover:text-[#2F5FC6] hover:bg-[#EEF0FC] px-3 py-1 rounded-md transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

CustomDatePicker.displayName = 'CustomDatePicker';

export default CustomDatePicker;
