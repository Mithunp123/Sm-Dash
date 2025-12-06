import { useEffect, useState, useMemo, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, PhoneCall, UploadCloud, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

type CallStatus = "CALL_DONE" | "NOT_CALLED" | "STUDENT_NOT_PICKED" | "CALL_PENDING";

type MentoringAssignment = {
  id: number;
  mentee_name: string;
  mentee_phone?: string | null;
  project_id?: number | null;
  project_title?: string | null;
};

type MentorMenteeSummary = MentoringAssignment & {
  total_classes?: number | null;
  total_calls?: number | null;
  last_attendance_date?: string | null;
  last_attendance_status?: string | null;
  last_update_date?: string | null;
  last_update_status?: string | null;
  mentee_year?: string | null;
  mentee_school?: string | null;
  mentee_parent_contact?: string | null;
  mentee_address?: string | null;
  mentee_notes?: string | null;
};

const MENTEE_ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Class Taken" },
  { value: "ABSENT", label: "Not Taken" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "NOT_REACHABLE", label: "Student Not Reachable" },
];

const PhoneMentoringUpdate = () => {
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [volunteerName, setVolunteerName] = useState<string>("");
  const [menteeName, setMenteeName] = useState<string>("");
  const [status, setStatus] = useState<CallStatus | "">("");
  const [explanation, setExplanation] = useState<string>("");
  const [attempts, setAttempts] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignments, setAssignments] = useState<MentoringAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [myMentees, setMyMentees] = useState<MentorMenteeSummary[]>([]);
  const [loadingMentees, setLoadingMentees] = useState(true);
  const [attendanceDialog, setAttendanceDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null }>({ open: false });
  const [attendanceDateValue, setAttendanceDateValue] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [attendanceStatusValue, setAttendanceStatusValue] = useState<string>("PRESENT");
  const [attendanceNotesValue, setAttendanceNotesValue] = useState<string>("");
  const [attendanceCallRecording, setAttendanceCallRecording] = useState<File | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null; type: "updates" | "attendance" }>({
    open: false,
    type: "updates"
  });
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null }>({ open: false });
  const callStatusTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const currentUser = auth.getUser();
    if (currentUser?.name) {
      setVolunteerName(currentUser.name);
    }

    // Load mentee assignment
    (async () => {
      try {
        const res = await api.getMyPhoneMentoringAssignment();
        if (res?.success) {
          const fetchedAssignments: MentoringAssignment[] = res.assignments || (res.assignment ? [res.assignment] : []);
          setAssignments(fetchedAssignments);
          if (fetchedAssignments.length > 0) {
            setSelectedAssignmentId(fetchedAssignments[0].id);
            if (fetchedAssignments[0].mentee_name) {
              setMenteeName(fetchedAssignments[0].mentee_name);
            }
          } else if (res.assignment?.mentee_name) {
            setMenteeName(res.assignment.mentee_name);
            if (res.assignment?.id) {
              setSelectedAssignmentId(res.assignment.id);
            }
          }
          if (!volunteerName && res.volunteer?.name) {
            setVolunteerName(res.volunteer.name);
          }
        }
      } catch (e) {
        // Non-blocking – user can still fill the form
        console.warn("Failed to load mentoring assignment", e);
      }
    })();
  }, []);

  const loadMyMentees = async () => {
    try {
      setLoadingMentees(true);
      const res = await api.getMyMentees();
      if (res?.success) {
        const mentees = res.mentees || [];
        setMyMentees(mentees);
        // Set initial selected assignment if none is selected
        if (mentees.length > 0 && !selectedAssignmentId) {
          setSelectedAssignmentId(mentees[0].id);
          setMenteeName(mentees[0].mentee_name);
        }
      } else {
        setMyMentees([]);
        if (res?.message) {
          toast.error(res.message);
        }
      }
    } catch (error: any) {
      console.error("Failed to load mentees", error);
      toast.error(error?.message || "Failed to load mentees");
      setMyMentees([]);
    } finally {
      setLoadingMentees(false);
    }
  };

  useEffect(() => {
    loadMyMentees();
  }, []);

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return myMentees.find((m) => m.id === selectedAssignmentId) || null;
  }, [myMentees, selectedAssignmentId]);

  const selectedMenteeDetails = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return myMentees.find((m) => m.id === selectedAssignmentId) || null;
  }, [myMentees, selectedAssignmentId]);

  useEffect(() => {
    if (selectedAssignment && selectedAssignment.mentee_name) {
      setMenteeName(selectedAssignment.mentee_name);
    }
  }, [selectedAssignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) {
      toast.error("Please select call status");
      return;
    }
    if (!menteeName.trim()) {
      toast.error("Mentee name is required");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("date", date);
      formData.append("status", status);
      formData.append("mentee_name", menteeName.trim());
      formData.append("explanation", explanation.trim());
      if (selectedAssignmentId) {
        formData.append("assignment_id", selectedAssignmentId.toString());
      }
      if (selectedAssignment?.project_id) {
        formData.append("project_id", selectedAssignment.project_id.toString());
      }
      if (attempts) {
        formData.append("attempts", attempts);
      }
      if (file) {
        formData.append("attachment", file);
      }

      const res = await api.submitPhoneMentoringUpdate(formData);
      if (res?.success) {
        toast.success("Daily phone mentoring update submitted!");
        setStatus("");
        setExplanation("");
        setAttempts("");
        setFile(null);
      } else {
        toast.error(res?.message || "Failed to submit update");
      }
    } catch (err: any) {
      console.error("Submit phone mentoring update failed", err);
      toast.error(err?.message || "Failed to submit update");
    } finally {
      setSubmitting(false);
    }
  };

  const getExplanationLabel = () => {
    switch (status) {
      case "CALL_DONE":
        return "What did you discuss? Was the class taken?";
      case "NOT_CALLED":
        return "Reason for not calling";
      case "STUDENT_NOT_PICKED":
        return "How many times did you try? Any additional notes";
      case "CALL_PENDING":
        return "Plan for completing the call";
      default:
        return "Short explanation";
    }
  };

  const openAttendanceModal = (mentee: MentorMenteeSummary, attendance?: any) => {
    setAttendanceDialog({ open: true, mentee });
    setEditingAttendance(attendance || null);
    if (attendance) {
      setAttendanceDateValue(attendance.attendance_date);
      setAttendanceStatusValue(attendance.status);
      setAttendanceNotesValue(attendance.notes || "");
      setAttendanceCallRecording(null);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setAttendanceDateValue(today);
      setAttendanceStatusValue("PRESENT");
      setAttendanceNotesValue("");
      setAttendanceCallRecording(null);
    }
  };

  const handleSaveAttendance = async () => {
    if (!attendanceDialog.mentee) return;
    try {
      if (editingAttendance) {
        await api.updateMentorAttendance(attendanceDialog.mentee.id, editingAttendance.id, {
          date: attendanceDateValue,
          status: attendanceStatusValue,
          notes: attendanceNotesValue.trim() ? attendanceNotesValue.trim() : undefined,
          call_recording: attendanceCallRecording || undefined
        });
        toast.success("Attendance updated");
      } else {
        await api.saveMentorAttendance(attendanceDialog.mentee.id, {
          date: attendanceDateValue,
          status: attendanceStatusValue,
          notes: attendanceNotesValue.trim() ? attendanceNotesValue.trim() : undefined,
          call_recording: attendanceCallRecording || undefined
        });
        toast.success("Attendance saved");
      }
      setAttendanceDialog({ open: false, mentee: undefined });
      setEditingAttendance(null);
      setAttendanceCallRecording(null);
      await loadMyMentees();
      if (historyDialog.open && historyDialog.type === "attendance") {
        await openHistoryModal(attendanceDialog.mentee, "attendance");
      }
    } catch (error: any) {
      console.error("Failed to save attendance", error);
      toast.error(error?.message || "Failed to save attendance");
    }
  };

  const handleDeleteAttendance = async (attendanceId: number) => {
    if (!attendanceDialog.mentee) return;
    if (!confirm("Are you sure you want to delete this attendance record?")) return;
    try {
      await api.deleteMentorAttendance(attendanceDialog.mentee.id, attendanceId);
      toast.success("Attendance deleted");
      await loadMyMentees();
      if (historyDialog.open && historyDialog.type === "attendance") {
        await openHistoryModal(attendanceDialog.mentee, "attendance");
      }
    } catch (error: any) {
      console.error("Failed to delete attendance", error);
      toast.error(error?.message || "Failed to delete attendance");
    }
  };

  const openHistoryModal = async (mentee: MentorMenteeSummary, type: "updates" | "attendance") => {
    setHistoryDialog({ open: true, mentee, type });
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      if (type === "updates") {
        const res = await api.getMentorMenteeUpdates(mentee.id);
        if (res?.success) {
          setHistoryData(res.updates || []);
        } else if (res?.message) {
          toast.error(res.message);
        }
      } else {
        const res = await api.getMentorAttendance(mentee.id);
        if (res?.success) {
          setHistoryData(res.attendance || []);
        } else if (res?.message) {
          toast.error(res.message);
        }
      }
    } catch (error: any) {
      console.error("Failed to load mentee history", error);
      toast.error(error?.message || "Failed to load mentee history");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                My Mentees
              </h1>
              <p className="text-sm md:text-base text-gray-600">
                View and manage your assigned mentees.
              </p>
            </div>
          </div>
        </div>

        <Card className="border shadow-xl bg-white">
          <CardHeader>
            <CardTitle className="text-emerald-600 text-lg md:text-xl">My Mentees</CardTitle>
            <CardDescription className="text-gray-600">
              Track attendance and daily updates for each mentee assigned to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMentees ? (
              <div className="text-center py-8 text-gray-500">Loading mentees...</div>
            ) : myMentees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No mentees assigned yet. Please contact your coordinator.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myMentees.map((mentee) => (
                  <div key={mentee.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{mentee.mentee_name}</h3>
                        <p className="text-xs text-gray-600">{mentee.mentee_phone || "No phone"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500">
                        {mentee.project_title || "Project TBD"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl bg-white border border-gray-200 p-3">
                        <p className="text-2xl font-bold text-gray-900">{mentee.total_classes || 0}</p>
                        <p className="text-xs text-gray-600">Classes Taken</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-200 p-3">
                        <p className="text-2xl font-bold text-gray-900">{mentee.total_calls || 0}</p>
                        <p className="text-xs text-gray-600">Calls Done</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        Last Attendance:{" "}
                        <span className="text-gray-900 font-medium">
                          {mentee.last_attendance_date
                            ? `${mentee.last_attendance_date} (${mentee.last_attendance_status || "-"})`
                            : "—"}
                        </span>
                      </p>
                      <p>
                        Last Update:{" "}
                        <span className="text-gray-900 font-medium">
                          {mentee.last_update_date
                            ? `${mentee.last_update_date} (${mentee.last_update_status || "-"})`
                            : "—"}
                        </span>
                      </p>
                      <p>
                        Standard / School:{" "}
                        <span className="text-gray-900 font-medium">
                          {(mentee.mentee_year || "—") + " / " + (mentee.mentee_school || "—")}
                        </span>
                      </p>
                      <p>
                        Parent: <span className="text-gray-900 font-medium">{mentee.mentee_parent_contact || "—"}</span>
                      </p>
                      <p>
                        Panchayat / District:{" "}
                        <span className="text-gray-900 font-medium">
                          {(mentee.mentee_address || "—") + " / " + (mentee.mentee_notes || "—")}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openAttendanceModal(mentee)} className="flex-1">
                        Mark Attendance
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openHistoryModal(mentee, "updates")}
                      >
                        Daily Updates
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openHistoryModal(mentee, "attendance")}
                      >
                        Attendance
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={attendanceDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setAttendanceDialog({ open: false, mentee: undefined });
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Attendance</DialogTitle>
              <DialogDescription>
                {attendanceDialog.mentee ? `Record class status for ${attendanceDialog.mentee.mentee_name}` : ""}
              </DialogDescription>
            </DialogHeader>
            {attendanceDialog.mentee && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={attendanceDateValue}
                    onChange={(e) => setAttendanceDateValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={attendanceStatusValue}
                    onValueChange={(val) => setAttendanceStatusValue(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENTEE_ATTENDANCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={attendanceNotesValue}
                    onChange={(e) => setAttendanceNotesValue(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                {attendanceStatusValue === "PRESENT" && (
                  <div className="space-y-2">
                    <Label>Call Recording (Optional)</Label>
                    <Input
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setAttendanceCallRecording(e.target.files[0]);
                        } else {
                          setAttendanceCallRecording(null);
                        }
                      }}
                    />
                    {attendanceCallRecording && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <UploadCloud className="w-3 h-3" />
                        {attendanceCallRecording.name}
                      </p>
                    )}
                    {editingAttendance?.call_recording_path && !attendanceCallRecording && (
                      <p className="text-xs text-gray-600">
                        Current: <a href={editingAttendance.call_recording_path} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">View existing recording</a>
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Max size: 10MB. Accepted: audio & video files.
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAttendanceDialog({ open: false, mentee: undefined });
                      setEditingAttendance(null);
                      setAttendanceCallRecording(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAttendance}>
                    {editingAttendance ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={historyDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setHistoryDialog({ open: false, mentee: undefined, type: "updates" });
              setHistoryData([]);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {historyDialog.mentee
                  ? `${historyDialog.type === "updates" ? "Daily Updates" : "Attendance"} – ${historyDialog.mentee.mentee_name}`
                  : "History"}
              </DialogTitle>
              <DialogDescription>
                {historyDialog.type === "updates"
                  ? "Recent call notes and updates."
                  : "Attendance records logged for this mentee."}
              </DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : historyData.length === 0 ? (
              <div className="py-8 text-center text-gray-500">No records found.</div>
            ) : historyDialog.type === "updates" ? (
              <div className="space-y-3">
                {historyData.map((row: any) => (
                  <div key={row.id} className="border border-gray-200 rounded-xl p-4 space-y-1 bg-gray-50">
                    <div className="flex justify-between text-sm text-gray-900 font-medium">
                      <span>{row.update_date}</span>
                      <span>{row.status}</span>
                    </div>
                    {row.explanation && (
                      <p className="text-sm text-gray-700">{row.explanation}</p>
                    )}
                    <div className="text-xs text-gray-600 flex flex-wrap gap-3">
                      {row.attempts ? <span>Attempts: {row.attempts}</span> : null}
                      {row.attachment_path ? (
                        <a
                          href={row.attachment_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 underline hover:text-emerald-700"
                        >
                          View Attachment
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.map((row: any) => (
                  <div key={row.id} className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm text-gray-900 font-medium mb-1">
                          <span>{row.attendance_date}</span>
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                            {row.status === "PRESENT" ? "Class Taken" : row.status === "ABSENT" ? "Not Taken" : row.status === "FOLLOW_UP" ? "Follow Up" : "Not Reachable"}
                          </span>
                        </div>
                        {row.notes && (
                          <p className="text-sm text-gray-700 mb-2">{row.notes}</p>
                        )}
                        {row.call_recording_path && (
                          <div className="mb-2">
                            <a
                              href={row.call_recording_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 underline hover:text-emerald-700 flex items-center gap-1"
                            >
                              <UploadCloud className="w-3 h-3" />
                              View Call Recording
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (historyDialog.mentee) {
                              openAttendanceModal(historyDialog.mentee, row);
                            }
                          }}
                          className="h-8"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteAttendance(row.id)}
                          className="h-8"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={infoDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setInfoDialog({ open: false, mentee: undefined });
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mentee Information</DialogTitle>
              <DialogDescription>
                {infoDialog.mentee ? infoDialog.mentee.mentee_name : "Details"}
              </DialogDescription>
            </DialogHeader>
            {infoDialog.mentee && (
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="text-gray-500 font-medium">Project:</span> <span className="text-gray-900">{infoDialog.mentee.project_title || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">Phone:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_phone || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">Standard:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_year || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">School:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_school || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">Parent:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_parent_contact || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">Panchayat:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_address || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">District:</span> <span className="text-gray-900">{infoDialog.mentee.mentee_notes || "—"}</span></p>
                <p><span className="text-gray-500 font-medium">Classes Taken:</span> <span className="text-gray-900">{infoDialog.mentee.total_classes || 0}</span></p>
                <p><span className="text-gray-500 font-medium">Calls Done:</span> <span className="text-gray-900">{infoDialog.mentee.total_calls || 0}</span></p>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </main>
      <Footer />
    </div>
  );
};

export default PhoneMentoringUpdate;


