import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Users,
    Search,
    Plus,
    Upload,
    Edit2,
    Trash2,
    Clock,
    CheckCircle2,
    Star,
    XCircle,
    RotateCcw,
    FileSpreadsheet,
    UserCheck,
    UserX,
    UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";

const DEPARTMENTS = [
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Biotechnology",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Food Technology",
  "Information Technology",
  "Textile Technology",
  "Very Large Scale Integration Technology",
  "Computer Science and Business Systems",
  "Master of Business Administration",
  "Master of Computer Applications"
];
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DeveloperCredit from "@/components/DeveloperCredit";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Helper function to format date for HTML input
const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    // If it's an ISO string with time, extract just the date part
    if (dateString.includes('T')) {
        return dateString.split('T')[0];
    }
    return dateString;
};

const AdminInterviewsPanel = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [interviewers, setInterviewers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [mainTab, setMainTab] = useState<string>("candidates");
    const [interviewerSearch, setInterviewerSearch] = useState("");
    
    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
    const [showMarksDialog, setShowMarksDialog] = useState(false);
    const [showAssignCandidateDialog, setShowAssignCandidateDialog] = useState(false);
    const [selectedInterviewerForAssign, setSelectedInterviewerForAssign] = useState<any | null>(null);
    const [assignCandidateId, setAssignCandidateId] = useState<string>("");
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);

    // Form data - all fields initialized with empty strings to avoid controlled/uncontrolled warnings
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        department: "",
        year: "",
        marks: 0,
    });

    const [marksData, setMarksData] = useState({
        marks: 0,
        attendance: "present" as "present" | "absent",
        interview_date: formatDateForInput(null),
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Load data
    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }

        const user = auth.getUser();
        if (!user || (user.role !== 'admin' && user.role !== 'office_bearer')) {
            toast.error("Access denied. Admin or Office Bearer role required.");
            navigate("/home");
            return;
        }

        loadCandidates();
        loadUsers();
        loadInterviewers();
    }, []);

    const loadCandidates = async () => {
        try {
            setLoading(true);
            const response = await api.getCandidates();
            if (response.success) {
                setCandidates(response.candidates || []);
            }
        } catch (error: any) {
            toast.error("Failed to load candidates");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await api.getUsers();
            if (response.success) {
                setAllUsers(response.users || []);
            }
        } catch (error: any) {
            toast.error("Failed to load users");
            console.error(error);
        }
    };

    const loadInterviewers = async () => {
        try {
            const response = await api.getInterviewers();
            if (response.success) {
                // Backend returns { success, users } — not { interviewers }
                setInterviewers(response.users || []);
            }
        } catch (error: any) {
            toast.error("Failed to load interviewers");
        }
    };

    const calculateResult = (marks: number): string => {
        if (marks >= 7) return "selected";
        if (marks >= 5) return "waitlisted";  // 6-5 = waitlisted
        return "rejected";                     // 4-0 = rejected
    };

    // Handlers
    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.phone || !formData.department) {
            toast.error("All fields are required");
            return;
        }

        try {
            const response = await api.addCandidate({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                department: formData.department,
                year: formData.year || "I",
            });

            if (response.success) {
                toast.success("Candidate added successfully");
                setShowAddDialog(false);
                setFormData({ name: "", email: "", phone: "", department: "", year: "", marks: 0 });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to add candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleEditCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;
        if (!formData.name || !formData.email || !formData.phone || !formData.department) {
            toast.error("All fields are required");
            return;
        }

        try {
            const response = await api.updateCandidate(selectedCandidate.id, {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                department: formData.department,
                year: formData.year
            });

            if (response.success) {
                toast.success("Candidate updated successfully");
                setShowEditDialog(false);
                setSelectedCandidate(null);
                setFormData({ name: "", email: "", phone: "", department: "", year: "", marks: 0 });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to update candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    // Handle candidate assignment from the candidates table
    const handleAssignCandidate = async (candidateId: number, interviewer: any) => {
        try {
            const response = await api.updateCandidate(candidateId, {
                interviewer_id: interviewer.id,
                interviewer: interviewer.name,
                interviewer_email: interviewer.email,
                status: 'assigned',
            });
            
            if (response.success) {
                toast.success(`Candidate assigned to ${interviewer.name}`);
                
                // Refresh current user's auth state if they are the one being assigned
                const currentUser = auth.getUser();
                if (currentUser && currentUser.id === interviewer.id && !currentUser.is_interviewer) {
                    const updatedUser = { ...currentUser, is_interviewer: true };
                    auth.setUser(updatedUser);
                    console.log("Auth state updated for current user (Self-assignment)");
                    window.dispatchEvent(new Event('sm-auth-update'));
                }

                loadCandidates();
                loadInterviewers();
                loadUsers();
            } else {
                toast.error(response.message || "Failed to assign candidate");
            }
        } catch (error: any) {
            toast.error("Error assigned: " + error.message);
        }
    };

    // Toggle is_interviewer flag for a user
    const handleToggleInterviewer = async (userId: number) => {
        try {
            const response = await api.toggleInterviewer(userId);
            if (response.success) {
                toast.success(response.message || "Updated");
                
                // CRITICAL: Refresh current user's auth state if they are the one being toggled
                const currentUser = auth.getUser();
                if (currentUser && currentUser.id === userId) {
                    const updatedUser = { ...currentUser, is_interviewer: !currentUser.is_interviewer };
                    auth.setUser(updatedUser);
                    console.log("Auth state updated for current user (Interviewer toggle)");
                    window.dispatchEvent(new Event('sm-auth-update'));
                }

                loadInterviewers();
                loadUsers();
            } else {
                toast.error(response.message || "Failed to update");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    // Assign a candidate to an interviewer from the Manage Interviewers tab
    const handleAssignFromTab = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInterviewerForAssign || !assignCandidateId) {
            toast.error("Please select a candidate");
            return;
        }
        const candidateId = parseInt(assignCandidateId);
        const interviewer = selectedInterviewerForAssign;
        try {
            const response = await api.updateCandidate(candidateId, {
                interviewer_id: interviewer.id,
                interviewer: interviewer.name,
                interviewer_email: interviewer.email,
                status: 'assigned',
            });
            if (response.success) {
                toast.success(`Candidate assigned to ${interviewer.name}`);
                
                // CRITICAL: If current user assigned a candidate to themselves, ensure is_interviewer is true in auth
                const currentUser = auth.getUser();
                if (currentUser && currentUser.id === interviewer.id && !currentUser.is_interviewer) {
                    const updatedUser = { ...currentUser, is_interviewer: true };
                    auth.setUser(updatedUser);
                    console.log("Auth state updated for current user (Assigned candidate)");
                    window.dispatchEvent(new Event('sm-auth-update'));
                }

                setShowAssignCandidateDialog(false);
                setAssignCandidateId("");
                setSelectedInterviewerForAssign(null);
                loadCandidates();
                loadInterviewers();
                loadUsers();
            } else {
                toast.error(response.message || "Failed to assign");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };


    const handleDeleteCandidate = async (candidateId: number) => {
        if (!window.confirm("Are you sure you want to delete this candidate?")) return;

        try {
            const response = await api.deleteCandidate(candidateId);
            if (response.success) {
                toast.success("Candidate deleted successfully");
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to delete candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleRetake = async (candidateId: number) => {
        try {
            const response = await api.updateCandidate(candidateId, {
                status: 'assigned',
                marks: null,
                attendance: null,
                interview_date: null,
                interview_time: null,
            });

            if (response.success) {
                toast.success("Retake assigned! Interviewer can resubmit.");
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to assign retake");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const exportToExcel = () => {
        const selectedCandidates = filteredCandidates.filter(c => c.status === 'selected');
        
        if (selectedCandidates.length === 0) {
            toast.error("No selected candidates to export");
            return;
        }

        // Create CSV content
        const headers = ['Name', 'Email', 'Phone', 'Department', 'Interviewer', 'Marks', 'Status', 'Date'];
        const rows = selectedCandidates.map(c => [
            c.name,
            c.email,
            c.phone,
            c.department || 'N/A',
            c.interviewer || 'N/A',
            c.marks || 'N/A',
            c.status,
            c.interview_date || 'N/A',
        ]);

        // Create CSV string
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected-candidates-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success(`Exported ${selectedCandidates.length} selected candidates`);
    };

    const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        const fileInput = (e.target as HTMLFormElement).elements.namedItem('file') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        
        if (!file) {
            toast.error("Please select a file");
            return;
        }

        try {
            const response = await api.bulkUploadCandidates(file);
            if (response.success) {
                toast.success(`Uploaded: ${response.stats?.added || 0} added, ${response.stats?.skipped || 0} skipped`);
                setShowBulkUploadDialog(false);
                loadCandidates();
            } else {
                toast.error(response.message || "Bulk upload failed");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleSubmitMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        const marks = marksData.marks;
        if (isNaN(marks) || marks < 0 || marks > 10) {
            toast.error("Marks must be between 0 and 10");
            return;
        }

        try {
            const result = calculateResult(marks);
            const response = await api.updateCandidate(selectedCandidate.id, {
                marks,
                attendance: marksData.attendance,
                status: result,
                interview_date: new Date().toISOString().split('T')[0],
            });

            if (response.success) {
                toast.success(`Marks submitted. Result: ${result.toUpperCase()}`);
                setShowMarksDialog(false);
                setMarksData({ marks: 0, attendance: "present", interview_date: formatDateForInput(null) });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to submit marks");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    // Filtering and pagination
    const filteredCandidates = candidates.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
    const paginatedCandidates = filteredCandidates.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusTextClass = (status: string) => {
        switch (status) {
            case 'pending': return 'text-yellow-400 font-medium';
            case 'assigned': return 'text-blue-400 font-medium';
            case 'selected': return 'text-green-400 font-medium';
            case 'waitlisted': return 'text-purple-400 font-medium';
            case 'rejected': return 'text-red-400 font-medium';
            default: return 'text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading interview data...</p>
                </div>
            </div>
        );
    }

    const unassignedCandidates = candidates.filter(c => c.status === 'pending');
    const filteredAllUsers = allUsers.filter(u =>
        u.name.toLowerCase().includes(interviewerSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(interviewerSearch.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <DeveloperCredit />
            <main className="flex-1 p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2">Interview Management</h1>
                        <p className="text-muted-foreground">Manage candidates and interviewers</p>
                    </div>
                    {mainTab === 'candidates' && (
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-primary hover:bg-primary/90">
                            <Plus className="w-4 h-4" /> Add Candidate
                        </Button>
                        <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" /> Bulk Upload
                        </Button>
                        <Button onClick={exportToExcel} variant="outline" className="gap-2">
                            <FileSpreadsheet className="w-4 h-4" /> Export Selected
                        </Button>
                    </div>
                    )}
                </div>

                {/* Main Tabs */}
                <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
                    <TabsList className="bg-card/50 border border-border/50 h-auto p-1">
                        <TabsTrigger value="candidates" className="gap-2">
                            <Users className="w-4 h-4" /> Candidates
                        </TabsTrigger>
                        <TabsTrigger value="interviewers" className="gap-2">
                            <UserCheck className="w-4 h-4" /> Manage Interviewers
                        </TabsTrigger>
                    </TabsList>

                <TabsContent value="candidates" className="space-y-6">

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total', value: candidates.length, icon: Users, color: 'text-blue-400' },
                        { label: 'Pending', value: candidates.filter(c => c.status === 'pending').length, icon: Clock, color: 'text-yellow-400' },
                        { label: 'Assigned', value: candidates.filter(c => c.status === 'assigned').length, icon: CheckCircle2, color: 'text-cyan-400' },
                        { label: 'Selected', value: candidates.filter(c => c.status === 'selected').length, icon: Star, color: 'text-green-400' },
                        { label: 'Rejected', value: candidates.filter(c => c.status === 'rejected').length, icon: XCircle, color: 'text-red-400' },
                    ].map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <Card key={i} className="bg-card/50 border-border/50 backdrop-blur-sm">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <Icon className={`w-8 h-8 ${stat.color}`} />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Search and Tabs */}
                <div className="flex flex-col gap-4">
                    <div className="w-full relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search internally by name or email..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="bg-card/50 border-border/50 pl-10 h-12 text-lg"
                        />
                    </div>
                    <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} className="w-full">
                        <TabsList className="bg-card/50 border border-border/50 w-full justify-start h-auto p-1 overflow-x-auto no-scrollbar">
                            <TabsTrigger value="all" className="flex-1 truncate gap-2">
                                All Status ({candidates.length})
                            </TabsTrigger>
                            <TabsTrigger value="pending" className="flex-1 truncate gap-2">
                                Pending ({candidates.filter(c => c.status === 'pending').length})
                            </TabsTrigger>
                            <TabsTrigger value="assigned" className="flex-1 truncate gap-2">
                                Assigned ({candidates.filter(c => c.status === 'assigned').length})
                            </TabsTrigger>
                            <TabsTrigger value="selected" className="flex-1 truncate gap-2">
                                Selected ({candidates.filter(c => c.status === 'selected').length})
                            </TabsTrigger>
                            <TabsTrigger value="waitlisted" className="flex-1 truncate gap-2">
                                Waitlisted ({candidates.filter(c => c.status === 'waitlisted').length})
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="flex-1 truncate gap-2">
                                Rejected ({candidates.filter(c => c.status === 'rejected').length})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Candidates Table */}
                <Card className="bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">S.No</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Interviewer</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Marks</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCandidates.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                            No candidates found
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCandidates.map((candidate, index) => (
                                        <tr key={candidate.id} className="border-b border-border/30 hover:bg-muted/30 transition">
                                            <td className="px-4 py-3 text-sm text-muted-foreground font-medium">
                                                {((currentPage - 1) * itemsPerPage) + index + 1}
                                            </td>
                                            <td className="px-4 py-3 font-medium">{candidate.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{candidate.email}</td>
                                            <td className="px-4 py-3 text-sm">{candidate.phone}</td>
                                            <td className="px-4 py-3 text-sm">{candidate.dept || candidate.department || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={getStatusTextClass(candidate.status)}>
                                                    {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                                                </span>
                                            </td>
                                             <td className="px-4 py-3 text-sm min-w-[170px]">
                                                <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                    <span className="text-foreground font-medium truncate flex-1" title={candidate.interviewer || 'Unassigned'}>
                                                        {candidate.interviewer || <span className="italic text-muted-foreground/50">Unassigned</span>}
                                                    </span>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className={cn(
                                                                    "text-[10px] h-6 px-1.5 shrink-0 border-dashed hover:border-solid hover:bg-primary/10 transition-all",
                                                                    candidate.interviewer ? "border-primary/40 text-primary" : "border-muted-foreground/20 text-muted-foreground"
                                                                )}
                                                            >
                                                                <UserPlus className="h-3 w-3 mr-1" />
                                                                {candidate.interviewer ? "Change" : "Assign"}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto bg-card border-border/50">
                                                            {interviewers.length === 0 ? (
                                                                <DropdownMenuItem disabled>No interviewers added</DropdownMenuItem>
                                                            ) : (
                                                                <>
                                                                    <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30">
                                                                        Select Interviewer
                                                                    </div>
                                                                    {interviewers.map(interviewer => (
                                                                        <DropdownMenuItem 
                                                                            key={interviewer.id} 
                                                                            onClick={() => handleAssignCandidate(candidate.id, interviewer)}
                                                                            className="text-xs flex flex-col items-start gap-0.5 group py-2"
                                                                        >
                                                                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{interviewer.name}</span>
                                                                            <span className="text-[10px] text-muted-foreground opacity-70 italic">{interviewer.email}</span>
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {candidate.marks ? (
                                                    <div>
                                                        <p className="font-semibold">{candidate.marks}/10</p>
                                                        <p className="text-xs text-muted-foreground">{candidate.status}</p>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setSelectedCandidate(candidate);
                                                            setShowMarksDialog(true);
                                                        }}
                                                        className="text-xs"
                                                    >
                                                        Add Marks
                                                    </Button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedCandidate(candidate);
                                                            setFormData({
                                                                name: candidate.name,
                                                                email: candidate.email,
                                                                phone: candidate.phone,
                                                                department: candidate.dept || candidate.department || "",
                                                                year: candidate.year || "",
                                                                marks: candidate.marks || 0,
                                                            });
                                                            setShowEditDialog(true);
                                                        }}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    {candidate.status !== 'pending' && candidate.marks !== null && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setSelectedCandidate(candidate);
                                                                    setMarksData({ marks: candidate.marks || 0, attendance: candidate.attendance || 'present', interview_date: formatDateForInput(candidate.interview_date) });
                                                                    setShowMarksDialog(true);
                                                                }}
                                                                title="Edit marks"
                                                            >
                                                                <Edit2 className="w-4 h-4 text-blue-400" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleRetake(candidate.id)}
                                                                title="Allow interviewer to resubmit"
                                                            >
                                                                <RotateCcw className="w-4 h-4 text-orange-400" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteCandidate(candidate.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 p-4 border-t border-border/30">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                            >
                                Previous
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </Card>

                {/* ==================== MANAGE INTERVIEWERS TAB ==================== */}
                </TabsContent>

                <TabsContent value="interviewers" className="space-y-6">
                {/* User list with toggle */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users by name or email..."
                        value={interviewerSearch}
                        onChange={(e) => setInterviewerSearch(e.target.value)}
                        className="bg-card/50 border-border/50 pl-10"
                    />
                </div>

                <Card className="bg-card/50 border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">S.No</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Interviewer</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Assigned Candidates</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAllUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                                    </tr>
                                ) : (
                                    filteredAllUsers.map((user, idx) => {
                                        const assignedCount = candidates.filter(c => c.interviewer_id === user.id).length;
                                        return (
                                            <tr key={user.id} className="border-b border-border/30 hover:bg-muted/30 transition">
                                                <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium">{user.name}</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                                                <td className="px-4 py-3 text-sm capitalize">{user.role?.replace('_', ' ')}</td>
                                                <td className="px-4 py-3">
                                                    {user.is_interviewer ? (
                                                        <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold">
                                                            <UserCheck className="w-3.5 h-3.5" /> Interviewer
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {assignedCount > 0 ? (
                                                        <span className="font-semibold text-primary">{assignedCount} candidate{assignedCount > 1 ? 's' : ''}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2 justify-center">
                                                        <Button
                                                            size="sm"
                                                            variant={user.is_interviewer ? "destructive" : "outline"}
                                                            onClick={() => handleToggleInterviewer(user.id)}
                                                            className="text-xs gap-1"
                                                        >
                                                            {user.is_interviewer ? (
                                                                <><UserX className="w-3 h-3" /> Remove</>
                                                            ) : (
                                                                <><UserPlus className="w-3 h-3" /> Add as Interviewer</>
                                                            )}
                                                        </Button>
                                                        {user.is_interviewer && (
                                                            <Button
                                                                size="sm"
                                                                className="text-xs gap-1 bg-primary"
                                                                onClick={() => {
                                                                    setSelectedInterviewerForAssign(user);
                                                                    setAssignCandidateId("");
                                                                    setShowAssignCandidateDialog(true);
                                                                }}
                                                            >
                                                                <UserCheck className="w-3 h-3" /> Assign Candidate
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
                </TabsContent>
            </Tabs>
            </main>

            {/* Add Candidate Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Add New Candidate</DialogTitle>
                        <DialogDescription>Enter candidate details to add them to the interview system</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddCandidate} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Candidate name"
                                className="bg-muted/50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="candidate@example.com"
                                className="bg-muted/50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+91 XXXXXXXXXX"
                                className="bg-muted/50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="department">Department</Label>
                            <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select a department" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {DEPARTMENTS.map(dept => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="year">Year</Label>
                            <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="I">I Year</SelectItem>
                                    <SelectItem value="II">II Year</SelectItem>
                                    <SelectItem value="III">III Year</SelectItem>
                                    <SelectItem value="IV">IV Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary">Add Candidate</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Candidate Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Edit Candidate</DialogTitle>
                        <DialogDescription>Update candidate details</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditCandidate} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Candidate name"
                                className="bg-muted/50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="candidate@example.com"
                                className="bg-muted/50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input
                                id="edit-phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+91 XXXXXXXXXX"
                                className="bg-muted/50"
                                maxLength={10}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-department">Department</Label>
                            <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select a department" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {DEPARTMENTS.map(dept => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="edit-year">Year</Label>
                            <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="I">I Year</SelectItem>
                                    <SelectItem value="II">II Year</SelectItem>
                                    <SelectItem value="III">III Year</SelectItem>
                                    <SelectItem value="IV">IV Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary">Update Candidate</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Assign Candidate to Interviewer Dialog */}
            <Dialog open={showAssignCandidateDialog} onOpenChange={setShowAssignCandidateDialog}>
                <DialogContent className="bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Assign Candidate</DialogTitle>
                        <DialogDescription>
                            Assign a pending candidate to {selectedInterviewerForAssign?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAssignFromTab} className="space-y-4">
                        <div>
                            <Label htmlFor="assign-candidate">Select Pending Candidate</Label>
                            <Select value={assignCandidateId} onValueChange={setAssignCandidateId}>
                                <SelectTrigger className="bg-muted/50">
                                    <SelectValue placeholder="Choose a candidate..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {unassignedCandidates.length === 0 ? (
                                        <SelectItem value="_none" disabled>No pending candidates</SelectItem>
                                    ) : (
                                        unassignedCandidates.map(c => (
                                            <SelectItem key={c.id} value={c.id.toString()}>
                                                {c.name} — {c.dept || c.department || 'N/A'}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowAssignCandidateDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary" disabled={!assignCandidateId || assignCandidateId === '_none'}>Assign</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Marks Dialog */}
            <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
                <DialogContent className="bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Submit Marks & Attendance</DialogTitle>
                        <DialogDescription>Enter marks (0-10) and attendance for {selectedCandidate?.name}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMarks} className="space-y-4">
                        <div>
                            <Label>Attendance</Label>
                            <div className="flex gap-3 mt-2">
                                <Button
                                    type="button"
                                    onClick={() => setMarksData({ ...marksData, attendance: 'present' })}
                                    className={`flex-1 ${marksData.attendance === 'present' ? 'bg-green-500 hover:bg-green-600' : 'bg-muted hover:bg-muted/80'}`}
                                >
                                    Present
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setMarksData({ ...marksData, attendance: 'absent' })}
                                    className={`flex-1 ${marksData.attendance === 'absent' ? 'bg-red-500 hover:bg-red-600' : 'bg-muted hover:bg-muted/80'}`}
                                >
                                    Absent
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="interview_date">Interview Date (Auto)</Label>
                            <Input
                                id="interview_date"
                                type="date"
                                value={marksData.interview_date}
                                disabled
                                className="bg-muted/50"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Auto-updated with today's date</p>
                        </div>
                        <div>
                            <Label htmlFor="marks">Marks (0-10)</Label>
                            <Input
                                id="marks"
                                type="text"
                                inputMode="numeric"
                                value={marksData.marks === 0 ? "" : marksData.marks}
                                onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (val === '') {
                                        setMarksData({ ...marksData, marks: 0 });
                                    } else {
                                        const num = parseInt(val);
                                        if (!isNaN(num) && num >= 0 && num <= 10) {
                                            setMarksData({ ...marksData, marks: num });
                                        }
                                    }
                                }}
                                placeholder="Enter marks"
                                className="bg-muted/50"
                            />
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                            <p className="text-muted-foreground">Result will be calculated based on marks:</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground mt-2">
                                <li>Marks ≥ 7: <span className="text-green-400">Selected</span></li>
                                <li>Marks 4-6: <span className="text-purple-400">Waitlisted</span></li>
                                <li>Marks &lt; 4: <span className="text-red-400">Rejected</span></li>
                            </ul>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowMarksDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary">Submit Marks</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Bulk Upload Dialog */}
            <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
                <DialogContent className="bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Bulk Upload Candidates</DialogTitle>
                        <DialogDescription>Upload a CSV file with columns: name, email, phone, department</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBulkUpload} className="space-y-4">
                        <div>
                            <Label htmlFor="file">CSV File</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept=".csv,.xlsx"
                                className="bg-muted/50"
                            />
                        </div>
                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                            <p className="text-muted-foreground">CSV Format:</p>
                            <code className="text-xs text-foreground block mt-2 font-mono">
                                name,email,phone,department
                            </code>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowBulkUploadDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary">Upload</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminInterviewsPanel;
