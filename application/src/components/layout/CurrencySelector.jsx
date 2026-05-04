import React, {
    useState,
    useRef,
    useEffect,
    useLayoutEffect,
    useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { CURRENCY_OPTIONS } from '../../utils/constants';
import { cn } from '../../utils/cn';

const CurrencySelector = React.forwardRef(({
    value,
    onChange,
    options = CURRENCY_OPTIONS,
    disabled = false,
    name,
    onKeyDown,
    onFocusNext,
    className = '',
    triggerTextClassName = '',
    optionTextClassName = '',
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const currentValue = String(value || '');
    const getInitialHighlightedIndex = React.useCallback(() => {
        if (options.length === 0) return -1;
        const selectedIndex = options.findIndex((opt) => String(opt.value) === currentValue);
        return selectedIndex >= 0 ? selectedIndex : 0;
    }, [options, currentValue]);

    useLayoutEffect(() => {
        if (!isOpen) return;

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
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useImperativeHandle(ref, () => buttonRef.current);

    useEffect(() => {
        if (disabled && isOpen) {
            const timer = window.setTimeout(() => {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [disabled, isOpen]);

    const selectedOption =
        options.find((opt) => String(opt.value) === currentValue) ||
        (currentValue ? { value: currentValue, label: currentValue } : null) ||
        options[0] ||
        { label: 'Select...' };
    const hasSymbolLabel = selectedOption.label?.includes(' - ');

    const openDropdown = () => {
        if (disabled) return;
        setHighlightedIndex(getInitialHighlightedIndex());
        setIsOpen(true);
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
        setHighlightedIndex(-1);
        setTimeout(() => {
            onFocusNext?.();
        }, 0);
    };

    const handleInternalKeyDown = (event) => {
        if (disabled) return;

        if (!isOpen) {
            if (
                event.key === 'Enter' ||
                event.key === ' ' ||
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp'
            ) {
                event.preventDefault();
                event.stopPropagation();
                openDropdown();
                return;
            }

            onKeyDown?.(event);
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                event.stopPropagation();
                setHighlightedIndex((prev) => {
                    const next = prev + 1;
                    if (next >= options.length) return 0;
                    return next;
                });
                break;
            case 'ArrowUp':
                event.preventDefault();
                event.stopPropagation();
                setHighlightedIndex((prev) => {
                    const next = prev - 1;
                    if (next < 0) return options.length - 1;
                    return next;
                });
                break;
            case 'Enter':
                event.preventDefault();
                event.stopPropagation();
                if (highlightedIndex >= 0 && options[highlightedIndex]) {
                    handleSelect(options[highlightedIndex].value);
                } else {
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                }
                break;
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
                setHighlightedIndex(-1);
                buttonRef.current?.focus();
                break;
            case 'Tab':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
            default:
                break;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={buttonRef}
                type="button"
                name={name}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `currency-selector-${name || 'default'}` : undefined}
                data-custom-select-trigger="true"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen((prev) => {
                        const nextIsOpen = !prev;
                        setHighlightedIndex(
                            nextIsOpen ? getInitialHighlightedIndex() : -1,
                        );
                        return nextIsOpen;
                    });
                }}
                onKeyDown={handleInternalKeyDown}
                className={cn(
                    "group relative flex items-center justify-center px-2.5 h-[32px] rounded-md border border-gray-200 bg-white text-gray-600 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:outline-none",
                    disabled
                        ? "cursor-not-allowed opacity-70"
                        : "hover:text-[#4A8AF4] hover:bg-[#F0F9FF] hover:border-[#BAE6FD] focus-visible:bg-[#F0F9FF] focus-visible:border-[#BAE6FD] focus-visible:text-[#4A8AF4] focus-visible:ring-2 focus-visible:ring-blue-100",
                    className,
                )}
            >
                <div className={cn(
                    "flex items-center gap-1 text-[13px] font-medium text-slate-800 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4] transition-colors",
                    triggerTextClassName,
                )}>
                    {hasSymbolLabel ? (
                        <>
                            <span className="text-[#4A8AF4] font-bold opacity-90">
                                {selectedOption.label.split(' - ')[0]}
                            </span>
                            <span>{selectedOption.value || 'Select...'}</span>
                        </>
                    ) : (
                        <span>{selectedOption.value || selectedOption.label || 'Select...'}</span>
                    )}
                </div>
                <ChevronDown
                    size={14}
                    className={cn(
                        "ml-1 transition-transform",
                        isOpen ? "rotate-180 text-[#4A8AF4]" : "text-slate-500 group-hover:text-[#4A8AF4] group-focus-visible:text-[#4A8AF4]",
                    )}
                />
            </button>

            {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownMenuRef}
                    id={`currency-selector-${name || 'default'}`}
                    role="listbox"
                    className="fixed z-[100] rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: dropdownPosition.top, right: dropdownPosition.right, width: dropdownPosition.width }}
                >
                    {options.map((option, index) => {
                        const isSelected = currentValue === option.value;
                        const isHighlighted = highlightedIndex === index;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option.value)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                onMouseLeave={() => setHighlightedIndex(-1)}
                                className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 transition-colors ${
                                    isSelected
                                    ? ''
                                    : isHighlighted
                                        ? 'bg-[#EEF0FC]/80 ring-1 ring-inset ring-[#CBD4F7]/40'
                                        : 'hover:bg-[#EEF0FC]/60'
                                }`}
                            >
                                <div className="w-4 flex justify-center shrink-0">
                                    {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                </div>
                                <span className={cn("text-[13px] tracking-tight text-slate-800", optionTextClassName)}>
                                    <span className={`font-bold mr-1 ${isSelected ? 'text-[#2F5FC6]' : isHighlighted ? 'text-[#4A8AF4]' : 'text-slate-400'}`}>
                                        {option.label.split(' - ')[0]}
                                    </span>
                                    <span className={isSelected ? 'font-bold text-[#2F5FC6]' : isHighlighted ? 'font-bold text-[#4A8AF4]' : 'font-medium text-slate-600 group-hover:text-[#4A8AF4]'}>
                                        {option.value}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
});

CurrencySelector.displayName = 'CurrencySelector';

export default CurrencySelector;
