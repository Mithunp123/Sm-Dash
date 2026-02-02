
import { useState, useEffect } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Eye, CheckCircle2, Search, Filter, XCircle, Clock } from "lucide-react";
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

    const formatAttendanceCount = (count: number, total: number) => (total > 0 ? count : '—');

    const openDateViewer = (id: number, title?: string) => {
        navigate(`/admin/attendance/meeting/${id}`);
    };

    const handleOpenMarkDialog = (meeting: any) => {
        setSelectedMeeting(meeting);
        setSelectedDate(getLocalDate());
        setShowDatePicker(true);
    };

    const handleLoadAttendance = () => {
        if (!selectedMeeting) return;

        // Use all students for meetings
        setItemStudents(students);

        const initialAttendance: Record<number, string> = {};
        const meetingRecs = attendanceRecords.filter(r => r.meeting_id === selectedMeeting.id);
        meetingRecs.forEach(att => {
            const attDate = att.meeting_date || att.marked_at || att.created_at;
            if (attDate && attDate.startsWith(selectedDate)) {
                initialAttendance[att.user_id] = att.status;
            }
        });

        setAttendanceData(initialAttendance);
        setUnsavedChanges({});
        setShowDatePicker(false);
        setShowMarkDialog(true);
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

    return (
        <div className="min-h-screen flex flex-col bg-background p-4">
            <DeveloperCredit />
            <div className="w-full max-w-7xl mx-auto space-y-6">
                <div className="mb-4">
                    <BackButton to="/admin/attendance" />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <div className="bg-primary/10 rounded-lg p-2">
                                <Calendar className="w-6 h-6 text-primary" />
                            </div>
                            Meetings Attendance
                        </h1>
                        <p className="text-muted-foreground">Manage attendance for all meetings</p>
                    </div>
                </div>

                <Card className="border-border/50 shadow-md bg-card">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Search meetings..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-40">
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

                {loading ? (
                    <div className="text-center py-12">Loading meetings...</div>
                ) : filteredMeetings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No meetings found</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMeetings.map((meeting) => {
                            const meetingAttendance = attendanceRecords.filter(r =>
                                (r.meeting_id === meeting.id) || (r.meetingId === meeting.id)
                            );

                            // Find latest attendance date
                            const dates = meetingAttendance.map(r => {
                                // Prioritize the actual marked attendance date
                                // We purposefully exclude r.meeting_date to avoid showing the scheduled date as 'Last Activity'
                                const d = r.attendance_date || r.marked_at || r.created_at;
                                return d ? new Date(d).getTime() : 0;
                            }).filter(d => d > 0);
                            const latestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
                            const latestDateStr = latestDate ? latestDate.toISOString().split('T')[0] : '';

                            // Filter records for latest date
                            const recentRecs = latestDateStr ? meetingAttendance.filter(r => {
                                const d = r.attendance_date || r.marked_at || r.created_at;
                                return d && d.startsWith(latestDateStr);
                            }) : [];

                            const presentCount = recentRecs.filter(r => r.status === 'present').length;
                            const absentCount = recentRecs.filter(r => r.status === 'absent').length;
                            const permissionCount = recentRecs.filter(r => r.status === 'late').length;

                            return (
                                <Card key={meeting.id} className="border-l-4 border-l-primary hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="mb-2 max-w-[150px] truncate" title={meeting.location || 'No Location'}>
                                                {meeting.location || 'No Location'}
                                            </Badge>
                                            {getStatusBadge(meeting.status)}
                                        </div>
                                        <CardTitle className="text-xl truncate" title={meeting.title}>{meeting.title}</CardTitle>
                                        <CardDescription>
                                            {latestDate ? `Last Activity: ${latestDate.toLocaleDateString('en-GB')}` : (meeting.date ? new Date(meeting.date).toLocaleString('en-GB') : 'No Date')}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-2 mb-4 mt-2">
                                            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-green-600">{presentCount}</div>
                                                <div className="text-xs text-muted-foreground">Present</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-red-600">{absentCount}</div>
                                                <div className="text-xs text-muted-foreground">Absent</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-blue-600">{permissionCount}</div>
                                                <div className="text-xs text-muted-foreground">Permission</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Button className="flex-1" variant="outline" onClick={() => openDateViewer(meeting.id, meeting.title)}>
                                                <Eye className="w-4 h-4 mr-2" /> View
                                            </Button>
                                            <Button className="flex-1" onClick={() => handleOpenMarkDialog(meeting)}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark
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
                            <div className="flex justify-between items-center">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <Input
                                        placeholder="Search student..."
                                        value={dialogSearchQuery}
                                        onChange={(e) => setDialogSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-muted p-2 rounded">
                                <span>Marking for {itemStudents.length} students</span>
                                <Button size="sm" onClick={handleMarkAllPresent} className="gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Mark View Present
                                </Button>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).map(student => {
                                            const id = student.user_id || student.id;
                                            const currentStatus = attendanceData[id] || '';
                                            return (
                                                <TableRow key={id}>
                                                    <TableCell className="font-medium">
                                                        <div>{student.name}</div>
                                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-4 items-center">
                                                            {/* Present Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'present')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'present'
                                                                    ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-green-400'
                                                                    }`}>
                                                                    {currentStatus === 'present' && (
                                                                        <CheckCircle2 className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Present</span>
                                                            </div>

                                                            {/* Absent Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'absent')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'absent'
                                                                    ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-red-400'
                                                                    }`}>
                                                                    {currentStatus === 'absent' && (
                                                                        <XCircle className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Absent</span>
                                                            </div>

                                                            {/* Permission Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'late')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'late'
                                                                    ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-blue-400'
                                                                    }`}>
                                                                    {currentStatus === 'late' && (
                                                                        <Clock className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Permission</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowMarkDialog(false)}>Cancel</Button>
                                <Button onClick={handleSaveAttendance} disabled={isSaving || Object.keys(unsavedChanges).length === 0}>
                                    {isSaving ? 'Saving...' : 'Save Attendance'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default AttendanceMeetings;
