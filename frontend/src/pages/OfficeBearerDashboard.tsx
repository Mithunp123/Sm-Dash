import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeveloperCredit from "@/components/DeveloperCredit";
import {
  Users, Calendar, FileText, Briefcase, UserCircle, BarChart3, XCircle,
  MessageSquare, ClipboardCheck, LayoutDashboard, Star, Clock, ChevronRight,
  TrendingUp, Layers, CheckCircle2, BookOpen, Trophy, UsersRound, Megaphone,
  FileBarChart
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const OfficeBearerDashboard = () => {
  const navigate = useNavigate();
  const { permissions, loading: permissionsLoading } = usePermissions();

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

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
  const [menteesCount, setMenteesCount] = useState(0);

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

      // Read local volunteer submissions (frontend-only fallback)
      let approvedCount = 0;
      try {
        const store = localStorage.getItem('volunteer_submissions');
        const arr = store ? JSON.parse(store) : [];
        approvedCount = arr.filter((s: any) => s.status === 'approved').length;
      } catch (e) {
        approvedCount = 0;
      }

      // Try to get users count (admin only) - catch error if forbidden
      let usersCount = approvedCount;
      try {
        const usersRes = await api.getUsers();
        if (usersRes.success && usersRes.users) {
          usersCount = usersRes.users.length;
        }
      } catch (error: any) {
        // Office bearers don't have access to /api/users - use fallback
        console.log('Users endpoint not accessible, using fallback count');
      }

      const [
        meetingsRes,
        billsRes,
        timeRes,
        awardsRes,
        studentsRes,
        projectsRes,
        resourcesRes,
        teamsRes,
        myMenteesRes,
      ] = await Promise.allSettled([
        api.getMeetings().catch((e) => ({ success: false, meetings: [], error: e.message })),
        api.getBills().catch((e) => ({ success: false, bills: [], error: e.message })),
        api.getTimeAllotments().catch((e) => ({ success: false, allotments: [], error: e.message })),
        api.getAwards().catch((e) => ({ success: false, awards: [], error: e.message })),
        api.getStudentsScoped().catch((e) => ({ success: false, students: [], error: e.message })),
        api.getProjects().catch((e) => ({ success: false, projects: [], error: e.message })),
        fetch(`${API_BASE}/resources`, {
          headers: { Authorization: `Bearer ${auth.getToken() || ''}` },
        }).then((r) => r.json()).catch(() => ({ success: false, resources: [] })),
        fetch(`${API_BASE}/teams`, {
          headers: { Authorization: `Bearer ${auth.getToken() || ''}` },
        }).then((r) => r.json()).catch(() => ({ success: false, teams: [] })),
        api.getMyMentees().catch((e) => ({ success: false, mentees: [], error: e.message })),
      ]);

      // Extract results from Promise.allSettled
      const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : { success: false, meetings: [] };
      const bills = billsRes.status === 'fulfilled' ? billsRes.value : { success: false, bills: [] };
      const time = timeRes.status === 'fulfilled' ? timeRes.value : { success: false, allotments: [] };
      const awards = awardsRes.status === 'fulfilled' ? awardsRes.value : { success: false, awards: [] };
      const students = studentsRes.status === 'fulfilled' ? studentsRes.value : { success: false, students: [] };
      const projects = projectsRes.status === 'fulfilled' ? projectsRes.value : { success: false, projects: [] };
      const resources = resourcesRes.status === 'fulfilled' ? resourcesRes.value : { success: false, resources: [] };
      const teams = teamsRes.status === 'fulfilled' ? teamsRes.value : { success: false, teams: [] };
      const myMentees = myMenteesRes && myMenteesRes.status === 'fulfilled' ? myMenteesRes.value : { success: false, mentees: [] };

      setStats({
        volunteers: usersCount,
        events: meetings.meetings?.length || 0,
        reports: bills.bills?.length || 0,
        hours: time.allotments?.reduce((sum: number, t: any) => sum + (t.hours || 0), 0) || 0,
        awards: awards.awards?.length || 0,
        students: students.students?.length || 0,
        projects: projects.projects?.length || 0,
        resources: resources.resources?.length || 0,
        teams: teams.teams?.length || 0,
      });

      // Set mentees count if available
      try {
        setMenteesCount(myMentees.mentees?.length || 0);
      } catch (e) {
        setMenteesCount(0);
      }

      // Log any errors for debugging (but don't show toasts for expected permission errors)
      const errors = [
        meetings.error,
        bills.error,
        time.error,
        awards.error,
        students.error,
        projects.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.warn('Some dashboard data failed to load:', errors);
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      // Only show error toast if it's not a permission issue
      if (!error.message?.includes('forbidden') && !error.message?.includes('403')) {
        toast.error('Failed to load some dashboard data. Please refresh the page.');
      }
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
        {/* Welcome Section (admin-style gradient) */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-6 md:p-12 shadow-lg border border-primary/20">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/20 text-white text-xs font-semibold backdrop-blur-sm mb-4 border border-white/30">
              <Star className="w-3 h-3 text-white" />
              <span>Office Bearer Dashboard</span>
            </div>
            <h1 className="page-title text-white mb-3">
              Welcome back, <span className="text-white font-extrabold">{user?.name || 'Office Bearer'}</span>
            </h1>
            <p className="page-subtitle text-white/90">
              Here's what's happening with your volunteers today.
            </p>
          </div>
        </div>

        {!hasAnyPermission ? (
          <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl rounded-3xl p-8 md:p-16 overflow-hidden relative">
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
            {/* Overview Stats */}
            <div className="section-container mb-xl">
              <h2 className="section-title flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                Overview
              </h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {[
                  { title: 'Active Projects', value: stats.projects, icon: Briefcase, desc: "Monitored projects", color: "text-emerald-500", bg: "bg-emerald-500/10", border: 'border-emerald-500/20' },
                  { title: 'Upcoming Meets', value: stats.events, icon: Calendar, desc: "Scheduled meetings", color: "text-purple-500", bg: "bg-purple-500/10", border: 'border-purple-500/20' },
                  { title: 'Total Reports', value: stats.reports, icon: FileText, desc: "Submitted reports", color: "text-rose-500", bg: "bg-rose-500/10", border: 'border-rose-500/20' },
                  { title: 'Hours Logged', value: stats.hours, icon: Clock, desc: "Total contribution", color: "text-amber-500", bg: "bg-amber-500/10", border: 'border-amber-500/20' }
                ].map((stat, i) => (
                  <motion.div key={i} variants={item}>
                    <Card
                      className="border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm relative group"
                    >
                      <div className={`absolute inset-0 border-2 rounded-xl border-dashed ${stat.border} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-muted-foreground">{stat.title}</h4>
                          <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                          <p className="text-sm text-muted-foreground">{stat.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Quick Actions */}
            <div className="section-container mb-xl">
              <h2 className="section-title flex items-center gap-2 mb-6">
                <Layers className="w-5 h-5 text-primary" />
                Quick Actions
              </h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {[
                  { title: 'Schedule Meetings', desc: 'Organize team meetings', icon: Calendar, path: '/admin/meetings', color: "text-green-500", bg: "bg-green-500/10", border: 'border-green-500/20', permission: permissions.can_manage_meetings },
                  { title: 'Track Attendance', desc: 'Monitor participation', icon: ClipboardCheck, path: '/admin/attendance', color: "text-purple-500", bg: "bg-purple-500/10", border: 'border-purple-500/20', permission: permissions.can_manage_attendance },
                  { title: 'Manage Teams', desc: 'Organize team structure', icon: UsersRound, path: '/admin/teams', color: "text-orange-500", bg: "bg-orange-500/10", border: 'border-orange-500/20', permission: permissions.can_manage_teams },
                  { title: 'View Reports', desc: 'Access system reports', icon: FileBarChart, path: '/admin/reports', color: "text-red-500", bg: "bg-red-500/10", border: 'border-red-500/20', permission: permissions.can_view_reports },
                  { title: 'Send Messages', desc: 'Communicate with team', icon: MessageSquare, path: '/admin/messages', color: "text-cyan-500", bg: "bg-cyan-500/10", border: 'border-cyan-500/20', permission: permissions.can_manage_messages },
                  { title: 'Post Announcements', desc: 'Share important updates', icon: Megaphone, path: '/admin/announcements', color: "text-yellow-500", bg: "bg-yellow-500/10", border: 'border-yellow-500/20', permission: permissions.can_manage_announcements },
                ].filter(action => action.permission).map((action, i) => (
                  <motion.div key={i} variants={item}>
                    <Card
                      className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm relative group cursor-pointer"
                      onClick={() => navigate(action.path)}
                    >
                      <div className={`absolute inset-0 border-2 rounded-xl border-dashed ${action.border} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`w-12 h-12 rounded-lg ${action.bg} ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <action.icon className="w-6 h-6" />
                          </div>
                          <ChevronRight className={`w-5 h-5 ${action.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">{action.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">{action.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>


          </div>
        )}
      </div>
    </>
  );
};

export default OfficeBearerDashboard;
