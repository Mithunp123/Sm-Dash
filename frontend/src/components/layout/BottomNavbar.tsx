import { Home, Search, PlusCircle, User, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const BottomNavbar = () => {
    const location = useLocation();
    const pathname = location.pathname;

    // Determine role based on URL for now (or use context if available)
    const isStudent = pathname.includes("/student");
    const isAdmin = pathname.includes("/admin");
    const isOfficeBearer = pathname.includes("/office-bearer");

    const getHomeLink = () => {
        if (isStudent) return "/student";
        if (isAdmin) return "/admin";
        if (isOfficeBearer) return "/office-bearer";
        return "/home";
    };

    const getProfileLink = () => {
        if (isStudent) return "/student/profile";
        if (isAdmin) return "/admin/settings"; // Admin profile usually settings?
        if (isOfficeBearer) return "/office-bearer/profile";
        return "/settings";
    };

    const navItems = [
        {
            icon: Home,
            label: "Home",
            href: getHomeLink(),
            isActive: pathname === getHomeLink() || pathname === "/home",
        },
        {
            icon: Search,
            label: "Explore",
            href: "/resources", // Placeholder for Explore
            isActive: pathname.includes("/resources") || pathname.includes("/events"),
        },
        {
            icon: PlusCircle,
            label: "Action",
            href: "#", // Placeholder for FAB
            isActive: false,
            isFab: true,
        },
        {
            icon: User,
            label: "Profile",
            href: getProfileLink(),
            isActive: pathname.includes("/profile") || pathname.includes("/settings"),
        },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe md:hidden">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.label}
                        to={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                            item.isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            item.isFab && "text-primary"
                        )}
                    >
                        {item.isFab ? (
                            <div className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg -mt-8 border-4 border-background">
                                <item.icon size={24} />
                            </div>
                        ) : (
                            <>
                                <item.icon size={24} strokeWidth={item.isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default BottomNavbar;
