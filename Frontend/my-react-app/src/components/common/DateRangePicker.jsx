import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DateRangePicker = forwardRef(({ startDate, endDate, onChange, className, placeholder = "Select Date Range", onKeyDown }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(startDate ? new Date(startDate) : new Date());
    const [dropdownStyles, setDropdownStyles] = useState({});

    // Refs
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        click: () => inputRef.current?.click(),
    }));

    // Handle Outside Click
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click is inside container
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
        const popupWidth = 280;
        const viewportPadding = 12;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const showAbove = spaceBelow < 360 && spaceAbove > spaceBelow;
        const left = Math.max(
            viewportPadding,
            Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - viewportPadding)
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

    // Helper to parse "YYYY-MM-DD" as local date (00:00:00)
    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    useEffect(() => {
        if (startDate) {
            const date = parseLocalDate(startDate);
            if (date) setCurrentMonth(date);
        }
    }, [startDate]);

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
        // Normalize to YYYY-MM-DD locally
        const year = clickedDate.getFullYear();
        const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
        const d = String(clickedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;

        if (!startDate || (startDate && endDate)) {
            // Start of new selection
            onChange({ startDate: dateStr, endDate: '' });
        } else {
            // End of selection
            const start = parseLocalDate(startDate);

            if (clickedDate < start) {
                // If clicked date is before start, swap
                onChange({ startDate: dateStr, endDate: startDate });
            } else {
                onChange({ startDate, endDate: dateStr });
            }
            setIsOpen(false);
        }
    };

    const isDateSelected = (day) => {
        if (!startDate) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);

        const isStart = start && current.toDateString() === start.toDateString();
        const isEnd = end && current.toDateString() === end.toDateString();
        return isStart || isEnd;
    };

    const isDateInRange = (day) => {
        if (!startDate || !endDate) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
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
        if (onKeyDown) {
            onKeyDown(e);
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <div
                ref={inputRef}
                tabIndex={0}
                onKeyDown={handleKeyDownInternal}
                className="flex w-full h-[38px] shadow-sm rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 group"
                onClick={() => {
                    if (!isOpen) updatePosition();
                    setIsOpen(!isOpen);
                }}
            >
                <div className="flex-1 h-full flex items-center pl-2.5 pr-2 bg-[#f1f3f9] border border-gray-100 border-r-0 rounded-l-lg transition-all group-hover:border-gray-300 overflow-hidden font-medium text-sm text-gray-700">
                    <div className="flex-1 truncate">
                        {startDate ? (
                            <span className="font-medium text-gray-800">
                                {new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {endDate ? ` to ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                            </span>
                        ) : (
                            <span className="text-black font-normal">{placeholder}</span>
                        )}
                    </div>
                </div>
                <div className="h-full w-[38px] bg-black flex items-center justify-center text-white rounded-r-lg shrink-0 hover:bg-gray-800 transition-colors">
                    <Calendar size={18} />
                </div>
            </div>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    data-date-range-dropdown="true"
                    style={dropdownStyles}
                    className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 min-w-[280px]"
                >
                    <div className="flex items-center justify-between mb-4">
                        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronLeft size={16} className="text-gray-500" />
                        </button>
                        <span className="text-sm font-bold text-gray-800">
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronRight size={16} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} />
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
                                        h-8 w-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center
                                        ${isSelected ? 'bg-black text-white shadow-md' : ''}
                                        ${inRange ? 'bg-gray-100 text-gray-800 rounded-none' : ''}
                                        ${today && !isSelected && !inRange ? 'text-primary font-bold bg-primary/5' : ''}
                                        ${!isSelected && !inRange && !today ? 'text-gray-600 hover:bg-gray-50' : ''}
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

export default DateRangePicker;
