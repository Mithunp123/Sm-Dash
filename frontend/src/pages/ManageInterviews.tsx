import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
    Users,
    UserCheck,
    UserX,
    Search,
    Plus,
    Mail,
    Download,
    Upload,
    Filter,
    MoreVertical,
    FileSpreadsheet,
    Edit2,
    Trash2,
    Send,
    Activity,
    GraduationCap,
    PhoneCall,
    Clock,
    CheckCircle2,
    Star, // interview marks icon
    XCircle,
    CalendarDays,
    Mic,
    MicOff,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import MailSender from "@/components/MailSender";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BulkUploadModal } from "@/components/BulkUploadModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import InterviewEmailPanelManual from "@/components/InterviewEmailPanelManual";

const ManageInterviews = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [officeBearers, setOfficeBearers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'candidates' | 'emails'>('candidates');
    // Interviewers panel state - EXPANDED BY DEFAULT
    const [showInterviewersPanel, setShowInterviewersPanel] = useState(true);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [interviewerSearch, setInterviewerSearch] = useState("");
    const [loadingInterviewers, setLoadingInterviewers] = useState(false);
    const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dept: "",
        year: "",
        register_no: "",
        role: "volunteer"
    });
    const [assignFormData, setAssignFormData] = useState({
        interviewer_id: "",
        interviewer_name: ""
    });
    const [bulkAssignFormData, setBulkAssignFormData] = useState({
        interviewer_id: "",
        interviewer_name: ""
    });
    const [showMarksDialog, setShowMarksDialog] = useState(false);

    // Initialize with today's date and current time
    const getInitialMarksData = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${date}`;
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');

        return {
            marks: "",
            remarks: "",
            interview_date: today,
            interview_time: `${hh}:${mm}`,
            attendance: "present" as "present" | "absent",
            decision: "" as "" | "selected" | "waitlisted" | "rejected"
        };
    };

    const [marksData, setMarksData] = useState(getInitialMarksData());
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }

        const user = auth.getUser();
        if (!user || (user.role !== 'admin' && user.role !== 'office_bearer')) {
            toast.error("Access denied. Only admins and office bearers can manage interviews.");
            navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
            return;
        }

        loadCandidates();
        loadOfficeBearers();
        loadAllUsersForInterviewerPanel(); // Load users for interviewer panel on init
    }, []);

    // Update date and time when dialog opens
    useEffect(() => {
        if (showMarksDialog) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const date = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${date}`;
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');

            setMarksData(prev => ({
                ...prev,
                interview_date: today,
                interview_time: `${hh}:${mm}`
            }));
        }
    }, [showMarksDialog, selectedCandidate?.id]);

    const loadCandidates = async () => {
        try {
            setLoading(true);
            const response = await api.getCandidates();
            if (response.success) {
                setCandidates(response.candidates || []);
            }
        } catch (error: any) {
            toast.error("Failed to load candidates: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadOfficeBearers = async () => {
        try {
            // Only load users flagged as interviewers, not all users
            const response = await api.getInterviewers();
            if (response.success) {
                setOfficeBearers(response.users || []);
            }
        } catch (error: any) {
            console.error("Failed to load interviewers:", error);
        }
    };

    const loadAllUsersForInterviewerPanel = async () => {
        try {
            setLoadingInterviewers(true);
            const response = await api.getUsers();
            if (response.success) {
                setAllUsers(response.users || []);
            }
        } catch (err: any) {
            toast.error("Failed to load users: " + err.message);
        } finally {
            setLoadingInterviewers(false);
        }
    };

    const handleToggleInterviewerFromPanel = async (user: any) => {
        try {
            const response = await api.toggleInterviewer(user.id);
            if (response.success) {
                toast.success(response.message);
                // Update the local users list so badge flips immediately
                setAllUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, is_interviewer: response.is_interviewer } : u
                ));
                // Refresh officeBearers dropdown
                loadOfficeBearers();

                // If the current user's interviewer status was toggled, update their session
                const currentUser = auth.getUser();
                if (currentUser && currentUser.id === user.id) {
                    // Update the current user's is_interviewer flag in session
                    auth.setUser({
                        ...currentUser,
                        is_interviewer: response.is_interviewer
                    });
                    // Show feedback about sidebar update
                    if (response.is_interviewer) {
                        toast.success("You can now see 'My Interviews' in the menu!");
                    } else {
                        toast.info("'My Interviews' has been removed from your menu.");
                    }
                }
            } else {
                toast.error(response.message || 'Failed');
            }
        } catch (err: any) {
            toast.error('Error: ' + err.message);
        }
    };

    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.addCandidate(formData);
            if (response.success) {
                toast.success("Candidate added successfully");
                setShowAddDialog(false);
                setFormData({ name: "", email: "", phone: "", dept: "", year: "", register_no: "", role: "volunteer" });
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
        try {
            const response = await api.updateCandidate(selectedCandidate.id, formData);
            if (response.success) {
                toast.success("Candidate updated successfully");
                setShowEditDialog(false);
                setSelectedCandidate(null);
                setFormData({ name: "", email: "", phone: "", dept: "", year: "", register_no: "", role: "volunteer" });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to update candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleDeleteCandidate = async (candidate: any) => {
        if (!window.confirm(`Are you sure you want to delete ${candidate.name}?`)) return;
        try {
            const response = await api.deleteCandidate(candidate.id);
            if (response.success) {
                toast.success("Candidate deleted");
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to delete candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleAssignMentor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate || !assignFormData.interviewer_id) {
            toast.error("Please select an interviewer");
            return;
        }

        try {
            // Use updateCandidate API - backend matches by interviewer name or email
            const selectedInterviewer = officeBearers.find(ob => ob.id.toString() === assignFormData.interviewer_id);
            const interviewerName = selectedInterviewer?.name || assignFormData.interviewer_name;
            const interviewerEmail = selectedInterviewer?.email || '';

            const response = await api.updateCandidate(selectedCandidate.id, {
                interviewer: interviewerName,
                interviewer_email: interviewerEmail, // Add email for better matching
                interviewer_id: parseInt(assignFormData.interviewer_id),
                status: 'assigned' // Set to 'assigned' when interviewer is assigned
            });

            if (response.success) {
                toast.success("Interviewer assigned successfully");
                setShowAssignDialog(false);
                setSelectedCandidate(null);
                setAssignFormData({ interviewer_id: "", interviewer_name: "" });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to assign interviewer");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleOpenAssignDialog = (candidate: any) => {
        setSelectedCandidate(candidate);
        setAssignFormData({
            interviewer_id: candidate.interviewer_id?.toString() || "",
            interviewer_name: candidate.interviewer || ""
        });
        setShowAssignDialog(true);
    };

    const handleOpenEditDialog = (candidate: any) => {
        setSelectedCandidate(candidate);
        setFormData({
            name: candidate.name || "",
            email: candidate.email || "",
            phone: candidate.phone || "",
            dept: candidate.dept || "",
            year: candidate.year || "",
            register_no: candidate.register_no || "",
            role: candidate.role || "volunteer"
        });
        setShowEditDialog(true);
    };

    const handleBulkAssignMentor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedCandidateIds.length === 0 || !bulkAssignFormData.interviewer_id) {
            toast.error("Please select candidates and an interviewer");
            return;
        }

        try {
            const selectedInterviewer = officeBearers.find(ob => ob.id.toString() === bulkAssignFormData.interviewer_id);
            const interviewerName = selectedInterviewer?.name || bulkAssignFormData.interviewer_name;
            const interviewerEmail = selectedInterviewer?.email || '';

            // Assign all selected candidates to the interviewer
            for (const candidateId of selectedCandidateIds) {
                await api.updateCandidate(candidateId, {
                    interviewer: interviewerName,
                    interviewer_email: interviewerEmail,
                    interviewer_id: parseInt(bulkAssignFormData.interviewer_id),
                    status: 'assigned'
                });
            }

            toast.success(`Assigned ${selectedCandidateIds.length} candidates successfully`);
            setShowBulkAssignDialog(false);
            setSelectedCandidateIds([]);
            setBulkAssignFormData({ interviewer_id: "", interviewer_name: "" });
            loadCandidates();
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const toggleCandidateSelection = (candidateId: number) => {
        setSelectedCandidateIds(prev =>
            prev.includes(candidateId)
                ? prev.filter(id => id !== candidateId)
                : [...prev, candidateId]
        );
    };

    const toggleSelectAllFiltered = () => {
        if (selectedCandidateIds.length === filteredCandidates.length) {
            setSelectedCandidateIds([]);
        } else {
            setSelectedCandidateIds(filteredCandidates.map(c => c.id));
        }
    };

    const handleOpenBulkAssignDialog = () => {
        // Pre-populate with current interviewer if all selected candidates share the same interviewer
        const selected = candidates.filter(c => selectedCandidateIds.includes(c.id));
        const uniqueInterviewerIds = [...new Set(selected.map(c => c.interviewer_id).filter(Boolean))];
        if (uniqueInterviewerIds.length === 1) {
            // All have same interviewer â€” pre-select it
            const currentInterviewer = officeBearers.find((ob: any) => ob.id === uniqueInterviewerIds[0]);
            setBulkAssignFormData({
                interviewer_id: uniqueInterviewerIds[0].toString(),
                interviewer_name: currentInterviewer?.name || ""
            });
        } else {
            setBulkAssignFormData({ interviewer_id: "", interviewer_name: "" });
        }
        setShowBulkAssignDialog(true);
    };

    // â”€â”€ Admin Marks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleOpenAdminMarksDialog = (candidate: any) => {
        setSelectedCandidate(candidate);
        setMarksData({
            marks: candidate.marks?.toString() || "",
            remarks: candidate.remarks || "",
            interview_date: "",
            interview_time: "",
            attendance: candidate.attendance || "present",
            decision: candidate.decision || ""
        });
        setShowMarksDialog(true);
    };

    const handleSubmitAdminMarks = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate) return;
        if (marksData.attendance === "present") {
            const marksNum = parseFloat(marksData.marks);
            if (!marksData.marks || isNaN(marksNum) || marksNum < 0 || marksNum > 10) {
                toast.error("Please enter valid marks between 0 and 10");
                return;
            }
        }
        try {
            setSubmitting(true);
            await api.updateCandidate(selectedCandidate.id, {
                interview_date: marksData.interview_date || null,
                interview_time: marksData.interview_time || null,
                attendance: marksData.attendance,
                decision: marksData.decision || null,
            });
            const marksNum2 = marksData.attendance === "present" && marksData.marks ? parseFloat(marksData.marks) : undefined;
            const response = await api.submitInterviewMarks(selectedCandidate.id, {
                marks: marksNum2,
                remarks: marksData.remarks || ""
            });
            if (response.success) {
                toast.success("Marks submitted! Candidate marked as completed.");
                setShowMarksDialog(false);
                setCandidates(prev => prev.map(c =>
                    c.id === selectedCandidate.id
                        ? { ...c, marks: marksNum2, remarks: marksData.remarks, interview_date: marksData.interview_date, interview_time: marksData.interview_time, attendance: marksData.attendance, decision: marksData.decision, status: 'completed' }
                        : c
                ));
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

    const downloadTemplate = () => {
        const templateData = [
            { name: 'John Doe', email: 'john@example.com', phone: '1234567890', department: 'CSE', year: 'III', register_no: 'REG001' },
            { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', department: 'IT', year: 'II', register_no: 'REG002' }
        ];
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
        XLSX.writeFile(workbook, 'interview_candidates_template.xlsx');
    };

    const exportCandidates = () => {
        if (filteredCandidates.length === 0) {
            toast.error("No candidates to export");
            return;
        }
        const exportData = filteredCandidates.map(c => ({
            'Register No': c.register_no || '',
            'Name': c.name || '',
            'Email': c.email || '',
            'Phone': c.phone || '',
            'Department': c.dept || '',
            'Year': c.year || '',
            'Status': c.status || '',
            'Assigned Mentor': c.interviewer || '',
            'Interview Date': c.interview_date || '',
            'Interview Time': c.interview_time || '',
            'Attendance': c.attendance || '',
            'Marks': c.marks !== null && c.marks !== undefined ? c.marks : '',
            'Decision': c.decision || '',
            'Remarks': c.remarks || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        // Set column widths
        worksheet['!cols'] = [
            { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 14 },
            { wch: 14 }, { wch: 6 }, { wch: 12 }, { wch: 20 },
            { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
            { wch: 12 }, { wch: 40 }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Interview Candidates');
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `interview_candidates_${date}.xlsx`);
        toast.success(`Exported ${filteredCandidates.length} candidates`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600 text-white">Completed</Badge>;
            case 'selected':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">✓ Selected</Badge>;
            case 'waitlisted':
                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">⏳ Waitlisted</Badge>;
            case 'rejected':
                return <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold">✗ Rejected</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending Interview</Badge>;
            case 'assigned':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Assigned</Badge>;
            case 'interviewed':
                return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Interviewed</Badge>;
            default:
                return <Badge className="bg-slate-500 hover:bg-slate-600 text-white">Unassigned</Badge>;
        }
    };

    const filteredCandidates = candidates.filter((c) => {
        const matchesSearch =
            c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.register_no?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        const matchesDept = deptFilter === "all" || c.dept === deptFilter;
        const matchesYear = yearFilter === "all" || c.year === yearFilter;

        return matchesSearch && matchesStatus && matchesDept && matchesYear;
    });

    const uniqueDepartments = Array.from(new Set(candidates.map(c => c.dept).filter(Boolean))).sort();
    const uniqueYears = Array.from(new Set(candidates.map(c => c.year).filter(Boolean))).sort();

    const unassignedCount = candidates.filter(c => !c.interviewer && c.status !== 'completed').length;
    const assignedCount = candidates.filter(c => c.interviewer && (c.status === 'assigned' || c.status === 'pending')).length;
    const completedCount = candidates.filter(c => c.status === 'completed').length;

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="w-full px-4 md:px-6 lg:px-8 py-8">
                <div className="mb-6">

                </div>

                {/* Header with Title and Action Buttons */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight">
                            INTERVIEW <span className="text-blue-500">CANDIDATES</span>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">MANAGE AND EVALUATE INTERVIEW CANDIDATES</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                        <Button onClick={() => setShowAddDialog(true)} className="gap-2 rounded-lg font-semibold text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4" />
                            Add Candidate
                        </Button>
                        <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" className="gap-2 rounded-lg font-semibold text-sm px-4 py-2">
                            <Upload className="w-4 h-4" />
                            Bulk Upload
                        </Button>
                        <Button onClick={downloadTemplate} variant="outline" className="gap-2 rounded-lg font-semibold text-sm px-4 py-2">
                            <Download className="w-4 h-4" />
                            Sample
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total</p>
                            <p className="text-3xl font-black text-foreground mt-2">{candidates.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pending</p>
                            <p className="text-3xl font-black text-foreground mt-2">{candidates.filter(c => c.status === 'pending').length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Assigned</p>
                            <p className="text-3xl font-black text-foreground mt-2">{assignedCount}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Selected</p>
                            <p className="text-3xl font-black text-emerald-500 mt-2">{candidates.filter(c => c.status === 'selected').length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Waitlisted</p>
                            <p className="text-3xl font-black text-amber-500 mt-2">{candidates.filter(c => c.status === 'waitlisted').length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 bg-card/50 rounded-lg">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Rejected</p>
                            <p className="text-3xl font-black text-red-400 mt-2">{candidates.filter(c => c.status === 'rejected').length}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* â”€â”€ Manage Interviewers Panel â”€â”€ */}
                <Card className="mb-6 border-cyan-500/30 bg-card shadow-sm rounded-md overflow-hidden">
                    <CardHeader
                        className="pb-3 cursor-pointer select-none"
                        onClick={() => {
                            setShowInterviewersPanel(p => !p);
                            if (!showInterviewersPanel && allUsers.length === 0) {
                                loadAllUsersForInterviewerPanel();
                            }
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                                    <Mic className="w-4 h-4 text-cyan-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold tracking-wide">Manage Interviewers</CardTitle>
                                    <CardDescription className="text-xs">
                                        {officeBearers.length} active interviewer{officeBearers.length !== 1 ? 's' : ''} Â· Only these users can access the Mentor Interview page
                                    </CardDescription>
                                </div>
                            </div>
                            {showInterviewersPanel
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                        </div>
                    </CardHeader>

                    {showInterviewersPanel && (
                        <CardContent className="pt-0 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* LEFT â€” Current Interviewers */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500 mb-3">Current Interviewers</p>
                                    {officeBearers.length === 0 ? (
                                        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                                            <MicOff className="w-6 h-6 mx-auto mb-2 opacity-40" />
                                            No interviewers added yet
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {officeBearers.map((u: any) => (
                                                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">{u.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleToggleInterviewerFromPanel(u)}
                                                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 ml-2"
                                                    >
                                                        <UserX className="w-3 h-3 mr-1" /> Remove
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT â€” Add from all users */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Add Interviewers</p>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search users by name or email..."
                                            value={interviewerSearch}
                                            onChange={e => setInterviewerSearch(e.target.value)}
                                            className="pl-9 h-9 text-sm"
                                        />
                                    </div>
                                    {loadingInterviewers ? (
                                        <p className="text-xs text-center text-muted-foreground py-4">Loading users...</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                            {allUsers
                                                .filter(u =>
                                                (u.name?.toLowerCase().includes(interviewerSearch.toLowerCase()) ||
                                                    u.email?.toLowerCase().includes(interviewerSearch.toLowerCase()))
                                                )
                                                .map((u: any) => (
                                                    <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 transition-colors">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate">{u.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleToggleInterviewerFromPanel(u)}
                                                            className={cn(
                                                                "h-7 px-2 text-xs shrink-0 ml-2 transition-all",
                                                                u.is_interviewer
                                                                    ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-500 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500"
                                                                    : "hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:text-cyan-500"
                                                            )}
                                                        >
                                                            {u.is_interviewer
                                                                ? <><Mic className="w-3 h-3 mr-1" />Interviewer</>
                                                                : <><Plus className="w-3 h-3 mr-1" />Add</>}
                                                        </Button>
                                                    </div>
                                                ))
                                            }
                                            {allUsers.filter(u =>
                                                u.name?.toLowerCase().includes(interviewerSearch.toLowerCase()) ||
                                                u.email?.toLowerCase().includes(interviewerSearch.toLowerCase())
                                            ).length === 0 && (
                                                    <p className="text-xs text-center text-muted-foreground py-4">No users found</p>
                                                )}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Search and Filters */}
                <Card className="mb-8 border-border/40 bg-card shadow-sm rounded-md">
                    <CardContent className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Search
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <Input
                                        placeholder="Search by name, email, register no..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 h-10 rounded-md bg-background border-border text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Status
                                </Label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="all">All Status</option>
                                    <option value="">Unassigned</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="pending">Pending Interview</option>
                                    <option value="interviewed">Interviewed</option>
                                    <option value="selected">✓ Selected</option>
                                    <option value="waitlisted">⏳ Waitlisted</option>
                                    <option value="rejected">✗ Rejected</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Department
                                </Label>
                                <select
                                    value={deptFilter}
                                    onChange={(e) => setDeptFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="all">All Departments</option>
                                    {uniqueDepartments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Year
                                </Label>
                                <select
                                    value={yearFilter}
                                    onChange={(e) => setYearFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="all">All Years</option>
                                    {uniqueYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 border-b border-border/40">
                    <Button
                        variant={activeTab === 'candidates' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('candidates')}
                        className="rounded-b-none"
                    >
                        <Users className="w-4 h-4 mr-2" />
                        Candidates
                    </Button>
                    <Button
                        variant={activeTab === 'emails' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('emails')}
                        className="rounded-b-none"
                    >
                        <Mail className="w-4 h-4 mr-2" />
                        Email Management
                    </Button>
                </div>

                {/* Content based on active tab */}
                {activeTab === 'candidates' && (
                    <>
                    {/* Candidates Table */}
                    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-xl rounded-[1.5rem] overflow-hidden">
                    <CardHeader className="border-b border-border/10 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight text-foreground">Candidates List</CardTitle>
                                <CardDescription className="text-muted-foreground font-medium">Total: {filteredCandidates.length} Active Candidates</CardDescription>
                            </div>
                            <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 font-bold">
                                Interview Phase
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Activity className="w-10 h-10 animate-spin mb-4 text-primary opacity-50" />
                                <p className="font-bold tracking-widest uppercase text-xs">Loading Candidates...</p>
                            </div>
                        ) : filteredCandidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Users className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-medium text-lg italic">No candidates found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-transparent border-border/10">
                                            <TableHead className="py-4 px-6 font-black uppercase text-xs tracking-widest text-muted-foreground text-center">
                                                <Checkbox
                                                    checked={selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                                                    onCheckedChange={toggleSelectAllFiltered}
                                                    aria-label="Select all candidates"
                                                />
                                            </TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground pl-6">Register No</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Candidate Info</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Contact</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Status</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Assigned Mentor</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Marks</TableHead>
                                            <TableHead className="py-4 font-black uppercase text-xs tracking-widest text-muted-foreground text-right pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => (
                                            <TableRow key={c.id} className="group hover:bg-primary/5 transition-all duration-200 border-border/5">
                                                <TableCell className="px-6 text-center">
                                                    <Checkbox
                                                        checked={selectedCandidateIds.includes(c.id)}
                                                        onCheckedChange={() => toggleCandidateSelection(c.id)}
                                                        aria-label={`Select ${c.name}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="pl-6">
                                                    <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/10">
                                                        {c.register_no || 'N/A'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                                                        <span className="text-xs font-bold text-muted-foreground dark:text-slate-300 uppercase tracking-widest items-center flex gap-1.5 mt-0.5">
                                                            <GraduationCap className="w-3 h-3" />
                                                            {c.dept || '-'} - {c.year} Year
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        {c.phone ? (
                                                            <a
                                                                href={`tel:${c.phone}`}
                                                                className="text-xs font-semibold text-foreground flex items-center gap-1.5 hover:text-primary transition-colors group/phone"
                                                                title={`Call ${c.phone}`}
                                                            >
                                                                <PhoneCall className="w-3 h-3 text-muted-foreground group-hover/phone:text-primary transition-colors" />
                                                                <span className="underline underline-offset-2 decoration-dashed decoration-muted-foreground/40 group-hover/phone:decoration-primary">{c.phone}</span>
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                                <PhoneCall className="w-3 h-3 text-muted-foreground" /> -
                                                            </span>
                                                        )}
                                                        <span className="text-xs font-medium text-muted-foreground italic truncate max-w-[150px]">{c.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(c.status || '')}</TableCell>
                                                <TableCell>
                                                    {c.interviewer ? (
                                                        <div className="flex items-center gap-2.5 bg-green-500/5 border border-green-500/10 px-3 py-1.5 rounded-full w-fit">
                                                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                                                                <UserCheck className="w-3 h-3 text-green-600" />
                                                            </div>
                                                            <span className="text-xs font-black text-green-700 tracking-tight">{c.interviewer}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2.5 bg-muted/30 border border-border/10 px-3 py-1.5 rounded-full w-fit opacity-60">
                                                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                                                <UserX className="w-3 h-3 text-muted-foreground" />
                                                            </div>
                                                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Unassigned</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {c.status === 'completed' && c.marks !== null ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-black text-foreground">{c.marks}</span>
                                                                <span className="text-xs font-bold text-muted-foreground uppercase">/ 10</span>
                                                            </div>
                                                            {c.remarks && (
                                                                <span className="text-xs text-muted-foreground font-medium italic border-l-2 border-primary/20 pl-2 leading-tight max-w-[150px] line-clamp-1" title={c.remarks}>
                                                                    &ldquo;{c.remarks}&rdquo;
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-1 bg-muted rounded-full opacity-20" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {/* Marks button â€” admin can always set/edit marks */}
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenAdminMarksDialog(c)}
                                                            className={`h-9 px-3 rounded-lg font-bold text-xs gap-1 ${c.status === 'completed'
                                                                ? 'bg-green-600 hover:bg-green-700'
                                                                : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
                                                                }`}
                                                        >
                                                            <Star className="w-3 h-3" />
                                                            {c.status === 'completed' ? 'Edit Marks' : 'Marks'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant={c.interviewer ? "ghost" : "default"}
                                                            onClick={() => handleOpenAssignDialog(c)}
                                                            className={cn(
                                                                "h-9 px-3 rounded-lg font-bold text-xs gap-1 transition-all duration-300",
                                                                c.status === 'completed'
                                                                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                                                                    : !c.interviewer
                                                                        ? "shadow-lg shadow-primary/20 hover:scale-105"
                                                                        : "hover:bg-primary/10 hover:text-primary"
                                                            )}
                                                        >
                                                            {c.status === 'completed'
                                                                ? <><UserCheck className="w-3 h-3" /> Re-take</>
                                                                : c.interviewer
                                                                    ? <><Edit2 className="w-3 h-3" /> Reassign</>
                                                                    : <><UserCheck className="w-3 h-3" /> Assign</>
                                                            }
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleOpenEditDialog(c)}
                                                            className="h-9 px-3 rounded-lg font-bold text-xs gap-1"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleDeleteCandidate(c)}
                                                            className="h-9 px-3 rounded-lg font-bold text-xs gap-1"
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
                    </>
                )}

                {/* Email Management Tab */}
                {activeTab === 'emails' && (
                    <InterviewEmailPanelManual />
                )}

                {/* Add Candidate Dialog */}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Interview Candidate</DialogTitle>
                            <DialogDescription>Add a new candidate for face-to-face interview</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddCandidate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="regno">Register No *</Label>
                                    <Input
                                        id="regno"
                                        value={formData.register_no}
                                        onChange={e => setFormData({ ...formData, register_no: e.target.value })}
                                        required
                                        className="h-10 rounded-md"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email ID *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="h-10 rounded-md"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Mobile Number</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year</Label>
                                    <Select value={formData.year} onValueChange={v => setFormData({ ...formData, year: v })}>
                                        <SelectTrigger className="h-10 rounded-md">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">I</SelectItem>
                                            <SelectItem value="II">II</SelectItem>
                                            <SelectItem value="III">III</SelectItem>
                                            <SelectItem value="IV">IV</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dept">Department</Label>
                                <Input
                                    id="dept"
                                    value={formData.dept}
                                    onChange={e => setFormData({ ...formData, dept: e.target.value })}
                                    placeholder="e.g. CSE, IT, ECE"
                                    className="h-10 rounded-md"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role *</Label>
                                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                                    <SelectTrigger className="h-10 rounded-md">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="volunteer">Volunteer</SelectItem>
                                        <SelectItem value="office_bearer">Office Bearer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAddDialog(false)}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="h-10 rounded-md font-semibold text-sm px-4">
                                    Add Candidate
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Assign Mentor Dialog */}
                <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Mentor / Interviewer</DialogTitle>
                            <DialogDescription>
                                {selectedCandidate && (
                                    <>
                                        Assign a mentor to <strong>{selectedCandidate.name}</strong> ({selectedCandidate.register_no}).
                                        Each candidate can have only ONE mentor. Once assigned, the interview will be visible to the mentor.
                                    </>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedCandidate && (
                            <form onSubmit={handleAssignMentor} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="interviewer">Select Interviewer *</Label>
                                    <Select
                                        value={assignFormData.interviewer_id}
                                        onValueChange={(value) => {
                                            const interviewer = officeBearers.find(ob => ob.id.toString() === value);
                                            setAssignFormData({
                                                interviewer_id: value,
                                                interviewer_name: interviewer ? interviewer.name : ""
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="h-10 rounded-md">
                                            <SelectValue placeholder="Select a mentor/interviewer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {officeBearers.map((ob) => (
                                                <SelectItem key={ob.id} value={ob.id.toString()}>
                                                    {ob.name} {ob.position ? `(${ob.position})` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Select an office bearer to assign as mentor/interviewer. This candidate will only be visible to the assigned mentor.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setShowAssignDialog(false);
                                            setSelectedCandidate(null);
                                            setAssignFormData({ mentor_id: "", mentor_name: "" });
                                        }}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!assignFormData.mentor_id}
                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                    >
                                        Assign Mentor
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Bulk Assign Mentor Dialog */}
                <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Bulk Assign Mentors</DialogTitle>
                            <DialogDescription>
                                {(() => {
                                    const selected = candidates.filter(c => selectedCandidateIds.includes(c.id));
                                    const alreadyAssigned = selected.filter(c => c.mentor_id).length;
                                    return alreadyAssigned > 0
                                        ? `${selectedCandidateIds.length} candidate(s) selected. ${alreadyAssigned} already assigned - selecting a new mentor will reassign them.`
                                        : `Assign ${selectedCandidateIds.length} selected candidate(s) to a mentor/interviewer`;
                                })()}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleBulkAssignMentor} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="bulk_mentor">Select Mentor / Interviewer *</Label>
                                <Select
                                    value={bulkAssignFormData.interviewer_id}
                                    onValueChange={(value) => {
                                        const interviewer = officeBearers.find(ob => ob.id.toString() === value);
                                        setBulkAssignFormData({
                                            interviewer_id: value,
                                            interviewer_name: interviewer ? interviewer.name : ""
                                        });
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-md">
                                        <SelectValue placeholder="Select a mentor/interviewer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {officeBearers.map((ob) => (
                                            <SelectItem key={ob.id} value={ob.id.toString()}>
                                                {ob.name} {ob.position ? `(${ob.position})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Select one mentor to assign all {selectedCandidateIds.length} candidates
                                </p>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowBulkAssignDialog(false);
                                        setBulkAssignFormData({ mentor_id: "", mentor_name: "" });
                                    }}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!bulkAssignFormData.mentor_id}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Assign to All
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Edit Candidate Dialog */}
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Interview Candidate</DialogTitle>
                            <DialogDescription>Update candidate details</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditCandidate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="regno">Register No *</Label>
                                    <Input
                                        id="regno"
                                        value={formData.register_no}
                                        onChange={e => setFormData({ ...formData, register_no: e.target.value })}
                                        required
                                        className="h-10 rounded-md"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email ID *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="h-10 rounded-md"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Mobile Number</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year</Label>
                                    <Select value={formData.year} onValueChange={v => setFormData({ ...formData, year: v })}>
                                        <SelectTrigger className="h-10 rounded-md">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">I</SelectItem>
                                            <SelectItem value="II">II</SelectItem>
                                            <SelectItem value="III">III</SelectItem>
                                            <SelectItem value="IV">IV</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dept">Department</Label>
                                <Input
                                    id="dept"
                                    value={formData.dept}
                                    onChange={e => setFormData({ ...formData, dept: e.target.value })}
                                    placeholder="e.g. CSE, IT, ECE"
                                    className="h-10 rounded-md"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                                    <SelectTrigger className="h-10 rounded-md">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="volunteer">Volunteer</SelectItem>
                                        <SelectItem value="office_bearer">Office Bearer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowEditDialog(false);
                                        setSelectedCandidate(null);
                                        setFormData({ name: "", email: "", phone: "", dept: "", year: "", register_no: "", role: "volunteer" });
                                    }}
                                    className="h-10 rounded-md font-semibold text-sm px-4"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="h-10 rounded-md font-semibold text-sm px-4">
                                    Update Candidate
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <BulkUploadModal
                    isOpen={showBulkUploadDialog}
                    onClose={() => setShowBulkUploadDialog(false)}
                    onSuccess={() => loadCandidates()}
                    uploadFn={(file) => api.bulkUploadCandidates(file)}
                    title="Bulk Candidate Upload"
                    description="Upload Excel/CSV with columns: name, email, phone, department, year, register_no"
                />

                {/* â”€â”€ Admin Submit Marks Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Submit Interview Marks</DialogTitle>
                            <DialogDescription>
                                {selectedCandidate && (
                                    <>Enter marks for <strong>{selectedCandidate.name}</strong> ({selectedCandidate.register_no}). Once submitted the interview is marked as completed.</>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedCandidate && (
                            <form key={`marks-form-${selectedCandidate.id}`} onSubmit={handleSubmitAdminMarks} className="space-y-4">
                                {/* Interview Date + Time */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="adm-interview-date">Interview Date</Label>
                                        <Input
                                            id="adm-interview-date"
                                            type="date"
                                            value={marksData.interview_date || ""}
                                            onChange={(e) => setMarksData({ ...marksData, interview_date: e.target.value })}
                                            className="h-10 rounded-md"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="adm-interview-time">Interview Time</Label>
                                        <Input
                                            id="adm-interview-time"
                                            type="time"
                                            value={marksData.interview_time || ""}
                                            onChange={(e) => setMarksData({ ...marksData, interview_time: e.target.value })}
                                            className="h-10 rounded-md"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Attendance */}
                                <div className="space-y-2">
                                    <Label>Attendance</Label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMarksData({ ...marksData, attendance: "present" })}
                                            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg font-bold text-sm border-2 transition-all duration-200 ${marksData.attendance === "present"
                                                ? "bg-green-500/15 border-green-500 text-green-600"
                                                : "bg-transparent border-border text-muted-foreground hover:border-green-400"
                                                }`}
                                        >
                                            <UserCheck className="w-4 h-4" /> Present
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMarksData({ ...marksData, attendance: "absent" })}
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
                                            <Label htmlFor="adm-marks">Marks (out of 10) *</Label>
                                            <Input
                                                id="adm-marks"
                                                type="number"
                                                min="0"
                                                max="10"
                                                step="0.5"
                                                value={marksData.marks}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const num = parseFloat(val);
                                                    let autoDecision = marksData.decision;
                                                    if (val === "") autoDecision = "";
                                                    else if (!isNaN(num) && num <= 5) autoDecision = "rejected";
                                                    else if (!isNaN(num) && num > 5 && marksData.decision === "rejected") autoDecision = "";
                                                    setMarksData({ ...marksData, marks: val, decision: autoDecision as any });
                                                }}
                                                placeholder="e.g., 7.5"
                                                required
                                                className="h-10 rounded-md"
                                            />
                                            <p className="text-xs text-muted-foreground">Enter marks between 0 and 10</p>
                                        </div>

                                        {/* Decision Category */}
                                        {marksData.marks !== "" && !isNaN(parseFloat(marksData.marks)) && (
                                            parseFloat(marksData.marks) <= 5 ? (
                                                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                                                    <span className="text-lg">❌</span>
                                                    <div>
                                                        <p className="text-sm font-bold text-red-500">Auto Rejected</p>
                                                        <p className="text-xs text-muted-foreground">Marks ≤ 5 — automatically categorised as Rejected</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <Label>Select Category *</Label>
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
                                                    <p className="text-xs text-muted-foreground">Marks &gt; 5 — select the outcome for this candidate</p>
                                                </div>
                                            )
                                        )}

                                        {/* Remarks */}
                                        <div className="space-y-2">
                                            <Label htmlFor="adm-remarks">Remarks / Feedback</Label>
                                            <Textarea
                                                id="adm-remarks"
                                                value={marksData.remarks}
                                                onChange={(e) => setMarksData({ ...marksData, remarks: e.target.value })}
                                                placeholder="Enter feedback or observations about the candidate..."
                                                rows={3}
                                                className="resize-none"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
                                            <p className="text-sm font-bold text-orange-600">Absent Candidate</p>
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
                                    <Button type="submit" disabled={submitting} className="h-10 rounded-md font-semibold text-sm px-4">
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

export default ManageInterviews;
