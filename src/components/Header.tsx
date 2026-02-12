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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import NotificationBell from "./NotificationBell";
import { motion } from "framer-motion";
import { buildImageUrl } from "@/utils/imageUtils";

import { api } from "@/lib/api";

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

  // Update user state when location changes (e.g. after login redirect)
  useEffect(() => {
    setUser(auth.getUser());
  }, [location.pathname]);

  // Fetch latest user data on mount to ensure photo is up to date
  useEffect(() => {
    const refreshUserKey = async () => {
      if (isAuthenticated && user?.id) {
        try {
          const res = await api.getUser(user.id);
          if (res.success && res.user) {
            // Check if photo info is missing in current session but present in API response
            const currentPhoto = user.photo_url || (user as any).photo;
            const newPhoto = res.user.photo_url || res.user.photo;

            if (newPhoto && newPhoto !== currentPhoto) {
              const updatedUser = { ...user, ...res.user };
              auth.setUser(updatedUser);
              setUser(updatedUser);
            }
          }
        } catch (error) {
          console.error("Failed to refresh user data", error);
        }
      }
    };
    refreshUserKey();
  }, [isAuthenticated]);

  if (isLoginPage) return null;

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "U";
    // Check if name is an email
    if (name.includes('@')) {
      const part = name.split('@')[0];
      return part.substring(0, 2).toUpperCase();
    }

    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get first name for greeting
  const getFirstName = (name: string) => {
    if (!name) return "User";

    let displayName = name;
    if (name.includes('@')) {
      displayName = name.split('@')[0];
      // Capitalize first letter
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }

    const firstName = displayName.trim().split(" ")[0];
    return firstName.length > 12 ? firstName.substring(0, 12) + "..." : firstName;
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isLandingPage
      ? "bg-[#020617] border-b border-slate-800 shadow-2xl relative overflow-hidden"
      : "bg-[hsl(var(--sidebar))] border-b border-white/5"
      }`}>
      {/* Background Pattern for Landing Page Header */}
      {isLandingPage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 dot-grid opacity-20"></div>
          <div className="absolute top-0 left-1/4 w-1/2 h-full bg-blue-500/10 blur-[100px]"></div>
        </div>
      )}
      <div className="w-full px-4 md:px-6 relative z-10">
        {!isAuthenticated ? (
          /* Landing Page: Two-Row Layout */
          <div className="flex flex-row items-center justify-between gap-4 py-4 md:py-8 md:px-10">
            {/* SM Logo (Left) */}
            <button
              onClick={() => window.location.reload()}
              className="hover:opacity-100 transition-opacity cursor-pointer relative group shrink-0"
            >
              <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
              <motion.div className="relative z-10">
                <img
                  src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                  alt="SM Volunteers Logo"
                  className="h-12 md:h-24 w-auto object-contain"
                />
                <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
              </motion.div>
            </button>

            {/* Center: Navigation Menu (Desktop Only) */}
            <nav className="hidden md:flex items-center justify-center gap-2 flex-grow max-w-7xl overflow-hidden px-2">
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
                  onClick={() => {
                    if (item.id === 'top') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (item.id === 'login') {
                      window.location.href = '/login';
                    } else {
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="whitespace-nowrap text-xs md:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg transition-all uppercase tracking-tight"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Mobile: Hamburger Menu (Landing Page) */}
            <div className="md:hidden flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#020617] border-slate-800 text-white p-0 w-72">
                  <div className="flex flex-col h-full pt-20 px-6">
                    <div className="mb-8 pl-2">
                      <img src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png" alt="SM" className="h-16 w-auto mb-4" />
                      <h3 className="text-xl font-black text-primary tracking-tighter">SM VOLUNTEERS</h3>
                    </div>
                    <nav className="flex flex-col gap-4">
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
                          onClick={() => {
                            if (item.id === 'top') {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else if (item.id === 'login') {
                              window.location.href = '/login';
                            } else {
                              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="flex items-center text-lg font-bold text-slate-300 hover:text-primary py-2 transition-all uppercase tracking-widest text-left"
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* KSRCT Logo (Right) */}
            <div className="shrink-0">
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
                    className="h-12 md:h-24 w-auto object-contain"
                  />
                  <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                </motion.div>
              </a>
            </div>
          </div>
        ) : isLandingPage ? (
          /* Landing Page when Logged In */
          <div className="flex flex-row items-center justify-between gap-4 py-4 md:py-8 md:px-10">
            <button
              onClick={() => window.location.reload()}
              className="hover:opacity-100 transition-opacity cursor-pointer relative group shrink-0"
            >
              <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
              <motion.div className="relative z-10">
                <img
                  src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                  alt="SM Volunteers Logo"
                  className="h-12 md:h-24 w-auto object-contain"
                />
              </motion.div>
            </button>

            <nav className="hidden md:flex items-center justify-center gap-2 flex-grow max-w-7xl overflow-hidden px-2">
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
                  onClick={() => {
                    if (item.id === 'top') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="whitespace-nowrap text-xs md:text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg transition-all uppercase tracking-tight"
                >
                  {item.label}
                </button>
              ))}
              <Button
                onClick={handleLogout}
                className="whitespace-nowrap text-xs md:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-all uppercase tracking-tight ml-2"
              >
                Logout
              </Button>
            </nav>

            <div className="md:hidden flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#020617] border-slate-800 text-white p-0 w-72">
                  <div className="flex flex-col h-full pt-20 px-6">
                    <nav className="flex flex-col gap-4">
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
                          onClick={() => {
                            if (item.id === 'top') {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else {
                              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="flex items-center text-lg font-bold text-slate-300 hover:text-primary py-2 transition-all uppercase tracking-widest text-left"
                        >
                          {item.label}
                        </button>
                      ))}
                      <Button
                        onClick={handleLogout}
                        className="mt-4 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 uppercase tracking-widest rounded-xl"
                      >
                        Logout
                      </Button>
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="shrink-0">
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
                    className="h-12 md:h-24 w-auto object-contain"
                  />
                </motion.div>
              </a>
            </div>
          </div>
        ) : (
          /* Dashboard Layout (Single Row) */
          <div className="flex h-20 items-center px-4 md:px-6">
            {showMenuTrigger && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-4 md:hidden text-white"
                onClick={onMenuClick}
                aria-label="Toggle Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            <div className="flex-1 flex items-center gap-4">
              <div className="font-semibold text-white md:hidden">
                SM Volunteers
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              {user && (
                <div className="flex items-center gap-3 pl-3 border-l border-white/10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-3 hover:bg-white/5 px-3 py-2 h-auto text-white hover:text-white"
                      >
                        <div className="hidden lg:flex flex-col items-start gap-0.5">
                          <span className="text-sm font-semibold leading-none">
                            {getFirstName(user.name)}
                          </span>
                          <span className="text-sm text-white/75 capitalize font-medium leading-none">
                            {user.role?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex lg:hidden flex-col items-end mr-2 text-right">
                          <span className="text-sm font-semibold leading-none max-w-[100px] truncate">
                            {getFirstName(user.name)}
                          </span>
                          <span className="text-[10px] text-white/60 capitalize font-medium max-w-[100px] truncate">
                            {user.role?.replace('_', ' ')}
                          </span>
                        </div>

                        <Avatar className="h-9 w-9 border-2 border-white/20">
                          <AvatarImage
                            src={buildImageUrl(user.photo_url || (user as any).photo) || undefined}
                            alt={user.name}
                          />
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.role?.replace('_', ' ')}
                          </p>
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
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
