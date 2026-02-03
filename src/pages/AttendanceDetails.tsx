
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
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-xl p-3">
                            {getIcon()}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                            <p className="text-muted-foreground">Attendance management and records</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleMarkAllPresent}
                            disabled={!selectedDate || filteredRecords.length === 0 || markingAll}
                            className="gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {markingAll ? "Marking..." : "Mark All Present"}
                        </Button>
                        <Button
                            onClick={handleDownloadExcel}
                            disabled={!selectedDate || attendanceRecords.length === 0}
                            className="gap-2"
                            variant="outline"
                        >
                            <Download className="w-4 h-4" />
                            Export Excel
                        </Button>
                    </div>
                </div>

                {/* Filters and Summary */}
                {selectedDate && (
                    <div className="mb-6 flex flex-wrap gap-2 items-center">
                        <StatusFilterButton status="all" label="All" count={counts.total} colorClass="bg-primary text-primary-foreground ring-primary" />
                        <StatusFilterButton status="present" label="Present" count={counts.present} colorClass="bg-emerald-600 text-white ring-emerald-600" />
                        <StatusFilterButton status="absent" label="Absent" count={counts.absent} colorClass="bg-destructive text-white ring-destructive" />
                        <StatusFilterButton status="late" label="Late" count={counts.late} colorClass="bg-amber-600 text-white ring-amber-600" />
                        <StatusFilterButton status="excused" label="Excused" count={counts.excused} colorClass="bg-blue-600 text-white ring-blue-600" />
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
                    {/* Sidebar - Saved Dates */}
                    <Card className="w-full lg:w-72 h-full flex flex-col border-border/50 bg-card overflow-hidden">
                        <div className="p-4 border-b border-border/50 bg-muted/30">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Saved Dates
                            </h3>
                        </div>
                        <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
                            {loadingDates ? (
                                <div className="text-center text-sm text-muted-foreground py-8">Loading dates...</div>
                            ) : savedDates.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-8">No records found</div>
                            ) : (
                                savedDates.filter(d => d.date && d.date !== 'Invalid Date').map((dateInfo) => (
                                    <button
                                        key={dateInfo.date}
                                        onClick={() => setSelectedDate(dateInfo.date)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${selectedDate === dateInfo.date
                                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                                            : "bg-card hover:bg-muted border-transparent hover:border-border text-foreground"
                                            }`}
                                    >
                                        <div className="font-medium">{formatDate(dateInfo.date)}</div>
                                        <div className={`text-xs mt-1 ${selectedDate === dateInfo.date ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                            {dateInfo.count} {dateInfo.count === 1 ? "record" : "records"}
                                        </div>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Main Content - Table */}
                    <Card className="flex-1 h-full flex flex-col border-border/50 bg-card overflow-hidden">
                        <div className="p-4 border-b border-border/50 bg-muted/30 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-semibold text-foreground whitespace-nowrap">
                                {selectedDate ? `Records for ${formatDate(selectedDate)}` : 'Select a date from sidebar'}
                            </h3>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search student..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 bg-background"
                                    />
                                </div>
                                {filteredRecords.length > 0 && (
                                    <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">
                                        Total: {filteredRecords.length}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <CardContent className="flex-1 overflow-auto p-0">
                            {!selectedDate ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                    <Calendar className="w-12 h-12 opacity-20" />
                                    <p>Select a date to view attendance</p>
                                </div>
                            ) : loading ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <p>Loading records...</p>
                                </div>
                            ) : filteredRecords.length === 0 && searchQuery ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                    <Users className="w-12 h-12 opacity-20" />
                                    <p>No students found matching your search</p>
                                </div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                    <Users className="w-12 h-12 opacity-20" />
                                    <p>No attendance records found for this date</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent bg-muted/30">
                                            <TableHead className="font-semibold">Student Name</TableHead>
                                            <TableHead className="font-semibold">Department</TableHead>
                                            <TableHead className="font-semibold">Year</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold">Notes</TableHead>
                                            <TableHead className="text-right font-semibold">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-muted/50">
                                                <TableCell className="font-medium text-foreground">
                                                    {record.user_name}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {record.user_dept || "—"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {record.user_year || "—"}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                                    {record.notes || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleEditRecord(record)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Edit className="w-4 h-4" />
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
