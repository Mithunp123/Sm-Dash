import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Search, CheckCircle2, Clock, User, Building2, PhoneCall, Activity,
    Edit2, Trash2, CalendarDays, UserCheck, XCircle, Star
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MentorInterviews = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

    // Marks + date + attendance dialog
    const [showMarksDialog, setShowMarksDialog] = useState(false);
    const _todayStr = () => new Date().toISOString().split('T')[0];
    const _timeStr = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

    const normalizeDateInput = (value?: string | null) => {
        if (!value) return "";
        // Special-case already valid format
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        // Convert dd-mm-yyyy to yyyy-mm-dd
        const dmy = value.match(/^([0-3]?\d)[-/.]([0-1]?\d)[-/.](\d{4})$/);
        if (dmy) {
            const [_, d, m, y] = dmy;
            return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        return "";
    };

    const normalizeTimeInput = (value?: string | null) => {
        if (!value) return "";
        if (/^[0-2]?\d:[0-5]\d$/.test(value)) return value;
        if (/^[0-2]?\d:[0-5]\d:[0-5]\d$/.test(value)) return value.substring(0,5);
        const date = new Date(`1970-01-01T${value}`);
        if (!isNaN(date.getTime())) {
            return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        }
        return "";
    };

    const formatCandidateDateDisplay = (value?: string | null) => {
        if (!value) return "";
        const normalized = normalizeDateInput(value);
        if (!normalized) return value;
        return new Date(normalized).toLocaleDateString('en-IN');
    };

    const [marksData, setMarksData] = useState({
        marks: "",
        remarks: "",
        interview_date: _todayStr(),
        interview_time: _timeStr(),
        attendance: "present" as "present" | "absent",
        decision: "" as "" | "selected" | "waitlisted" | "rejected" | "retake"
    });
    const [submitting, setSubmitting] = useState(false);

    // Edit dialog
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editData, setEditData] = useState({
        name: "", email: "", phone: "", dept: "", year: "", register_no: ""
    });

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        const user = auth.getUser();
        if (!user) {
            navigate("/login");
            return;
        }
        // Admins always get in; others can access if they are assigned candidates or are marked as interviewer.
        const validateInterviewer = async () => {
            if (user.role === 'admin' || user.is_interviewer) {
                loadMyCandidates();
                return;
            }

            try {
                const resp = await api.getMyInterviewCandidates();
                if (resp.success && Array.isArray(resp.candidates)) {
                    const active = resp.candidates.filter((c: any) => c.status !== 'completed');
                    if (active.length > 0) {
                        setCandidates(active);
                        setLoading(false);
                        return;
                    }
                }
                toast.error("Access denied. You are not assigned as an interviewer or mentor for any pending candidate.");
                navigate("/home");
            } catch (err) {
                console.error("Failed to validate interviewer access", err);
                toast.error("Access denied. Interviewer access could not be validated.");
                navigate("/home");
            }
        };
        validateInterviewer();

        // Listen for auth changes (when user is removed/added as interviewer)
        const unsubscribe = auth.onAuthChange(async () => {
            const currentUser = auth.getUser();
            if (currentUser && currentUser.role !== 'admin' && !currentUser.is_interviewer) {
                try {
                    const resp = await api.getMyInterviewCandidates();
                    const active = resp.success && Array.isArray(resp.candidates)
                        ? resp.candidates.filter((c: any) => c.status !== 'completed')
                        : [];
                    if (!active.length) {
                        toast.error("You have been removed from interviewers. Access denied.");
                        navigate("/home");
                    }
                } catch {
                    toast.error("You have been removed from interviewers. Access denied.");
                    navigate("/home");
                }
            }
        });

        return () => { unsubscribe(); };
    }, []);


    const loadMyCandidates = async () => {
        try {
            setLoading(true);
            try {
                const response = await api.getMyInterviewCandidates();
                if (response.success) {
                    const filtered = (response.candidates || []).filter((c: any) => c.status !== 'completed');
                    setCandidates(filtered);
                    return;
                }
            } catch (e: any) {
                console.warn("my-candidates endpoint not available, trying fallback");
            }
            const user = auth.getUser();
            if (user?.id) {
                try {
                    const allCandidates = await api.getCandidates();
                    if (allCandidates.success && allCandidates.candidates) {
                        const myCandidates = allCandidates.candidates.filter((c: any) => {
                            const candidateEmail = (c.interviewer_email || '').toLowerCase().trim();
                            const candidateInterviewer = (c.interviewer || '').toLowerCase().trim();
                            const userEmail = (user.email || '').toLowerCase().trim();
                            const userName = (user.name || '').toLowerCase().trim();
                            const candidateInterviewerId = Number(c.interviewer_id);
                            return (candidateInterviewerId === user.id || candidateEmail === userEmail || candidateInterviewer === userName) && c.status !== 'completed';
                        });
                        setCandidates(myCandidates);
                    } else {
                        setCandidates([]);
                    }
                } catch (fallbackError: any) {
                    console.error("Fallback failed:", fallbackError);
                    setCandidates([]);
                    toast.error("Unable to load candidates.");
                }
            } else {
                setCandidates([]);
            }
        } catch (error: any) {
            console.error("Failed to load candidates:", error);
            toast.error("Failed to load candidates: " + (error.message || "Check backend connection"));
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Submit Marks ─────────────────────────────────────────
    const handleOpenMarksDialog = (candidate: any) => {
        // Auto-fill with today's date and current time if not set
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hours}:${mins}`;

        setSelectedCandidate(candidate);
        setMarksData({
            marks: candidate.marks?.toString() || "",
            remarks: candidate.remarks || "",
            interview_date: normalizeDateInput(candidate.interview_date || today) || today,
            interview_time: normalizeTimeInput(candidate.interview_time || currentTime) || currentTime,
            attendance: candidate.attendance || "present",
            decision: candidate.attendance === "absent" ? "retake" : (candidate.decision || "")
        });
        setShowMarksDialog(true);
    };

    const handleSubmitMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        if (marksData.attendance === "present") {
            // For present candidates, marks are required
            const marksNum = parseFloat(marksData.marks);
            if (!marksData.marks || isNaN(marksNum) || marksNum < 0 || marksNum > 10) {
                toast.error("Please enter valid marks between 0 and 10");
                return;
            }

            if (!marksData.decision || marksData.decision === "retake") {
                toast.error("Please select an outcome (Selected/Waitlisted/Rejected)");
                return;
            }
        }

        try {
            setSubmitting(true);

            // Update date/time/attendance/decision
            const updateObj: any = {
                interview_date: marksData.interview_date || null,
                interview_time: marksData.interview_time || null,
                attendance: marksData.attendance,
            };
            // For absent, store decision consistently as 'retake'
            if (marksData.attendance === 'absent') {
                updateObj.decision = 'retake';
            } else {
                updateObj.decision = marksData.decision || null;
            }

            await api.updateCandidate(selectedCandidate.id, updateObj);

            // Submit marks — backend sets status = 'completed'
            const marksNum = marksData.attendance === "present" && marksData.marks ? parseFloat(marksData.marks) : undefined;
            const response = await api.submitInterviewMarks(selectedCandidate.id, {
                marks: marksNum,
                remarks: marksData.attendance === 'absent' ? '' : (marksData.remarks || ""),
                decision: marksData.attendance === 'absent' ? 'retake' : (marksData.decision || undefined)
            });

            if (response.success) {
                const statusMsg = marksData.attendance === "absent" ? "marked as absent" : "marks submitted";
                toast.success(`✅ ${statusMsg} for ${selectedCandidate.name}! Candidate marked as completed.`);
                setShowMarksDialog(false);
                // Remove candidate from mentor view - job done once marks submitted
                setCandidates(prev => prev.filter(c => c.id !== selectedCandidate.id));
                setSelectedCandidate(null);
                setMarksData({ marks: "", remarks: "", interview_date: "", interview_time: "", attendance: "present", decision: "" });
            } else {
                toast.error(response.message || "Failed to submit marks");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Attendance Toggle ─────────────────────────────────────
    const handleToggleAttendance = async (candidate: any) => {
        if (candidate.status === 'completed') {
            toast.info("Cannot change attendance for completed interviews.");
            return;
        }
        const newAttendance = candidate.attendance === "present" ? "absent" : "present";
        try {
            await api.updateCandidate(candidate.id, { attendance: newAttendance });
            setCandidates(prev =>
                prev.map(c => c.id === candidate.id ? { ...c, attendance: newAttendance } : c)
            );
            toast.success(`Attendance marked as ${newAttendance}`);
        } catch (error: any) {
            toast.error("Failed to update attendance: " + error.message);
        }
    };

    // ── Edit Candidate ────────────────────────────────────────
    const handleOpenEditDialog = (candidate: any) => {
        setSelectedCandidate(candidate);
        setEditData({
            name: candidate.name || "",
            email: candidate.email || "",
            phone: candidate.phone || "",
            dept: candidate.dept || "",
            year: candidate.year || "",
            register_no: candidate.register_no || ""
        });
        setShowEditDialog(true);
    };

    const handleEditCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;
        try {
            const response = await api.updateCandidate(selectedCandidate.id, editData);
            if (response.success) {
                toast.success("Candidate updated successfully");
                setShowEditDialog(false);
                setSelectedCandidate(null);
                loadMyCandidates();
            } else {
                toast.error(response.message || "Failed to update candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    // ── Delete Candidate ──────────────────────────────────────
    const handleDeleteCandidate = async (candidate: any) => {
        if (!window.confirm(`Are you sure you want to delete ${candidate.name}?`)) return;
        try {
            const response = await api.deleteCandidate(candidate.id);
            if (response.success) {
                toast.success("Candidate deleted");
                loadMyCandidates();
            } else {
                toast.error(response.message || "Failed to delete");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    // ── Helpers ───────────────────────────────────────────────
    const getStatusBadge = (candidate: any) => {
        if (candidate.status === 'completed' && candidate.decision) {
            if (candidate.decision === 'selected') {
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Selected</Badge>;
            }
            if (candidate.decision === 'waitlisted') {
                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Waitlisted</Badge>;
            }
            if (candidate.decision === 'rejected') {
                return <Badge className="bg-rose-500 hover:bg-rose-600 text-white">Rejected</Badge>;
            }
            if (candidate.decision === 'retake') {
                return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Retake</Badge>;
            }
        }

        switch (candidate.status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600 text-white">Completed</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending</Badge>;
            case 'assigned':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Assigned</Badge>;
            default:
                return <Badge className="bg-slate-500 hover:bg-slate-600 text-white">{candidate.status}</Badge>;
        }
    };

    const filteredCandidates = candidates.filter((c) => {
        // Completed candidates are hidden from mentor view — their work is done
        if (c.status === 'completed') return false;
        const matchesSearch =
            c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.register_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.dept?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const pendingCount = candidates.filter(c => c.status === 'pending' || c.status === 'assigned').length;
    const completedCount = candidates.filter(c => c.status === 'completed').length;
    const presentCount = candidates.filter(c => c.attendance === 'present').length;

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="w-full px-4 md:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="page-title">My Interview Candidates</h1>
                        <p className="page-subtitle mt-2">View and evaluate candidates assigned to you</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                                    <p className="text-4xl font-black text-primary mt-2">{candidates.length}</p>
                                </div>
                                <div className="rounded-full bg-primary/10 p-3">
                                    <User className="w-6 h-6 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pending</p>
                                    <p className="text-4xl font-black text-yellow-500 mt-2">{pendingCount}</p>
                                </div>
                                <div className="rounded-full bg-yellow-500/10 p-3">
                                    <Clock className="w-6 h-6 text-yellow-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Completed</p>
                                    <p className="text-4xl font-black text-green-500 mt-2">{completedCount}</p>
                                </div>
                                <div className="rounded-full bg-green-500/10 p-3">
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Present</p>
                                    <p className="text-4xl font-black text-blue-500 mt-2">{presentCount}</p>
                                </div>
                                <div className="rounded-full bg-blue-500/10 p-3">
                                    <UserCheck className="w-6 h-6 text-blue-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search and Filter */}
                <Card className="mb-8 border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-foreground">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <Input
                                        placeholder="Search by name, email, register no, or department..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 h-10 rounded-md bg-background border-border/50 text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-foreground">Filter by Status</Label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="all">All Status</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="pending">Pending Interview</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Candidates Table */}
                <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-md rounded-lg overflow-hidden">
                    <CardHeader className="border-b border-border/10 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight text-foreground">Candidates List</CardTitle>
                                <CardDescription className="text-muted-foreground font-medium">Total: {filteredCandidates.length} Interview Candidates</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Activity className="w-10 h-10 animate-spin mb-4 text-primary opacity-50" />
                                <p className="font-bold tracking-widest uppercase text-xs">Loading Candidates...</p>
                            </div>
                        ) : filteredCandidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-2">
                                    <User className="w-8 h-8 opacity-30" />
                                </div>
                                {candidates.length === 0 ? (
                                    <>
                                        <p className="font-bold text-base text-foreground">No mentee assigned</p>
                                        <p className="text-sm text-muted-foreground text-center max-w-xs">
                                            You haven't been assigned any interview candidates yet. Please contact the admin.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold text-base text-foreground">No matches found</p>
                                        <p className="text-sm text-muted-foreground">No candidates match your search.</p>
                                    </>
                                )}
                            </div>

                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-transparent border-border/10">
                                            <TableHead className="py-4 pl-6 font-black uppercase text-xs tracking-widest text-muted-foreground">Name</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Contact</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Department</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Reg No</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Interview Date</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Attendance</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Status</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Marks</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground text-right pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => (
                                            <TableRow key={c.id} className="group hover:bg-primary/5 transition-all duration-200 border-border/5">
                                                {/* Name */}
                                                <TableCell className="pl-6">
                                                    <span className="font-black text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                                                </TableCell>

                                                {/* Contact */}
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        {c.phone ? (
                                                            <a
                                                                href={`tel:${c.phone}`}
                                                                className="text-xs font-semibold text-foreground flex items-center gap-1 hover:text-primary transition-colors group/phone"
                                                                title={`Call ${c.phone}`}
                                                            >
                                                                <PhoneCall className="w-3 h-3 text-muted-foreground group-hover/phone:text-primary transition-colors" />
                                                                <span className="underline underline-offset-2 decoration-dashed decoration-muted-foreground/40 group-hover/phone:decoration-primary">{c.phone}</span>
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                                <PhoneCall className="w-3 h-3 text-muted-foreground" /> -
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[160px]">{c.email}</span>
                                                    </div>
                                                </TableCell>

                                                {/* Dept */}
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Building2 className="w-3 h-3 text-muted-foreground" />
                                                        <span className="text-sm">{c.dept || '-'}</span>
                                                        {c.year && <span className="text-xs text-muted-foreground">· Y{c.year}</span>}
                                                    </div>
                                                </TableCell>

                                                {/* Reg No */}
                                                <TableCell>
                                                    <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/10">
                                                        {c.register_no || '-'}
                                                    </span>
                                                </TableCell>

                                                {/* Interview Date */}
                                                <TableCell>
                                                    {c.interview_date ? (
                                                        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                                                            <CalendarDays className="w-3 h-3 text-primary" />
                                                            {formatCandidateDateDisplay(c.interview_date)}
                                                            {c.interview_time && (
                                                                <span className="text-muted-foreground ml-1">{normalizeTimeInput(c.interview_time)}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Not set</span>
                                                    )}
                                                </TableCell>

                                                {/* Attendance Toggle */}
                                                <TableCell>
                                                    <button
                                                        onClick={() => handleToggleAttendance(c)}
                                                        disabled={c.status === 'completed'}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        style={{
                                                            background: c.attendance === 'absent'
                                                                ? 'rgba(239,68,68,0.1)'
                                                                : 'rgba(34,197,94,0.1)',
                                                            color: c.attendance === 'absent' ? '#dc2626' : '#16a34a',
                                                            border: `1px solid ${c.attendance === 'absent' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`
                                                        }}
                                                    >
                                                        {c.attendance === 'absent'
                                                            ? <><XCircle className="w-3 h-3" /> Absent</>
                                                            : <><UserCheck className="w-3 h-3" /> Present</>
                                                        }
                                                    </button>
                                                </TableCell>

                                                {/* Status */}
                                                <TableCell>{getStatusBadge(c)}</TableCell>

                                                {/* Marks */}
                                                <TableCell>
                                                    {c.status === 'completed' ? (
                                                        c.decision === 'retake' ? (
                                                            <span className="text-xs font-semibold text-orange-500">Retake (no marks)</span>
                                                        ) : c.marks !== null ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1">
                                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                                    <span className="font-black text-sm text-foreground">{c.marks}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-bold">/ 10</span>
                                                                </div>
                                                                {c.decision && (
                                                                    <Badge
                                                                        className={`text-xs font-semibold ${c.decision === 'selected' ? 'bg-emerald-500 text-white' : c.decision === 'waitlisted' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}
                                                                    >
                                                                        {c.decision === 'selected' ? 'Selected' : c.decision === 'waitlisted' ? 'Waitlisted' : 'Rejected'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground italic">Not graded</span>
                                                        )
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Not graded</span>
                                                    )}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {/* Enter / View Marks */}
                                                        {c.status !== 'completed' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleOpenMarksDialog(c)}
                                                                className="h-8 px-3 rounded-lg font-bold text-xs gap-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                                            >
                                                                <Star className="w-3 h-3" />
                                                                Marks
                                                            </Button>
                                                        )}
                                                        {/* Edit */}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleOpenEditDialog(c)}
                                                            className="h-8 px-3 rounded-lg font-bold text-xs gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Edit
                                                        </Button>
                                                        {/* Delete */}
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleDeleteCandidate(c)}
                                                            className="h-8 px-3 rounded-lg font-bold text-xs gap-1"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            Delete
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

                {/* ── Submit Marks Dialog ───────────────────────────── */}
                <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Submit Interview Marks</DialogTitle>
                            <DialogDescription>
                                {selectedCandidate && (
                                    <>
                                        Enter marks for <strong>{selectedCandidate.name}</strong> ({selectedCandidate.register_no}).
                                        Once submitted the interview is marked as completed.
                                    </>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedCandidate && (
                            <form onSubmit={handleSubmitMarks} className="space-y-4">
                                {/* Interview Date + Time */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="interview_date">Interview Date</Label>
                                        <Input
                                            id="interview_date"
                                            type="date"
                                            value={marksData.interview_date}
                                            onChange={(e) => setMarksData({ ...marksData, interview_date: e.target.value })}
                                            className="h-10 rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="interview_time">Interview Time</Label>
                                        <Input
                                            id="interview_time"
                                            type="time"
                                            value={marksData.interview_time}
                                            onChange={(e) => setMarksData({ ...marksData, interview_time: e.target.value })}
                                            className="h-10 rounded-md"
                                        />
                                    </div>
                                </div>

                                {/* Attendance */}
                                <div className="space-y-2">
                                    <Label>Attendance</Label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMarksData({ ...marksData, attendance: "present", decision: marksData.decision === "retake" ? "" : marksData.decision })}
                                            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg font-bold text-sm border-2 transition-all duration-200 ${marksData.attendance === "present"
                                                ? "bg-green-500/15 border-green-500 text-green-600"
                                                : "bg-transparent border-border text-muted-foreground hover:border-green-400"
                                                }`}
                                        >
                                            <UserCheck className="w-4 h-4" /> Present
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMarksData({ ...marksData, attendance: "absent", decision: "retake", marks: "", remarks: "" })}
                                            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg font-bold text-sm border-2 transition-all duration-200 ${marksData.attendance === "absent"
                                                ? "bg-red-500/15 border-red-500 text-red-600"
                                                : "bg-transparent border-border text-muted-foreground hover:border-red-400"
                                                }`}
                                        >
                                            <XCircle className="w-4 h-4" /> Absent
                                        </button>
                                    </div>
                                </div>

                                {/* Show Marks & Remarks ONLY when Present */}
                                {marksData.attendance === "present" ? (
                                    <>
                                        {/* Marks */}
                                        <div className="space-y-2">
                                            <Label htmlFor="marks">Marks (out of 10) *</Label>
                                            <Input
                                                id="marks"
                                                type="number"
                                                min="0"
                                                max="10"
                                                step="0.5"
                                                value={marksData.marks}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const num = parseFloat(val);
                                                    let autoDecision: "" | "selected" | "waitlisted" | "rejected" = "";
                                                    if (val === "") {
                                                        autoDecision = "";
                                                    } else if (!isNaN(num)) {
                                                        if (num <= 5) autoDecision = "rejected";
                                                        else if (num <= 7) autoDecision = "waitlisted";
                                                        else autoDecision = "selected";
                                                    }
                                                    setMarksData({ ...marksData, marks: val, decision: autoDecision });
                                                }}
                                                placeholder="e.g., 7.5"
                                                required
                                                className="h-10 rounded-md"
                                            />
                                            <p className="text-xs text-muted-foreground">Enter marks between 0 and 10</p>
                                        </div>

                                        {/* Decision Category */}
                                        {marksData.marks !== "" && !isNaN(parseFloat(marksData.marks)) && (() => {
                                            const marksNum = parseFloat(marksData.marks);
                                            const category = marksNum <= 5 ? 'Rejected' : marksNum <= 7 ? 'Waitlisted' : 'Selected';
                                            const categoryColor = marksNum <= 5 ? 'red' : marksNum <= 7 ? 'yellow' : 'green';
                                            const categoryIcon = marksNum <= 5 ? '❌' : marksNum <= 7 ? '⏳' : '✅';

                                            return (
                                                <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 ${categoryColor === 'red' ? 'bg-red-500/10 border-red-500/30' : categoryColor === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                                                    <span className="text-lg">{categoryIcon}</span>
                                                    <div>
                                                        <p className={`text-sm font-bold ${categoryColor === 'red' ? 'text-red-500' : categoryColor === 'yellow' ? 'text-amber-600' : 'text-green-600'}`}>
                                                            Auto {category}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Default suggestion based on marks: {marksNum}.</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="space-y-2">
                                            <Label htmlFor="decision">Select Category *</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {([
                                                    { value: "selected", label: "✅ Selected", color: "green" },
                                                    { value: "waitlisted", label: "⏳ Waitlisted", color: "yellow" },
                                                    { value: "rejected", label: "❌ Rejected", color: "red" }
                                                ] as const).map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setMarksData({ ...marksData, decision: opt.value })}
                                                        className={`h-10 rounded-lg font-bold text-xs border-2 transition-all duration-200 ${marksData.decision === opt.value
                                                            ? opt.color === 'green' ? 'bg-green-500/20 border-green-500 text-green-600'
                                                                : opt.color === 'yellow' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-600'
                                                                    : 'bg-red-500/20 border-red-500 text-red-600'
                                                            : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                                                            }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Messages: 0-5 → rejected; 5+ to 7 → waitlisted; 7+ → selected (can override manually).</p>
                                        </div>

                                        {/* Remarks */}
                                        <div className="space-y-2">
                                            <Label htmlFor="remarks">Remarks / Feedback</Label>
                                            <Textarea
                                                id="remarks"
                                                value={marksData.remarks}
                                                onChange={(e) => setMarksData({ ...marksData, remarks: e.target.value })}
                                                placeholder="Enter your feedback or observations about the candidate..."
                                                rows={4}
                                                className="resize-none"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    // When ABSENT - show RETAKE option
                                    <div className="space-y-3">
                                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
                                            <p className="text-sm font-bold text-orange-600">⏳ Absent Candidate</p>
                                            <p className="text-xs text-muted-foreground mt-1">Candidate is marked as absent. No marks required.</p>
                                        </div>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setShowMarksDialog(false);
                                            setSelectedCandidate(null);
                                            setMarksData({ marks: "", remarks: "", interview_date: "", interview_time: "", attendance: "present", decision: "" });
                                        }}
                                        disabled={submitting}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting || (marksData.attendance === "present" && (!marksData.marks || !marksData.decision))}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        {submitting ? "Submitting..." : "Submit Marks"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

                {/* ── Edit Candidate Dialog ─────────────────────────── */}
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Candidate</DialogTitle>
                            <DialogDescription>Update candidate information</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditCandidate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Full Name *</Label>
                                    <Input
                                        id="edit-name"
                                        value={editData.name}
                                        onChange={e => setEditData({ ...editData, name: e.target.value })}
                                        required
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-regno">Register No</Label>
                                    <Input
                                        id="edit-regno"
                                        value={editData.register_no}
                                        onChange={e => setEditData({ ...editData, register_no: e.target.value })}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={editData.email}
                                    onChange={e => setEditData({ ...editData, email: e.target.value })}
                                    className="h-10 rounded-md"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Phone</Label>
                                    <Input
                                        id="edit-phone"
                                        value={editData.phone}
                                        onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-dept">Department</Label>
                                    <Input
                                        id="edit-dept"
                                        value={editData.dept}
                                        onChange={e => setEditData({ ...editData, dept: e.target.value })}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-year">Year</Label>
                                <select
                                    id="edit-year"
                                    value={editData.year}
                                    onChange={e => setEditData({ ...editData, year: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">Select Year</option>
                                    <option value="I">I</option>
                                    <option value="II">II</option>
                                    <option value="III">III</option>
                                    <option value="IV">IV</option>
                                </select>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setShowEditDialog(false); setSelectedCandidate(null); }}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="h-10 rounded-md font-semibold text-sm px-4">
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default MentorInterviews;
