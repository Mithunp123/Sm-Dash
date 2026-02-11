import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Calendar, FileText, BarChart3, Settings, LogOut, UsersRound, MessageSquare, ClipboardCheck, Briefcase, Trophy } from "lucide-react";
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
    hours: 0,
    awards: 0,
    students: 0,
    projects: 0,
    resources: 0,
    teams: 0,
  });


  useEffect(() => {
    // Check authentication and admin role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    // Check if user has management access (Admin or Office Bearer)
    const role = auth.getRole();
    const isManagement = ['admin', 'office_bearer'].includes(role || '');

    if (!isManagement) {
      toast.error("Access denied. Management access required.");
      if (role === 'student') {
        navigate("/student");
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
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

      const [
        usersRes,
        meetingsRes,
        billsRes,
        timeRes,
        awardsRes,
        studentsRes,
        projectsRes,
        resourcesRes,
        teamsRes,
      ] = await Promise.all([
        api.getUsers(),
        api.getMeetings(),
        api.getBills(),
        api.getTimeAllotments(),
        api.getAwards(),
        api.getStudentsScoped(),
        api.getProjects(),
        fetch(`${API_BASE}/resources`, {
          headers: { Authorization: `Bearer ${api['token'] || auth.getToken() || ''}` } as any,
        }).then((r) => r.json()).catch(() => ({ success: false, resources: [] })),
        fetch(`${API_BASE}/teams`, {
          headers: { Authorization: `Bearer ${auth.getToken() || ''}` },
        }).then((r) => r.json()).catch(() => ({ success: false, teams: [] })),
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
        hours: timeRes.allotments?.reduce((sum: number, t: any) => sum + (t.hours || 0), 0) || 0,
        awards: awardsRes.awards?.length || 0,
        students: studentsRes.students?.length || 0,
        projects: projectsRes.projects?.length || 0,
        resources: resourcesRes.resources?.length || 0,
        teams: teamsRes.teams?.length || 0,
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
    <>
      <DeveloperCredit />
      <div className="w-full px-4 md:px-6 lg:px-8 py-8 overflow-x-hidden">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-5xl font-bold text-foreground">Admin Dashboard</h1>
            {/* Add date or other top-level actions here if needed */}
          </div>

          {/* Statistics Cards - high level */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {/* ... Cards content preserved ... */}
            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  Total Volunteers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.volunteers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active members</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.events.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total meetings</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.reports.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total bills</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Trophy className="w-4 h-4 text-primary" />
                  Awards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.awards.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total awards</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Hours Logged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.hours.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed entity counts */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UsersRound className="w-4 h-4 text-primary" />
                  Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.students.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">In database</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.projects.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active projects</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.resources.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Shared items</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UsersRound className="w-4 h-4 text-primary" />
                  Teams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {stats.teams.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active teams</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
