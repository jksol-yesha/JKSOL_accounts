import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, ChevronRight, LogOut } from 'lucide-react';
import AuthLayout from '../auth/AuthLayout';
import apiService from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CreateOrganizationModal from '../organizations/components/CreateOrganizationModal';

const Onboarding = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [availableBranches, setAvailableBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showOrgModal, setShowOrgModal] = useState(false);

    useEffect(() => {
        // Auto-redirection: If organization and branch are already pre-selected (e.g. from invitation flow)
        const storedOrg = localStorage.getItem('selectedOrg');
        const storedBranch = localStorage.getItem('selectedBranch');

        if (storedOrg && storedBranch) {
            navigate('/dashboard');
            return;
        }

        fetchOrganizations();
    }, [navigate]);

    const fetchOrganizations = async () => {
        try {
            const response = await apiService.orgs.getAll();
            // Handle various response structures
            let orgsData = [];
            if (Array.isArray(response)) {
                orgsData = response;
            } else if (response?.data && Array.isArray(response.data)) {
                orgsData = response.data;
            } else if (response?.orgs && Array.isArray(response.orgs)) {
                orgsData = response.orgs;
            } else if (response?.organizations && Array.isArray(response.organizations)) {
                orgsData = response.organizations;
            }

            // Map if necessary (sometimes backend wraps like { org: {...} })
            const sanitizedOrgs = orgsData.map(item => item.org || item);

            setOrganizations(sanitizedOrgs);
        } catch (error) {
            console.error("Failed to fetch organizations", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOrgChange = (e) => {
        const orgId = e.target.value;
        setSelectedOrg(orgId);
        setSelectedBranch('');

        const org = organizations.find(o => String(o.id) === String(orgId));
        if (org && org.defaultBranchName) {
            setSelectedBranch(org.defaultBranchName);
            // In a real app, you might fetch branches for this org here
            // For now, we'll just use the default one + some mocks if needed
            setAvailableBranches([org.defaultBranchName]);
        } else {
            setAvailableBranches([]);
        }
    };

    const handleOrgCreated = (newOrg) => {
        // Refresh list
        fetchOrganizations();
        // Auto select the new org
        setSelectedOrg(newOrg.id);
        if (newOrg.defaultBranchName) {
            setSelectedBranch(newOrg.defaultBranchName);
            setAvailableBranches([newOrg.defaultBranchName]);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedOrg) {
            const orgObj = organizations.find(o => String(o.id) === String(selectedOrg));
            if (orgObj) {
                localStorage.setItem('selectedOrg', JSON.stringify(orgObj));
                if (selectedBranch) {
                    // If it's a string from our local state, we need to be careful.
                    // Ideally we should have branch objects.
                    // For onboarding simplified flow, we'll just store the name if that's all we have,
                    // but the rest of the app expects an object with an ID.
                    // Check if we can find a branch object or create a minimal one.
                    localStorage.setItem('selectedBranch', JSON.stringify({ name: selectedBranch, id: null }));
                }
            }
            navigate('/dashboard');
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <AuthLayout
            title="Select Organization"
            subtitle="Choose an organization to access your account"
        >
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <p className="text-sm text-gray-500 font-medium">Loading...</p>
                </div>
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Organization Selection */}
                        <div className="flex flex-col">
                            <div className="flex items-center space-x-3 mb-2">
                                {(['OWNER', 'owner'].includes(user?.globalRole?.toLowerCase())) && (
                                    <button
                                        type="button"
                                        onClick={() => setShowOrgModal(true)}
                                        className="w-8 h-8 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center shrink-0 shadow-sm"
                                    >
                                        <Plus size={16} strokeWidth={2.5} />
                                    </button>
                                )}
                                <span className="text-sm font-bold text-gray-900 leading-tight">
                                    {organizations.length === 0 ? 'Create First Organization' : (
                                        ['OWNER', 'owner'].includes(user?.globalRole?.toLowerCase()) ? 'Create New Organization' : 'Select Organization'
                                    )}
                                </span>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedOrg}
                                    onChange={handleOrgChange}
                                    className={`w-full h-11 pl-4 pr-10 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all appearance-none cursor-pointer ${selectedOrg ? 'text-black font-medium' : 'text-gray-400'
                                        }`}
                                    required
                                >
                                    <option value="" disabled className="text-gray-400">Select an organization</option>
                                    {organizations?.map(org => (
                                        <option key={org.id} value={org.id} className="text-black">
                                            {org.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" size={16} />
                            </div>
                        </div>

                        {/* Branch Selection */}
                        <div className={`flex flex-col transition-all duration-300 ${!selectedOrg ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <div className="flex items-center space-x-3 mb-2">
                                {(
                                    ['OWNER', 'owner'].includes(user?.globalRole?.toLowerCase())
                                ) && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/branches/create')}
                                            className="w-8 h-8 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center shrink-0 shadow-sm"
                                            title="Create New Branch"
                                        >
                                            <Plus size={16} strokeWidth={2.5} />
                                        </button>
                                    )}
                                <span className="text-sm font-bold text-gray-900 leading-tight">
                                    {(
                                        ['OWNER', 'owner'].includes(user?.globalRole?.toLowerCase())
                                    ) ? 'Add New Branch' : 'Select Branch'}
                                </span>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className={`w-full h-11 pl-4 pr-10 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all appearance-none cursor-pointer ${selectedBranch ? 'text-black font-medium' : 'text-gray-400'
                                        }`}
                                    disabled={!selectedOrg}
                                >
                                    <option value="" disabled className="text-gray-400">Select a branch</option>
                                    {availableBranches?.map(branch => (
                                        <option key={branch} value={branch} className="text-black">
                                            {branch}
                                        </option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!selectedOrg}
                            className="w-full bg-black text-white font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                        >
                            <span>Continue</span>
                            <ArrowRight size={18} className="ml-2" />
                        </button>
                    </form>

                    <div className="mt-6 flex flex-col items-center space-y-2">
                        <button
                            onClick={handleLogout}
                            className="text-gray-500 font-bold text-sm hover:text-black transition-colors flex items-center gap-2"
                        >
                            Sign in with a different account
                        </button>
                    </div>

                    <CreateOrganizationModal
                        isOpen={showOrgModal}
                        onClose={() => setShowOrgModal(false)}
                        onSuccess={handleOrgCreated}
                    />
                </>
            )}
        </AuthLayout>
    );
};

export default Onboarding;
