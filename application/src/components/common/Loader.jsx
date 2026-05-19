import React from 'react';
import { cn } from '../../utils/cn';

const BAR_LOADER_ANIMATION_NAME = 'codex-bar-loader-rise';
const BAR_LOADER_STYLES = `
@keyframes ${BAR_LOADER_ANIMATION_NAME} {
    0%, 100% {
        transform: translateY(0) scaleY(0.52);
        opacity: 0.42;
    }
    50% {
        transform: translateY(-18%) scaleY(1);
        opacity: 1;
    }
}
`;

export const Loader = ({
    className = "h-5 w-5 text-[#4A8AF4]",
    strokeWidth = 1.75,
}) => (
    <>
        <style>{BAR_LOADER_STYLES}</style>
        <span
            className={cn(
                "inline-flex items-end justify-center gap-[12%] align-middle",
                className,
            )}
            aria-hidden="true"
        >
            {[0, 0.15, 0.3].map((delay, index) => (
                <span
                    key={index}
                    className="block h-[44%] w-[18%] min-w-[2px] rounded-[3px] border border-current bg-transparent origin-bottom"
                    style={{
                        borderWidth: `${strokeWidth}px`,
                        animation: `${BAR_LOADER_ANIMATION_NAME} 1s ease-in-out infinite`,
                        animationDelay: `${delay}s`,
                    }}
                />
            ))}
        </span>
    </>
);

export const OverlayLoader = ({ 
    text = "Processing...", 
    containerClassName = "absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-[2px]" 
}) => (
    <div className={containerClassName}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#4A8AF4]/30 bg-white/90 px-8 py-6 shadow-lg">
            <Loader className="h-8 w-8 text-[#4A8AF4]" />
        </div>
    </div>
);
