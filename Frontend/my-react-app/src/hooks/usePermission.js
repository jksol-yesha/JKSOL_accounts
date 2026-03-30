
import { useAuth } from '../context/AuthContext';

export const usePermission = () => {
    const { permissions } = useAuth();

    const hasPermission = (permissionKey) => {
        if (!permissions) return false;
        return permissions.includes(permissionKey);
    };

    return { hasPermission };
};

export const Can = ({ I, a, children }) => {
    const { hasPermission } = usePermission();
    // Helper to map "I='create' a='transaction'" to "TXN_CREATE"
    // Just a conceptual mapping, simpler to use direct keys usually.
    // Let's support direct keys for now to stay simple.
    // Usage: <Can permission="TXN_CREATE">...</Can>

    // User requested: <Can I="create" a="transaction">
    // Mappings:
    // create transaction -> TXN_CREATE
    // view transaction -> TXN_VIEW
    // edit transaction -> TXN_EDIT
    // delete transaction -> TXN_DELETE
    // manage settings -> SETTINGS_MANAGE

    let key = I; // If they pass "TXN_CREATE" directly

    if (I && a) {
        if (a === 'transaction') {
            if (I === 'create') key = 'TXN_CREATE';
            if (I === 'view') key = 'TXN_VIEW';
            if (I === 'edit') key = 'TXN_EDIT';
            if (I === 'delete') key = 'TXN_DELETE';
        }
        if (a === 'settings') {
            if (I === 'manage') key = 'SETTINGS_MANAGE';
        }
        if (a === 'dashboard') {
            if (I === 'view') key = 'DASHBOARD_VIEW';
        }
        if (a === 'report') {
            if (I === 'view') key = 'REPORT_VIEW';
        }
    }

    if (hasPermission(key)) {
        return children;
    }
    return null;
};
