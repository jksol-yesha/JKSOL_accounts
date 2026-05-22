import React, { useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePreferences } from '../../context/PreferenceContext';
import { cn } from '../../utils/cn';

const CompactCurrency = ({ amount, currencyOverride = null, className = '', placement = 'top' }) => {
    const { formatCompactCurrency, formatCurrency } = usePreferences();
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);

    const compactText = formatCompactCurrency(amount, currencyOverride);
    const fullText = formatCurrency(amount, currencyOverride);

    useLayoutEffect(() => {
        if (!visible || !wrapperRef.current) return undefined;

        const updatePosition = () => {
            const rect = wrapperRef.current.getBoundingClientRect();
            
            // Center tooltip relative to the text
            let left = rect.left + (rect.width / 2);
            let top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
            
            setPosition({ top, left });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [visible]);

    // If they are exactly the same, no need for tooltip
    if (compactText === fullText) {
        return <span className={className}>{compactText}</span>;
    }

    return (
        <>
            <span className={className}>
                <span
                    ref={wrapperRef}
                    className="cursor-default relative inline-block"
                    onMouseEnter={() => setVisible(true)}
                    onMouseLeave={() => setVisible(false)}
                >
                    {compactText}
                </span>
            </span>

            {visible && position && createPortal(
                <div
                    className="pointer-events-none fixed z-[10000] rounded-md bg-slate-800 px-2.5 py-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                        top: `${position.top}px`, 
                        left: `${position.left}px`,
                        transform: placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
                    }}
                >
                    <span className="block whitespace-nowrap text-[11px] font-semibold text-white tracking-wide">
                        {fullText}
                    </span>
                    {/* Tooltip Arrow */}
                    {placement === 'top' ? (
                        <div 
                            className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-800" 
                        />
                    ) : (
                        <div 
                            className="absolute left-1/2 bottom-full -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-slate-800" 
                        />
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

export default CompactCurrency;
