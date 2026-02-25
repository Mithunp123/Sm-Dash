

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DeveloperCredit from "@/components/DeveloperCredit";

import { Calendar, Eye, CheckCircle2, Search, Filter, XCircle, Clock, Users, Plus, Download, Edit, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const AttendanceMeetings = () => {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [error, setError] = useState<string | null>(null);

    const getLocalDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    // Mark Dialog State
    const [showMarkDialog, setShowMarkDialog] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [attendanceData, setAttendanceData] = useState<Record<number, string>>({});
    const [unsavedChanges, setUnsavedChanges] = useState<Record<number, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [dialogSearchQuery, setDialogSearchQuery] = useState("");
    const [itemStudents, setItemStudents] = useState<any[]>([]);

    // View Dialog State
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [viewMeetingId, setViewMeetingId] = useState<number | null>(null);
    const [viewMeetingTitle, setViewMeetingTitle] = useState("");
    const [viewRecords, setViewRecords] = useState<any[]>([]);
    const [viewSearchQuery, setViewSearchQuery] = useState("");
    const [viewStatusFilter, setViewStatusFilter] = useState("all");
    const [viewLoading, setViewLoading] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
    const [editedStatus, setEditedStatus] = useState("");

    const { permissions, loading: permissionsLoading } = usePermissions();

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        if (permissionsLoading) return;

        // Check permissions
        const user = auth.getUser();
        const isAdmin = user?.role === 'admin';
        const canAccess = isAdmin || permissions.can_manage_attendance;

        if (!canAccess) {
            toast.error("Access denied");
            navigate("/admin");
            return;
        }

        loadData();
    }, [navigate, permissions, permissionsLoading]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [meetRes, attRes, studRes] = await Promise.all([
                api.getMeetings(),
                api.getAttendance(),
                api.getStudentsScoped()
            ]);

            if (meetRes.success) setMeetings(meetRes.meetings || []);
            if (attRes.success) setAttendanceRecords(attRes.attendance || []);
            if (studRes.success) setStudents(studRes.students || []);
        } catch (err: any) {
            setError(err?.message || String(err));
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const filteredMeetings = meetings.filter((meeting) => {
        const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (meeting.location && meeting.location.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

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

    const getBadge = (status: string) => {
        switch (status) {
            case 'present': return <Badge className="bg-green-600 hover:bg-green-700">Present</Badge>;
            case 'absent': return <Badge variant="destructive">Absent</Badge>;
            case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600">Late</Badge>;
            case 'permission': return <Badge className="bg-blue-500 hover:bg-blue-600">Permission</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatAttendanceCount = (count: number, total: number) => (total > 0 ? count : '—');

    const openDateViewer = async (meetingId: number, meetingTitle: string) => {
        console.log("🔍 Opening viewer for meeting:", meetingId, meetingTitle);
        setViewMeetingId(meetingId);
        setViewMeetingTitle(meetingTitle);
        setViewRecords([]);
        setViewSearchQuery("");
        setViewStatusFilter("all");
        setViewStatusFilter("all");
        setEditingRecordId(null);
        setEditedStatus("");
        setShowViewDialog(true);
        setViewLoading(true);

        try {
            console.log("📡 Fetching attendance for meeting:", meetingId);
            const response = await api.getMeetingAttendance(meetingId);
            console.log("📦 API Response:", response);

            if (response.success && response.records) {
                console.log("✅ Loaded", response.records.length, "records");
                setViewRecords(response.records);
            } else {
                console.log("⚠️ No records in API response, using cached data");
                const records = attendanceRecords.filter(r =>
                    (r.meeting_id === meetingId) || (r.meetingId === meetingId)
                );
                console.log("📋 Found", records.length, "cached records");
                setViewRecords(records);

                if (records.length === 0) {
                    toast.info("No attendance records found for this meeting");
                }
            }
        } catch (error) {
            console.error("❌ Error loading attendance:", error);
            // Try to use cached records as fallback
            const records = attendanceRecords.filter(r =>
                (r.meeting_id === meetingId) || (r.meetingId === meetingId)
            );
            setViewRecords(records);

            if (records.length === 0) {
                toast.error("Failed to load attendance records");
            }
        } finally {
            setViewLoading(false);
        }
    };

    const handleOpenMarkDialog = (meeting: any) => {
        setSelectedMeeting(meeting);
        setSelectedDate(getLocalDate());
        setShowDatePicker(true);
    };

    const handleLoadAttendance = async () => {
        if (!selectedMeeting) return;
        setItemStudents([]);
        setAttendanceData({});
        setUnsavedChanges({});

        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                api.getStudentsScoped(),
                api.getMeetingAttendance(selectedMeeting.id, selectedDate)
            ]);

            if (studentsRes.success) {
                setItemStudents(studentsRes.students || []);

                if (attendanceRes.success && attendanceRes.records) {
                    const existingData: Record<number, string> = {};
                    attendanceRes.records.forEach((rec: any) => {
                        existingData[rec.user_id] = rec.status;
                    });
                    setAttendanceData(existingData);
                }
            }
            setShowDatePicker(false);
            setShowMarkDialog(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load attendance data");
        }
    };

    const handleMarkAttendanceClick = (studentId: number, status: string) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: status }));
        setUnsavedChanges(prev => ({ ...prev, [studentId]: status }));
    };

    // Permission button implementation
    const handleMarkAllPresent = () => {
        const newData = { ...attendanceData };
        const newChanges = { ...unsavedChanges };
        const usersToMark = itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase()));

        usersToMark.forEach(s => {
            const id = s.user_id || s.id;
            newData[id] = 'present';
            newChanges[id] = 'present';
        });
        setAttendanceData(newData);
        setUnsavedChanges(newChanges);
        toast.success("Marked current view as Present");
    };

    const handleSaveAttendance = async () => {
        if (!selectedMeeting || Object.keys(unsavedChanges).length === 0) return;
        setIsSaving(true);
        try {
            const results = await Promise.all(
                Object.entries(unsavedChanges).map(async ([studentId, status]) => {
                    const userId = parseInt(studentId);
                    const res = await api.markAttendance({
                        meetingId: selectedMeeting.id,
                        userId,
                        status,
                        notes: `Meeting: ${selectedMeeting.title}`,
                        attendance_date: selectedDate,
                        date: selectedDate // Send both keys to ensure backend accepts one
                    });
                    return res;
                })
            );

            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                const firstError = failures[0].message || failures[0].error || "Unknown server error";
                console.error("Failed to save some records:", failures);
                throw new Error(`${failures.length} failed: ${firstError}`);
            }

            toast.success("Attendance saved!");
            setUnsavedChanges({});
            setShowMarkDialog(false);
            loadData(); // Reload stats
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to save: " + (error.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    };

    const exportToCSV = () => {
        console.log("📥 Export CSV clicked. Meeting ID:", viewMeetingId);
        console.log("📊 Total records:", viewRecords.length);

        if (!viewMeetingId) {
            console.error("❌ No meeting ID set");
            toast.error("No meeting selected");
            return;
        }

        const records = viewRecords.filter(r => {
            const matchesSearch = r.user_name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) ||
                r.user_email?.toLowerCase().includes(viewSearchQuery.toLowerCase());
            const matchesStatus = viewStatusFilter === "all" || r.status === viewStatusFilter;
            return matchesSearch && matchesStatus;
        });

        console.log("📋 Filtered records for export:", records.length);

        if (records.length === 0) {
            toast.error("No records to export");
            return;
        }

        // Create CSV content
        const headers = ["Date", "Student Name", "Email", "Department", "Year", "Status", "Notes"];
        const csvRows = [
            headers.join(","),
            ...records.map(r => [
                r.attendance_date || new Date(r.marked_at).toLocaleDateString('en-GB'),
                `"${r.user_name || 'N/A'}"`,
                `"${r.user_email || 'N/A'}"`,
                `"${r.user_dept || r.department || 'N/A'}"`,
                `"${r.user_year || r.year || 'N/A'}"`,
                r.status || 'N/A',
                `"${r.notes || ''}"`
            ].join(","))
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        const filename = `${viewMeetingTitle.replace(/[^a-z0-9]/gi, '_')}_attendance_${new Date().toISOString().split('T')[0]}.csv`;
        console.log("💾 Downloading file:", filename);

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Attendance exported successfully!");
    };

    return (
        <div className="min-h-screen flex flex-col">
            <DeveloperCredit />
            <main className="flex-1 w-full bg-background overflow-x-hidden">
                <div className="w-full px-4 md:px-6 lg:px-8 py-8 space-y-6">
                    <div className="mb-6">

                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground flex items-center gap-3">
                                <div className="bg-primary/10 rounded-2xl p-2 md:p-2.5 shadow-inner shrink-0">
                                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary" />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2">
                                    Meetings Attendance
                                </div>
                            </h1>
                            <p className="text-muted-foreground font-medium text-sm md:text-base border-l-4 border-primary/30 pl-3">
                                Manage and monitor volunteer meeting participation
                            </p>
                        </div>
                    </div>

                    <Card className="border-border/40 shadow-xl bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                    <Input
                                        placeholder="Search by meeting title or location..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-12 h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-2xl shadow-sm md:text-lg"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-muted rounded-2xl hidden md:block">
                                        <Filter className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full md:w-48 h-12 rounded-2xl bg-background/50 border-border/50 font-bold shadow-sm focus:ring-primary/20">
                                            <SelectValue placeholder="All Status" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-border/50 shadow-2xl">
                                            <SelectItem value="all" className="font-bold">All Status</SelectItem>
                                            <SelectItem value="active" className="font-bold">Active</SelectItem>
                                            <SelectItem value="scheduled" className="font-bold">Scheduled</SelectItem>
                                            <SelectItem value="completed" className="font-bold">Completed</SelectItem>
                                            <SelectItem value="cancelled" className="font-bold">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {loading ? (
                        <div className="text-center py-12">Loading meetings...</div>
                    ) : filteredMeetings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No meetings found</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMeetings.map((meeting) => {
                                const meetingAttendance = attendanceRecords.filter(r =>
                                    (r.meeting_id === meeting.id) || (r.meetingId === meeting.id)
                                );

                                const dates = meetingAttendance.map(r => {
                                    const d = r.attendance_date || r.marked_at || r.created_at;
                                    return d ? new Date(d).getTime() : 0;
                                }).filter(d => d > 0);
                                const latestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
                                const latestDateStr = latestDate ? latestDate.toISOString().split('T')[0] : '';

                                const recentRecs = latestDateStr ? meetingAttendance.filter(r => {
                                    const d = r.attendance_date || r.marked_at || r.created_at;
                                    return d && d.startsWith(latestDateStr);
                                }) : [];

                                const presentCount = recentRecs.filter(r => r.status === 'present').length;
                                const absentCount = recentRecs.filter(r => r.status === 'absent').length;
                                const permissionCount = recentRecs.filter(r => r.status === 'late').length;

                                return (
                                    <Card key={meeting.id} className="relative overflow-hidden group border-2 border-border/40 hover:border-primary/40 rounded-3xl shadow-xl transition-all duration-300 active:scale-[0.98]">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                                        <CardHeader className="pb-4 px-6 pt-6">
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline" className="px-2 py-0.5 rounded-lg border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]" title={meeting.location || 'No Location'}>
                                                    {meeting.location || 'No Location'}
                                                </Badge>
                                                {getStatusBadge(meeting.status)}
                                            </div>
                                            <CardTitle className="text-2xl font-black uppercase tracking-tight line-clamp-1" title={meeting.title}>{meeting.title}</CardTitle>
                                            <CardDescription className="flex items-center gap-2 font-bold text-xs mt-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {latestDate ? `Last Activity: ${latestDate.toLocaleDateString('en-GB')}` : (meeting.date ? new Date(meeting.date).toLocaleString('en-GB') : 'No Date')}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-6 pb-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex flex-col items-center">
                                                    <div className="text-2xl font-black text-green-500">{presentCount}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Present</div>
                                                </div>
                                                <div className="flex flex-col items-center border-x border-border/50 px-2">
                                                    <div className="text-2xl font-black text-red-500">{absentCount}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Absent</div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="text-2xl font-black text-blue-500">{permissionCount}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Perm.</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <Button className="flex-1 h-11 rounded-xl bg-background border-2 border-border/50 hover:bg-muted font-bold transition-all gap-2" variant="outline" onClick={() => openDateViewer(meeting.id, meeting.title)}>
                                                    <Eye className="w-4 h-4" /> View
                                                </Button>
                                                <Button className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all gap-2" onClick={() => handleOpenMarkDialog(meeting)}>
                                                    <CheckCircle2 className="w-4 h-4" /> Mark
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Date Selection Dialog */}
                    <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Select Date</DialogTitle>
                                <DialogDescription>
                                    Choose date to mark attendance for {selectedMeeting?.title}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="attendance-date">Date</Label>
                                    <Input
                                        id="attendance-date"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setShowDatePicker(false)}>Cancel</Button>
                                    <Button onClick={handleLoadAttendance}>Load Attendance</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Mark Dialog */}
                    <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto w-full">
                            <DialogHeader>
                                <DialogTitle>Mark Attendance: {selectedMeeting?.title}</DialogTitle>
                                <DialogDescription>
                                    Date: {new Date(selectedDate).toLocaleDateString()}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="p-4 border-b bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                        {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).length} Students Loaded
                                    </span>
                                    <Button size="sm" onClick={handleMarkAllPresent} className="gap-2 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-md">
                                        <CheckCircle2 className="w-4 h-4" /> Mark All Present
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Info Indicator & Mark All */}
                                    <div className="hidden md:flex items-center justify-between gap-3 mb-6">
                                        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex-1">
                                            <div className="bg-blue-500/10 p-1.5 rounded-lg">
                                                <Users className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                                                Manage meeting attendance for {itemStudents.length} student(s).
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desktop View: Table Layout (without Email) */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[11px] font-bold text-slate-400/80 uppercase tracking-[0.2em] border-b border-white/5">
                                                    <th className="pb-5 px-2">S.No</th>
                                                    <th className="pb-5 px-2">Name</th>
                                                    <th className="pb-5 px-2">Department</th>
                                                    <th className="pb-5 px-2">Year</th>
                                                    <th className="pb-5 px-2 text-center w-[320px]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).map((student, index) => {
                                                    const id = student.user_id || student.id;
                                                    const status = attendanceData[id] || '';
                                                    return (
                                                        <tr key={id} className="group hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-6 px-2 text-sm font-medium text-slate-500">{index + 1}</td>
                                                            <td className="py-6 px-2">
                                                                <h4 className="font-bold text-foreground uppercase tracking-tight text-sm">{student.name}</h4>
                                                            </td>
                                                            <td className="py-6 px-2 text-xs font-semibold text-slate-500 uppercase">{student.dept || student.department || 'N/A'}</td>
                                                            <td className="py-6 px-2 text-xs font-semibold text-slate-500 uppercase">{student.year || 'N/A'}</td>
                                                            <td className="py-6 px-2">
                                                                <div className="flex justify-center items-center gap-6">
                                                                    {[
                                                                        { id: 'present', label: 'Present', color: 'green', icon: CheckCircle2 },
                                                                        { id: 'absent', label: 'Absent', color: 'red', icon: XCircle },
                                                                        { id: 'late', label: 'Permission', color: 'blue', icon: Clock }
                                                                    ].map(btn => (
                                                                        <div key={btn.id} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                                                                            <button
                                                                                onClick={() => handleMarkAttendanceClick(id, btn.id)}
                                                                                className={`h-11 w-11 rounded-full border-[2.5px] transition-all duration-300 flex items-center justify-center ${status === btn.id
                                                                                    ? `bg-${btn.color}-500 border-${btn.color}-600 shadow-lg shadow-${btn.color}-500/40 scale-110 text-foreground`
                                                                                    : 'border-slate-700/60 hover:border-slate-500 bg-transparent text-slate-600'
                                                                                    }`}
                                                                            >
                                                                                <btn.icon className={`w-6 h-6 transition-all ${status === btn.id ? 'scale-110 opacity-100' : 'scale-90 opacity-40'}`} />
                                                                            </button>
                                                                            <span className={`text-[9px] font-bold uppercase tracking-tight transition-colors ${status === btn.id ? `text-${btn.color}-400` : 'text-slate-500'}`}>
                                                                                {btn.label}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="grid grid-cols-1 md:hidden gap-3">
                                        {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).map(student => {
                                            const id = student.user_id || student.id;
                                            const status = attendanceData[id] || '';
                                            return (
                                                <div key={id} className={`p-6 rounded-3xl border-2 transition-all duration-300 ${status ? 'border-primary/30 bg-primary/5 shadow-xl shadow-primary/10' : 'border-border/40 bg-card shadow-md'}`}>
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="space-y-1">
                                                            <h4 className="font-black text-foreground uppercase tracking-tight text-lg leading-none">{student.name}</h4>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] italic truncate max-w-[180px]">{student.email}</p>
                                                        </div>
                                                        <div className={`h-4 w-4 rounded-full shadow-inner ${status === 'present' ? 'bg-green-500 shadow-green-500/50' :
                                                            status === 'absent' ? 'bg-red-500 shadow-red-500/50' :
                                                                status === 'late' ? 'bg-blue-500 shadow-blue-500/50' :
                                                                    'bg-slate-200'
                                                            }`}></div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-3">
                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'present')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'present'
                                                                ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/30 text-foreground scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-green-400'}`}
                                                        >
                                                            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Present</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'absent')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'absent'
                                                                ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/30 text-foreground scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-red-400'}`}
                                                        >
                                                            <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Absent</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'late')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'late'
                                                                ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/30 text-foreground scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-red-400'}`}
                                                        >
                                                            <Clock className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Late</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-6 border-t bg-background flex flex-col sm:flex-row justify-end gap-3 sm:rounded-b-3xl">
                                    <Button onClick={handleSaveAttendance} disabled={isSaving || Object.keys(unsavedChanges).length === 0} className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/30 transition-all hover:scale-[1.02]">
                                        {isSaving ? 'Syncing Records...' : 'Save Attendance'}
                                    </Button>
                                    <Button variant="ghost" className="h-14 font-black uppercase tracking-widest text-xs rounded-2xl px-8" onClick={() => setShowMarkDialog(false)}>Cancel</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* View Attendance Dialog */}
                    <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
                            <DialogHeader className="px-6 pt-6 pb-4 border-b">
                                <DialogTitle className="text-2xl font-black">{viewMeetingTitle} - Attendance Records</DialogTitle>
                                <DialogDescription>
                                    Select a date to view and edit attendance
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-1 overflow-hidden">
                                {/* Date Sidebar */}
                                <div className="w-64 border-r bg-muted/30 overflow-y-auto">
                                    {viewLoading ? (
                                        <div className="p-4 text-center">
                                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                        </div>
                                    ) : (() => {
                                        // Get unique dates
                                        const dateMap: Record<string, any[]> = {};
                                        viewRecords.forEach(record => {
                                            const date = record.attendance_date || new Date(record.marked_at).toISOString().split('T')[0];
                                            if (!dateMap[date]) {
                                                dateMap[date] = [];
                                            }
                                            dateMap[date].push(record);
                                        });

                                        const dates = Object.keys(dateMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

                                        if (dates.length === 0) {
                                            return (
                                                <div className="p-4 text-center text-sm text-muted-foreground">
                                                    No dates available
                                                </div>
                                            );
                                        }

                                        // Auto-select first date if none selected
                                        if (!selectedDate && dates.length > 0) {
                                            setSelectedDate(dates[0]);
                                        }

                                        return (
                                            <div className="p-2 space-y-1">
                                                {dates.map(date => {
                                                    const records = dateMap[date];
                                                    const presentCount = records.filter(r => r.status === 'present').length;
                                                    const absentCount = records.filter(r => r.status === 'absent').length;
                                                    const lateCount = records.filter(r => r.status === 'late').length;
                                                    const isSelected = selectedDate === date;

                                                    return (
                                                        <button
                                                            key={date}
                                                            onClick={() => setSelectedDate(date)}
                                                            className={`w-full text-left p-3 rounded-lg transition-all ${isSelected
                                                                ? 'bg-primary text-primary-foreground shadow-md'
                                                                : 'hover:bg-muted'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Calendar className="w-4 h-4" />
                                                                <span className="font-bold text-sm">
                                                                    {new Date(date).toLocaleDateString('en-GB', {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        year: 'numeric'
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-2 text-xs ml-6">
                                                                <span className={isSelected ? 'opacity-90' : 'text-green-600'}>✓{presentCount}</span>
                                                                <span className={isSelected ? 'opacity-90' : 'text-red-600'}>✗{absentCount}</span>
                                                                <span className={isSelected ? 'opacity-90' : 'text-blue-600'}>⏰{lateCount}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Main Content Area */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Search and Filter Bar */}
                                    <div className="px-6 py-4 border-b bg-background">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <div className="flex-1 relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    placeholder="Search by name or email..."
                                                    value={viewSearchQuery}
                                                    onChange={(e) => setViewSearchQuery(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                            <Select value={viewStatusFilter} onValueChange={setViewStatusFilter}>
                                                <SelectTrigger className="w-full sm:w-40">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Status</SelectItem>
                                                    <SelectItem value="present">Present</SelectItem>
                                                    <SelectItem value="absent">Absent</SelectItem>
                                                    <SelectItem value="late">Late</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={exportToCSV} className="gap-2 bg-green-600 hover:bg-green-700">
                                                <Download className="w-4 h-4" /> Export
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Records Table */}
                                    <div className="flex-1 overflow-y-auto p-6">
                                        {viewLoading ? (
                                            <div className="text-center py-12">
                                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                <p className="mt-2 text-muted-foreground">Loading attendance records...</p>
                                            </div>
                                        ) : (() => {
                                            const filteredRecords = viewRecords.filter(r => {
                                                const recordDate = r.attendance_date || new Date(r.marked_at).toISOString().split('T')[0];
                                                const matchesDate = !selectedDate || recordDate === selectedDate;
                                                const matchesSearch = r.user_name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) ||
                                                    r.user_email?.toLowerCase().includes(viewSearchQuery.toLowerCase());
                                                const matchesStatus = viewStatusFilter === "all" || r.status === viewStatusFilter;
                                                return matchesDate && matchesSearch && matchesStatus;
                                            });

                                            if (filteredRecords.length === 0) {
                                                return (
                                                    <div className="text-center py-12 text-muted-foreground">
                                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                        <p>No attendance records found</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="border rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Student Name</TableHead>
                                                                <TableHead>Email</TableHead>
                                                                <TableHead>Dept</TableHead>
                                                                <TableHead>Year</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead>Notes</TableHead>
                                                                <TableHead className="text-right">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {filteredRecords.map((record, idx) => {
                                                                const isEditing = editingRecordId === record.id;

                                                                return (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="font-bold">{record.user_name || 'N/A'}</TableCell>
                                                                        <TableCell className="text-sm text-muted-foreground">{record.user_email || 'N/A'}</TableCell>
                                                                        <TableCell className="text-sm">{record.user_dept || record.department || 'N/A'}</TableCell>
                                                                        <TableCell className="text-sm">{record.user_year || record.year || 'N/A'}</TableCell>

                                                                        {/* Status Column */}
                                                                        <TableCell>
                                                                            {isEditing ? (
                                                                                <Select
                                                                                    value={editedStatus}
                                                                                    onValueChange={setEditedStatus}
                                                                                >
                                                                                    <SelectTrigger className="w-32">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="present">Present</SelectItem>
                                                                                        <SelectItem value="absent">Absent</SelectItem>
                                                                                        <SelectItem value="late">Late</SelectItem>
                                                                                        <SelectItem value="permission">Permission</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            ) : (
                                                                                getBadge(record.status)
                                                                            )}
                                                                        </TableCell>

                                                                        {/* Notes Column - Read Only */}
                                                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                                                            <span title={record.notes}>{record.notes || '-'}</span>
                                                                        </TableCell>

                                                                        {/* Actions Column */}
                                                                        <TableCell className="text-right">
                                                                            <div className="flex gap-2 justify-end">
                                                                                {isEditing ? (
                                                                                    <>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            onClick={async () => {
                                                                                                try {
                                                                                                    await api.updateAttendance(record.id, {
                                                                                                        status: editedStatus
                                                                                                    });
                                                                                                    toast.success("Status updated!");

                                                                                                    // Update local state
                                                                                                    const updatedRecords = viewRecords.map(r =>
                                                                                                        r.id === record.id ? {
                                                                                                            ...r,
                                                                                                            status: editedStatus
                                                                                                        } : r
                                                                                                    );
                                                                                                    setViewRecords(updatedRecords);
                                                                                                    setEditingRecordId(null);
                                                                                                } catch (error) {
                                                                                                    toast.error("Failed to update status");
                                                                                                }
                                                                                            }}
                                                                                            className="bg-green-600 hover:bg-green-700 h-8"
                                                                                        >
                                                                                            Save
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="ghost"
                                                                                            onClick={() => {
                                                                                                setEditingRecordId(null);
                                                                                                setEditedStatus("");
                                                                                            }}
                                                                                            className="h-8"
                                                                                        >
                                                                                            Cancel
                                                                                        </Button>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => {
                                                                                                setEditingRecordId(record.id);
                                                                                                setEditedStatus(record.status || 'present');
                                                                                            }}
                                                                                            title="Edit Status"
                                                                                        >
                                                                                            <Edit className="w-4 h-4" />
                                                                                        </Button>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={async () => {
                                                                                                if (confirm('Delete this attendance record?')) {
                                                                                                    try {
                                                                                                        await api.deleteAttendance(record.id);
                                                                                                        toast.success("Record deleted!");
                                                                                                        const response = await api.getMeetingAttendance(viewMeetingId!);
                                                                                                        if (response.success) setViewRecords(response.records);
                                                                                                    } catch (error) {
                                                                                                        toast.error("Failed to delete record");
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            title="Delete Record"
                                                                                        >
                                                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                                                        </Button>
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
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
};

export default AttendanceMeetings;

