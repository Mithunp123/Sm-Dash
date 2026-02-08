import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const StudentAttendance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [meetingRecords, setMeetingRecords] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [dateWiseRecords, setDateWiseRecords] = useState<any[]>([]);
  const [eventRecords, setEventRecords] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [markedToday, setMarkedToday] = useState(false);
  const [selectedDateForRecords, setSelectedDateForRecords] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('meetings');

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadProjects();
    loadEvents();
    loadMeetingAttendance();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to load user info");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attendance/student/projects/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }
      );

      const data = await res.json();
      if (data.success) {
        const fetched = data.projects || [];
        setProjects(fetched);

        // If attendance-based list is empty, fallback to membership-based projects
        if ((!fetched || fetched.length === 0)) {
          try {
            const membership = await api.getUserProjects(currentUser.id);
            if (membership.success && Array.isArray(membership.projects)) {
              setProjects(membership.projects || []);
              if (membership.projects && membership.projects.length > 0) {
                setSelectedProject(membership.projects[0]);
                loadDateWiseAttendance(membership.projects[0].id);
              }
            }
          } catch (mErr) {
            console.error('Error loading membership projects fallback:', mErr);
          }
        } else {
          // Set first project as selected
          if (fetched && fetched.length > 0) {
            setSelectedProject(fetched[0]);
            loadDateWiseAttendance(fetched[0].id);
          }
        }
      } else {
        // If main call returned success:false, try membership fallback
        try {
          const membership = await api.getUserProjects(currentUser.id);
          if (membership.success && Array.isArray(membership.projects)) {
            setProjects(membership.projects || []);
            if (membership.projects && membership.projects.length > 0) {
              setSelectedProject(membership.projects[0]);
              loadDateWiseAttendance(membership.projects[0].id);
            }
          }
        } catch (mErr) {
          console.error('Error loading membership projects fallback after failure:', mErr);
          toast.error('Failed to load projects');
        }
      }
    } catch (err: any) {
      console.error('Error loading projects:', err);
      // Final fallback
      try {
        const currentUser = auth.getUser();
        if (currentUser) {
          const membership = await api.getUserProjects(currentUser.id);
          if (membership.success && Array.isArray(membership.projects)) {
            setProjects(membership.projects || []);
            if (membership.projects && membership.projects.length > 0) {
              setSelectedProject(membership.projects[0]);
              loadDateWiseAttendance(membership.projects[0].id);
            }
          }
        }
      } catch (mErr) {
        console.error('Error loading membership projects fallback after exception:', mErr);
        toast.error('Failed to load projects: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to load user info");
        return;
      }

      const res = await api.getStudentEvents(currentUser.id);
      if (res.success) {
        const fetched = res.events || [];
        setEvents(fetched);

        // Set first event as selected
        if (fetched && fetched.length > 0) {
          setSelectedEvent(fetched[0]);
          loadEventAttendance(fetched[0].id);
        }
      } else {
        console.error('Failed to load events:', res.message);
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
      // Don't show error toast for events, it's optional
    }
  };

  const loadMeetingAttendance = async () => {
    try {
      const currentUser = auth.getUser();
      if (!currentUser) return;

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(
        `${API_BASE}/attendance?userId=${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`,
          },
        }
      );

      const data = await res.json();
      if (data.success) {
        setMeetingRecords(data.attendance || []);
      }
    } catch (err: any) {
      console.error('Error loading meeting attendance:', err);
      // Don't show toast; meeting attendance is optional
    }
  };

  const loadEventAttendance = async (eventId: number) => {
    try {
      const currentUser = auth.getUser();
      if (!currentUser) return;

      const res = await api.getEventAttendance(eventId, currentUser.id);
      if (res.success) {
        setEventRecords(res.records || []);
      }
    } catch (err: any) {
      console.error('Error loading event attendance:', err);
    }
  };

  const loadDateWiseAttendance = async (projectId: number) => {
    try {
      const currentUser = auth.getUser();
      if (!currentUser) return;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attendance/project/${projectId}/user/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }
      );

      const data = await res.json();
      if (data.success) {
        setDateWiseRecords(data.records || []);

        // Check if marked today
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = data.records?.find((r: any) => r.attendance_date === today);
        setMarkedToday(!!todayRecord);
        if (todayRecord) {
          setAttendanceStatus(todayRecord.status);
        }
      }
    } catch (err: any) {
      console.error('Error loading attendance:', err);
      toast.error('Failed to load attendance: ' + (err.message || 'Unknown error'));
    }
  };

  const handleProjectChange = (project: any) => {
    setSelectedProject(project);
    loadDateWiseAttendance(project.id);
  };

  const handleMarkAttendance = async () => {
    try {
      if (!selectedProject) {
        toast.error('Please select a project');
        return;
      }

      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to mark attendance");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attendance/project/${selectedProject.id}/mark`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({
            userId: currentUser.id,
            attendance_date: attendanceDate,
            status: attendanceStatus
          })
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success('Attendance marked successfully!');
        setMarkedToday(true);
        loadDateWiseAttendance(selectedProject.id);
      } else {
        throw new Error(data.message || 'Failed to mark attendance');
      }
    } catch (err: any) {
      console.error('Error marking attendance:', err);
      toast.error('Failed to mark attendance: ' + (err.message || 'Unknown error'));
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'present':
        return <Badge className="gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-bold px-3 py-1"><CheckCircle2 className="w-3.5 h-3.5" /> Present</Badge>;
      case 'absent':
        return <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 font-bold px-3 py-1"><XCircle className="w-3.5 h-3.5" /> Absent</Badge>;
      case 'late':
      case 'permission':
        return <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 font-bold px-3 py-1"><Clock className="w-3.5 h-3.5" /> Permission</Badge>;
      default:
        return <Badge variant="secondary" className="font-bold">{status}</Badge>;
    }
  };



  return (
    <div className="min-h-full w-full">
      <DeveloperCredit />
      <div className="w-full p-4 md:p-8">
        {/* Back Button */}
        <div className="mb-4">
          <div className="w-full px-4 md:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-2">
              <div className="mb-2">
                <BackButton />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">Attendance & Mission Logs</h1>
                <p className="text-muted-foreground font-bold tracking-tight">Track your presence across meetings, events, and projects.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-muted/40 p-1.5 rounded-2xl h-14 border border-border w-full flex">
            <TabsTrigger value="meetings" className="flex-1 rounded-xl h-full font-black uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-white shadow-none border-none transition-all duration-300">
              <Clock className="w-3.5 h-3.5 mr-2" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 rounded-xl h-full font-black uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-white shadow-none border-none transition-all duration-300">
              <Calendar className="w-3.5 h-3.5 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 rounded-xl h-full font-black uppercase tracking-widest text-xs data-[state=active]:bg-primary data-[state=active]:text-white shadow-none border-none transition-all duration-300">
              <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
              Events
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'meetings' && (
          <Card className="border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl">
            <CardHeader className="bg-muted/40 border-b border-border py-6 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Meeting History</CardTitle>
                <CardDescription className="font-bold text-muted-foreground">Detailed logs of your presence in regular organization meets</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {meetingRecords.length === 0 ? (
                <div className="text-center py-24 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Clock className="w-10 h-10 text-primary opacity-50" />
                  </div>
                  <p className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">Log Clear</p>
                  <p className="text-muted-foreground font-bold">No regular meeting attendance found in system.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-primary mb-2 tabular-nums">
                        {meetingRecords.filter(r => r.status === 'present').length}
                      </div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Present Missions</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-destructive mb-2 tabular-nums">
                        {meetingRecords.filter(r => r.status === 'absent').length}
                      </div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Absent Missions</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-amber-600 mb-2 tabular-nums">
                        {meetingRecords.filter(r => r.status === 'late' || r.status === 'permission').length}
                      </div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Approved Perms</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-border">
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Date</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Day</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Status</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Mission Log</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meetingRecords.map((record) => {
                          const dateObj = record.meeting_date ? new Date(record.meeting_date) : record.marked_at ? new Date(record.marked_at) : null;
                          return (
                            <TableRow key={record.id} className="hover:bg-muted/30 border-border transition-colors group">
                              <TableCell className="font-bold text-foreground py-4 px-6">
                                {dateObj ? dateObj.toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell className="text-xs font-black text-muted-foreground uppercase py-4 px-6">
                                {dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long' }) : '-'}
                              </TableCell>
                              <TableCell className="py-4 px-6">{getStatusBadge(record.status)}</TableCell>
                              <TableCell className="py-4 px-6">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                    {record.meeting_title || 'Regular Meet'}
                                  </span>
                                  {record.meeting_location && (
                                    <span className="text-sm text-muted-foreground font-medium italic mt-0.5">
                                      at {record.meeting_location}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'projects' && selectedProject && (
          <Card className="border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl">
            <CardHeader className="bg-muted/40 border-b border-border py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <CardTitle className="text-2xl font-black text-foreground tracking-tight">{selectedProject.title} History</CardTitle>
                </div>
                <CardDescription className="font-bold text-muted-foreground">Attendance logs specifically for this project</CardDescription>
              </div>

              {/* Project Switcher */}
              {projects.length > 1 && (
                <div className="w-full md:w-auto min-w-[200px]">
                  <select
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
                    value={selectedProject.id}
                    onChange={(e) => {
                      const proj = projects.find(p => p.id === parseInt(e.target.value));
                      if (proj) handleProjectChange(proj);
                    }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 hidden md:flex">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {dateWiseRecords.length === 0 ? (
                <div className="text-center py-24 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Calendar className="w-10 h-10 text-primary opacity-50" />
                  </div>
                  <p className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">Log Clear</p>
                  <p className="text-muted-foreground font-bold">No project attendance found for the selected timeline.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-primary mb-2 tabular-nums">{dateWiseRecords.filter(r => r.status === 'present').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Days Present</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-destructive mb-2 tabular-nums">{dateWiseRecords.filter(r => r.status === 'absent').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Days Absent</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-amber-600 mb-2 tabular-nums">{dateWiseRecords.filter(r => r.status === 'late' || r.status === 'permission').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Permissions</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-border">
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Date</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Day</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Status</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-6">Mission Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateWiseRecords.map((record) => (
                          <TableRow key={record.id} className="hover:bg-muted/30 border-border transition-colors group">
                            <TableCell className="font-bold text-foreground py-4 px-6">
                              {new Date(record.attendance_date + 'T00:00:00').toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs font-black text-muted-foreground uppercase py-4 px-6">
                              {new Date(record.attendance_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                            </TableCell>
                            <TableCell className="py-4 px-6">{getStatusBadge(record.status)}</TableCell>
                            <TableCell className="py-4 px-6 text-sm font-medium text-muted-foreground italic">
                              {record.notes || 'No specific mission logs available for this date.'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'events' && selectedEvent && (
          <Card className="border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl">
            <CardHeader className="bg-muted/40 border-b border-border py-6 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Event Attendance</CardTitle>
                <CardDescription className="font-bold text-muted-foreground">Logs for {selectedEvent.title || selectedEvent.name}</CardDescription>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {eventRecords.length === 0 ? (
                <div className="text-center py-24 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <CheckCircle2 className="w-10 h-10 text-primary opacity-50" />
                  </div>
                  <p className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">Log Clear</p>
                  <p className="text-muted-foreground font-bold">No event-specific attendance data found.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-primary mb-2 tabular-nums">{eventRecords.filter(r => r.status === 'present').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Present</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-destructive mb-2 tabular-nums">{eventRecords.filter(r => r.status === 'absent').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Absent</div>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center">
                      <div className="text-4xl font-black text-amber-600 mb-2 tabular-nums">{eventRecords.filter(r => r.status === 'late' || r.status === 'permission').length}</div>
                      <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Perm/Late</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-border">
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Date</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Status</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Authored By</TableHead>
                          <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventRecords.map((record) => (
                          <TableRow key={record.id} className="hover:bg-muted/30 border-border transition-colors group">
                            <TableCell className="font-bold text-foreground py-4 px-6">
                              {new Date(record.marked_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="py-4 px-6">{getStatusBadge(record.status)}</TableCell>
                            <TableCell className="py-4 px-6">
                              <span className="text-xs font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-1 rounded">
                                {record.marked_by_name || 'Admin'}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-sm font-medium text-muted-foreground italic">
                              {record.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'projects' && projects.length === 0 && !loading && (
          <div className="text-center py-32 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
            <Calendar className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-20" />
            <p className="text-2xl font-black text-muted-foreground uppercase tracking-widest italic">No Projects Assigned</p>
            <p className="text-sm text-muted-foreground font-bold mt-2">You aren't enrolled in any active projects for attendance tracking.</p>
          </div>
        )}
      </div>


    </div>
  );
};

export default StudentAttendance;
