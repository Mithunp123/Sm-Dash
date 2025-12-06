import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BarChart3, ArrowLeft, Users, Calendar, Clock, TrendingUp, UsersRound, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const Analytics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';
    const isOfficeBearer = user?.role === 'office_bearer';

    if (!isAdmin && !isOfficeBearer) {
      navigate("/login");
      return;
    }
    
    if (!isAdmin && !permissionsLoading) {
      if (!permissions.can_view_analytics) {
        toast.error("You don't have permission to access analytics");
        navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
        return;
      }
    }
    
    if (!permissionsLoading) {
      loadAnalytics();
    }
  }, [navigate, permissions, permissionsLoading]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('auth_token');
      
      const [usersRes, meetingsRes, billsRes, timeRes, projectsRes, teamsRes, attendanceRes] = await Promise.all([
        api.getUsers(),
        api.getMeetings(),
        api.getBills(),
        api.getTimeAllotments(),
        api.getProjects(),
        fetch(`${API_BASE}/teams`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ success: false, teams: [] })),
        fetch(`${API_BASE}/attendance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ success: false, attendance: [] }))
      ]);

      const users = usersRes.users || [];
      const meetings = meetingsRes.meetings || [];
      const bills = billsRes.bills || [];
      const allotments = timeRes.allotments || [];
      const projects = projectsRes.projects || [];
      const teams = teamsRes.teams || [];
      const attendance = attendanceRes.attendance || [];

      // Calculate role distribution
      const roleCounts: any = {};
      users.forEach((user: any) => {
        roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
      });

      // Calculate bill status distribution
      const billStatusCounts: any = {};
      bills.forEach((bill: any) => {
        billStatusCounts[bill.status] = (billStatusCounts[bill.status] || 0) + 1;
      });

      // Calculate attendance stats
      const attendanceByStatus: any = {};
      attendance.forEach((a: any) => {
        attendanceByStatus[a.status || 'unknown'] = (attendanceByStatus[a.status || 'unknown'] || 0) + 1;
      });

      // Calculate total hours by role
      const hoursByUser: any = {};
      allotments.forEach((allotment: any) => {
        if (!hoursByUser[allotment.user_id]) {
          hoursByUser[allotment.user_id] = 0;
        }
        hoursByUser[allotment.user_id] += allotment.hours || 0;
      });

      // Calculate events (meetings are events)
      const totalEvents = meetings.length;

      setStats({
        totalUsers: users.length,
        totalMeetings: meetings.length,
        totalBills: bills.length,
        totalHours: allotments.reduce((sum: number, t: any) => sum + (t.hours || 0), 0),
        totalProjects: projects.length,
        totalTeams: teams.length,
        totalEvents: totalEvents,
        totalAttendance: attendance.length,
        roleDistribution: Object.entries(roleCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value })),
        billStatusDistribution: Object.entries(billStatusCounts).map(([name, value]) => ({ name, value })),
        attendanceDistribution: Object.entries(attendanceByStatus).map(([name, value]) => ({ name, value }))
      });
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#FF7A00', '#00B86B', '#9C6AFF', '#FF6B6B', '#4ECDC4'];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary">Analytics</h1>
                <p className="text-muted-foreground">View participation statistics and trends</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary text-sm">
                  <Users className="w-4 h-4" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalUsers || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent text-sm">
                  <Calendar className="w-4 h-4" />
                  Events & Meetings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalEvents || stats.totalMeetings || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-violet text-sm">
                  <BarChart3 className="w-4 h-4" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalProjects || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600 text-sm">
                  <UsersRound className="w-4 h-4" />
                  Teams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalTeams || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalAttendance || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary text-sm">
                  <Clock className="w-4 h-4" />
                  Total Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalHours?.toLocaleString() || 0}</p>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalBills || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in">
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
                <CardDescription>Distribution of users by role</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.roleDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.roleDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.roleDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle>Bill Status Distribution</CardTitle>
                <CardDescription>Distribution of bills by status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.billStatusDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.billStatusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#FF7A00" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle>Attendance Status Distribution</CardTitle>
                <CardDescription>Distribution of attendance by status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.attendanceDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.attendanceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#00B86B" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle>Projects Overview</CardTitle>
                <CardDescription>Distribution of projects by status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.totalProjects > 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary mb-2">{stats.totalProjects}</div>
                      <p className="text-muted-foreground">Total Projects</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        </main>

      <Footer />
    </div>
  );
};

export default Analytics;

