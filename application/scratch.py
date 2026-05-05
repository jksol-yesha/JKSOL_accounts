import re

with open('/Users/erasoft/Downloads/local-live copy 23/application/src/components/layout/Sidebar.jsx', 'r') as f:
    content = f.read()

# 1. Clean up lucide-react imports
content = re.sub(
    r"import \{.*?\} from 'lucide-react';",
    "import {\n    X,\n    ChevronDown,\n    AlignLeft,\n    ArrowRight\n} from 'lucide-react';",
    content,
    flags=re.DOTALL
)

# 2. Clean up context imports
content = content.replace("import { usePreferences } from '../../context/PreferenceContext';\n", "")
content = content.replace("import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';\n", "")
content = content.replace("import { Loader } from '../common/Loader';\n", "")
content = content.replace("import { useToast } from '../../context/ToastContext';\n", "")

# 3. Clean up constants
content = re.sub(r"const dateFormats = \[.*?\n};\n", "", content, flags=re.DOTALL)

# 4. Clean up state hooks
content = re.sub(r"    const \[showProfileMenu.*?const \[showLogoutConfirm.*?;\n", "", content, flags=re.DOTALL)

# 5. Clean up refs
content = re.sub(r"    const profileMenuRef.*?    const fileInputRef.*?;\n", "", content, flags=re.DOTALL)

# 6. Clean up hooks
content = re.sub(r"    const \{ user, logout, updateUser \} = useAuth\(\);\n    const \{ showToast \} = useToast\(\);\n    const \{ preferences, updatePreferences \} = usePreferences\(\);\n    const \{ currencyOptions \} = useCurrencyOptions\(\);\n", "    const { user } = useAuth();\n", content, flags=re.DOTALL)

# 7. Clean up preferenceCurrencyOptions
content = re.sub(r"    const preferenceCurrencyOptions = React\.useMemo\(.*?\}, \[currencyOptions\]\);\n", "", content, flags=re.DOTALL)

# 8. Clean up hasNameChange... hasChanges
content = re.sub(r"    // Check for changes against the RAW data.*?    const hasChanges = hasNameChange \|\| hasEmailChange \|\| hasPhotoChange \|\| hasPreferenceChanges;\n", "", content, flags=re.DOTALL)

# 9. Clean up effects
content = re.sub(r"    React\.useEffect\(\(\) => \{\n        if \(!showProfileMenu\).*?\[showProfileMenu, rawName, user\?\.email, user\?\.profilePhoto, preferences\]\);\n\n", "", content, flags=re.DOTALL)
content = re.sub(r"    React\.useEffect\(\(\) => \{\n        if \(isMobileViewport && !isOpen\).*?\[isMobileViewport, isOpen\]\);\n\n", "", content, flags=re.DOTALL)

# 10. Clean up handleClickOutside
content = re.sub(
    r"    React\.useEffect\(\(\) => \{\n        const handleClickOutside = \(event\) => \{.*?document\.removeEventListener\('mousedown', handleClickOutside\);\n    \}, \[\]\);\n",
"""    React.useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedOutsideSidebarControl = !sidebarControlRef.current || !sidebarControlRef.current.contains(event.target);
            if (clickedOutsideSidebarControl) {
                setShowSidebarControlMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);\n""",
    content,
    flags=re.DOTALL
)

# 11. Clean up activateSidebarItem unused setters
content = content.replace("        setShowProfileMenu(false);\n", "")
content = content.replace("        setShowLogoutConfirm(false);\n", "")

# 12. Clean up logout logic
content = re.sub(r"    const openProfileLogoutConfirm.*?    \};\n", "", content, flags=re.DOTALL)

# 13. Update handleProfileClick
content = re.sub(
    r"    const handleProfileClick = \(e\) => \{.*?    \};\n",
"""    const handleProfileClick = (e) => {
        e.stopPropagation();
        if (location.pathname !== '/profile') {
            navigate('/profile');
        }
    };\n""",
    content,
    flags=re.DOTALL
)

# 14. Clean up handleImageChange, handlePreferenceChange, handleRemovePhoto, handleSaveProfile, PreferenceItem
content = re.sub(r"    const handleImageChange = async.*?    // Child component for preference items with visual connection\n    const PreferenceItem = .*?        \);\n    \};\n", "", content, flags=re.DOTALL)

# 15. Remove profileMenuContent completely
content = re.sub(r"    const profileMenuContent = \(.*?\);\n\n    return \(", "    return (", content, flags=re.DOTALL)

# 16. Remove dropdowns from the rendered `profileMenuRef` div
# The previous `profileMenuContent` had a lot of things inside `div` with `ref={profileMenuRef}`.
# I will replace `profileMenuRef` reference since it was deleted.
content = content.replace('ref={profileMenuRef}', '')
# The user's code only rendered the button, then had `{showProfileMenu && ... }` twice and `{/* Profile dropdown menu removed per request */}`
content = re.sub(r"                        \{showProfileMenu && !effectiveCollapsed && \(.*?}", "", content, flags=re.DOTALL)
content = re.sub(r"                        \{/\* Profile dropdown menu removed per request \*/\}", "", content)

# Remove `showProfileMenu` references from chevron down in profile button
content = content.replace("(showProfileMenu || showLogoutConfirm) && \"rotate-180 text-primary-500\"", "location.pathname.startsWith('/profile') && \"text-[#4A8AF4]\"")


with open('/Users/erasoft/Downloads/local-live copy 23/application/src/components/layout/Sidebar.jsx', 'w') as f:
    f.write(content)
