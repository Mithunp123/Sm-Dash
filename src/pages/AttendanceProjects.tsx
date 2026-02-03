
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
import { Calendar, Briefcase, Eye, Search, CheckCircle2, Clock, XCircle } from "lucide-react";
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
            const res = await api.getProjectStudents(selectedProject.id);
            if (res.success && res.students) {
                setItemStudents(res.students);
            } else {
                toast.error("No students assigned to this project.");
            }
            setShowDatePicker(false);
            setShowMarkDialog(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load project students");
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
        <div className="min-h-screen flex flex-col w-full bg-background p-4">
            <DeveloperCredit />
            <div className="w-full px-4 md:px-6 lg:px-8 space-y-6">
                <div className="mb-4">
                    <BackButton to={backPath} />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Projects Attendance</h1>
                        <p className="text-muted-foreground">Manage attendance for all active projects</p>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12">Loading projects...</div>
                ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No projects found</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map(project => {
                            // Use stats from backend
                            const latestDate = project.last_activity ? new Date(project.last_activity) : null;
                            const present = project.present_count || 0;
                            const absent = project.absent_count || 0;
                            const permission = project.permission_count || 0;

                            return (
                                <Card key={project.id} className="border-l-4 border-l-primary hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="mb-2">{project.ngo_name || 'NGO'}</Badge>
                                            {getStatusBadge(project.status)}
                                        </div>
                                        <CardTitle className="text-xl">{project.title}</CardTitle>
                                        <CardDescription>
                                            {latestDate ? `Last Activity: ${latestDate.toLocaleDateString('en-GB')}` : (project.start_date ? `Starts: ${new Date(project.start_date).toLocaleDateString('en-GB')}` : 'No Activity')}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-2 mb-4 mt-2">
                                            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-green-600">{present}</div>
                                                <div className="text-xs text-muted-foreground">Present</div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-red-600">{absent}</div>
                                                <div className="text-xs text-muted-foreground">Absent</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded text-center">
                                                <div className="text-xl font-bold text-blue-600">{permission}</div>
                                                <div className="text-xs text-muted-foreground">Perm</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Button className="flex-1" variant="outline" onClick={() => navigate(`/admin/attendance/project/${project.id}`)}>
                                                <Eye className="w-4 h-4 mr-2" /> View
                                            </Button>
                                            <Button className="flex-1" onClick={() => handleOpenMarkDialog(project)}>
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
                                Choose date to mark attendance for {selectedProject?.title}
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

                {/* Mark Dialog - Simplified */}
                <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Mark Attendance: {selectedProject?.title}</DialogTitle>
                            <DialogDescription>
                                Date: {new Date(selectedDate).toLocaleDateString('en-GB')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-between items-center">
                                {/* Date is now pre-selected */}
                                <div className="text-sm font-medium">
                                    Date: <span className="font-bold">{new Date(selectedDate).toLocaleDateString('en-GB')}</span>
                                </div>
                                <Input
                                    placeholder="Search student..."
                                    value={dialogSearchQuery}
                                    onChange={(e) => setDialogSearchQuery(e.target.value)}
                                    className="w-64"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-muted p-2 rounded">
                                <span>Marking for {itemStudents.length} students</span>
                                <Button size="sm" onClick={handleMarkAllPresent} className="gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Mark All Present
                                </Button>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {itemStudents.filter(s => s.name.toLowerCase().includes(dialogSearchQuery.toLowerCase())).map(student => {
                                            const id = student.user_id || student.id;
                                            const status = attendanceData[id] || '';
                                            return (
                                                <TableRow key={id}>
                                                    <TableCell className="font-medium">{student.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">{student.email}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-4 items-center">
                                                            {/* Present Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'present')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${status === 'present'
                                                                    ? 'bg-green-500 border-green-600 shadow-lg shadow-green-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-green-400'
                                                                    }`}>
                                                                    {status === 'present' && (
                                                                        <CheckCircle2 className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Present</span>
                                                            </div>

                                                            {/* Absent Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'absent')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${status === 'absent'
                                                                    ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-red-400'
                                                                    }`}>
                                                                    {status === 'absent' && (
                                                                        <XCircle className="w-6 h-6 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Absent</span>
                                                            </div>

                                                            {/* Permission Button */}
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleMarkAttendanceClick(id, 'late')}>
                                                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${status === 'late'
                                                                    ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50'
                                                                    : 'bg-transparent border-slate-200 hover:border-blue-400'
                                                                    }`}>
                                                                    {status === 'late' && (
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

export default AttendanceProjects;
