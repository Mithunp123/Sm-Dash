
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eye, Edit, Calendar, Briefcase, Users, ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";

interface AttendanceRecord {
    id: number;
    user_id: number;
    user_name: string;
    user_dept?: string;
    user_year?: string;
    status: string;
    notes?: string;
    attendance_date: string;
    marked_at?: string;
}

interface DateInfo {
    date: string;
    count: number;
}

const AttendanceDetails = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const navigate = useNavigate();

    const [title, setTitle] = useState("Attendance Details");
    const [savedDates, setSavedDates] = useState<DateInfo[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingDates, setLoadingDates] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "late" | "excused">("all");

    // Modal states (kept as modals for small interactions)
    const [viewFullOpen, setViewFullOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<AttendanceRecord | null>(null);
    const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [markingAll, setMarkingAll] = useState(false);

    useEffect(() => {
        if (type && id) {
            loadInfo();
            loadSavedDates();
        }
    }, [type, id]);

    useEffect(() => {
        if (selectedDate) {
            loadAttendanceForDate(selectedDate);
        } else {
            setAttendanceRecords([]);
        }
    }, [selectedDate]);


    const filteredRecords = attendanceRecords.filter(record => {
        const matchesSearch = record.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (record.user_dept && record.user_dept.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (record.user_year && record.user_year.toLowerCase().includes(searchQuery.toLowerCase()));

        if (statusFilter === "all") return matchesSearch;
        return matchesSearch && record.status.toLowerCase() === statusFilter;
    });

    const counts = {
        present: attendanceRecords.filter(r => r.status.toLowerCase() === 'present').length,
        absent: attendanceRecords.filter(r => r.status.toLowerCase() === 'absent').length,
        late: attendanceRecords.filter(r => r.status.toLowerCase() === 'late').length,
        excused: attendanceRecords.filter(r => ['excused', 'permission'].includes(r.status.toLowerCase())).length,
        total: attendanceRecords.length
    };

    const handleMarkAllPresent = async () => {
        if (!selectedDate || filteredRecords.length === 0) return;
        if (!confirm(`Mark ${filteredRecords.length} students as 'Present'?`)) return;

        setMarkingAll(true);
        try {
            const updates = filteredRecords
                .filter(r => r.status.toLowerCase() !== 'present')
                .map(async (record) => {
                    let response;
                    if (type === 'project') {
                        response = await api.updateProjectAttendance(record.id, { status: 'present' });
                    } else if (type === 'meeting') {
                        response = await api.updateAttendance(record.id, { status: 'present' });
                    } else if (type === 'event') {
                        response = await api.markEventAttendance(Number(id), { userId: record.user_id, status: 'present' });
                    }
                    return response;
                });

            await Promise.all(updates);
            toast.success("Marked all as present");
            loadAttendanceForDate(selectedDate);
        } catch (e) {
            console.error(e);
            toast.error("Failed to update some records");
        } finally {
            setMarkingAll(false);
        }
    };

    const loadInfo = async () => {
        try {
            let fetchedTitle = "Attendance Details";

            if (type === 'project') {
                const res = await api.getProjects(); // Optimally should use getProject(id) if available, but this works for now or we can assume title is passed?
                // Actually, fetching all projects just to get title is wasteful but acceptable given current API structure shown in ManageAttendance
                // Better: Fetch project specific details if possible.
                // Let's rely on the lists we can fetch or simple ID for now,
                // but to get the title properly, we might need a specific endpoint or just leave it generic until loaded.

                // Let's try to get details based on the API patterns
                // If there isn't a direct "getProject(id)" we might have to live with generic title
                // or fetch the list.
                // Let's try to fetch the list and find it.
                if (res.success && res.projects) {
                    const p = res.projects.find((p: any) => p.id === Number(id));
                    if (p) fetchedTitle = p.title;
                }
            } else if (type === 'meeting') {
                const res = await api.getMeetings();
                if (res.success && res.meetings) {
                    const m = res.meetings.find((m: any) => m.id === Number(id));
                    if (m) fetchedTitle = m.title;
                }
            } else if (type === 'event') {
                const res = await api.getEvents();
                if (res.success && res.events) {
                    const e = res.events.find((e: any) => e.id === Number(id));
                    if (e) fetchedTitle = e.title;
                }
            }

            setTitle(fetchedTitle);
        } catch (e) {
            console.error("Failed to load info", e);
        }
    };

    const loadSavedDates = async () => {
        setLoadingDates(true);
        try {
            let response;
            if (type === 'project') {
                response = await api.get(`/attendance/project/${id}/dates`);
            } else if (type === 'meeting') {
                response = await api.get(`/attendance/meeting/${id}/dates`);
            } else if (type === 'event') {
                response = await api.get(`/attendance/event/${id}/dates`);
            } else {
                setLoadingDates(false);
                return;
            }

            if (response.success && response.dates) {
                // Filter and normalize dates to YYYY-MM-DD
                const validDates = response.dates.map((d: any) => {
                    if (!d.date) return null;
                    const dt = d.date.includes('T') ? new Date(d.date) : new Date(d.date + "T00:00:00");
                    if (isNaN(dt.getTime())) return null;

                    // Normalize to YYYY-MM-DD
                    const normalized = dt.toISOString().split('T')[0];
                    return { ...d, date: normalized };
                }).filter(Boolean);

                setSavedDates(validDates);
                if (validDates.length > 0 && !selectedDate) {
                    setSelectedDate(validDates[0].date);
                }
            }
        } catch (error: any) {
            console.error("Error loading dates:", error);
            toast.error("Failed to load saved dates");
        } finally {
            setLoadingDates(false);
        }
    };

    const loadAttendanceForDate = async (date: string) => {
        setLoading(true);
        try {
            let response;
            if (type === 'project') {
                response = await api.get(`/attendance/project/${id}/records?date=${date}`);
            } else if (type === 'meeting') {
                response = await api.get(`/attendance/meeting/${id}/records?date=${date}`);
            } else if (type === 'event') {
                response = await api.get(`/attendance/event/${id}/records?date=${date}`);
            } else {
                setLoading(false);
                return;
            }

            if (response.success && response.records) {
                setAttendanceRecords(response.records);
            } else {
                setAttendanceRecords([]);
            }
        } catch (error: any) {
            console.error("Error loading attendance:", error);
            toast.error("Failed to load attendance records");
            setAttendanceRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (!selectedDate || attendanceRecords.length === 0) {
            toast.error("No data to export");
            return;
        }

        try {
            const excelData = filteredRecords.map((record) => ({ // Export filtered records
                Name: record.user_name,
                Department: record.user_dept || "N/A",
                Year: record.user_year || "N/A",
                Status: record.status.charAt(0).toUpperCase() + record.status.slice(1),
                Notes: record.notes || "",
                "Attendance Date": new Date(record.attendance_date + "T00:00:00").toLocaleDateString(),
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");

            const dateStr = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).replace(/\//g, "-");
            const filename = `Attendance_${title.replace(/\s+/g, "_")}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
            toast.success("Excel file downloaded successfully");
        } catch (error: any) {
            console.error("Error exporting to Excel:", error);
            toast.error("Failed to export Excel file");
        }
    };

    const handleEditRecord = (record: AttendanceRecord) => {
        setEditRecord(record);
        setShowEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!editRecord || !selectedDate) return;
        setSavingEdit(true);
        try {
            let response;
            if (type === 'project') {
                response = await api.updateProjectAttendance(editRecord.id, {
                    status: editRecord.status,
                    notes: editRecord.notes,
                });
            } else if (type === 'meeting') {
                response = await api.updateAttendance(editRecord.id, {
                    status: editRecord.status,
                    notes: editRecord.notes,
                });
            } else if (type === 'event') {
                response = await api.markEventAttendance(Number(id), {
                    userId: editRecord.user_id,
                    status: editRecord.status,
                    notes: editRecord.notes,
                });
            }

            if (response && response.success === false) {
                toast.error(response.message || "Failed to update attendance");
            } else {
                toast.success("Attendance updated successfully");
                setShowEditDialog(false);
                setEditRecord(null);
                await loadAttendanceForDate(selectedDate);
            }
        } catch (error: any) {
            console.error("Error updating attendance:", error);
            toast.error("Failed to update attendance");
        } finally {
            setSavingEdit(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusLower = status.toLowerCase();
        if (statusLower === "present") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Present</Badge>;
        if (statusLower === "absent") return <Badge variant="destructive">Absent</Badge>;
        if (statusLower === "late") return <Badge className="bg-amber-600 hover:bg-amber-700">Late</Badge>;
        if (statusLower === "excused" || statusLower === "permission") return <Badge className="bg-blue-600 hover:bg-blue-700">Excused</Badge>;
        return <Badge variant="outline">{status}</Badge>;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === "Invalid Date") return "Invalid Date";
        try {
            const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
            if (isNaN(date.getTime())) return "Invalid Date";
            return date.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        } catch (e) {
            return "Invalid Date";
        }
    };

    const getIcon = () => {
        if (type === 'project') return <Briefcase className="w-6 h-6 text-primary" />;
        if (type === 'meeting') return <Calendar className="w-6 h-6 text-primary" />;
        return <Users className="w-6 h-6 text-primary" />;
    };

    const StatusFilterButton = ({ status, label, count, colorClass }: { status: string, label: string, count: number, colorClass: string }) => (
        <button
            onClick={() => setStatusFilter(status as any)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === status
                ? `${colorClass} ring-2 ring-offset-2 ring-offset-background`
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
        >
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${statusFilter === status ? "bg-background/20" : "bg-background/50"}`}>
                {count}
            </span>
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-2 md:p-4 w-full">
                {/* Back Button */}
                <div className="mb-4">
                    <BackButton to="/admin/attendance" />
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-2xl p-3 shadow-inner">
                            {getIcon()}
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight line-clamp-1">{title}</h1>
                            <p className="text-muted-foreground font-medium text-xs md:text-sm border-l-4 border-primary/30 pl-3">Attendance management and records</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Button
                            onClick={handleMarkAllPresent}
                            disabled={!selectedDate || filteredRecords.length === 0 || markingAll}
                            className="h-11 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all gap-2 flex-1 sm:flex-none"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {markingAll ? "Marking..." : "Mark All Present"}
                        </Button>
                        <Button
                            onClick={handleDownloadExcel}
                            disabled={!selectedDate || attendanceRecords.length === 0}
                            className="h-11 rounded-xl bg-white border-2 border-border/50 hover:bg-muted font-bold transition-all gap-2 flex-1 sm:flex-none"
                            variant="outline"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </Button>
                    </div>
                </div>

                {/* Filters and Summary */}
                {selectedDate && (
                    <div className="mb-8 flex flex-wrap gap-2 items-center bg-card/40 p-2 rounded-2xl border border-border/40 backdrop-blur-sm">
                        <StatusFilterButton status="all" label="All" count={counts.total} colorClass="bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20" />
                        <StatusFilterButton status="present" label="Present" count={counts.present} colorClass="bg-green-500 text-foreground font-bold shadow-lg shadow-green-500/20" />
                        <StatusFilterButton status="absent" label="Absent" count={counts.absent} colorClass="bg-red-500 text-foreground font-bold shadow-lg shadow-red-500/20" />
                        <StatusFilterButton status="late" label="Late" count={counts.late} colorClass="bg-amber-500 text-foreground font-bold shadow-lg shadow-amber-500/20" />
                        <StatusFilterButton status="excused" label="Excused" count={counts.excused} colorClass="bg-blue-500 text-foreground font-bold shadow-lg shadow-blue-500/20" />
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
                    {/* Sidebar - Saved Dates */}
                    <Card className="w-full lg:w-72 h-auto lg:h-full flex flex-col border-border/40 bg-card/60 backdrop-blur-md overflow-hidden rounded-3xl shadow-xl">
                        <div className="p-4 border-b border-border/40 bg-muted/20">
                            <h3 className="font-black text-foreground uppercase tracking-widest text-xs flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                Review Sessions
                            </h3>
                        </div>
                        <CardContent className="flex-1 overflow-y-auto lg:overflow-y-auto p-2 lg:space-y-2 flex lg:block gap-2 overflow-x-auto no-scrollbar">
                            {loadingDates ? (
                                <div className="text-center text-sm text-muted-foreground py-8 w-full group">
                                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
                                    Syncing dates...
                                </div>
                            ) : savedDates.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-8 w-full">No records found</div>
                            ) : (
                                savedDates.filter(d => d.date && d.date !== 'Invalid Date').map((dateInfo) => (
                                    <button
                                        key={dateInfo.date}
                                        onClick={() => setSelectedDate(dateInfo.date)}
                                        className={`shrink-0 lg:w-full text-left px-4 py-3 rounded-2xl transition-all border-2 ${selectedDate === dateInfo.date
                                            ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
                                            : "bg-background border-border/50 hover:border-primary/30 text-foreground"
                                            }`}
                                    >
                                        <div className="font-bold whitespace-nowrap lg:whitespace-normal">{formatDate(dateInfo.date)}</div>
                                        <div className={`text-[10px] uppercase font-black tracking-widest mt-1 ${selectedDate === dateInfo.date ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                            {dateInfo.count} Records
                                        </div>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Main Content - Table */}
                    <Card className="flex-1 h-full flex flex-col border-border/40 bg-card/60 backdrop-blur-md overflow-hidden rounded-3xl shadow-xl">
                        <div className="p-4 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-black text-foreground uppercase tracking-widest text-xs">
                                {selectedDate ? formatDate(selectedDate) : 'Select Session'}
                            </h3>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by student name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-11 bg-background/50 border-border/50 rounded-xl focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>
                        <CardContent className="flex-1 overflow-auto p-0">
                            {!selectedDate ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-4">
                                    <div className="bg-muted p-6 rounded-full">
                                        <Calendar className="w-12 h-12 opacity-20" />
                                    </div>
                                    <p className="font-bold text-lg">Pick a Session</p>
                                    <p className="text-sm max-w-[200px] text-center">Select a date from the list to review specific records.</p>
                                </div>
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-4">
                                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                    <p className="font-bold">Syncing Records...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Table for Desktop */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent bg-muted/30">
                                                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Student Details</TableHead>
                                                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Dept / Year</TableHead>
                                                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Status</TableHead>
                                                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Notes</TableHead>
                                                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] pr-6">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredRecords.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold">No students found matching your filters.</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredRecords.map((record) => (
                                                        <TableRow key={record.id} className="hover:bg-muted/50 border-border/40">
                                                            <TableCell className="font-bold py-4">
                                                                <div className="pl-2">{record.user_name}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="font-bold border-border/50 text-[10px]">{record.user_dept || "—"}</Badge>
                                                                    <Badge variant="outline" className="font-bold border-border/50 text-[10px]">{record.user_year || "—"}</Badge>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(record.status)}</TableCell>
                                                            <TableCell className="text-xs font-medium text-muted-foreground max-w-xs truncate">
                                                                {record.notes || "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => handleEditRecord(record)}
                                                                    className="h-10 w-10 text-blue-500 hover:bg-blue-50 rounded-xl"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Cards for Mobile */}
                                    <div className="md:hidden p-4 space-y-4">
                                        {filteredRecords.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground font-bold">No students found.</div>
                                        ) : (
                                            filteredRecords.map((record) => (
                                                <div key={record.id} className="bg-background/80 border-2 border-border/40 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h4 className="font-bold text-foreground leading-tight">{record.user_name}</h4>
                                                            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-black tracking-widest">{record.user_dept} • {record.user_year}</p>
                                                        </div>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleEditRecord(record)}
                                                            className="h-10 w-10 text-blue-500 bg-blue-50 rounded-xl"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                                                        {getStatusBadge(record.status)}
                                                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{record.notes || "No notes"}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main >

            {/* Edit Dialog */}
            < Dialog open={showEditDialog} onOpenChange={(open) => !open && setShowEditDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Attendance</DialogTitle>
                        <DialogDescription>Change status for {editRecord?.user_name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={editRecord?.status}
                                onValueChange={(val) => setEditRecord(prev => prev ? ({ ...prev, status: val }) : null)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="late">Late (Permission)</SelectItem>
                                    <SelectItem value="excused">Excused</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input
                                value={editRecord?.notes || ""}
                                onChange={(e) => setEditRecord(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                                placeholder="Add reasoning..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >


        </div >
    );
};

export default AttendanceDetails;
