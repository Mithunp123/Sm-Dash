
import { useState, useEffect } from "react";
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Eye, Search, Users, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const AttendanceEvents = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState<string | null>(null);

    const getLocalDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    // Mark Dialog State
    const [showMarkDialog, setShowMarkDialog] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
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
            const eventRes = await api.getEvents();
            if (eventRes.success) setEvents(eventRes.events || []);
        } catch (err: any) {
            setError(err?.message || String(err));
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = events.filter((event) => {
        // Filter out deleted/cancelled events if backend returns them
        if (event.status === 'deleted' || event.status === 'cancelled' || event.deleted_at) {
            return false;
        }
        const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const openDateViewer = (id: number) => {
        navigate(`/admin/attendance/event/${id}`);
    };

    const handleOpenMarkDialog = (event: any) => {
        setSelectedEvent(event);
        setSelectedDate(event.date ? event.date.split('T')[0] : getLocalDate());
        setShowDatePicker(true);
    };

    const handleLoadAttendance = async () => {
        if (!selectedEvent) return;
        setAttendanceData({});
        setUnsavedChanges({});
        setItemStudents([]);

        try {
            // Load event members
            const membersRes = await api.getEventMembers(selectedEvent.id);
            let students = [];
            if (membersRes.success && membersRes.members && membersRes.members.length > 0) {
                students = membersRes.members.map((m: any) => ({
                    id: m.user_id,
                    name: m.user_name,
                    email: m.user_email,
                }));
            } else {
                toast.error("No students assigned to this event. Please import students first.");
            }
            setItemStudents(students);

            // Load existing OD
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            const res = await fetch(
                `${API_BASE}/events/${selectedEvent.id}/od?date=${selectedDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${auth.getToken()}`
                    }
                }
            );
            const data = await res.json();
            const initialAttendance: Record<number, string> = {};
            if (data.success && data.records) {
                data.records.forEach((record: any) => {
                    initialAttendance[record.user_id] = record.status;
                });
            }
            setAttendanceData(initialAttendance);

            setShowDatePicker(false);
            setShowMarkDialog(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load event students/status");
        }
    };

    const handleMarkAttendanceClick = (studentId: number, status: string) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: status }));
        setUnsavedChanges(prev => ({ ...prev, [studentId]: status }));
    };

    const handleMarkAllOD = () => {
        const newData = { ...attendanceData };
        const newChanges = { ...unsavedChanges };
        const usersToMark = itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase()));

        usersToMark.forEach(s => {
            const id = s.user_id || s.id;
            newData[id] = 'od';
            newChanges[id] = 'od';
        });
        setAttendanceData(newData);
        setUnsavedChanges(newChanges);
        toast.success("Marked current view as OD");
    };

    const handleSaveAttendance = async () => {
        if (!selectedEvent || Object.keys(unsavedChanges).length === 0) return;
        setIsSaving(true);
        try {
            const results = await Promise.all(
                Object.entries(unsavedChanges).map(async ([studentId, status]) => {
                    const userId = parseInt(studentId);
                    return api.markEventOD(
                        selectedEvent.id,
                        userId,
                        status as 'od' | 'absent' | 'permission',
                        selectedDate // Pass the selected date
                    );
                })
            );

            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                const firstError = failures[0].message || failures[0].error || "Unknown server error";
                console.error("Failed to save some records:", failures);
                throw new Error(`${failures.length} failed: ${firstError}`);
            }

            toast.success("Event OD/Attendance saved!");
            setUnsavedChanges({});
            setShowMarkDialog(false);
            loadData();
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to save: " + error.message);
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
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                            Events Attendance
                        </h1>
                        <p className="text-muted-foreground">Track OD / permission status for events</p>
                    </div>
                </div>

                <Card className="border-border/50 shadow-md bg-card">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="text-center py-12">Loading events...</div>
                ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No events found</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEvents.map((event) => {
                            return (
                                <Card key={event.id} className="border-l-4 border-l-primary hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="mb-2">
                                                Year: {event.year}
                                            </Badge>
                                            {event.is_special_day ? (
                                                <Badge className="bg-amber-500">Special Day</Badge>
                                            ) : (
                                                <Badge variant="outline">Regular</Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-xl truncate" title={event.title}>{event.title}</CardTitle>
                                        <CardDescription>
                                            {event.date ? new Date(event.date).toLocaleDateString() : 'No Date'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-2 mb-4 mt-2">
                                            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-green-600">{event.od_count || 0}</div>
                                                <div className="text-xs text-muted-foreground">OD</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-red-600">{event.absent_count || 0}</div>
                                                <div className="text-xs text-muted-foreground">Absent</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-blue-600">{event.permission_count || 0}</div>
                                                <div className="text-xs text-muted-foreground">Perm</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Button className="flex-1" variant="outline" onClick={() => openDateViewer(event.id)}>
                                                <Eye className="w-4 h-4 mr-2" /> View
                                            </Button>
                                            <Button className="flex-1" onClick={() => handleOpenMarkDialog(event)}>
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
                                Choose date to mark attendance for {selectedEvent?.title}
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
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Mark OD/Status: {selectedEvent?.title}</DialogTitle>
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
                                <Button size="sm" onClick={handleMarkAllOD} className="gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Mark All OD
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
                                                            {/* OD Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'od')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'od'
                                                                    ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-green-400'
                                                                    }`}>
                                                                    {currentStatus === 'od' && (
                                                                        <CheckCircle2 className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">OD</span>
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
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'permission')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${currentStatus === 'permission'
                                                                    ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-blue-400'
                                                                    }`}>
                                                                    {currentStatus === 'permission' && (
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
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default AttendanceEvents;
