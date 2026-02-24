
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Briefcase, Calendar, Users, Building } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";

const ProjectDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        if (id) {
            loadProjectData();
        }
    }, [id, navigate]);

    const loadProjectData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const projectId = parseInt(id);
            const [projRes, studentsRes] = await Promise.all([
                api.getProjects(),
                api.getProjectStudents(projectId),
            ]);

            if (projRes.success && projRes.projects) {
                const found = projRes.projects.find((p: any) => p.id === projectId);
                if (found) {
                    setProject(found);
                } else {
                    toast.error("Project not found");
                    navigate("/admin/projects");
                    return;
                }
            }

            if (studentsRes.success) {
                setStudents(studentsRes.students || []);
            }

        } catch (e: any) {
            toast.error("Error loading project: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8">Loading...</div>;
    if (!project) return <div className="flex justify-center p-8">Project not found</div>;

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-4 md:p-8 w-full px-4 md:px-6 lg:px-8 space-y-6">
                <div className="mb-4">

                </div>

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b pb-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <Briefcase className="w-8 h-8 text-primary" />
                                {project.title}
                            </h1>
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-sm">
                                {project.status}
                            </Badge>
                        </div>
                        <p className="text-lg text-muted-foreground">{project.description || "No description provided."}</p>
                    </div>
                    {/* Actions if any, currently View Only */}
                </div>
                {/* Actions for Admin/Office Bearer */}
                {(auth.hasRole('admin') || auth.hasRole('office_bearer')) && (
                    <div className="flex flex-wrap gap-4 pt-4 border-t">
                        <Button
                            onClick={() => {
                                // For now, simple alert or separate dialog. 
                                // Ideally navigate to an attendance page or open dialog.
                                navigate(`/admin/attendance/projects?projectId=${project.id}`);
                                // Note: admin/attendance/projects needs to handle projectId param or similar
                            }}
                        >
                            <Calendar className="w-4 h-4 mr-2" />
                            Mark Project Attendance
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/admin/bills?projectId=${project.id}`)}
                        >
                            <Building className="w-4 h-4 mr-2" />
                            Manage Bills
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/admin/reports?projectId=${project.id}`)}
                        >
                            <Briefcase className="w-4 h-4 mr-2" />
                            View Reports
                        </Button>
                    </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">NGO Name</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 font-bold text-xl">
                                <Building className="w-5 h-5 text-muted-foreground" />
                                {project.ngo_name || "N/A"}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Students Assigned</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 font-bold text-xl">
                                <Users className="w-5 h-5 text-muted-foreground" />
                                {students.length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 font-bold text-xl">
                                <Calendar className="w-5 h-5 text-muted-foreground" />
                                {project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 font-bold text-xl">
                                <Calendar className="w-5 h-5 text-muted-foreground" />
                                {project.end_date ? new Date(project.end_date).toLocaleDateString() : '—'}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Assigned Students List */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Assigned Students</CardTitle>
                        <CardDescription>Full list of students working on this project</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {students.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                No students assigned yet.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Year</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell>{s.email}</TableCell>
                                            <TableCell>{s.dept || "—"}</TableCell>
                                            <TableCell>{s.year || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default ProjectDetails;
