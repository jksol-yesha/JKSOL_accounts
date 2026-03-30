import React, { useState } from 'react';
import { X, Building2, Check, XCircle, Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';

const InvitationNotification = ({ invitation, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { refreshOrganizations } = useOrganization();

    const handleAccept = async () => {
        setIsProcessing(true);
        try {
            // Use the same API call as OrganizationSelector
            await apiService.auth.acceptInvite({
                token: invitation.token,
                // Name and password not needed as user is logged in
            });

            // Refresh organizations to show the newly joined org
            await refreshOrganizations();

            // Close the notification
            onClose();

            // Show success message
            alert(`Joined ${invitation.orgName} successfully!`);
        } catch (error) {
            console.error('Error accepting invitation:', error);
            alert(error.response?.data?.message || 'Failed to accept invitation');
            setIsProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!window.confirm(`Are you sure you want to decline the invitation from ${invitation.orgName}?`)) return;

        setIsProcessing(true);
        try {
            // Use the same API call as OrganizationSelector
            await apiService.auth.declineInvite({
                token: invitation.token,
            });

            // Close the notification
            onClose();
        } catch (error) {
            console.error('Error declining invitation:', error);
            alert(error.response?.data?.message || 'Failed to decline invitation');
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
            <div className="bg-white border-2 border-gray-900 rounded-lg shadow-2xl p-5 w-96">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 transition-colors"
                    disabled={isProcessing}
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                    <div className="bg-gray-900 p-2.5 rounded-md">
                        <Building2 className="text-white" size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                            Invitation Received
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            From {invitation.inviterName}
                        </p>
                    </div>
                </div>

                {/* Organization Info */}
                <div className="mb-5 pl-11">
                    {invitation.orgLogo && (
                        <img
                            src={invitation.orgLogo}
                            alt={invitation.orgName}
                            className="w-12 h-12 rounded-md mb-3 object-cover border border-gray-200"
                        />
                    )}
                    <p className="text-sm text-gray-700 font-medium mb-1">
                        Join <span className="font-bold text-gray-900">{invitation.orgName}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                        as <span className="font-semibold uppercase text-gray-900">{invitation.role}</span>
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleDecline}
                        disabled={isProcessing}
                        className="flex-1 bg-white border-2 border-gray-900 text-gray-900 py-2.5 px-4 rounded-md font-semibold text-sm hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                        Decline
                    </button>
                    <button
                        onClick={handleAccept}
                        disabled={isProcessing}
                        className="flex-1 bg-gray-900 text-white py-2.5 px-4 rounded-md font-semibold text-sm hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvitationNotification;
