import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import Sidebar from "@/components/Sidebar";
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
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [dateWiseRecords, setDateWiseRecords] = useState<any[]>([]);
  const [eventRecords, setEventRecords] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [markedToday, setMarkedToday] = useState(false);
  const [selectedDateForRecords, setSelectedDateForRecords] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadProjects();
    loadEvents();
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
    switch(status) {
      case 'present':
        return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="w-3 h-3" /> Present</Badge>;
      case 'absent':
        return <Badge className="gap-1 bg-red-500"><XCircle className="w-3 h-3" /> Absent</Badge>;
      case 'late':
        return <Badge className="gap-1 bg-yellow-500"><Clock className="w-3 h-3" /> Late</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Header />
      <DeveloperCredit />

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden lg:block sticky top-[73px] h-[calc(100vh-73px)] bg-white dark:bg-slate-900 shadow-sm">
          <Sidebar />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" onClick={() => navigate("/student")} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Attendance Tracking</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {activeTab === 'projects' ? (
                projects.map((project) => (
                  <Card 
                    key={project.id}
                    className={`cursor-pointer transition-all hover:scale-105 ${selectedProject?.id === project.id ? 'border-orange-500 bg-orange-500/10 shadow-lg' : 'hover:border-orange-400 hover:shadow-md'}`}
                    onClick={() => handleProjectChange(project)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Overall Attendance Summary */}
                        <div className="grid grid-cols-3 gap-2 text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
                          <div>
                            <div className="text-lg font-bold text-green-500">{project.present_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Present</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-500">{project.absent_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Absent</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-yellow-500">{project.late_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Permission</div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground text-center">
                          <strong>Total:</strong> {project.total_records || 0} records
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectChange(project);
                          }}
                        >
                          <Calendar className="w-4 h-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                events.map((event) => (
                  <Card 
                    key={event.id}
                    className={`cursor-pointer transition-all hover:scale-105 ${selectedEvent?.id === event.id ? 'border-blue-500 bg-blue-500/10 shadow-lg' : 'hover:border-blue-400 hover:shadow-md'}`}
                    onClick={() => { setSelectedEvent(event); loadEventAttendance(event.id); }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{event.title || event.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Overall Attendance Summary */}
                        <div className="grid grid-cols-3 gap-2 text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
                          <div>
                            <div className="text-lg font-bold text-green-500">{event.present_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Present</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-500">{event.absent_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Absent</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-yellow-500">{event.late_count || 0}</div>
                            <div className="text-xs text-muted-foreground">Late</div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground text-center">
                          <strong>Date:</strong> {new Date(event.date).toLocaleDateString()}
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            loadEventAttendance(event.id);
                          }}
                        >
                          <Calendar className="w-4 h-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="projects" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Projects
                </TabsTrigger>
                <TabsTrigger value="events" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Events
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'projects' && selectedProject && (
              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <CardTitle>Attendance History</CardTitle>
                  <CardDescription>
                    Date-wise attendance records for {selectedProject.title}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dateWiseRecords.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No attendance records found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 p-4 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-500">{dateWiseRecords.filter(r => r.status === 'present').length}</div>
                          <div className="text-xs text-muted-foreground">Present Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-500">{dateWiseRecords.filter(r => r.status === 'absent').length}</div>
                          <div className="text-xs text-muted-foreground">Absent Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-500">{dateWiseRecords.filter(r => r.status === 'late').length}</div>
                          <div className="text-xs text-muted-foreground">Permission Days</div>
                        </div>
                      </div>

                      {/* Records Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Day</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dateWiseRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  {new Date(record.attendance_date + 'T00:00:00').toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(record.attendance_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                                </TableCell>
                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{record.notes || '-'}</TableCell>
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
              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <CardTitle>Event Attendance</CardTitle>
                  <CardDescription>
                    Attendance records for {selectedEvent.title || selectedEvent.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventRecords.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No attendance records found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 p-4 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-500">{eventRecords.filter(r => r.status === 'present').length}</div>
                          <div className="text-xs text-muted-foreground">Present</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-500">{eventRecords.filter(r => r.status === 'absent').length}</div>
                          <div className="text-xs text-muted-foreground">Absent</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-500">{eventRecords.filter(r => r.status === 'late').length}</div>
                          <div className="text-xs text-muted-foreground">Late</div>
                        </div>
                      </div>

                      {/* Records Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Marked By</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  {new Date(record.marked_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{record.marked_by_name || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{record.notes || '-'}</TableCell>
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
              <Card className="gradient-card border-border/50">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <p>No projects assigned yet</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default StudentAttendance;
