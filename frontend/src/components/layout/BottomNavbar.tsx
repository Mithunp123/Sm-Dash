import { Home, Calendar, Users, User, LayoutDashboard, ClipboardCheck, MessageSquare, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";

const BottomNavbar = () => {
    const location = useLocation();
    const pathname = location.pathname;
    const user = auth.getUser();
    const role = user?.role;

    // Role-aware navigation items (5 items max for bottom nav)
    const getNavItems = () => {
        if (role === 'admin') {
            return [
                { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
                { icon: Users, label: "Students", href: "/admin/users" },
                { icon: Calendar, label: "Events", href: "/admin/events" },
                { icon: ClipboardCheck, label: "Attendance", href: "/admin/attendance" },
                { icon: Settings, label: "Settings", href: "/admin/settings" },
            ];
        }
        if (role === 'office_bearer') {
            return [
                { icon: LayoutDashboard, label: "Dashboard", href: "/office-bearer" },
                { icon: Calendar, label: "Events", href: "/admin/events" },
                { icon: ClipboardCheck, label: "Attendance", href: "/admin/attendance" },
                { icon: MessageSquare, label: "Messages", href: "/admin/messages" },
                { icon: User, label: "Profile", href: "/office-bearer/profile" },
            ];
        }
        // Student (default)
        return [
            { icon: Home, label: "Home", href: "/student" },
            { icon: Calendar, label: "Events", href: "/student/events" },
            { icon: ClipboardCheck, label: "Attendance", href: "/student/attendance" },
            { icon: MessageSquare, label: "Messages", href: "/student/messages" },
            { icon: User, label: "Profile", href: "/student/profile" },
        ];
    };

    const navItems = getNavItems();

    const isActive = (href: string) => {
        if (href === "/admin" || href === "/office-bearer" || href === "/student") {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Glass blur bar */}
            <div className="bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                <div className="flex justify-around items-center h-16 px-1">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.label}
                                to={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 relative",
                                    active ? "text-orange-500" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {/* Active indicator pill */}
                                {active && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
                                )}
                                <item.icon
                                    size={active ? 22 : 20}
                                    strokeWidth={active ? 2.5 : 2}
                                    className={cn("transition-all", active && "drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]")}
                                />
                                <span className={cn(
                                    "text-[10px] font-semibold transition-all",
                                    active ? "font-bold" : "font-medium"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BottomNavbar;
