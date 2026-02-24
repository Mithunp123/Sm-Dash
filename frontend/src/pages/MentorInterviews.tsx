import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Search, CheckCircle2, Clock, User, Mail, Phone, Building2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SearchAndFilter } from "@/components/SearchAndFilter";

const MentorInterviews = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [showMarksDialog, setShowMarksDialog] = useState(false);
    const [marksData, setMarksData] = useState({
        marks: "",
        remarks: ""
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }

        // Only mentors (office_bearers) can access this page
        const user = auth.getUser();
        if (!user || (user.role !== 'office_bearer' && user.role !== 'admin')) {
            toast.error("Access denied. Mentor access required.");
            navigate("/home");
            return;
        }

        loadMyCandidates();
    }, []);

    const loadMyCandidates = async () => {
        try {
            setLoading(true);
            // Try the my-candidates endpoint first
            try {
                const response = await api.getMyInterviewCandidates();
                if (response.success) {
                    setCandidates(response.candidates || []);
                    return;
                }
            } catch (e: any) {
                // If my-candidates endpoint doesn't exist, try getting all candidates and filter
                console.warn("my-candidates endpoint not available, trying alternative method");
            }
            
            // Fallback: Get all candidates and filter by current user
            const user = auth.getUser();
            if (user?.id) {
                try {
                    const allCandidates = await api.getCandidates();
                    if (allCandidates.success && allCandidates.candidates) {
                        // Filter candidates assigned to current user
                        const myCandidates = allCandidates.candidates.filter((c: any) => 
                            c.mentor_id === user.id || c.interviewer_email === user.email
                        );
                        setCandidates(myCandidates);
                    } else {
                        setCandidates([]);
                    }
                } catch (fallbackError: any) {
                    console.error("Fallback method also failed:", fallbackError);
                    setCandidates([]);
                    toast.error("Unable to load candidates. Please ensure backend is running.");
                }
            } else {
                setCandidates([]);
            }
        } catch (error: any) {
            console.error("Failed to load candidates:", error);
            toast.error("Failed to load candidates: " + (error.message || "Please check backend connection"));
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        if (!marksData.marks || parseFloat(marksData.marks) < 0) {
            toast.error("Please enter valid marks");
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.submitInterviewMarks(selectedCandidate.id, {
                marks: parseFloat(marksData.marks),
                remarks: marksData.remarks || ""
            });

            if (response.success) {
                toast.success("Interview marks submitted successfully. Interview is now completed.");
                setShowMarksDialog(false);
                setSelectedCandidate(null);
                setMarksData({ marks: "", remarks: "" });
                loadMyCandidates();
            } else {
                toast.error(response.message || "Failed to submit marks");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenMarksDialog = (candidate: any) => {
        // Check if already completed
        if (candidate.status === 'completed' || candidate.marks !== null) {
            toast.info("This interview has already been completed and cannot be edited.");
            return;
        }

        setSelectedCandidate(candidate);
        setMarksData({
            marks: candidate.marks?.toString() || "",
            remarks: candidate.remarks || ""
        });
        setShowMarksDialog(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600 text-white">Completed</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending Interview</Badge>;
            case 'assigned':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Assigned</Badge>;
            default:
                return <Badge className="bg-slate-500 hover:bg-slate-600 text-white">{status}</Badge>;
        }
    };

    const filteredCandidates = candidates.filter((c) => {
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

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="w-full px-4 md:px-6 lg:px-8 py-8">
                <div className="mb-6">

                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">My Interview Candidates</h1>
                        <p className="text-sm text-muted-foreground mt-1">View and evaluate candidates assigned to you</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Total Assigned</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{candidates.length}</p>
                                </div>
                                <User className="w-8 h-8 text-primary opacity-60" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Pending</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{pendingCount}</p>
                                </div>
                                <Clock className="w-8 h-8 text-yellow-500 opacity-60" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Completed</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{completedCount}</p>
                                </div>
                                <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search and Filter */}
                <Card className="mb-8 border-border/40 bg-card shadow-sm rounded-md">
                    <CardContent className="p-4 md:p-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Search
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <Input
                                        placeholder="Search by name, email, register no, or department..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 h-10 rounded-md bg-background border-border text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Filter by Status
                                </Label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                <Card>
                    <CardHeader>
                        <CardTitle>Candidates List</CardTitle>
                        <CardDescription>Total: {filteredCandidates.length}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading...</div>
                        ) : filteredCandidates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {candidates.length === 0 
                                    ? "No candidates assigned to you yet." 
                                    : "No candidates match your search criteria."}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Department & Year</TableHead>
                                            <TableHead>Register No</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell>
                                                    <div className="font-medium text-foreground">{c.name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Mail className="w-3 h-3" />
                                                        {c.email}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {c.phone ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Phone className="w-3 h-3 text-muted-foreground" />
                                                            {c.phone}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-foreground">{c.dept || '-'}</span>
                                                        {c.year && <span className="text-muted-foreground"> • {c.year}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-foreground">{c.register_no || '-'}</TableCell>
                                                <TableCell>{getStatusBadge(c.status || 'assigned')}</TableCell>
                                                <TableCell className="text-right">
                                                    {c.status === 'completed' || c.marks !== null ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge variant="outline" className="text-xs">
                                                                Marks: {c.marks || 0}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">Completed</span>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenMarksDialog(c)}
                                                            className="h-10 rounded-md font-semibold text-sm px-4"
                                                        >
                                                            Enter Marks
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Submit Marks Dialog */}
                <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Submit Interview Marks</DialogTitle>
                            <DialogDescription>
                                {selectedCandidate && (
                                    <>
                                        Enter marks and remarks for <strong>{selectedCandidate.name}</strong> ({selectedCandidate.register_no}).
                                        Once submitted, this interview will be marked as completed and cannot be edited.
                                    </>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedCandidate && (
                            <form onSubmit={handleSubmitMarks} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="marks">Marks *</Label>
                                    <Input
                                        id="marks"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={marksData.marks}
                                        onChange={(e) => setMarksData({ ...marksData, marks: e.target.value })}
                                        placeholder="Enter marks (e.g., 85.5)"
                                        required
                                        className="h-10 rounded-md"
                                    />
                                    <p className="text-xs text-muted-foreground">Enter the interview marks (numeric value)</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="remarks">Remarks / Feedback</Label>
                                    <Textarea
                                        id="remarks"
                                        value={marksData.remarks}
                                        onChange={(e) => setMarksData({ ...marksData, remarks: e.target.value })}
                                        placeholder="Enter your feedback, observations, or remarks about the candidate..."
                                        rows={5}
                                        className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">Optional: Add any feedback or observations about the candidate</p>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setShowMarksDialog(false);
                                            setSelectedCandidate(null);
                                            setMarksData({ marks: "", remarks: "" });
                                        }}
                                        disabled={submitting}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        {submitting ? "Submitting..." : "Submit Marks"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default MentorInterviews;
