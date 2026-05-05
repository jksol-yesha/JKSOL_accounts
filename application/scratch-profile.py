import re

content = """import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Save, Check, Camera, X, Building2, Users as UsersIcon, Store, Edit2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useOrganization } from '../../context/OrganizationContext';
import apiService from '../../services/api';
import { cn } from '../../utils/cn';
import { PreferenceSettingsFields } from '../settings/components/PreferenceSettingsSection';

const Profile = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const { showToast } = useToast();
    const { selectedOrg } = useOrganization();
    const { preferences, updatePreferences } = usePreferences();
    
    const [activeTab, setActiveTab] = useState('Personal');
    const [isEditing, setIsEditing] = useState(false);
    
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
    
    const [organizations, setOrganizations] = useState([]);
    const [orgUsers, setOrgUsers] = useState([]);
    const [orgBranches, setOrgBranches] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchRelatedData = async () => {
            setIsLoadingData(true);
            try {
                const [orgsResponse, usersResponse, branchesResponse] = await Promise.all([
                    apiService.orgs.getAll().catch(() => ({ orgs: [] })),
                    selectedOrg?.id ? apiService.organizations.getMembers(selectedOrg.id).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
                    selectedOrg?.id ? apiService.branches.getAll({ headers: { 'x-org-id': selectedOrg.id } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
                ]);

                let orgList = ((orgsResponse?.data || orgsResponse)?.orgs || []).map(item => item.org || item);
                if (orgList.length === 0 && selectedOrg) {
                    orgList = [selectedOrg];
                } else if (!orgList.some(o => o.id === selectedOrg?.id) && selectedOrg) {
                    orgList.unshift(selectedOrg);
                }
                setOrganizations(orgList);

                const usersList = Array.isArray(usersResponse?.data) ? usersResponse.data : Array.isArray(usersResponse) ? usersResponse : [];
                setOrgUsers(usersList);

                const branchesList = Array.isArray(branchesResponse?.data) ? branchesResponse.data : Array.isArray(branchesResponse) ? branchesResponse : [];
                setOrgBranches(branchesList);
            } catch (err) {
                console.error("Failed to load related data:", err);
            } finally {
                setIsLoadingData(false);
            }
        };
        if (selectedOrg) {
            fetchRelatedData();
        }
    }, [selectedOrg]);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                profilePhoto: user.profilePhoto || ''
            });
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

                if (!isEditing) {
                    // Auto-save if they change photo while not in full edit mode
                    setIsLoading(true);
                    try {
                        await updateUser({ profilePhoto: base64data });
                        showToast('Profile photo updated', 'success');
                    } catch (err) {
                        showToast('Failed to update photo', 'error');
                    } finally {
                        setIsLoading(false);
                    }
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = async (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        setFormData(prev => ({ ...prev, profilePhoto: '' }));
        setShowDeleteOption(false);
        
        if (!isEditing) {
            setIsLoading(true);
            try {
                await updateUser({ profilePhoto: null });
                showToast('Profile photo removed', 'success');
            } catch (err) {
                showToast('Failed to remove photo', 'error');
            } finally {
                setIsLoading(false);
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
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
            setIsEditing(false);

            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        } catch (error) {
            console.error('Failed to save changes', error);
            setError(error.response?.data?.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = ['Personal', 'Preferences', 'Organization', 'Users'];

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden relative bg-[#fafafa]">
            {/* Top Navigation Tabs matching screenshot */}
            <div className="bg-white px-6 pt-2 border-b border-gray-100 flex gap-8 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "pb-3 text-[13px] font-semibold transition-colors relative",
                            activeTab === tab 
                                ? "text-[#4A8AF4]" 
                                : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#4A8AF4]" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                <div className="p-4 lg:p-6 lg:pt-6 max-w-[1400px] mx-auto w-full animate-in fade-in duration-300">
                    
                    {error && (
                        <div className="bg-red-50 text-red-500 text-sm p-3 rounded mb-4 w-full">
                            {error}
                        </div>
                    )}

                    {activeTab === 'Personal' && (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Edit Button Header Area */}
                            <div className="flex justify-end items-center">
                                {!isEditing ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-blue-50 text-blue-500 text-[11px] font-bold tracking-wide hover:bg-blue-100 transition-colors pointer-events-auto"
                                    >
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                // Reset local changes
                                                setFormData({
                                                    name: user?.name || '',
                                                    email: user?.email || '',
                                                    profilePhoto: user?.profilePhoto || ''
                                                });
                                                setError('');
                                            }}
                                            className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wide hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={cn(
                                                "h-[30px] px-5 inline-flex items-center justify-center gap-1.5 rounded bg-[#4A8AF4] text-white text-[11px] font-bold tracking-wide transition-colors pointer-events-auto shadow-sm",
                                                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-600 active:scale-95"
                                            )}
                                        >
                                            {isLoading ? <Loader className="h-3 w-3 text-white" /> : "Save"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Main Card */}
                            <div className="bg-white border border-gray-100 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
                                
                                {/* Photo Row */}
                                <div className="flex px-6 py-4 border-b border-gray-100/60 hover:bg-slate-50/30 transition-colors items-center">
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        User Profile
                                    </div>
                                    <div className="flex-1 flex items-center">
                                        <div 
                                            className={cn("relative group/profile-img", isEditing && "cursor-pointer")}
                                            onClick={() => { if(isEditing) fileInputRef.current?.click(); }}
                                        >
                                            <div className="w-[42px] h-[42px] rounded-full overflow-hidden ring-1 ring-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                                                {formData.profilePhoto ? (
                                                    <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={20} className="text-slate-400 stroke-[1.5]" />
                                                )}
                                            </div>
                                            
                                            {isEditing && (
                                                <div className="absolute -bottom-1 -right-1 bg-white text-gray-600 p-0.5 rounded-full border border-gray-200 shadow-sm cursor-pointer hover:text-[#4A8AF4]">
                                                    <Edit2 size={10} strokeWidth={2.5} />
                                                </div>
                                            )}
                                            {isEditing && formData.profilePhoto && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleRemovePhoto(e)}
                                                    className="absolute -top-1 -right-1 hidden group-hover/profile-img:flex bg-red-100 text-red-500 rounded-full p-0.5 z-10"
                                                >
                                                    <X size={10} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                                    </div>
                                </div>

                                {/* Name Row */}
                                <div className="flex px-6 border-b border-gray-100/60 hover:bg-slate-50/30 transition-colors items-center h-[52px]">
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        Name
                                    </div>
                                    <div className="flex-1 flex items-center self-stretch py-1">
                                        {!isEditing ? (
                                            <div className="text-[13px] text-gray-500 font-medium">{formData.name}</div>
                                        ) : (
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="w-full max-w-md px-3 h-full bg-[#f1f3f9] border border-transparent rounded-md text-[13px] font-semibold text-gray-700 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-1 focus:ring-primary/10 transition-all placeholder:text-gray-400"
                                                placeholder="Enter your full name"
                                                required
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Email Row */}
                                <div className="flex px-6 hover:bg-slate-50/30 transition-colors items-center h-[52px]">
                                    <div className="w-52 shrink-0 text-[13px] font-bold text-gray-800">
                                        Email
                                    </div>
                                    <div className="flex-1 flex items-center self-stretch py-1">
                                        {!isEditing ? (
                                            <div className="text-[13px] text-gray-500 font-medium">{formData.email}</div>
                                        ) : (
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                className="w-full max-w-md px-3 h-full bg-[#f1f3f9] border border-transparent rounded-md text-[13px] font-semibold text-gray-700 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-1 focus:ring-primary/10 transition-all placeholder:text-gray-400"
                                                placeholder="Enter your email"
                                                required
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}

                    {activeTab === 'Preferences' && (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex justify-end items-center">
                                {!isEditing ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-blue-50 text-blue-500 text-[11px] font-bold tracking-wide hover:bg-blue-100 transition-colors"
                                    >
                                        Edit Preferences
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setDraftPreferences(preferences);
                                                setError('');
                                            }}
                                            className="h-[30px] px-3.5 inline-flex items-center gap-1.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wide hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className={cn(
                                                "h-[30px] px-5 inline-flex items-center justify-center gap-1.5 rounded bg-[#4A8AF4] text-white text-[11px] font-bold tracking-wide transition-colors shadow-sm",
                                                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-600 active:scale-95"
                                            )}
                                        >
                                            {isLoading ? <Loader className="h-3 w-3 text-white" /> : "Save"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className={cn(
                                "bg-white border border-gray-100 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] pt-2 pb-4",
                                !isEditing && "opacity-80 pointer-events-none"
                            )}>
                                <PreferenceSettingsFields
                                    draftPreferences={draftPreferences}
                                    onChange={handlePreferenceChange}
                                />
                            </div>
                        </form>
                    )}

                    {activeTab === 'Organization' && (
                        <div className="w-full max-w-xl">
                            <div className="flex flex-col p-5 rounded-xl bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] shrink-0 transition-all">
                                <div className="flex items-center justify-between border-b border-gray-100/60 pb-4 mb-4">
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-slate-100">
                                            {selectedOrg?.logo ? (
                                                <img src={selectedOrg.logo} alt={selectedOrg?.name || 'Org Logo'} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full text-indigo-400 flex items-center justify-center">
                                                    <Building2 size={18} strokeWidth={2} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-slate-800 leading-none mb-1.5">{selectedOrg?.name || 'Loading...'}</div>
                                            <div className="text-[11px] text-slate-400 font-medium">Active Workplace</div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 ml-3 px-2 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] uppercase font-bold tracking-widest">
                                        Current
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Branches</h4>
                                    {orgBranches.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {orgBranches.map(branch => (
                                                <div key={branch.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f9fafd] border border-slate-100/50">
                                                    <div className="text-slate-400 shrink-0">
                                                        <Store size={15} strokeWidth={2} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-[13px] font-semibold text-slate-700 truncate">{branch.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        !isLoadingData && (
                                            <div className="flex items-center gap-2.5 text-slate-400 p-2">
                                                <Store size={14} strokeWidth={2} className="shrink-0" />
                                                <div className="text-[12px] font-medium opacity-80">No branches created</div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Users' && (
                        <div className="w-full max-w-xl">
                            <div className="flex flex-col p-5 rounded-xl bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] min-h-0 transition-all">
                                <div className="flex items-center justify-between pb-4 border-b border-gray-100/60 mb-4 shrink-0">
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="p-2 bg-[#f9fafd] text-slate-600 rounded-lg shrink-0 ring-1 ring-slate-100">
                                            <UsersIcon size={18} strokeWidth={2} />
                                        </div>
                                        <div className="text-[14px] font-bold text-slate-800 leading-none">Team Members</div>
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded">
                                        {orgUsers.length || 0} Total
                                    </div>
                                </div>

                                <div>
                                    {isLoadingData ? (
                                        <div className="w-full py-8 flex items-center justify-center">
                                            <Loader className="h-5 w-5 text-gray-400" />
                                        </div>
                                    ) : orgUsers.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {orgUsers.map(member => (
                                                <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f9fafd] border border-slate-100/50">
                                                    <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4A8AF4] shadow-sm border border-blue-100">
                                                        {(member.name || member.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-semibold text-slate-700 truncate mb-0.5">{member.name || member.email}</div>
                                                        {(member.name && member.email) && <div className="text-[11px] text-slate-400 truncate">{member.email}</div>}
                                                    </div>
                                                    <div className="shrink-0 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
                                                        {member.role || 'MEMBER'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2.5 text-slate-400 p-2">
                                            <UsersIcon size={14} strokeWidth={2} className="shrink-0 opacity-50" />
                                            <div className="text-[12px] font-medium opacity-80">No users found</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Success Popup Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#4A8AF4] animate-[bounce_1s_infinite]">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Changes Saved!</h3>
                        <p className="text-gray-500 text-center text-sm">
                            Your settings were successfully updated.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
"""

with open("/Users/erasoft/Downloads/local-live copy 23/application/src/modules/profile/Profile.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("done")
