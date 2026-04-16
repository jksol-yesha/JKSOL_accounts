import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Save, Check, Camera, Loader2, X } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
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
    const [showSuccess, setShowSuccess] = useState(false);
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
            await updateUser({ profilePhoto: null });
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

            setShowSuccess(true);

            setTimeout(() => {
                setShowSuccess(false);
            }, 3000); // Increased time slightly for visibility
        } catch (error) {
            console.error('Failed to save changes', error);
            setError(error.response?.data?.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden relative bg-white">
            <PageHeader
                title="My Profile"
                breadcrumbs={['Settings', 'Profile']}
            />

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <form onSubmit={handleSubmit}>
                    <Card className="space-y-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                        <div className="max-w-3xl mx-auto w-full">
                            {error && (
                                <div className="bg-red-50 text-red-500 text-sm p-3 rounded text-center mx-4 mt-4 lg:mx-8">
                                    {error}
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-b border-gray-50 pb-8 relative">
                                <div 
                                    className="relative group/profile-img cursor-pointer"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const nextState = !showDeleteOption;
                                        setShowDeleteOption(nextState);
                                        showToast(`Toggled: ${nextState ? 'Show' : 'Hide'}`, 'info', { duration: 1000 });
                                    }}
                                >
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm flex-none bg-gray-100">
                                        {formData.profilePhoto ? (
                                            <img
                                                src={formData.profilePhoto}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <User size={40} />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        className="absolute bottom-0 right-0 bg-black text-white p-1.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors z-10"
                                    >
                                        <Camera size={16} />
                                    </button>

                                    {/* Saving Overaly */}
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-full z-20">
                                            <Loader2 size={24} className="animate-spin text-black" />
                                        </div>
                                    )}

                                    {formData.profilePhoto && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                handleRemovePhoto(e);
                                            }}
                                            title="Remove Photo"
                                            className={cn(
                                                "absolute -top-1 -right-1 bg-white text-black p-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 transition-all hover:bg-slate-50 z-30",
                                                showDeleteOption ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
                                            )}
                                        >
                                            <X size={14} strokeWidth={2.5} />
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>

                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
                                    <div className="flex items-center gap-2 mt-3 text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg w-fit">
                                        <Calendar size={14} />
                                        <span>Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : (user?.memberSince || 'N/A')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            <User size={14} />
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full px-4 h-11 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-2 focus:ring-primary/5 transition-all placeholder:text-gray-400"
                                            placeholder="Enter your full name"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            <Mail size={14} />
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full px-4 h-11 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-2 focus:ring-primary/5 transition-all placeholder:text-gray-400"
                                            placeholder="Enter your email"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 mt-8 border-t border-gray-50">
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-800">Preference Settings</h3>
                                </div>
                                <PreferenceSettingsFields
                                    draftPreferences={draftPreferences}
                                    onChange={handlePreferenceChange}
                                />
                            </div>

                            <div className="pt-6 border-t border-gray-50 flex items-center justify-end gap-3">
                                <div className="flex items-center gap-3 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/dashboard')}
                                        className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center text-white bg-black hover:bg-black/90 transition-all shadow-lg active:scale-95 shadow-black/20",
                                            isLoading && "opacity-70 cursor-not-allowed"
                                        )}
                                    >
                                        {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Check size={28} strokeWidth={3.5} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>
                    </form>
                </div>
            </div>

            {/* Success Popup Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 animate-[bounce_1s_infinite]">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Changes Saved!</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Your changes have been successfully saved.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
