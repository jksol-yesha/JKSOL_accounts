import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { CURRENCY_OPTIONS } from '../../utils/constants';

const CurrencySelector = ({ value, onChange, options = CURRENCY_OPTIONS }) => {
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
            
            setDropdownPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
                width: 120
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
                className="group relative flex items-center justify-center px-2.5 h-[38px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm focus:outline-none"
            >
                <div className="flex items-center gap-1 text-[13px] font-semibold text-slate-800">
                    <span className="text-[#4A8AF4] font-bold opacity-90">{selectedOption.label.split(' - ')[0]}</span>
                    <span>{selectedOption.value}</span>
                </div>
            </button>

            {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownMenuRef}
                    className="fixed bg-white rounded-md shadow-lg border border-slate-200 py-1 z-[100] animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: dropdownPosition.top, right: dropdownPosition.right, width: dropdownPosition.width }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 transition-colors ${
                                value === option.value 
                                ? 'bg-[#EEF0FC]' 
                                : 'hover:bg-[#EEF0FC]'
                            }`}
                        >
                            <div className="w-4 flex justify-center shrink-0">
                                {value === option.value && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                            </div>
                            <span className="text-[13px] tracking-tight text-slate-800">
                                <span className={`font-bold mr-1 ${value === option.value ? 'text-[#4A8AF4]' : 'text-slate-400'}`}>
                                    {option.label.split(' - ')[0]}
                                </span>
                                <span className={value === option.value ? 'font-bold' : 'font-medium'}>
                                    {option.value}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CurrencySelector;
