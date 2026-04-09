import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

const CurrencySelector = ({ value, onChange, options = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const width = rect.width;
            
            setDropdownPosition({
                top: rect.bottom + 8,
                left: rect.left,
                width: width
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedTrigger = dropdownRef.current?.contains(event.target);
            const clickedMenu = dropdownMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedMenu) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value) || options[0] || { label: 'Select...' };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex items-center gap-2 px-3 h-[38px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                    {selectedOption.label.split(' - ')[0]} {selectedOption.value}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
            </button>

            {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 z-[90] bg-transparent" onClick={() => setIsOpen(false)} />
                    <div
                        ref={dropdownMenuRef}
                        className="fixed bg-white rounded-md shadow-lg border border-slate-200 py-1 z-[100] animate-in fade-in zoom-in-95 duration-200"
                        style={{ top: dropdownPosition.top, left: dropdownPosition.left, minWidth: Math.max(dropdownPosition.width, 100) }}
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`flex items-center gap-1.5 w-full text-left px-3 py-2 transition-colors ${
                                    value === option.value 
                                    ? 'bg-emerald-50/50' 
                                    : 'hover:bg-emerald-50/50'
                                }`}
                            >
                                <div className="w-4 flex justify-center shrink-0">
                                    {value === option.value && <Check size={14} className="text-emerald-600" strokeWidth={2.5} />}
                                </div>
                                <span className={`text-[13px] tracking-tight ${value === option.value ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                                    {option.label.split(' - ')[0]} {option.value}
                                </span>
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default CurrencySelector;
