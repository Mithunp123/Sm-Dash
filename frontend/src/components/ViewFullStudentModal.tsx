import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ViewFullStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  projectId?: number;
  meetingId?: number;
  eventId?: number;
}

interface StudentDetails {
  id: number;
  name: string;
  email: string;
  dept?: string;
  year?: string;
  phone?: string;
  roll_no?: string;
  status_history?: AttendanceHistory[];
}

interface AttendanceHistory {
  id: number;
  attendance_date: string;
  status: string;
  notes?: string;
  marked_at?: string;
}

const ViewFullStudentModal = ({
  open,
  onOpenChange,
  studentId,
  projectId,
  meetingId,
  eventId,
}: ViewFullStudentModalProps) => {
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && studentId) {
      loadStudentDetails();
    }
  }, [open, studentId, projectId, meetingId, eventId]);

  const loadStudentDetails = async () => {
    setLoading(true);
    try {
      let response;
      if (projectId) {
        response = await api.get(`/attendance/student/${studentId}/project/${projectId}/details`);
      } else if (meetingId) {
        response = await api.get(`/attendance/student/${studentId}/meeting/${meetingId}/details`);
      } else if (eventId) {
        response = await api.get(`/attendance/student/${studentId}/event/${eventId}/details`);
      } else {
        response = await api.get(`/attendance/student/${studentId}/details`);
      }

      if (response.success && response.student) {
        setStudentDetails(response.student);
      } else {
        toast.error("Failed to load student details");
      }
    } catch (error: any) {
      console.error("Error loading student details:", error);
      toast.error("Failed to load student details");
    } finally {
      setLoading(false);
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
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Student Details</DialogTitle>
            <DialogDescription className="sr-only">
              Comprehensive information and attendance history for the selected student
            </DialogDescription>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Loading student details...</p>
            </div>
          ) : !studentDetails ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No student details found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Name
                    </label>
                    <p className="text-base font-medium text-gray-900 mt-1">{studentDetails.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Email
                    </label>
                    <p className="text-base font-medium text-gray-900 mt-1">{studentDetails.email}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Department
                    </label>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {studentDetails.dept || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Year
                    </label>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {studentDetails.year || "N/A"}
                    </p>
                  </div>
                  {studentDetails.roll_no && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Roll Number
                      </label>
                      <p className="text-base font-medium text-gray-900 mt-1">
                        {studentDetails.roll_no}
                      </p>
                    </div>
                  )}
                  {studentDetails.phone && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Phone
                      </label>
                      <p className="text-base font-medium text-gray-900 mt-1">
                        {studentDetails.phone}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status History */}
              {studentDetails.status_history && studentDetails.status_history.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Status History</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                          <TableHead className="font-semibold">Marked At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentDetails.status_history.map((record) => (
                          <TableRow key={record.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              {formatDate(record.attendance_date)}
                            </TableCell>
                            <TableCell>{getStatusBadge(record.status)}</TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {record.notes || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {record.marked_at ? formatDateTime(record.marked_at) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(!studentDetails.status_history ||
                studentDetails.status_history.length === 0) && (
                  <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
                    <p>No attendance history available</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewFullStudentModal;

