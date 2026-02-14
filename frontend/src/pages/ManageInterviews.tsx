import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Search, Upload, Mail, CheckCircle, XCircle, Plus, Edit2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BulkUploadModal } from "@/components/BulkUploadModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from 'xlsx';

const ManageInterviews = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dept: "",
        year: "",
        register_no: ""
    });

    // Edit Candidate State
    const [editCandidate, setEditCandidate] = useState<any | null>(null);
    const [editFormData, setEditFormData] = useState({
        status: "",
        interviewer: "",
        marks: 0,
        interview_date: "",
        interview_time: ""
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

    const handleEditClick = (candidate: any) => {
        setEditCandidate(candidate);

        // Get current date and time for defaults
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDate = `${year}-${month}-${day}`;
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM

        // Handle existing date parsing (handle ISO strings or YYYY-MM-DD)
        let existingDate = '';
        if (candidate.interview_date) {
            if (typeof candidate.interview_date === 'string') {
                existingDate = candidate.interview_date.split('T')[0];
            } else {
                // If it's a date object (unlikely from JSON response but possible in some setups)
                const d = new Date(candidate.interview_date);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                existingDate = `${y}-${m}-${dd}`;
            }
        }

        setEditFormData({
            status: candidate.status || 'pending',
            interviewer: candidate.interviewer || '',
            marks: candidate.marks || 0,
            interview_date: existingDate || currentDate,
            interview_time: candidate.interview_time || currentTime
        });
    };

    const handleUpdateCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editCandidate) return;

        try {
            const response = await api.updateCandidate(editCandidate.id, editFormData);
            if (response.success) {
                toast.success("Candidate updated successfully");
                setEditCandidate(null);
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to update candidate");
            }
        } catch (error: any) {
            toast.error("Error: " + error.message);
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

    const filteredCandidates = candidates.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.register_no.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelectAll = () => {
        if (selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0) {
            setSelectedCandidates([]);
        } else {
            setSelectedCandidates(filteredCandidates.map(c => c.id));
        }
    };

    const toggleSelectCandidate = (id: number) => {
        if (selectedCandidates.includes(id)) {
            setSelectedCandidates(selectedCandidates.filter(cId => cId !== id));
        } else {
            setSelectedCandidates([...selectedCandidates, id]);
        }
    };

    const handleSendEmails = async () => {
        if (selectedCandidates.length === 0) return;

        try {
            const response = await api.sendInterviewEmails(selectedCandidates);
            if (response.success) {
                toast.success(`Emails sent to ${response.sentCount} candidates`);
                setSelectedCandidates([]);
                loadCandidates();
            } else {
                toast.error(response.message || "Failed to send emails");
            }
        } catch (error: any) {
            toast.error("Error sending emails: " + error.message);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'selected': return 'bg-green-500 hover:bg-green-600';
            case 'rejected': return 'bg-red-500 hover:bg-red-600';
            case 'interviewed': return 'bg-blue-500 hover:bg-blue-600';
            default: return 'bg-slate-500 hover:bg-slate-600';
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="w-full px-4 md:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <BackButton to="/admin" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Interview Candidates</h1>
                        <p className="text-sm text-muted-foreground mt-1">Manage process registration and status</p>
                    </div>
                    <div className="flex gap-2">
                        {selectedCandidates.length > 0 && (
                            <Button onClick={handleSendEmails} variant="secondary" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                <Mail className="w-4 h-4" />
                                Send Emails ({selectedCandidates.length})
                            </Button>
                        )}
                        <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4" />
                            Add Candidate
                        </Button>
                        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                            <Upload className="w-4 h-4" />
                            Template
                        </Button>
                        <Button onClick={() => setShowBulkUploadDialog(true)} className="gap-2">
                            <Upload className="w-4 h-4" />
                            Bulk Upload
                        </Button>
                    </div>
                </div>

                <Card className="mb-8">
                    <CardContent className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Search by name, email, or register no..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Candidates List</CardTitle>
                        <CardDescription>Total: {filteredCandidates.length}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={filteredCandidates.length > 0 && selectedCandidates.length === filteredCandidates.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Register No</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Meta</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Interviewer</TableHead>
                                    <TableHead>Email Sent</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredCandidates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No candidates found</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCandidates.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedCandidates.includes(c.id)}
                                                    onCheckedChange={() => toggleSelectCandidate(c.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{c.register_no}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{c.name}</div>
                                                <div className="text-xs text-muted-foreground">{c.email}</div>
                                            </TableCell>
                                            <TableCell>{c.phone || '-'}</TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    <span className="font-semibold">{c.dept}</span> • {c.year}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${getStatusBadge(c.status)} capitalize`}>
                                                    {c.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {c.interviewer ? <span className="font-medium text-sm">{c.interviewer}</span> : <span className="text-muted-foreground text-xs italic">Unassigned</span>}
                                                    {c.interview_date && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {c.interview_date} {c.interview_time ? `• ${c.interview_time}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {c.email_sent ? (
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-slate-300" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="icon" variant="ghost" onClick={() => handleEditClick(c)}>
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add Dialog */}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Interview Candidate</DialogTitle>
                            <DialogDescription>Manually add a single candidate to the list.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddCandidate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name *</Label>
                                    <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="regno">Register No *</Label>
                                    <Input id="regno" value={formData.register_no} onChange={e => setFormData({ ...formData, register_no: e.target.value })} required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year</Label>
                                    <Select value={formData.year} onValueChange={v => setFormData({ ...formData, year: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
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
                                <Input id="dept" value={formData.dept} onChange={e => setFormData({ ...formData, dept: e.target.value })} placeholder="e.g. CSE" />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                                <Button type="submit">Add Candidate</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editCandidate} onOpenChange={(open) => !open && setEditCandidate(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Candidate</DialogTitle>
                            <DialogDescription>Update status and interviewer details.</DialogDescription>
                        </DialogHeader>
                        {editCandidate && (
                            <form onSubmit={handleUpdateCandidate} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">{editCandidate.name} ({editCandidate.register_no})</Label>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select value={editFormData.status} onValueChange={v => setEditFormData({ ...editFormData, status: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="interviewed">Interviewed</SelectItem>
                                            <SelectItem value="selected">Selected</SelectItem>
                                            <SelectItem value="rejected">Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-interviewer">Assigned Interviewer</Label>
                                    <Input
                                        id="edit-interviewer"
                                        value={editFormData.interviewer}
                                        onChange={e => setEditFormData({ ...editFormData, interviewer: e.target.value })}
                                        placeholder="Enter interviewer name (must match their login name)"
                                    />
                                    <p className="text-xs text-muted-foreground">Enter the exact name of the office bearer/admin to assign.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-date">Date</Label>
                                        <Input
                                            id="edit-date"
                                            type="date"
                                            value={editFormData.interview_date}
                                            onChange={e => setEditFormData({ ...editFormData, interview_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-time">Time</Label>
                                        <Input
                                            id="edit-time"
                                            type="time"
                                            value={editFormData.interview_time}
                                            onChange={e => setEditFormData({ ...editFormData, interview_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-marks">Marks (Optional)</Label>
                                    <Input
                                        id="edit-marks"
                                        type="number"
                                        value={editFormData.marks}
                                        onChange={e => setEditFormData({ ...editFormData, marks: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setEditCandidate(null)}>Cancel</Button>
                                    <Button type="submit">Save Changes</Button>
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
