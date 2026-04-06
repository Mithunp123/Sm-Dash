import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { LogOut, Menu, User, ChevronDown, ArrowLeft, X, Image as ImageIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NotificationBell from "./NotificationBell";
import { motion, AnimatePresence } from "framer-motion";
import { buildImageUrl } from "@/utils/imageUtils";

import { api } from "@/lib/api";

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuTrigger?: boolean;
  showBackButton?: boolean;
  showHeader?: boolean;
  showSidebar?: boolean;
}

const Header = ({ onMenuClick, showMenuTrigger = true, showBackButton = false, showHeader = true, showSidebar = true }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = auth.isAuthenticated();
  const [user, setUser] = useState(auth.getUser());
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);

  const isLandingPage = location.pathname === '/' || location.pathname === '/home';
  const isLoginPage = location.pathname === '/login';
  const [showAnnouncementBar, setShowAnnouncementBar] = useState(true);

  const knownFrontEndPaths = [
    // Admin routes
    '/admin', '/admin/announcements', '/admin/users', '/admin/interviews', '/admin/meetings',
    '/admin/minutes', '/admin/events', '/admin/finance', '/admin/bills', '/admin/analytics',
    '/admin/students', '/admin/student-db', '/admin/projects', '/admin/office-bearers',
    '/admin/attendance', '/admin/settings', '/admin/feedback', '/admin/volunteers',
    '/admin/resources', '/admin/reports', '/admin/teams', '/admin/mentor-management',
    '/admin/mentees', '/admin/messages', '/admin/awards', '/admin/activity-logs',
    // Office Bearer routes
    '/office-bearer', '/office-bearer/profile', '/office-bearer/settings', '/office-bearer/feedback',
    '/office-bearer/events', '/office-bearer/finance', '/office-bearer/bills', '/office-bearer/mentees',
    // Student routes
    '/student', '/student/calendar', '/student/events', '/student/profile', '/student/attendance',
    '/student/settings', '/student/feedback', '/student/teams', '/student/messages', '/student/finance',
    '/student/projects', '/student/bills', '/student/reports', '/student/mentees',
    // Mentor routes
    '/mentor/interviews', '/mentor/mentees',
    // Public routes
    '/home', '/login', '/volunteer-registration', '/resources', '/'
  ];

  const handleAnnouncementClick = (a: any) => {
    if (!a?.link_url || typeof a.link_url !== 'string') return;

    const link = a.link_url.trim();
    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank');
      return;
    }

    // guard against invalid internal routes causing 404
    if (!link.startsWith('/')) {
      window.open(link, '_blank');
      return;
    }

    // avoiding admin-only redirect for non-admin users
    const role = auth.getUser()?.role;
    if (link.startsWith('/admin') && role !== 'admin' && role !== 'office_bearer') {
      toast.error('This announcement is for admin users only.');
      return;
    }

    // Validate internal route - check if it matches known path or is a sub-route of known path
    const isValidRoute = knownFrontEndPaths.some(p => link === p || link.startsWith(p + '/'));
    
    if (!isValidRoute) {
      // Also allow common dynamic route patterns as fallback (e.g., /admin/students/:id, /bills/event/:eventId)
      const isDynamicRoute = /^\/[a-z\-]+(?:\/[a-z\-]+)*(?:\/\d+)?(?:\/[a-z\-]+)?(?:\/\d+)?$/.test(link);
      if (!isDynamicRoute) {
        toast.error('Sorry, this announcement link is unavailable in this build.');
        return;
      }
    }

    navigate(link);
  };


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

  // Load announcements for the global marquee
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const res = await api.getAnnouncements?.() || { success: false, announcements: [] };
        if (res.success && res.announcements) {
          setAnnouncements(res.announcements);
        }
      } catch (err) {
        console.error("Marquee fetch failed:", err);
      }
    };
    loadAnnouncements();
    // Refresh every 5 minutes to stay updated
    const interval = setInterval(loadAnnouncements, 300000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  if (isLoginPage || !showHeader) return null;

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
    <>
      {/* Global Scrolling Update Bar - ONLY on Landing Page */}
      {/* Global Scrolling Update Bar - ONLY if announcements exist and on Landing/Home */}
      {isLandingPage && announcements.length > 0 && showAnnouncementBar && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-9 flex items-center overflow-hidden">
          <div className="w-full h-full flex items-center gap-4 px-4 relative">
            <div className="flex-shrink-0 bg-orange-600 text-white px-4 py-1.5 rounded-sm text-[11px] font-black tracking-tighter flex items-center gap-2 shadow-md animate-pulse whitespace-nowrap">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>
              UPDATES
            </div>
            <div className="flex-1 overflow-hidden h-full flex items-center pr-4">
              <div className="relative w-full">

                <div
                  className="animate-marquee-running whitespace-nowrap flex gap-48 items-center text-slate-950 dark:text-white font-black text-sm uppercase tracking-tight"
                  style={{ animationDuration: '25s', width: 'max-content' }}
                >
                  {announcements.length > 0 ? (
                    announcements.map((a, i) => (
                      <div
                        key={`${a.id}-${i}`}
                        className={`flex items-center gap-4 pointer-events-auto cursor-pointer group transition-colors ${a.link_url ? 'hover:text-orange-600' : ''}`}
                        onClick={() => handleAnnouncementClick(a)}
                      >
                        <span className="text-orange-600 font-black text-xl">•</span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-900 dark:text-white font-black">{a.title}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-bold">{a.content}</span>
                        </span>
                        {a.link_url && (
                          <span className="ml-2 text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded shadow-sm font-black transition-all">CLICK TO VIEW</span>
                        )}
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className={`fixed ${isLandingPage && announcements.length > 0 ? "top-9" : "top-0"} z-50 right-0 transition-all duration-300 ${showSidebar ? "md:left-64" : "left-0"} left-0 w-full md:w-auto ${isLandingPage
        ? "bg-white/95 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md"
        : "bg-[hsl(var(--sidebar))] border-b border-white/5 shadow-sm"
        }`}>
        {/* Professional Background for Landing Page Header */}
        {isLandingPage && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500/40 via-cyan-400/40 to-blue-500/40"></div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500/20 via-blue-400/20 to-cyan-500/20"></div>
          </div>
        )}
        <div className="w-full px-4 md:px-6 relative z-10">
          {!isAuthenticated ? (
            /* Landing Page: Two-Row Layout */
            <div className="flex flex-row items-center justify-between gap-2 md:gap-4 py-3 md:py-6 md:px-10">
              {/* SM Logo (Left) */}
              <button
                onClick={() => navigate('/')}
                className="hover:opacity-100 transition-opacity cursor-pointer relative group shrink-0"
              >
                <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                <motion.div className="relative z-10">
                  <img
                    src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="h-14 md:h-20 w-auto object-contain"
                  />
                  <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                </motion.div>
              </button>

              {/* Center: Navigation Menu (Desktop Only) */}
              <nav className="hidden md:flex items-center justify-center gap-1.5 lg:gap-2 flex-grow max-w-7xl overflow-hidden px-2">
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
                        navigate('/login');
                      } else {
                        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="whitespace-nowrap text-xs lg:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 px-3 lg:px-5 py-2 rounded-lg transition-all uppercase tracking-wide border border-transparent hover:border-cyan-200 dark:hover:border-cyan-800"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Mobile: Hamburger Menu (Landing Page) */}
              <div className="md:hidden flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all border border-transparent hover:border-cyan-400/30">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700/50 text-white p-0 w-80">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Mobile Navigation</SheetTitle>
                      <SheetDescription>Access sections of the landing page</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full pt-6 px-6">
                      <div className="mb-8 pl-2">
                        <img src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png" alt="SM" className="h-16 w-auto mb-4" />
                        <h3 className="text-lg font-bold text-cyan-300 tracking-tight uppercase">SM VOLUNTEERS</h3>
                      </div>
                      <nav className="flex flex-col gap-3">
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
                                navigate('/login');
                              } else {
                                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className="flex items-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg px-4 py-3 transition-all uppercase tracking-wide w-full text-left"
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
                      className="h-14 md:h-20 w-auto object-contain"
                    />
                    <div className="absolute inset-0 rounded-full bg-primary/5 blur-md -z-10 animate-pulse"></div>
                  </motion.div>
                </a>
              </div>
            </div>
          ) : isLandingPage ? (
            /* Landing Page when Logged In */
            <div className="flex flex-row items-center justify-between gap-2 md:gap-4 py-3 md:py-6 md:px-10">
              <button
                onClick={() => navigate('/')}
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
                    className="whitespace-nowrap text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 px-4 py-2 rounded-lg transition-all uppercase tracking-wide border border-transparent"
                  >
                    {item.label}
                  </button>
                ))}
                <Button
                  onClick={handleLogout}
                  className="whitespace-nowrap text-xs md:text-sm font-bold bg-rose-600/20 border border-rose-500/50 hover:bg-rose-600/30 text-rose-300 px-4 py-2 rounded-lg transition-all uppercase tracking-wide ml-2"
                >
                  Logout
                </Button>
              </nav>

              <div className="md:hidden flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all border border-transparent hover:border-cyan-400/30">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700/50 text-white p-0 w-80">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Mobile Navigation</SheetTitle>
                      <SheetDescription>Access sections of the landing page</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full pt-6 px-6">
                      <nav className="flex flex-col gap-3">
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
                            className="flex items-center text-base font-bold text-gray-200 hover:text-cyan-300 hover:bg-cyan-500/20 rounded-lg px-4 py-3 transition-all uppercase tracking-wide w-full text-left border border-transparent hover:border-cyan-400/30"
                          >
                            {item.label}
                          </button>
                        ))}
                        <Button
                          onClick={handleLogout}
                          className="mt-6 w-full bg-rose-600/20 border border-rose-500/50 hover:bg-rose-600/30 text-rose-300 font-bold py-2 px-4 uppercase tracking-wide rounded-lg transition-all text-sm"
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
                      className="h-14 md:h-20 w-auto object-contain"
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
                  className="mr-2 md:hidden hover:bg-white/10"
                  onClick={onMenuClick}
                  aria-label="Toggle Menu"
                >
                  <Menu className="h-6 w-6 text-foreground dark:text-white" />
                </Button>
              )}

              {showBackButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="mr-4 gap-2 transition-all duration-200 text-foreground dark:text-white border-border dark:border-white/40 hover:bg-foreground/5 dark:hover:bg-white/20 hover:border-foreground/70 dark:hover:border-white/60"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm font-medium">
                    Back
                  </span>
                </Button>
              )}

              <div className="flex-1" />

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
                          onClick={() => setShowProfilePictureModal(true)}
                          className="cursor-pointer"
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          <span>View Profile Picture</span>
                        </DropdownMenuItem>
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
                          <span>View Profile</span>
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

      {/* Profile Picture Modal */}
      <Dialog open={showProfilePictureModal} onOpenChange={setShowProfilePictureModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Picture</DialogTitle>
            <DialogDescription>
              {user?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            {user?.photo_url || (user as any)?.photo ? (
              <img
                src={buildImageUrl(user.photo_url || (user as any).photo) || undefined}
                alt={user.name}
                className="max-w-xs max-h-96 rounded-lg shadow-lg object-contain"
              />
            ) : (
              <div className="flex items-center justify-center w-64 h-64 bg-muted rounded-lg">
                <div className="text-center">
                  <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No profile picture uploaded</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;
