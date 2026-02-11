import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeveloperCredit from "@/components/DeveloperCredit";
import {
  Users, Calendar, FileText, Briefcase, UserCircle, BarChart3, XCircle,
  MessageSquare, ClipboardCheck, LayoutDashboard, Star, Clock, ChevronRight,
  TrendingUp, Layers, CheckCircle2, BookOpen, Trophy, UsersRound, Megaphone
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";

const OfficeBearerDashboard = () => {
  const navigate = useNavigate();
  const { permissions, loading: permissionsLoading } = usePermissions();

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (!auth.hasRole('office_bearer')) {
      navigate("/admin");
      return;
    }
    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
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
          headers: { Authorization: `Bearer ${auth.getToken() || ''}` },
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
    } finally {
      setLoading(false);
    }
  };

  const hasAnyPermission = permissions.can_manage_meetings ||
    permissions.can_manage_attendance ||
    permissions.can_manage_bills ||
    permissions.can_manage_projects ||
    permissions.can_manage_students;

  if (permissionsLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground font-medium">Loading permissions...</p>
        </div>
      </div>
    );
  }

  const user = auth.getUser();

  return (
    <>
      <DeveloperCredit />
      <div className="w-full space-y-12 pb-20 px-4 md:px-8">
        {/* Premium Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              OB Control Center
            </h1>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Welcome back, <span className="text-foreground">{user?.name || 'Office Bearer'}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="rounded-full h-11 px-6 font-bold uppercase text-xs tracking-widest border-primary/20 hover:bg-primary/5 hover:border-primary/40 shadow-sm transition-all" onClick={() => navigate("/office-bearer/profile")}>
              <UserCircle className="w-4 h-4 mr-2" />
              View Profile
            </Button>
          </div>
        </div>

        {!hasAnyPermission ? (
          <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl rounded-[3rem] p-16 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <CardContent className="relative z-10 text-center space-y-8">
              <div className="w-24 h-24 bg-muted/20 rounded-[2rem] flex items-center justify-center mx-auto ring-1 ring-border/50">
                <XCircle className="w-12 h-12 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-bold uppercase tracking-tight">Access Restricted</h3>
                <p className="text-muted-foreground max-w-lg mx-auto text-lg font-medium leading-relaxed">
                  Your account currently has no elective permissions. Please coordinate with the Head Administrator to activate your role dashboard modules.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Active Projects', value: stats.projects, icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-500/10' },
                { label: 'Upcoming Meets', value: stats.events, icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-500/10' },
                { label: 'Total Reports', value: stats.reports, icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50/50 dark:bg-rose-500/10' },
                { label: 'Hours Logged', value: stats.hours, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-500/10' }
              ].map((stat, i) => (
                <Card key={i} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] overflow-hidden bg-card/60 backdrop-blur-xl group cursor-default border border-border/10">
                  <CardContent className="p-7 flex flex-col gap-5">
                    <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold tracking-tighter text-foreground">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Feature Highlights */}
              <div className="lg:col-span-2 space-y-8">
                {/* Hero Banner Part II */}
                <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-indigo-600 to-primary p-10 text-foreground shadow-2xl">
                  <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                    <div>
                      <Badge className="bg-white/20 backdrop-blur-md border-white/10 text-foreground font-bold mb-4 px-4 py-1 rounded-full text-xs uppercase tracking-widest">
                        <TrendingUp className="w-3 h-3 mr-2" /> Role: Office Bearer
                      </Badge>
                      <h2 className="text-4xl font-bold mb-4 tracking-tighter leading-none">
                        Ready to lead the <br /> next mission?
                      </h2>
                      <p className="text-indigo-100/80 font-medium text-lg max-w-sm">
                        Coordinate your teams, manage resources, and track project milestones from one unified interface.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Button variant="secondary" className="bg-white text-primary hover:bg-white/90 font-bold uppercase tracking-widest text-xs rounded-2xl h-12 px-8" onClick={() => navigate("/admin/projects")}>
                        Manage Projects
                      </Button>
                      <Button variant="outline" className="bg-transparent border-white/20 text-foreground hover:bg-white/10 font-bold uppercase tracking-widest text-xs rounded-2xl h-12 px-8" onClick={() => navigate("/admin/meetings")}>
                        Schedule Meet
                      </Button>
                    </div>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-[-20%] left-[40%] w-64 h-64 bg-indigo-400/20 rounded-full blur-[80px]" />
                </div>

                {/* Management Quick Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {permissions.can_manage_students && (
                    <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate("/admin/students")}>
                      <CardContent className="p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                          <UserCircle className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-xl tracking-tight uppercase">Students</h4>
                          <p className="text-sm text-muted-foreground font-medium">Manage volunteer profiles and assignments.</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  )}
                  {permissions.can_manage_attendance && (
                    <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate("/admin/attendance")}>
                      <CardContent className="p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                          <ClipboardCheck className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-xl tracking-tight uppercase">Attendance</h4>
                          <p className="text-sm text-muted-foreground font-medium">Coordinate session marking and reports.</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  )}
                  {permissions.can_manage_bills && (
                    <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate("/admin/bills")}>
                      <CardContent className="p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-xl tracking-tight uppercase">Finance</h4>
                          <p className="text-sm text-muted-foreground font-medium">Review pending bills and fund reports.</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  )}
                  {permissions.can_manage_feedback_questions && (
                    <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate("/admin/feedback/questions")}>
                      <CardContent className="p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                          <MessageSquare className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-xl tracking-tight uppercase">Feedback</h4>
                          <p className="text-sm text-muted-foreground font-medium">Manage question banks and reports.</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  )}
                  {permissions.can_manage_announcements && (
                    <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate("/admin/announcements")}>
                      <CardContent className="p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                          <Megaphone className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-xl tracking-tight uppercase">Broadcast</h4>
                          <p className="text-sm text-muted-foreground font-medium">Post announcements and send alerts.</p>
                        </div>
                        <ChevronRight className="w-6 h-6 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-8">
                {/* Secondary stats */}
                <div className="grid grid-cols-1 gap-4">
                  <Card className="rounded-[2rem] border-none bg-card/40 p-4 flex flex-col items-center gap-2 group hover:bg-card/60 transition-colors">
                    <UsersRound className="w-5 h-5 text-indigo-500" />
                    <span className="text-xs font-bold uppercase text-muted-foreground">Teams</span>
                    <span className="text-lg font-bold">{stats.teams}</span>
                  </Card>
                </div>

                {/* Quick Action Summary Card */}
                <Card className="rounded-[2.5rem] bg-slate-900 text-foreground border-none shadow-2xl relative overflow-hidden group">
                  <div className="p-8 space-y-6 relative z-10">
                    <div className="flex items-center gap-3 text-primary">
                      <Layers className="w-6 h-6" />
                      <h4 className="font-black uppercase tracking-widest text-sm">Operation Hub</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => navigate("/admin/reports")}>
                        <div className="flex items-center gap-3">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest">Generate Reports</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/20" />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => navigate("/admin/teams")}>
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest">Team Management</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/20" />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => navigate("/admin/resources")}>
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest">Update Resources</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/20" />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => navigate("/admin/announcements")}>
                        <div className="flex items-center gap-3">
                          <Megaphone className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest">Publish Alerts</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/20" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-black uppercase text-foreground/40 tracking-widest">Server Logic Active</span>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-bold text-xs uppercase">Secure</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Wisdom/Inspiration Card */}
                <Card className="rounded-[2.5rem] border-none bg-indigo-50/50 dark:bg-indigo-900/10 p-8 space-y-4 relative overflow-hidden group">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Trophy className="w-5 h-5" />
                    <span className="font-black uppercase tracking-widest text-xs">Leader's Wisdom</span>
                  </div>
                  <p className="text-xl font-bold italic tracking-tight leading-7 text-indigo-900 dark:text-indigo-100">
                    "Leadership is not about being in charge. It's about taking care of those in your charge."
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="w-6 h-0.5 bg-indigo-600/30" />
                    <p className="text-indigo-600/60 dark:text-indigo-400/60 font-black text-xs uppercase tracking-widest">Sinek</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default OfficeBearerDashboard;
