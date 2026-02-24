import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Plus, Eye, Download, Building, Calendar, CheckCircle2, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeveloperCredit from "@/components/DeveloperCredit";

const StudentReports = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        report_date: new Date().toISOString().split('T')[0],
        content: "",
        project_id: ""
    });

    useEffect(() => {
        if (!auth.isAuthenticated() || !auth.hasRole('student')) {
            navigate("/login");
            return;
        }
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = auth.getUser();
            if (!user) return;

            // Assuming there's a reports API and projects API
            const [projectsRes] = await Promise.all([
                api.getUserProjects(user.id)
            ]);

            // For now, use local summary or mock if real report API isn't ready
            // Admin's Reports.tsx uses api.getBills() for "Reports" - we might need a real reports API
            // But let's follow the pattern
            setReports([]); // Empty for now until API is defined in backend

            if (projectsRes.success) {
                setProjects(projectsRes.projects || []);
                if (projectsRes.projects && projectsRes.projects.length > 0) {
                    setFormData(prev => ({ ...prev, project_id: projectsRes.projects[0].id.toString() }));
                }
            }
        } catch (e: any) {
            console.error("Error loading reports data:", e);
            toast.error("Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!formData.title || !formData.project_id) {
            toast.error("Please fill in required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            // Placeholder: Backend needs to handle student report submission
            toast.success("Mission report submitted successfully!");
            setShowUploadDialog(false);
            setFormData({
                title: "",
                report_date: new Date().toISOString().split('T')[0],
                content: "",
                project_id: projects[0]?.id.toString() || ""
            });
            loadData();
        } catch (e: any) {
            toast.error("An error occurred during submission");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <DeveloperCredit />
            <div className="w-full px-4 md:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col gap-4">

                    <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-6 rounded-3xl border border-border shadow-sm">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-foreground">Mission Intel</h1>
                            <p className="text-muted-foreground font-bold italic uppercase tracking-widest text-xs mt-1">Submit & Archive Project Reports</p>
                        </div>
                        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                            <DialogTrigger asChild>
                                <Button className="rounded-2xl h-12 font-black uppercase tracking-widest text-xs px-6 shadow-lg shadow-primary/20">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Intel Report
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-3xl p-8">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black tracking-tight">Post Mission Report</DialogTitle>
                                    <DialogDescription className="font-bold text-muted-foreground">
                                        Document your project activities and outcomes.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Report Title</Label>
                                        <Input
                                            id="title"
                                            placeholder="Progress update - [Mission Name]"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="project" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Project Selection</Label>
                                        <Select
                                            value={formData.project_id}
                                            onValueChange={(v) => setFormData({ ...formData, project_id: v })}
                                        >
                                            <SelectTrigger className="rounded-xl h-12 font-bold focus:ring-primary border-border">
                                                <SelectValue placeholder="Select a project" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border">
                                                {projects.map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()} className="font-bold">{p.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="date" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Report Date</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.report_date}
                                            onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="content" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Report Content/Summary</Label>
                                        <Textarea
                                            id="content"
                                            placeholder="What was achieved during this period?"
                                            className="rounded-xl min-h-[150px] font-bold border-border"
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleUpload}
                                        disabled={isSubmitting}
                                        className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                                    >
                                        {isSubmitting ? "Uploading..." : "Publish Report"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card className="border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-muted/40 border-b border-border py-6 px-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <FileBarChart className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Mission Archives</CardTitle>
                                <CardDescription className="font-bold text-muted-foreground">Central hub for all your project intelligence reports</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-12 text-center text-muted-foreground animate-pulse font-bold">Decrypting reports...</div>
                        ) : reports.length === 0 ? (
                            <div className="text-center py-24 bg-muted/20">
                                <FileBarChart className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-20" />
                                <h3 className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">Log Clear</h3>
                                <p className="text-muted-foreground font-bold">No mission reports filed in your profile archives.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Date</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Report Title</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Project</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reports.map((report) => (
                                            <TableRow key={report.id} className="hover:bg-muted/30 border-border transition-colors group">
                                                <TableCell className="font-bold text-foreground py-4 px-8">
                                                    {new Date(report.report_date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="py-4 px-8">
                                                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{report.title}</span>
                                                </TableCell>
                                                <TableCell className="py-4 px-8">
                                                    <Badge variant="outline" className="font-bold text-primary border-primary/20 bg-primary/5">
                                                        {report.project_title || "N/A"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 px-8 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Read report">
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Download PDF">
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default StudentReports;
