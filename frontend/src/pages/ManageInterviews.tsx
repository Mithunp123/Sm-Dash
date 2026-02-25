import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { Search, Upload, Plus, Edit2, UserCheck, UserX, CheckCircle2, Clock } from "lucide-react";
import MailSender from "@/components/MailSender";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BulkUploadModal } from "@/components/BulkUploadModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';

const ManageInterviews = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [officeBearers, setOfficeBearers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dept: "",
        year: "",
        register_no: ""
    });
    const [assignFormData, setAssignFormData] = useState({
        mentor_id: "",
        mentor_name: ""
    });

    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate("/login");
            return;
        }
        loadCandidates();
        loadOfficeBearers();
    }, []);

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
            const response = await api.getOfficeBearers();
            if (response.success) {
                setOfficeBearers(response.officeBearers || []);
            }
        } catch (error: any) {
            console.error("Failed to load office bearers:", error);
        }
    };

    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.addCandidate(formData);
            if (response.success) {
                toast.success("Candidate added successfully");
                setShowAddDialog(false);
                setFormData({ name: "", email: "", phone: "", dept: "", year: "", register_no: "" });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to add candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleAssignMentor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidate || !assignFormData.mentor_id) {
            toast.error("Please select a mentor");
            return;
        }

        try {
            // Use updateCandidate API - backend matches by interviewer name or email
            const selectedMentor = officeBearers.find(ob => ob.id.toString() === assignFormData.mentor_id);
            const mentorName = selectedMentor?.name || assignFormData.mentor_name;
            const mentorEmail = selectedMentor?.email || '';
            
            const response = await api.updateCandidate(selectedCandidate.id, {
                interviewer: mentorName,
                interviewer_email: mentorEmail, // Add email for better matching
                mentor_id: parseInt(assignFormData.mentor_id),
                status: 'assigned' // Set to 'assigned' when mentor is assigned
            });

            if (response.success) {
                toast.success("Mentor assigned successfully");
                setShowAssignDialog(false);
                setSelectedCandidate(null);
                setAssignFormData({ mentor_id: "", mentor_name: "" });
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to assign mentor");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
        }
    };

    const handleOpenAssignDialog = (candidate: any) => {
        // Check if already completed
        if (candidate.status === 'completed') {
            toast.info("Cannot reassign mentor for completed interview.");
            return;
        }

        setSelectedCandidate(candidate);
        setAssignFormData({
            mentor_id: candidate.mentor_id?.toString() || "",
            mentor_name: candidate.interviewer || ""
        });
        setShowAssignDialog(true);
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600 text-white">Completed</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pending Interview</Badge>;
            case 'assigned':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Assigned</Badge>;
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

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="page-title">Interview Candidates</h1>
                        <p className="page-subtitle mt-2 ">Manage candidates and assign mentors for face-to-face interviews</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
                        <MailSender />
                        <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-10 rounded-md font-semibold text-sm px-4 bg-primary text-foreground">
                            <Plus className="w-4 h-4" />
                            Add Candidate
                        </Button>
                        <Button onClick={downloadTemplate} variant="outline" className="gap-2 h-10 rounded-md font-semibold text-sm px-4 text-foreground">
                            <Upload className="w-4 h-4" />
                            Template
                        </Button>
                        <Button onClick={() => setShowBulkUploadDialog(true)} className="gap-2 h-10 rounded-md font-semibold text-sm px-4 bg-primary text-foreground">
                            <Upload className="w-4 h-4" />
                            Bulk Upload
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Total Candidates</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{candidates.length}</p>
                                </div>
                                <UserX className="w-8 h-8 text-slate-500 opacity-60" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Unassigned</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{unassignedCount}</p>
                                </div>
                                <UserX className="w-8 h-8 text-orange-500 opacity-60" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-card shadow-sm rounded-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium">Assigned / Pending</p>
                                    <p className="text-3xl font-black text-primary-foreground tracking-tight mt-2">{assignedCount}</p>
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
                            <div className="text-center py-8 text-muted-foreground">No candidates found</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Register No</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Department & Year</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Assigned Mentor</TableHead>
                                            <TableHead>Marks</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCandidates.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-mono text-xs text-foreground">{c.register_no || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-foreground">{c.name}</div>
                                                    <div className="text-xs text-muted-foreground">{c.email}</div>
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">{c.phone || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-foreground">{c.dept || '-'}</span>
                                                        {c.year && <span className="text-muted-foreground"> • {c.year}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(c.status || '')}</TableCell>
                                                <TableCell>
                                                    {c.interviewer ? (
                                                        <div className="flex items-center gap-2">
                                                            <UserCheck className="w-4 h-4 text-green-500" />
                                                            <span className="text-sm font-medium text-foreground">{c.interviewer}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <UserX className="w-4 h-4 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {c.status === 'completed' && c.marks !== null ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-foreground">{c.marks}</span>
                                                            {c.remarks && (
                                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={c.remarks}>
                                                                    {c.remarks}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleOpenAssignDialog(c)}
                                                        disabled={c.status === 'completed'}
                                                        className="h-10 rounded-md font-semibold text-sm px-4"
                                                    >
                                                        {c.interviewer ? <Edit2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                        {c.interviewer ? ' Reassign' : ' Assign'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

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
                                    <Label htmlFor="mentor">Select Mentor / Interviewer *</Label>
                                    <Select
                                        value={assignFormData.mentor_id}
                                        onValueChange={(value) => {
                                            const mentor = officeBearers.find(ob => ob.id.toString() === value);
                                            setAssignFormData({
                                                mentor_id: value,
                                                mentor_name: mentor ? mentor.name : ""
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

                <BulkUploadModal
                    isOpen={showBulkUploadDialog}
                    onClose={() => setShowBulkUploadDialog(false)}
                    onSuccess={() => loadCandidates()}
                    uploadFn={(file) => api.bulkUploadCandidates(file)}
                    title="Bulk Candidate Upload"
                    description="Upload Excel/CSV with columns: name, email, phone, department, year, register_no"
                />
            </div>
        </div>
    );
};

export default ManageInterviews;
