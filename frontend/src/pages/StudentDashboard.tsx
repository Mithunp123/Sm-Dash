import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import DeveloperCredit from "@/components/DeveloperCredit";
import {
  Calendar as CalendarIcon, Clock, Loader2, CheckCircle2, MessageSquare,
  ArrowLeft, ChevronRight, ChevronLeft, LayoutDashboard, Briefcase, BookOpen,
  Star, StarIcon, Trophy, Calendar, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CalendarMonth } from "@/components/CalendarMonth";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

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
  const [interviewStatus, setInterviewStatus] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

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

      const [projRes, meetRes, evRes, resRes, odRes, profileRes, interviewRes] = await Promise.all([
        api.getUserProjects(currentUser.id),
        api.getMeetings(),
        api.getEvents(), // Fetch all events for the timeline
        api.getResources(),
        api.getStudentODHistory(currentUser.id),
        api.getStudentProfile(currentUser.id),
        api.getMyInterviewStatus()
      ]);

      if (projRes.success) setProjects(projRes.projects || []);
      if (meetRes.success) setMeetings(meetRes.meetings || []);
      if (evRes.success) setEvents(evRes.events || []);
      if (resRes.success) setResources(resRes.resources || []);
      if (odRes.success) setOdHistory(odRes);
      if (profileRes.success) setProfileData(profileRes.profile);
      if (interviewRes.success) setInterviewStatus(interviewRes.candidate);

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
        {/* Welcome Section (admin-style gradient) */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-6 md:p-12 shadow-lg border border-primary/20 mb-4">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/20 text-white text-xs font-semibold backdrop-blur-sm mb-4 border border-white/30">
              <Star className="w-3 h-3 text-white" />
              <span>Student Dashboard</span>
            </div>
            <h1 className="page-title text-white mb-3">
              Welcome back, <span className="text-white font-extrabold">{auth.getUser()?.name || 'Volunteer'}</span>
            </h1>
            <p className="page-subtitle text-white/90">
              {activeTab === 'calendar' ? 'Stay updated with your schedule' : "Here's your activity overview."}
            </p>
          </div>
        </div>

        {/* Tabs Interface - Tab Bar Removed as requested */}
        <Tabs value={activeTab} className="w-full">
          {/* Simplified Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                  { title: 'Projects', value: projects.length, icon: Briefcase, desc: "Active projects", color: "text-blue-500", bg: "bg-blue-500/10", border: 'border-blue-500/20' },
                  { title: 'OD Sessions', value: odHistory?.odCount || 0, icon: CheckCircle2, desc: "On-duty sessions", color: "text-emerald-500", bg: "bg-emerald-500/10", border: 'border-emerald-500/20' },
                  { title: 'Meetings', value: meetings.length, icon: MessageSquare, desc: "Total meetings", color: "text-purple-500", bg: "bg-purple-500/10", border: 'border-purple-500/20' },
                  { title: 'Resources', value: resources.length, icon: BookOpen, desc: "Shared materials", color: "text-orange-500", bg: "bg-orange-500/10", border: 'border-orange-500/20' },
                  { title: 'Events', value: events.length, icon: Calendar, desc: "Total events", color: "text-pink-500", bg: "bg-pink-500/10", border: 'border-pink-500/20', onClick: () => navigate('/student/events') }
                ].map((stat, i) => (
                  <motion.div key={i} variants={item}>
                    <Card
                      className={`border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm relative group ${stat.onClick ? 'cursor-pointer' : ''}`}
                      onClick={stat.onClick}
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

            {/* Row 2: Main Spotlight Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: Welcome & Meetings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Refined Welcome Banner */}
                {/* Interview Status Card - Only show if assigned or decision made */}
                {interviewStatus && (interviewStatus.status !== 'unassigned') && (
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 p-8 text-white shadow-xl mb-6">
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md mb-4 text-xs font-bold uppercase tracking-widest border border-white/10">
                        <Briefcase className="w-3 h-3 text-white" />
                        <span>Interview Update</span>
                      </div>
                      <h2 className="section-title">
                        {interviewStatus.status === 'selected' ? 'Congratulations! You are Selected!' :
                          interviewStatus.status === 'rejected' ? 'Application Update' :
                            ['assigned', 'pending'].includes(interviewStatus.status) ? 'Interview Scheduled' : 'Interview Status'}
                      </h2>
                      <div className="space-y-4 mt-6">
                        {interviewStatus.status === 'selected' && (
                          <p className="text-indigo-100 font-medium text-lg">
                            We are thrilled to have you on board! Please check your email for further instructions.
                          </p>
                        )}
                        {interviewStatus.status === 'rejected' && (
                          <p className="text-indigo-100 font-medium">
                            Thank you for your interest. Unfortunately, we cannot move forward with your application at this time.
                          </p>
                        )}
                        {interviewStatus.status === 'interviewed' && (
                          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                              <CheckCircle2 className="w-6 h-6 text-green-400" />
                              <h3 className="text-lg font-bold text-white">Interview Completed</h3>
                            </div>
                            <p className="text-indigo-100/80 text-sm">
                              Your interview has been completed. Please wait for the selection results.
                            </p>
                          </div>
                        )}
                        {['assigned', 'pending'].includes(interviewStatus.status) && (
                          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-200 mb-2">Your Interview Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex items-center gap-3">
                                <CalendarIcon className="w-5 h-5 text-indigo-300" />
                                <div>
                                  <p className="text-xs text-indigo-200 uppercase font-bold">Date</p>
                                  <p className="font-bold text-lg">{interviewStatus.interview_date || 'TBD'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-indigo-300" />
                                <div>
                                  <p className="text-xs text-indigo-200 uppercase font-bold">Time</p>
                                  <p className="font-bold text-lg">{interviewStatus.interview_time || 'TBD'}</p>
                                </div>
                              </div>
                              {interviewStatus.interviewer && (
                                <div className="flex items-center gap-3 col-span-full border-t border-white/10 pt-3 mt-1">
                                  <Briefcase className="w-5 h-5 text-indigo-300" />
                                  <div>
                                    <p className="text-xs text-indigo-200 uppercase font-bold">Interviewer</p>
                                    <p className="font-bold">{interviewStatus.interviewer}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-20 translate-y-1/2 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl" />
                  </div>
                )}


              </div>

              {/* Right Side: Sidebar info */}
              <div className="space-y-6">

              {/* Upcoming Special Events / Holidays removed (matches screenshot request) */}

              </div>
            </div>

          </TabsContent>

          {/* New Calendar Tab */}
          {/* Redesigned Full-Width Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <Card className="rounded-3xl border-none shadow-xl bg-card/50 backdrop-blur-md overflow-hidden p-8">
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
