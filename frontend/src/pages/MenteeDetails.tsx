
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, Edit, User, Phone, MapPin, School, Calendar, History, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";

const MenteeDetails = () => {
    const { projectId, id } = useParams<{ projectId: string; id: string }>();
    const navigate = useNavigate();
    const [mentee, setMentee] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    // History
    const [historyType, setHistoryType] = useState<'updates' | 'attendance'>('updates');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Metadata
    const [volunteers, setVolunteers] = useState<any[]>([]);

    useEffect(() => {
        if (projectId && id) {
            loadMenteeData();
        }
    }, [projectId, id]);

    useEffect(() => {
        if (mentee) {
            loadHistory(historyType);
        }
    }, [mentee, historyType]);

    const loadMenteeData = async () => {
        if (!projectId || !id) return;
        setLoading(true);
        try {
            const pid = parseInt(projectId);
            const mid = parseInt(id);

            // Get Mentees for project to find specific one
            const res = await api.getProjectMentees(pid);
            if (res.success && res.mentees) {
                const found = res.mentees.find((m: any) => m.id === mid);
                if (found) {
                    setMentee(found);
                    setEditForm(found);
                } else {
                    toast.error("Mentee not found");
                }
            }

            // Load volunteers for assignment
            // Assuming getProjectStudents returns potential mentors
            const vRes = await api.getProjectStudents(pid);
            if (vRes.success) setVolunteers(vRes.students || []);

        } catch (e: any) {
            toast.error("Error loading mentee: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async (type: 'updates' | 'attendance') => {
        if (!mentee || !projectId) return;
        setHistoryLoading(true);
        try {
            if (type === 'updates') {
                const res = await api.getMenteeUpdates(parseInt(projectId!), mentee.id);
                if (res.success) setHistoryData(res.updates || []);
            } else {
                const res = await api.getMenteeAttendance(parseInt(projectId!), mentee.id);
                if (res.success) setHistoryData(res.attendance || []);
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSaveMentee = async () => {
        if (!mentee || !projectId) return;
        try {
            const payload = {
                ...editForm,
                project_id: parseInt(projectId!), // ensure project id is sent if needed, though mostly implicit in URL
                volunteer_id: editForm.volunteer_id ? parseInt(editForm.volunteer_id) : null
            };
            // Remove fields that shouldn't be sent or ensure they are correct format
            // The API expects specific fields.
            // From MentorManagement.tsx:
            /*
              mentee_name: menteeForm.mentee_name.trim(),
              mentee_phone: menteeForm.mentee_phone?.trim() || null,
              mentee_year: menteeForm.mentee_year?.trim() || null,
              mentee_gender: menteeForm.mentee_gender || null,
              mentee_school: menteeForm.mentee_school?.trim() || null,
              mentee_district: menteeForm.mentee_district?.trim() || null,
              mentee_address: menteeForm.mentee_address?.trim() || null,
              mentee_parent_contact: menteeForm.mentee_parent_contact?.trim() || null,
              mentee_status: menteeForm.mentee_status || "active",
              mentee_notes: menteeForm.mentee_notes?.trim() || null,
              volunteer_id: null, // MentorManagement sets this to null when updating generally? Logic looks complex.
              // Ah, `volunteer_id: null` in MentorManagement lines 346. Maybe it handles assignment separately?
              // But let's try to send what we have.
            */

            const updatePayload = {
                mentee_name: editForm.mentee_name,
                mentee_phone: editForm.mentee_phone,
                mentee_year: editForm.mentee_year,
                mentee_gender: editForm.mentee_gender,
                mentee_school: editForm.mentee_school,
                mentee_district: editForm.mentee_district,
                mentee_address: editForm.mentee_address,
                mentee_parent_contact: editForm.mentee_parent_contact,
                mentee_status: editForm.mentee_status,
                mentee_notes: editForm.mentee_notes,
                volunteer_id: editForm.volunteer_id,
                expected_classes: editForm.expected_classes
            };

            const res = await api.updateProjectMentee(parseInt(projectId!), mentee.id, updatePayload);
            if (res.success) {
                toast.success("Updated successfully");
                setIsEditing(false);
                setMentee({ ...mentee, ...updatePayload });
            } else {
                toast.error(res.message || "Failed to update");
            }
        } catch (e: any) {
            toast.error("Failed to update: " + e.message);
        }
    };

    if (loading) return <div className="flex justify-center p-8">Loading...</div>;
    if (!mentee) return <div className="flex justify-center p-8">Mentee not found</div>;

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-4 md:p-8 w-full">
                <div className="mb-4">

                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                            <User className="w-8 h-8 text-primary" />
                            {mentee.mentee_name}
                        </h1>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="flex items-center gap-1"><School className="w-4 h-4" /> {mentee.mentee_school || "No School"}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {mentee.mentee_district || "No District"}</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button onClick={handleSaveMentee}><Save className="w-4 h-4 mr-2" /> Save</Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" /> Edit Details</Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Details */}
                    <Card className="md:col-span-1 h-fit">
                        <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {isEditing ? (
                                <div className="space-y-3">
                                    <div className="grid gap-1"><Label>Name</Label><Input value={editForm.mentee_name} onChange={e => setEditForm({ ...editForm, mentee_name: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>Phone</Label><Input value={editForm.mentee_phone || ''} onChange={e => setEditForm({ ...editForm, mentee_phone: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>Year/Class</Label><Input value={editForm.mentee_year || ''} onChange={e => setEditForm({ ...editForm, mentee_year: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>Gender</Label>
                                        <Select value={editForm.mentee_gender || ''} onValueChange={v => setEditForm({ ...editForm, mentee_gender: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1"><Label>School</Label><Input value={editForm.mentee_school || ''} onChange={e => setEditForm({ ...editForm, mentee_school: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>District</Label><Input value={editForm.mentee_district || ''} onChange={e => setEditForm({ ...editForm, mentee_district: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>Parent Contact</Label><Input value={editForm.mentee_parent_contact || ''} onChange={e => setEditForm({ ...editForm, mentee_parent_contact: e.target.value })} /></div>
                                    <div className="grid gap-1"><Label>Volunteer (Mentor)</Label>
                                        <Select value={editForm.volunteer_id ? editForm.volunteer_id.toString() : ''} onValueChange={v => setEditForm({ ...editForm, volunteer_id: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select Mentor" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                {volunteers.map(v => (
                                                    <SelectItem key={v.user_id} value={v.user_id.toString()}>{v.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 text-sm">
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                                        <span className="text-muted-foreground">Status</span>
                                        <Badge variant={mentee.mentee_status === 'active' ? 'default' : 'secondary'}>{mentee.mentee_status}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                                        <span className="text-muted-foreground">Phone</span>
                                        <span className="font-medium">{mentee.mentee_phone || '—'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                                        <span className="text-muted-foreground">Class</span>
                                        <span className="font-medium">{mentee.mentee_year || '—'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                                        <span className="text-muted-foreground">Parent</span>
                                        <span className="font-medium">{mentee.mentee_parent_contact || '—'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                                        <span className="text-muted-foreground">Assigned Mentor</span>
                                        <span className="font-medium text-primary">{mentee.volunteer_name || 'Unassigned'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Address</span>
                                        <p className="text-foreground">{mentee.mentee_address || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Notes</span>
                                        <p className="text-foreground italic">{mentee.mentee_notes || '—'}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right Column: History */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>History & Progress</CardTitle>
                                <div className="flex gap-2">
                                    <Button size="sm" variant={historyType === 'updates' ? 'default' : 'outline'} onClick={() => setHistoryType('updates')}>Updates</Button>
                                    <Button size="sm" variant={historyType === 'attendance' ? 'default' : 'outline'} onClick={() => setHistoryType('attendance')}>Attendance</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="py-8 text-center flex justify-center"><Loader2 className="animate-spin w-6 h-6" /></div>
                            ) : historyData.length === 0 ? (
                                <div className="py-8 text-center text-muted-foreground">No records found.</div>
                            ) : (
                                <div className="space-y-4">
                                    {historyType === 'updates' ? historyData.map((row: any) => (
                                        <div key={row.id} className="border rounded-lg p-4 space-y-1">
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>{new Date(row.update_date).toLocaleDateString()}</span>
                                                <Badge variant="outline">{row.status}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{row.explanation}</p>
                                        </div>
                                    )) : historyData.map((row: any) => (
                                        <div key={row.id} className="border rounded-lg p-4 space-y-1">
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>{new Date(row.attendance_date || row.date).toLocaleDateString()}</span>
                                                <Badge variant={row.status === 'PRESENT' ? 'default' : 'secondary'}>{row.status}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{row.notes}</p>
                                            {row.call_recording_path && (
                                                <div className="mt-2 text-xs">
                                                    <audio controls src={row.call_recording_path} className="w-full h-8" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </main>
        </div>
    );
};

export default MenteeDetails;
