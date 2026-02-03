import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Plus, ArrowLeft, CheckCircle2, XCircle, Clock, Briefcase, Users, Search, Filter, Edit, Trash2, Eye, Download, X as XIcon, Activity } from "lucide-react";

import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import * as XLSX from "xlsx";

const ManageAttendance = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [selectedType, setSelectedType] = useState<'project' | 'meeting' | 'event' | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<Record<number, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [itemStudents, setItemStudents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");

  const [createData, setCreateData] = useState({
    type: 'meeting',
    title: "",
    description: "",
    date: "",
    location: "",
    projectId: "",
    meetingId: ""
  });

  const { permissions, loading: permissionsLoading } = usePermissions();
  const location = useLocation();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const user = auth.getUser();
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_attendance;
    if (!canAccess) {
      toast.error("You don't have permission to access attendance management");
      navigate("/student");
      return;
    }

    loadData();
  }, [navigate, permissions, permissionsLoading]);

  // If a projectId is provided in the URL query params, open the project's date viewer after data loads
  useEffect(() => {
    if (loading) return;
    try {
      const params = new URLSearchParams(location.search);
      const pid = params.get('projectId');
      if (pid) {
        const id = parseInt(pid, 10);
        openDateViewer('project', id);
        const newParams = new URLSearchParams(location.search);
        newParams.delete('projectId');
        navigate(location.pathname + (newParams.toString() ? `?${newParams.toString()}` : ''), { replace: true });
      }
    } catch (error) {
      // ignore
    }
  }, [loading, location.search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, meetRes, eventRes, studRes, attRes] = await Promise.allSettled([
        api.getProjects(),
        api.getMeetings(),
        api.getEvents(),
        api.getStudentsScoped(),
        api.getAttendance()
      ]);

      if (projRes.status === 'fulfilled' && projRes.value.success) {
        setProjects(projRes.value.projects || []);
      }
      if (meetRes.status === 'fulfilled' && meetRes.value.success) setMeetings(meetRes.value.meetings || []);
      if (eventRes.status === 'fulfilled' && eventRes.value.success) {
        setEvents(eventRes.value.events || []);
      }
      if (studRes.status === 'fulfilled' && studRes.value.success) setStudents(studRes.value.students || []);
      if (attRes.status === 'fulfilled' && attRes.value.success) setAttendanceRecords(attRes.value.attendance || []);
    } catch (err: any) {
      setError(err?.message || String(err));
      toast.error('Failed to load data: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createData.type === 'meeting') {
      try {
        const meetingRes = await api.createMeeting({
          title: createData.title,
          description: createData.description,
          date: createData.date,
          location: createData.location
        });
        if (meetingRes.success) {
          toast.success('Meeting created');
          setShowCreateDialog(false);
          loadData();
          setSelectedItem({ id: meetingRes.id, title: createData.title });
          setSelectedType('meeting');
          setShowMarkDialog(true);
        }
      } catch (err: any) {
        toast.error('Failed to create meeting: ' + (err?.message || String(err)));
      }
    } else {
      const project = projects.find(p => p.id === parseInt(createData.projectId || '', 10));
      if (project) {
        setSelectedItem(project);
        setSelectedType('project');
        setShowMarkDialog(true);
        setShowCreateDialog(false);
      } else {
        toast.error('Please select a project');
      }
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedItem || !selectedType) return;

    try {
      let meetingId = null;

      if (selectedType === 'project') {
        const meetingRes = await api.createMeeting({
          title: `${selectedItem.title} - Attendance`,
          description: `Attendance marking for project: ${selectedItem.title}`,
          date: new Date().toISOString(),
          location: selectedItem.ngo_name || "Project Location"
        });

        if (!meetingRes.success) {
          throw new Error("Failed to create attendance meeting");
        }
        meetingId = meetingRes.id;
      } else {
        meetingId = selectedItem.id;
      }

      if (selectedType === 'project') {
        const attendancePromises = Object.entries(attendanceData).map(([userId, status]) => {
          return api.markProjectAttendance(selectedItem.id, {
            userId: parseInt(userId),
            attendance_date: selectedDate,
            status,
            notes: `Project: ${selectedItem.title}`
          });
        });
        await Promise.all(attendancePromises);
      } else {
        const attendancePromises = Object.entries(attendanceData).map(([userId, status]) => {
          return api.markAttendance({
            meetingId,
            userId: parseInt(userId),
            status,
            notes: `Meeting: ${selectedItem.title}`
          });
        });
        await Promise.all(attendancePromises);
      }
      toast.success("Attendance marked successfully!");
      setShowMarkDialog(false);
      setSelectedItem(null);
      setSelectedType(null);
      setAttendanceData({});
      loadData();
    } catch (error: any) {
      toast.error("Failed to mark attendance: " + error.message);
    }
  };

  const handleOpenMarkDialog = async (item: any, type: 'project' | 'meeting' | 'event') => {
    setSelectedItem(item);
    setSelectedType(type);
    setShowDatePicker(true);
    setStudentsLoaded(false);
    setItemStudents([]);
    setAttendanceData({});
    setUnsavedChanges({});
  };

  const handleLoadAttendance = async () => {
    if (!selectedItem || !selectedType || !selectedDate) {
      toast.error("Please select a date first");
      return;
    }

    let loadedStudents: any[] = [];

    if (selectedType === 'project') {
      try {
        const studentsRes = await api.getProjectStudents(selectedItem.id);
        if (studentsRes.success && studentsRes.students && studentsRes.students.length > 0) {
          loadedStudents = studentsRes.students || [];
        } else {
          toast.error("No students assigned to this project. Please assign students first.");
          return;
        }
      } catch (error) {
        toast.error("No students assigned to this project. Please assign students first.");
        return;
      }
    } else if (selectedType === 'event') {
      try {
        const membersRes = await api.getEventMembers(selectedItem.id);
        if (membersRes.success && membersRes.members && membersRes.members.length > 0) {
          loadedStudents = membersRes.members.map((m: any) => ({
            id: m.user_id,
            name: m.user_name,
            email: m.user_email,
            dept: null,
            year: null,
            role: 'student'
          })) || [];
        } else {
          toast.error("No students assigned to this event. Please import students first.");
          return;
        }
      } catch (error) {
        toast.error("No students assigned to this event. Please import students first.");
        return;
      }
    } else {
      const studentsWithProfiles = await Promise.all(
        students.map(async (student: any) => {
          try {
            const profileRes = await api.getStudentProfile(student.id);
            return {
              ...student,
              dept: profileRes.success ? profileRes.profile?.dept : null,
              year: profileRes.success ? profileRes.profile?.year : null,
              role: student.role || 'student'
            };
          } catch {
            return {
              ...student,
              dept: null,
              year: null,
              role: student.role || 'student'
            };
          }
        })
      );
      loadedStudents = studentsWithProfiles;
    }

    setItemStudents(loadedStudents);

    const initialAttendance: Record<number, string> = {};

    try {
      if (selectedType === 'meeting') {
        const attendanceRes = await api.getAttendance({ meetingId: selectedItem.id });
        if (attendanceRes.success && attendanceRes.attendance) {
          attendanceRes.attendance.forEach((att: any) => {
            const attDate = att.meeting_date || att.marked_at || att.created_at;
            if (attDate && attDate.startsWith(selectedDate)) {
              initialAttendance[att.user_id] = att.status;
            }
          });
        }
      } else if (selectedType === 'project') {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const res = await fetch(
          `${API_BASE}/attendance/project/${selectedItem.id}/date/${selectedDate}`,
          {
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`
            }
          }
        );
        const data = await res.json();
        if (data.success && data.records) {
          data.records.forEach((record: any) => {
            initialAttendance[record.user_id] = record.status;
          });
        }
      } else if (selectedType === 'event') {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const res = await fetch(
          `${API_BASE}/events/${selectedItem.id}/od?date=${selectedDate}`,
          {
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`
            }
          }
        );
        const data = await res.json();
        if (data.success && data.records) {
          data.records.forEach((record: any) => {
            initialAttendance[record.user_id] = record.status;
          });
        }
      }
    } catch (error) {
      console.error('Error loading existing attendance:', error);
    }

    loadedStudents.forEach((student: any) => {
      const studentId = student.user_id || student.id;
      if (!initialAttendance[studentId]) {
        initialAttendance[studentId] = '';
      }
    });

    setAttendanceData(initialAttendance);
    setUnsavedChanges({});
    setDialogSearchQuery("");
    setStudentsLoaded(true);
    setShowDatePicker(false);
    setShowMarkDialog(true);
  };

  const handleMarkAllPresent = () => {
    const newAttendanceData = { ...attendanceData };
    const newUnsavedChanges = { ...unsavedChanges };

    itemStudents.forEach(student => {
      const studentId = student.user_id || student.id;
      const status = selectedType === 'event' ? 'od' : 'present';
      newAttendanceData[studentId] = status;
      newUnsavedChanges[studentId] = status;
    });

    setAttendanceData(newAttendanceData);
    setUnsavedChanges(newUnsavedChanges);
    toast.success(`Marked all as ${selectedType === 'event' ? 'OD' : 'Present'}`);
  };

  const handleMarkAttendanceClick = (studentId: number, status: string) => {
    if (!selectedItem || !selectedType) return;

    const newAttendanceData = {
      ...attendanceData,
      [studentId]: status
    };
    setAttendanceData(newAttendanceData);

    const newUnsavedChanges = {
      ...unsavedChanges,
      [studentId]: status
    };
    setUnsavedChanges(newUnsavedChanges);
  };

  const handleSaveAttendance = async () => {
    if (!selectedItem || !selectedType || Object.keys(unsavedChanges).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      let meetingId = null;

      if (selectedType === 'project') {
        const meetingTitle = `${selectedItem.title} - Attendance`;
        const existingMeetings = meetings.filter(m => m.title === meetingTitle);
        if (existingMeetings.length > 0) {
          meetingId = existingMeetings[0].id;
        } else {
          const meetingRes = await api.createMeeting({
            title: meetingTitle,
            description: `Attendance marking for project: ${selectedItem.title}`,
            date: new Date().toISOString(),
            location: selectedItem.ngo_name || "Project Location"
          });

          if (!meetingRes.success) {
            throw new Error("Failed to create attendance meeting");
          }
          meetingId = meetingRes.id;
          const meetingsRes = await api.getMeetings();
          if (meetingsRes.success) {
            setMeetings(meetingsRes.meetings || []);
          }
        }
      } else {
        meetingId = selectedItem.id;
      }

      const savePromises = Object.entries(unsavedChanges).map(async ([studentId, status]) => {
        const userId = parseInt(studentId);
        if (selectedType === 'project') {
          return api.markProjectAttendance(selectedItem.id, {
            userId,
            attendance_date: selectedDate,
            status,
            notes: `Project: ${selectedItem.title}`
          });
        } else if (selectedType === 'event') {
          return api.markEventOD(selectedItem.id, userId, status as 'od' | 'absent' | 'permission');
        } else {
          return api.markAttendance({
            meetingId,
            userId,
            status,
            notes: `Meeting: ${selectedItem.title}`
          });
        }
      });

      await Promise.all(savePromises);

      setUnsavedChanges({});
      toast.success(`${selectedType === 'event' ? 'Event OD' : 'Attendance'} saved successfully!`);

      if (selectedType !== 'event') {
        const attendanceRes = await api.getAttendance();
        if (attendanceRes.success) {
          setAttendanceRecords(attendanceRes.attendance || []);
        }
      }
    } catch (error: any) {
      toast.error("Failed to save attendance: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openDateViewer = (type: 'project' | 'meeting' | 'event', id: number, title?: string) => {
    navigate(`/admin/attendance/${type}/${id}`);
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.ngo_name && project.ngo_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meeting.location && meeting.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const summaryCards = [
    {
      key: 'projects' as const,
      title: 'Projects',
      description: 'Manage attendance for all active NGO projects',
      count: filteredProjects.length,
      icon: Briefcase
    },
    {
      key: 'meetings' as const,
      title: 'Meetings',
      description: 'Schedule and mark attendance for meetings',
      count: filteredMeetings.length,
      icon: Calendar
    },
    {
      key: 'events' as const,
      title: 'Events',
      description: 'Track OD / permission status for events',
      count: filteredEvents.length,
      icon: Users
    }
  ];

  const handleSectionChange = (key: 'projects' | 'meetings' | 'events') => {
    if (key === 'projects') {
      navigate('/admin/attendance/projects');
    } else if (key === 'meetings') {
      navigate('/admin/attendance/meetings');
    } else if (key === 'events') {
      navigate('/admin/attendance/events');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 w-full">
          <div className="mb-6">
            <BackButton to="/admin" />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
                <div className="bg-primary/10 rounded-2xl p-2 md:p-2.5 shadow-inner shrink-0">
                  <Activity className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary" />
                </div>
                <div className="flex flex-wrap items-center gap-x-2">
                  Master <span className="text-primary italic">Attendance</span>
                </div>
              </h1>
              <p className="text-muted-foreground font-medium text-xs md:text-base border-l-4 border-primary/30 pl-3">
                Track and manage participation across all activities
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2 shadow-xl shadow-primary/30 font-bold px-8 h-12 text-sm w-full lg:w-auto rounded-xl bg-primary hover:bg-primary/90 transition-all hover:translate-y-[-2px] group">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Quick Create
            </Button>
          </div>

          <Card className="border-border/40 mb-10 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden rounded-3xl">
            <CardContent className="p-4 md:p-6 bg-muted/20">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
                  <Input
                    placeholder="Search sessions, projects or locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-2xl text-base shadow-inner"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-background/50 p-2.5 rounded-2xl border border-border/50">
                    <Filter className="w-5 h-5 text-primary" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48 h-12 rounded-2xl bg-background/50 border-border/50 focus:ring-primary/20 font-bold text-xs uppercase tracking-widest">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/50">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {summaryCards.map(({ key, title, description, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSectionChange(key)}
                className="group relative flex flex-col p-8 rounded-[2.5rem] border-2 border-border/40 bg-card hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 shadow-xl hover:shadow-primary/10 overflow-hidden active:scale-[0.98]"
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500" />

                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="p-4 rounded-3xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-inner">
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-primary group-hover:scale-110 transition-transform block leading-none">{count}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{title}</span>
                  </div>
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">{title}</h3>
                  <p className="text-sm font-medium text-muted-foreground/80 mt-2 leading-relaxed line-clamp-2">
                    {description}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-border/40 flex items-center justify-between relative z-10 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-xs font-black uppercase tracking-widest text-primary italic">Enter Directory</span>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:translate-x-1 transition-transform">
                    <Plus className="w-4 h-4 rotate-45" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Tables removed - now in separate pages */}
        </div>
      </main>

      {/* Create Attendance Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Attendance</DialogTitle>
            <DialogDescription>
              Create a new meeting or select a project for attendance
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAttendance} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // View dates for this question's project context (not feedback)
                }}
                className="gap-2"
              >
                View Dates
              </Button>
            </div>

            {createData.type === 'meeting' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    value={createData.title}
                    onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                    required
                    placeholder="e.g., Weekly Team Meeting"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={createData.description}
                    onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                    placeholder="Meeting description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date & Time *</Label>
                    <Input
                      id="date"
                      type="datetime-local"
                      value={createData.date}
                      onChange={(e) => setCreateData({ ...createData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={createData.location}
                      onChange={(e) => setCreateData({ ...createData, location: e.target.value })}
                      placeholder="Meeting location"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="projectId">Select Project *</Label>
                <Select
                  value={createData.projectId}
                  onValueChange={(value) => setCreateData({ ...createData, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title} {project.ngo_name && `(${project.ngo_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreateData({
                    type: 'meeting',
                    title: "",
                    description: "",
                    date: "",
                    location: "",
                    projectId: "",
                    meetingId: ""
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createData.type === 'project' && !createData.projectId}>
                {createData.type === 'meeting' ? 'Create & Mark Attendance' : 'Mark Attendance'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Date Selection Dialog */}
      <Dialog open={showDatePicker && !studentsLoaded} onOpenChange={(open) => {
        if (!open) {
          setShowDatePicker(false);
          setSelectedItem(null);
          setSelectedType(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Date for Attendance</DialogTitle>
            <DialogDescription>
              Choose the date for marking attendance for {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="attendance-date">Date</Label>
              <Input
                id="attendance-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowDatePicker(false);
                setSelectedItem(null);
                setSelectedType(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleLoadAttendance} disabled={!selectedDate}>
                Load Attendance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Attendance Dialog */}
      <Dialog open={showMarkDialog && studentsLoaded} onOpenChange={(open) => {
        if (!open) {
          setShowMarkDialog(false);
          setStudentsLoaded(false);
          setShowDatePicker(false);
          setSelectedItem(null);
          setSelectedType(null);
          setItemStudents([]);
          setAttendanceData({});
          setUnsavedChanges({});
          setSelectedDate(new Date().toISOString().split('T')[0]);
        }
      }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Mark {selectedType === 'event' ? 'Event OD' : 'Attendance'} for {selectedItem?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedType === 'event'
                ? 'Mark OD/Absent/Permission for each student in this event'
                : `Marking attendance for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-6">
            {itemStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found. Please add students first.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search students..."
                      value={dialogSearchQuery}
                      onChange={(e) => setDialogSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleMarkAllPresent}
                    variant="outline"
                    className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark All {selectedType === 'event' ? 'OD' : 'Present'}
                  </Button>
                </div>

                <div className="bg-muted p-3 rounded border border-border">
                  <p className="text-sm font-medium text-muted-foreground">👥 Click the buttons below to mark {selectedType === 'event' ? 'OD/Absent/Permission' : 'attendance'} for {itemStudents.length} student(s)</p>
                </div>

                <div className="overflow-x-auto border rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-16">S.No</TableHead>
                        <TableHead>No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        {selectedType !== 'event' && (
                          <>
                            <TableHead>Dept</TableHead>
                            <TableHead>Year</TableHead>
                          </>
                        )}
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemStudents.filter(s =>
                        s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase()) ||
                        s.email.toLowerCase().includes(dialogSearchQuery.toLowerCase())
                      ).map((student, index) => {
                        const studentId = student.user_id || student.id;
                        const currentStatus = attendanceData[studentId] || '';
                        return (
                          <TableRow key={studentId}>
                            <TableCell className="text-center font-medium text-gray-600">{index + 1}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell className="text-sm">{student.email}</TableCell>

                            <TableCell>
                              <div className="flex gap-3 items-center">
                                {selectedType === 'event' ? (
                                  <>
                                    {/* OD Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'od')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'od'
                                          ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-green-400'
                                          }`}
                                        title="OD"
                                      >
                                        {currentStatus === 'od' && (
                                          <CheckCircle2 className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">OD</span>
                                    </div>
                                    {/* Absent Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'absent')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'absent'
                                          ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-red-400'
                                          }`}
                                        title="Absent"
                                      >
                                        {currentStatus === 'absent' && (
                                          <XCircle className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">Absent</span>
                                    </div>
                                    {/* Permission Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'permission')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'permission'
                                          ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-blue-400'
                                          }`}
                                        title="Permission"
                                      >
                                        {currentStatus === 'permission' && (
                                          <Clock className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">Permission</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* Present Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'present')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'present'
                                          ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-green-400'
                                          }`}
                                        title="Present"
                                      >
                                        {currentStatus === 'present' && (
                                          <CheckCircle2 className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">Present</span>
                                    </div>
                                    {/* Absent Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'absent')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'absent'
                                          ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-red-400'
                                          }`}
                                        title="Absent"
                                      >
                                        {currentStatus === 'absent' && (
                                          <XCircle className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">Absent</span>
                                    </div>
                                    {/* Permission Button */}
                                    <div className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => handleMarkAttendanceClick(studentId, 'late')}
                                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'late'
                                          ? 'bg-yellow-500 border-yellow-600 shadow-lg shadow-yellow-500/50'
                                          : 'bg-transparent border-gray-400 hover:border-yellow-400'
                                          }`}
                                        title="Permission"
                                      >
                                        {currentStatus === 'late' && (
                                          <Clock className="w-6 h-6 text-white" />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground">Permission</span>
                                    </div>
                                  </>
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
          </div>
          <div className="flex gap-2 justify-end mt-4 border-t pt-4">
            {Object.keys(unsavedChanges).length > 0 && (
              <Badge variant="outline" className="mr-auto flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                {Object.keys(unsavedChanges).length} unsaved change{Object.keys(unsavedChanges).length > 1 ? 's' : ''}
              </Badge>
            )}
            <Button variant="outline" onClick={() => {
              setShowMarkDialog(false);
              setSelectedItem(null);
              setSelectedType(null);
              setAttendanceData({});
              setUnsavedChanges({});
              setItemStudents([]);
              setSelectedDate(new Date().toISOString().split('T')[0]);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAttendance}
              disabled={Object.keys(unsavedChanges).length === 0 || isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Update attendance status for {selectedAttendance?.user_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (selectedAttendance) {
                      setSelectedAttendance({ ...selectedAttendance, status: 'present' });
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${selectedAttendance?.status === 'present'
                    ? 'bg-green-500 border-green-600 shadow-lg'
                    : 'bg-transparent border-gray-400'
                    }`}
                >
                  {selectedAttendance?.status === 'present' && (
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (selectedAttendance) {
                      setSelectedAttendance({ ...selectedAttendance, status: 'absent' });
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${selectedAttendance?.status === 'absent'
                    ? 'bg-red-500 border-red-600 shadow-lg'
                    : 'bg-transparent border-gray-400'
                    }`}
                >
                  {selectedAttendance?.status === 'absent' && (
                    <XCircle className="w-8 h-8 text-white" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (selectedAttendance) {
                      setSelectedAttendance({ ...selectedAttendance, status: 'late' });
                    }
                  }}
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${selectedAttendance?.status === 'late'
                    ? 'bg-yellow-500 border-yellow-600 shadow-lg'
                    : 'bg-transparent border-gray-400'
                    }`}
                >
                  {selectedAttendance?.status === 'late' && (
                    <Clock className="w-8 h-8 text-white" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={selectedAttendance?.notes || ''}
                onChange={(e) => {
                  if (selectedAttendance) {
                    setSelectedAttendance({ ...selectedAttendance, notes: e.target.value });
                  }
                }}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowEditDialog(false);
                setSelectedAttendance(null);
              }}>
                Cancel
              </Button>
              <Button onClick={async () => {
                if (!selectedAttendance) return;
                try {
                  // If this is a project attendance record, call project-specific update
                  if (selectedAttendance.project_id) {
                    await api.updateProjectAttendance(selectedAttendance.id, {
                      status: selectedAttendance.status,
                      notes: selectedAttendance.notes,
                      attendance_date: selectedAttendance.attendance_date
                    });
                  } else {
                    await api.updateAttendance(selectedAttendance.id, {
                      status: selectedAttendance.status,
                      notes: selectedAttendance.notes
                    });
                  }
                  toast.success("Attendance updated successfully!");
                  setShowEditDialog(false);
                  setSelectedAttendance(null);
                  loadData();

                } catch (error: any) {
                  toast.error("Failed to update attendance: " + error.message);
                }
              }}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Attendance Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the attendance record for {selectedAttendance?.user_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setSelectedAttendance(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={async () => {
              if (!selectedAttendance) return;
              try {
                if (selectedAttendance.project_id) {
                  await api.deleteProjectAttendance(selectedAttendance.id);
                } else {
                  await api.deleteAttendance(selectedAttendance.id);
                }
                toast.success("Attendance record deleted successfully!");
                setShowDeleteDialog(false);
                setSelectedAttendance(null);
                loadData();

              } catch (error: any) {
                toast.error("Failed to delete attendance: " + error.message);
              }
            }}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ManageAttendance;
