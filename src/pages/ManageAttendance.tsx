import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Calendar, Plus, ArrowLeft, CheckCircle2, XCircle, Clock, Briefcase, Users, Search, Filter, Edit, Trash2, Eye, Download, X as XIcon } from "lucide-react";
import AttendanceDetailsModal from "@/components/AttendanceDetailsModal";
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
  const [showDateViewer, setShowDateViewer] = useState(false);
  const [dateViewerContext, setDateViewerContext] = useState<{ type: 'project' | 'meeting' | 'event' | null; id?: number; title?: string }>({ type: null });
  const [selectedType, setSelectedType] = useState<'project' | 'meeting' | 'event' | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [itemStudents, setItemStudents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSection, setActiveSection] = useState<'projects' | 'meetings' | 'events'>('projects');
  
  const [createData, setCreateData] = useState({
    type: 'meeting',
    title: "",
    description: "",
    date: "",
    location: "",
    projectId: "",
    meetingId: ""
  });
  const detailSectionRef = useRef<HTMLDivElement>(null);

  const { permissions, loading: permissionsLoading } = usePermissions();

  const location = useLocation();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    const user = auth.getUser();

    // Wait for permissions to load first
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_attendance;
    if (!canAccess) {
      toast.error("You don't have permission to access attendance management");
      navigate("/admin");
      return;
    }

    // Load page data
    loadData();
  }, [navigate, permissions, permissionsLoading]);

  // If a projectId is provided in the URL query params, open the project's date viewer after data loads
  useEffect(() => {
    if (loading) return; // wait until initial data load completes
    try {
      const params = new URLSearchParams(location.search);
      const pid = params.get('projectId');
      if (pid) {
        const id = parseInt(pid, 10);
        // Open the project date viewer automatically
        openDateViewer('project', id);
        // Remove the query param so it doesn't reopen repeatedly
        const newParams = new URLSearchParams(location.search);
        newParams.delete('projectId');
        navigate(location.pathname + (newParams.toString() ? `?${newParams.toString()}` : ''), { replace: true });
      }
    } catch (error) {
      // ignore
    }
  }, [loading, location.search]);

  // --- loadData: fetch initial page data ---
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

      if (projRes.status === 'fulfilled' && projRes.value.success) setProjects(projRes.value.projects || []);
      if (meetRes.status === 'fulfilled' && meetRes.value.success) setMeetings(meetRes.value.meetings || []);
      if (eventRes.status === 'fulfilled' && eventRes.value.success) setEvents(eventRes.value.events || []);
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
        // Create a meeting for project attendance
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

      // Mark attendance for each student
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
    
    // Load students for the item
    let loadedStudents: any[] = [];
    
    if (type === 'project') {
      try {
        const studentsRes = await api.getProjectStudents(item.id);
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
    } else if (type === 'event') {
      // For events, load event members
      try {
        const membersRes = await api.getEventMembers(item.id);
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
      // For meetings, use all students with their profiles
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
    
    // Load existing attendance/OD records
    if (type === 'meeting') {
      try {
        const attendanceRes = await api.getAttendance({ meetingId: item.id });
        if (attendanceRes.success && attendanceRes.attendance) {
          const existingAttendance: Record<number, string> = {};
          attendanceRes.attendance.forEach((att: any) => {
            existingAttendance[att.user_id] = att.status;
          });
          setAttendanceData(existingAttendance);
        } else {
          // Initialize with blank for all students
          const initialAttendance: Record<number, string> = {};
          loadedStudents.forEach((student: any) => {
            initialAttendance[student.user_id || student.id] = '';
          });
          setAttendanceData(initialAttendance);
        }
      } catch {
        // Initialize with blank for all students
        const initialAttendance: Record<number, string> = {};
        loadedStudents.forEach((student: any) => {
          initialAttendance[student.user_id || student.id] = '';
        });
        setAttendanceData(initialAttendance);
      }
    } else {
      // Initialize with blank for all students
      const initialAttendance: Record<number, string> = {};
      loadedStudents.forEach((student: any) => {
        initialAttendance[student.user_id || student.id] = '';
      });
      setAttendanceData(initialAttendance);
    }
    
    setShowMarkDialog(true);
  };

  const handleMarkAttendanceClick = async (studentId: number, status: string) => {
    if (!selectedItem || !selectedType) return;

    try {
      let meetingId = null;

      if (selectedType === 'project') {
        // Create a meeting for project attendance if it doesn't exist
        const meetingTitle = `${selectedItem.title} - Attendance`;
        // Check if meeting already exists
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
          // Reload meetings
          const meetingsRes = await api.getMeetings();
          if (meetingsRes.success) {
            setMeetings(meetingsRes.meetings || []);
          }
        }
      } else {
        meetingId = selectedItem.id;
      }

      // Mark attendance immediately
      if (selectedType === 'project') {
        await api.markProjectAttendance(selectedItem.id, {
          userId: studentId,
          attendance_date: selectedDate,
          status,
          notes: `Project: ${selectedItem.title}`
        });
      } else if (selectedType === 'event') {
        // Mark Event OD
        await api.markEventOD(selectedItem.id, studentId, status as 'od' | 'absent' | 'permission');
      } else {
        await api.markAttendance({
          meetingId,
          userId: studentId,
          status,
          notes: `Meeting: ${selectedItem.title}`
        });
      }

      // Update local state
      setAttendanceData({
        ...attendanceData,
        [studentId]: status
      });

      toast.success(`${selectedType === 'event' ? 'Event OD' : 'Attendance'} marked successfully!`);
      
      // Reload attendance records
      if (selectedType !== 'event') {
        const attendanceRes = await api.getAttendance();
        if (attendanceRes.success) {
          setAttendanceRecords(attendanceRes.attendance || []);
        }
      }
    } catch (error: any) {
      toast.error("Failed to mark: " + error.message);
    }
  };

  // --- Date viewer helpers ---
  const openDateViewer = (type: 'project' | 'meeting' | 'event', id: number, title?: string) => {
    setDateViewerContext({ type, id, title });
    setShowDateViewer(true);
    // The AttendanceDetailsModal will handle loading dates internally
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'active':
        return <Badge variant="default" className="bg-accent">Active</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter projects and meetings
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
    setActiveSection(key);
    detailSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatAttendanceCount = (count: number, total: number) => (total > 0 ? count : '—');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-7xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                <Plus className="w-4 h-4" />
                Create Attendance
              </Button>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Attendance</h1>
              <p className="text-lg opacity-90">Mark attendance for projects and meetings with ease</p>
            </div>
          </div>

          {/* Filter Section */}
          <Card className="gradient-card border-border/50 mb-8 shadow-md bg-white/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search projects or meetings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-orange-200/50 focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 border-orange-200/50 focus:border-orange-500 focus:ring-orange-500">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
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

          {/* Category cards (click to navigate to pages) */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {summaryCards.map(({ key, title, description, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSectionChange(key)}
                className={`text-left rounded-2xl border px-5 py-4 shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer ${
                  activeSection === key
                    ? 'border-orange-500 ring-2 ring-orange-200 bg-white'
                    : 'border-border/60 bg-white/70 hover:border-orange-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                  </div>
                  <div className={`p-3 rounded-full transition-colors ${activeSection === key ? 'bg-orange-500/10 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground">Items</div>
                  <div className="text-3xl font-bold text-orange-600">{count}</div>
                </div>
              </button>
            ))}
          </div>

          <div ref={detailSectionRef}>
          {activeSection === 'projects' && (
                      <>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-r from-orange-600 to-red-500 rounded-lg p-2">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
                Projects ({filteredProjects.length})
              </span>
            </h2>
            {error ? (
              <div className="text-center py-8 text-red-500">
                {error}
                <div className="mt-4">
                  <Button variant="outline" onClick={() => loadData()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="text-center py-8">Loading projects...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No projects found</div>
            ) : (
              <Card className="gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project Title</TableHead>
                          <TableHead>NGO Partner</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Present</TableHead>
                          <TableHead>Absent</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProjects.map((project) => {
                          const projectAttendance = attendanceRecords.filter(r => r.notes && r.notes.includes(`Project: ${project.title}`));
                          const presentCount = projectAttendance.filter(r => r.status === 'present').length;
                          const absentCount = projectAttendance.filter(r => r.status === 'absent').length;
                          const totalRecords = projectAttendance.length;
                          
                          return (
                            <TableRow key={project.id}>
                              <TableCell className="font-medium">{project.title}</TableCell>
                              <TableCell>{project.ngo_name || "-"}</TableCell>
                              <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : "-"}</TableCell>
                              <TableCell>{project.end_date ? new Date(project.end_date).toLocaleDateString() : "-"}</TableCell>
                              <TableCell>{getStatusBadge(project.status)}</TableCell>
                              <TableCell className="text-green-600 font-semibold">{formatAttendanceCount(presentCount, totalRecords)}</TableCell>
                              <TableCell className="text-red-600 font-semibold">{formatAttendanceCount(absentCount, totalRecords)}</TableCell>
                              <TableCell className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDateViewer('project', project.id, project.title)}
                                  className="gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenMarkDialog(project, 'project')}
                                  className="gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Mark
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
                      </>
                    )}
                    {activeSection === 'meetings' && (
                      <>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-r from-orange-600 to-red-500 rounded-lg p-2">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
                Meetings ({filteredMeetings.length})
              </span>
            </h2>
            {error ? (
              <div className="text-center py-8 text-red-500">
                {error}
                <div className="mt-4">
                  <Button variant="outline" onClick={() => loadData()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="text-center py-8">Loading meetings...</div>
            ) : filteredMeetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No meetings found</div>
            ) : (
              <Card className="gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meeting Title</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Present</TableHead>
                          <TableHead>Absent</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMeetings.map((meeting) => {
                          const meetingAttendance = attendanceRecords.filter(r => r.meeting_id === meeting.id);
                          const presentCount = meetingAttendance.filter(r => r.status === 'present').length;
                          const absentCount = meetingAttendance.filter(r => r.status === 'absent').length;
                          const totalRecords = meetingAttendance.length;
                          
                          return (
                            <TableRow key={meeting.id}>
                              <TableCell className="font-medium">{meeting.title}</TableCell>
                              <TableCell>{meeting.location || "-"}</TableCell>
                              <TableCell>{meeting.date ? new Date(meeting.date).toLocaleString() : "-"}</TableCell>
                              <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                              <TableCell className="text-green-600 font-semibold">{formatAttendanceCount(presentCount, totalRecords)}</TableCell>
                              <TableCell className="text-red-600 font-semibold">{formatAttendanceCount(absentCount, totalRecords)}</TableCell>
                              <TableCell className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDateViewer('meeting', meeting.id, meeting.title)}
                                  className="gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenMarkDialog(meeting, 'meeting')}
                                  className="gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Mark
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
                      </>
                    )}
                    {activeSection === 'events' && (
                      <>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg p-2">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Events ({filteredEvents.length})
              </span>
            </h2>
            {error ? (
              <div className="text-center py-8 text-red-500">
                {error}
                <div className="mt-4">
                  <Button variant="outline" onClick={() => loadData()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="text-center py-8">Loading events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No events found</div>
            ) : (
              <Card className="gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Special Day</TableHead>
                          <TableHead>OD</TableHead>
                          <TableHead>Absent</TableHead>
                          <TableHead>Permission</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.map((event) => {
                          const eventODRecords = [];
                          const odCount = eventODRecords.filter((r: any) => r.status === 'od').length;
                          const absentCount = eventODRecords.filter((r: any) => r.status === 'absent').length;
                          const permissionCount = eventODRecords.filter((r: any) => r.status === 'permission').length;
                          
                          return (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">{event.title}</TableCell>
                              <TableCell>{event.date ? new Date(event.date).toLocaleDateString() : "-"}</TableCell>
                              <TableCell>{event.year}</TableCell>
                              <TableCell>
                                {event.is_special_day ? (
                                  <Badge className="bg-amber-500">Yes</Badge>
                                ) : (
                                  <Badge variant="outline">No</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-green-600 font-semibold">{odCount}</TableCell>
                              <TableCell className="text-red-600 font-semibold">{absentCount}</TableCell>
                              <TableCell className="text-blue-600 font-semibold">{permissionCount}</TableCell>
                              <TableCell className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDateViewer('event', event.id, event.title)}
                                  className="gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenMarkDialog(event, 'event')}
                                  className="gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Mark
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
                      </>
                    )}
          </div>

          {/* Attendance Summary by Project & Meeting - HIDDEN */}
          <div style={{ display: 'none' }}>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg p-2">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Attendance Summary
              </span>
            </h2>
            
            {loading ? (
              <div className="text-center py-8">Loading summary...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No attendance data to summarize</div>
            ) : (
              <div className="space-y-4">
                {/* Project Summaries */}
                {filteredProjects.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">By Project</h3>
                    <div className="grid gap-3">
                      {filteredProjects.map((project) => {
                        const projectAttendance = attendanceRecords.filter(r => r.notes && r.notes.includes(`Project: ${project.title}`));
                        const total = projectAttendance.length;
                        const present = projectAttendance.filter(r => r.status === 'present').length;
                        const absent = projectAttendance.filter(r => r.status === 'absent').length;
                        const permission = projectAttendance.filter(r => r.status === 'late').length;
                        const presentPercent = total > 0 ? Math.round((present / total) * 100) : 0;

                        return (
                          <Card key={`proj-${project.id}`} className="gradient-card border-border/50">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="font-semibold text-foreground">{project.title}</h4>
                                  <p className="text-sm text-muted-foreground">{project.ngo_name || "No NGO"}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-green-500">{presentPercent}%</div>
                                  <div className="text-xs text-muted-foreground">Present</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-green-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-green-500">{present}</div>
                                  <div className="text-xs text-muted-foreground">Present</div>
                                </div>
                                <div className="bg-red-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-red-500">{absent}</div>
                                  <div className="text-xs text-muted-foreground">Absent</div>
                                </div>
                                <div className="bg-yellow-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-yellow-500">{permission}</div>
                                  <div className="text-xs text-muted-foreground">Permission</div>
                                </div>
                                <div className="bg-blue-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-blue-500">{total}</div>
                                  <div className="text-xs text-muted-foreground">Total</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Meeting Summaries - Hidden */}
                {filteredMeetings.length > 0 && false && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 mt-8 text-foreground">By Meeting</h3>
                    <div className="grid gap-3">
                      {filteredMeetings.map((meeting) => {
                        const meetingAttendance = attendanceRecords.filter(r => r.meeting_id === meeting.id);
                        const total = meetingAttendance.length;
                        const present = meetingAttendance.filter(r => r.status === 'present').length;
                        const absent = meetingAttendance.filter(r => r.status === 'absent').length;
                        const permission = meetingAttendance.filter(r => r.status === 'late').length;
                        const presentPercent = total > 0 ? Math.round((present / total) * 100) : 0;

                        return (
                          <Card key={`meet-${meeting.id}`} className="gradient-card border-border/50">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="font-semibold text-foreground">{meeting.title}</h4>
                                  <p className="text-sm text-muted-foreground">📍 {meeting.location || "No location"} • 🕐 {meeting.date ? new Date(meeting.date).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-green-500">{presentPercent}%</div>
                                  <div className="text-xs text-muted-foreground">Present</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-green-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-green-500">{present}</div>
                                  <div className="text-xs text-muted-foreground">Present</div>
                                </div>
                                <div className="bg-red-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-red-500">{absent}</div>
                                  <div className="text-xs text-muted-foreground">Absent</div>
                                </div>
                                <div className="bg-yellow-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-yellow-500">{permission}</div>
                                  <div className="text-xs text-muted-foreground">Permission</div>
                                </div>
                                <div className="bg-blue-500/10 p-3 rounded-lg">
                                  <div className="font-semibold text-blue-500">{total}</div>
                                  <div className="text-xs text-muted-foreground">Total</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attendance Records Section - HIDDEN */}
          <div style={{ display: 'none' }}>
            <Card className="gradient-card border-border/50 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-orange-600/10 to-red-500/10 border-b">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="bg-gradient-to-r from-orange-600 to-red-500 rounded-lg p-2">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">
                    All Attendance Records ({attendanceRecords.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="text-center py-8 text-red-500">
                    {error}
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => loadData()}>
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">Loading attendance records...</div>
                ) : attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Meeting/Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.user_name}</TableCell>
                          <TableCell>{record.meeting_title}</TableCell>
                          <TableCell>
                            {record.status === 'present' && (
                              <Badge className="bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Present
                              </Badge>
                            )}
                            {record.status === 'absent' && (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Absent
                              </Badge>
                            )}
                            {record.status === 'late' && (
                              <Badge className="bg-yellow-600">
                                <Clock className="w-3 h-3 mr-1" />
                                Permission
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.marked_at ? new Date(record.marked_at).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{record.notes || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAttendance(record);
                                  setShowEditDialog(true);
                                }}
                                className="gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
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

        {/* Attendance Details Modal */}
        <AttendanceDetailsModal
          open={showDateViewer}
          onOpenChange={setShowDateViewer}
          projectId={dateViewerContext.type === 'project' ? dateViewerContext.id : undefined}
          meetingId={dateViewerContext.type === 'meeting' ? dateViewerContext.id : undefined}
          eventId={dateViewerContext.type === 'event' ? dateViewerContext.id : undefined}
          title={`Attendance Details - ${dateViewerContext.title || ''}`}
        />

      {/* Mark Attendance Dialog */}
      <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              📋 Mark {selectedType === 'event' ? 'Event OD' : 'Attendance'} for {selectedItem?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedType === 'event' 
                ? 'Mark OD/Absent/Permission for each student in this event'
                : 'Step 1: Pick a date below • Step 2: Click Present/Absent/Permission for each student'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-6">
            {/* Date Picker - Only for non-event types */}
            {selectedType !== 'event' && (
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 space-y-2">
                <Label htmlFor="attendance-date" className="text-lg font-semibold text-blue-900">📅 Select Date for Attendance</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="max-w-xs text-base"
                />
                <p className="text-sm font-medium text-blue-700">
                  ✓ Marking for: <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </p>
              </div>
            )}

            {itemStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found. Please add students first.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="text-sm font-medium text-green-900">👥 Click the buttons below to mark {selectedType === 'event' ? 'OD/Absent/Permission' : 'attendance'} for {itemStudents.length} student(s)</p>
                </div>
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    {selectedType !== 'event' && (
                      <>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                      </>
                    )}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemStudents.map((student) => {
                    const studentId = student.user_id || student.id;
                    const currentStatus = attendanceData[studentId] || '';
                    return (
                      <TableRow key={studentId}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell className="text-sm">{student.email}</TableCell>
                        {selectedType !== 'event' && (
                          <>
                            <TableCell>{student.dept || student.department || "N/A"}</TableCell>
                            <TableCell>{student.year || "N/A"}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex gap-3 items-center">
                            {selectedType === 'event' ? (
                              <>
                                {/* OD Button */}
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    onClick={() => handleMarkAttendanceClick(studentId, 'od')}
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'od'
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
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'absent'
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
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'permission'
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
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'present'
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
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'absent'
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
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                      currentStatus === 'late'
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
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowMarkDialog(false);
              setSelectedItem(null);
              setSelectedType(null);
              setAttendanceData({});
              setItemStudents([]);
              setSelectedDate(new Date().toISOString().split('T')[0]);
            }}>
              Close
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
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedAttendance?.status === 'present'
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
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedAttendance?.status === 'absent'
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
                  className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedAttendance?.status === 'late'
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
                  // Close and reopen modal to refresh data
                  if (showDateViewer) {
                    setShowDateViewer(false);
                    setTimeout(() => setShowDateViewer(true), 100);
                  }
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
                // Close and reopen modal to refresh data
                if (showDateViewer) {
                  setShowDateViewer(false);
                  setTimeout(() => setShowDateViewer(true), 100);
                }
              } catch (error: any) {
                toast.error("Failed to delete attendance: " + error.message);
              }
            }}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManageAttendance;

