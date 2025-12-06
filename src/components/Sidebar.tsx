import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  BarChart3, 
  GraduationCap, 
  Settings,
  Home,
  UserCircle,
  Briefcase,
  ClipboardCheck,
  KeyRound,
  MessageSquare,
  UsersRound,
  FileBarChart,
  PhoneCall,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions } = usePermissions();
  
  // Check if user is authenticated
  const isAuthenticated = auth.isAuthenticated();
  
  // Safely get user - handle case where auth might not be initialized
  let user = null;
  try {
    user = auth.getUser();
  } catch (error) {
    console.error('Error getting user:', error);
  }

  // Don't render sidebar if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  const adminMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Manage Users", path: "/admin/users" },
    { icon: Users, label: "Student Database", path: "/admin/student-db" },
    { icon: Briefcase, label: "Manage Projects", path: "/admin/projects" },
    { icon: UserCheck, label: "Mentor Management", path: "/admin/mentor-management" },
    { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
    { icon: Calendar, label: "Events", path: "/admin/events" },
    { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
    { icon: FileText, label: "Bills", path: "/admin/bills" },
    { icon: FileText, label: "Resources", path: "/admin/resources" },
    { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
    { icon: UsersRound, label: "Teams", path: "/admin/teams" },
    { icon: Users, label: "Volunteer Submissions", path: "/admin/volunteers" },
    { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
    { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    { icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" },
    { icon: BarChart3, label: "Feedback Reports", path: "/admin/feedback/reports" },
    { icon: KeyRound, label: "Manage Permissions", path: "/admin/permissions" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  const getOfficeBearerMenuItems = () => {
    const items = [
      { icon: LayoutDashboard, label: "Dashboard", path: "/office-bearer" },
    ];
    // Always show Dashboard, then add other items based on permissions
    if (permissions?.can_manage_users) {
      items.push({ icon: Users, label: "Manage Users", path: "/admin/users" });
    }
    if (permissions?.can_manage_student_db || permissions?.can_manage_students) {
      items.push({ icon: Users, label: "Student Database", path: "/admin/student-db" });
    }
    if (permissions?.can_manage_projects) {
      items.push({ icon: Briefcase, label: "Projects", path: "/admin/projects" });
    }
    if (permissions?.can_manage_meetings) {
      items.push({ icon: Calendar, label: "Meetings", path: "/admin/meetings" });
    }
    if (permissions?.can_manage_events) {
      items.push({ icon: Calendar, label: "Events", path: "/admin/events" });
    }
    if (permissions?.can_manage_attendance) {
      items.push({ icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" });
    }
    if (permissions?.can_manage_bills) {
      items.push({ icon: FileText, label: "Bills", path: "/admin/bills" });
    }
    if (permissions?.can_manage_resources) {
      items.push({ icon: FileText, label: "Resources", path: "/admin/resources" });
    }
    if (permissions?.can_manage_teams || user?.role === 'admin') {
      items.push({ icon: UsersRound, label: "Teams", path: "/admin/teams" });
    }
    if (permissions?.can_manage_volunteers) {
      items.push({ icon: Users, label: "Volunteer Submissions", path: "/admin/volunteers" });
    }
    if (permissions?.can_manage_messages) {
      items.push({ icon: MessageSquare, label: "Messages", path: "/admin/messages" });
    }
    if (permissions?.can_view_analytics) {
      items.push({ icon: BarChart3, label: "Analytics", path: "/admin/analytics" });
    }
    if (permissions?.can_manage_feedback_questions) {
      items.push({ icon: MessageSquare, label: "Feedback Questions", path: "/admin/feedback/questions" });
    }
    if (permissions?.can_manage_feedback_reports) {
      items.push({ icon: BarChart3, label: "Feedback Reports", path: "/admin/feedback/reports" });
    }
    if (permissions?.can_manage_permissions_module) {
      items.push({ icon: KeyRound, label: "Manage Permissions", path: "/admin/permissions" });
    }
    if (permissions?.can_manage_settings) {
      // Office bearers get their own settings page under their dashboard
      items.push({ icon: Settings, label: "Settings", path: "/office-bearer/settings" });
    }
    return items;
  };

  // SPOC removed — no menu generated for this role

  const getAlumniMenuItems = () => {
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/alumni" },
      { icon: UserCircle, label: "Profile", path: "/alumni/profile" }
    ];
  };

  const getStudentMenuItems = () => {
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/student" },
      { icon: UserCircle, label: "My Profile", path: "/student/profile" },
      { icon: ClipboardCheck, label: "Attendance", path: "/student/attendance" },
      { icon: FileText, label: "Resources", path: "/resources" },
      { icon: UsersRound, label: "Teams", path: "/student/teams" },
      { icon: MessageSquare, label: "Messages", path: "/student/messages" },
      { icon: MessageSquare, label: "Feedback", path: "/student/feedback" },
      { icon: Settings, label: "Settings", path: "/student/settings" }
    ];
  };

  let menuItems: any[] = [];
  if (user?.role === 'admin') {
    menuItems = adminMenuItems;
  } else if (user?.role === 'office_bearer') {
    menuItems = getOfficeBearerMenuItems();
    // Always show at least Dashboard for office bearers, even if permissions haven't loaded
    if (menuItems.length === 0) {
      menuItems = [{ icon: LayoutDashboard, label: "Dashboard", path: "/office-bearer" }];
    }
  } else if (user?.role === 'alumni') {
    menuItems = getAlumniMenuItems();
  } else if (user?.role === 'student') {
    menuItems = getStudentMenuItems();
  }

  // Don't render sidebar if no menu items (except for office bearers and students who should always see Dashboard)
  if (menuItems.length === 0 && user?.role !== 'office_bearer' && user?.role !== 'student') {
    return null;
  }

  return (
    <aside className="w-64 bg-gradient-to-b from-[#0A192F] to-[#0f1419] border-r border-border/50 min-h-screen p-3 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-10 transition-all",
                isActive(item.path) 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 font-semibold" 
                  : "text-gray-200 hover:text-white hover:bg-white/10 font-medium"
              )}
              onClick={() => navigate(item.path)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold tracking-wide">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;

