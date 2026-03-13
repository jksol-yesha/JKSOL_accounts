import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../utils/cn';

const QuickAddSubModal = ({ isOpen, onClose, parentCategory, onSave }) => {
    const [subName, setSubName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSubName('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!subName) return;
        onSave({ parentId: parentCategory.id, name: subName });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-[17px] font-extrabold text-slate-800 tracking-tight flex items-baseline">
                        Quick Add Sub to: <span className="ml-2 text-emerald-600">{parentCategory.name}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[13px] font-extrabold text-slate-600 tracking-tight pl-1">Parent</label>
                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-400">
                            {parentCategory.name}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] font-extrabold text-slate-600 tracking-tight pl-1">Sub Name</label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={subName}
                            onChange={(e) => setSubName(e.target.value)}
                            placeholder="Enter sub-category name"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[15px] font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95"
                    >
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
    );
};

export default QuickAddSubModal;
