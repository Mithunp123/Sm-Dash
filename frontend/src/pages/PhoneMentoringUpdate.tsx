import { useEffect, useState, useMemo, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, PhoneCall, UploadCloud, CheckCircle2, Edit, Trash2, Download, ArrowLeft, Mic, Play, X, MessageSquare, Calendar, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const getUserRole = () => {
  try {
    const user = auth.getUser();
    return user?.role || 'student';
  } catch {
    return 'student';
  }
};

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
  calls_taken_by_mentor?: number | null;
  expected_classes?: number | null;
  last_attendance_date?: string | null;
  last_attendance_status?: string | null;
  last_update_date?: string | null;
  last_update_status?: string | null;
  mentee_year?: string | null;
  mentee_school?: string | null;
  mentee_parent_contact?: string | null;
  mentee_address?: string | null;
  mentee_district?: string | null;
  mentee_notes?: string | null;
};

const MENTEE_ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Class Taken" },
  { value: "ABSENT", label: "Not Taken" },
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
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null; type: "attendance" }>({
    open: false,
    type: "attendance"
  });
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null }>({ open: false });
  const [editMenteeDialog, setEditMenteeDialog] = useState<{ open: boolean; mentee?: MentorMenteeSummary | null }>({ open: false });
  const [editMenteeForm, setEditMenteeForm] = useState({
    mentee_name: "",
    mentee_phone: "",
    mentee_year: "",
    mentee_gender: "",
    mentee_school: "",
    mentee_district: "",
    mentee_address: "",
    mentee_parent_contact: "",
    mentee_notes: ""
  });
  const [savingMentee, setSavingMentee] = useState(false);
  const [mentorInfo, setMentorInfo] = useState<any>(null);
  const callStatusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [showBulkAttendanceDialog, setShowBulkAttendanceDialog] = useState(false);
  const [bulkAttendanceRecords, setBulkAttendanceRecords] = useState<Record<number, { status: string; notes: string; callRecording?: File }>>({});
  const [bulkAttendanceDate, setBulkAttendanceDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const navigate = useNavigate();

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
    loadMentorInfo();
  }, []);

  const loadMentorInfo = async () => {
    try {
      const currentUser = auth.getUser();
      if (currentUser) {
        setMentorInfo({
          name: currentUser.name,
          email: currentUser.email,
          id: currentUser.id
        });
      }
    } catch (error) {
      console.error("Failed to load mentor info", error);
    }
  };

  const openEditMenteeDialog = (mentee: MentorMenteeSummary) => {
    setEditMenteeForm({
      mentee_name: mentee.mentee_name || "",
      mentee_phone: mentee.mentee_phone || "",
      mentee_year: mentee.mentee_year || "",
      mentee_gender: (mentee as any).mentee_gender || "",
      mentee_school: mentee.mentee_school || "",
      mentee_district: (mentee as any).mentee_district || "",
      mentee_address: mentee.mentee_address || "",
      mentee_parent_contact: mentee.mentee_parent_contact || "",
      mentee_notes: mentee.mentee_notes || ""
    });
    setEditMenteeDialog({ open: true, mentee });
  };

  const handleSaveMenteeDetails = async () => {
    if (!editMenteeDialog.mentee || !editMenteeDialog.mentee.project_id) {
      toast.error("Mentee information is incomplete");
      return;
    }

    try {
      setSavingMentee(true);
      const payload: any = {
        mentee_name: editMenteeForm.mentee_name.trim(),
        mentee_phone: editMenteeForm.mentee_phone?.trim() || null,
        mentee_year: editMenteeForm.mentee_year?.trim() || null,
        mentee_gender: editMenteeForm.mentee_gender || null,
        mentee_school: editMenteeForm.mentee_school?.trim() || null,
        mentee_district: editMenteeForm.mentee_district?.trim() || null,
        mentee_address: editMenteeForm.mentee_address?.trim() || null,
        mentee_parent_contact: editMenteeForm.mentee_parent_contact?.trim() || null,
        mentee_notes: editMenteeForm.mentee_notes?.trim() || null
      };

      const response = await api.updateProjectMentee(
        editMenteeDialog.mentee.project_id,
        editMenteeDialog.mentee.id,
        payload
      );

      if (response.success) {
        toast.success("Mentee details updated successfully");
        setEditMenteeDialog({ open: false, mentee: undefined });
        await loadMyMentees();
      } else {
        toast.error(response.message || "Failed to update mentee details");
      }
    } catch (error: any) {
      console.error("Failed to update mentee details", error);
      toast.error(error?.message || "Failed to update mentee details");
    } finally {
      setSavingMentee(false);
    }
  };

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

    // Validate: reason is mandatory for non-PRESENT status
    if (attendanceStatusValue !== 'PRESENT' && !attendanceNotesValue.trim()) {
      toast.error("Reason is required for absence");
      return;
    }

    try {
      if (editingAttendance) {
        await api.updateMentorAttendance(attendanceDialog.mentee.id, editingAttendance.id, {
          date: attendanceDateValue,
          status: attendanceStatusValue,
          notes: attendanceNotesValue.trim() ? attendanceNotesValue.trim() : undefined
        });
        toast.success("Attendance updated");
      } else {
        await api.saveMentorAttendance(attendanceDialog.mentee.id, {
          date: attendanceDateValue,
          status: attendanceStatusValue,
          notes: attendanceNotesValue.trim() ? attendanceNotesValue.trim() : undefined
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

  const openHistoryModal = async (mentee: MentorMenteeSummary, type: "attendance" = "attendance") => {
    setHistoryDialog({ open: true, mentee, type });
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      if (type === "attendance") {
        const res = await api.getMentorAttendance(mentee.id);
        if (res?.success) {
          const sortedData = (res.attendance || []).sort((a: any, b: any) =>
            new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()
          );
          setHistoryData(sortedData);
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

  const downloadAttendance = () => {
    if (!historyDialog.mentee || historyData.length === 0) {
      toast.error("No attendance data to download");
      return;
    }

    try {
      // Create Excel data
      const excelData = historyData.map((row: any) => ({
        'Date': row.attendance_date || "",
        'Class Status': row.status === "PRESENT" ? "Class Taken" :
          row.status === "ABSENT" ? "Not Taken" :
            row.status === "FOLLOW_UP" ? "Follow Up" :
              row.status === "NOT_REACHABLE" ? "Not Reachable" : row.status || "",
        'Notes': row.notes || ""
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Generate filename
      const filename = `attendance_${historyDialog.mentee?.mentee_name}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success(`Attendance data downloaded as ${filename}`);
    } catch (error: any) {
      console.error("Failed to download attendance", error);
      toast.error("Failed to download attendance data");
    }
  };

  // Group mentees by project - filter out duplicates based on mentee name, phone, and project
  const menteesByProject = useMemo(() => {
    // Remove duplicates: check by project_id + name+phone combination
    // Same mentee name+phone in the same project = duplicate
    const seenByProjectAndNamePhone = new Map<string, MentorMenteeSummary>();
    const seenById = new Set<number>();
    const uniqueMentees: MentorMenteeSummary[] = [];

    // Sort by ID descending to keep most recent first
    const sortedMentees = [...myMentees].sort((a, b) => (b.id || 0) - (a.id || 0));

    sortedMentees.forEach(mentee => {
      // Skip if we've already seen this exact ID
      if (seenById.has(mentee.id)) {
        console.warn(`❌ Duplicate ID filtered: ${mentee.mentee_name} (ID: ${mentee.id})`);
        return;
      }

      // Create unique key: phone (primary) or name (secondary)
      // IGNORE project_id to catch duplicates where one entry is "Unassigned" and another is "Assigned"
      const name = (mentee.mentee_name || '').trim().toLowerCase().replace(/\s+/g, '');
      const phone = (mentee.mentee_phone || '').trim().replace(/\s+/g, '');

      // Use phone as primary deduplication key if available, otherwise name
      const key = phone.length > 5 ? `phone_${phone}` : `name_${name}`;

      const existing = seenByProjectAndNamePhone.get(key);

      if (existing) {
        // Duplicate found: same person (by phone or name)

        // Decide which record is "better"
        // 1. Prefer record with a valid Project ID (vs null/0)
        // 2. Prefer record that matches the name better (not a phone number as name)
        // 3. Prefer record with more details (year, school, etc)
        // 4. Prefer newer ID

        const hasProject = !!mentee.project_id;
        const existingHasProject = !!existing.project_id;

        const isNameValid = !/^\d+$/.test(mentee.mentee_name || '');
        const existingNameValid = !/^\d+$/.test(existing.mentee_name || '');

        let shouldReplace = false;

        // Rule 1: Always prefer assigned project over unassigned
        if (hasProject && !existingHasProject) {
          shouldReplace = true;
        }
        // Rule 2: If project status is same, prefer real name over phone-number-as-name
        else if (hasProject === existingHasProject) {
          if (isNameValid && !existingNameValid) {
            shouldReplace = true;
          } else if (isNameValid === existingNameValid) {
            // Rule 3: If both have project (or both don't), and names are valid, prefer more details
            if ((mentee.mentee_year || mentee.mentee_school) && !(existing.mentee_year || existing.mentee_school)) {
              shouldReplace = true;
            } else if (mentee.id > existing.id) {
              // Rule 4: If details equal, prefer newer ID
              // Note: 'existing' in this loop is actually the NEWER record because we sort desc at start.
              // sortedMentees = [101, 100]. Iteration 1 (101): seen. Iteration 2 (100): existing is 101.
              // So 'existing' is NEWER. 'mentee' is OLDER.
              // We should NOT replace newer with older typically.
              shouldReplace = false;
            }
          }
        }

        // Special override: If existing (Newer) has NO project, but current (Older) HAS project, 
        // implies the newer record is a "ghost" or "unassigned" version. We should replace existing with the older-but-better record.
        if (!existingHasProject && hasProject) {
          shouldReplace = true;
        }

        if (shouldReplace) {
          // Replace the "bad" existing entry with this "good" one
          const index = uniqueMentees.findIndex(m => m.id === existing.id);
          if (index >= 0) {
            uniqueMentees[index] = mentee;
            seenByProjectAndNamePhone.set(key, mentee);
            console.log(`🔄 Replaced duplicate: Kept ID ${mentee.id} (Project: ${mentee.project_title}) over ID ${existing.id} (Project: ${existing.project_title})`);
          }
        } else {
          console.log(`❌ Duplicate filtered: Dropped ID ${mentee.id} (Project: ${mentee.project_title}) in favor of ID ${existing.id} (Project: ${existing.project_title})`);
        }
        return;
      }

      // This is a unique mentee (so far)
      seenById.add(mentee.id);
      seenByProjectAndNamePhone.set(key, mentee);
      uniqueMentees.push(mentee);
    });

    console.log(`✅ Filtered ${myMentees.length} mentees to ${uniqueMentees.length} unique mentees`);

    const grouped: Record<number, { projectTitle: string; mentees: MentorMenteeSummary[] }> = {};
    uniqueMentees.forEach(mentee => {
      // Use project_id or 0 for null
      const projectKey = mentee.project_id ?? 0;

      if (!grouped[projectKey]) {
        grouped[projectKey] = {
          projectTitle: mentee.project_title || (mentee.project_id ? "Unknown Project" : "Unassigned"),
          mentees: []
        };
      }
      grouped[projectKey].mentees.push(mentee);
    });
    return grouped;
  }, [myMentees]);

  const openBulkAttendanceDialog = () => {
    setBulkAttendanceRecords({});
    setBulkAttendanceDate(() => {
      const today = new Date();
      return today.toISOString().slice(0, 10);
    });
    setShowBulkAttendanceDialog(true);
  };

  const handleBulkSaveAttendance = async () => {
    if (Object.keys(bulkAttendanceRecords).length === 0) {
      toast.error("Please mark attendance for at least one mentee");
      return;
    }

    try {
      const promises = Object.entries(bulkAttendanceRecords).map(async ([assignmentId, data]) => {
        if (!data.status) return { success: false, message: 'Status required' };

        try {
          const response = await api.saveMentorAttendance(parseInt(assignmentId), {
            date: bulkAttendanceDate,
            status: data.status,
            notes: data.notes || undefined,
            call_recording: data.callRecording || undefined
          });
          return response;
        } catch (error) {
          console.error(`Failed to save attendance for ${assignmentId}:`, error);
          return { success: false, message: 'Failed to save' };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r?.success).length;
      if (successCount > 0) {
        toast.success(`Attendance saved for ${successCount} mentee(s)`);
        setShowBulkAttendanceDialog(false);
        setBulkAttendanceRecords({});
        await loadMyMentees();
      } else {
        toast.error("Failed to save attendance");
      }
    } catch (error: any) {
      toast.error("Failed to save attendance: " + (error.message || "Unknown"));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />
      <main className="flex-1 w-full px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6">




        {mentorInfo && (
          <Card className="border border-border shadow-sm mb-6 overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                Mentor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Mentor Name</p>
                  <p className="text-base font-semibold text-foreground">{mentorInfo.name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Email</p>
                  <p className="text-base font-semibold text-foreground break-all">{mentorInfo.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-8">
          {loadingMentees ? (
            <div className="text-center py-24">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
              <p className="text-lg font-bold text-muted-foreground">Loading your database...</p>
            </div>
          ) : myMentees.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <User className="w-10 h-10 text-primary" />
              </div>
              <p className="text-xl font-black text-foreground mb-2 italic uppercase tracking-tighter">
                {getUserRole() === 'student' ? 'Mission Pending' : 'No Squad Assigned'}
              </p>
              <p className="text-sm text-muted-foreground font-bold">
                {getUserRole() === 'student'
                  ? 'No students have been assigned to your profile yet.'
                  : 'Your mentee roster is currently empty.'}
              </p>
              <p className="text-xs text-muted-foreground mt-4">Please contact the admin for task deployment.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(menteesByProject).map(([projectId, { projectTitle, mentees }]) => {
                // Hiding "Unknown Project" groups as requested
                if (projectTitle === "Unknown Project") return null;

                return (
                  <div key={projectId} className="space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-primary/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-foreground tracking-tight">{projectTitle}</h2>
                          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                            {mentees.length} {mentees.length === 1 ? 'Operational Link' : 'Operational Links'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openBulkAttendanceDialog}
                        className="text-primary hover:bg-primary/5 font-bold gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        Bulk Mark
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-12">
                      {mentees.map((mentee) => (
                        <div key={mentee.id} className="group relative rounded-3xl border border-border bg-card p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full hover:-translate-y-1 overflow-hidden">
                          {/* Decorative Accent */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-125 duration-700"></div>

                          {/* Header */}
                          <div className="relative flex items-start justify-between gap-3 mb-6">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{mentee.mentee_name}</h3>
                              {mentee.mentee_phone && (
                                <div className="flex items-center gap-1.5 mt-2 bg-muted/50 w-fit px-2 py-1 rounded-lg border border-border/50">
                                  <PhoneCall className="w-3 h-3 text-primary" />
                                  <a
                                    href={`tel:${mentee.mentee_phone}`}
                                    className="text-sm text-foreground font-black tracking-tight hover:underline"
                                  >
                                    {mentee.mentee_phone.toString().endsWith('.0') ? mentee.mentee_phone.toString().slice(0, -2) : mentee.mentee_phone}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shrink-0 shadow-sm group-hover:bg-primary group-hover:text-foreground transition-all duration-300">
                              <User className="w-6 h-6" />
                            </div>
                          </div>

                          {/* Stats Section */}
                          <div className="relative bg-muted/30 rounded-2xl p-4 mb-6 border border-border/50 group-hover:border-primary/20 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">Attendance Status</span>
                              <Badge variant="outline" className="bg-background text-xs font-bold h-5 px-2 border-primary/20 text-primary">
                                {Math.round(((mentee.total_classes || 0) / (mentee.expected_classes || 30)) * 100)}%
                              </Badge>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-foreground tabular-nums">{mentee.total_classes || 0}</span>
                              <span className="text-sm text-muted-foreground font-bold">/ {mentee.expected_classes || 30} Classes</span>
                            </div>
                            <div className="mt-4 w-full bg-border/50 rounded-full h-2.5 p-0.5 shadow-inner">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                                style={{
                                  width: `${Math.min(100, ((mentee.total_classes || 0) / (mentee.expected_classes || 30)) * 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>

                          {/* Academic Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mb-1">Standard</p>
                              <p className="text-sm font-bold text-foreground">{mentee.mentee_year || "N/A"}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mb-1">Region</p>
                              <p className="text-sm font-bold text-foreground truncate">{mentee.mentee_district || "N/A"}</p>
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                              <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mb-1">Institution</p>
                              <p className="text-sm font-bold text-foreground line-clamp-1">{mentee.mentee_school || "Information Missing"}</p>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="mt-auto space-y-3">
                            {mentee.last_attendance_date && (
                              <div className="flex items-center justify-between px-1 mb-2">
                                <span className="text-xs font-bold text-muted-foreground italic">Last update: {mentee.last_attendance_date}</span>
                                <div className={`w-2 h-2 rounded-full animate-pulse ${mentee.last_attendance_status === "PRESENT" ? "bg-primary" : "bg-muted-foreground/30"}`}></div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditMenteeDialog(mentee)}
                                className="flex-1 h-10 rounded-xl font-bold border-muted-foreground/20"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openHistoryModal(mentee, "attendance")}
                                className="flex-1 h-10 rounded-xl font-bold border-muted-foreground/20"
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                Stats
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => openAttendanceModal(mentee)}
                              className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <CheckCircle2 className="w-5 h-5 mr-3" />
                              Update Attendance
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Dialog
          open={attendanceDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setAttendanceDialog({ open: false, mentee: undefined });
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Mark Attendance</DialogTitle>
              <DialogDescription>
                {attendanceDialog.mentee ? `Record class status for ${attendanceDialog.mentee.mentee_name}` : "Record class status"}
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
                {attendanceStatusValue !== 'PRESENT' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Reason *
                    </Label>
                    <Textarea
                      rows={4}
                      value={attendanceNotesValue}
                      onChange={(e) => setAttendanceNotesValue(e.target.value)}
                      placeholder="Reason for absence is required..."
                      className="resize-none"
                    />
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
              setHistoryDialog({ open: false, mentee: undefined, type: "attendance" });
              setHistoryData([]);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>
                    {historyDialog.mentee
                      ? `Attendance – ${historyDialog.mentee.mentee_name}`
                      : "Attendance History"}
                  </DialogTitle>
                  <DialogDescription>
                    Class attendance records {getUserRole() === 'student' ? 'for this student' : 'for this mentee'}. Download to export date-wise class attendance data.
                  </DialogDescription>
                </div>
                {historyData.length > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={downloadAttendance}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                )}
              </div>
            </DialogHeader>
            {historyLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : historyData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No attendance records found.</div>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
                  {historyData.map((row: any) => (
                    <div key={row.id} className="border border-border rounded-lg p-4 bg-card text-card-foreground hover:bg-muted/10 transition-colors shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-foreground">
                              {row.attendance_date ? format(new Date(row.attendance_date), "PPP") : "Unknown Date"}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.status === "PRESENT"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                              }`}>
                              {row.status}
                            </span>
                          </div>
                          {row.notes && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-sm text-foreground font-medium">{row.notes}</p>
                              </div>
                            </div>
                          )}
                          {row.call_recording_path && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="p-1.5 bg-orange-100 rounded-lg">
                                <Mic className="w-3.5 h-3.5 text-orange-600" />
                              </div>
                              <a
                                href={row.call_recording_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1 underline"
                              >
                                <Play className="w-3 h-3" />
                                Play Recording
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={editMenteeDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setEditMenteeDialog({ open: false, mentee: undefined });
            }
          }}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Mentee Details</DialogTitle>
              <DialogDescription>
                {editMenteeDialog.mentee ? `Update information for ${editMenteeDialog.mentee.mentee_name}` : ""}
              </DialogDescription>
            </DialogHeader>
            {editMenteeDialog.mentee && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mentee Name *</Label>
                    <Input
                      value={editMenteeForm.mentee_name}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_name: e.target.value })}
                      placeholder="Enter mentee name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editMenteeForm.mentee_phone}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Standard</Label>
                    <Input
                      value={editMenteeForm.mentee_year}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_year: e.target.value })}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={editMenteeForm.mentee_gender}
                      onValueChange={(val) => setEditMenteeForm({ ...editMenteeForm, mentee_gender: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>School</Label>
                    <Input
                      value={editMenteeForm.mentee_school}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_school: e.target.value })}
                      placeholder="Enter school name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input
                      value={editMenteeForm.mentee_district}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_district: e.target.value })}
                      placeholder="Enter district"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Panchayat</Label>
                    <Input
                      value={editMenteeForm.mentee_address}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_address: e.target.value })}
                      placeholder="Enter panchayat"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Contact</Label>
                    <Input
                      value={editMenteeForm.mentee_parent_contact}
                      onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_parent_contact: e.target.value })}
                      placeholder="Enter parent contact"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editMenteeForm.mentee_notes}
                    onChange={(e) => setEditMenteeForm({ ...editMenteeForm, mentee_notes: e.target.value })}
                    placeholder="Additional notes about the mentee"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditMenteeDialog({ open: false, mentee: undefined })}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveMenteeDetails} disabled={savingMentee || !editMenteeForm.mentee_name.trim()}>
                    {savingMentee ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
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
              <div className="space-y-2 text-sm text-foreground">
                <p><span className="text-muted-foreground font-medium">Project:</span> <span className="text-foreground">{infoDialog.mentee.project_title || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">Phone:</span> <span className="text-foreground">{infoDialog.mentee.mentee_phone || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">Standard:</span> <span className="text-foreground">{infoDialog.mentee.mentee_year || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">School:</span> <span className="text-foreground">{infoDialog.mentee.mentee_school || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">Parent:</span> <span className="text-foreground">{infoDialog.mentee.mentee_parent_contact || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">Panchayat:</span> <span className="text-foreground">{infoDialog.mentee.mentee_address || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">District:</span> <span className="text-foreground">{(infoDialog.mentee as any).mentee_district || "—"}</span></p>
                <p><span className="text-muted-foreground font-medium">Classes Taken:</span> <span className="text-foreground">{infoDialog.mentee.total_classes || 0}</span></p>
                <p><span className="text-muted-foreground font-medium">Calls Done:</span> <span className="text-foreground">{infoDialog.mentee.total_calls || 0}</span></p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Mark Attendance Dialog - same style as Mentor Management dialog */}
        <Dialog open={showBulkAttendanceDialog} onOpenChange={setShowBulkAttendanceDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mark Mentee Attendance</DialogTitle>
              <DialogDescription>
                Mark attendance for all your mentees in each project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={bulkAttendanceDate}
                  onChange={(e) => setBulkAttendanceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mentees</Label>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(menteesByProject).map(([projectId, { projectTitle, mentees }]) => (
                    <div key={projectId} className="space-y-2">
                      <h3 className="font-bold text-primary text-sm mb-3">{projectTitle}</h3>
                      {mentees.map((mentee) => (
                        <div key={mentee.id} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card shadow-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground">{mentee.mentee_name}</p>
                            {mentee.mentee_phone && (
                              <p className="text-xs text-muted-foreground">{mentee.mentee_phone.toString().endsWith('.0') ? mentee.mentee_phone.toString().slice(0, -2) : mentee.mentee_phone}</p>
                            )}
                          </div>
                          <Select
                            value={bulkAttendanceRecords[mentee.id]?.status || ""}
                            onValueChange={(val) => {
                              setBulkAttendanceRecords(prev => ({
                                ...prev,
                                [mentee.id]: {
                                  ...prev[mentee.id],
                                  status: val,
                                  notes: prev[mentee.id]?.notes || ""
                                }
                              }));
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {MENTEE_ATTENDANCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Notes"
                            className="w-40"
                            value={bulkAttendanceRecords[mentee.id]?.notes || ""}
                            onChange={(e) => {
                              setBulkAttendanceRecords(prev => ({
                                ...prev,
                                [mentee.id]: {
                                  ...prev[mentee.id],
                                  status: prev[mentee.id]?.status || "",
                                  notes: e.target.value
                                }
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBulkAttendanceDialog(false);
                    setBulkAttendanceRecords({});
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleBulkSaveAttendance}>
                  Save Attendance
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default PhoneMentoringUpdate;


