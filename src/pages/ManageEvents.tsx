import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Plus, ArrowLeft, Edit, Trash2, Users, Upload, UserPlus, Image as ImageIcon, Download, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ManageEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showODDialog, setShowODDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    year: "",
    is_special_day: false,
    image_url: "",
    max_volunteers: "",
    volunteer_registration_deadline: "",
  });
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [eventMembers, setEventMembers] = useState<any[]>([]);
  const [addingStudent, setAddingStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [showVolunteersDialog, setShowVolunteersDialog] = useState(false);
  const [eventVolunteers, setEventVolunteers] = useState<any[]>([]);
  const [volunteersLoading, setVolunteersLoading] = useState(false);
  const [volunteerCounts, setVolunteerCounts] = useState<Record<number, number>>({});
  const [showEditVolunteerDialog, setShowEditVolunteerDialog] = useState(false);
  const [showDeleteVolunteerDialog, setShowDeleteVolunteerDialog] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any>(null);
  const [editVolunteerData, setEditVolunteerData] = useState({
    name: '',
    department: '',
    year: '',
    phone: ''
  });

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const user = auth.getUser();

    // Wait for permissions to load
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_events;
    if (!canAccess) {
      toast.error("You don't have permission to access event management");
      navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
      return;
    }

    loadData();
  }, [selectedYear, selectedMonth, permissions, permissionsLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load events
      const eventsRes = await api.getEvents(selectedYear, selectedMonth === 'all' ? undefined : selectedMonth);
      if (eventsRes.success) {
        setEvents(eventsRes.events || []);
        // Load volunteer counts for each event
        const counts: Record<number, number> = {};
        for (const event of eventsRes.events || []) {
          try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            const response = await fetch(`${API_BASE}/events/${event.id}/volunteers`, {
              headers: {
                'Authorization': `Bearer ${auth.getToken()}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                counts[event.id] = data.count || 0;
              }
            }
          } catch (err) {
            // Silently fail for volunteer count
            counts[event.id] = 0;
          }
        }
        setVolunteerCounts(counts);
      }

      // Load students for OD marking
      const studentsRes = await api.getStudentsScoped();
      if (studentsRes.success) {
        setStudents(studentsRes.students || studentsRes.users || []);
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleViewVolunteers = async (event: any) => {
    setSelectedEvent(event);
    setShowVolunteersDialog(true);
    setVolunteersLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

      // Load volunteers and students in parallel
      const [volunteersRes, studentsRes] = await Promise.all([
        fetch(`${API_BASE}/events/${event.id}/volunteers`, {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }),
        api.getUsers().catch(() => ({ success: false, users: [] }))
      ]);

      if (volunteersRes.ok) {
        const data = await volunteersRes.json();
        if (data.success) {
          setEventVolunteers(data.volunteers || []);
        } else {
          throw new Error(data.message || 'Failed to load volunteers');
        }
      } else {
        throw new Error(`HTTP ${volunteersRes.status}`);
      }

      // Update students list for matching
      if (studentsRes.success && studentsRes.users) {
        const studentList = studentsRes.users.filter((u: any) => u.role === 'student');
        setStudents(studentList);
      }
    } catch (error: any) {
      console.error('Error loading volunteers:', error);
      toast.error('Failed to load volunteers: ' + (error.message || 'Unknown error'));
      setEventVolunteers([]);
    } finally {
      setVolunteersLoading(false);
    }
  };

  const downloadVolunteersExcel = async () => {
    if (!eventVolunteers || eventVolunteers.length === 0) {
      toast.error('No volunteers to export');
      return;
    }

    try {
      const excelData = eventVolunteers.map((volunteer: any, index: number) => {
        return {
          'S.No': index + 1, // Serial number
          'Name': volunteer.name || '',
          'Department': volunteer.department || '',
          'Year': volunteer.year || '',
          'Phone': volunteer.phone || '',
          'Registered On': new Date(volunteer.created_at || volunteer.registered_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          'Signature': '' // Empty column for signature
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Volunteers');

      // Set column widths
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 20 }, // Name
        { wch: 15 }, // Department
        { wch: 10 }, // Year
        { wch: 15 }, // Phone
        { wch: 20 }, // Registered On
        { wch: 30 }  // Signature
      ];

      const eventTitle = selectedEvent?.title || 'Event';
      const fileName = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_volunteers.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Excel file downloaded successfully');
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const downloadVolunteersPDF = () => {
    if (!eventVolunteers || eventVolunteers.length === 0) {
      toast.error('No volunteers to export');
      return;
    }

    try {
      const doc = new jsPDF();

      const tableColumn = ["S.No", "Name", "Department", "Year", "Phone", "Registered On", "Signature"];
      const tableRows: any[] = [];

      eventVolunteers.forEach((volunteer, index) => {
        const volunteerData = [
          index + 1,
          volunteer.name || '',
          volunteer.department || '',
          volunteer.year || '',
          volunteer.phone || '',
          new Date(volunteer.created_at || volunteer.registered_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          '' // Empty signature column
        ];
        tableRows.push(volunteerData);
      });

      // Add title
      doc.setFontSize(16);
      doc.text(`${selectedEvent?.title || 'Event'} - Volunteers List`, 14, 15);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 15 }, // S.No
          6: { cellWidth: 40 }  // Signature
        },
        theme: 'grid'
      });

      const eventTitle = selectedEvent?.title || 'Event';
      doc.save(`${eventTitle.replace(/[^a-z0-9]/gi, '_')}_volunteers.pdf`);
      toast.success('PDF file downloaded successfully');
    } catch (error: any) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export PDF file');
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.year) {
      toast.error("Title, date, and year are required");
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('date', formData.date);
      formDataToSend.append('year', formData.year);
      formDataToSend.append('is_special_day', formData.is_special_day ? 'true' : 'false');
      if (formData.max_volunteers) {
        formDataToSend.append('max_volunteers', formData.max_volunteers);
      }
      if (formData.volunteer_registration_deadline) {
        formDataToSend.append('volunteer_registration_deadline', formData.volunteer_registration_deadline);
      }

      // Priority: If file is selected, send the file (not the base64 image_url)
      if (eventImageFile) {
        formDataToSend.append('image', eventImageFile);
      } else if (formData.image_url && !formData.image_url.startsWith('data:')) {
        // Only send image_url if it's not a base64 data URL (i.e., it's an existing URL)
        formDataToSend.append('image_url', formData.image_url);
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: formDataToSend
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Event created successfully!");
        setShowAddDialog(false);
        setFormData({ title: "", description: "", date: "", year: "", is_special_day: false, image_url: "", max_volunteers: "", volunteer_registration_deadline: "" });
        setEventImageFile(null);
        // Reset file input
        const fileInput = document.getElementById('event-image') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadData();
      } else {
        toast.error(data.message || "Failed to create event");
      }
    } catch (error: any) {
      toast.error("Failed to create event: " + (error.message || "Unknown error"));
    }
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('date', formData.date);
      formDataToSend.append('year', formData.year);
      formDataToSend.append('is_special_day', formData.is_special_day ? 'true' : 'false');
      if (formData.max_volunteers) {
        formDataToSend.append('max_volunteers', formData.max_volunteers);
      }
      if (formData.volunteer_registration_deadline) {
        formDataToSend.append('volunteer_registration_deadline', formData.volunteer_registration_deadline);
      }

      // If there's a new image file, send it (this will replace the existing image)
      if (eventImageFile) {
        formDataToSend.append('image', eventImageFile);
      }
      // Note: If no new file is selected, we don't send image_url
      // The backend will keep the existing image automatically

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: formDataToSend
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Event updated successfully!");
        setShowEditDialog(false);
        setSelectedEvent(null);
        setFormData({ title: "", description: "", date: "", year: "", is_special_day: false, image_url: "", max_volunteers: "", volunteer_registration_deadline: "" });
        setEventImageFile(null);
        // Reset file input
        const fileInput = document.getElementById('edit-event-image') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadData();
      } else {
        toast.error(data.message || "Failed to update event");
      }
    } catch (error: any) {
      toast.error("Failed to update event: " + (error.message || "Unknown error"));
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const res = await api.deleteEvent(selectedEvent.id);
      if (res.success) {
        toast.success("Event deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedEvent(null);
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to delete event: " + (error.message || "Unknown error"));
    }
  };

  const handleViewOD = async (event: any) => {
    setSelectedEvent(event);
    setSelectedStudentId('');
    try {
      const res = await api.getEventMembers(event.id);
      if (res.success) {
        setEventMembers(res.members || []);
      }
      setShowODDialog(true);
    } catch (error: any) {
      toast.error("Failed to load event members: " + (error.message || "Unknown error"));
    }
  };

  const handleRemoveEventMember = async (userId: number) => {
    try {
      const res = await api.removeEventMember(selectedEvent.id, userId);
      if (res.success) {
        toast.success("Student removed from event!");
        handleViewOD(selectedEvent);
      }
    } catch (error: any) {
      toast.error("Failed to remove student: " + (error.message || "Unknown error"));
    }
  };

  const handleImportStudentsCSV = async () => {
    if (!csvFile || !selectedEvent) {
      toast.error("Please select an Excel file");
      return;
    }

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error("File must have headers and at least one student");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = headers.indexOf('name');

      if (nameIndex === -1) {
        toast.error("File must contain 'name' column");
        return;
      }

      const userIds: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());

        if (values[nameIndex]) {
          const student = students.find(s => s.name.toLowerCase() === values[nameIndex].toLowerCase());
          if (student) userIds.push(student.id);
        }
      }

      if (userIds.length === 0) {
        toast.error("No valid students found in file");
        return;
      }

      const res = await api.addEventMembers(selectedEvent.id, userIds);
      if (res.success) {
        toast.success(`${userIds.length} students imported successfully!`);
        setCSVFile(null);
        handleViewOD(selectedEvent);
      }
    } catch (error: any) {
      toast.error("Failed to import file: " + (error.message || "Unknown error"));
    }
  };

  const handleQuickAddStudent = async (studentId: number, studentName: string) => {
    if (!selectedEvent) {
      toast.error("Please select an event");
      return;
    }

    try {
      setAddingStudent(true);
      const res = await api.addEventMembers(selectedEvent.id, [studentId]);
      if (res.success) {
        toast.success(`${studentName} added successfully!`);
        handleViewOD(selectedEvent);
        setSelectedStudentId('');
      }
    } catch (error: any) {
      toast.error("Failed to add student: " + (error.message || "Unknown error"));
    } finally {
      setAddingStudent(false);
    }
  };

  const availableStudents = students.filter(s => {
    return !eventMembers.find(m => m.user_id === s.id);
  });

  const years = Array.from({ length: 4 }, (_, i) => (new Date().getFullYear() - i).toString());
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }) }));

  return (
    <div className="min-h-screen flex flex-col">

      <DeveloperCredit />

      <main className="flex-1 p-2 md:p-4 bg-background">
        <div className="w-full">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>

          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-1">Events</h1>
              <p className="text-sm text-muted-foreground">Create events and mark student OD</p>
            </div>
            <Button onClick={() => {
              setFormData({ title: "", description: "", date: "", year: selectedYear, is_special_day: false, image_url: "", max_volunteers: "", volunteer_registration_deadline: "" });
              setShowAddDialog(true);
            }} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Event
            </Button>
          </div>

          {/* Year Filter */}
          <Card className="border-border/50 mb-6 bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label>Filter by Year:</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label>Filter by Month:</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Events Table */}
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Events ({events.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No events found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Special Day</TableHead>
                        <TableHead>Volunteers</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const buildImageUrl = (imageUrl: string | null | undefined) => {
                          if (!imageUrl) return null;
                          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                            return imageUrl;
                          }
                          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                          const apiRoot = apiBase.replace(/\/api\/?$/, '');
                          return `${apiRoot}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
                        };
                        const imageUrl = buildImageUrl(event.image_url);

                        return (
                          <TableRow key={event.id}>
                            <TableCell>
                              {imageUrl ? (
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                                  <img
                                    src={imageUrl}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      if (e.currentTarget.nextElementSibling) {
                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div className="hidden items-center justify-center text-muted-foreground text-xs">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                            <TableCell>{event.year}</TableCell>
                            <TableCell>
                              {event.is_special_day ? (
                                <Badge variant="default" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">Yes</Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="font-medium">{volunteerCounts[event.id] || 0}</span>
                                <span className="text-sm text-muted-foreground">registered</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setFormData({
                                    title: event.title,
                                    description: event.description || "",
                                    date: event.date ? event.date.split('T')[0] : "",
                                    year: event.year || new Date().getFullYear().toString(),
                                    is_special_day: event.is_special_day || false,
                                    image_url: event.image_url || "",
                                    max_volunteers: event.max_volunteers?.toString() || "",
                                    volunteer_registration_deadline: event.volunteer_registration_deadline ? event.volunteer_registration_deadline.slice(0, 16) : ""
                                  });
                                  setEventImageFile(null);
                                  setShowEditDialog(true);
                                }}
                                className="gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/events/${event.id}`)}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setShowDeleteDialog(true);
                                }}
                                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Create a new event for OD marking</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEvent} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-image">Event Image</Label>
              <Input
                id="event-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEventImageFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setFormData({ ...formData, image_url: e.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {eventImageFile && (
                <p className="text-sm text-muted-foreground">Selected: {eventImageFile.name}</p>
              )}
              {formData.image_url && !eventImageFile && (
                <div className="mt-2">
                  <img src={formData.image_url} alt="Event preview" className="max-w-full h-32 object-contain rounded" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="special_day"
                checked={formData.is_special_day}
                onCheckedChange={(checked) => setFormData({ ...formData, is_special_day: checked === true })}
              />
              <Label htmlFor="special_day">Special Day</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_volunteers">Max Volunteers (Optional)</Label>
                <Input
                  id="max_volunteers"
                  type="number"
                  min="1"
                  value={formData.max_volunteers}
                  onChange={(e) => setFormData({ ...formData, max_volunteers: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volunteer_deadline">Registration Deadline (Optional)</Label>
                <Input
                  id="volunteer_deadline"
                  type="datetime-local"
                  value={formData.volunteer_registration_deadline}
                  onChange={(e) => setFormData({ ...formData, volunteer_registration_deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEventImageFile(null);
              }}>
                Cancel
              </Button>
              <Button type="submit">Add Event</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEvent} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Event Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-year">Year *</Label>
                <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-event-image">Event Image</Label>
              <Input
                id="edit-event-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEventImageFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setFormData({ ...formData, image_url: e.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {eventImageFile && (
                <p className="text-sm text-muted-foreground">Selected: {eventImageFile.name}</p>
              )}
              {formData.image_url && !eventImageFile && (
                <div className="mt-2">
                  <img src={formData.image_url} alt="Event preview" className="max-w-full h-32 object-contain rounded" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-special_day"
                checked={formData.is_special_day}
                onCheckedChange={(checked) => setFormData({ ...formData, is_special_day: checked === true })}
              />
              <Label htmlFor="edit-special_day">Special Day</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max_volunteers">Max Volunteers (Optional)</Label>
                <Input
                  id="edit-max_volunteers"
                  type="number"
                  min="1"
                  value={formData.max_volunteers}
                  onChange={(e) => setFormData({ ...formData, max_volunteers: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-volunteer_deadline">Registration Deadline (Optional)</Label>
                <Input
                  id="edit-volunteer_deadline"
                  type="datetime-local"
                  value={formData.volunteer_registration_deadline}
                  onChange={(e) => setFormData({ ...formData, volunteer_registration_deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditDialog(false);
                setEventImageFile(null);
              }}>
                Cancel
              </Button>
              <Button type="submit">Update Event</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark OD Dialog */}
      <Dialog open={showODDialog} onOpenChange={setShowODDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Event - {selectedEvent?.title}</DialogTitle>
            <DialogDescription>Import students and view OD records</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Import Students */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Import Students</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv">Upload Excel File (name column required)</Label>
                  <Input
                    id="csv"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setCSVFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-sm text-muted-foreground">Format: Excel file with 'name' column</p>
                </div>
                <Button onClick={handleImportStudentsCSV} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import from File
                </Button>
              </div>
            </div>

            {/* Available Students to Add */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Add Students Manually</h3>
              {availableStudents.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  All students already added
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-student-select">Student *</Label>
                    <Select
                      value={selectedStudentId}
                      onValueChange={(value) => setSelectedStudentId(value)}
                    >
                      <SelectTrigger id="manual-student-select">
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {availableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.name} ({student.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Student details are sourced from Manage Users. Update their profile there to reflect the latest information.
                    </p>
                  </div>
                  {selectedStudentId && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                      {(() => {
                        const student = availableStudents.find((s) => s.id === parseInt(selectedStudentId));
                        if (!student) return null;
                        return (
                          <>
                            <div className="font-semibold text-foreground">{student.name}</div>
                            <div>{student.email}</div>
                            <div className="mt-1">
                              Dept: {student.dept || 'N/A'} • Year: {student.year || 'N/A'} • Phone: {student.phone || 'N/A'}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        const student = availableStudents.find((s) => s.id === parseInt(selectedStudentId));
                        if (!student) {
                          toast.error("Select a student first");
                          return;
                        }
                        handleQuickAddStudent(student.id, student.name);
                      }}
                      disabled={!selectedStudentId || addingStudent}
                      className="gap-2"
                    >
                      {addingStudent ? "Adding..." : "Add Student"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Current Members */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Event Members ({eventMembers.length})</h3>
              {eventMembers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No members yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.user_name}</TableCell>
                          <TableCell>{member.user_email}</TableCell>
                          <TableCell>{new Date(member.joined_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveEventMember(member.user_id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>



            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setShowODDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteEvent}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Volunteers Dialog */}
      <Dialog open={showVolunteersDialog} onOpenChange={setShowVolunteersDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">
              Volunteers Registered
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {selectedEvent && `List of volunteers registered for "${selectedEvent.title}"`}
            </DialogDescription>
          </DialogHeader>

          {volunteersLoading ? (
            <div className="text-center py-8">Loading volunteers...</div>
          ) : eventVolunteers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg">No volunteers registered yet</p>
              <p className="text-sm mt-2">Volunteers can register from the landing page</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-slate-900">
                    Total Volunteers: {eventVolunteers.length}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S.No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Registered On</TableHead>
                      <TableHead>Signature</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventVolunteers.map((volunteer, index) => (
                      <TableRow key={volunteer.id}>
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell className="font-medium">{volunteer.name}</TableCell>
                        <TableCell>
                          {volunteer.department ? (
                            <Badge variant="outline">{volunteer.department}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {volunteer.year ? (
                            <Badge variant="secondary">{volunteer.year} Year</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{volunteer.phone}</TableCell>
                        <TableCell>
                          {new Date(volunteer.created_at || volunteer.registered_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">-</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVolunteer(volunteer);
                                setEditVolunteerData({
                                  name: volunteer.name || '',
                                  department: volunteer.department || '',
                                  year: volunteer.year || '',
                                  phone: volunteer.phone || ''
                                });
                                setShowEditVolunteerDialog(true);
                              }}
                              className="gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedVolunteer(volunteer);
                                setShowDeleteVolunteerDialog(true);
                              }}
                              className="gap-1"
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
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              {eventVolunteers.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={downloadVolunteersExcel}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadVolunteersPDF}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setShowVolunteersDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Volunteer Dialog */}
      <Dialog open={showEditVolunteerDialog} onOpenChange={setShowEditVolunteerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Volunteer</DialogTitle>
            <DialogDescription>Update volunteer information</DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedVolunteer || !selectedEvent) return;

            try {
              const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
              const response = await fetch(`${API_BASE}/events/${selectedEvent.id}/volunteers/${selectedVolunteer.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(editVolunteerData)
              });

              const data = await response.json();
              if (data.success) {
                toast.success('Volunteer updated successfully');
                setShowEditVolunteerDialog(false);
                setSelectedVolunteer(null);
                // Reload volunteers
                if (selectedEvent) {
                  await handleViewVolunteers(selectedEvent);
                }
              } else {
                toast.error(data.message || 'Failed to update volunteer');
              }
            } catch (error: any) {
              console.error('Error updating volunteer:', error);
              toast.error('Failed to update volunteer');
            }
          }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editVolunteerData.name}
                onChange={(e) => setEditVolunteerData({ ...editVolunteerData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={editVolunteerData.department}
                onChange={(e) => setEditVolunteerData({ ...editVolunteerData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                value={editVolunteerData.year}
                onChange={(e) => setEditVolunteerData({ ...editVolunteerData, year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={editVolunteerData.phone}
                onChange={(e) => setEditVolunteerData({ ...editVolunteerData, phone: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditVolunteerDialog(false);
                setSelectedVolunteer(null);
              }}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Volunteer Dialog */}
      <Dialog open={showDeleteVolunteerDialog} onOpenChange={setShowDeleteVolunteerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Volunteer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedVolunteer?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => {
              setShowDeleteVolunteerDialog(false);
              setSelectedVolunteer(null);
            }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!selectedVolunteer || !selectedEvent) return;

                try {
                  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                  const response = await fetch(`${API_BASE}/events/${selectedEvent.id}/volunteers/${selectedVolunteer.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${auth.getToken()}`
                    }
                  });

                  const data = await response.json();
                  if (data.success) {
                    toast.success('Volunteer deleted successfully');
                    setShowDeleteVolunteerDialog(false);
                    setSelectedVolunteer(null);
                    // Reload volunteers
                    if (selectedEvent) {
                      await handleViewVolunteers(selectedEvent);
                    }
                    // Reload events to update counts
                    loadData();
                  } else {
                    toast.error(data.message || 'Failed to delete volunteer');
                  }
                } catch (error: any) {
                  console.error('Error deleting volunteer:', error);
                  toast.error('Failed to delete volunteer');
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default ManageEvents;
