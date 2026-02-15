import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { BarChart3, ArrowLeft, Users, Calendar, Clock, TrendingUp, UsersRound, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

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

    if (!isAdmin) {
      toast.error("You don't have permission to access analytics");
      navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/login");
      return;
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
        fetch(`${API_BASE}/teams`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : ({ success: false, teams: [] }))
          .catch(() => ({ success: false, teams: [] })),
        fetch(`${API_BASE}/attendance`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : ({ success: false, attendance: [] }))
          .catch(() => ({ success: false, attendance: [] }))
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

      // Calculate total events (meetings + events if separated)
      const totalEvents = meetings.length;

      // Calculate Bill Amount Distribution & Total Amount
      const totalBillAmount = bills.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);

      // Attendance Trend (Participation over days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const attendanceTrend = last7Days.map(date => {
        const count = attendance.filter((a: any) => (a.attendance_date || '').startsWith(date)).length;
        return { date: date.slice(5), count };
      });

      // Role Distribution for Pie
      const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value
      }));

      // Top Performers (by hours)
      const topPerformers = Object.entries(hoursByUser)
        .map(([userId, hours]) => {
          const user = users.find((u: any) => u.id === Number(userId));
          return { name: user?.name || `User ${userId}`, hours };
        })
        .sort((a, b) => (b.hours as number) - (a.hours as number))
        .slice(0, 5);

      // Registration trend (last 6 months)
      const months = [...Array(6)].map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d.toLocaleString('default', { month: 'short' });
      }).reverse();

      const regTrend = months.map(month => {
        const count = users.filter((u: any) => {
          if (!u.created_at) return false;
          const userDate = new Date(u.created_at);
          return userDate.toLocaleString('default', { month: 'short' }) === month;
        }).length;
        return { name: month, users: count };
      });

      setStats({
        totalUsers: users.length,
        totalMeetings: meetings.length,
        totalBills: bills.length,
        totalBillAmount,
        totalHours: allotments.reduce((sum: number, t: any) => sum + (t.hours || 0), 0),
        totalProjects: projects.length,
        totalTeams: teams.length,
        totalEvents: totalEvents,
        totalAttendance: attendance.length,
        roleDistribution,
        billStatusDistribution: Object.entries(billStatusCounts).map(([name, value]) => ({ name, value })),
        attendanceDistribution: Object.entries(attendanceByStatus).map(([name, value]) => ({ name, value })),
        attendanceTrend,
        topPerformers,
        regTrend
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

      <DeveloperCredit />

      <main className="flex-1 p-2 md:p-4 bg-background w-full">
        <div className="w-full">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-foreground mb-1">Analytics</h1>
            <p className="text-sm text-muted-foreground">View participation statistics and trends</p>
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
                <CardTitle className="flex items-center gap-2 text-purple-600 text-sm">
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
                <CardTitle className="flex items-center gap-2 text-primary text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Bill Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{stats.totalBillAmount?.toLocaleString() || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Total across {stats.totalBills || 0} bills</p>
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
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        innerRadius={40}
                        stroke="#1a1a1a"
                        strokeWidth={2}
                        dataKey="value"
                      >
                        {stats.roleDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle>Member Growth Trend</CardTitle>
                <CardDescription>New registrations over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.regTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.regTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#FF7A00"
                        strokeWidth={3}
                        dot={{ fill: '#FF7A00', r: 4 }}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle>Attendance Participation Trend</CardTitle>
                <CardDescription>Records over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats.attendanceTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.attendanceTrend}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>Most hours allocated this period</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (stats.topPerformers?.length || 0) > 0 ? (
                  <div className="space-y-4">
                    {stats.topPerformers.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {i + 1}
                          </div>
                          <span className="font-medium text-sm">{p.name}</span>
                        </div>
                        <span className="text-primary font-bold text-sm">{p.hours} hrs</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <CardTitle>Bill Status Distribution</CardTitle>
                <CardDescription>Breakdown of bill processing status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (stats.billStatusDistribution?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.billStatusDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#9C6AFF" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:shadow-lg transition-all animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <CardTitle>Meeting Attendance Overview</CardTitle>
                <CardDescription>Status distribution across meetings</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (stats.attendanceDistribution?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.attendanceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#00B86B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>


    </div>
  );
};

export default Analytics;

