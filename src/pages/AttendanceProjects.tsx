
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Briefcase, Eye, Search, CheckCircle2, Clock, XCircle, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const AttendanceProjects = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const getLocalDate = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    // Mark Dialog State
    const [showMarkDialog, setShowMarkDialog] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [attendanceData, setAttendanceData] = useState<Record<number, string>>({});
    const [unsavedChanges, setUnsavedChanges] = useState<Record<number, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [dialogSearchQuery, setDialogSearchQuery] = useState("");
    const [itemStudents, setItemStudents] = useState<any[]>([]);

    const [searchParams] = useSearchParams();
    const projectIdParam = searchParams.get('projectId');
    const { permissions, loading: permissionsLoading } = usePermissions();

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        const user = auth.getUser();
        if (!permissionsLoading) {
            // Allow admin, attendance managers, or Office Bearers
            const canAccess = user?.role === 'admin' || user?.role === 'office_bearer' || permissions.can_manage_attendance;
            if (!canAccess) {
                toast.error("You don't have permission to access attendance management");
                navigate("/admin");
                return;
            }
            loadData();
        }
    }, [navigate, permissions, permissionsLoading]);

    const role = auth.getRole();
    const backPath = '/admin/attendance';

    useEffect(() => {
        if (projectIdParam && projects.length > 0) {
            const project = projects.find(p => p.id === parseInt(projectIdParam));
            if (project) {
                handleOpenMarkDialog(project);
            }
        }
    }, [projectIdParam, projects]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [projRes, attRes, studRes] = await Promise.all([
                api.getProjects(),
                api.getAttendance(),
                api.getStudentsScoped()
            ]);

            if (projRes.success) setProjects(projRes.projects || []);
            if (attRes.success) setAttendanceRecords(attRes.attendance || []);
            if (studRes.success) setStudents(studRes.students || []);
        } catch (error: any) {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.ngo_name && p.ngo_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge className="bg-green-600">Active</Badge>;
            case 'completed': return <Badge variant="secondary">Completed</Badge>;
            case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleOpenMarkDialog = (project: any) => {
        setSelectedProject(project);
        setSelectedDate(getLocalDate());
        setShowDatePicker(true);
    };

    const handleLoadAttendance = async () => {
        if (!selectedProject) return;
        setItemStudents([]); // Clear previous
        setAttendanceData({});
        setUnsavedChanges({});

        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                api.getProjectStudents(selectedProject.id),
                api.getProjectAttendance(selectedProject.id, selectedDate)
            ]);

            if (studentsRes.success && studentsRes.students) {
                setItemStudents(studentsRes.students);

                // If there's existing attendance for this date, pre-fill it
                if (attendanceRes.success && attendanceRes.records) {
                    const existingData: Record<number, string> = {};
                    attendanceRes.records.forEach((rec: any) => {
                        existingData[rec.user_id] = rec.status;
                    });
                    setAttendanceData(existingData);
                }
            } else {
                toast.error("No students assigned to this project.");
            }
            setShowDatePicker(false);
            setShowMarkDialog(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load project data");
        }
    };

    const handleMarkAttendanceClick = (studentId: number, status: string) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: status }));
        setUnsavedChanges(prev => ({ ...prev, [studentId]: status }));
    };

    const handleMarkAllPresent = () => {
        const newData = { ...attendanceData };
        const newChanges = { ...unsavedChanges };
        // Apply only to visible students in dialog
        const studentsToMark = itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase()));

        studentsToMark.forEach(s => {
            const id = s.user_id || s.id;
            newData[id] = 'present';
            newChanges[id] = 'present';
        });
        setAttendanceData(newData);
        setUnsavedChanges(newChanges);
        toast.success("Marked all as Present");
    };

    const handleSaveAttendance = async () => {
        if (!selectedProject || Object.keys(unsavedChanges).length === 0) return;
        setIsSaving(true);
        try {
            const savePromises = Object.entries(unsavedChanges).map(async ([studentId, status]) => {
                const userId = parseInt(studentId);
                // Ensure we pass snake_case keys as likely expected by backend
                // TypeScript interface in api.ts might complain if we pass 'user_id' but strict type expects 'userId'.
                // checking api.ts: markProjectAttendance(projectId, data)
                // We'll cast to any if needed or rely on api.ts fix.
                // Actually, let's fix api.ts to handle the mapping or expect keys.
                // Here we will pass `user_id` via type assertion if strictly typed, 
                // but checking api.ts it takes specific object structure.
                // We will assume api.ts needs fixing or we pass what api.ts expects and api.ts does the mapping.
                // If api.ts sends JSON.stringify(data), we effectively control the body.
                // We will use 'user_id' instead of 'userId' by casting.

                return api.markProjectAttendance(selectedProject.id, {
                    userId, // api.ts expects userId. We will modify api.ts to send user_id. 
                    attendance_date: selectedDate,
                    status,
                    notes: `Project: ${selectedProject.title}`
                });
            });
            await Promise.all(savePromises);
            toast.success("Attendance saved!");
            setUnsavedChanges({});
            setShowMarkDialog(false);
            loadData(); // Reload stats
        } catch (error: any) {
            toast.error("Failed to save: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <DeveloperCredit />
            <main className="flex-1 w-full bg-background overflow-x-hidden">
                <div className="w-full px-4 md:px-6 lg:px-8 py-8 space-y-8">
                    <div className="mb-6">
                        <BackButton to={backPath} />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div className="space-y-2">
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white flex items-center gap-3">
                                <div className="bg-primary/10 rounded-2xl p-2 md:p-2.5 shadow-inner shrink-0">
                                    <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary" />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2">
                                    Attendance Projects
                                </div>
                            </h1>
                            <p className="text-muted-foreground font-medium text-xs md:text-base border-l-4 border-primary/30 pl-3">
                                Mark and monitor volunteer project participation
                            </p>
                        </div>
                        <div className="relative w-full lg:w-80 group">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
                            <Input
                                placeholder="Search by project or NGO..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-2xl shadow-sm md:text-lg"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            <p className="mt-4 text-muted-foreground font-medium">Syncing project data...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-24 bg-muted/30 rounded-3xl border-2 border-dashed border-border/50">
                            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Briefcase className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-lg font-medium text-muted-foreground">No matching projects found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredProjects.map(project => {
                                const latestDate = project.last_activity ? new Date(project.last_activity) : null;
                                const present = project.present_count || 0;
                                const absent = project.absent_count || 0;
                                const permission = project.permission_count || 0;

                                return (
                                    <Card key={project.id} className="group relative border-border/40 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-primary/5">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <CardHeader className="pb-4 relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[10px]">
                                                    {project.ngo_name || 'Project'}
                                                </Badge>
                                                {getStatusBadge(project.status)}
                                            </div>
                                            <CardTitle className="text-2xl font-bold tracking-tight text-foreground line-clamp-1">{project.title}</CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                <Calendar className="w-3.5 h-3.5 opacity-50" />
                                                <span className="text-xs font-semibold">
                                                    {latestDate ? `Active: ${latestDate.toLocaleDateString('en-GB')}` : (project.start_date ? `Starts: ${new Date(project.start_date).toLocaleDateString('en-GB')}` : 'No Activity')}
                                                </span>
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 relative z-10">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-border/40 transition-colors group-hover:bg-green-50/50 dark:group-hover:bg-green-900/5 hover:border-green-200">
                                                    <div className="text-2xl font-black text-green-600">{present}</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Present</div>
                                                </div>
                                                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-border/40 transition-colors group-hover:bg-red-50/50 dark:group-hover:bg-red-900/5 hover:border-red-200">
                                                    <div className="text-2xl font-black text-red-600">{absent}</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Absent</div>
                                                </div>
                                                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-border/40 transition-colors group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/5 hover:border-blue-200">
                                                    <div className="text-2xl font-black text-blue-600">{permission}</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Perm</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <Button size="lg" variant="outline" className="flex-1 rounded-xl font-bold border-border/50 hover:bg-primary/5 transition-colors gap-2" onClick={() => navigate(`/admin/attendance/project/${project.id}`)}>
                                                    <Eye className="w-4 h-4" /> View
                                                </Button>
                                                <Button size="lg" className="flex-1 rounded-xl shadow-lg shadow-primary/25 font-bold gap-2" onClick={() => handleOpenMarkDialog(project)}>
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
                        <DialogContent className="max-w-sm rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Select Date</DialogTitle>
                                <DialogDescription className="font-medium">
                                    Marking attendance for <span className="text-primary">{selectedProject?.title}</span>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session Date</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                                        <Input
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="pl-10 h-12 rounded-xl border-border/50 font-medium"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Button size="lg" className="w-full rounded-xl font-bold h-12" onClick={handleLoadAttendance}>Load Students</Button>
                                    <Button size="lg" variant="ghost" className="w-full rounded-xl font-bold" onClick={() => setShowDatePicker(false)}>Cancel</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Mark Dialog - Mobile Optimized */}
                    <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-background sm:rounded-3xl">
                            <DialogHeader className="p-6 pb-4 border-b bg-card">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <DialogTitle className="text-2xl font-black truncate">{selectedProject?.title}</DialogTitle>
                                        <div className="flex items-center gap-2 mt-1 text-primary font-bold">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                        <Input
                                            placeholder="Find student..."
                                            value={dialogSearchQuery}
                                            onChange={(e) => setDialogSearchQuery(e.target.value)}
                                            className="pl-10 h-10 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="p-4 border-b bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                    {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).length} Students Loaded
                                </span>
                                <Button size="sm" onClick={handleMarkAllPresent} className="gap-2 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-md">
                                    <CheckCircle2 className="w-4 h-4" /> Mark All Present
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Info Indicator & Mark All (screenshot style) */}
                                <div className="hidden md:flex items-center justify-between gap-3 mb-8">
                                    <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex-1">
                                        <div className="bg-blue-500/10 p-1.5 rounded-lg">
                                            <Users className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                                            Manage attendance for {itemStudents.length} student(s) in this project.
                                        </span>
                                    </div>
                                </div>

                                {/* Desktop View: Table Layout (Filled Circles, No Email) */}
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
                                                            ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/30 text-white scale-105'
                                                            : 'bg-background border-border/40 text-slate-400 hover:border-green-400'}`}
                                                    >
                                                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Present</span>
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
                                                        onClick={() => handleMarkAttendanceClick(id, 'late')}
                                                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${status === 'late'
                                                            ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/30 text-white scale-105'
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
                                <Button size="lg" className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]" onClick={handleSaveAttendance} disabled={isSaving || Object.keys(unsavedChanges).length === 0}>
                                    {isSaving ? 'Syncing...' : 'Submit Attendance'}
                                </Button>
                                <Button size="lg" variant="ghost" className="rounded-2xl h-14 font-bold" onClick={() => setShowMarkDialog(false)}>Cancel</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
};

export default AttendanceProjects;
