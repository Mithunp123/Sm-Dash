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
    { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
    { icon: UserCircle, label: "My Profile", path: "/office-bearer/profile" },
    { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
    { icon: BarChart3, label: "Feedback Reports", path: "/admin/feedback/reports" },
    { icon: ClipboardCheck, label: "Activity Logs", path: "/admin/activity-logs" },
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
  else if (user?.role === 'student') menuItems = getStudentMenuItems();

  if (menuItems.length === 0 && user?.role !== 'office_bearer' && user?.role !== 'student') return null;

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
              src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
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
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant={active ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10 mb-1 transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 font-medium"
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
    </div>
  );
};

export default Sidebar;

