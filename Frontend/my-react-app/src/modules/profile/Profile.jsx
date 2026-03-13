import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Save, Check, Camera, LogOut } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

const Profile = () => {
    const navigate = useNavigate();
    const { user, updateUser, logout } = useAuth(); // Destructure logout logic
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        profilePhoto: ''
    });
    const [isLoading, setIsLoading] = useState(false);
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('Image size should be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profilePhoto: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsLoading(true);
        setError('');

        try {
            const updatePayload = {
                name: formData.name,
                email: formData.email,
                profilePhoto: formData.profilePhoto
            };

            await updateUser(updatePayload);
            setShowSuccess(true);

            setTimeout(() => {
                setShowSuccess(false);
            }, 3000); // Increased time slightly for visibility
        } catch (error) {
            console.error('Failed to update profile', error);
            setError(error.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen relative">
            <PageHeader
                title="My Profile"
                breadcrumbs={['Settings', 'Profile']}
            />

            <div className="p-4 lg:p-8 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleSubmit}>
                    <Card className="space-y-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm p-3 rounded text-center mx-4 mt-4 lg:mx-8">
                                {error}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-b border-gray-50 pb-8 relative">
                            <div className="relative group">
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
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 bg-black text-white p-1.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
                                >
                                    <Camera size={16} />
                                </button>
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
                                {/* Name Input */}
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

                                {/* Email Input */}
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
                                        "px-8 py-3 rounded-xl text-sm font-bold text-white bg-black hover:bg-black/90 transition-all shadow-lg active:scale-95 flex items-center gap-2",
                                        isLoading && "opacity-70 cursor-not-allowed"
                                    )}
                                >
                                    <Save size={18} />
                                    <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>
                        </div>
                    </Card>
                </form>
            </div>

            {/* Success Popup Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 animate-[bounce_1s_infinite]">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Profile Updated!</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Your profile information has been successfully updated.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
