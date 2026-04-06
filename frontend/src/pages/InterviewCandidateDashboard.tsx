import { useState, useEffect } from 'react';
import { BackButton } from '@/components/BackButton';
import DeveloperCredit from '@/components/DeveloperCredit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';
import { Users, Download, Plus, Upload, Search, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InterviewCandidateDashboard = () => {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ total: 0, pending: 0, assigned: 0, selected: 0, rejected: 0 });
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [showMarksDialog, setShowMarksDialog] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
    const [mentors, setMentors] = useState<any[]>([]);
    const [marks, setMarks] = useState({ technical: 0, communication: 0, problem_solving: 0 });
    const [assigningCandidateId, setAssigningCandidateId] = useState<number | null>(null);
    const [departments, setDepartments] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>(['I', 'II', 'III', 'IV']);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [selectedMentorId, setSelectedMentorId] = useState<string>('');

    // Form state for add candidate
    const [formData, setFormData] = useState({ name: '', department: '', year: '', phone: '', email: '' });

    // Role check
    useEffect(() => {
        if (!auth.isAuthenticated()) {
            navigate('/login');
            return;
        }

        const user = auth.getUser();
        const userRole = user?.role;
        const isInterviewer = user?.is_interviewer;
        
        // Allow admins, mentors, or anyone flagged as interviewer
        if (userRole !== 'admin' && userRole !== 'mentor' && !isInterviewer) {
            navigate('/');
            return;
        }

        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [candidatesRes, statsRes, mentorsRes, deptRes, yearsRes] = await Promise.all([
                api.getCandidates(),
                api.getInterviewStats(),
                auth.getUser()?.role === 'admin' ? api.getMentors() : Promise.resolve({ success: true, mentors: [] }),
                api.getDepartments(),
                api.getYears()
            ]);

            if (candidatesRes.success) {
                setCandidates(candidatesRes.candidates || []);
            }
            if (statsRes.success) {
                setStats(statsRes.stats || {});
            }
            if (mentorsRes.success) {
                setMentors(mentorsRes.mentors || []);
            }
            if (deptRes.success) {
                setDepartments(deptRes.departments || ['IT', 'CSE', 'ECE']);
            }
            if (yearsRes.success) {
                setYears(yearsRes.years || ['I', 'II', 'III', 'IV']);
            }
        } catch (error) {
            toast.error('Failed to load data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCandidate = async () => {
        if (!formData.name || !formData.phone || !formData.email || !formData.department || !formData.year) {
            toast.error('All fields are required');
            return;
        }

        try {
            const res = await api.addCandidate(formData);
            if (res.success) {
                toast.success('Candidate added successfully');
                setFormData({ name: '', department: '', year: '', phone: '', email: '' });
                setShowAddDialog(false);
                loadData();
            } else {
                toast.error(res.message || 'Failed to add candidate');
            }
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        const file = (e.target as HTMLFormElement).file?.files?.[0];
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        try {
            const res = await api.bulkUploadCandidates(file);
            if (res.success) {
                toast.success(`Uploaded: ${res.stats.added} added, ${res.stats.skipped} skipped, ${res.stats.failed} failed`);
                setShowBulkDialog(false);
                loadData();
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleAssignMentor = async (candidateId?: number, mentorId?: number) => {
        try {
            const cId = candidateId || selectedCandidate?.id;
            const mId = mentorId || parseInt(selectedMentorId);
            
            if (!cId || !mId) {
                toast.error('Please select both candidate and mentor');
                return;
            }

            const res = await api.assignMentor(cId, mId);
            if (res.success) {
                toast.success('✅ ' + res.message);
                setShowAssignDialog(false);
                setSelectedMentorId('');
                setAssigningCandidateId(null);
                loadData();
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleSubmitMarks = async () => {
        if (marks.technical === 0 || marks.communication === 0 || marks.problem_solving === 0) {
            toast.error('Please enter all marks');
            return;
        }

        if (!selectedCandidate) return;

        try {
            const res = await api.submitMarks(selectedCandidate.id, marks);
            if (res.success) {
                toast.success(`Marks submitted. Result: ${res.candidate.status.toUpperCase()}`);
                setShowMarksDialog(false);
                setMarks({ technical: 0, communication: 0, problem_solving: 0 });
                loadData();
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const filteredCandidates = candidates.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'assigned': return 'bg-blue-100 text-blue-800';
            case 'selected': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full">Loading...</div>;
    }

    const userRole = auth.getUser()?.role;

    return (
        <div className="flex-1 flex flex-col bg-transparent">
            <DeveloperCredit />
            <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <div className="w-full px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
                    {/* Header */}
                    <div className="mb-6 flex items-end justify-between border-b pb-4">
                        <div>
                            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">
                                Interview <span className="text-primary/40">Candidates</span>
                            </h1>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Manage and evaluate interview candidates
                            </p>
                        </div>
                        {userRole === 'admin' && (
                            <div className="flex gap-2">
                                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                                    <Plus className="w-4 h-4" /> Add Candidate
                                </Button>
                                <Button onClick={() => setShowBulkDialog(true)} variant="outline" className="gap-2">
                                    <Upload className="w-4 h-4" /> Bulk Upload
                                </Button>
                                <Button onClick={() => api.downloadSampleCsv()} variant="outline" className="gap-2">
                                    <Download className="w-4 h-4" /> Sample
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-5 gap-4 mb-6">
                        {[
                            { label: 'Total', value: stats.total, color: 'text-gray-600' },
                            { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
                            { label: 'Assigned', value: stats.assigned, color: 'text-blue-600' },
                            { label: 'Selected', value: stats.selected, color: 'text-green-600' },
                            { label: 'Rejected', value: stats.rejected, color: 'text-red-600' }
                        ].map((stat, i) => (
                            <Card key={i} className="bg-card/50 backdrop-blur-sm border border-border/50">
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                        <Input
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-card/50 backdrop-blur-sm"
                            icon={<Search className="w-4 h-4" />}
                        />
                    </div>

                    {/* Candidates Table */}
                    <Card className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
                        <div className="overflow-auto h-full">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Dept</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Mentor</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCandidates.map((candidate) => (
                                        <tr key={candidate.id} className="border-b border-border/20 hover:bg-muted/30 transition">
                                            <td className="px-4 py-3">{candidate.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{candidate.email}</td>
                                            <td className="px-4 py-3 text-sm">{candidate.phone}</td>
                                            <td className="px-4 py-3 text-sm">{candidate.dept}</td>
                                            <td className="px-4 py-3">
                                                <Badge className={getStatusColor(candidate.status)}>
                                                    {candidate.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {candidate.status === 'pending' && userRole === 'admin' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedCandidate(candidate);
                                                            setShowAssignDialog(true);
                                                        }}
                                                    >
                                                        Assign
                                                    </Button>
                                                ) : (
                                                    candidate.assigned_mentor_name || '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{candidate.total || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {userRole === 'mentor' && candidate.assigned_mentor_id === auth.getUser()?.id && candidate.status === 'assigned' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedCandidate(candidate);
                                                            setShowMarksDialog(true);
                                                        }}
                                                    >
                                                        Enter Marks
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </main>

            {/* Add Candidate Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Candidate</DialogTitle>
                        <DialogDescription>Add a candidate for the interview process</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full name" />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
                        </div>
                        <div>
                            <Label>Phone (10 digits)</Label>
                            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210" />
                        </div>
                        <div>
                            <Label>Department</Label>
                            <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept} value={dept}>
                                            {dept}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Year</Label>
                            <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select year..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            Year {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAddCandidate} className="w-full">Add Candidate</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bulk Upload Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bulk Upload Candidates</DialogTitle>
                        <DialogDescription>Upload CSV or XLSX file (Name, Department, Year, Phone, Email)</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBulkUpload} className="space-y-4">
                        <Input type="file" name="file" accept=".csv,.xlsx" required />
                        <Button type="submit" className="w-full">Upload</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Enter Marks Dialog */}
            <Dialog open={showMarksDialog} onOpenChange={setShowMarksDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enter Marks</DialogTitle>
                        <DialogDescription>Evaluate {selectedCandidate?.name} (Max 10 each)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Technical (0-10)</Label>
                            <Input type="number" min="0" max="10" step="0.5" value={marks.technical} onChange={(e) => setMarks({ ...marks, technical: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                            <Label>Communication (0-10)</Label>
                            <Input type="number" min="0" max="10" step="0.5" value={marks.communication} onChange={(e) => setMarks({ ...marks, communication: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                            <Label>Problem Solving (0-10)</Label>
                            <Input type="number" min="0" max="10" step="0.5" value={marks.problem_solving} onChange={(e) => setMarks({ ...marks, problem_solving: parseFloat(e.target.value) })} />
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                            <p>Total: {marks.technical + marks.communication + marks.problem_solving}</p>
                            <p>Result: {(marks.technical + marks.communication + marks.problem_solving) >= 15 ? '✅ SELECTED' : '❌ REJECTED'}</p>
                        </div>
                        <Button onClick={handleSubmitMarks} className="w-full">Submit Marks</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assign Mentor Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Mentor</DialogTitle>
                        <DialogDescription>Assign a mentor to {selectedCandidate?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Select Mentor</Label>
                            <Select value={selectedMentorId} onValueChange={setSelectedMentorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select mentor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {mentors.map((mentor) => (
                                        <SelectItem key={mentor.id} value={mentor.id.toString()}>
                                            {mentor.name} ({mentor.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => handleAssignMentor()} className="w-full">Assign Mentor</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InterviewCandidateDashboard;
