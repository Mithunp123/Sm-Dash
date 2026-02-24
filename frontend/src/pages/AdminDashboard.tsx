import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Calendar, FileText, BarChart3, Settings, LogOut, UsersRound, MessageSquare, ClipboardCheck, Briefcase, Trophy, Sparkles, TrendingUp, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

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
  const [user, setUser] = useState<{ name: string, role: string } | null>(null);

  useEffect(() => {
    // Check authentication and admin role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    // Check if user has management access (Admin or Office Bearer)
    const role = auth.getRole();
    const isManagement = ['admin', 'office_bearer'].includes(role || '');

    const currentUser = auth.getUser();
    if (currentUser) {
      setUser({
        name: currentUser.name || currentUser.email.split('@')[0],
        role: currentUser.role
      });
    }

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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  const statCards = [
    { title: "Total Volunteers", value: stats.volunteers, icon: Users, desc: "Active members", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { title: "Events Organized", value: stats.events, icon: Calendar, desc: "Total meetings", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { title: "Reports Submitted", value: stats.reports, icon: FileText, desc: "Total bills", color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
    { title: "Awards Given", value: stats.awards, icon: Trophy, desc: "Total awards", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    { title: "Hours Logged", value: stats.hours, icon: BarChart3, desc: "Total contribution", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { title: "Students", value: stats.students, icon: UsersRound, desc: "Database records", color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    { title: "Projects", value: stats.projects, icon: Briefcase, desc: "Active projects", color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    { title: "Resources", value: stats.resources, icon: ClipboardCheck, desc: "Shared materials", color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
    { title: "Teams", value: stats.teams, icon: Shield, desc: "Active teams", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  ];

  return (
    <>
      <DeveloperCredit />
      <div className="w-full min-h-screen bg-background p-4 md:p-8 space-y-8">

        {/* Welcome Section - Academic Professional Style */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-8 md:p-12 shadow-lg border border-primary/20"
        >
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/20 text-white text-xs font-semibold backdrop-blur-sm mb-4 border border-white/30">
              <Sparkles className="w-3 h-3 text-white" />
              <span>Admin Dashboard</span>
            </div>
            <h1 className="page-title text-white mb-3">
              Welcome back, <span className="text-white font-extrabold">{user?.name}</span>
            </h1>
            <p className="page-subtitle text-white/90">
              Here's what's happening with your volunteers today.
            </p>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <div className="section-container mb-xl">
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Overview
          </h2>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {statCards.map((stat, i) => (
              <motion.div key={i} variants={item}>
                <Card className="group relative overflow-hidden border-radius-md card-container hover:border-primary/30 transition-all duration-200 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="card-title">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2.5 rounded-md ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-200`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-foreground">{stat.value.toLocaleString()}</div>
                    <p className="body-text-sm mt-2">
                      {stat.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
