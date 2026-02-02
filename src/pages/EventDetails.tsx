
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Edit, Trash2, Upload, Plus, Users, Save, Download, UserPlus } from "lucide-react";
import * as XLSX from 'xlsx';
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";

const EventDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]); // Assigned Students (OD)
    const [volunteers, setVolunteers] = useState<any[]>([]); // Registered Volunteers
    const [students, setStudents] = useState<any[]>([]); // All students for assignment
    const [activeTab, setActiveTab] = useState("overview");

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    // Dialogs
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [assignStudentId, setAssignStudentId] = useState<string>("");

    useEffect(() => {
        if (id) {
            loadEventData();
        }
    }, [id]);

    const loadEventData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const pid = parseInt(id);
            const res = await api.getEventById(pid);

            if (res.success && res.event) {
                const foundEvent = res.event;
                setEvent(foundEvent);
                setEditForm(foundEvent);

                // Load Members (OD)
                const membersRes = await api.getEventMembers(foundEvent.id);
                if (membersRes.success) setMembers(membersRes.members || []);

                // Load Volunteers
                const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                try {
                    const volRes = await fetch(`${API_BASE}/events/${foundEvent.id}/volunteers`, {
                        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                    });
                    if (volRes.ok) {
                        const vData = await volRes.json();
                        if (vData.success) setVolunteers(vData.volunteers || []);
                    }
                } catch (e) { console.error(e); }
            } else {
                toast.error("Event not found");
            }

            // Load all students
            const sRes = await api.getStudentsScoped();
            if (sRes.success) setStudents(sRes.students || sRes.users || []);

        } catch (e: any) {
            toast.error("Error loading event: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEvent = async () => {
        if (!event) return;
        // Same logic as ManageEvents handleEditEvent
        toast.info("Update logic goes here");
        setEvent({ ...event, ...editForm });
        setIsEditing(false);
    };

    const handleAssignMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event || !assignStudentId) return;
        try {
            await api.addEventMembers(event.id, [parseInt(assignStudentId)]);
            toast.success("Student assigned");
            setAssignStudentId("");
            setShowAssignDialog(false);
            // reload members
            const res = await api.getEventMembers(event.id);
            if (res.success) setMembers(res.members || []);
        } catch (e: any) {
            toast.error("Failed to assign");
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!event) return;
        if (!confirm("Remove student from OD list?")) return;
        try {
            await api.removeEventMember(event.id, userId);
            setMembers(prev => prev.filter(m => m.user_id !== userId));
            toast.success("Removed");
        } catch (e: any) {
            toast.error("Failed to remove");
        }
    };

    const downloadVolunteersExcel = () => {
        if (volunteers.length === 0) return toast.error("No data");
        const ws = XLSX.utils.json_to_sheet(volunteers.map((v, i) => ({
            "S.No": i + 1, Name: v.name, Dept: v.department, Year: v.year, Phone: v.phone
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Volunteers");
        XLSX.writeFile(wb, `Volunteers_${event.title}.xlsx`);
    };

    if (loading) return <div className="flex justify-center p-8">Loading...</div>;
    if (!event) return <div className="flex justify-center p-8">Event not found</div>;

    const availableStudents = students.filter(s => !members.find(m => m.user_id === s.id));

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-4 md:p-8 w-full">
                <div className="mb-4">
                    <BackButton to="/admin/events" /> {/* Need to verify route */}
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-primary" />
                            {event.title}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {new Date(event.date).toLocaleDateString()} • {event.year}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button onClick={handleSaveEvent}><Save className="w-4 h-4 mr-2" /> Save</Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" /> Edit Details</Button>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="overview" className="w-full space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="od">OD Students ({members.length})</TabsTrigger>
                        <TabsTrigger value="volunteers">Volunteers ({volunteers.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <Card>
                            <CardHeader><CardTitle>Event Overview</CardTitle></CardHeader>
                            <CardContent>
                                {isEditing ? (
                                    <div className="space-y-4 max-w-xl">
                                        <div className="grid gap-2">
                                            <Label>Title</Label>
                                            <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Description</Label>
                                            <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label>Date</Label>
                                                <Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Year</Label>
                                                <Input value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="font-semibold mb-2">Description</h3>
                                            <p className="text-muted-foreground">{event.description || "No description."}</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <Badge variant={event.is_special_day ? "default" : "outline"}>
                                                {event.is_special_day ? "Special Day" : "Regular Event"}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="od">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>On-Duty Students</CardTitle>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => setShowAssignDialog(true)}>
                                        <Plus className="w-4 h-4 mr-2" /> Assign Student
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map(m => (
                                            <TableRow key={m.user_id}>
                                                <TableCell className="font-medium">{m.name}</TableCell>
                                                <TableCell>{m.email}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.user_id)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {members.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No students assigned.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="volunteers">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Registered Volunteers</CardTitle>
                                <Button size="sm" variant="outline" onClick={downloadVolunteersExcel}>
                                    <Download className="w-4 h-4 mr-2" /> Export Excel
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Dept</TableHead>
                                            <TableHead>Year</TableHead>
                                            <TableHead>Phone</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {volunteers.map((v, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{v.name}</TableCell>
                                                <TableCell>{v.department}</TableCell>
                                                <TableCell>{v.year}</TableCell>
                                                <TableCell>{v.phone}</TableCell>
                                            </TableRow>
                                        ))}
                                        {volunteers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No volunteers registered.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Assign Student</DialogTitle></DialogHeader>
                        <form onSubmit={handleAssignMember} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Student</Label>
                                <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        {availableStudents.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.email})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" disabled={!assignStudentId}>Assign</Button>
                        </form>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
};

export default EventDetails;
