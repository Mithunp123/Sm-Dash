import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Search,
    Send,
    CheckCircle2,
    Clock,
    GraduationCap,
    Edit2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DeveloperCredit from "@/components/DeveloperCredit";

const InterviewerDashboard = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Interview submission dialog
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [submitData, setSubmitData] = useState({
        marks: "" as string | number,
        attendance: "present" as "present" | "absent",
        interview_date: new Date().toISOString().split('T')[0],
    });

    // Edit candidate dialog
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editCandidate, setEditCandidate] = useState<any | null>(null);
    const [editData, setEditData] = useState({
        name: "",
        email: "",
        phone: "",
        dept: "",
        register_no: "",
    });

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        loadCandidates();
    }, []);

    const loadCandidates = async () => {
        try {
            setLoading(true);
            const response = await api.getMyinterviewCandidates();
            if (response.success) {
                setCandidates(response.candidates || []);
            } else {
                toast.error("Could not load assigned candidates");
                setCandidates([]);
            }
        } catch (error: any) {
            toast.error("Failed to load candidates");
        } finally {
            setLoading(false);
        }
    };

    const openSubmitDialog = (candidate: any) => {
        setSelectedCandidate(candidate);
        setSubmitData({
            marks: candidate.marks ?? "",
            attendance: candidate.attendance || "present",
            interview_date: candidate.interview_date
                ? candidate.interview_date.split('T')[0]
                : new Date().toISOString().split('T')[0],
        });
        setShowSubmitDialog(true);
    };

    const openEditDialog = (candidate: any) => {
        setEditCandidate(candidate);
        setEditData({
            name: candidate.name || "",
            email: candidate.email || "",
            phone: candidate.phone || "",
            dept: candidate.dept || candidate.department || "",
            register_no: candidate.register_no || "",
        });
        setShowEditDialog(true);
    };

    const handleSubmitMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        const marksNum = Number(submitData.marks);
        if (submitData.attendance === "present" && (isNaN(marksNum) || marksNum < 0 || marksNum > 10)) {
            toast.error("Marks must be between 0 and 10");
            return;
        }

        try {
            const finalMarks = submitData.attendance === "absent" ? 0 : marksNum;
            // Status logic: 10-7 Selected, 6-5 Waitlisted, 4-0 Rejected
            let status = "rejected";
            if (finalMarks >= 7) status = "selected";
            else if (finalMarks >= 5) status = "waitlisted";
            else status = "rejected";
            const response = await api.updateCandidate(selectedCandidate.id, {
                marks: finalMarks,
                attendance: submitData.attendance,
                status: submitData.attendance === "absent" ? "rejected" : status,
                interview_date: submitData.interview_date,
            });

            if (response.success) {
                toast.success("Interview submitted successfully!");
                setShowSubmitDialog(false);
                setSelectedCandidate(null);
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to submit interview");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editCandidate) return;
        try {
            // Build payload — only send register_no if it was actually changed
            // (it's UNIQUE in DB so sending unchanged value causes constraint errors)
            const payload: any = {
                name: editData.name,
                email: editData.email,
                phone: editData.phone,
                department: editData.dept,  // backend maps 'department' → 'dept' column
            };
            if (editData.register_no !== editCandidate.register_no) {
                payload.register_no = editData.register_no;
            }
            const response = await api.updateCandidate(editCandidate.id, payload);
            if (response.success) {
                toast.success("Candidate details updated!");
                setShowEditDialog(false);
                loadCandidates();
            } else {
                toast.error(response.message || "Update failed");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const isInterviewSubmitted = (c: any) => c.marks !== null && c.marks !== undefined && c.marks !== "";

    // Only show candidates that haven't been fully submitted yet
    // Once all are submitted, the page shows the empty "awaiting" state
    const pendingCandidates = candidates.filter(c => !isInterviewSubmitted(c));
    const submittedCount = candidates.length - pendingCandidates.length;

    const filteredCandidates = pendingCandidates.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.register_no?.includes(searchQuery)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading your interviews...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <DeveloperCredit />
            <main className="flex-1 p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center bg-card/30 p-6 rounded-xl border border-border/50 backdrop-blur-sm">
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">My Interview Schedule</h1>
                        <p className="text-muted-foreground">Conduct evaluations for your assigned candidates with professional standards.</p>
                    </div>
                    <div className="text-right flex items-center gap-4 bg-primary/10 px-6 py-3 rounded-xl border border-primary/20">
                        <div>
                            <p className="text-3xl font-black text-primary leading-none">{pendingCandidates.length}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                                Pending / {candidates.length} Total
                            </p>
                        </div>
                        <Users className="w-8 h-8 text-primary/40" />
                    </div>
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search by candidate name, email or register number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-card/50 border-border/50 pl-12 h-14 text-lg rounded-xl focus:ring-primary/20 transition-all shadow-sm"
                    />
                </div>

                {/* Table */}
                <Card className="bg-card/50 border-border/50 backdrop-blur-md overflow-hidden rounded-xl shadow-xl">
                    {filteredCandidates.length === 0 ? (
                        <CardContent className="p-12 text-center">
                            {candidates.length > 0 && submittedCount === candidates.length ? (
                                // All interviews submitted
                                <>
                                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">All Interviews Completed!</h3>
                                    <p className="text-muted-foreground max-w-md mx-auto text-sm">
                                        You have successfully evaluated all <strong>{candidates.length}</strong> assigned candidate(s). The admin has been notified.
                                    </p>
                                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/5 border border-green-500/20 text-xs font-bold text-green-400 uppercase tracking-wider">
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        {submittedCount} Submitted
                                    </div>
                                </>
                            ) : (
                                // No candidates assigned yet
                                <>
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
                                        <Users className="w-10 h-10 text-primary/40" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">No Assigned Candidates</h3>
                                    <p className="text-muted-foreground max-w-md mx-auto text-sm">
                                        You have been added as an interviewer. The admin will assign candidates to you shortly.
                                    </p>
                                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider">
                                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                        Awaiting Assignment
                                    </div>
                                </>
                            )}
                        </CardContent>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 border-b border-border/50">
                                    <tr>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70 w-16 text-center">S.No</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">Candidate Details</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">Department</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70 text-center">Interview Date</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70 text-center">Attendance</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70 text-center">Marks</th>
                                        <th className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCandidates.map((candidate, index) => {
                                        const submitted = isInterviewSubmitted(candidate);
                                        return (
                                            <tr key={candidate.id} className="border-b border-border/20 hover:bg-muted/20 transition-all duration-200 group">
                                                <td className="px-4 py-5 text-sm font-bold text-muted-foreground/50 text-center">{index + 1}</td>
                                                <td className="px-4 py-5">
                                                    <div>
                                                        <p className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{candidate.name}</p>
                                                        <p className="text-xs text-muted-foreground/70 mt-0.5">{candidate.email}</p>
                                                        {candidate.phone && (
                                                            <p className="text-[10px] text-muted-foreground/40 mt-0.5">📞 {candidate.phone}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <span className="text-sm font-semibold px-2.5 py-1 bg-muted/50 rounded-md border border-border/50">
                                                        {candidate.dept || candidate.department || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-5 text-center">
                                                    {candidate.interview_date ? (
                                                        <span className="text-xs font-semibold text-foreground">
                                                            {new Date(candidate.interview_date).toLocaleDateString('en-IN')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/40 italic">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-5 text-center">
                                                    {candidate.attendance ? (
                                                        <Badge className={candidate.attendance === 'present'
                                                            ? 'bg-green-500/10 text-green-400 border-green-500/20 border font-bold text-[10px]'
                                                            : 'bg-red-500/10 text-red-400 border-red-500/20 border font-bold text-[10px]'
                                                        }>
                                                            {candidate.attendance === 'present' ? 'Present' : 'Absent'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 text-lg font-black">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-5 text-center">
                                                    {submitted && candidate.marks !== null ? (
                                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20">
                                                            <span className="font-black text-green-400 text-lg">{candidate.marks}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 text-2xl font-black italic">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Edit button */}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openEditDialog(candidate)}
                                                            className="h-9 px-3 gap-1.5 rounded-lg font-bold text-[11px] border-border/50 hover:border-blue-400/50 hover:text-blue-400"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Edit
                                                        </Button>

                                                        {/* Take Interview / Mark (disabled after submitted) */}
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openSubmitDialog(candidate)}
                                                            disabled={submitted}
                                                            className={`h-9 px-4 gap-1.5 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all ${submitted
                                                                ? 'bg-green-500/10 border border-green-500/30 text-green-400 opacity-60 cursor-not-allowed'
                                                                : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
                                                                }`}
                                                        >
                                                            {submitted ? (
                                                                <><CheckCircle2 className="w-3.5 h-3.5" /> Mark</>
                                                            ) : (
                                                                <><Send className="w-3.5 h-3.5" /> Take Interview</>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Footer Info */}
                <div className="flex items-center gap-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Evaluation Guidelines</p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                            Marks must be awarded between <strong>0 to 10</strong>. Once submitted, the admin will be notified automatically.
                        </p>
                    </div>
                </div>
            </main>

            {/* ─── Submit Marks & Attendance Dialog ─── */}
            <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                <DialogContent className="bg-card border-border/50 sm:max-w-[420px] rounded-2xl shadow-2xl">
                    <DialogHeader className="space-y-2 pb-2">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-1">
                            <GraduationCap className="w-6 h-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-black tracking-tight">Submit Marks & Attendance</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Enter marks (0–10) and attendance for <strong>{selectedCandidate?.name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMarks} className="space-y-5 pt-1">

                        {/* Attendance */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Attendance</Label>
                            <div className="flex gap-3">
                                <Button type="button"
                                    onClick={() => setSubmitData({ ...submitData, attendance: 'present' })}
                                    className={`flex-1 h-12 rounded-xl font-bold border-2 transition-all ${submitData.attendance === 'present' ? 'bg-green-500 text-white border-green-400 shadow-lg shadow-green-500/20' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}
                                >Present</Button>
                                <Button type="button"
                                    onClick={() => setSubmitData({ ...submitData, attendance: 'absent', marks: 0 })}
                                    className={`flex-1 h-12 rounded-xl font-bold border-2 transition-all ${submitData.attendance === 'absent' ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}
                                >Absent</Button>
                            </div>
                        </div>

                        {/* Interview Date */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Interview Date (Auto)</Label>
                            <Input
                                type="date"
                                value={submitData.interview_date}
                                onChange={(e) => setSubmitData({ ...submitData, interview_date: e.target.value })}
                                className="h-11 rounded-xl bg-muted/30 border-border/50"
                            />
                            <p className="text-[10px] text-muted-foreground/60">Auto-updated with today's date</p>
                        </div>

                        {/* Marks */}
                        {submitData.attendance === 'present' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Marks (0–10)</Label>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={submitData.marks === 0 ? "" : submitData.marks}
                                        onChange={(e) => {
                                            const val = e.target.value.trim();
                                            if (val === '') { setSubmitData({ ...submitData, marks: "" }); return; }
                                            const num = parseInt(val);
                                            if (!isNaN(num) && num >= 0 && num <= 10) setSubmitData({ ...submitData, marks: num });
                                        }}
                                        placeholder="Enter marks"
                                        className="h-14 text-2xl font-black text-center bg-muted/30 border-border/50 rounded-xl border-2 focus-within:border-primary/50"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-black text-sm">/ 10</div>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowSubmitDialog(false)} className="flex-1 font-bold">Cancel</Button>
                            <Button type="submit" className="flex-1 bg-primary font-bold rounded-xl shadow-lg shadow-primary/30">Submit</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Edit Candidate Dialog ─── */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="bg-card border-border/50 sm:max-w-[420px] rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Edit Candidate Details</DialogTitle>
                        <DialogDescription>Update the details for <strong>{editCandidate?.name}</strong></DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Full Name</Label>
                            <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="h-11 rounded-xl" placeholder="Candidate name" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Email</Label>
                            <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="h-11 rounded-xl" placeholder="Email address" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Phone</Label>
                            <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="h-11 rounded-xl" placeholder="Phone number" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Department</Label>
                            <Input value={editData.dept} onChange={(e) => setEditData({ ...editData, dept: e.target.value })} className="h-11 rounded-xl" placeholder="Department" />
                        </div>
                        <DialogFooter className="gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowEditDialog(false)} className="flex-1 font-bold">Cancel</Button>
                            <Button type="submit" className="flex-1 font-bold rounded-xl">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewerDashboard;
