import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Save, Check, Camera, X, Pencil, Trash2 } from 'lucide-react';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreferences } from '../../context/PreferenceContext';
import { cn } from '../../utils/cn';
import { PreferenceSettingsFields } from '../settings/components/PreferenceSettingsSection';

const Profile = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const { showToast } = useToast();
    const { preferences, updatePreferences } = usePreferences();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        profilePhoto: ''
    });
    const [draftPreferences, setDraftPreferences] = useState(preferences);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteOption, setShowDeleteOption] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                email: user.email || '',
                profilePhoto: user.profilePhoto || ''
            }));
        }
    }, [user]);

    useEffect(() => {
        setDraftPreferences(preferences);
    }, [preferences]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size should be less than 5MB');
                showToast('Image size should be less than 5MB', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result;
                setFormData(prev => ({ ...prev, profilePhoto: base64data }));
                
                setIsLoading(true);
                try {
                    await updateUser({ profilePhoto: base64data });
                    showToast('Profile photo updated', 'success');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                } catch (err) {
                    showToast('Failed to update photo', 'error');
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = async (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        setIsLoading(true);
        try {
            await updateUser({ profilePhoto: '' });
            setFormData(prev => ({ ...prev, profilePhoto: '' }));
            setShowDeleteOption(false);
            showToast('Profile photo removed', 'success');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            showToast('Failed to remove photo', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreferenceChange = (e) => {
        const { name, value } = e.target;
        setDraftPreferences((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsLoading(true);
        setError('');

        try {
            const profileChanges = {};
            if ((formData.name || '') !== (user?.name || '')) profileChanges.name = formData.name;
            if ((formData.email || '') !== (user?.email || '')) profileChanges.email = formData.email;
            if ((formData.profilePhoto || '') !== (user?.profilePhoto || '')) profileChanges.profilePhoto = formData.profilePhoto;

            const preferenceChanges = Object.entries(draftPreferences || {}).reduce((acc, [key, value]) => {
                if (preferences?.[key] !== value) {
                    acc[key] = value;
                }
                return acc;
            }, {});

            if (Object.keys(profileChanges).length > 0) {
                await updateUser(profileChanges);
            }

            if (Object.keys(preferenceChanges).length > 0) {
                await updatePreferences(preferenceChanges);
            }

            showToast('Changes saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save changes', error);
            setError(error.response?.data?.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden relative bg-white">

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="px-6 py-4 w-full max-w-2xl">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                        {error && (
                            <div className="bg-red-50 text-red-500 text-[13px] p-3 rounded">
                                {error}
                            </div>
                        )}

                        {/* Row 1: Profile & Basic Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-6 items-start">
                            {/* Profile Picture */}
                            <div className="flex flex-col items-start min-w-[70px] pt-1">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-[56px] h-[56px] rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                                            {formData.profilePhoto ? (
                                                <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={24} className="text-gray-400" />
                                            )}
                                            {isLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                                    <Loader className="h-4 w-4 text-[#4A8AF4]" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowDeleteOption(!showDeleteOption);
                                            }}
                                            className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-10"
                                        >
                                            <Pencil size={12} className="text-gray-600" />
                                        </button>

                                        {showDeleteOption && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-20" 
                                                    onClick={() => setShowDeleteOption(false)}
                                                />
                                                <div className="absolute top-[calc(100%+12px)] left-[calc(100%-12px)] w-36 bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-gray-100 z-30 py-1.5 overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowDeleteOption(false);
                                                            fileInputRef.current?.click();
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <Camera size={15} className="text-gray-600" />
                                                        Capture
                                                    </button>
                                                    {formData.profilePhoto && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                setShowDeleteOption(false);
                                                                handleRemovePhoto(e);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 size={15} className="text-red-600" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                                </div>
                            </div>

                            {/* Full Name */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full h-[36px] px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all text-[13px]"
                                    required
                                />
                            </div>

                            {/* Email Address */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full h-[36px] px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20 focus:border-[#4A8AF4] transition-all text-[13px]"
                                    required
                                />
                            </div>
                        </div>

                        {/* Preferences */}
                        <div>
                            <h3 className="text-[14px] font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">Preferences</h3>
                            <PreferenceSettingsFields
                                draftPreferences={draftPreferences}
                                onChange={handlePreferenceChange}
                            />
                        </div>

                        {/* Actions */}
                        <div className="pt-2 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ name: user.name || '', email: user.email || '', profilePhoto: user.profilePhoto || '' })}
                                className="h-[36px] px-4 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="h-[36px] px-6 bg-[#4A8AF4] text-white text-[13px] font-bold rounded-md hover:bg-[#3b7eed] transition-all shadow-sm flex items-center justify-center gap-1.5 min-w-[120px]"
                            >
                                {isLoading ? (
                                    <Loader className="h-4 w-4 text-white" />
                                ) : (
                                    <>
                                        <Save size={15} strokeWidth={2.5} />
                                        Save
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
