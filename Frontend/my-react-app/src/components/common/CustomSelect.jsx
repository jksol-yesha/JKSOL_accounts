import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

const normalizeLabel = (children, fallback) => {
    if (typeof children === 'string' || typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
        const flat = children
            .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item) : ''))
            .join('')
            .trim();
        if (flat) return flat;
    }
    return fallback;
};

const CustomSelect = React.forwardRef(({
    value,
    onChange,
    children,
    className = '',
    buttonLabelClassName = '',
    dropdownClassName = '',
    dropdownContentClassName = '',
    optionLabelClassName = '',
    disabled = false,
    required = false,
    name,
    dropdownGroup,
    onKeyDown,
    ...rest
}, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectId = React.useId();
    const wrapperRef = React.useRef(null);
    const buttonRef = React.useRef(null);
    const dropdownRef = React.useRef(null);
    const [dropdownStyles, setDropdownStyles] = React.useState({});

    const options = React.useMemo(() => {
        const flatOptions = [];
        const processChildren = (children) => {
            React.Children.forEach(children, (child) => {
                if (!React.isValidElement(child)) return;
                if (child.type === React.Fragment) {
                    processChildren(child.props.children);
                } else if (child.type === 'option') {
                    const optionValue = child.props.value ?? '';
                    flatOptions.push({
                        key: child.key ?? `${optionValue}-${flatOptions.length}`,
                        value: String(optionValue),
                        label: normalizeLabel(child.props.children, String(optionValue)),
                        disabled: Boolean(child.props.disabled),
                    });
                }
            });
        };
        processChildren(children);
        return flatOptions;
    }, [children]);

    const currentValue = String(value ?? '');
    const selectedOption = options.find((option) => option.value === currentValue);
    const fallbackOption = options.find((option) => option.value === '');
    const buttonLabel = selectedOption?.label || fallbackOption?.label || 'Select';

    React.useEffect(() => {
        if (disabled && isOpen) setIsOpen(false);
    }, [disabled, isOpen]);

    const updatePosition = React.useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const isMobile = window.innerWidth < 1024;
            const estimatedDropdownHeight = Math.min(
                dropdownRef.current?.offsetHeight || 168,
                isMobile ? Math.round(window.innerHeight * 0.44) : 168
            );
            const requiredSpace = estimatedDropdownHeight + 8;
            const showAbove = spaceBelow < requiredSpace && spaceAbove > spaceBelow;

            if (isMobile) {
                const viewportPadding = 12;
                const maxWidth = Math.max(140, window.innerWidth - viewportPadding * 2);
                const width = Math.min(Math.max(rect.width, 240), maxWidth);
                const left = Math.max(
                    viewportPadding,
                    Math.min(rect.left, window.innerWidth - width - viewportPadding)
                );

                setDropdownStyles({
                    position: 'fixed',
                    left,
                    width,
                    ...(showAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
                });
                return;
            }

            setDropdownStyles({
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                ...(showAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            });
        }
    }, []);

    React.useEffect(() => {
        const handlePointerOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
                    return;
                }
                setIsOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerOutside);
        document.addEventListener('keydown', handleEscape);
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition, true);
        }
        return () => {
            document.removeEventListener('pointerdown', handlePointerOutside);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    React.useEffect(() => {
        if (!dropdownGroup) return;

        const handleSelectOpen = (event) => {
            const detail = event.detail || {};
            if (detail.group === dropdownGroup && detail.id !== selectId) {
                setIsOpen(false);
            }
        };

        document.addEventListener('custom-select:open', handleSelectOpen);
        return () => document.removeEventListener('custom-select:open', handleSelectOpen);
    }, [dropdownGroup, selectId]);

    const handleSelect = (nextValue) => {
        if (disabled) return;
        onChange?.({ target: { name, value: String(nextValue) } });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden="true"
                    className="absolute h-0 w-0 opacity-0 pointer-events-none"
                    name={name}
                    value={currentValue}
                    onChange={() => { }}
                    required={required}
                />
            )}

            <button
                ref={(node) => {
                    buttonRef.current = node;
                    if (typeof ref === 'function') ref(node);
                    else if (ref) ref.current = node;
                }}
                type="button"
                data-custom-select-trigger="true"
                disabled={disabled}
                onClick={() => {
                    if (!isOpen) {
                        updatePosition();
                        if (dropdownGroup) {
                            document.dispatchEvent(new CustomEvent('custom-select:open', {
                                detail: { id: selectId, group: dropdownGroup }
                            }));
                        }
                    }
                    setIsOpen((prev) => !prev);
                }}
                onKeyDown={onKeyDown}
                {...rest}
                className={cn(
                    className,
                    "flex items-center justify-between text-left",
                    disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"
                )}
            >
                <span className={cn("min-w-0 flex-1 truncate pr-3", buttonLabelClassName)}>{buttonLabel}</span>
                <svg className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform", isOpen ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    data-custom-select-dropdown="true"
                    style={dropdownStyles}
                    className={cn(
                        "z-[9999] bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        dropdownClassName
                    )}
                >
                    <div className={cn("max-h-[168px] overflow-y-auto no-scrollbar p-1", dropdownContentClassName)}>
                        {options.map((option) => {
                            const isSelected = option.value === currentValue;
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    disabled={option.disabled}
                                    onClick={() => handleSelect(option.value)}
                                    className={cn(
                                        "w-full rounded-lg px-3 py-2 text-[12px] text-left transition-colors flex items-center justify-between",
                                        option.disabled ? "text-gray-300 cursor-not-allowed" : "hover:bg-slate-50",
                                        isSelected ? "bg-slate-100 font-bold text-slate-900" : "text-slate-700 font-medium"
                                    )}
                                >
                                    <span className={cn("block w-full pr-1 whitespace-normal break-all leading-snug", optionLabelClassName)}>{option.label}</span>
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

CustomSelect.displayName = 'CustomSelect';

export default CustomSelect;
