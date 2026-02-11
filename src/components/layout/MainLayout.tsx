import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
    showSidebar?: boolean;
}

const MainLayout = ({ showSidebar = true }: MainLayoutProps) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    return (
        <div className="flex min-h-screen w-full flex-col bg-background text-foreground relative selection:bg-primary/20 overflow-x-hidden">
            {/* Clean Professional Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-slate-50 dark:bg-slate-950">
                <div className="absolute inset-0 blueprint-grid opacity-[0.05]"></div>
            </div>
            {/* Desktop Sidebar - Only if showSidebar is true */}
            {showSidebar && (
                <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-border/40 bg-[hsl(var(--sidebar))] backdrop-blur-xl md:block">
                    <Sidebar className="border-none" />
                </aside>
            )}

            {/* Mobile Sidebar - Sheet (Only if showSidebar is true) */}
            {showSidebar && (
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <SheetContent side="left" className="p-0 w-60 border-r border-border/40 bg-[hsl(var(--sidebar))] backdrop-blur-xl">
                        <Sidebar className="border-none" onItemClick={() => setIsMobileMenuOpen(false)} />
                    </SheetContent>
                </Sheet>
            )}

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out relative z-10",
                showSidebar ? "md:pl-60" : ""
            )}>
                <Header
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    showMenuTrigger={showSidebar}
                />

                <main className="flex-1 w-full max-w-full overflow-x-hidden overflow-y-auto pb-12">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
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
