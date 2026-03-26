
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

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Edit, Trash2, Upload, Plus, Users, Save, Download, UserPlus } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import ksrctLogo from "../assets/images/Brand_logo.png";
import smLogo from "../assets/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png";

const EventDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]); // Assigned Students (OD)
    const [volunteers, setVolunteers] = useState<any[]>([]); // Registered Volunteers
    const [registrations, setRegistrations] = useState<any[]>([]); // New state for all registrations
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

            // Load Registrations
            try {
                const regRes = await api.getEventRegistrations(pid);
                if (regRes.success) setRegistrations(regRes.registrations || []);
            } catch (e) { console.error(e); }

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

    const downloadODSample = () => {
        const sampleData = [
            { "Name": "Student One", "Department": "CSE", "Year": "IV" },
            { "Name": "Student Two", "Department": "ECE", "Year": "III" }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "OD_Import_Template.xlsx");
    };

    const handleImportOD = async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const parsedData: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (parsedData.length === 0) {
                toast.error("File is empty");
                return;
            }

            const matchedUserIds: number[] = [];
            let notFoundCount = 0;

            parsedData.forEach(row => {
                const name = row['Name'] || row['name'];
                const dept = row['Department'] || row['department'] || row['Dept'];
                const year = row['Year'] || row['year'];

                let student = null;

                if (name) {
                    // Normalize name
                    const searchName = name.toString().toLowerCase().trim();

                    // Filter students by name match
                    const potentialMatches = students.filter(s =>
                        s.name?.toLowerCase().trim() === searchName
                    );

                    if (potentialMatches.length === 1) {
                        // Exact single match on name
                        student = potentialMatches[0];
                    } else if (potentialMatches.length > 1) {
                        // Multiple matches, try to narrow down by Dept/Year if available
                        student = potentialMatches.find(s => {
                            let match = true;
                            if (dept && s.department) {
                                match = match && s.department.toLowerCase().includes(dept.toString().toLowerCase());
                            }
                            if (year && s.year) {
                                match = match && s.year.toString() === year.toString();
                            }
                            return match;
                        });
                    }
                }

                if (student) {
                    matchedUserIds.push(student.id);
                } else {
                    notFoundCount++;
                }
            });

            if (matchedUserIds.length === 0) {
                toast.error("No matching students found. Ensure names match exactly.");
                return;
            }

            // Bulk assign
            await api.addEventMembers(event.id, matchedUserIds);

            toast.success(`Successfully imported ${matchedUserIds.length} students. ${notFoundCount > 0 ? `${notFoundCount} entries not found or ambiguous.` : ''}`);
            setShowAssignDialog(false);

            // Reload members
            const res = await api.getEventMembers(event.id);
            if (res.success) setMembers(res.members || []);

        } catch (e: any) {
            console.error("Import error:", e);
            toast.error("Failed to process Excel file: " + e.message);
        }
    };

    const downloadVolunteersPDF = () => {
        if (volunteers.length === 0) return toast.error("No data");

        const doc = new jsPDF();

        // Load logos (using standard public paths)
        // If these fail, the PDF will just generate without them or with placeholders
        // Note: For a real app, ensure images are accessible or convert to base64
        try {
            doc.addImage(ksrctLogo, 'PNG', 15, 10, 25, 25);
        } catch (e) { console.warn("Could not load KSRCT logo", e); }

        try {
            doc.addImage(smLogo, 'PNG', 170, 10, 25, 25);
        } catch (e) { console.warn("Could not load SM logo", e); }

        // Centered Header Text
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("K.S.Rangasamy College of Technology", 105, 20, { align: "center" });

        doc.setFontSize(12);
        doc.text("(Autonomous)", 105, 26, { align: "center" });

        doc.setFontSize(14);
        doc.text(event.title || "Event Name", 105, 35, { align: "center" });

        doc.setFontSize(12);
        doc.text("Attendance Sheet", 105, 42, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dateStr = new Date(event.date).toLocaleDateString();
        doc.text(`Date: ${dateStr}`, 105, 48, { align: "center" });

        // Table
        const tableColumn = ["S.No", "Name", "Dept", "Year", "Phone", "Signature"];
        const tableRows: any[] = [];

        volunteers.forEach((v, index) => {
            const volunteerData = [
                index + 1,
                v.name,
                v.department,
                v.year,
                v.phone,
                "" // Empty signature column
            ];
            tableRows.push(volunteerData);
        });

        // @ts-ignore
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }, // Greenish header or customize as needed
            columnStyles: {
                0: { cellWidth: 15 }, // S.No
                5: { cellWidth: 35 }  // Signature
            },
            styles: {
                minCellHeight: 10, // More space for signature
                valign: 'middle'
            }
        });

        doc.save(`Attendance_${event.title}.pdf`);
    };

    const downloadVolunteersExcel = () => {
        if (volunteers.length === 0) return toast.error("No data");
        const ws = XLSX.utils.json_to_sheet(volunteers.map((v, i) => ({
            "S.No": i + 1, Name: v.name, Dept: v.department, Year: v.year, Phone: v.phone, Signature: ""
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Volunteers");
        XLSX.writeFile(wb, `Volunteers_${event.title}.xlsx`);
    };

    const downloadODPDF = () => {
        if (members.length === 0) return toast.error("No OD students found");

        const doc = new jsPDF();

        try {
            doc.addImage(ksrctLogo, 'PNG', 15, 10, 25, 25);
            doc.addImage(smLogo, 'PNG', 170, 10, 25, 25);
        } catch (e) {
            console.warn("Logo error", e);
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("K.S.Rangasamy College of Technology", 105, 20, { align: "center" });

        doc.setFontSize(12);
        doc.text("(Autonomous)", 105, 26, { align: "center" });

        doc.setFontSize(14);
        doc.text(event.title || "Event Name", 105, 35, { align: "center" });

        doc.setFontSize(12);
        doc.text("On-Duty Permission List", 105, 42, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dateStr = new Date(event.date).toLocaleDateString();
        doc.text(`Event Date: ${dateStr}`, 105, 48, { align: "center" });

        const tableColumn = ["S.No", "Name", "Department", "Year", "Signature"];
        const tableRows: any[] = [];

        members.forEach((m, index) => {
            tableRows.push([
                index + 1,
                m.name,
                m.department || m.dept || "-",
                m.year || "-",
                ""
            ]);
        });

        // @ts-ignore
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }, // Blue for OD
            columnStyles: {
                0: { cellWidth: 15 },
                4: { cellWidth: 35 }
            },
            styles: { minCellHeight: 10, valign: 'middle' }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Staff In-charge", 20, finalY + 20);
        doc.text("Event Coordinator", 160, finalY + 20);

        doc.save(`OD_List_${event.title}.pdf`);
    };

    const downloadODExcel = () => {
        if (members.length === 0) return toast.error("No data");
        const ws = XLSX.utils.json_to_sheet(members.map((m, i) => ({
            "S.No": i + 1,
            "Name": m.name,
            "Department": m.department || m.dept || "-",
            "Year": m.year || "-",
            "Email": m.email,
            "Signature": ""
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "OD List");
        XLSX.writeFile(wb, `OD_List_${event.title}.xlsx`);
    };

    if (loading) return <div className="flex justify-center p-8">Loading...</div>;
    if (!event) return <div className="flex justify-center p-8">Event not found</div>;

    const availableStudents = students.filter(s => !members.find(m => m.user_id === s.id));

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-4 md:p-8 w-full">
                <div className="mb-4">

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

                <Tabs defaultValue="overview" className="mt-6">
                    <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="registrations">Registrations</TabsTrigger>
                        <TabsTrigger value="od">OD Students</TabsTrigger>
                        <TabsTrigger value="volunteers">Attendance Sheet</TabsTrigger>
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <Button size="sm" variant="outline" onClick={() => downloadODPDF()}>
                                        <Download className="w-4 h-4 mr-2" /> Download PDF
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => downloadODExcel()}>
                                        <Download className="w-4 h-4 mr-2" /> Export Excel
                                    </Button>
                                    <Button size="sm" onClick={() => setShowAssignDialog(true)}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Students
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>S.No</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Dept</TableHead>
                                            <TableHead>Year</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((m, i) => (
                                            <TableRow key={m.user_id}>
                                                <TableCell>{i + 1}</TableCell>
                                                <TableCell className="font-medium">{m.name}</TableCell>
                                                <TableCell>{m.department || m.dept || '-'}</TableCell>
                                                <TableCell>{m.year || '-'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.user_id)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {members.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No students assigned.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="registrations">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>All Event Registrations</CardTitle>
                                    <CardDescription>Consolidated list of all registered students including participants and volunteers</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => {
                                    // Custom export for all registrations if needed
                                    toast.info("Consolidated registration list ready");
                                }}>
                                    <Download className="w-4 h-4 mr-2" /> Export All
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">S.No</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Reg No</TableHead>
                                            <TableHead>Dept / Year</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Registered At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registrations.map((reg, i) => (
                                            <TableRow key={reg.id || i}>
                                                <TableCell>{i + 1}</TableCell>
                                                <TableCell className="font-medium">{reg.name}</TableCell>
                                                <TableCell>{reg.register_no || reg.regNo || (reg.notes ? JSON.parse(reg.notes).regNo : '-')}</TableCell>
                                                <TableCell>{reg.department || (reg.notes ? JSON.parse(reg.notes).department : '-')} / {reg.year || (reg.notes ? JSON.parse(reg.notes).year : '-')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">{reg.registration_type}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={reg.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">
                                                        {reg.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {new Date(reg.registered_at).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {registrations.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                    No registrations found for this event.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="volunteers">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Registered Volunteers</CardTitle>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={downloadVolunteersPDF}>
                                        <Download className="w-4 h-4 mr-2" /> Download PDF
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={downloadVolunteersExcel}>
                                        <Download className="w-4 h-4 mr-2" /> Export Excel
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">S.No</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Reg No</TableHead>
                                            <TableHead>Dept</TableHead>
                                            <TableHead>Year</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead className="w-32">Signature</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {volunteers.map((v, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{i + 1}</TableCell>
                                                <TableCell className="font-medium">{v.name}</TableCell>
                                                <TableCell>{v.regNo || '-'}</TableCell>
                                                <TableCell>{v.department}</TableCell>
                                                <TableCell>{v.year}</TableCell>
                                                <TableCell>{v.phone}</TableCell>
                                                <TableCell className="border-b border-muted"></TableCell>
                                            </TableRow>
                                        ))}
                                        {volunteers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No volunteers registered.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Student</DialogTitle>
                            <DialogDescription>Add a single student or import from Excel</DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="single">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="single">Single Assignment</TabsTrigger>
                                <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
                            </TabsList>

                            <TabsContent value="single" className="space-y-4 pt-4">
                                <form onSubmit={handleAssignMember} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select Student</Label>
                                        <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                                            <SelectTrigger><SelectValue placeholder="Search or select student..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableStudents.slice(0, 50).map(s => (
                                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.email})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Showing first 50 students. Search to find others.</p>
                                    </div>
                                    <Button type="submit" disabled={!assignStudentId} className="w-full">Assign Student</Button>
                                </form>
                            </TabsContent>

                            <TabsContent value="bulk" className="space-y-4 pt-4">
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
                                        <h4 className="font-medium text-sm">Instructions</h4>
                                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                                            <li>Download the sample Excel file</li>
                                            <li>Fill in the student details (Name is required)</li>
                                            <li>Upload the updated file</li>
                                        </ul>
                                        <Button size="sm" variant="outline" onClick={downloadODSample} className="mt-2 w-full gap-2">
                                            <Download className="w-4 h-4" /> Download Sample Template
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Upload Excel File</Label>
                                        <Input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImportOD(file);
                                            }}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>

            </main>
        </div>
    );
};

export default EventDetails;
