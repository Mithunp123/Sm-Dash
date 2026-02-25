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
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="w-full p-2 md:p-4 space-y-6">
          <div className="mb-4">

          </div>

          {/* Page Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
            <div>
              <h1 className="page-title">Meetings & Days</h1>
              <p className="page-subtitle border-l-4 border-primary/30 pl-3 mt-2">Schedule community gatherings and observe special occasions</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
              <Button
                onClick={() => setShowCalendar(!showCalendar)}
                variant="secondary"
                className="gap-2 h-10 rounded-md font-semibold text-sm px-4 w-full sm:w-auto"
              >
                <Calendar className="w-4 h-4" />
                {showCalendar ? "Switch to List" : "Switch to Calendar"}
              </Button>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="gap-2 h-10 rounded-md font-semibold text-sm px-4 bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Add Meeting
              </Button>
              <Button
                onClick={() => setShowImportantDayDialog(true)}
                variant="default"
                className="gap-2 h-10 rounded-md font-semibold text-sm px-4 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Add Imp Day
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {showCalendar ? (
              <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden mb-8">
                <CardHeader className="p-4 md:p-6 bg-muted/30 border-b">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">Calendar View</CardTitle>
                        <CardDescription className="text-xs">Click a day to schedule</CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-border/50 shadow-sm self-center sm:self-auto">
                      <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-lg">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>

                      <div className="px-2 font-bold text-sm min-w-[120px] text-center">
                        {monthLabel}
                      </div>

                      <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-lg">
                        <ChevronRight className="w-4 h-4" />
                      </Button>

                      <div className="h-4 w-[1px] bg-border mx-1"></div>

                      <Select value={String(viewDate.getFullYear())} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-24 h-8 border-none bg-transparent hover:bg-muted font-bold text-xs ring-0 focus:ring-0">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {yearRange.map((year) => (
                            <SelectItem key={year} value={String(year)} className="text-xs font-bold">
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button variant="ghost" size="sm" onClick={resetToToday} className="h-8 px-2 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-lg">
                        Today
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <CalendarMonth
                    showHeader={false}
                    month={viewDate.getMonth()}
                    year={viewDate.getFullYear()}
                    events={[
                      ...meetings.map(
                        (m): CalendarEvent => ({
                          id: `meet-${m.id}`,
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
                          type: e.is_special_day ? 'holiday' : 'important'
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
              <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden mb-8">
                <CardHeader className="bg-muted/30 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black uppercase tracking-tight">All Meetings</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-70">Found {meetings.length} records</CardDescription>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {meetings.length}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground font-bold uppercase tracking-widest text-xs italic">
                      No meetings found
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50 border-b border-border/40">
                              <TableHead className="font-black text-[10px] uppercase tracking-widest">Title</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest">Date</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest">Location</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest">Organizer</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest">Status</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right pr-6">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {meetings.map((meeting) => (
                              <TableRow key={meeting.id} className="hover:bg-muted/30 transition-colors border-b border-border/40 group">
                                <TableCell className="font-bold text-foreground">{meeting.title}</TableCell>
                                <TableCell className="font-medium text-sm">
                                  {new Date(meeting.date).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </TableCell>
                                <TableCell className="text-sm">{meeting.location || "N/A"}</TableCell>
                                <TableCell className="text-sm font-medium">{meeting.organizer_name || "N/A"}</TableCell>
                                <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" onClick={() => handleEditMeeting(meeting)} className="h-8 w-8 text-primary hover:bg-primary/10">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteMeeting(meeting.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden grid grid-cols-1 gap-4 p-4 mb-4">
                        {meetings.map((meeting) => (
                          <Card key={meeting.id} className="group relative overflow-hidden rounded-3xl border-border/40 bg-card shadow-md active:scale-[0.98] transition-all">
                            <CardContent className="p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 pr-4">
                                  <h4 className="font-black text-lg text-foreground uppercase tracking-tight leading-tight mb-1">{meeting.title}</h4>
                                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(meeting.date).toLocaleString('en-IN', {
                                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div className="shrink-0">{getStatusBadge(meeting.status)}</div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                <div className="bg-muted/30 p-2 rounded-xl">
                                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Location</p>
                                  <p className="text-[10px] font-bold text-foreground truncate">{meeting.location || "N/A"}</p>
                                </div>
                                <div className="bg-muted/30 p-2 rounded-xl">
                                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">By</p>
                                  <p className="text-[10px] font-bold text-foreground truncate">{meeting.organizer_name || "N/A"}</p>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-4 border-t border-border/50">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditMeeting(meeting)}
                                  className="flex-1 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest border-2"
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteMeeting(meeting.id)}
                                  className="h-9 w-9 rounded-xl flex items-center justify-center p-0 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

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
                    placeholder="e.g. Conference Room A"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button type="submit">{editingMeeting ? 'Update Meeting' : 'Create Meeting'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showImportantDayDialog} onOpenChange={setShowImportantDayDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Important Day / Holiday</DialogTitle>
                <DialogDescription>
                  Add a special day to the community calendar.
                </DialogDescription>
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
        </div>
      </main>
    </div>
  );
};

export default ManageMeetings;
