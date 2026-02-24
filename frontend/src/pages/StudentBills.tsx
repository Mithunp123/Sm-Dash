import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Eye, Download, Trash2, Building, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeveloperCredit from "@/components/DeveloperCredit";

const StudentBills = () => {
    const navigate = useNavigate();
    const [bills, setBills] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        amount: "",
        bill_date: new Date().toISOString().split('T')[0],
        description: "",
        project_id: "",
        file_url: ""
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

            const [billsRes, projectsRes] = await Promise.all([
                api.getBills(), // This should be filtered by backend for students
                api.getUserProjects(user.id)
            ]);

            if (billsRes.success) {
                // For now filtering on client side if backend doesn't, but guide says backend should.
                // If student role, we only show bills they uploaded or for their projects.
                setBills(billsRes.bills || []);
            }
            if (projectsRes.success) {
                setProjects(projectsRes.projects || []);
                if (projectsRes.projects && projectsRes.projects.length > 0) {
                    setFormData(prev => ({ ...prev, project_id: projectsRes.projects[0].id.toString() }));
                }
            }
        } catch (e: any) {
            console.error("Error loading bills data:", e);
            toast.error("Failed to load bills");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!formData.amount || !formData.project_id) {
            toast.error("Please fill in required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.createBill({
                ...formData,
                amount: parseFloat(formData.amount),
                project_id: parseInt(formData.project_id)
            });

            if (res.success) {
                toast.success("Bill uploaded successfully!");
                setShowUploadDialog(false);
                setFormData({
                    amount: "",
                    bill_date: new Date().toISOString().split('T')[0],
                    description: "",
                    project_id: projects[0]?.id.toString() || "",
                    file_url: ""
                });
                loadData();
            } else {
                toast.error(res.message || "Failed to upload bill");
            }
        } catch (e: any) {
            toast.error("An error occurred during upload");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || 'pending';
        switch (s) {
            case 'approved':
                return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black uppercase tracking-widest text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
            case 'rejected':
                return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-black uppercase tracking-widest text-xs"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            default:
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-black uppercase tracking-widest text-xs"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <DeveloperCredit />
            <div className="w-full px-4 md:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col gap-4">

                    <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-6 rounded-3xl border border-border shadow-sm">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-foreground">Mission Billing</h1>
                            <p className="text-muted-foreground font-bold italic uppercase tracking-widest text-xs mt-1">Submit & Track Expense Reimbursements</p>
                        </div>
                        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                            <DialogTrigger asChild>
                                <Button className="rounded-2xl h-12 font-black uppercase tracking-widest text-xs px-6 shadow-lg shadow-primary/20">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Submit New Bill
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] rounded-3xl p-8">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black tracking-tight">Post Expense Log</DialogTitle>
                                    <DialogDescription className="font-bold text-muted-foreground">
                                        Upload your mission-related expenses for approval.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-4">
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
                                        <Label htmlFor="amount" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Amount (INR)</Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="0.00"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="date" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Expense Date</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.bill_date}
                                            onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desc" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Description/Reason</Label>
                                        <Textarea
                                            id="desc"
                                            placeholder="What was this expense for?"
                                            className="rounded-xl min-h-[100px] font-bold border-border"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleUpload}
                                        disabled={isSubmitting}
                                        className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                                    >
                                        {isSubmitting ? "Processing..." : "Submit for Approval"}
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
                                <FileText className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Audit Trail</CardTitle>
                                <CardDescription className="font-bold text-muted-foreground">History of your submitted expense claims</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-12 text-center text-muted-foreground animate-pulse font-bold">Accessing secure logs...</div>
                        ) : bills.length === 0 ? (
                            <div className="text-center py-24 bg-muted/20">
                                <FileText className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-20" />
                                <h3 className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">Log Clear</h3>
                                <p className="text-muted-foreground font-bold">No billing records found in your mission profile.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Date</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Mission/Project</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Amount</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Status</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bills.map((bill) => (
                                            <TableRow key={bill.id} className="hover:bg-muted/30 border-border transition-colors group">
                                                <TableCell className="font-bold text-foreground py-4 px-8">
                                                    {new Date(bill.bill_date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="py-4 px-8">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">{bill.project_title || "General"}</span>
                                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground truncate max-w-[200px]">{bill.description || "No description"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-8 font-black text-lg text-foreground tabular-nums">
                                                    ₹{bill.amount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-4 px-8">
                                                    {getStatusBadge(bill.status)}
                                                </TableCell>
                                                <TableCell className="py-4 px-8 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="View details">
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        {bill.file_url && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Download attachment">
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        )}
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

export default StudentBills;
