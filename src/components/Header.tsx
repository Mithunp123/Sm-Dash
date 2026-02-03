import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { LogOut, Menu, User, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "./NotificationBell";
import { motion } from "framer-motion";
import { buildImageUrl } from "@/utils/imageUtils";

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuTrigger?: boolean;
}

const Header = ({ onMenuClick, showMenuTrigger = true }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = auth.isAuthenticated();
  const [user, setUser] = useState(auth.getUser());

  const isLandingPage = location.pathname === '/';
  const isLoginPage = location.pathname === '/login';

  // Listen for profile updates to refresh header
  useEffect(() => {
    const handleProfileUpdate = () => {
      setUser(auth.getUser());
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  if (isLoginPage) return null;

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get first name for greeting
  const getFirstName = (name: string) => {
    if (!name) return "User";
    const firstName = name.trim().split(" ")[0];
    return firstName.length > 12 ? firstName.substring(0, 12) + "..." : firstName;
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isLandingPage
      ? "bg-[#020617] border-b border-slate-800 shadow-2xl relative overflow-hidden"
      : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      }`}>
      {/* Background Pattern for Landing Page Header */}
      {isLandingPage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 dot-grid opacity-20"></div>
          <div className="absolute top-0 left-1/4 w-1/2 h-full bg-blue-500/10 blur-[100px]"></div>
        </div>
      )}
      <div className="max-w-7xl mx-auto relative z-10">
        {!isAuthenticated ? (
          /* Landing Page: Two-Row Layout */
          <>
            {/* Main Header Container: Logos and Navigation Menu */}
            <div className="flex flex-row items-center justify-between gap-4 px-4 py-8 md:px-10 overflow-x-auto">
              {/* SM Logo (Left) */}
              <button
                onClick={() => window.location.reload()}
                className="hover:opacity-100 transition-opacity cursor-pointer relative group shrink-0 [perspective:1000px]"
              >
                <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                <motion.div
                  className="relative z-10"
                >
                  <img
                    src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="h-16 md:h-24 w-auto object-contain"
                  />
                  {/* Subtle Glow Effect during rotation */}
                  <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                </motion.div>
              </button>

              {/* Center: Navigation Menu */}
              <nav className="flex items-center justify-center gap-1 md:gap-2 flex-grow max-w-7xl overflow-hidden px-2">
                {[
                  { label: 'Home', id: 'top' },
                  { label: 'About', id: 'about-section' },
                  { label: 'Events', id: 'events-section' },
                  { label: 'Awards', id: 'awards-section' },
                  { label: 'Team', id: 'office-bearers-section' },
                  { label: 'Coordinators', id: 'coordinators-section' },
                  { label: 'NGO', id: 'ngo-section' },
                  { label: 'Contacts', id: 'contact-section' },
                  { label: 'Login', id: 'login' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={(e) => {
                      if (item.id === 'top') {
                        window.location.reload();
                      } else if (item.id === 'login') {
                        window.location.href = '/login';
                      } else {
                        const element = document.getElementById(item.id);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }
                    }}
                    className="whitespace-nowrap text-xs md:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 px-3 md:px-4 py-2 rounded-lg transition-all uppercase tracking-tight"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* KSRCT Logo (Right) */}
              <div className="shrink-0 [perspective:1000px]">
                <a
                  href="https://ksrct.ac.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity cursor-pointer block relative group"
                >
                  <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                  <motion.div
                    className="relative z-10"
                  >
                    <img
                      src="/images/Brand_logo.png"
                      alt="KSRCT Brand Logo"
                      className="h-16 md:h-24 w-auto object-contain"
                    />
                    {/* Subtle Glow Effect */}
                    <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                  </motion.div>
                </a>
              </div>
            </div>
          </>
        ) : isLandingPage ? (
          /* Landing Page when Logged In */
          <>
            <div className="flex flex-row items-center justify-between gap-4 px-4 py-8 md:px-10 overflow-x-auto">
              <button
                onClick={() => window.location.reload()}
                className="hover:opacity-100 transition-opacity cursor-pointer relative group shrink-0 [perspective:1000px]"
              >
                <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                <motion.div className="relative z-10">
                  <img
                    src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="h-16 md:h-24 w-auto object-contain"
                  />
                  <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                </motion.div>
              </button>

              <nav className="flex items-center justify-center gap-1 md:gap-2 flex-grow max-w-7xl overflow-hidden px-2">
                {[
                  { label: 'Home', id: 'top' },
                  { label: 'About', id: 'about-section' },
                  { label: 'Events', id: 'events-section' },
                  { label: 'Awards', id: 'awards-section' },
                  { label: 'Team', id: 'office-bearers-section' },
                  { label: 'Coordinators', id: 'coordinators-section' },
                  { label: 'NGO', id: 'ngo-section' },
                  { label: 'Contacts', id: 'contact-section' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={(e) => {
                      if (item.id === 'top') {
                        window.location.reload();
                      } else {
                        const element = document.getElementById(item.id);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }
                    }}
                    className="whitespace-nowrap text-xs md:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 px-3 md:px-4 py-2 rounded-lg transition-all uppercase tracking-tight"
                  >
                    {item.label}
                  </button>
                ))}
                <Button
                  onClick={handleLogout}
                  className="whitespace-nowrap text-xs md:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 md:px-4 py-2 rounded-lg transition-all uppercase tracking-tight"
                >
                  Logout
                </Button>
              </nav>

              <div className="shrink-0 [perspective:1000px]">
                <a
                  href="https://ksrct.ac.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity cursor-pointer block relative group"
                >
                  <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                  <motion.div className="relative z-10">
                    <img
                      src="/images/Brand_logo.png"
                      alt="KSRCT Brand Logo"
                      className="h-16 md:h-24 w-auto object-contain"
                    />
                    <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                  </motion.div>
                </a>
              </div>
            </div>
          </>
        ) : (
          /* Dashboard Layout (Single Row) */
          <div className="flex h-16 items-center px-4 md:px-6">
            {showMenuTrigger && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-4 md:hidden"
                onClick={onMenuClick}
                aria-label="Toggle Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            <div className="flex-1 flex items-center gap-4">
              <div className="font-semibold text-foreground md:hidden">
                SM Volunteers
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              {user && (
                <div className="hidden md:flex items-center gap-3 pl-3 border-l border-border/50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-2 hover:bg-accent px-3 py-2 h-auto"
                      >
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarImage
                            src={buildImageUrl(user.photo_url || (user as any).photo) || undefined}
                            alt={user.name}
                          />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium leading-none">
                            Hi, {getFirstName(user.name)}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {user.role?.replace('_', ' ')}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          const role = user.role;
                          if (role === 'admin') navigate('/admin');
                          else if (role === 'student') navigate('/student/profile');
                          else if (role === 'office_bearer') navigate('/office-bearer/profile');
                          else navigate('/');
                        }}
                        className="cursor-pointer"
                      >
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="md:hidden text-muted-foreground hover:text-destructive"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
