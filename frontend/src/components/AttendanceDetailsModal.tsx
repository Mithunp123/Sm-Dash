import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, X, Eye, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ViewFullStudentModal from "./ViewFullStudentModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

interface AttendanceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
  meetingId?: number;
  eventId?: number;
  title?: string;
}

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

const AttendanceDetailsModal = ({
  open,
  onOpenChange,
  projectId,
  meetingId,
  eventId,
  title = "Attendance Details"
}: AttendanceDetailsModalProps) => {
  const [savedDates, setSavedDates] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [viewFullOpen, setViewFullOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AttendanceRecord | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (open) {
      loadSavedDates();
    }
  }, [open, projectId, meetingId, eventId]);

  useEffect(() => {
    if (selectedDate && open) {
      loadAttendanceForDate(selectedDate);
    } else {
      setAttendanceRecords([]);
    }
  }, [selectedDate, open]);

  const loadSavedDates = async () => {
    setLoadingDates(true);
    try {
      let response;
      if (projectId) {
        response = await api.get(`/attendance/project/${projectId}/dates`);
      } else if (meetingId) {
        response = await api.get(`/attendance/meeting/${meetingId}/dates`);
      } else if (eventId) {
        response = await api.get(`/attendance/event/${eventId}/dates`);
      } else {
        setLoadingDates(false);
        return;
      }

      if (response.success && response.dates) {
        setSavedDates(response.dates);
        // Auto-select first date if available
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
      if (projectId) {
        response = await api.get(`/attendance/project/${projectId}/records?date=${date}`);
      } else if (meetingId) {
        response = await api.get(`/attendance/meeting/${meetingId}/records?date=${date}`);
      } else if (eventId) {
        response = await api.get(`/attendance/event/${eventId}/records?date=${date}`);
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

  const handleDownloadExcel = async () => {
    if (!selectedDate || attendanceRecords.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = attendanceRecords.map((record) => ({
        Name: record.user_name,
        Department: record.user_dept || "N/A",
        Year: record.user_year || "N/A",
        Status: record.status.charAt(0).toUpperCase() + record.status.slice(1),
        Notes: record.notes || "",
        "Attendance Date": new Date(record.attendance_date + "T00:00:00").toLocaleDateString(),
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Generate filename
      const dateStr = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).replace(/\//g, "-");
      const filename = `Attendance_${title.replace(/\s+/g, "_")}_${dateStr}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success("Excel file downloaded successfully");
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export Excel file");
    }
  };

  const handleViewFull = (record: AttendanceRecord) => {
    setSelectedStudent(record);
    setViewFullOpen(true);
  };

  const handleEditRecord = (record: AttendanceRecord) => {
    setEditRecord(record);
    setShowEditDialog(true);
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setEditRecord(null);
    setSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editRecord || !selectedDate) return;
    setSavingEdit(true);
    try {
      let response;
      if (projectId) {
        response = await api.updateProjectAttendance(editRecord.id, {
          status: editRecord.status,
          notes: editRecord.notes,
        });
      } else if (meetingId) {
        response = await api.updateAttendance(editRecord.id, {
          status: editRecord.status,
          notes: editRecord.notes,
        });
      } else if (eventId) {
        response = await api.markEventAttendance(eventId, {
          userId: editRecord.user_id,
          status: editRecord.status,
          notes: editRecord.notes,
        });
      }

      if (response && response.success === false) {
        toast.error(response.message || "Failed to update attendance");
      } else {
        toast.success("Attendance updated successfully");
        closeEditDialog();
        await loadAttendanceForDate(selectedDate);
      }
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      toast.error("Failed to update attendance");
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "present") {
      return <Badge className="bg-green-600 hover:bg-green-700">Present</Badge>;
    } else if (statusLower === "absent") {
      return <Badge variant="destructive">Absent</Badge>;
    } else if (statusLower === "late") {
      return <Badge className="bg-yellow-600 hover:bg-yellow-700">Late</Badge>;
    } else if (statusLower === "excused" || statusLower === "permission") {
      return <Badge className="bg-blue-600 hover:bg-blue-700">Excused</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0 [&>button]:hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDownloadExcel}
                  disabled={!selectedDate || attendanceRecords.length === 0}
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Excel
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar - Saved Dates */}
            <div className="w-64 border-r bg-gray-50 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Saved Dates
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingDates ? (
                  <div className="text-center text-sm text-gray-500 py-8">Loading dates...</div>
                ) : savedDates.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-8">No dates available</div>
                ) : (
                  <div className="space-y-2">
                    {savedDates.map((dateInfo) => (
                      <button
                        key={dateInfo.date}
                        onClick={() => setSelectedDate(dateInfo.date)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                          selectedDate === dateInfo.date
                            ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-md"
                            : "bg-white hover:bg-gray-100 border border-gray-200 text-gray-700"
                        }`}
                      >
                        <div className="font-medium">{formatDate(dateInfo.date)}</div>
                        <div className={`text-xs mt-1 ${selectedDate === dateInfo.date ? "text-orange-100" : "text-gray-500"}`}>
                          {dateInfo.count} {dateInfo.count === 1 ? "record" : "records"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Content - Attendance Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedDate ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Select a date to view attendance details</p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Loading attendance records...</p>
                </div>
              ) : attendanceRecords.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No attendance records found for this date</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="p-4 border-b bg-gray-50">
                    <h4 className="font-semibold text-gray-900">
                      Details for {formatDate(selectedDate)}
                    </h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Dept</TableHead>
                        <TableHead className="font-semibold">Year</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Notes</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{record.user_name}</TableCell>
                          <TableCell>{record.user_dept || "N/A"}</TableCell>
                          <TableCell>{record.user_year || "N/A"}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                            {record.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewFull(record)}
                                className="gap-1"
                              >
                                <Eye className="w-4 h-4" />
                                View Full
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Update status for {editRecord?.user_name}
            </DialogDescription>
          </DialogHeader>

          {editRecord && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editRecord.status}
                  onValueChange={(value) => setEditRecord({ ...editRecord, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editRecord.notes || ""}
                  onChange={(e) => setEditRecord({ ...editRecord, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Full Student Modal */}
      {selectedStudent && (
        <ViewFullStudentModal
          open={viewFullOpen}
          onOpenChange={setViewFullOpen}
          studentId={selectedStudent.user_id}
          projectId={projectId}
          meetingId={meetingId}
          eventId={eventId}
        />
      )}
    </>
  );
};

export default AttendanceDetailsModal;

