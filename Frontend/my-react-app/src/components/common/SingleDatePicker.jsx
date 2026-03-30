import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const SingleDatePicker = forwardRef(({ date, onChange, className, placeholder = "Select Date", onKeyDown }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(date ? new Date(date) : new Date());
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        click: () => inputRef.current?.click(),
    }));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (date) {
            setCurrentMonth(new Date(date));
        }
    }, [date]);

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
        // Normalize to local date string YYYY-MM-DD
        const year = clickedDate.getFullYear();
        const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
        const d = String(clickedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;

        onChange(dateStr); // Return standard YYYY-MM-DD string
        setIsOpen(false);
    };

    const isDateSelected = (day) => {
        if (!date) return false;
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const selected = new Date(date);
        return current.toDateString() === selected.toDateString();
    };

    const isToday = (day) => {
        const current = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const today = new Date();
        return current.toDateString() === today.toDateString();
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const formatDateDisplay = () => {
        if (!date) return placeholder;
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Handle Enter/Space to toggle calendar if focused
    const handleKeyDownInternal = (e) => {
        if (onKeyDown) {
            onKeyDown(e);
        }
        if (e.key === 'Enter' || e.key === ' ') {
            // If navigating, we might want to just open.
            // But useFormNavigation treats Enter as "next".
            // So if onKeyDown is passed (useFormNavigation), it manages focus.
            // We should only toggle if it's NOT handled by navigation or separate key?
            // Actually, useFormNavigation calls preventDefault().
            // If we want to open calendar on Enter, `useFormNavigation` might conflict.
            // But for "Date", "Next" is usually fine. User can click to open or use Space?
            // Let's rely on click for now, and allow form nav.
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                ref={inputRef}
                tabIndex={0}
                onKeyDown={handleKeyDownInternal}
                className="flex items-center justify-between w-full h-10 px-3 bg-[#f1f3f9] border border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-gray-200 hover:shadow-sm focus:outline-none focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium text-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center space-x-2 text-gray-700 truncate">
                    <Calendar size={16} className="text-gray-400" />
                    <span className={!date ? "text-gray-400 font-bold uppercase tracking-wider text-xs" : ""}>{formatDateDisplay()}</span>
                </div>
                {date && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={14} className="text-gray-400" />
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-12 left-0 z-50 bg-white border border-gray-100 shadow-xl rounded-xl p-4 w-72 animate-in fade-in zoom-in-95 duration-200">
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
                            const today = isToday(day);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        h-8 w-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center
                                        ${isSelected ? 'bg-gray-200 text-gray-900 border border-gray-300' : ''}
                                        ${today && !isSelected ? 'text-black font-extrabold' : ''}
                                        ${!isSelected && !today ? 'text-gray-600 hover:bg-gray-50' : ''}
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

export default SingleDatePicker;
