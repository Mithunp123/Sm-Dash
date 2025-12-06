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
import { Calendar, Plus, ArrowLeft, Edit, Trash2, Users, Upload, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

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
  });
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [eventMembers, setEventMembers] = useState<any[]>([]);
  const [addingStudent, setAddingStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

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

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.year) {
      toast.error("Title, date, and year are required");
      return;
    }

    try {
      const res = await api.createEvent(
        formData.title,
        formData.date,
        formData.year,
        formData.description,
        formData.is_special_day
      );
      if (res.success) {
        toast.success("Event created successfully!");
        setShowAddDialog(false);
        setFormData({ title: "", description: "", date: "", year: "", is_special_day: false });
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to create event: " + (error.message || "Unknown error"));
    }
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      const res = await api.updateEvent(
        selectedEvent.id,
        formData.title,
        formData.date,
        formData.year,
        formData.description,
        formData.is_special_day
      );
      if (res.success) {
        toast.success("Event updated successfully!");
        setShowEditDialog(false);
        setSelectedEvent(null);
        setFormData({ title: "", description: "", date: "", year: "", is_special_day: false });
        loadData();
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
      <Header />
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
        <div className="max-w-7xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              <Button onClick={() => {
                setFormData({ title: "", description: "", date: "", year: selectedYear, is_special_day: false });
                setShowAddDialog(true);
              }} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                <Plus className="w-4 h-4" />
                Add Event
              </Button>
            </div>
            <div className="mt-4">
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Events</h1>
              <p className="text-lg opacity-90">Create events and mark student OD</p>
            </div>
          </div>

          {/* Year Filter */}
          <Card className="gradient-card border-border/50 mb-6">
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
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
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
                        <TableHead>Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Special Day</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.title}</TableCell>
                          <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                          <TableCell>{event.year}</TableCell>
                          <TableCell>
                            {event.is_special_day ? (
                              <Badge className="bg-amber-500">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleViewOD(event)}
                              className="gap-1 bg-orange-600 text-white hover:bg-orange-500"
                            >
                              <UserPlus className="w-3 h-3" />
                              Assign Students
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(event);
                                setFormData({
                                  title: event.title,
                                  description: event.description || "",
                                  date: event.date,
                                  year: event.year,
                                  is_special_day: event.is_special_day === 1,
                                });
                                setShowEditDialog(true);
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
                                setSelectedEvent(event);
                                setShowDeleteDialog(true);
                              }}
                              className="gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="special_day"
                checked={formData.is_special_day}
                onCheckedChange={(checked) => setFormData({ ...formData, is_special_day: checked === true })}
              />
              <Label htmlFor="special_day">Special Day</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-special_day"
                checked={formData.is_special_day}
                onCheckedChange={(checked) => setFormData({ ...formData, is_special_day: checked === true })}
              />
              <Label htmlFor="edit-special_day">Special Day</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
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

      <Footer />
    </div>
  );
};

export default ManageEvents;
