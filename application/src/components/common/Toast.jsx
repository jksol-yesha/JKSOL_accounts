import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

const Toast = ({
    message,
    type = 'success',
    title,
    onClose,
    duration = 3000,
    persistent = false
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        if (persistent || duration <= 0) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for exit animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose, persistent]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const resolvedTitle = title || (type === 'success' ? 'Success' : 'Error');

    return (
        <div
            className={cn(
                "fixed top-4 right-4 z-[100] flex items-center p-4 rounded-xl shadow-lg border transition-all duration-300 transform",
                isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none",
                type === 'success' ? "bg-white border-emerald-100" : "bg-white border-rose-100"
            )}
            role="alert"
            aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0",
                type === 'success' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
            )}>
                {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
            </div>
            <div className="mr-8">
                <p className="text-[13px] font-bold text-gray-800">{resolvedTitle}</p>
                <p className="text-[12px] font-medium text-gray-500">{message}</p>
            </div>
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export default Toast;
