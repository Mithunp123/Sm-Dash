
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
            // Load event members and existing records
            const [membersRes, odRes] = await Promise.all([
                api.getEventMembers(selectedEvent.id),
                fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/events/${selectedEvent.id}/od?date=${selectedDate}`, {
                    headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                }).then(r => r.json())
            ]);

            if (membersRes.success && membersRes.members) {
                // The members endpoint might return user_name, user_email etc.
                // We want to ensure we have dept and year if possible.
                // If membersRes.members doesn't have dept/year, we might need a separate call or handle it.
                setItemStudents(membersRes.members);
            } else {
                toast.error("No students assigned to this event.");
            }

            if (odRes.success && odRes.records) {
                const initialAttendance: Record<number, string> = {};
                odRes.records.forEach((record: any) => {
                    initialAttendance[record.user_id] = record.status;
                });
                setAttendanceData(initialAttendance);
            }

            setShowDatePicker(false);
            setShowMarkDialog(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load event data");
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
        <div className="min-h-screen flex flex-col">
            <DeveloperCredit />
            <main className="flex-1 w-full bg-background overflow-x-hidden">
                <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 w-full space-y-6">
                    <div className="mb-6">
                        <BackButton to="/admin/attendance" />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
                                <div className="bg-primary/10 rounded-2xl p-2 md:p-2.5 shadow-inner shrink-0">
                                    <Users className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary" />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2">
                                    Events <span className="text-primary italic">Attendance</span>
                                </div>
                            </h1>
                            <p className="text-muted-foreground font-medium text-xs md:text-base border-l-4 border-primary/30 pl-3">
                                Track volunteer OD and permission status for events
                            </p>
                        </div>
                    </div>

                    <Card className="border-border/40 shadow-xl bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                    <Input
                                        placeholder="Search by event title..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-12 h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-2xl shadow-sm md:text-lg"
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredEvents.map((event) => {
                                return (
                                    <Card key={event.id} className="relative overflow-hidden group border-2 border-border/40 hover:border-primary/40 rounded-3xl shadow-xl transition-all duration-300 active:scale-[0.98]">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                                        <CardHeader className="pb-4 px-6 pt-6">
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline" className="px-2 py-0.5 rounded-lg border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest">
                                                    Year: {event.year}
                                                </Badge>
                                                {event.is_special_day ? (
                                                    <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-bold px-3 py-1 rounded-full uppercase text-[10px] tracking-widest flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></div>
                                                        Special Day
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="px-2 py-0.5 rounded-lg border-border/50 text-[10px] font-black uppercase tracking-widest">Regular</Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-2xl font-black uppercase tracking-tight line-clamp-1" title={event.title}>{event.title}</CardTitle>
                                            <CardDescription className="flex items-center gap-2 font-bold text-xs mt-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {event.date ? new Date(event.date).toLocaleDateString() : 'No Date'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-6 pb-6">
                                            <div className="grid grid-cols-3 gap-3 mb-6 bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex flex-col items-center">
                                                    <div className="text-2xl font-black text-green-500">{event.od_count || 0}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">OD</div>
                                                </div>
                                                <div className="flex flex-col items-center border-x border-border/50 px-2">
                                                    <div className="text-2xl font-black text-red-500">{event.absent_count || 0}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Absent</div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="text-2xl font-black text-blue-500">{event.permission_count || 0}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Perm</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <Button className="flex-1 h-11 rounded-xl bg-background border-2 border-border/50 hover:bg-muted font-bold transition-all gap-2" variant="outline" onClick={() => openDateViewer(event.id)}>
                                                    <Eye className="w-4 h-4" /> View
                                                </Button>
                                                <Button className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all gap-2" onClick={() => handleOpenMarkDialog(event)}>
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
                                <div className="p-4 border-b bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                        {itemStudents.filter(s => (s.name || s.user_name).toLowerCase().includes(dialogSearchQuery.toLowerCase())).length} Students Loaded
                                    </span>
                                    <Button size="sm" onClick={handleMarkAllOD} className="gap-2 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-md">
                                        <CheckCircle2 className="w-4 h-4" /> Mark All OD
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Info Indicator */}
                                    <div className="hidden md:flex items-center justify-between gap-3 mb-8">
                                        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex-1">
                                            <div className="bg-blue-500/10 p-1.5 rounded-lg">
                                                <Users className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                                                Track OD status for {itemStudents.length} student(s) in this event.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desktop View: Table Layout */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[11px] font-bold text-slate-400/80 uppercase tracking-tight-[0.2em] border-b border-white/5">
                                                    <th className="pb-5 px-2">S.No</th>
                                                    <th className="pb-5 px-2">Name</th>
                                                    <th className="pb-5 px-2">Department</th>
                                                    <th className="pb-5 px-2">Year</th>
                                                    <th className="pb-5 px-2 text-center w-[320px]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {itemStudents.filter(s => (s.name || s.user_name).toLowerCase().includes(dialogSearchQuery.toLowerCase())).map((student, index) => {
                                                    const id = student.user_id || student.id;
                                                    const status = attendanceData[id] || '';
                                                    return (
                                                        <tr key={id} className="group hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-6 px-2 text-sm font-medium text-slate-500">{index + 1}</td>
                                                            <td className="py-6 px-2">
                                                                <h4 className="font-bold text-foreground uppercase tracking-tight text-sm">{student.name || student.user_name}</h4>
                                                            </td>
                                                            <td className="py-6 px-2 text-xs font-semibold text-slate-500 uppercase">{student.dept || student.department || student.user_dept || 'N/A'}</td>
                                                            <td className="py-6 px-2 text-xs font-semibold text-slate-500 uppercase">{student.year || student.user_year || 'N/A'}</td>
                                                            <td className="py-6 px-2">
                                                                <div className="flex justify-center items-center gap-6">
                                                                    {[
                                                                        { id: 'od', label: 'Present', color: 'green', icon: CheckCircle2 },
                                                                        { id: 'absent', label: 'Absent', color: 'red', icon: XCircle },
                                                                        { id: 'permission', label: 'Permission', color: 'blue', icon: Clock }
                                                                    ].map(btn => (
                                                                        <div key={btn.id} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                                                                            <button
                                                                                onClick={() => handleMarkAttendanceClick(id, btn.id)}
                                                                                className={`h-11 w-11 rounded-full border-[2.5px] transition-all duration-300 flex items-center justify-center ${status === btn.id
                                                                                    ? `bg-${btn.color}-500 border-${btn.color}-600 shadow-lg shadow-${btn.color}-500/40 scale-110 text-white`
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
                                    {/* Mobile Cards View */}
                                    <div className="grid grid-cols-1 md:hidden gap-3 px-1">
                                        {itemStudents.filter(s => (s.name || s.user_name).toLowerCase().includes(dialogSearchQuery.toLowerCase())).map(student => {
                                            const id = student.user_id || student.id;
                                            const status = attendanceData[id] || '';
                                            return (
                                                <div key={id} className={`p-6 rounded-3xl border-2 transition-all duration-300 ${status ? 'border-primary/30 bg-primary/5 shadow-xl shadow-primary/10' : 'border-border/40 bg-card shadow-md'}`}>
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="space-y-1">
                                                            <h4 className="font-black text-foreground uppercase tracking-tight text-lg leading-none">{student.name || student.user_name}</h4>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] italic truncate max-w-[180px]">{student.email || student.user_email}</p>
                                                        </div>
                                                        <div className={`h-4 w-4 rounded-full shadow-inner ${status === 'od' ? 'bg-green-500 shadow-green-500/50' :
                                                            status === 'absent' ? 'bg-red-500 shadow-red-500/50' :
                                                                status === 'permission' ? 'bg-blue-500 shadow-blue-500/50' :
                                                                    'bg-slate-200'
                                                            }`}></div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-3">
                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'od')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'od'
                                                                ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/30 text-white scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-green-400'}`}
                                                        >
                                                            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-center">Mark OD</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'absent')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'absent'
                                                                ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/30 text-white scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-red-400'}`}
                                                        >
                                                            <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Absent</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleMarkAttendanceClick(id, 'permission')}
                                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'permission'
                                                                ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/30 text-white scale-105'
                                                                : 'bg-background border-border/40 text-slate-400 hover:border-red-400'}`}
                                                        >
                                                            <Clock className="w-5 h-5 md:w-6 md:h-6" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Perm</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-6 border-t bg-background flex flex-col sm:flex-row justify-end gap-3 sm:rounded-b-3xl">
                                    <Button onClick={handleSaveAttendance} disabled={isSaving || Object.keys(unsavedChanges).length === 0} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all gap-2">
                                        {isSaving ? 'Syncing Records...' : 'Save Changes'}
                                    </Button>
                                    <Button variant="ghost" className="h-11 font-bold rounded-xl px-8" onClick={() => setShowMarkDialog(false)}>Cancel</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div >
            </main >
        </div >
    );
};

export default AttendanceEvents;
