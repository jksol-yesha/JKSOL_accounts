import React from 'react';
import { cn } from '../../utils/cn';

const Button = ({
    children,
    className,
    variant = 'primary',
    size = 'md',
    ...props
}) => {
    const variants = {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
        ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
        link: 'bg-transparent text-primary hover:underline px-0',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg',
    };

    return (
        <button
            className={cn(
                "rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
