import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Building2,
    ChevronDown,
    Clock3,
    Edit,
    Loader2,
    Plus,
    Search,
    Trash2,
    X,
    Check
} from 'lucide-react';
import PageContentShell from '../../components/layout/PageContentShell';
import ManageOrganizationModal from '../../components/layout/ManageOrganizationModal';
import apiService from '../../services/api';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';

const TIME_ZONE_OPTIONS = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney' },
    { value: 'UTC', label: 'UTC' }
];

const CURRENCY_DROPDOWN_MAX_HEIGHT = 126;

const parseMemberBranchIds = (branchIds) => {
    if (!branchIds) return [];
    if (Array.isArray(branchIds)) return branchIds.map(Number).filter(Boolean);

    if (typeof branchIds === 'string') {
        try {
            const parsed = JSON.parse(branchIds);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
        } catch {
            return branchIds
                .split(',')
                .map((value) => Number(value))
                .filter(Boolean);
        }
    }

    return [];
};

const parseMemberSelectedBranchIds = (member) => {
    const ids = new Set(parseMemberBranchIds(member?.branchIds));

    if (Array.isArray(member?.branches)) {
        member.branches.forEach((branch) => {
            const id = Number(branch?.id ?? branch?.branchId);
            if (Number.isFinite(id) && id > 0) ids.add(id);
        });
    }

    if (Array.isArray(member?.branchRoles)) {
        member.branchRoles.forEach((branchRole) => {
            const id = Number(branchRole?.branchId);
            if (Number.isFinite(id) && id > 0) ids.add(id);
        });
    }

    if (member?.branchId !== undefined && member?.branchId !== null) {
        const id = Number(member.branchId);
        if (Number.isFinite(id) && id > 0) ids.add(id);
    }

    return Array.from(ids);
};

const parseMemberBranchNames = (member, allBranches = []) => {
    const names = new Set();
    const memberBranchIds = parseMemberBranchIds(member?.branchIds);

    allBranches
        .filter((branch) => memberBranchIds.includes(Number(branch.id)))
        .forEach((branch) => {
            if (branch?.name) names.add(String(branch.name));
        });

    if (Array.isArray(member?.branchNames)) {
        member.branchNames.forEach((name) => {
            if (name) names.add(String(name));
        });
    } else if (typeof member?.branchNames === 'string') {
        try {
            const parsed = JSON.parse(member.branchNames);
            if (Array.isArray(parsed)) {
                parsed.forEach((name) => {
                    if (name) names.add(String(name));
                });
            } else if (member.branchNames.trim()) {
                member.branchNames.split(',').forEach((name) => {
                    const trimmed = name.trim();
                    if (trimmed) names.add(trimmed);
                });
            }
        } catch {
            member.branchNames.split(',').forEach((name) => {
                const trimmed = name.trim();
                if (trimmed) names.add(trimmed);
            });
        }
    }

    if (Array.isArray(member?.branches)) {
        member.branches.forEach((branch) => {
            if (branch?.name) names.add(String(branch.name));
        });
    }

    if (Array.isArray(member?.branchRoles)) {
        member.branchRoles.forEach((branchRole) => {
            if (branchRole?.branchName) names.add(String(branchRole.branchName));
        });
    }

    if (member?.branchName) {
        names.add(String(member.branchName));
    }

    return Array.from(names);
};

const roleToId = (role) => {
    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === 'owner') return 1;
    if (normalizedRole === 'admin') return 2;
    return 3;
};

const roleBadgeClassName = (role) => {
    const normalizedRole = String(role || '').toLowerCase();

    if (normalizedRole === 'owner') {
        return 'bg-amber-50 text-amber-700';
    }

    if (normalizedRole === 'admin') {
        return 'bg-indigo-50 text-indigo-700';
    }

    return 'bg-slate-100 text-slate-600';
};

const ManageOrganization = () => {
    const { selectedOrg, refreshOrganizations } = useOrganization();
    const { user } = useAuth();
    const { currencyOptions } = useCurrencyOptions();
    const createOrgPopoverRef = useRef(null);
    const createOrgButtonRef = useRef(null);
    const createOrgLogoInputRef = useRef(null);
    const currencyDropdownRef = useRef(null);
    const createCurrencyMenuRef = useRef(null);
    const timezoneDropdownRef = useRef(null);
    const createTimezoneMenuRef = useRef(null);
    
    // Edit refs
    const editOrgPopoverRef = useRef(null);
    const editOrgButtonRef = useRef(null);
    const editOrgLogoInputRef = useRef(null);
    const editCurrencyDropdownRef = useRef(null);
    const editTimezoneDropdownRef = useRef(null);
    const editTimezoneMenuRef = useRef(null);

    const [members, setMembers] = useState([]);
    const [allBranches, setAllBranches] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [pageError, setPageError] = useState('');
    const [notice, setNotice] = useState('');
    
    const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
    const [createOrgPopoverPosition, setCreateOrgPopoverPosition] = useState(null);
    const [showCreateCurrencyDropdown, setShowCreateCurrencyDropdown] = useState(false);
    const [createCurrencyMenuPosition, setCreateCurrencyMenuPosition] = useState(null);
    const [showCreateTimezoneDropdown, setShowCreateTimezoneDropdown] = useState(false);
    const [createTimezoneMenuPosition, setCreateTimezoneMenuPosition] = useState(null);
    
    const [showEditOrgModal, setShowEditOrgModal] = useState(false);
    const [showEditOrgForm, setShowEditOrgForm] = useState(false);
    const [editOrgPopoverPosition, setEditOrgPopoverPosition] = useState(null);
    const [showEditCurrencyDropdown, setShowEditCurrencyDropdown] = useState(false);
    const [showEditTimezoneDropdown, setShowEditTimezoneDropdown] = useState(false);
    const [editTimezoneMenuPosition, setEditTimezoneMenuPosition] = useState(null);
    const [updatingOrg, setUpdatingOrg] = useState(false);
    const [editOrgError, setEditOrgError] = useState('');
    const [editOrgForm, setEditOrgForm] = useState({
        name: '',
        baseCurrency: selectedOrg?.baseCurrency || 'INR',
        timezone: selectedOrg?.timezone || 'Asia/Kolkata',
        logo: null
    });

    const inviteUserPopoverRef = useRef(null);
    const inviteUserButtonRef = useRef(null);

    const [showInviteUserForm, setShowInviteUserForm] = useState(false);
    const [inviteUserPopoverPosition, setInviteUserPopoverPosition] = useState(null);
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMemberEmailError, setInviteMemberEmailError] = useState('');
    const [selectedInviteRole, setSelectedInviteRole] = useState(3);
    const [selectedInviteBranchIds, setSelectedInviteBranchIds] = useState([]);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [memberToEdit, setMemberToEdit] = useState(null);
    const [savingMemberAccess, setSavingMemberAccess] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState(null);
    const [editingAccessData, setEditingAccessData] = useState({ roleId: 3, branchIds: [] });
    const [creatingOrg, setCreatingOrg] = useState(false);
    const [createOrgError, setCreateOrgError] = useState('');
    const [createOrgForm, setCreateOrgForm] = useState({
        name: '',
        baseCurrency: selectedOrg?.baseCurrency || 'INR',
        timezone: selectedOrg?.timezone || 'Asia/Kolkata',
        logo: null
    });

    const selectedOrgRole = String(selectedOrg?.role || '').toLowerCase();
    const canCreateOrg = ['owner'].includes(String(user?.globalRole || '').toLowerCase()) || selectedOrgRole === 'owner';
    const canEditOrg = selectedOrgRole === 'owner';
    const canManageMembers = ['owner', 'admin'].includes(selectedOrgRole);
    const allBranchIds = useMemo(
        () => allBranches.map((branch) => Number(branch.id)).filter(Boolean),
        [allBranches]
    );
    const selectedEditBranchIds = Array.isArray(editingAccessData.branchIds)
        ? editingAccessData.branchIds.map(Number).filter(Boolean)
        : [];
    const editAllBranchesSelected = allBranchIds.length > 0 && selectedEditBranchIds.length === allBranchIds.length;
    const filteredMembers = useMemo(() => {
        const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
        if (!normalizedSearch) return members;

        return members.filter((member) => {
            const nameLabel = String(member?.name || '').toLowerCase();
            const emailLabel = String(member?.email || '').toLowerCase();
            const roleLabel = String(member?.role || '').toLowerCase();
            return (
                nameLabel.includes(normalizedSearch) ||
                emailLabel.includes(normalizedSearch) ||
                roleLabel.includes(normalizedSearch)
            );
        });
    }, [members, searchTerm]);
    const totalPages = Math.ceil(filteredMembers.length / pageSize);
    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredMembers.slice(startIndex, startIndex + pageSize);
    }, [filteredMembers, currentPage]);
    const selectedCreateCurrencyOption = useMemo(
        () => currencyOptions.find((option) => option.code === createOrgForm.baseCurrency) || currencyOptions[0] || {
            code: createOrgForm.baseCurrency,
            label: createOrgForm.baseCurrency
        },
        [createOrgForm.baseCurrency, currencyOptions]
    );

    const selectedEditCurrencyOption = useMemo(
        () => currencyOptions.find((option) => option.code === editOrgForm.baseCurrency) || currencyOptions[0] || {
            code: editOrgForm.baseCurrency,
            label: editOrgForm.baseCurrency
        },
        [editOrgForm.baseCurrency, currencyOptions]
    );
    const selectedEditTimezoneOption = useMemo(
        () => TIME_ZONE_OPTIONS.find((option) => option.value === editOrgForm.timezone) || {
            value: editOrgForm.timezone,
            label: editOrgForm.timezone
        },
        [editOrgForm.timezone]
    );
    const selectedCreateTimezoneOption = useMemo(
        () => TIME_ZONE_OPTIONS.find((option) => option.value === createOrgForm.timezone) || {
            value: createOrgForm.timezone,
            label: createOrgForm.timezone
        },
        [createOrgForm.timezone]
    );

    useEffect(() => {
        if (!notice) return undefined;

        const timer = window.setTimeout(() => setNotice(''), 2800);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (!showCreateOrgForm) return undefined;

        const handleClickOutside = (event) => {
            const clickedPopover = createOrgPopoverRef.current?.contains(event.target);
            const clickedButton = createOrgButtonRef.current?.contains(event.target);
            const clickedCurrencyMenu = createCurrencyMenuRef.current?.contains(event.target);
            const clickedTimezoneMenu = createTimezoneMenuRef.current?.contains(event.target);

            if (!clickedPopover && !clickedButton && !clickedCurrencyMenu && !clickedTimezoneMenu) {
                setShowCreateOrgForm(false);
                setShowCreateCurrencyDropdown(false);
                setShowCreateTimezoneDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCreateOrgForm]);

    useEffect(() => {
        if (!showCreateCurrencyDropdown) return undefined;

        const handleCurrencyClickOutside = (event) => {
            const clickedTrigger = currencyDropdownRef.current?.contains(event.target);
            const clickedMenu = createCurrencyMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedMenu) {
                setShowCreateCurrencyDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleCurrencyClickOutside);
        document.addEventListener('touchstart', handleCurrencyClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleCurrencyClickOutside);
            document.removeEventListener('touchstart', handleCurrencyClickOutside);
        };
    }, [showCreateCurrencyDropdown]);

    useEffect(() => {
        if (!showCreateTimezoneDropdown) return undefined;

        const handleTimezoneClickOutside = (event) => {
            const clickedTrigger = timezoneDropdownRef.current?.contains(event.target);
            const clickedMenu = createTimezoneMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedMenu) {
                setShowCreateTimezoneDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleTimezoneClickOutside);
        document.addEventListener('touchstart', handleTimezoneClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleTimezoneClickOutside);
            document.removeEventListener('touchstart', handleTimezoneClickOutside);
        };
    }, [showCreateTimezoneDropdown]);

    useEffect(() => {
        if (!showCreateTimezoneDropdown) {
            setCreateTimezoneMenuPosition(null);
            return undefined;
        }

        const updateCreateTimezoneMenuPosition = () => {
            if (!timezoneDropdownRef.current) return;

            const rect = timezoneDropdownRef.current.getBoundingClientRect();
            const width = Math.max(rect.width, 280);
            const left = Math.min(rect.left, window.innerWidth - width - 16);
            const availableBelow = window.innerHeight - rect.bottom - 16;
            const canOpenBelow = availableBelow >= CURRENCY_DROPDOWN_MAX_HEIGHT + 16;
            const maxHeight = canOpenBelow
                ? Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, availableBelow)
                : Math.max(120, Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, rect.top - 16));
            const top = canOpenBelow
                ? rect.bottom + 8
                : Math.max(16, rect.top - maxHeight - 8);

            setCreateTimezoneMenuPosition({
                top,
                left: Math.max(16, left),
                width,
                maxHeight
            });
        };

        updateCreateTimezoneMenuPosition();
        window.addEventListener('resize', updateCreateTimezoneMenuPosition);
        window.addEventListener('scroll', updateCreateTimezoneMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateCreateTimezoneMenuPosition);
            window.removeEventListener('scroll', updateCreateTimezoneMenuPosition, true);
        };
    }, [showCreateTimezoneDropdown]);

    useEffect(() => {
        if (!showCreateCurrencyDropdown) {
            setCreateCurrencyMenuPosition(null);
            return undefined;
        }

        const updateCreateCurrencyMenuPosition = () => {
            if (!currencyDropdownRef.current) return;

            const rect = currencyDropdownRef.current.getBoundingClientRect();
            const width = Math.max(rect.width, 280);
            const left = Math.min(rect.left, window.innerWidth - width - 16);
            const availableBelow = window.innerHeight - rect.bottom - 16;
            const canOpenBelow = availableBelow >= CURRENCY_DROPDOWN_MAX_HEIGHT + 16;
            const maxHeight = canOpenBelow
                ? Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, availableBelow)
                : Math.max(120, Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, rect.top - 16));
            const top = canOpenBelow
                ? rect.bottom + 8
                : Math.max(16, rect.top - maxHeight - 8);

            setCreateCurrencyMenuPosition({
                top,
                left: Math.max(16, left),
                width,
                maxHeight
            });
        };

        updateCreateCurrencyMenuPosition();
        window.addEventListener('resize', updateCreateCurrencyMenuPosition);
        window.addEventListener('scroll', updateCreateCurrencyMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateCreateCurrencyMenuPosition);
            window.removeEventListener('scroll', updateCreateCurrencyMenuPosition, true);
        };
    }, [showCreateCurrencyDropdown]);

    useEffect(() => {
        if (!showCreateOrgForm) {
            setCreateOrgPopoverPosition(null);
            return undefined;
        }

        const updateCreateOrgPopoverPosition = () => {
            if (!createOrgButtonRef.current) return;

            const rect = createOrgButtonRef.current.getBoundingClientRect();
            const width = Math.min(360, window.innerWidth - 32);
            const estimatedHeight = 470;
            const left = Math.min(
                Math.max(16, rect.right - width),
                Math.max(16, window.innerWidth - width - 16)
            );
            const top = Math.min(
                rect.bottom + 10,
                Math.max(16, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 32) - 16)
            );

            setCreateOrgPopoverPosition({ top, left, width });
        };

        updateCreateOrgPopoverPosition();
        window.addEventListener('resize', updateCreateOrgPopoverPosition);
        window.addEventListener('scroll', updateCreateOrgPopoverPosition, true);

        return () => {
            window.removeEventListener('resize', updateCreateOrgPopoverPosition);
            window.removeEventListener('scroll', updateCreateOrgPopoverPosition, true);
        };
    }, [showCreateOrgForm]);

    useEffect(() => {
        if (!showCreateOrgForm) {
            setCreateOrgError('');
            setShowCreateCurrencyDropdown(false);
            setCreateCurrencyMenuPosition(null);
            setShowCreateTimezoneDropdown(false);
            setCreateTimezoneMenuPosition(null);
            setCreateOrgForm({
                name: '',
                baseCurrency: selectedOrg?.baseCurrency || 'INR',
                timezone: selectedOrg?.timezone || 'Asia/Kolkata',
                logo: null
            });
        }
    }, [selectedOrg?.baseCurrency, selectedOrg?.timezone, showCreateOrgForm]);

    useEffect(() => {
        if (!showEditOrgForm) return undefined;

        const handleClickOutside = (event) => {
            const clickedPopover = editOrgPopoverRef.current?.contains(event.target);
            const clickedButton = editOrgButtonRef.current?.contains(event.target);
            const clickedTimezoneMenu = editTimezoneMenuRef.current?.contains(event.target);

            if (!clickedPopover && !clickedButton && !clickedTimezoneMenu) {
                setShowEditOrgForm(false);
                setShowEditCurrencyDropdown(false);
                setShowEditTimezoneDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEditOrgForm]);

    useEffect(() => {
        if (!showEditCurrencyDropdown) return undefined;

        const handleCurrencyClickOutside = (event) => {
            if (editCurrencyDropdownRef.current && !editCurrencyDropdownRef.current.contains(event.target)) {
                setShowEditCurrencyDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleCurrencyClickOutside);
        document.addEventListener('touchstart', handleCurrencyClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleCurrencyClickOutside);
            document.removeEventListener('touchstart', handleCurrencyClickOutside);
        };
    }, [showEditCurrencyDropdown]);

    useEffect(() => {
        if (!showEditTimezoneDropdown) return undefined;

        const handleTimezoneClickOutside = (event) => {
            const clickedTrigger = editTimezoneDropdownRef.current?.contains(event.target);
            const clickedMenu = editTimezoneMenuRef.current?.contains(event.target);

            if (!clickedTrigger && !clickedMenu) {
                setShowEditTimezoneDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleTimezoneClickOutside);
        document.addEventListener('touchstart', handleTimezoneClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleTimezoneClickOutside);
            document.removeEventListener('touchstart', handleTimezoneClickOutside);
        };
    }, [showEditTimezoneDropdown]);

    useEffect(() => {
        if (!showEditTimezoneDropdown) {
            setEditTimezoneMenuPosition(null);
            return undefined;
        }

        const updateEditTimezoneMenuPosition = () => {
            if (!editTimezoneDropdownRef.current) return;

            const rect = editTimezoneDropdownRef.current.getBoundingClientRect();
            const width = Math.max(rect.width, 280);
            const left = Math.min(rect.left, window.innerWidth - width - 16);
            const availableBelow = window.innerHeight - rect.bottom - 16;
            const canOpenBelow = availableBelow >= CURRENCY_DROPDOWN_MAX_HEIGHT + 16;
            const maxHeight = canOpenBelow
                ? Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, availableBelow)
                : Math.max(120, Math.min(CURRENCY_DROPDOWN_MAX_HEIGHT, rect.top - 16));
            const top = canOpenBelow
                ? rect.bottom + 8
                : Math.max(16, rect.top - maxHeight - 8);

            setEditTimezoneMenuPosition({
                top,
                left: Math.max(16, left),
                width,
                maxHeight
            });
        };

        updateEditTimezoneMenuPosition();
        window.addEventListener('resize', updateEditTimezoneMenuPosition);
        window.addEventListener('scroll', updateEditTimezoneMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateEditTimezoneMenuPosition);
            window.removeEventListener('scroll', updateEditTimezoneMenuPosition, true);
        };
    }, [showEditTimezoneDropdown]);

    useEffect(() => {
        if (!showEditOrgForm) {
            setEditOrgPopoverPosition(null);
            return undefined;
        }

        const updateEditOrgPopoverPosition = () => {
            if (!editOrgButtonRef.current) return;

            const rect = editOrgButtonRef.current.getBoundingClientRect();
            const width = Math.min(360, window.innerWidth - 32);
            const estimatedHeight = 470;
            const left = Math.min(
                Math.max(16, rect.right - width),
                Math.max(16, window.innerWidth - width - 16)
            );
            const top = Math.min(
                rect.bottom + 10,
                Math.max(16, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 32) - 16)
            );

            setEditOrgPopoverPosition({ top, left, width });
        };

        updateEditOrgPopoverPosition();
        window.addEventListener('resize', updateEditOrgPopoverPosition);
        window.addEventListener('scroll', updateEditOrgPopoverPosition, true);

        return () => {
            window.removeEventListener('resize', updateEditOrgPopoverPosition);
            window.removeEventListener('scroll', updateEditOrgPopoverPosition, true);
        };
    }, [showEditOrgForm]);

    useEffect(() => {
        if (!showEditOrgForm) {
            setEditOrgError('');
            setShowEditCurrencyDropdown(false);
            setShowEditTimezoneDropdown(false);
            setEditTimezoneMenuPosition(null);
        }
    }, [showEditOrgForm]);

    const fetchMembers = useCallback(async () => {
        if (!selectedOrg?.id) {
            setMembers([]);
            setLoadingMembers(false);
            return;
        }

        setLoadingMembers(true);
        setPageError('');

        try {
            const response = await apiService.organizations.getMembers(selectedOrg.id);
            const nextMembers = Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response)
                    ? response
                    : [];
            setMembers(nextMembers);
        } catch (error) {
            console.error('Failed to fetch organization members:', error);
            setPageError('Failed to load current users.');
            setMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    }, [selectedOrg?.id]);

    const fetchBranches = useCallback(async () => {
        if (!selectedOrg?.id || !canManageMembers) {
            setAllBranches([]);
            return;
        }

        try {
            const response = await apiService.branches.getAll({
                headers: { 'x-org-id': selectedOrg.id }
            });
            const nextBranches = Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response)
                    ? response
                    : [];
            setAllBranches(nextBranches);
        } catch (error) {
            console.error('Failed to fetch organization branches:', error);
            setAllBranches([]);
        }
    }, [canManageMembers, selectedOrg?.id]);

    useEffect(() => {
        fetchMembers();
        fetchBranches();
        setMemberToEdit(null);
        setEditingAccessData({ roleId: 3, branchIds: [] });
    }, [fetchBranches, fetchMembers]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, members.length]);

    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const openMemberAccessModal = (member) => {
        setMemberToEdit(member);
        setEditingAccessData({
            roleId: roleToId(member?.role),
            branchIds: parseMemberSelectedBranchIds(member)
        });
    };

    const canManageMember = (member) => {
        if (!canManageMembers) return false;
        if (String(member?.id) === String(user?.id)) return false;
        if (selectedOrgRole === 'owner') return true;
        return String(member?.role || '').toLowerCase() === 'member';
    };

    const handleRemoveMember = async (member) => {
        if (!selectedOrg?.id || !member?.id) return;

        const targetName = member.name || member.email || 'this user';
        const confirmed = window.confirm(`Remove ${targetName} from ${selectedOrg?.name}?`);
        if (!confirmed) return;

        setRemovingMemberId(member.id);
        setPageError('');

        try {
            await apiService.organizations.removeMember(selectedOrg.id, member.id);
            setNotice(`${targetName} removed successfully.`);
            await fetchMembers();
        } catch (error) {
            console.error('Failed to remove organization member:', error);
            setPageError(error.response?.data?.message || 'Failed to remove user.');
        } finally {
            setRemovingMemberId(null);
        }
    };

    const handleUpdateMemberAccess = async () => {
        if (!selectedOrg?.id || !memberToEdit?.id) return;

        setSavingMemberAccess(true);
        setPageError('');

        try {
            const payload = {
                role: editingAccessData.roleId === 1 ? 'owner' : (editingAccessData.roleId === 2 ? 'admin' : 'member'),
                branchIds: editingAccessData.roleId === 3 ? selectedEditBranchIds : null
            };

            await apiService.organizations.updateMemberAccess(selectedOrg.id, memberToEdit.id, payload);
            setNotice(`Access updated for ${memberToEdit.name || memberToEdit.email}.`);
            setMemberToEdit(null);
            await fetchMembers();
        } catch (error) {
            console.error('Failed to update member access:', error);
            setPageError(error.response?.data?.message || 'Failed to update access.');
        } finally {
            setSavingMemberAccess(false);
        }
    };

    const handleCreateOrgFieldChange = (event) => {
        const { name, value } = event.target;
        setCreateOrgForm((previous) => ({ ...previous, [name]: value }));
    };

    const handleCreateOrgLogoChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setCreateOrgError('Logo must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setCreateOrgError('');
            setCreateOrgForm((previous) => ({ ...previous, logo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleInlineCreateOrg = async (event) => {
        event.preventDefault();

        const trimmedName = String(createOrgForm.name || '').trim();
        if (!trimmedName) {
            setCreateOrgError('Organization name is required.');
            return;
        }

        setCreatingOrg(true);
        setCreateOrgError('');
        setPageError('');

        try {
            await apiService.organizations.create({
                ...createOrgForm,
                name: trimmedName
            });

            await refreshOrganizations();
            setShowCreateOrgForm(false);
            setNotice(`Organization '${trimmedName}' created successfully.`);
        } catch (error) {
            console.error('Failed to create organization:', error);
            setCreateOrgError(error.response?.data?.message || 'Failed to create organization.');
        } finally {
            setCreatingOrg(false);
        }
    };

    const handleEditOrgLogoChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setEditOrgError('Logo must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setEditOrgError('');
            setEditOrgForm((previous) => ({ ...previous, logo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleInlineEditOrg = async (event) => {
        event.preventDefault();

        const trimmedName = String(editOrgForm.name || '').trim();
        if (!trimmedName) {
            setEditOrgError('Organization name is required.');
            return;
        }

        setUpdatingOrg(true);
        setEditOrgError('');
        setPageError('');

        try {
            await apiService.organizations.update(selectedOrg.id, {
                ...editOrgForm,
                name: trimmedName
            });

            await refreshOrganizations();
            setShowEditOrgForm(false);
            setNotice(`Organization '${trimmedName}' updated successfully.`);
        } catch (error) {
            console.error('Failed to update organization:', error);
            setEditOrgError(error.response?.data?.message || 'Failed to update organization.');
        } finally {
            setUpdatingOrg(false);
        }
    };

    const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
    const getInviteEmailError = (email = '', label = 'Email') => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return `${label} is required.`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return 'Please enter a valid email address.';
        }
        return '';
    };
    const getInviteMemberEmailError = (email = '') => getInviteEmailError(email, 'Member email');

    const isRegisteredUserEmail = async (email) => {
        try {
            const response = await apiService.auth.getUsers();
            const users = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.users) ? response.users : [];
            const targetEmail = normalizeEmail(email);
            return users.some((u) => normalizeEmail(u?.email) === targetEmail);
        } catch (error) {
            console.error('Failed to validate invite email against users list:', error);
            return false;
        }
    };

    const handleInlineInviteUser = async (e) => {
        e.preventDefault();
        const emailToInvite = normalizeEmail(inviteEmail);
        const memberEmailError = getInviteMemberEmailError(emailToInvite);

        if (memberEmailError) {
            setInviteMemberEmailError(memberEmailError);
            return;
        }

        const roleId = parseInt(selectedInviteRole);
        let finalBranchIds = null;

        if (roleId === 3) {
            if (selectedInviteBranchIds.length === 0) {
                setInviteError("Members must be assigned to at least one branch.");
                return;
            }
            finalBranchIds = selectedInviteBranchIds;
        }

        setInviteLoading(true);
        setInviteError('');
        setInviteMemberEmailError('');
        try {
            const emailAlreadyRegistered = await isRegisteredUserEmail(emailToInvite);
            if (emailAlreadyRegistered) {
                setInviteError('This email is already registered. Invitation was not sent.');
                setInviteLoading(false);
                return;
            }

            await apiService.organizations.invite(selectedOrg.id, {
                email: emailToInvite,
                name: inviteName,
                branchIds: finalBranchIds,
                role: roleId === 1 ? 'owner' : (roleId === 2 ? 'admin' : 'member')
            });
            setNotice(`Invitation sent to ${emailToInvite}`);
            setInviteEmail('');
            setInviteName('');
            setInviteMemberEmailError('');
            setSelectedInviteBranchIds([]);
            setSelectedInviteRole(3);
            setShowInviteUserForm(false);
            await fetchMembers();
        } catch (err) {
            setInviteError(err.response?.data?.message || "Failed to invite user.");
        } finally {
            setInviteLoading(false);
        }
    };

    const toggleInviteBranch = (branchId) => {
        setSelectedInviteBranchIds(current =>
            current.includes(branchId)
                ? current.filter(id => id !== branchId)
                : [...current, branchId]
        );
    };

    const isAllInviteBranchesSelected = allBranches.length > 0 && selectedInviteBranchIds.length === allBranches.length;

    const toggleAllInviteBranches = () => {
        if (isAllInviteBranchesSelected) {
            setSelectedInviteBranchIds([]);
        } else {
            setSelectedInviteBranchIds(allBranches.map(b => Number(b.id)).filter(Boolean));
        }
    };

    useEffect(() => {
        if (!showInviteUserForm) return undefined;

        const handleClickOutside = (event) => {
            const clickedPopover = inviteUserPopoverRef.current?.contains(event.target);
            const clickedButton = inviteUserButtonRef.current?.contains(event.target);
            if (!clickedPopover && !clickedButton) {
                setShowInviteUserForm(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showInviteUserForm]);

    useEffect(() => {
        if (!showInviteUserForm) {
            setInviteUserPopoverPosition(null);
            return undefined;
        }
        const updateInviteUserPopoverPosition = () => {
            if (!inviteUserButtonRef.current) return;
            const rect = inviteUserButtonRef.current.getBoundingClientRect();
            const width = Math.min(360, window.innerWidth - 32);
            const estimatedHeight = 520;
            const left = Math.min(Math.max(16, rect.right - width), Math.max(16, window.innerWidth - width - 16));
            const top = Math.min(rect.bottom + 10, Math.max(16, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 32) - 16));
            setInviteUserPopoverPosition({ top, left, width });
        };
        updateInviteUserPopoverPosition();
        window.addEventListener('resize', updateInviteUserPopoverPosition);
        window.addEventListener('scroll', updateInviteUserPopoverPosition, true);
        return () => {
            window.removeEventListener('resize', updateInviteUserPopoverPosition);
            window.removeEventListener('scroll', updateInviteUserPopoverPosition, true);
        };
    }, [showInviteUserForm]);

    useEffect(() => {
        if (!showInviteUserForm) {
            setInviteError('');
            setInviteMemberEmailError('');
        }
    }, [showInviteUserForm]);

    const pageHeader = (
        <div className="relative bg-white px-4 md:px-5 xl:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 z-20 shadow-sm sticky top-0 overflow-visible">
            <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex items-center justify-center text-slate-500">
                    {selectedOrg?.logo ? (
                        <img
                            src={selectedOrg.logo}
                            alt={selectedOrg?.name || 'Organization logo'}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <Building2 size={20} strokeWidth={1.9} />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Manage Organization
                    </p>
                    <h1 className="mt-1 truncate text-[20px] font-bold tracking-tight text-slate-900">
                        {selectedOrg?.name || 'Organization'}
                    </h1>
                </div>
            </div>

            <div className="relative flex items-center justify-end gap-2 flex-wrap">
                {canCreateOrg && (
                    <button
                        ref={createOrgButtonRef}
                        type="button"
                        onClick={() => setShowCreateOrgForm((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Plus size={15} strokeWidth={2.2} />
                        <span>New</span>
                    </button>
                )}

                {canEditOrg && (
                    <button
                        ref={editOrgButtonRef}
                        type="button"
                        onClick={() => {
                            if (!showEditOrgForm) {
                                setEditOrgForm({
                                    name: selectedOrg?.name || '',
                                    baseCurrency: selectedOrg?.baseCurrency || 'INR',
                                    timezone: selectedOrg?.timezone || 'Asia/Kolkata',
                                    logo: selectedOrg?.logo || null
                                });
                            }
                            setShowEditOrgForm((current) => !current);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#4A8AF4] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#2F5FC6]"
                    >
                        <Edit size={15} strokeWidth={2.2} />
                        <span>Edit</span>
                    </button>
                )}
            </div>
        </div>
    );

    if (!selectedOrg) {
        return (
            <PageContentShell header={pageHeader}>
                <div className="flex min-h-[260px] items-center justify-center px-6 py-10 text-center">
                    <div className="max-w-sm space-y-2">
                        <h2 className="text-lg font-bold text-slate-900">No organization selected</h2>
                        <p className="text-sm font-medium text-slate-500">
                            Choose an organization first to manage its members.
                        </p>
                    </div>
                </div>
            </PageContentShell>
        );
    }

    return (
        <>
            <PageContentShell
                header={pageHeader}
                contentClassName="p-4 lg:p-6"
                cardClassName="rounded-xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
                <div className="p-4 flex flex-row items-center justify-between gap-4 border-b border-gray-50 relative print:hidden min-h-[74px] bg-white shrink-0">
                    <div className="relative w-full max-w-[280px]">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search users..."
                            className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3 justify-end shrink-0">
                        {canManageMembers && (
                            <button
                                ref={inviteUserButtonRef}
                                type="button"
                                onClick={() => setShowInviteUserForm((current) => !current)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 shadow-sm bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                                title="Add User"
                            >
                                <Plus size={20} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar">
                    <table className="w-full min-w-[980px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-y border-gray-200 bg-[#F9F9FB]">
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">Id</th>
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">Name</th>
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">Email Address</th>
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">Role</th>
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">Branch</th>
                                <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">
                                    <div className="ml-auto w-[120px] text-left">Action</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loadingMembers ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12">
                                        <div className="flex items-center justify-center">
                                            <Loader2 size={24} className="animate-spin text-gray-500" />
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-slate-400">
                                        {searchTerm.trim() ? 'No users match your search.' : 'No users found for this organization.'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedMembers.map((member, index) => {
                                    const nameLabel = member.name || 'Pending User';
                                    const emailLabel = member.email || '-';
                                    const canManageThisMember = canManageMember(member);
                                    const normalizedRole = String(member.role || 'member').toLowerCase();
                                    const memberBranchIds = parseMemberSelectedBranchIds(member);
                                    const memberBranchNames = parseMemberBranchNames(member, allBranches);
                                    const hasAllBranchAccess = allBranchIds.length > 0 && memberBranchIds.length === allBranchIds.length;
                                    const serialNumber = (currentPage - 1) * pageSize + index + 1;
                                    const branchAccessLines = normalizedRole === 'member'
                                        ? hasAllBranchAccess
                                            ? ['All Branches']
                                            : memberBranchNames.length > 0
                                                ? memberBranchNames
                                                : ['No Branch Access']
                                        : ['All Branches'];

                                    return (
                                        <tr key={member.id} className="group hover:bg-gray-50/50">
                                            <td className="px-5 py-2.5 align-top">
                                                <div className="text-[13px] font-bold text-slate-500">{serialNumber}</div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={cn(
                                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold",
                                                        String(member.role || '').toLowerCase() === 'owner'
                                                            ? "bg-amber-100 text-amber-700"
                                                            : String(member.role || '').toLowerCase() === 'admin'
                                                                ? "bg-indigo-100 text-indigo-700"
                                                                : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {nameLabel.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[13px] font-bold text-slate-900">{nameLabel}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="min-w-0 text-[13px] font-medium text-slate-600">
                                                    <span className="truncate">{emailLabel}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="max-w-[240px]">
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                                        roleBadgeClassName(member.role)
                                                    )}>
                                                        <span>{member.role || 'member'}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                <div className="max-w-[220px] space-y-0.5">
                                                    {branchAccessLines.map((branchName) => (
                                                        <div
                                                            key={`${member.id}-${branchName}`}
                                                            className="text-[12px] font-semibold leading-tight text-slate-500"
                                                        >
                                                            {branchName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5">
                                                {canManageThisMember ? (
                                                    <div className="ml-auto flex w-[120px] items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openMemberAccessModal(member)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-indigo-600"
                                                            title="Edit access"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMember(member)}
                                                            disabled={removingMemberId === member.id}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                                                            title="Remove user"
                                                        >
                                                            {removingMemberId === member.id ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="ml-auto w-[120px] text-[12px] font-semibold text-slate-300">No action</div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="hidden lg:flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-none bg-white gap-3 sm:gap-0 print:hidden relative z-20 rounded-b-2xl">
                    <div className="text-[11px] text-gray-500 font-medium">
                        Showing <span className="font-bold text-gray-700">{filteredMembers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredMembers.length)}</span> of <span className="font-bold text-gray-700">{filteredMembers.length}</span> results
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setCurrentPage((previous) => Math.max(previous - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                        >
                            Previous
                        </button>
                        <div className="hidden sm:flex items-center space-x-1">
                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-bold transition-all",
                                        page === currentPage
                                            ? "bg-gray-100 border border-gray-200 text-gray-900"
                                            : "text-gray-500 hover:bg-gray-100"
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage((previous) => Math.min(previous + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </PageContentShell>

            {(pageError || notice) && (
                <div className="pointer-events-none fixed right-4 top-24 z-[170] w-[min(360px,calc(100vw-32px))]">
                    <div
                        className={cn(
                            "pointer-events-auto rounded-xl border px-4 py-3 text-[12px] font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200",
                            pageError
                                ? "border-rose-100 bg-rose-50/95 text-rose-600"
                                : "border-emerald-100 bg-emerald-50/95 text-emerald-700"
                        )}
                    >
                        {pageError || notice}
                    </div>
                </div>
            )}

            {showCreateOrgForm && createOrgPopoverPosition && createPortal(
                <div
                    ref={createOrgPopoverRef}
                    className="fixed z-[180] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 duration-200 overflow-visible"
                    style={{
                        top: createOrgPopoverPosition.top,
                        left: createOrgPopoverPosition.left,
                        width: createOrgPopoverPosition.width
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight text-slate-900">Add New Organization</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateOrgForm(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <form onSubmit={handleInlineCreateOrg} className="mt-4 space-y-3">
                        {createOrgError && (
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                                {createOrgError}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Logo
                            </label>
                            <input
                                ref={createOrgLogoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleCreateOrgLogoChange}
                            />
                            <button
                                type="button"
                                onClick={() => createOrgLogoInputRef.current?.click()}
                                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                    {createOrgForm.logo ? (
                                        <img
                                            src={createOrgForm.logo}
                                            alt="Organization logo preview"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Building2 size={18} strokeWidth={1.8} />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[12px] font-bold text-slate-700">
                                        {createOrgForm.logo ? 'Change Logo' : 'Add Logo'}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                                        PNG, JPG up to 2MB
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Organization Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={createOrgForm.name}
                                onChange={handleCreateOrgFieldChange}
                                placeholder="Enter name"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4]"
                            />
                        </div>

                        <div className="space-y-1.5" ref={currencyDropdownRef}>
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Base Currency
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateTimezoneDropdown(false);
                                    setShowCreateCurrencyDropdown((current) => !current);
                                }}
                                className="group relative flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:bg-slate-50"
                            >
                                <Building2 size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800">
                                    {selectedCreateCurrencyOption?.label || createOrgForm.baseCurrency}
                                </span>
                                <ChevronDown
                                    size={14}
                                    className={cn(
                                        "ml-1 shrink-0 text-gray-400 transition-transform",
                                        showCreateCurrencyDropdown && "rotate-180 text-primary"
                                    )}
                                />
                            </button>
                        </div>

                        <div className="space-y-1.5" ref={timezoneDropdownRef}>
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Timezone
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateCurrencyDropdown(false);
                                    setShowCreateTimezoneDropdown((current) => !current);
                                }}
                                className="group relative flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:bg-slate-50"
                            >
                                <Clock3 size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800">
                                    {selectedCreateTimezoneOption.label}
                                </span>
                                <ChevronDown
                                    size={14}
                                    className={cn(
                                        "ml-1 shrink-0 text-gray-400 transition-transform",
                                        showCreateTimezoneDropdown && "rotate-180 text-primary"
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowCreateOrgForm(false)}
                                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                disabled={creatingOrg}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creatingOrg}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#4A8AF4] px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#2F5FC6] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {creatingOrg && <Loader2 size={14} className="animate-spin" />}
                                <span>Create</span>
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

            {showCreateCurrencyDropdown && createCurrencyMenuPosition && createPortal(
                <div
                    ref={createCurrencyMenuRef}
                    className="fixed z-[190] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: createCurrencyMenuPosition.top,
                        left: createCurrencyMenuPosition.left,
                        width: createCurrencyMenuPosition.width
                    }}
                >
                    <div
                        className="overflow-y-auto custom-scrollbar py-1"
                        style={{ maxHeight: createCurrencyMenuPosition.maxHeight }}
                    >
                        {currencyOptions.length > 0 ? (
                            currencyOptions.map((option) => {
                                const isSelected = option.code === createOrgForm.baseCurrency;
                                return (
                                    <button
                                        key={option.code}
                                        type="button"
                                        onClick={() => {
                                            setCreateOrgForm((previous) => ({ ...previous, baseCurrency: option.code }));
                                            setShowCreateCurrencyDropdown(false);
                                        }}
                                        className="group flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#EEF0FC]"
                                    >
                                        <div className="flex items-center gap-1.5 pr-1">
                                            <div className="w-4 flex justify-center shrink-0">
                                                {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                            </div>
                                            <p
                                                className={cn(
                                                    "whitespace-normal break-words leading-tight text-[13px]",
                                                    isSelected
                                                        ? "font-bold text-slate-800"
                                                        : "font-medium text-slate-600 group-hover:text-slate-800"
                                                )}
                                            >
                                                {option.label}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-3 py-2 text-[12px] font-medium text-slate-400">
                                No currencies available.
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {showCreateTimezoneDropdown && createTimezoneMenuPosition && createPortal(
                <div
                    ref={createTimezoneMenuRef}
                    className="fixed z-[190] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: createTimezoneMenuPosition.top,
                        left: createTimezoneMenuPosition.left,
                        width: createTimezoneMenuPosition.width
                    }}
                >
                    <div
                        className="overflow-y-auto custom-scrollbar py-1"
                        style={{ maxHeight: createTimezoneMenuPosition.maxHeight }}
                    >
                        {TIME_ZONE_OPTIONS.map((timeZone) => {
                            const isSelected = timeZone.value === createOrgForm.timezone;
                            return (
                                <button
                                    key={timeZone.value}
                                    type="button"
                                    onClick={() => {
                                        setCreateOrgForm((previous) => ({ ...previous, timezone: timeZone.value }));
                                        setShowCreateTimezoneDropdown(false);
                                    }}
                                    className="group flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#EEF0FC]"
                                >
                                    <div className="flex items-center gap-1.5 pr-1">
                                        <div className="w-4 flex justify-center shrink-0">
                                            {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                        </div>
                                        <p
                                            className={cn(
                                                "whitespace-normal break-words leading-tight text-[13px]",
                                                isSelected
                                                    ? "font-bold text-slate-800"
                                                    : "font-medium text-slate-600 group-hover:text-slate-800"
                                            )}
                                        >
                                            {timeZone.label}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}

            {showEditOrgForm && editOrgPopoverPosition && createPortal(
                <div
                    ref={editOrgPopoverRef}
                    className="fixed z-[180] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-32px)] overflow-y-auto"
                    style={{
                        top: editOrgPopoverPosition.top,
                        left: editOrgPopoverPosition.left,
                        width: editOrgPopoverPosition.width
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight text-slate-900">Edit Organization</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowEditOrgForm(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <form onSubmit={handleInlineEditOrg} className="mt-4 space-y-3">
                        {editOrgError && (
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                                {editOrgError}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Logo
                            </label>
                            <input
                                ref={editOrgLogoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleEditOrgLogoChange}
                            />
                            <button
                                type="button"
                                onClick={() => editOrgLogoInputRef.current?.click()}
                                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                    {editOrgForm.logo ? (
                                        <img
                                            src={editOrgForm.logo}
                                            alt="Organization logo preview"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Building2 size={18} strokeWidth={1.8} />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[12px] font-bold text-slate-700">
                                        {editOrgForm.logo ? 'Change Logo' : 'Add Logo'}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                                        PNG, JPG up to 2MB
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Organization Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={editOrgForm.name}
                                onChange={(e) => setEditOrgForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter name"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4]"
                            />
                        </div>

                        <div className="space-y-1.5" ref={editCurrencyDropdownRef}>
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Base Currency
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditTimezoneDropdown(false);
                                        setShowEditCurrencyDropdown((current) => !current);
                                    }}
                                    className="group relative flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:bg-slate-50"
                                >
                                    <Building2 size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800">
                                        {selectedEditCurrencyOption?.label || editOrgForm.baseCurrency}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={cn(
                                            "ml-1 shrink-0 text-gray-400 transition-transform",
                                            showEditCurrencyDropdown && "rotate-180 text-primary"
                                        )}
                                    />
                                </button>

                                {showEditCurrencyDropdown && (
                                    <div className="absolute left-0 min-w-full w-max max-w-[280px] top-full z-[190] mt-2 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                        <div className="max-h-[126px] overflow-y-auto custom-scrollbar py-1">
                                            {currencyOptions.map((option) => {
                                                const isSelected = option.code === editOrgForm.baseCurrency;
                                                return (
                                                    <button
                                                        key={option.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setEditOrgForm((previous) => ({ ...previous, baseCurrency: option.code }));
                                                            setShowEditCurrencyDropdown(false);
                                                        }}
                                                        className="group flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#EEF0FC]"
                                                    >
                                                        <div className="flex items-center gap-1.5 pr-1">
                                                            <div className="w-4 flex justify-center shrink-0">
                                                                {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                                            </div>
                                                            <p className={cn(
                                                                "whitespace-normal break-words leading-tight text-[13px]",
                                                                isSelected ? "font-bold text-slate-800" : "font-medium text-slate-600 group-hover:text-slate-800"
                                                            )}>
                                                                {option.label}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5" ref={editTimezoneDropdownRef}>
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Timezone
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEditCurrencyDropdown(false);
                                    setShowEditTimezoneDropdown((current) => !current);
                                }}
                                className="group relative flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:bg-slate-50"
                            >
                                <Clock3 size={16} className="text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800">
                                    {selectedEditTimezoneOption.label}
                                </span>
                                <ChevronDown
                                    size={14}
                                    className={cn(
                                        "ml-1 shrink-0 text-gray-400 transition-transform",
                                        showEditTimezoneDropdown && "rotate-180 text-primary"
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowEditOrgForm(false)}
                                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                disabled={updatingOrg}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updatingOrg}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#4A8AF4] px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#2F5FC6] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {updatingOrg && <Loader2 size={14} className="animate-spin" />}
                                <span>Save</span>
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

            {showEditTimezoneDropdown && editTimezoneMenuPosition && createPortal(
                <div
                    ref={editTimezoneMenuRef}
                    className="fixed z-[190] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: editTimezoneMenuPosition.top,
                        left: editTimezoneMenuPosition.left,
                        width: editTimezoneMenuPosition.width
                    }}
                >
                    <div
                        className="overflow-y-auto custom-scrollbar py-1"
                        style={{ maxHeight: editTimezoneMenuPosition.maxHeight }}
                    >
                        {TIME_ZONE_OPTIONS.map((timeZone) => {
                            const isSelected = timeZone.value === editOrgForm.timezone;
                            return (
                                <button
                                    key={timeZone.value}
                                    type="button"
                                    onClick={() => {
                                        setEditOrgForm((previous) => ({ ...previous, timezone: timeZone.value }));
                                        setShowEditTimezoneDropdown(false);
                                    }}
                                    className="group flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#EEF0FC]"
                                >
                                    <div className="flex items-center gap-1.5 pr-1">
                                        <div className="w-4 flex justify-center shrink-0">
                                            {isSelected && <Check size={14} className="text-[#4A8AF4]" strokeWidth={2.5} />}
                                        </div>
                                        <p
                                            className={cn(
                                                "whitespace-normal break-words leading-tight text-[13px]",
                                                isSelected
                                                    ? "font-bold text-slate-800"
                                                    : "font-medium text-slate-600 group-hover:text-slate-800"
                                            )}
                                        >
                                            {timeZone.label}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}

            <ManageOrganizationModal
                isOpen={showEditOrgModal}
                onClose={() => {
                    setShowEditOrgModal(false);
                    refreshOrganizations();
                }}
                initialView="manage"
                initialOrg={selectedOrg}
            />

            {memberToEdit && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
                        onClick={() => !savingMemberAccess && setMemberToEdit(null)}
                    />

                    <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h3 className="text-[16px] font-bold tracking-tight text-slate-900">Edit Access</h3>
                                <p className="mt-1 max-w-[260px] truncate text-[12px] font-medium text-slate-500">
                                    {memberToEdit.name || memberToEdit.email}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingMemberAccess && setMemberToEdit(null)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Role
                                </label>
                                <select
                                    value={editingAccessData.roleId}
                                    onChange={(event) => {
                                        const nextRoleId = Number(event.target.value);
                                        setEditingAccessData((previous) => ({
                                            ...previous,
                                            roleId: nextRoleId,
                                            branchIds: nextRoleId === 3 ? previous.branchIds : []
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4] focus:bg-white"
                                >
                                    {selectedOrgRole === 'owner' && <option value={1}>Owner</option>}
                                    {selectedOrgRole === 'owner' && <option value={2}>Admin</option>}
                                    <option value={3}>Member</option>
                                </select>
                            </div>

                            {editingAccessData.roleId === 3 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                            Branch Access
                                        </label>
                                        {allBranchIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingAccessData((previous) => ({
                                                        ...previous,
                                                        branchIds: editAllBranchesSelected ? [] : allBranchIds
                                                    }));
                                                }}
                                                className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600"
                                            >
                                                <span className={cn(
                                                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                                                    editAllBranchesSelected ? "border-[#4A8AF4] bg-[#4A8AF4] text-white" : "border-slate-300 bg-white text-transparent"
                                                )}>
                                                    <Check size={11} strokeWidth={3} />
                                                </span>
                                                <span>Select All</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2.5 custom-scrollbar">
                                        {allBranches.map((branch) => {
                                            const normalizedBranchId = Number(branch.id);
                                            const isSelected = selectedEditBranchIds.includes(normalizedBranchId);

                                            return (
                                                <button
                                                    key={branch.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingAccessData((previous) => {
                                                            const currentIds = Array.isArray(previous.branchIds) ? previous.branchIds.map(Number) : [];
                                                            return {
                                                                ...previous,
                                                                branchIds: currentIds.includes(normalizedBranchId)
                                                                    ? currentIds.filter((id) => id !== normalizedBranchId)
                                                                    : [...currentIds, normalizedBranchId]
                                                            };
                                                        });
                                                    }}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                                                        isSelected
                                                            ? "border-[#BFD3FB] bg-[#EEF0FC]"
                                                            : "border-slate-200 bg-white hover:bg-slate-50"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                                        isSelected ? "border-[#4A8AF4] bg-[#4A8AF4] text-white" : "border-slate-300 bg-white text-transparent"
                                                    )}>
                                                        <Check size={11} strokeWidth={3} />
                                                    </span>
                                                    <span className="truncate text-[13px] font-semibold text-slate-700">{branch.name}</span>
                                                </button>
                                            );
                                        })}
                                        {allBranches.length === 0 && (
                                            <div className="px-2 py-4 text-center text-[12px] font-medium text-slate-400">
                                                No branches available.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setMemberToEdit(null)}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                disabled={savingMemberAccess}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateMemberAccess}
                                disabled={savingMemberAccess || (editingAccessData.roleId === 3 && selectedEditBranchIds.length === 0)}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#4A8AF4] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#2F5FC6] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingMemberAccess && <Loader2 size={14} className="animate-spin" />}
                                <span>Save Access</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showInviteUserForm && inviteUserPopoverPosition && createPortal(
                <div
                    ref={inviteUserPopoverRef}
                    className="fixed z-[180] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-32px)] overflow-y-auto"
                    style={{
                        top: inviteUserPopoverPosition.top,
                        left: inviteUserPopoverPosition.left,
                        width: inviteUserPopoverPosition.width
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight text-slate-900">Add User</h2>
                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                Invite a new team member.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowInviteUserForm(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <form onSubmit={handleInlineInviteUser} className="mt-4 space-y-3">
                        {inviteError && (
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                                {inviteError}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Email Address <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => {
                                    setInviteEmail(e.target.value);
                                    if (inviteMemberEmailError) setInviteMemberEmailError('');
                                }}
                                placeholder="name@company.com"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4]"
                            />
                            {inviteMemberEmailError && (
                                <p className="mt-1 text-[11px] font-medium text-rose-500">{inviteMemberEmailError}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={inviteName}
                                onChange={(e) => setInviteName(e.target.value)}
                                placeholder="Enter full name"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4]"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Role <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={selectedInviteRole}
                                onChange={(e) => setSelectedInviteRole(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-colors focus:border-[#4A8AF4]"
                            >
                                <option value={1}>Owner</option>
                                <option value={2}>Admin</option>
                                <option value={3}>Member</option>
                            </select>
                        </div>

                        {selectedInviteRole === 3 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                                <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Assign Branches <span className="text-rose-500">*</span>
                                </label>
                                <div className="max-h-[120px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1 custom-scrollbar">
                                    <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 cursor-pointer transition-colors">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isAllInviteBranchesSelected}
                                                onChange={toggleAllInviteBranches}
                                                className="peer h-4 w-4 shrink-0 appearance-none rounded-md border border-slate-300 bg-white checked:border-[#4A8AF4] checked:bg-[#4A8AF4] focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20"
                                            />
                                            <Check size={12} strokeWidth={3} className="absolute pointer-events-none opacity-0 text-white peer-checked:opacity-100" />
                                        </div>
                                        <span className="text-[12px] font-bold text-slate-800">Select All Branches</span>
                                    </label>

                                    {allBranches.map((branch) => (
                                        <label key={branch.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 cursor-pointer transition-colors">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedInviteBranchIds.includes(Number(branch.id))}
                                                    onChange={() => toggleInviteBranch(Number(branch.id))}
                                                    className="peer h-4 w-4 shrink-0 appearance-none rounded-md border border-slate-300 bg-white checked:border-[#4A8AF4] checked:bg-[#4A8AF4] focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/20"
                                                />
                                                <Check size={12} strokeWidth={3} className="absolute pointer-events-none opacity-0 text-white peer-checked:opacity-100" />
                                            </div>
                                            <span className="text-[12px] font-medium text-slate-600 truncate">{branch.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1 mt-3">
                            <button
                                type="button"
                                onClick={() => setShowInviteUserForm(false)}
                                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                disabled={inviteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={inviteLoading}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#4A8AF4] px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#2F5FC6] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {inviteLoading && <Loader2 size={14} className="animate-spin" />}
                                <span>Send Invite</span>
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}
        </>
    );
};

export default ManageOrganization;
