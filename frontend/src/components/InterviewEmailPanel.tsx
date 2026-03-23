import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Eye, Send, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Candidate {
    id: number;
    name: string;
    email: string;
    marks?: number;
    decision?: string;
    status: string;
    email_sent: number;
    dept?: string;
    year?: string;
    register_no?: string;
    created_at?: string;
}

interface EmailPreview {
    email: string;
    name: string;
    subject: string;
    html: string;
    emailType: string;
}

interface InterviewEmailPanelProps {
    emailType?: 'registration' | 'outcome';
}

export default function InterviewEmailPanel({ emailType = 'registration' }: InterviewEmailPanelProps) {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [sendingEmails, setSendingEmails] = useState(false);
    const [currentEmailType, setCurrentEmailType] = useState(emailType);
    const [searchQuery, setSearchQuery] = useState("");
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");

    useEffect(() => {
        fetchCandidates();
    }, [currentEmailType]);

    const fetchCandidates = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/interviews/admin/email-candidates?type=${currentEmailType}`);
            if (response.success) {
                setCandidates(response.candidates || []);
            }
        } catch (error) {
            console.error('Error fetching candidates:', error);
            toast.error('Failed to load candidates');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(candidates.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectCandidate = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds([...selectedIds, id]);
        } else {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        }
    };

    const handlePreviewEmail = async (candidateId: number) => {
        try {
            setPreviewLoading(true);
            const response = await api.post('/api/interviews/admin/preview-email', {
                candidateId,
                emailType: currentEmailType
            });
            if (response.success) {
                setPreviewData(response.preview);
                setEditSubject(response.preview.subject);
                setEditBody(response.preview.html);
                setShowPreviewModal(true);
            }
        } catch (error) {
            console.error('Error fetching preview:', error);
            toast.error('Failed to load email preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSendEmails = async () => {
        if (selectedIds.length === 0) {
            toast.error('Please select at least one candidate');
            return;
        }

        try {
            setSendingEmails(true);
            const response = await api.post('/api/interviews/admin/send-outcome-emails', {
                candidateIds: selectedIds,
                emailType: currentEmailType
            });
            if (response.success) {
                toast.success(`Emails sent to ${response.sentCount} candidates`);
                setSelectedIds([]);
                fetchCandidates();
            }
        } catch (error) {
            console.error('Error sending emails:', error);
            toast.error('Failed to send emails');
        } finally {
            setSendingEmails(false);
        }
    };

    const filteredCandidates = candidates.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const unsentCount = filteredCandidates.filter(c => !c.email_sent).length;
    const sentCount = filteredCandidates.filter(c => c.email_sent).length;

    return (
        <div className="space-y-4">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Total Candidates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{filteredCandidates.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Emails Sent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-600">{sentCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-red-600">{unsentCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="w-5 h-5" />
                                Email Management
                            </CardTitle>
                            <CardDescription>
                                {currentEmailType === 'registration' 
                                    ? 'Send interview registration emails' 
                                    : 'Send interview outcome emails'}
                            </CardDescription>
                        </div>
                        <Select value={currentEmailType} onValueChange={(value) => setCurrentEmailType(value as 'registration' | 'outcome')}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="registration">Registration Email</SelectItem>
                                <SelectItem value="outcome">Outcome Email</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <Button 
                            onClick={handleSendEmails}
                            disabled={selectedIds.length === 0 || sendingEmails}
                            className="gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Send to {selectedIds.length} Selected
                        </Button>
                        {selectedIds.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => setSelectedIds([])}
                            >
                                Clear Selection
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Candidates Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Candidates</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center text-muted-foreground py-8">Loading candidates...</p>
                    ) : filteredCandidates.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No candidates found</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        {currentEmailType === 'outcome' && <TableHead>Decision</TableHead>}
                                        <TableHead>Status</TableHead>
                                        <TableHead>Email Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCandidates.map(candidate => (
                                        <TableRow key={candidate.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.includes(candidate.id)}
                                                    onCheckedChange={(checked) => 
                                                        handleSelectCandidate(candidate.id, checked as boolean)
                                                    }
                                                    disabled={candidate.email_sent && currentEmailType === 'registration'}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{candidate.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{candidate.email}</TableCell>
                                            {currentEmailType === 'outcome' && (
                                                <TableCell>
                                                    <Badge variant={
                                                        candidate.decision === 'selected' ? 'default' : 
                                                        candidate.decision === 'rejected' ? 'destructive' : 
                                                        'secondary'
                                                    }>
                                                        {candidate.decision || 'Pending'}
                                                    </Badge>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <Badge variant="outline">{candidate.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {candidate.email_sent ? (
                                                    <div className="flex items-center gap-2 text-green-600">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        <span className="text-sm">Sent</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle className="w-4 h-4" />
                                                        <span className="text-sm">Not Sent</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handlePreviewEmail(candidate.id)}
                                                    disabled={previewLoading}
                                                    className="gap-1"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Preview
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

            {/* Preview Modal */}
            <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
                <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Email Preview</DialogTitle>
                        <DialogDescription>
                            Review the email before sending
                        </DialogDescription>
                    </DialogHeader>
                    
                    {previewData && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="preview-to">To:</Label>
                                <Input
                                    id="preview-to"
                                    value={previewData.email}
                                    disabled
                                    className="mt-1"
                                />
                            </div>
                            
                            <div>
                                <Label htmlFor="preview-subject">Subject:</Label>
                                <Input
                                    id="preview-subject"
                                    value={editSubject}
                                    onChange={(e) => setEditSubject(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="preview-body">Body:</Label>
                                <div className="mt-1 p-4 border rounded-lg bg-muted/50 max-h-64 overflow-y-auto">
                                    <div 
                                        dangerouslySetInnerHTML={{ __html: editBody }}
                                        className="text-sm text-muted-foreground"
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-800">
                                    This is a preview. Click "Send to Selected" to send emails to all selected candidates.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
