import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarMonth } from "@/components/CalendarMonth";
import { Download, Eye, Edit, Calendar, Briefcase, Users, ArrowLeft, CheckCircle2, Search, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  user_dept?: string;
  user_year?: string;
  status: string;
  notes?: string;
  attendance_date: string;
  marked_at?: string;
}

interface DateInfo {
  date: string;
  count: number;
}

const AttendanceCalendarView = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("Attendance Calendar");
  const [savedDates, setSavedDates] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "late" | "excused">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (type && id) {
      loadInfo();
      loadSavedDates();
    }
  }, [type, id]);

  useEffect(() => {
    if (selectedDate) {
      loadAttendanceForDate(selectedDate);
    } else {
      setAttendanceRecords([]);
    }
  }, [selectedDate]);

  const loadInfo = async () => {
    try {
      let fetchedTitle = "Attendance Calendar";

      if (type === 'project') {
        const res = await api.getProjects();
        if (res.success && res.projects) {
          const p = res.projects.find((p: any) => p.id === Number(id));
          if (p) fetchedTitle = `${p.title} - Attendance`;
        }
      } else if (type === 'meeting') {
        const res = await api.getMeetings();
        if (res.success && res.meetings) {
          const m = res.meetings.find((m: any) => m.id === Number(id));
          if (m) fetchedTitle = `${m.title} - Attendance`;
        }
      } else if (type === 'event') {
        const res = await api.getEvents();
        if (res.success && res.events) {
          const e = res.events.find((e: any) => e.id === Number(id));
          if (e) fetchedTitle = `${e.title} - Attendance`;
        }
      }

      setTitle(fetchedTitle);
    } catch (error) {
      console.error('Error loading info:', error);
    }
  };

  const loadSavedDates = async () => {
    setLoadingDates(true);
    try {
      let response;
      if (type === 'project') {
        response = await api.get(`/attendance/project/${id}/dates`);
      } else if (type === 'meeting') {
        response = await api.get(`/attendance/meeting/${id}/dates`);
      } else if (type === 'event') {
        response = await api.get(`/attendance/event/${id}/dates`);
      } else {
        setLoadingDates(false);
        return;
      }

      if (response.success && response.dates) {
        setSavedDates(response.dates);
        // Auto-select the latest date
        if (response.dates.length > 0 && !selectedDate) {
          setSelectedDate(response.dates[0].date);
        }
      }
    } catch (error: any) {
      console.error("Error loading dates:", error);
      toast.error("Failed to load saved dates");
    } finally {
      setLoadingDates(false);
    }
  };

  const loadAttendanceForDate = async (date: string) => {
    setLoading(true);
    try {
      let response;
      if (type === 'project') {
        response = await api.get(`/attendance/project/${id}/records?date=${date}`);
      } else if (type === 'meeting') {
        response = await api.get(`/attendance/meeting/${id}/records?date=${date}`);
      } else if (type === 'event') {
        response = await api.get(`/attendance/event/${id}/records?date=${date}`);
      } else {
        setLoading(false);
        return;
      }

      if (response.success && response.records) {
        setAttendanceRecords(response.records);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error: any) {
      console.error("Error loading attendance:", error);
      toast.error("Failed to load attendance records");
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (isoDate: string) => {
    setSelectedDate(isoDate);
  };

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = record.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.user_dept && record.user_dept.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (record.user_year && record.user_year.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && record.status.toLowerCase() === statusFilter;
  });

  const counts = {
    present: attendanceRecords.filter(r => r.status.toLowerCase() === 'present').length,
    absent: attendanceRecords.filter(r => r.status.toLowerCase() === 'absent').length,
    late: attendanceRecords.filter(r => r.status.toLowerCase() === 'late').length,
    excused: attendanceRecords.filter(r => ['excused', 'permission'].includes(r.status.toLowerCase())).length,
    total: attendanceRecords.length
  };

  const handleBulkMark = async (status: string) => {
    if (!selectedDate || attendanceRecords.length === 0) {
      toast.error("No records to mark");
      return;
    }

    const count = attendanceRecords.length;
    if (!confirm(`Mark all ${count} students as '${status.charAt(0).toUpperCase() + status.slice(1)}'?`)) return;

    try {
      const updates = attendanceRecords.map(async (record) => {
        if (type === 'project') {
          return api.updateProjectAttendance(record.id, { status });
        } else if (type === 'meeting') {
          return api.updateAttendance(record.id, { status });
        } else if (type === 'event') {
          return api.updateEventAttendance(record.id, { status });
        }
      });

      await Promise.all(updates);
      toast.success(`All students marked as ${status}`);
      loadAttendanceForDate(selectedDate);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update records");
    }
  };

  const handleEditClick = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditStatus(record.status);
    setEditNotes(record.notes || "");
    setShowMarkDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord) return;
    
    setIsSaving(true);
    try {
      let response;
      if (type === 'project') {
        response = await api.updateProjectAttendance(selectedRecord.id, {
          status: editStatus,
          notes: editNotes
        });
      } else if (type === 'meeting') {
        response = await api.updateAttendance(selectedRecord.id, {
          status: editStatus,
          notes: editNotes
        });
      } else if (type === 'event') {
        response = await api.updateEventAttendance(selectedRecord.id, {
          status: editStatus,
          notes: editNotes
        });
      }

      if (response?.success) {
        toast.success("Record updated successfully");
        setShowMarkDialog(false);
        loadAttendanceForDate(selectedDate!);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update record");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedDate || attendanceRecords.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const excelData = attendanceRecords.map((record) => ({
        Name: record.user_name,
        Department: record.user_dept || "N/A",
        Year: record.user_year || "N/A",
        Status: record.status.charAt(0).toUpperCase() + record.status.slice(1),
        Notes: record.notes || "",
        "Attendance Date": formatDate(record.attendance_date),
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      try {
        const dateParts = selectedDate.split('-');
        const dateStr = [dateParts[1], dateParts[2], dateParts[0]].join("-");
        const filename = `Attendance_${title.replace(/\s+/g, "_")}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
      } catch {
        XLSX.writeFile(wb, `Attendance_${title.replace(/\s+/g, "_")}.xlsx`);
      }
      toast.success("Excel file downloaded successfully");
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export Excel file");
    }
  };

  const dateEvents = savedDates.map(d => ({
    id: d.date,
    title: `${d.count} record${d.count > 1 ? 's' : ''}`,
    date: d.date,
    type: 'meeting' as const
  }));

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return 'bg-green-600 text-white';
      case 'absent': return 'bg-red-600 text-white';
      case 'late': return 'bg-amber-600 text-white';
      case 'excused':
      case 'permission': return 'bg-blue-600 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      let date: Date | null = null;
      
      // Try parsing as ISO date (YYYY-MM-DD)
      if (dateString.includes('-') && !dateString.includes(':')) {
        date = new Date(dateString + 'T00:00:00Z');
      }
      // Try parsing as full datetime
      else if (dateString.includes('T')) {
        date = new Date(dateString);
      }
      // Try parsing as timestamp
      else if (!isNaN(Number(dateString))) {
        date = new Date(Number(dateString));
      }
      // Fallback: try direct parse
      else {
        date = new Date(dateString);
      }
      
      // Validate the date
      if (!date || isNaN(date.getTime())) {
        return '-';
      }
      
      return date.toLocaleDateString();
    } catch (error) {
      return '-';
    }
  };

  const getDayName = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      let date: Date | null = null;
      
      // Try parsing as ISO date (YYYY-MM-DD)
      if (dateString.includes('-') && !dateString.includes(':')) {
        date = new Date(dateString + 'T00:00:00Z');
      }
      // Try parsing as full datetime
      else if (dateString.includes('T')) {
        date = new Date(dateString);
      }
      // Try parsing as timestamp
      else if (!isNaN(Number(dateString))) {
        date = new Date(Number(dateString));
      }
      // Fallback: try direct parse
      else {
        date = new Date(dateString);
      }
      
      // Validate the date
      if (!date || isNaN(date.getTime())) {
        return '';
      }
      
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    } catch (error) {
      return '';
    }
  };

  const handleDeleteClick = (record: AttendanceRecord) => {
    setRecordToDelete(record);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    setIsDeleting(true);
    try {
      let response;
      if (type === 'project') {
        response = await api.delete(`/attendance/project/records/${recordToDelete.id}`);
      } else if (type === 'meeting') {
        response = await api.delete(`/attendance/${recordToDelete.id}`);
      } else if (type === 'event') {
        response = await api.delete(`/attendance/event/records/${recordToDelete.id}`);
      }

      if (response?.success) {
        toast.success('Record deleted successfully');
        setShowDeleteDialog(false);
        setRecordToDelete(null);
        loadAttendanceForDate(selectedDate!);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 p-4 text-white">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 px-4 pt-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{title}</h1>
              <p className="text-white mt-1">
                {selectedDate ? `Attendance for ${formatDate(selectedDate)}` : "Select a date to view attendance"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 min-h-[calc(100vh-200px)] bg-slate-950">
          {/* Calendar Section - Left Side */}
          <div className="lg:col-span-2 bg-slate-900 text-white p-6 overflow-y-auto border-r border-slate-800">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Select Date</h2>
              </div>
                {loadingDates ? (
                  <div className="text-center text-white py-8 text-lg font-semibold">Loading dates...</div>
                ) : (
                  <>
                    <div className="flex justify-between items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)}
                        className="bg-blue-800 border-blue-700 text-white hover:bg-blue-700"
                      >
                        ←
                      </Button>
                      <span className="font-bold text-lg text-white">
                        {new Date(currentYear, currentMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)}
                        className="bg-blue-800 border-blue-700 text-white hover:bg-blue-700"
                      >
                        →
                      </Button>
                    </div>
                    
                    <CalendarMonth
                      month={currentMonth}
                      year={currentYear}
                      events={dateEvents}
                      onDayClick={handleDateClick}
                      className="text-xs"
                      showHeader={false}
                      showDayNames={false}
                    />

                    {/* Saved Dates List - Horizontal */}
                    <div className="mt-6 border-t border-blue-500 pt-4">
                      <h3 className="font-bold text-lg mb-3 text-white">Attendance Dates ({savedDates.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {savedDates.length > 0 ? (
                          savedDates.map(d => (
                            <button
                              key={d.date}
                              onClick={() => setSelectedDate(d.date)}
                              className={`px-4 py-2 rounded-lg text-base font-semibold transition whitespace-nowrap ${
                                selectedDate === d.date
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-white border border-blue-500'
                              }`}
                            >
                              {formatDate(d.date)} ({d.count})
                            </button>
                          ))
                        ) : (
                          <p className="text-white text-base font-semibold py-2">No attendance records yet</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>

          {/* Attendance Records - Right Side */}
          <div className="lg:col-span-3 bg-slate-900 text-white p-6 overflow-y-auto">
            {selectedDate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white">Attendance Records</h2>
                    <p className="text-lg text-white mt-1 font-semibold">
                      {selectedDate ? `${formatDate(selectedDate)}` : 'Select a date'}
                    </p>
                  </div>
                  <Button onClick={handleDownloadExcel} disabled={attendanceRecords.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
                <div className="space-y-4">
                  {/* Stats Row */}
                  {attendanceRecords.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-600 border border-blue-500 p-4 rounded-lg text-center">
                        <div className="text-4xl font-bold text-white">{counts.total}</div>
                        <div className="text-base text-white font-semibold mt-1">Total</div>
                      </div>
                      <div className="bg-green-600 border border-green-500 p-4 rounded-lg text-center">
                        <div className="text-4xl font-bold text-white">{counts.present}</div>
                        <div className="text-base text-white font-semibold mt-1">Present</div>
                      </div>
                      <div className="bg-red-600 border border-red-500 p-4 rounded-lg text-center">
                        <div className="text-4xl font-bold text-white">{counts.absent}</div>
                        <div className="text-base text-white font-semibold mt-1">Absent</div>
                      </div>
                      <div className="bg-amber-600 border border-amber-500 p-4 rounded-lg text-center">
                        <div className="text-4xl font-bold text-white">{counts.late}</div>
                        <div className="text-base text-white font-semibold mt-1">Late</div>
                      </div>
                    </div>
                  )}

                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="Search by name or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-800 border-blue-500 border-2 text-white placeholder:text-gray-100 text-base font-semibold"
                    />
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-blue-500 border-2 text-white text-base font-semibold">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="excused">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Action Buttons */}
                  {filteredRecords.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkMark('present')}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1 text-white" />
                        Mark All Present
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkMark('absent')}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        Mark All Absent
                      </Button>
                    </div>
                  )}

                  {/* Records Table */}
                  {loading ? (
                    <div className="text-center py-8 text-white text-lg font-bold">Loading records...</div>
                  ) : filteredRecords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-600 hover:bg-blue-600 border-blue-600">
                            <TableHead className="text-white font-bold text-base">Name</TableHead>
                            <TableHead className="text-white font-bold text-base">Department</TableHead>
                            <TableHead className="text-white font-bold text-base">Year</TableHead>
                            <TableHead className="text-white font-bold text-base">Status</TableHead>
                            <TableHead className="text-white font-bold text-base">Notes</TableHead>
                            <TableHead className="text-white font-bold text-base">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.map(record => (
                            <TableRow key={record.id} className="hover:bg-slate-800 border-slate-700">
                              <TableCell className="font-bold text-white text-base">{record.user_name || record.name || 'N/A'}</TableCell>
                              <TableCell className="text-white text-base font-semibold">{record.user_dept || record.department || 'N/A'}</TableCell>
                              <TableCell className="text-white text-base font-semibold">{record.user_year || record.year || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(record.status || record.attendance_status || 'unknown')}>
                                  {(record.status || record.attendance_status || 'Unknown').toString().charAt(0).toUpperCase() + (record.status || record.attendance_status || 'Unknown').toString().slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-base text-white font-semibold">{record.notes || record.comments || '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditClick(record)}
                                    title="Edit record"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteClick(record)}
                                    className="text-white hover:bg-white/10 hover:text-white border-white/20"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white text-lg font-bold">No attendance records found</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center flex items-center justify-center h-full">
                <div>
                  <Calendar className="w-16 h-16 mx-auto text-blue-400 mb-4" />
                  <p className="text-white text-xl font-bold">Select a date from the calendar to view attendance records</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div>
                <Label>Student Name</Label>
                <p className="mt-1 font-medium">{selectedRecord.user_name}</p>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add any notes..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowMarkDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the attendance record for <strong>{recordToDelete?.user_name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceCalendarView;
