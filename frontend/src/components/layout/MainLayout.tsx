import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

import BottomNavbar from "./BottomNavbar";

interface MainLayoutProps {
    showSidebar?: boolean;
    showBackButton?: boolean;
}

const MainLayout = ({ showSidebar = true, showBackButton: backButtonProp }: MainLayoutProps) => {
    // Mobile menu state removed as we are using BottomNavbar
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Show back button on all pages except the main dashboards
    const isDashboard = location.pathname.match(/^\/admin\/?$|^\/student\/?$|^\/office-bearer\/?$/);
    const showBackButton = backButtonProp !== undefined ? backButtonProp : !isDashboard;

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground relative selection:bg-primary/20 overflow-x-hidden">
            {/* Clean Professional Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-background transition-colors duration-300"></div>

            {/* Desktop Sidebar - Only if showSidebar is true */}
            {showSidebar && (
                <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border/40 bg-sidebar backdrop-blur-xl md:block">
                    <Sidebar className="border-none" />
                </aside>
            )}

            {/* Mobile Sidebar (Drawer) */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-border/40">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navigation Menu</SheetTitle>
                        <SheetDescription>Main application navigation links</SheetDescription>
                    </SheetHeader>
                    <Sidebar className="border-none" onItemClick={() => setIsMobileMenuOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Mobile Bottom Navigation - Only if showSidebar is true */}
            {showSidebar && <BottomNavbar />}

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out relative z-10",
                showSidebar ? "md:pl-64" : ""
            )}>
                <Header
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    showMenuTrigger={showSidebar}
                    showSidebar={showSidebar}
                    showBackButton={showBackButton}
                />

                {/* Adjust padding for Bottom Nav (pb-20 for mobile, pb-12 for desktop) */}
                {/* Add pt-20 (80px) to account for fixed header height */}
                <main className="flex-1 w-full max-w-full overflow-x-hidden overflow-y-auto pb-24 md:pb-12 px-4 md:px-8 pt-20">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="w-full h-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>

                {location.pathname === '/' && <Footer />}
            </div>
        </div>
    );
};

export default MainLayout;
