import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import DeveloperCredit from "@/components/DeveloperCredit";
import {
  Calendar as CalendarIcon, Clock, Loader2, CheckCircle2, MessageSquare,
  ArrowLeft, ChevronRight, ChevronLeft, LayoutDashboard, Briefcase, BookOpen,
  Star, StarIcon, Trophy, Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CalendarMonth } from "@/components/CalendarMonth";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { api } from "@/lib/api";

type StudentDashboardProps = {
  initialTab?: string;
};

const StudentDashboard = ({ initialTab }: StudentDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || "dashboard");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [odHistory, setOdHistory] = useState<any>(null);
  const [notifiedIds, setNotifiedIds] = useState<(number | string)[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab || "dashboard");
  }, [initialTab]);

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadDashboardData();

    // Listen for profile update events
    const handleProfileUpdate = () => {
      console.log('Profile updated event received, reloading dashboard data...');
      loadDashboardData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.getUser();
      if (!currentUser) return;

      const [projRes, meetRes, evRes, resRes, odRes, profileRes] = await Promise.all([
        api.getUserProjects(currentUser.id),
        api.getMeetings(),
        api.getEvents(), // Fetch all events for the timeline
        api.getResources(),
        api.getStudentODHistory(currentUser.id),
        api.getStudentProfile(currentUser.id)
      ]);

      if (projRes.success) setProjects(projRes.projects || []);
      if (meetRes.success) setMeetings(meetRes.meetings || []);
      if (evRes.success) setEvents(evRes.events || []);
      if (resRes.success) setResources(resRes.resources || []);
      if (odRes.success) setOdHistory(odRes);
      if (profileRes.success) setProfileData(profileRes.profile);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadDashboardData();

    const handleProfileUpdate = () => loadDashboardData();
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  // Notifications for upcoming meetings
  useEffect(() => {
    if (!meetings || meetings.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    meetings.forEach((m) => {
      const mDate = new Date(m.date);
      mDate.setHours(0, 0, 0, 0);
      if (mDate >= today && mDate <= threeDaysFromNow && !notifiedIds.includes(`m-${m.id}`)) {
        const diff = Math.ceil((mDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const time = new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`;
        toast.info(`📅 Meeting ${prefix}: ${m.title} at ${time}`, { duration: 6000 });
        setNotifiedIds(prev => [...prev, `m-${m.id}`]);
      }
    });
  }, [meetings]);

  const calendarEvents = useMemo(() => {
    const meetEvents = (meetings || []).filter(m => m && m.date).map(m => ({
      id: `m-${m.id}`,
      title: m.title || 'Meeting',
      description: m.description || '',
      date: m.date,
      type: 'meeting' as const
    }));
    const evEvents = (events || []).filter(e => e && e.date).map(e => ({
      id: `e-${e.id}`,
      title: e.title || 'Event',
      date: e.date,
      type: e.is_special_day ? ('holiday' as const) : ('important' as const),
      isSpecialDay: e.is_special_day
    }));
    return [...meetEvents, ...evEvents];
  }, [meetings, events]);

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <>
      <div className="w-full px-4 md:px-6 lg:px-8">
        {/* Compact Header */}
        <div className="mb-4 flex items-end justify-between pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {activeTab === 'calendar' ? 'Mission Timeline' : 'Dashboard Overview'}
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {activeTab === 'calendar' ? 'Stay updated with your schedule' : `Welcome back, ${auth.getUser()?.name || 'Volunteer'}`}
            </p>
          </div>
          <BackButton />
        </div>

        {/* Tabs Interface - Tab Bar Removed as requested */}
        <Tabs value={activeTab} className="w-full">
          {/* Simplified Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Row 1: Compact Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Projects', value: projects.length, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50/50 dark:bg-blue-900/20' },
                { label: 'OD Sessions', value: odHistory?.odCount || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20' },
                { label: 'Meetings', value: meetings.length, icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50/50 dark:bg-purple-900/20' },
                { label: 'Resources', value: resources.length, icon: BookOpen, color: 'text-orange-600', bg: 'bg-orange-50/50 dark:bg-orange-900/20' },
                { label: 'Events', value: events.length, icon: Calendar, color: 'text-pink-600', bg: 'bg-pink-50/50 dark:bg-pink-900/20', onClick: () => navigate('/student/events') }
              ].map((stat, i) => (
                <Card
                  key={i}
                  className={`border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm ${stat.onClick ? 'cursor-pointer' : ''}`}
                  onClick={stat.onClick}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Row 2: Main Spotlight Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: Welcome & Meetings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Refined Welcome Banner */}
                <div className="relative overflow-hidden rounded-[2rem] bg-indigo-600 p-8 text-white shadow-xl">
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md mb-4 text-xs font-bold uppercase tracking-widest border border-white/10">
                      <Star className="w-3 h-3 fill-white" />
                      <span>Volunteer Status: Active</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-2 tracking-tight">
                      Ready for the next mission?
                    </h2>
                    <p className="text-indigo-100 font-medium">
                      You have {meetings.length} upcoming sessions. Stay focused and keep making an impact.
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-20 translate-y-1/2 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />
                </div>

                {/* Next Highlight Card */}
                <Card className="rounded-[2rem] shadow-sm border-none bg-card/80 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="pb-4 border-b border-border/10">
                    <CardTitle className="text-base font-bold uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      Immediate Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {meetings.length > 0 ? (
                      <div className="space-y-6">
                        {meetings.slice(0, 1).map(m => m && (
                          <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-border/5">
                            <div className="space-y-1">
                              <h4 className="font-bold text-lg text-foreground">{m.title}</h4>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5">
                                  <CalendarIcon className="w-4 h-4 text-indigo-400" />
                                  {new Date(m.date).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-emerald-400" />
                                  {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <Button variant="outline" className="rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => navigate('/student/attendance')}>
                              Full Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                          <Clock className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Immediate Missions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Side: Sidebar info */}
              <div className="space-y-6">
                {/* Motivation Card */}
                <Card className="rounded-[2rem] shadow-sm border-none p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-2 text-amber-400">
                      <StarIcon className="w-4 h-4 fill-amber-400" />
                      <span className="font-black uppercase tracking-widest text-xs">Daily Wisdom</span>
                    </div>
                    <p className="text-xl font-bold italic leading-tight text-white/90">
                      "Real change, enduring change, happens one step at a time."
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="w-6 h-0.5 bg-amber-400/50" />
                      <p className="text-white/60 font-bold text-xs uppercase tracking-widest">— RBG</p>
                    </div>
                  </div>
                </Card>

                {/* Upcoming Special Events / Holidays */}
                {events.filter(e => e.is_special_day || e.type === 'holiday' || e.type === 'important').length > 0 && (
                  <Card className="rounded-[2rem] shadow-sm border-none p-6 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/20">
                    <h4 className="font-black text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                      <Star className="w-3 h-3 fill-amber-500" />
                      Special Highlights
                    </h4>
                    <div className="space-y-3">
                      {events
                        .filter(e => {
                          const ed = new Date(e.date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return ed >= today;
                        })
                        .slice(0, 3)
                        .map((e, idx) => (
                          <div key={idx} className="flex flex-col gap-1 p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-amber-100/50 dark:border-amber-900/30">
                            <span className="text-xs font-black text-foreground">{e.title}</span>
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                              <CalendarIcon className="w-3 h-3 text-amber-500" />
                              {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              {e.is_special_day && <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-xs h-4">Holiday</Badge>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                )}

                {/* Quick Profile Summary */}
                <Card className="rounded-[2rem] shadow-sm border-none p-6 bg-card/50 backdrop-blur-sm border-t border-border/5">
                  <div className="space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Service Portfolio</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Role</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary font-black text-xs uppercase">Student</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Dept</span>
                        <span className="text-xs font-black">{profileData?.dept || 'General'}</span>
                      </div>
                    </div>
                    <Button variant="ghost" className="w-full text-xs font-black uppercase tracking-widest mt-2 hover:bg-primary/10 hover:text-primary rounded-xl py-6" onClick={() => setActiveTab('profile')}>
                      Manage Identity Profile
                      <ChevronRight className="w-3 h-3 ml-2" />
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            {/* New Section to fill empty space: Quick Connections */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              <Card className="rounded-[2rem] border-none bg-indigo-50/30 dark:bg-indigo-900/10 p-6 flex items-center gap-4 group cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all" onClick={() => setActiveTab('messages')}>
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Need Support?</h4>
                  <p className="text-xs text-muted-foreground font-medium">Message your mentors or office bearers directly.</p>
                </div>
              </Card>

              <Card className="rounded-[2rem] border-none bg-emerald-50/30 dark:bg-emerald-900/10 p-6 flex items-center gap-4 group cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" onClick={() => setActiveTab('attendance')}>
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Milestone Tracker</h4>
                  <p className="text-xs text-muted-foreground font-medium">Check your progress and attendance milestones.</p>
                </div>
              </Card>

              <Card className="rounded-[2rem] border-none bg-amber-50/30 dark:bg-amber-900/10 p-6 flex items-center gap-4 group cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all" onClick={() => setActiveTab('resources')}>
                <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight">Resource Library</h4>
                  <p className="text-xs text-muted-foreground font-medium">Explore shared documents and study materials.</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* New Calendar Tab */}
          {/* Redesigned Full-Width Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <Card className="rounded-[2rem] border-none shadow-xl bg-card/50 backdrop-blur-md overflow-hidden p-8">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/10 pb-6">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="rounded-xl h-9 w-9" onClick={handlePrevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-sm font-black uppercase tracking-widest min-w-[140px] text-center bg-muted/30 py-2 px-4 rounded-xl border border-border/5">
                      {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <Button variant="outline" size="icon" className="rounded-xl h-9 w-9" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Compact Horizontal Legend */}
                  <div className="flex flex-wrap gap-4 bg-muted/20 p-3 rounded-2xl border border-border/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider">Meetings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Special Events</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Holidays</span>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <CalendarMonth
                    month={currentMonth}
                    year={currentYear}
                    events={calendarEvents}
                    onDayClick={(iso) => {
                      const dayEvs = calendarEvents.filter(e => e.date && e.date.startsWith(iso));
                      if (dayEvs.length > 0) {
                        toast.info(`${dayEvs.length} items on ${new Date(iso).toLocaleDateString()}: ${dayEvs.map(e => e.title).join(', ')}`);
                      }
                    }}
                    className="border-none"
                    showHeader={false}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* All other tabs (Attendance, Resources, Profile, Feedback, Settings) 
              have been moved to dedicated standalone pages accessible via the sidebar. 
              The internal tab content here is no longer needed. */}
        </Tabs>
      </div >
    </>
  );
};

export default StudentDashboard;
