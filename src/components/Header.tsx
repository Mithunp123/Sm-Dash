import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { LogOut, Menu, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState } from "react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAuthenticated = auth.isAuthenticated();
  const user = auth.getUser();

  const isDashboard = location.pathname.startsWith("/admin") || 
                     location.pathname.startsWith("/office-bearer") ||
                     location.pathname.startsWith("/student");
  
  const isLandingPage = location.pathname === "/";

  // Sidebar is now shown by default on all dashboard routes (admin, office bearer, student)
  // and there is no toggle button to hide it.
  const [showAdminSidebar] = useState<boolean>(isDashboard);
  
  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  return (
    <>
    <header className="border-b-2 border-primary/20 bg-gradient-to-r from-[#0A192F] via-[#0f1a2e] to-[#121A26] backdrop-blur-md sticky top-0 z-50 shadow-xl h-[65px]">
      <div className="container mx-auto px-4 md:px-6 h-full flex items-center">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
            {/* KSRCT Logo/Brand */}
            <div 
              className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-90 transition-all group"
              onClick={() => navigate("/")}
            >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary/40 to-accent/30 rounded-xl flex items-center justify-center border-2 border-primary/50 overflow-hidden shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all">
                <img 
                  src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png" 
                  alt="SM Volunteers Logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                  }}
                />
                <span className="text-lg font-bold text-primary hidden">SM</span>
              </div>
              <div className="block min-w-0">
                <div className="text-lg md:text-xl lg:text-2xl font-black drop-shadow-xl leading-tight">
                  <span className="text-orange-500">SM</span> <span className="text-green-400">Volunteers</span>
            </div>
                <div className="text-xs md:text-sm font-bold text-white leading-tight truncate max-w-[200px] md:max-w-none">
              K.S.Rangasamy College of Technology
                </div>
              </div>
            </div>
            {isAuthenticated && user?.name && (
              <div className="hidden lg:flex flex-col min-w-[120px] text-white/90 leading-tight">
                <span className="text-xs uppercase tracking-wide text-white/70">Welcome</span>
                <span className="text-base font-semibold">
                  {`Hi, ${(user.name.split(' ')[0] || user.name).trim()}!`}
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Show menu and user info when authenticated */}
            {isAuthenticated && (
              <>
                {/* Notification Bell - Show for all authenticated users */}
                <NotificationBell />
                
                {/* Sidebar toggle button removed - sidebar stays visible by default on dashboard */}
                {user && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-white/15 to-white/10 border border-white/30 backdrop-blur-md shadow-lg">
                    <Avatar key={(user as any).photo || (user as any).photo_url} className="w-8 h-8">
                      <AvatarImage src={(user as any).photo || (user as any).photo_url || '/Images/original logo.png'} />
                      <AvatarFallback>{((user?.name || '').split(' ').map(s => s[0]).slice(0,2).join('') || '?')}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-white truncate max-w-[120px]">{user.name}</span>
                    <span className="text-xs text-white/90 hidden xl:inline font-medium">
                      ({user.role.replace('_', ' ')})
                    </span>
                  </div>
                )}
                {/* Hide the explicit Logout button on the public landing page to avoid
                    showing a logged-in action on the marketing/landing screen. The
                    top-right avatar/profile still indicates signed-in state. */}
                {!isLandingPage && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2 border-orange-400 text-white bg-orange-500/20 hover:bg-orange-500/40 hover:text-white hover:border-orange-500 px-3 md:px-4 h-9 md:h-10 transition-all hover:scale-105 font-medium"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden md:inline text-sm">Logout</span>
                  </Button>
                )}
              </>
            )}

            {/* Show Login button when not authenticated */}
            {!isAuthenticated && (
              <Button 
                onClick={() => navigate("/login")}
                className="gap-2 glow-primary hover:scale-105 transition-all bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 px-4 md:px-6 h-9 md:h-10 font-semibold shadow-lg hover:shadow-xl"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
    {isAuthenticated && user && isDashboard && (
      <>
        {/* Sidebar - always visible on dashboard routes */}
      <div className={`${showAdminSidebar ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-[65px] z-40 transition-transform duration-300 ease-in-out`}>
          <div className="w-64 relative">
          <Sidebar />
        </div>
      </div>
      </>
    )}
    </>
  );
};

export default Header;
