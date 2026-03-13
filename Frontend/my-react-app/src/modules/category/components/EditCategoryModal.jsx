import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import CustomSelect from '../../../components/common/CustomSelect';

const EditCategoryModal = ({ isOpen, onClose, category, branches = [], onSave }) => {
    const [formData, setFormData] = useState({ name: '', type: 'Expense', icon: '', status: 1 });
    const targetBranchIds = branches.map(b => b.id);

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                type: category.txnType ? (category.txnType.charAt(0).toUpperCase() + category.txnType.slice(1)) : (category.type || 'Expense'),
                icon: category.icon || '',
                status: (category.status === 2 || category.status === 'inactive') ? 2 : 1
            });
        }
    }, [category]);

    if (!isOpen || !category) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(category.id, formData, targetBranchIds, category);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-[17px] font-extrabold text-slate-800 tracking-tight">Edit Category</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-lg transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Category Name */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Category Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                            required
                        />
                    </div>

                    {/* Type + Status for main categories */}
                    {!category?.parentId && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Type</label>
                                <CustomSelect
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                >
                                    <option value="Expense">Expense</option>
                                    <option value="Income">Income</option>
                                    <option value="Investment">Investment</option>
                                </CustomSelect>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Status</label>
                                <CustomSelect
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                                >
                                    <option value={1}>Active</option>
                                    <option value={2}>Inactive</option>
                                </CustomSelect>
                            </div>
                        </div>
                    )}

                    {/* Status for sub-categories */}
                    {category?.parentId && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">Status</label>
                            <CustomSelect
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-bold text-slate-700 outline-none focus:border-black transition-all"
                            >
                                <option value={1}>Active</option>
                                <option value={2}>Inactive</option>
                            </CustomSelect>
                        </div>
                    )}

                    <div className="pt-4 flex space-x-3">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 text-[13px] font-extrabold py-3 rounded-xl transition-all hover:bg-gray-200">
                            Cancel
                        </button>
                        <button type="submit" className="flex-1 bg-black text-white text-[13px] font-extrabold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2">
                            <Save size={18} />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditCategoryModal;
