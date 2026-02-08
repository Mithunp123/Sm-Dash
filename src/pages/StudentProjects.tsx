import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Eye, Calendar, Users, Building } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import DeveloperCredit from "@/components/DeveloperCredit";

const StudentProjects = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.isAuthenticated() || !auth.hasRole('student')) {
            navigate("/login");
            return;
        }
        loadMyProjects();
    }, []);

    const loadMyProjects = async () => {
        setLoading(true);
        try {
            const user = auth.getUser();
            if (!user) return;

            // Fetch projects explicitly assigned to this student
            const res = await api.getUserProjects(user.id);
            if (res.success) {
                setProjects(res.projects || []);
            } else {
                toast.error(res.message || "Failed to load projects");
            }
        } catch (e: any) {
            console.error("Error loading student projects:", e);
            toast.error("Failed to load projects");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <DeveloperCredit />
            <div className="w-full space-y-8">
                <div className="flex flex-col gap-4">
                    <BackButton to="/student" />
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-foreground">My Projects</h1>
                            <p className="text-muted-foreground font-bold italic uppercase tracking-widest text-xs mt-1">Assigned Initiatives & Missions</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-64 rounded-3xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Briefcase className="w-10 h-10 text-primary opacity-50" />
                        </div>
                        <h3 className="text-2xl font-black text-foreground mb-2 italic uppercase tracking-tighter opacity-50">No Projects Found</h3>
                        <p className="text-muted-foreground font-bold">You haven't been assigned to any active projects yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card key={project.id} className="group border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                                <CardHeader className="bg-muted/40 border-b border-border py-6 px-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                            <Briefcase className="w-6 h-6" />
                                        </div>
                                        <Badge className="font-black uppercase tracking-widest text-xs bg-primary/20 text-primary border-none">
                                            {project.status || 'Active'}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                        {project.title}
                                    </CardTitle>
                                    <CardDescription className="font-bold text-muted-foreground line-clamp-2 min-h-[40px]">
                                        {project.description || "No description provided."}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                                                <Building className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Organization</span>
                                                <span className="font-bold text-foreground">{project.ngo_name || "N/A"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Start Date</span>
                                                <span className="font-bold text-foreground">
                                                    {project.start_date ? new Date(project.start_date).toLocaleDateString() : "N/A"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-6 pt-0">
                                    <Button
                                        className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                                        onClick={() => navigate(`/admin/projects/${project.id}`)}
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Project Details
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentProjects;
