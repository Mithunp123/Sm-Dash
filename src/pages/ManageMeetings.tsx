import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Calendar, Plus, ArrowLeft, Edit, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import CalendarMonth, { CalendarEvent } from "@/components/CalendarMonth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ManageMeetings = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
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

    loadMeetings();
  }, [navigate, permissions, permissionsLoading]);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const response = await api.getMeetings();
      if (response.success) {
        setMeetings(response.meetings || []);
      }
    } catch (error: any) {
      toast.error("Failed to load meetings: " + error.message);
    } finally {
      setLoading(false);
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
          loadMeetings();
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
          loadMeetings();
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
        loadMeetings();
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

  const handleMonthChange = (value: string) => {
    const monthIndex = parseInt(value, 10);
    setViewDate((prev) => new Date(prev.getFullYear(), monthIndex, 1));
  };

  const handleYearChange = (value: string) => {
    const year = parseInt(value, 10);
    setViewDate((prev) => new Date(year, prev.getMonth(), 1));
  };

  const resetToToday = () => {
    setViewDate(new Date());
  };

  const monthLabel = viewDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
    value: String(i)
  }));
  const yearRange = Array.from({ length: 11 }, (_, i) => viewDate.getFullYear() - 5 + i);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-7xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCalendar((s) => !s)} className="gap-2 bg-white/20 text-white hover:bg-white/30">
                  {showCalendar ? "List View" : "Calendar View"}
                </Button>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                  <Plus className="w-4 h-4" />
                  New Meeting
                </Button>
              </div>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Meetings</h1>
              <p className="text-lg opacity-90">Schedule and manage meetings</p>
            </div>
          </div>

          {showCalendar ? (
            <Card className="gradient-card border-border/50">
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
                    <Select value={String(viewDate.getMonth())} onValueChange={handleMonthChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Month">{new Date(2000, viewDate.getMonth(), 1).toLocaleString(undefined, { month: "short" })}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  events={(meetings || []).map(
                      (m): CalendarEvent => ({
                        id: m.id,
                        title: m.title,
                        date: m.date
                      })
                    )}
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
            <Card className="gradient-card border-border/50">
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

      <Footer />
    </div>
  );
};

export default ManageMeetings;

