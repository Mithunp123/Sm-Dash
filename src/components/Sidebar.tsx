import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Calendar, FileText, BarChart3, GraduationCap,
  Settings, UserCircle, Briefcase, ClipboardCheck, KeyRound, MessageSquare,
  UsersRound, FileBarChart, PhoneCall, UserCheck, Trophy, LogOut, Megaphone
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

const Sidebar = ({ className, onItemClick }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = usePermissions();

  const isAuthenticated = auth.isAuthenticated();
  const user = auth.getUser();

  if (!isAuthenticated || !user) return null;

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  // --- Menu Item Logic (Preserved) ---
  const adminMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Manage Users", path: "/admin/users" },
    { icon: UsersRound, label: "Manage Office Bearers", path: "/admin/office-bearers" },
    { icon: Users, label: "Student Database", path: "/admin/student-db" },
    { icon: Briefcase, label: "Manage Projects", path: "/admin/projects" },
    { icon: UserCheck, label: "Mentor Management", path: "/admin/mentor-management" },
    { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
    { icon: Calendar, label: "Events", path: "/admin/events" },
    { icon: Trophy, label: "Awards", path: "/admin/awards" },
    { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
    { icon: FileText, label: "Bills", path: "/admin/bills" },
    { icon: FileText, label: "Resources", path: "/admin/resources" },
    { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
    { icon: UsersRound, label: "Teams", path: "/admin/teams" },
    { icon: Users, label: "Volunteer Submissions", path: "/admin/volunteers" },
    { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
    { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
    { icon: UserCircle, label: "My Profile", path: "/office-bearer/profile" },
    { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
    { icon: BarChart3, label: "Feedback Reports", path: "/admin/feedback/reports" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  const getOfficeBearerMenuItems = () => {
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/office-bearer" },
      { icon: Users, label: "Student Database", path: "/admin/student-db" },
      { icon: Briefcase, label: "Manage Projects", path: "/admin/projects" },
      { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
      { icon: Calendar, label: "Events", path: "/admin/events" },
      { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
      { icon: FileText, label: "Bills", path: "/admin/bills" },
      { icon: FileText, label: "Resources", path: "/admin/resources" },
      { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
      { icon: UsersRound, label: "Teams", path: "/admin/teams" },
      { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
      { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
      { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
      { icon: UserCircle, label: "My Profile", path: "/office-bearer/profile" },
      { icon: Settings, label: "Settings", path: "/office-bearer/settings" },
    ];
  };

  const getAlumniMenuItems = () => ([
    { icon: LayoutDashboard, label: "Dashboard", path: "/alumni" },
    { icon: UserCircle, label: "Profile", path: "/alumni/profile" }
  ]);

  const getStudentMenuItems = () => {
    const items = [
      { icon: LayoutDashboard, label: "Overview", path: "/student" },
      { icon: Calendar, label: "Calendar", path: "/student/calendar" },
      { icon: Calendar, label: "Events", path: "/student/events" },
      { icon: UserCircle, label: "My Profile", path: "/student/profile" },
      { icon: PhoneCall, label: "My Mentees", path: "/student/mentees" },
    ];

    // Assigned modules removed as requested
    items.push({ icon: ClipboardCheck, label: "Attendance", path: "/student/attendance" });

    items.push(
      { icon: FileText, label: "Resources", path: "/resources" },
      { icon: UsersRound, label: "Teams", path: "/student/teams" },
      { icon: MessageSquare, label: "Messages", path: "/student/messages" },
      { icon: MessageSquare, label: "Feedback", path: "/student/feedback" },
      { icon: Settings, label: "Settings", path: "/student/settings" }
    );

    return items;
  };

  let menuItems: any[] = [];
  if (user?.role === 'admin') menuItems = adminMenuItems;
  else if (user?.role === 'office_bearer') {
    menuItems = getOfficeBearerMenuItems();
    if (menuItems.length === 0) menuItems = [{ icon: LayoutDashboard, label: "Dashboard", path: "/office-bearer" }];
  }
  else if (user?.role === 'alumni') menuItems = getAlumniMenuItems();
  else if (user?.role === 'student') menuItems = getStudentMenuItems();

  if (menuItems.length === 0 && user?.role !== 'office_bearer' && user?.role !== 'student') return null;

  return (
    <div className={cn("flex flex-col h-full bg-[hsl(var(--sidebar))] border-r border-border", className)}>
      <div className="p-6 border-b border-border/50">
        {/* Logo Area */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/")}
        >
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 overflow-hidden">
            <img
              src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
              alt="SM Volunteers Logo"
              className="w-full h-full object-contain p-1"
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-lg text-primary truncate leading-tight">SM Volunteers</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium truncate">Dashboard</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant={active ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-11 mb-1 transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
                )}
                onClick={() => {
                  navigate(item.path);
                  onItemClick?.();
                }}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="text-sm truncate">{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border/50 bg-secondary/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg bg-card border border-border/50 shadow-sm hover:bg-destructive/10 hover:border-destructive/50 transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover:bg-destructive/20 group-hover:text-destructive transition-colors">
            {user.email?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden flex-1">
            <span className="text-sm font-semibold truncate text-foreground group-hover:text-destructive transition-colors">{user.email}</span>
            <span className="text-xs text-muted-foreground truncate capitalize">Click to logout</span>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

