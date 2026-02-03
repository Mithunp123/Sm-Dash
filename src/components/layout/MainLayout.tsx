import { useState } from "react";
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
            {/* Premium Multi-layered Background (Global) */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* Layer 1: Blueprint Grid */}
                <div className="absolute inset-0 blueprint-grid opacity-[0.1] dark:opacity-[0.05]"></div>

                {/* Layer 2: Dot Grid */}
                <div className="absolute inset-0 dot-grid opacity-[0.15] dark:opacity-[0.1]"></div>

                {/* Layer 3: Soft Pulsing Accents */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] animate-pulse-soft"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/10 blur-[120px] animate-pulse-soft [animation-delay:2s]"></div>
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-amber-500/5 blur-[100px] animate-pulse-soft [animation-delay:4s]"></div>

                {/* Layer 4: Radial Mask */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(255,255,255,0.2)_100%)] dark:bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(2,6,23,0.2)_100%)]"></div>
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
                    <Outlet />
                </main>

                {location.pathname === '/' && <Footer />}
            </div>
        </div>
    );
};

export default MainLayout;
