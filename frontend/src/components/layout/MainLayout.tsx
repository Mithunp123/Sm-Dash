import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

import BottomNavbar from "./BottomNavbar";

interface MainLayoutProps {
    showSidebar?: boolean;
}

const MainLayout = ({ showSidebar = true }: MainLayoutProps) => {
    // Mobile menu state removed as we are using BottomNavbar
    // const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
    const location = useLocation();

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

            {/* Mobile Bottom Navigation - Only if showSidebar is true */}
            {showSidebar && <BottomNavbar />}

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out relative z-10",
                showSidebar ? "md:pl-64" : ""
            )}>
                <Header
                    onMenuClick={() => { }} // No-op since we removed the menu trigger
                    showMenuTrigger={false} // Hide hamburger on mobile as we have bottom nav
                />

                {/* Adjust padding for Bottom Nav (pb-20 for mobile, pb-12 for desktop) */}
                <main className="flex-1 w-full max-w-full overflow-x-hidden overflow-y-auto pb-24 md:pb-12 px-4 md:px-8">
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
