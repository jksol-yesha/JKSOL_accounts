import re

with open("/Users/erasoft/Downloads/local-live copy 23/application/src/components/layout/Sidebar.jsx", "r") as f:
    content = f.read()

# 1. Add LogOut to lucide-react import
content = re.sub(
    r"import \{(.*?)\} from 'lucide-react';",
    lambda m: f"import {{{m.group(1).rstrip()},\n    LogOut\n}} from 'lucide-react';" if 'LogOut' not in m.group(1) and 'ArrowRight' in m.group(1) else m.group(0),
    content,
    flags=re.DOTALL
)

# 2. Add logout to useAuth and state variables
content = re.sub(
    r"const \{ user \} = useAuth\(\);",
    "const { user, logout } = useAuth();\n    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);\n    const [isLoggingOut, setIsLoggingOut] = React.useState(false);\n\n    const handleActualLogout = async () => {\n        setIsLoggingOut(true);\n        try {\n            await logout();\n            navigate('/login');\n        } catch (error) {\n            console.error('Logout failed:', error);\n            setIsLoggingOut(false);\n        }\n    };",
    content
)

# 3. Add the LogOut button perfectly below the Profile button
profile_button_regex = r"(</button>\n\s*</div>\n\n\s*)\{!isMobileViewport"

logout_button_jsx = """</button>
                    </div>

                    {/* Inline Logout Trigger & Confirmation (Merged with sidebar) */}
                    <div className="relative w-full overflow-hidden transition-all duration-300 ease-in-out">
                        {showLogoutConfirm ? (
                            <div className="flex flex-col gap-2 p-3 bg-red-50 border-t border-red-100 mt-1 rounded-t-md opacity-100 animate-in fade-in duration-200">
                                <div className="text-xs font-semibold text-red-700 text-center">Log out?</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={isLoggingOut}
                                        onClick={() => setShowLogoutConfirm(false)}
                                        className="flex-1 py-1.5 px-2 bg-white text-gray-600 border border-gray-200 rounded text-[11px] font-bold tracking-wide hover:bg-gray-50 transition-colors pointer-events-auto"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isLoggingOut}
                                        onClick={handleActualLogout}
                                        className="flex-1 py-1.5 px-2 bg-red-500 text-white border border-red-600 rounded text-[11px] font-bold tracking-wide hover:bg-red-600 transition-colors pointer-events-auto flex items-center justify-center"
                                    >
                                        {isLoggingOut ? '...' : 'Sure'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(true)}
                                className={cn(
                                    "flex h-[38px] w-full items-center justify-center transition-all duration-200 group relative border border-transparent text-slate-500 hover:text-red-500 hover:bg-red-50 px-3",
                                    effectiveCollapsed ? "mx-auto h-[38px] w-[38px] rounded-md px-0" : "gap-3"
                                )}
                            >
                                <LogOut size={16} strokeWidth={2} className="shrink-0" />
                                {!effectiveCollapsed && (
                                    <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium tracking-wide">
                                        Log out
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {!isMobileViewport"""

content = re.sub(profile_button_regex, logout_button_jsx, content)

with open("/Users/erasoft/Downloads/local-live copy 23/application/src/components/layout/Sidebar.jsx", "w") as f:
    f.write(content)

print("success")
