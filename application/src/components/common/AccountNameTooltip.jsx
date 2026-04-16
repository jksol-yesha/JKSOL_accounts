import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

const ACCOUNT_NAME_TOOLTIP_MAX_WIDTH = 280;
const ACCOUNT_NAME_TOOLTIP_MIN_WIDTH = 160;
const ACCOUNT_NAME_TOOLTIP_GAP = 8;
const ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER = 12;

const AccountNameTooltip = ({ name, className = '', textClassName = '' }) => {
    const [visible, setVisible] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);
    const textRef = useRef(null);
    const content = name || '-';
    // Enable tooltip if truncated or name is reasonably long
    const shouldEnableTooltip = isTruncated || content.trim().length >= 18;

    const measureTruncation = () => {
        const wrapperNode = wrapperRef.current;
        const textNode = textRef.current;
        if (!wrapperNode || !textNode) return false;

        const truncated = (
            textNode.scrollWidth > textNode.clientWidth + 1 ||
            wrapperNode.scrollWidth > wrapperNode.clientWidth + 1
        );

        setIsTruncated(truncated);
        return truncated;
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let frameId = null;

        const scheduleMeasurement = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                measureTruncation();
            });
        };

        scheduleMeasurement();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => scheduleMeasurement())
            : null;

        if (wrapperRef.current) {
            resizeObserver?.observe(wrapperRef.current);
        }
        if (textRef.current) {
            resizeObserver?.observe(textRef.current);
        }

        window.addEventListener('resize', scheduleMeasurement);
        document.fonts?.ready?.then(() => scheduleMeasurement()).catch(() => {});

        return () => {
            window.removeEventListener('resize', scheduleMeasurement);
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            resizeObserver?.disconnect();
        };
    }, [name]);

    useLayoutEffect(() => {
        if (!visible || !wrapperRef.current) return undefined;

        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const tooltipWidth = Math.min(
                ACCOUNT_NAME_TOOLTIP_MAX_WIDTH,
                Math.max(ACCOUNT_NAME_TOOLTIP_MIN_WIDTH, rect.width + 24)
            );

            let left = rect.left;
            if (left + tooltipWidth > viewportWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = viewportWidth - tooltipWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }
            if (left < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                left = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            let top = rect.bottom + ACCOUNT_NAME_TOOLTIP_GAP;
            const estimatedHeight = 44;
            if (top + estimatedHeight > viewportHeight - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = rect.top - estimatedHeight - ACCOUNT_NAME_TOOLTIP_GAP;
            }
            if (top < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
                top = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
            }

            setPosition({ top, left, width: tooltipWidth });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [visible]);

    return (
        <>
            <span
                ref={wrapperRef}
                className={cn('block max-w-full min-w-0', className)}
                onMouseEnter={() => {
                    if (measureTruncation() || content.trim().length >= 18) {
                        setVisible(true);
                    }
                }}
                onMouseLeave={() => setVisible(false)}
            >
                <span ref={textRef} className={cn('block truncate', textClassName)}>
                    {content}
                </span>
            </span>

            {visible && position && createPortal(
                <div
                    className="pointer-events-none fixed z-[9999] rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                    style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px` }}
                >
                    <span className="block whitespace-nowrap text-[12px] font-semibold leading-relaxed text-gray-700">
                        {content}
                    </span>
                </div>,
                document.body
            )}
        </>
    );
};

export default AccountNameTooltip;
