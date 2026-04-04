import React, { useEffect, useState } from 'react';
import { Check, Building2, X } from 'lucide-react';

const BranchAccessNotification = ({ notification, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Auto-dismiss after 10 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for animation
        }, 10000);

        return () => clearTimeout(timer);
    }, [onClose]);

    if (!isVisible) return null;

    const { organizationName, updatedBy, roleChanged, newRole, addedBranches } = notification;

    return (
        <div className="fixed top-24 right-6 z-[999] animate-slide-in-right">
            <div className="bg-white border-2 border-black rounded-xl shadow-2xl w-80 overflow-hidden">
                {/* Header */}
                <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                            <Building2 className="text-black" size={18} />
                        </div>
                        <span className="font-bold text-sm">Branch Access Updated</span>
                    </div>
                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onClose, 300);
                        }}
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">{updatedBy}</span> has updated your access in{' '}
                        <span className="font-bold">{organizationName}</span>
                    </p>

                    {roleChanged && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <Check size={16} className="text-blue-600" />
                            <span className="text-xs font-bold text-blue-900">
                                Role changed to: {newRole?.toUpperCase()}
                            </span>
                        </div>
                    )}

                    {addedBranches && addedBranches.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase">
                                New Branch Access:
                            </p>
                            <div className="space-y-1">
                                {addedBranches.map((branch, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200"
                                    >
                                        <Check size={14} className="text-green-600" />
                                        <span className="text-xs font-bold text-green-900">
                                            {branch}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(!addedBranches || addedBranches.length === 0) && !roleChanged && (
                        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-600">
                                Your branch access has been updated
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BranchAccessNotification;
