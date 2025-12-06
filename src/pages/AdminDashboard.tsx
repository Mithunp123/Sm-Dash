import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Calendar, FileText, BarChart3, Settings, LogOut, UsersRound, MessageSquare, ClipboardCheck, Briefcase } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    volunteers: 0,
    events: 0,
    reports: 0,
    hours: 0
  });
  

  useEffect(() => {
    // Check authentication and admin role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    // Check if user is admin
    if (!auth.hasRole('admin')) {
      toast.error("Access denied. Admin access required.");
      // Redirect to appropriate dashboard based on role
      const userRole = auth.getRole();
      if (userRole === 'office_bearer') {
        navigate("/office-bearer");
      } else if (userRole === 'student') {
        navigate("/student");
      } else if (userRole === 'alumni') {
        navigate("/admin/student-db");
      } else {
        navigate("/");
      }
      return;
    }

    // Load dashboard stats
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [usersRes, meetingsRes, billsRes, timeRes] = await Promise.all([
        api.getUsers(),
        api.getMeetings(),
        api.getBills(),
        api.getTimeAllotments()
      ]);

      // also read local volunteer submissions (frontend-only fallback)
      let approvedCount = 0;
      try {
        const store = localStorage.getItem('volunteer_submissions');
        const arr = store ? JSON.parse(store) : [];
        approvedCount = arr.filter((s: any) => s.status === 'approved').length;
      } catch (e) {
        approvedCount = 0;
      }

      setStats({
        volunteers: approvedCount || usersRes.users?.length || 0,
        events: meetingsRes.meetings?.length || 0,
        reports: billsRes.bills?.length || 0,
        hours: timeRes.allotments?.reduce((sum: number, t: any) => sum + (t.hours || 0), 0) || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden lg:block sticky top-[57px] h-[calc(100vh-57px)] bg-white dark:bg-slate-900 shadow-sm">
          <Sidebar />
        </div>
        
        <main className="flex-1 p-4 md:p-8 bg-background overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-primary mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage volunteers and activities</p>
          </div>

          {/* (View filter removed) */}

          {/* Statistics Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="gradient-card border-border/50 hover:glow-accent transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Users className="w-5 h-5" />
                  Total Volunteers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.volunteers}</p>
                <p className="text-sm text-muted-foreground">Active members</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-accent transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Calendar className="w-5 h-5" />
                  Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.events}</p>
                <p className="text-sm text-muted-foreground">Total meetings</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-accent transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet">
                  <FileText className="w-5 h-5" />
                  Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.reports}</p>
                <p className="text-sm text-muted-foreground">Total bills</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-accent transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <BarChart3 className="w-5 h-5" />
                  Hours Logged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.hours.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Management Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Always show Manage Users */}
            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Users className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                  Add, edit, or remove volunteers and coordinators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/users")}>View Users</Button>
              </CardContent>
            </Card>

            {/* Show other cards */}
            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Calendar className="w-12 h-12 text-accent mb-2" />
                <CardTitle>Meetings</CardTitle>
                <CardDescription>
                  Schedule and manage meetings, track attendance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/meetings")}>Manage Events</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <FileText className="w-12 h-12 text-violet mb-2" />
                <CardTitle>Bills</CardTitle>
                <CardDescription>
                  Review project reports and manage expenses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/bills")}>View Reports</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <BarChart3 className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  View participation statistics and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/analytics")}>View Analytics</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Settings className="w-12 h-12 text-violet mb-2" />
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure system preferences and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/settings")}>Settings</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <UsersRound className="w-12 h-12 text-accent mb-2" />
                <CardTitle>Teams</CardTitle>
                <CardDescription>
                  Create teams, assign members, and track assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/teams")}>Manage Teams</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <FileText className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Resources</CardTitle>
                <CardDescription>
                  Upload and organize resources with folders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/resources")}>Manage Resources</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <MessageSquare className="w-12 h-12 text-violet mb-2" />
                <CardTitle>Messages</CardTitle>
                <CardDescription>
                  View and respond to user messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/messages")}>View Messages</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Users className="w-12 h-12 text-accent mb-2" />
                <CardTitle>Volunteers</CardTitle>
                <CardDescription>
                  Review and approve volunteer registrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/volunteers")}>Manage Volunteers</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <ClipboardCheck className="w-12 h-12 text-primary mb-2" />
                <CardTitle>Attendance</CardTitle>
                <CardDescription>
                  Track meeting and event attendance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/projects")}>View Attendance</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Briefcase className="w-12 h-12 text-violet mb-2" />
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  Manage NGO projects and collaborations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/admin/projects")}>Manage Projects</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      </div>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
