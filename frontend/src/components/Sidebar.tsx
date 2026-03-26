import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Calendar, FileText, BarChart3, GraduationCap,
  Settings, UserCircle, Briefcase, ClipboardCheck, KeyRound, MessageSquare,
  UsersRound, FileBarChart, PhoneCall, UserCheck, Trophy, LogOut, Megaphone,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
  isImportant?: boolean;
}

// ---------------- Animated Accordion ----------------
function AnimatedAccordion({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(0);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (isOpen) {
      setVisible(true);
      // measure then animate
      const scrollH = el.scrollHeight;
      setHeight(0);
      // next tick
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(scrollH);
        });
      });
    } else {
      setHeight(el.scrollHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
        });
      });
    }
  }, [isOpen]);

  const handleTransitionEnd = () => {
    if (isOpen) {
      setHeight("auto"); // allow natural reflow once fully open
    } else {
      setVisible(false);
    }
  };

  if (!visible && !isOpen) return null;

  return (
    <div
      ref={ref}
      onTransitionEnd={handleTransitionEnd}
      style={{
        height: height === "auto" ? "auto" : `${height}px`,
        overflow: "hidden",
        transition: "height 320ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}
// -----------------------------------------------------

const Sidebar = ({ className, onItemClick }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = usePermissions();
  const [, setAuthUpdate] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Important"]));

  const isAuthenticated = auth.isAuthenticated();
  const user = auth.getUser();

  useEffect(() => {
    const unsubscribe = auth.onAuthChange(() => {
      setAuthUpdate(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  if (!isAuthenticated || !user) return null;

  const isActive = (path: string) => location.pathname === path;

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  // --- Admin Menu Items (Categorized) ---
  const getAdminMenuCategories = (): MenuCategory[] => {
    return [
      {
        category: "Important",
        isImportant: true,
        items: [
          { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
          { icon: Users, label: "Manage Users", path: "/admin/users" },
          { icon: Users, label: "Profile Management", path: "/admin/student-db" },
        ]
      },
      {
        category: "People Management",
        items: [
          { icon: UserCheck, label: "Interview Candidates", path: "/admin/interviews" },
          ...(user?.is_interviewer ? [{ icon: UserCheck, label: "My Interviews", path: "/mentor/interviews" }] : []),
          { icon: UsersRound, label: "Manage Office Bearers", path: "/admin/office-bearers" },
          { icon: UserCheck, label: "Mentor Management", path: "/admin/mentor-management" },
          { icon: UsersRound, label: "Teams", path: "/admin/teams" },
          { icon: Users, label: "Volunteer Submissions", path: "/admin/volunteers" },
        ]
      },
      {
        category: "Planning & Events",
        items: [
          { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
          { icon: Calendar, label: "Events", path: "/admin/events" },
          { icon: Briefcase, label: "Manage Projects", path: "/admin/projects" },
          { icon: FileText, label: "Minutes of Meeting", path: "/admin/minutes" },
        ]
      },
      {
        category: "Administration",
        items: [
          { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
          { icon: Trophy, label: "Awards", path: "/admin/awards" },
          { icon: BarChart3, label: "Finance", path: "/admin/finance" },
          { icon: FileText, label: "Resources", path: "/admin/resources" },
          { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
          { icon: ClipboardCheck, label: "Activity Logs", path: "/admin/activity-logs" },
        ]
      },
      {
        category: "Communication",
        items: [
          { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
          { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
          { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
          { icon: BarChart3, label: "Feedback Reports", path: "/admin/feedback/reports" },
        ]
      },
      {
        category: "Account",
        items: [
          { icon: UserCircle, label: "My Profile", path: "/office-bearer/profile" },
          { icon: Settings, label: "Settings", path: "/admin/settings" },
        ]
      }
    ];
  };

  // --- Office Bearer Menu Items (Categorized) ---
  const getOfficeBearerMenuCategories = (): MenuCategory[] => {
    return [
      {
        category: "Important",
        isImportant: true,
        items: [
          { icon: LayoutDashboard, label: "Dashboard", path: "/office-bearer" },
          { icon: Users, label: "Profile Management", path: "/admin/student-db" },
        ]
      },
      {
        category: "Interviews",
        items: [
          ...(user?.is_interviewer ? [{ icon: UserCheck, label: "My Interviews", path: "/mentor/interviews" }] : []),
        ]
      },
      {
        category: "Planning & Projects",
        items: [
          { icon: Briefcase, label: "Manage Projects", path: "/admin/projects" },
          { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
          { icon: Calendar, label: "Events", path: "/admin/events" },
          { icon: FileText, label: "Minutes of Meeting", path: "/admin/minutes" },
        ]
      },
      {
        category: "Administration",
        items: [
          { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
          { icon: BarChart3, label: "Finance", path: "/office-bearer/finance" },
          { icon: FileText, label: "Resources", path: "/admin/resources" },
          { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
          { icon: UsersRound, label: "Teams", path: "/admin/teams" },
        ]
      },
      {
        category: "Communication",
        items: [
          { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
          { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
          { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
        ]
      },
      {
        category: "Account",
        items: [
          { icon: UserCircle, label: "My Profile", path: "/office-bearer/profile" },
          { icon: Settings, label: "Settings", path: "/office-bearer/settings" },
        ]
      }
    ];
  };

  // --- Student Menu Items (Categorized) ---
  const getStudentMenuCategories = (): MenuCategory[] => {
    return [
      {
        category: "Important",
        isImportant: true,
        items: [
          { icon: LayoutDashboard, label: "Overview", path: "/student" },
        ]
      },
      {
        category: "Activities",
        items: [
          { icon: Calendar, label: "Calendar", path: "/student/calendar" },
          { icon: Calendar, label: "Events", path: "/student/events" },
          { icon: BarChart3, label: "Fund Raising", path: "/student/finance" },
          { icon: ClipboardCheck, label: "Attendance", path: "/student/attendance" },
          { icon: UsersRound, label: "Teams", path: "/student/teams" },
          ...(user?.is_interviewer ? [{ icon: UserCheck, label: "My Interviews", path: "/mentor/interviews" }] : []),
        ]
      },
      {
        category: "Mentoring",
        items: [
          { icon: PhoneCall, label: "My Mentees", path: "/student/mentees" },
        ]
      },
      {
        category: "Resources",
        items: [
          { icon: FileText, label: "Resources", path: "/resources" },
        ]
      },
      {
        category: "Communication",
        items: [
          { icon: MessageSquare, label: "Messages", path: "/student/messages" },
          { icon: MessageSquare, label: "Feedback", path: "/student/feedback" },
        ]
      },
      {
        category: "Account",
        items: [
          { icon: UserCircle, label: "My Profile", path: "/student/profile" },
          { icon: Settings, label: "Settings", path: "/student/settings" }
        ]
      }
    ];
  };

  const getMenuCategories = (): MenuCategory[] => {
    if (user?.role === 'admin') {
      return getAdminMenuCategories();
    } else if (user?.role === 'office_bearer') {
      const categories = getOfficeBearerMenuCategories();
      return categories.filter(cat => cat.items.length > 0);
    } else if (user?.role === 'student') {
      return getStudentMenuCategories();
    }
    return [];
  };

  let menuCategories = getMenuCategories();

  if (menuCategories.length === 0) return null;

  return (
    <div className={cn("flex flex-col h-full bg-[hsl(var(--sidebar))] border-r border-border", className)}>
      <div className="p-6 border-b border-white/5">
        {/* Logo Area */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/")}
        >
          <div className="shrink-0">
            <img
              src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
              alt="SM Volunteers Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-xl text-primary tracking-tight">SM Volunteers</span>
            <span className="text-xs text-muted-foreground/80 uppercase tracking-widest font-medium">Dashboard</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {menuCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.category);
            const isImportant = category.isImportant;

            return (
              <div key={category.category} className="mb-1">
                {/* Category Header (Collapsible) */}
                {!isImportant && (
                  <button
                    onClick={() => toggleCategory(category.category)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold",
                      "transition-all duration-200 group relative overflow-hidden",
                      isExpanded
                        ? "text-primary bg-primary/10 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
                    )}
                  >
                    {/* Active indicator bar */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-all duration-300",
                        isExpanded ? "h-5 opacity-100" : "h-0 opacity-0"
                      )}
                    />

                    <span className="flex-1 text-left pl-1">{category.category}</span>

                    {/* Animated chevron */}
                    <span
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300",
                        isExpanded
                          ? "bg-primary/20 text-primary rotate-180"
                          : "text-muted-foreground/60 rotate-0 group-hover:text-muted-foreground"
                      )}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                )}

                {/* Category Items — smooth slide animation */}
                {isImportant ? (
                  <div className="space-y-0.5">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <SidebarItem
                          key={item.path}
                          icon={Icon}
                          label={item.label}
                          active={active}
                          onClick={() => {
                            navigate(item.path);
                            onItemClick?.();
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <AnimatedAccordion isOpen={isExpanded}>
                    <div className="mt-1 ml-1 pl-3 border-l-2 border-primary/20 space-y-0.5 pb-1">
                      {category.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                          <SidebarItem
                            key={item.path}
                            icon={Icon}
                            label={item.label}
                            active={active}
                            onClick={() => {
                              navigate(item.path);
                              onItemClick?.();
                            }}
                          />
                        );
                      })}
                    </div>
                  </AnimatedAccordion>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
};

// ---- Extracted sidebar item for reuse ----
function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
        "transition-all duration-200 group",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-foreground/80 hover:text-primary hover:bg-primary/10"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 shrink-0",
          active
            ? "bg-white/20 text-primary-foreground"
            : "text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
        )}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span className="truncate">{label}</span>

      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground/80 shrink-0" />
      )}
    </button>
  );
}

export default Sidebar;
