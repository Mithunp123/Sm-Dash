import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Calendar, Plus, ArrowLeft, Edit, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import CalendarMonth, { CalendarEvent } from "@/components/CalendarMonth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const getHolidays = (year: number): CalendarEvent[] => [
  { id: `h-ny-${year}`, title: 'New Year', date: `${year}-01-01T00:00:00`, type: 'important' as const },
  { id: `h-rd-${year}`, title: 'Republic Day', date: `${year}-01-26T00:00:00`, type: 'holiday' as const },
  { id: `h-id-${year}`, title: 'Independence Day', date: `${year}-08-15T00:00:00`, type: 'holiday' as const },
  { id: `h-gj-${year}`, title: 'Gandhi Jayanti', date: `${year}-10-02T00:00:00`, type: 'holiday' as const },
  { id: `h-cm-${year}`, title: 'Christmas', date: `${year}-12-25T00:00:00`, type: 'holiday' as const },
  { id: `h-ld-${year}`, title: 'Labor Day', date: `${year}-05-01T00:00:00`, type: 'important' as const },
  // Add more fixed holidays as needed. For movable holidays, logic would be more complex.
];

const ManageMeetings = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]); // For important days
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportantDayDialog, setShowImportantDayDialog] = useState(false); // New dialog state
  const [importantDayForm, setImportantDayForm] = useState({ title: "", date: "" }); // New form state
  const [showCalendar, setShowCalendar] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [editingMeeting, setEditingMeeting] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    location: ""
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
    const canAccess = isAdmin || permissions.can_manage_meetings;
    if (!canAccess) {
      toast.error("You don't have permission to access meeting management");
      navigate("/admin");
      return;
    }

    loadData();
  }, [navigate, permissions, permissionsLoading, viewDate.getFullYear()]); // Reload when year changes

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetingsRes, eventsRes] = await Promise.all([
        api.getMeetings(),
        api.getEvents(viewDate.getFullYear().toString())
      ]);

      if (meetingsRes.success) {
        setMeetings(meetingsRes.meetings || []);
      }
      if (eventsRes.success) {
        // Filter only special days if needed, or take all events as important days/holidays
        // Assuming user wants to see all 'Events' as Important Days
        setEvents(eventsRes.events || []);
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddImportantDay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', importantDayForm.title);
      formDataToSend.append('date', importantDayForm.date);
      formDataToSend.append('year', new Date(importantDayForm.date).getFullYear().toString());
      formDataToSend.append('is_special_day', 'true');

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: formDataToSend
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Important Day added successfully!");
        setShowImportantDayDialog(false);
        setImportantDayForm({ title: "", date: "" });
        loadData();
      } else {
        toast.error(data.message || "Failed to add");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMeeting) {
        // Update meeting
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/meetings/${editingMeeting.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success) {
          toast.success("Meeting updated successfully!");
          setShowAddDialog(false);
          setEditingMeeting(null);
          setFormData({ title: "", description: "", date: "", location: "" });
          loadData();
        } else {
          throw new Error(data.message || 'Failed to update meeting');
        }
      } else {
        // Create new meeting
        const response = await api.createMeeting(formData);
        if (response.success) {
          toast.success("Meeting created successfully!");
          setShowAddDialog(false);
          setFormData({ title: "", description: "", date: "", location: "" });
          loadData();
        }
      }
    } catch (error: any) {
      toast.error("Failed to save meeting: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline">Scheduled</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-accent"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleEditMeeting = (meeting: any) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || "",
      date: meeting.date,
      location: meeting.location || ""
    });
    setShowAddDialog(true);
  };

  const handleDeleteMeeting = async (meetingId: number) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Meeting deleted successfully!");
        loadData();
      } else {
        throw new Error(data.message || 'Failed to delete meeting');
      }
    } catch (error: any) {
      toast.error("Failed to delete meeting: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", date: "", location: "" });
    setEditingMeeting(null);
  };

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };



  const handleYearChange = (value: string) => {
    const year = parseInt(value, 10);
    setViewDate((prev) => new Date(year, prev.getMonth(), 1));
  };

  const resetToToday = () => {
    setViewDate(new Date());
  };

  const monthLabel = viewDate.toLocaleString(undefined, { month: "long", year: "numeric" });

  const yearRange = Array.from({ length: 11 }, (_, i) => viewDate.getFullYear() - 5 + i);

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
              <h1 className="text-3xl font-semibold text-foreground mb-1">Meetings</h1>
              <p className="text-sm text-muted-foreground">Schedule and manage meetings</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCalendar((s) => !s)} className="gap-2">
                {showCalendar ? "List View" : "Calendar View"}
              </Button>
              <Button onClick={() => setShowImportantDayDialog(true)} variant="secondary" className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200">
                <Plus className="w-4 h-4" />
                Add Important Day
              </Button>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Meeting
              </Button>
            </div>
          </div>

          {showCalendar ? (
            <Card className="border-border/50 bg-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Calendar View
                    </CardTitle>
                    <CardDescription>Click a day to create a meeting on that date</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="hidden sm:block font-semibold">{monthLabel}</div>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Next month">
                      <ChevronRight className="w-4 h-4" />
                    </Button>

                    <Select value={String(viewDate.getFullYear())} onValueChange={handleYearChange}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Year">{viewDate.getFullYear()}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {yearRange.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" onClick={resetToToday}>
                      Today
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CalendarMonth
                  showHeader={false}
                  month={viewDate.getMonth()}
                  year={viewDate.getFullYear()}
                  events={[
                    ...(meetings || []).map(
                      (m): CalendarEvent => ({
                        id: m.id,
                        title: m.title,
                        date: m.date,
                        type: 'meeting'
                      })
                    ),
                    ...(events || []).map(
                      (e: any): CalendarEvent => ({
                        id: `event-${e.id}`,
                        title: e.title,
                        date: e.date,
                        type: e.is_special_day ? 'holiday' : 'important' // Map events to holiday/important
                      })
                    ),
                    ...getHolidays(viewDate.getFullYear())
                  ]}
                  onDayClick={(iso) => {
                    setFormData((fd) => ({
                      ...fd,
                      date: iso + "T10:00"
                    }));
                    setShowAddDialog(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  All Meetings ({meetings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading meetings...</div>
                ) : meetings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No meetings found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Organizer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetings.map((meeting) => (
                        <TableRow key={meeting.id}>
                          <TableCell className="font-medium">{meeting.title}</TableCell>
                          <TableCell>
                            {new Date(meeting.date).toLocaleString()}
                          </TableCell>
                          <TableCell>{meeting.location || "N/A"}</TableCell>
                          <TableCell>{meeting.organizer_name || "N/A"}</TableCell>
                          <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditMeeting(meeting)}
                              className="gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Add Meeting Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeeting ? 'Edit Meeting' : 'Create New Meeting'}</DialogTitle>
            <DialogDescription>
              {editingMeeting ? 'Update the meeting details' : 'Schedule a new meeting or event'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMeeting} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
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
            <div className="space-y-2">
              <Label htmlFor="date">Date & Time *</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingMeeting ? 'Update Meeting' : 'Create Meeting'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Important Day Dialog */}
      <Dialog open={showImportantDayDialog} onOpenChange={setShowImportantDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Important Day</DialogTitle>
            <DialogDescription>Mark a day as important or a holiday</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddImportantDay} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={importantDayForm.title}
                onChange={(e) => setImportantDayForm({ ...importantDayForm, title: e.target.value })}
                placeholder="e.g. Founder's Day"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="datetime-local"
                value={importantDayForm.date}
                onChange={(e) => setImportantDayForm({ ...importantDayForm, date: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowImportantDayDialog(false)}>Cancel</Button>
              <Button type="submit">Add Important Day</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


    </div >
  );
};

export default ManageMeetings;

