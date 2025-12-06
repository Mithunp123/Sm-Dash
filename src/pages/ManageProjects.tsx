import { useState, useEffect, useMemo } from "react";
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Briefcase, Plus, ArrowLeft, Users, CheckCircle2, XCircle, Clock, Calendar, Edit, Trash2, Upload, Download, NotebookPen, UserPlus2, ClipboardList, History, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const MENTEE_ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "NOT_REACHABLE", label: "Not Reachable" }
];

const CALL_STATUS_LABELS: Record<string, string> = {
  CALL_DONE: "Call Done",
  NOT_CALLED: "Not Called",
  STUDENT_NOT_PICKED: "Student Not Picked",
  CALL_PENDING: "Call Pending"
};

const ManageProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStudentsDialog, setShowStudentsDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectStudents, setProjectStudents] = useState<any[]>([]);
  const [editStudentDialog, setEditStudentDialog] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<Record<number, string>>({});
  const [assignStudentId, setAssignStudentId] = useState<string>("");
  const [showExcelImportDialog, setShowExcelImportDialog] = useState(false);
  const [attendanceDateLocal, setAttendanceDateLocal] = useState<string>(new Date().toISOString().split('T')[0]);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [showMenteeDialog, setShowMenteeDialog] = useState(false);
  const [showMenteeFormDialog, setShowMenteeFormDialog] = useState(false);
  const [showMenteeAttendanceDialog, setShowMenteeAttendanceDialog] = useState(false);
  const [showMenteeHistoryDialog, setShowMenteeHistoryDialog] = useState(false);
  const [projectMentees, setProjectMentees] = useState<any[]>([]);
  const [menteeLoading, setMenteeLoading] = useState(false);
  const [menteeForm, setMenteeForm] = useState({
    mentee_name: "",
    mentee_phone: "",
    mentee_register_no: "",
    mentee_department: "",
    mentee_year: "",
    mentee_gender: "",
    mentee_school: "",
    mentee_address: "",
    mentee_parent_contact: "",
    mentee_status: "active",
    mentee_notes: "",
    volunteer_id: ""
  });
  const [editingMentee, setEditingMentee] = useState<any>(null);
  const [menteeAttendanceDate, setMenteeAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [menteeAttendance, setMenteeAttendance] = useState<Record<number, string>>({});
  const [menteeAttendanceNotes, setMenteeAttendanceNotes] = useState<Record<number, string>>({});
  const [menteeHistoryType, setMenteeHistoryType] = useState<'updates' | 'attendance'>('updates');
  const [menteeHistoryData, setMenteeHistoryData] = useState<any[]>([]);
  const [menteeHistoryLoading, setMenteeHistoryLoading] = useState(false);
  const [activeMentee, setActiveMentee] = useState<any>(null);

  const availableStudents = useMemo(() => {
    if (!selectedProject) return [];
    const assignedIds = new Set(
      (selectedProject.students || []).map((s: any) => (s.user_id || s.id))
    );
    return students.filter((student: any) => !assignedIds.has(student.id));
  }, [selectedProject, students]);

  const volunteerOptions = useMemo(() => {
    return (projectStudents || []).map((student: any) => ({
      id: student.user_id || student.id,
      name: student.name,
      email: student.email
    }));
  }, [projectStudents]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ngo_name: "",
    start_date: "",
    end_date: "",
    status: "active",
    image_url: ""
  });
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const { permissions, loading: permissionsLoading } = usePermissions();


  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';

    // Wait for permissions to load before deciding access
    if (permissionsLoading) {
      return;
    }

    // Allow access for admins or users granted the can_manage_projects permission
    if (!isAdmin && !permissions?.can_manage_projects) {
      toast.error("You don't have permission to access project management");
      navigate("/admin");
      return;
    }

    loadData();
  }, [navigate, permissions, permissionsLoading]);

  useEffect(() => {
    if (showAssignDialog && availableStudents.length === 0) {
      setAssignStudentId("");
    }
  }, [showAssignDialog, availableStudents.length]);

  // Attendance sections state
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [projectDateFilters, setProjectDateFilters] = useState<Record<number, string>>({});
  const [projectAttendance, setProjectAttendance] = useState<Record<number, any[]>>({});
  const [attendanceLoading, setAttendanceLoading] = useState<Record<number, boolean>>({});

  // Project Date Viewer (read-only) state
  const [showProjectDateViewer, setShowProjectDateViewer] = useState(false);
  const [projectDateViewerContext, setProjectDateViewerContext] = useState<{ id?: number; title?: string }>({});
  const [availableProjectDates, setAvailableProjectDates] = useState<string[]>([]);
  const [selectedProjectViewDate, setSelectedProjectViewDate] = useState<string | null>(null);
  const [projectDateRecords, setProjectDateRecords] = useState<any[]>([]);
  // Editing state for date viewer rows
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ status?: string; notes?: string }>({});

  const loadProjectAttendance = async (projectId: number, date?: string) => {
    try {
      setAttendanceLoading((prev) => ({ ...prev, [projectId]: true }));
      const res = await api.getProjectAttendance(projectId, date);
      if (res.success) {
        setProjectAttendance((prev) => ({ ...prev, [projectId]: res.records || [] }));
      }
    } catch (err: any) {
      toast.error("Failed to load attendance: " + (err.message || "Unknown"));
    } finally {
      setAttendanceLoading((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const groupedByDate = (records: any[]) => {
    const map: Record<string, any[]> = {};
    for (const r of records) {
      const key = r.attendance_date || (r.marked_at ? new Date(r.marked_at).toISOString().split("T")[0] : "Unknown");
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    // sort dates desc
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  };

  const toggleExpandProject = async (projectId: number) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
    // Load attendance when opening
    if (!expandedProjects[projectId]) {
      await loadProjectAttendance(projectId, projectDateFilters[projectId]);
    }
  };

  const handleEditProjectAttendance = async (record: any, updates: { status?: string; notes?: string; attendance_date?: string }) => {
    try {
      await api.updateProjectAttendance(record.id, updates);
      toast.success("Attendance updated");
      await loadProjectAttendance(record.project_id, projectDateFilters[record.project_id]);
    } catch (err: any) {
      toast.error("Failed to update attendance: " + (err.message || "Unknown"));
    }
  };

  const handleDeleteProjectAttendance = async (record: any) => {
    try {
      await api.deleteProjectAttendance(record.id);
      toast.success("Attendance removed");
      await loadProjectAttendance(record.project_id, projectDateFilters[record.project_id]);
    } catch (err: any) {
      toast.error("Failed to remove attendance: " + (err.message || "Unknown"));
    }
  };

    // Helper function to download Excel template
    const downloadExcelTemplate = () => {
      if (!selectedProject) return;

      // Create worksheet with headers and sample data
      const ws_data = [
        ["Student Email*", "Student Name"],
        ["example1@student.com", "John Doe"],
        ["example2@student.com", "Jane Smith"],
        ["", ""],
        ["", ""],
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      // Set column widths
      ws['!cols'] = [
        { wch: 30 }, // Email column
        { wch: 25 }  // Name column
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, `${selectedProject.title}_student_import.xlsx`);
      toast.success("Template downloaded successfully!");
    };

    // Helper function to handle Excel file import
    const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setExcelFile(file);
      }
    };
    // Helper function to import students from Excel (flexible header detection + confirmation)
    const handleExcelImport = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!excelFile || !selectedProject) return;

      try {
        setExcelImportLoading(true);
        const arrayBuffer = await excelFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // Use header:1 to get arrays so we can flexibly detect email column
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        if (!rows || rows.length < 2) {
          toast.error('Excel file has no data or missing headers');
          return;
        }

        const headers = rows[0].map((h: any) => String(h || '').toLowerCase());
        let emailIndex = headers.findIndex((h: string) => h.includes('email'));
        // acceptable alternate header names
        if (emailIndex === -1) {
          emailIndex = headers.findIndex((h: string) => h.includes('student') && h.includes('email'));
        }
        if (emailIndex === -1) {
          // fallback to first column
          emailIndex = 0;
        }

        const studentEmails: string[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cell = row[emailIndex];
          const email = cell ? String(cell).trim().toLowerCase() : '';
          if (email) studentEmails.push(email);
        }

        if (studentEmails.length === 0) {
          toast.error('No valid student emails found in the Excel file');
          return;
        }

        // Find matching students from the available students list
        const matchedStudents = availableStudents.filter((student: any) =>
          studentEmails.includes((student.email || '').toLowerCase())
        );

        const missingEmails = studentEmails.filter((e) => !matchedStudents.some((s) => (s.email || '').toLowerCase() === e));

        // Ask for confirmation before assigning
        const confirmMsg = `Found ${matchedStudents.length} matching students to assign. ${missingEmails.length} emails not found in system. Proceed?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        if (matchedStudents.length === 0) {
          toast.error('No matching students to assign');
          return;
        }

        const studentIds = matchedStudents.map((s: any) => s.id);
        const response = await api.bulkAssignStudentsToProject(selectedProject.id, studentIds);

        if (response && response.success) {
          toast.success(`Assigned ${response.assignedCount || matchedStudents.length} students.`);
          if (response.skipped && response.skipped.length) {
            console.info('Skipped rows:', response.skipped);
          }
          setExcelFile(null);
          setShowExcelImportDialog(false);
          setSelectedProject(null);
          loadData();
        } else {
          toast.error(response?.message || 'Failed to assign students');
        }
      } catch (error: any) {
        toast.error('Failed to import Excel file: ' + (error.message || 'Unknown error'));
      } finally {
        setExcelImportLoading(false);
      }
    };

  const resetMenteeForm = () => {
    setMenteeForm({
      mentee_name: "",
      mentee_phone: "",
      mentee_register_no: "",
      mentee_department: "",
      mentee_year: "",
      mentee_gender: "",
      mentee_school: "",
      mentee_address: "",
      mentee_parent_contact: "",
      mentee_status: "active",
      mentee_notes: "",
      volunteer_id: ""
    });
    setEditingMentee(null);
  };

  const fetchProjectStudentsList = async (projectId: number, silent = false) => {
    try {
      const response = await api.getProjectStudents(projectId);
      if (response.success) {
        setProjectStudents(response.students || []);
        return response.students || [];
      }
      if (!silent) {
        toast.error(response.message || "Failed to load project volunteers");
      }
    } catch (error: any) {
      if (!silent) {
        toast.error("Failed to load project volunteers: " + (error.message || "Unknown"));
      }
    }
    return [];
  };

  const loadProjectMentees = async (projectId: number) => {
    try {
      setMenteeLoading(true);
      const res = await api.getProjectMentees(projectId);
      if (res.success) {
        const mentees = res.mentees || [];
        setProjectMentees(mentees);
        const attendanceSeed: Record<number, string> = {};
        mentees.forEach((mentee: any) => {
          if (mentee?.id) {
            attendanceSeed[mentee.id] = mentee.last_attendance_status || "PRESENT";
          }
        });
        setMenteeAttendance(attendanceSeed);
        setMenteeAttendanceNotes({});
      } else if (res.message) {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to load mentees: " + (error.message || "Unknown"));
    } finally {
      setMenteeLoading(false);
    }
  };

  const handleManageMentees = async (project: any) => {
    setSelectedProject(project);
    await fetchProjectStudentsList(project.id, true);
    await loadProjectMentees(project.id);
    setShowMenteeDialog(true);
  };

  const handleOpenMenteeForm = (mentee?: any) => {
    if (mentee) {
      setEditingMentee(mentee);
      setMenteeForm({
        mentee_name: mentee.mentee_name || "",
        mentee_phone: mentee.mentee_phone || "",
        mentee_register_no: mentee.mentee_register_no || "",
        mentee_department: mentee.mentee_department || "",
        mentee_year: mentee.mentee_year || "",
        mentee_gender: mentee.mentee_gender || "",
        mentee_school: mentee.mentee_school || "",
        mentee_address: mentee.mentee_address || "",
        mentee_parent_contact: mentee.mentee_parent_contact || "",
        mentee_status: mentee.mentee_status || "active",
        mentee_notes: mentee.mentee_notes || "",
        volunteer_id: mentee.volunteer_id ? mentee.volunteer_id.toString() : ""
      });
    } else {
      resetMenteeForm();
    }
    setShowMenteeFormDialog(true);
  };

  const handleSaveMentee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!menteeForm.volunteer_id) {
      toast.error("Please assign a volunteer to this mentee");
      return;
    }
    const payload: any = {
      ...menteeForm,
      volunteer_id: menteeForm.volunteer_id ? Number(menteeForm.volunteer_id) : null
    };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") {
        payload[key] = null;
      }
    });

    try {
      const response = editingMentee
        ? await api.updateProjectMentee(selectedProject.id, editingMentee.id, payload)
        : await api.createProjectMentee(selectedProject.id, payload);

      if (response.success) {
        toast.success(editingMentee ? "Mentee updated successfully" : "Mentee added successfully");
        setShowMenteeFormDialog(false);
        resetMenteeForm();
        await loadProjectMentees(selectedProject.id);
      } else if (response.message) {
        toast.error(response.message);
      }
    } catch (error: any) {
      toast.error("Failed to save mentee: " + (error.message || "Unknown"));
    }
  };

  const handleDeleteMentee = async (mentee: any) => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Remove mentee ${mentee.mentee_name}?`);
    if (!confirmed) return;
    try {
      const res = await api.deleteProjectMentee(selectedProject.id, mentee.id);
      if (res.success) {
        toast.success("Mentee removed");
        await loadProjectMentees(selectedProject.id);
      } else if (res.message) {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to remove mentee: " + (error.message || "Unknown"));
    }
  };

  const handleSaveMenteeAttendance = async () => {
    if (!selectedProject) return;
    const records = Object.entries(menteeAttendance)
      .filter(([, status]) => Boolean(status))
      .map(([assignmentId, status]) => ({
        assignmentId: Number(assignmentId),
        status,
        notes: menteeAttendanceNotes[Number(assignmentId)] || undefined
      }));

    if (!records.length) {
      toast.error("Select at least one attendance status");
      return;
    }

    try {
      const res = await api.submitMenteeAttendance(selectedProject.id, {
        date: menteeAttendanceDate,
        records
      });
      if (res.success) {
        toast.success("Mentee attendance saved");
        setShowMenteeAttendanceDialog(false);
        await loadProjectMentees(selectedProject.id);
      } else if (res.message) {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to save attendance: " + (error.message || "Unknown"));
    }
  };

  const handleOpenMenteeHistory = async (mentee: any, type: 'updates' | 'attendance') => {
    if (!selectedProject) return;
    setActiveMentee(mentee);
    setMenteeHistoryType(type);
    setMenteeHistoryData([]);
    setShowMenteeHistoryDialog(true);
    try {
      setMenteeHistoryLoading(true);
      const res = type === 'updates'
        ? await api.getMenteeUpdates(selectedProject.id, mentee.id)
        : await api.getMenteeAttendance(selectedProject.id, mentee.id);
      if (res.success) {
        setMenteeHistoryData((type === 'updates' ? res.updates : res.attendance) || []);
      } else if (res.message) {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to load mentee history: " + (error.message || "Unknown"));
    } finally {
      setMenteeHistoryLoading(false);
      }
    };

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.getProjects(),
        api.getStudentsScoped()
      ]);

      // Handle projects result
      if (results[0].status === 'fulfilled' && results[0].value.success) {
        const projectsRes = results[0].value;
        // Load students for each project
        const projectsWithStudents = await Promise.all(
          (projectsRes.projects || []).map(async (project: any) => {
            try {
              const studentsRes = await api.getProjectStudents(project.id);
              return {
                ...project,
                students: studentsRes.success ? studentsRes.students : []
              };
            } catch {
              return {
                ...project,
                students: []
              };
            }
          })
        );
        setProjects(projectsWithStudents);
      }

      // Handle students result (scoped to caller)
      if (results[1].status === 'fulfilled' && results[1].value.success) {
        const studentsRes = results[1].value;
        const allStudents = studentsRes.users || studentsRes.students || [];
        const studentUsers = (allStudents || []).filter((u: any) => u.role === 'student');
        setStudents(studentUsers);
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Project Date Viewer helpers (read-only) ---
  const openProjectDateViewer = async (projectId: number, title?: string) => {
    setProjectDateViewerContext({ id: projectId, title });
    setSelectedProjectViewDate(null);
    setProjectDateRecords([]);
    setAvailableProjectDates([]);
    setShowProjectDateViewer(true);

    try {
      const res = await api.getProjectAttendance(projectId);
      if (res.success) {
        const records = res.records || [];
        const dates = Array.from(new Set(records.map((r: any) => r.attendance_date))).filter(Boolean).sort((a: string, b: string) => b.localeCompare(a));
        setAvailableProjectDates(dates as string[]);
      }
    } catch (err: any) {
      toast.error('Failed to load project attendance dates: ' + (err.message || 'Unknown'));
    }
  };

  const loadProjectDateRecords = async (date: string) => {
    setSelectedProjectViewDate(date);
    setProjectDateRecords([]);
    try {
      if (projectDateViewerContext.id) {
        const res = await api.getProjectAttendance(projectDateViewerContext.id!, date);
        if (res.success) {
          setProjectDateRecords(res.records || []);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load attendance for date: ' + (err.message || 'Unknown'));
    }
  };

  const downloadProjectDateExcel = () => {
    if (!projectDateRecords || projectDateRecords.length === 0) return;
    const worksheetData = projectDateRecords.map((r: any) => ({
      Name: r.user_name || r.name || "",
      Email: r.user_email || r.email || "",
      Dept: r.user_dept || r.dept || "N/A",
      Year: r.user_year || r.year || "N/A",
      Status: r.status || "",
      Notes: r.notes || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const fileNameBase = `project_${projectDateViewerContext.id || ""}_${selectedProjectViewDate || ""}`.replace(/[^a-z0-9_\-]/gi,'_') || "attendance";
    XLSX.writeFile(workbook, `${fileNameBase}.xlsx`);
  };


  // Export attendance to Excel
  const exportAttendanceExcel = (projectId: number, date?: string) => {
    const records = projectAttendance[projectId] || [];
    let rows: any[] = [];
    if (date) {
      rows = (records || []).filter((r: any) => (r.attendance_date || new Date(r.marked_at).toISOString().split('T')[0]) === date);
    } else {
      rows = records;
    }

    if (!rows || rows.length === 0) {
      toast.error('No attendance records to export');
      return;
    }

    const ws_data = [
      ['Student', 'Email', 'Status', 'Notes', 'Date']
    ];
    (rows as any[]).forEach((r) => {
      ws_data.push([r.user_name || r.name || '', r.email || '', r.status || '', r.notes || '', r.attendance_date || (r.marked_at ? new Date(r.marked_at).toISOString().split('T')[0] : '')]);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const fileName = `${selectedProject?.title || 'project'}_attendance${date ? `_${date}` : ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Attendance exported as Excel');
  };

  // Open printable view (user can Save as PDF via browser print)
  const printAttendance = (projectId: number, date?: string) => {
    const records = projectAttendance[projectId] || [];
    let rows: any[] = [];
    if (date) {
      rows = (records || []).filter((r: any) => (r.attendance_date || new Date(r.marked_at).toISOString().split('T')[0]) === date);
    } else {
      rows = records;
    }

    if (!rows || rows.length === 0) {
      toast.error('No attendance records to print');
      return;
    }

    const htmlRows = rows.map((r: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${(r.user_name || r.name || '')}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.email || ''}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.status || ''}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.notes || ''}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.attendance_date || (r.marked_at ? new Date(r.marked_at).toISOString().split('T')[0] : '')}</td>
      </tr>
    `).join('');

    const html = `
      <html><head><title>Attendance</title></head><body>
      <h2>${selectedProject?.title || 'Project'} - Attendance ${date ? `(${date})` : ''}</h2>
      <table style="border-collapse:collapse;width:100%;"> 
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd">Student</th>
            <th style="padding:8px;border:1px solid #ddd">Email</th>
            <th style="padding:8px;border:1px solid #ddd">Status</th>
            <th style="padding:8px;border:1px solid #ddd">Notes</th>
            <th style="padding:8px;border:1px solid #ddd">Date</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      toast.error('Unable to open print window (popup blocked?)');
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !assignStudentId) return;

    try {
      const userId = parseInt(assignStudentId, 10);
      const response = await api.assignStudentToProject(userId, selectedProject.id);
      if (response.success) {
        toast.success("Student assigned successfully!");
        setAssignStudentId("");
        setShowAssignDialog(false);
        setSelectedProject(null);
        loadData();
      } else {
        toast.error(response.message || "Failed to assign student");
      }
    } catch (error: any) {
      toast.error("Failed to assign student: " + (error.message || "Unknown error"));
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.createProject(formData);
      if (response.success) {
        toast.success("Project created successfully!");
        setShowAddDialog(false);
        setFormData({
          title: "",
          description: "",
          ngo_name: "",
          start_date: "",
          end_date: "",
          status: "active",
          image_url: ""
        });
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to create project: " + error.message);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Project updated successfully!");
        setShowEditDialog(false);
        setSelectedProject(null);
        setFormData({
          title: "",
          description: "",
          ngo_name: "",
          start_date: "",
          end_date: "",
          status: "active",
          image_url: ""
        });
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to update project: " + error.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/projects/${selectedProject.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Project deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedProject(null);
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to delete project: " + error.message);
    }
  };

  const handleViewStudents = async (project: any) => {
    setSelectedProject(project);
    try {
      const response = await api.getProjectStudents(project.id);
      if (response.success) {
        setProjectStudents(response.students || []);
        // Initialize attendance data
        const initialAttendance: Record<number, string> = {};
        (response.students || []).forEach((student: any) => {
          initialAttendance[student.user_id] = 'present';
        });
        setAttendanceData(initialAttendance);
        setShowStudentsDialog(true);
      }
    } catch (error: any) {
      toast.error("Failed to load students: " + error.message);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedProject) return;

    try {
      // Create a meeting for this project attendance using chosen attendanceDateLocal
      const meetingDateIso = `${attendanceDateLocal}T00:00:00`;
      const meetingData = {
        title: `${selectedProject.title} - Attendance`,
        description: `Attendance marking for project: ${selectedProject.title}`,
        date: meetingDateIso,
        location: selectedProject.ngo_name || "Project Location"
      };

      const meetingRes = await api.createMeeting(meetingData);
      if (!meetingRes.success) {
        throw new Error("Failed to create attendance meeting");
      }

      const meetingId = meetingRes.id;

      // Mark attendance for each student
      const attendancePromises = Object.entries(attendanceData).map(([userId, status]) => {
        return api.markAttendance({
          meetingId,
          userId: parseInt(userId),
          status,
          notes: `Project: ${selectedProject.title}`
        });
      });

      await Promise.all(attendancePromises);
      toast.success("Attendance marked successfully!");
      setShowAttendanceDialog(false);
      setSelectedProject(null);
      setAttendanceData({});
      loadData();
    } catch (error: any) {
      toast.error("Failed to mark attendance: " + error.message);
    }
  };

  useEffect(() => {
    if (showAttendanceDialog && selectedProject) {
      setAttendanceDateLocal(projectDateFilters[selectedProject.id] || new Date().toISOString().split('T')[0]);
    }
  }, [showAttendanceDialog, selectedProject, projectDateFilters]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-accent">Active</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // NOTE: Excel Import Dialog is rendered in the JSX return area (so it's part of the component's output)

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
              <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                <Plus className="w-4 h-4" />
                Add Project
              </Button>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Projects</h1>
              <p className="text-lg opacity-90">Create and manage projects, assign students, and mark attendance</p>
            </div>
          </div>

          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                All Projects ({projects.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No projects found</div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>NGO</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.title}</TableCell>
                        <TableCell>{project.ngo_name || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            {project.students?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {project.start_date ? new Date(project.start_date).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          {project.end_date ? new Date(project.end_date).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/attendance?projectId=${project.id}`)}
                              className="gap-2"
                            >
                              <Calendar className="w-4 h-4" />
                              View Attendance
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProject(project);
                                setFormData({
                                  title: project.title,
                                  description: project.description || "",
                                  ngo_name: project.ngo_name || "",
                                  start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : "",
                                  end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : "",
                                  status: project.status || "active",
                                  image_url: project.image_url || ""
                                });
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
                              onClick={() => handleViewStudents(project)}
                              className="gap-2"
                            >
                              <Users className="w-4 h-4" />
                              Students
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedProject(project);
                                setAssignStudentId("");
                                setShowAssignDialog(true);
                              }}
                              className="gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Assign Student
                            </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedProject(project);
                                  setExcelFile(null);
                                  setShowExcelImportDialog(true);
                                }}
                                className="gap-2"
                              >
                                <Upload className="w-4 h-4" />
                                Import Excel
                              </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedProject(project);
                                setShowDeleteDialog(true);
                              }}
                              className="gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Inline expanded attendance removed — projects now navigate to the attendance page which will show project-scoped attendance */}
                </>
              )}
            </CardContent>
          </Card>
          </div>
        </main>

      {/* Add Project Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project for volunteer activities
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProject} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Community Cleanup Drive"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Project description and objectives..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ngo_name">NGO Partner</Label>
              <Input
                id="ngo_name"
                value={formData.ngo_name}
                onChange={(e) => setFormData({ ...formData, ngo_name: e.target.value })}
                placeholder="e.g., Atchaym Trust, Bhumi, TQI"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({
                    title: "",
                    description: "",
                    ngo_name: "",
                    start_date: "",
                    end_date: "",
                    status: "active",
                    image_url: ""
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Mentees Dialog */}
      <Dialog open={showMenteeDialog} onOpenChange={(open) => {
        setShowMenteeDialog(open);
        if (!open) {
          setActiveMentee(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mentees for {selectedProject?.title}</DialogTitle>
            <DialogDescription>
              Pair volunteers with mentees, capture attendance, and monitor daily updates.
            </DialogDescription>
          </DialogHeader>
          {menteeLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading mentees...</div>
          ) : projectMentees.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No mentees added for this project yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentee</TableHead>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>Last Attendance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectMentees.map((mentee: any) => (
                    <TableRow key={mentee.id}>
                      <TableCell>
                        <div className="font-semibold">{mentee.mentee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(mentee.mentee_department || '—')}{mentee.mentee_year ? ` • ${mentee.mentee_year}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        {mentee.volunteer_name ? (
                          <>
                            <div className="font-medium">{mentee.volunteer_name}</div>
                            <div className="text-xs text-muted-foreground">{mentee.volunteer_email || '—'}</div>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{mentee.mentee_phone || '—'}</div>
                        {mentee.mentee_parent_contact && (
                          <div className="text-xs text-muted-foreground">Parent: {mentee.mentee_parent_contact}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={mentee.mentee_status === 'active' ? 'default' : 'outline'}>
                          {(mentee.mentee_status || 'active').replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mentee.last_update_date ? (
                          <div>
                            <div className="text-sm">{mentee.last_update_date}</div>
                            <div className="text-xs text-muted-foreground">
                              {CALL_STATUS_LABELS[mentee.last_update_status] || mentee.last_update_status || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mentee.last_attendance_date ? (
                          <div>
                            <div className="text-sm">{mentee.last_attendance_date}</div>
                            <div className="text-xs text-muted-foreground">
                              {mentee.last_attendance_status || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleOpenMenteeForm(mentee)} className="gap-2">
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenMenteeHistory(mentee, 'updates')} className="gap-2">
                            <Eye className="w-4 h-4" />
                            Updates
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenMenteeHistory(mentee, 'attendance')} className="gap-2">
                            <History className="w-4 h-4" />
                            Attendance
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteMentee(mentee)} className="gap-2">
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowMenteeDialog(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => handleOpenMenteeForm()} className="gap-2">
              <UserPlus2 className="w-4 h-4" />
              Add Mentee
            </Button>
            {projectMentees.length > 0 && (
              <Button onClick={() => {
                setMenteeAttendanceDate(new Date().toISOString().split('T')[0]);
                setShowMenteeAttendanceDialog(true);
              }} className="gap-2">
                <ClipboardList className="w-4 h-4" />
                Mark Mentee Attendance
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Students Dialog */}
      <Dialog open={showStudentsDialog && !showAttendanceDialog} onOpenChange={setShowStudentsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Students in Project: {selectedProject?.title}</DialogTitle>
            <DialogDescription>
              View all students assigned to this project
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {projectStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No students assigned to this project yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Hours/Week</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectStudents.map((student: any) => (
                      <TableRow key={student.user_id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.dept || "N/A"}</TableCell>
                        <TableCell>{student.year || "N/A"}</TableCell>
                        <TableCell>{student.hours_per_week || 0}</TableCell>
                        <TableCell>
                          <Badge variant={student.status === 'active' ? 'default' : 'outline'}>
                            {student.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const profileRes = await api.getStudentProfile(student.user_id);
                                  const profile = profileRes.success ? (profileRes.profile || {}) : {};
                                  let custom = {};
                                  try { custom = profile.custom_fields ? JSON.parse(profile.custom_fields) : {}; } catch { custom = {}; }
                                  setEditStudent({ ...student, profile, custom_fields: custom });
                                  setEditStudentDialog(true);
                                } catch (err: any) {
                                  toast.error('Failed to load profile: ' + (err.message || 'Unknown'));
                                }
                              }}
                              className="gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (!confirm(`Unassign ${student.name} from this project?`)) return;
                                try {
                                  const res = await api.unassignStudentFromProject(student.user_id, selectedProject.id);
                                  if (res.success) {
                                    toast.success('Student unassigned');
                                    const listRes = await api.getProjectStudents(selectedProject.id);
                                    if (listRes.success) setProjectStudents(listRes.students || []);
                                    loadData();
                                  } else {
                                    toast.error(res.message || 'Failed to unassign');
                                  }
                                } catch (err: any) {
                                  toast.error('Failed to unassign: ' + (err.message || 'Unknown'));
                                }
                              }}
                              className="gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setShowStudentsDialog(false); setSelectedProject(null); }}>
                Close
              </Button>
              <Button variant="outline" onClick={() => { setAssignStudentId(""); setShowAssignDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Assign Student
              </Button>
              <Button variant="outline" onClick={() => { setExcelFile(null); setShowExcelImportDialog(true); }}>
                <Upload className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
              {projectStudents.length > 0 && (
                <Button onClick={() => { setShowAttendanceDialog(true); }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Attendance
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mentee Form Dialog */}
      <Dialog open={showMenteeFormDialog} onOpenChange={(open) => {
        setShowMenteeFormDialog(open);
        if (!open) {
          resetMenteeForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMentee ? "Edit Mentee" : "Add Mentee"}</DialogTitle>
            <DialogDescription>
              {editingMentee ? "Update mentee details or reassign a volunteer." : "Capture mentee information and assign a volunteer."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveMentee} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mentee Name *</Label>
                <Input
                  required
                  value={menteeForm.mentee_name}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_name: e.target.value })}
                  placeholder="Enter mentee full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={menteeForm.mentee_phone}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_phone: e.target.value })}
                  placeholder="e.g., 9876543210"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Standard</Label>
                <Input
                  value={menteeForm.mentee_year}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_year: e.target.value })}
                  placeholder="e.g., 8th, 9th"
                />
              </div>
              <div className="space-y-2">
                <Label>School</Label>
                <Input
                  value={menteeForm.mentee_school}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_school: e.target.value })}
                  placeholder="School name"
                />
              </div>
              <div className="space-y-2">
                <Label>Parent</Label>
                <Input
                  value={menteeForm.mentee_parent_contact}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_parent_contact: e.target.value })}
                  placeholder="Parent phone number"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Panchayat</Label>
                <Input
                  value={menteeForm.mentee_address}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_address: e.target.value })}
                  placeholder="Panchayat"
                />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Input
                  value={menteeForm.mentee_notes}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_notes: e.target.value })}
                  placeholder="District"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parent / Guardian Contact</Label>
                <Input
                  value={menteeForm.mentee_parent_contact}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_parent_contact: e.target.value })}
                  placeholder="Parent phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={menteeForm.mentee_status}
                  onValueChange={(val) => setMenteeForm({ ...menteeForm, mentee_status: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                rows={3}
                value={menteeForm.mentee_address}
                onChange={(e) => setMenteeForm({ ...menteeForm, mentee_address: e.target.value })}
                placeholder="Address"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={menteeForm.mentee_notes}
                onChange={(e) => setMenteeForm({ ...menteeForm, mentee_notes: e.target.value })}
                placeholder="Additional context or requirements"
              />
            </div>
            <div className="space-y-2">
              <Label>Assign Volunteer</Label>
              <Select
                value={menteeForm.volunteer_id}
                onValueChange={(val) => setMenteeForm({ ...menteeForm, volunteer_id: val })}
                disabled={volunteerOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={volunteerOptions.length === 0 ? "No volunteers available" : "Select volunteer"} />
                </SelectTrigger>
                <SelectContent>
                  {volunteerOptions.map((volunteer) => (
                    <SelectItem key={volunteer.id} value={volunteer.id.toString()}>
                      {volunteer.name} ({volunteer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setShowMenteeFormDialog(false); resetMenteeForm(); }}>
                Cancel
              </Button>
              <Button type="submit">{editingMentee ? "Save Changes" : "Add Mentee"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mentee Attendance Dialog */}
      <Dialog open={showMenteeAttendanceDialog} onOpenChange={setShowMenteeAttendanceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mentee Attendance - {selectedProject?.title}</DialogTitle>
            <DialogDescription>Track daily followups for each mentee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Attendance Date</Label>
              <Input
                type="date"
                value={menteeAttendanceDate}
                onChange={(e) => setMenteeAttendanceDate(e.target.value)}
              />
            </div>
            {projectMentees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No mentees available.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectMentees.map((mentee: any) => (
                    <TableRow key={mentee.id}>
                      <TableCell className="font-medium">{mentee.mentee_name}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={menteeAttendance[mentee.id] || "PRESENT"}
                          onValueChange={(val) => setMenteeAttendance({ ...menteeAttendance, [mentee.id]: val })}
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
                      </TableCell>
                      <TableCell>
                        <Input
                          value={menteeAttendanceNotes[mentee.id] || ""}
                          onChange={(e) => setMenteeAttendanceNotes({ ...menteeAttendanceNotes, [mentee.id]: e.target.value })}
                          placeholder="Optional notes"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMenteeAttendanceDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMenteeAttendance} disabled={projectMentees.length === 0}>
                Save Attendance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mentee History Dialog */}
      <Dialog open={showMenteeHistoryDialog} onOpenChange={(open) => {
        setShowMenteeHistoryDialog(open);
        if (!open) {
          setMenteeHistoryData([]);
          setActiveMentee(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeMentee ? `Progress - ${activeMentee.mentee_name}` : "Mentee Progress"}</DialogTitle>
            <DialogDescription>Review call logs and attendance history.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              size="sm"
              variant={menteeHistoryType === 'updates' ? 'default' : 'outline'}
              onClick={() => activeMentee && handleOpenMenteeHistory(activeMentee, 'updates')}
            >
              Daily Updates
            </Button>
            <Button
              size="sm"
              variant={menteeHistoryType === 'attendance' ? 'default' : 'outline'}
              onClick={() => activeMentee && handleOpenMenteeHistory(activeMentee, 'attendance')}
            >
              Attendance
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {menteeHistoryLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : menteeHistoryData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No records found.</div>
            ) : menteeHistoryType === 'updates' ? (
              menteeHistoryData.map((row: any) => (
                <div key={row.id} className="border rounded-lg p-4 space-y-1">
                  <div className="flex flex-wrap justify-between text-sm font-medium">
                    <span>{row.update_date}</span>
                    <span>{CALL_STATUS_LABELS[row.status] || row.status}</span>
                  </div>
                  {row.explanation && (
                    <p className="text-sm text-muted-foreground">{row.explanation}</p>
                  )}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                    {row.attempts ? <span>Attempts: {row.attempts}</span> : null}
                    {row.attachment_path ? (
                      <a href={row.attachment_path} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        View Attachment
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              menteeHistoryData.map((row: any) => (
                <div key={row.id} className="border rounded-lg p-4 space-y-1">
                  <div className="flex flex-wrap justify-between text-sm font-medium">
                    <span>{row.attendance_date}</span>
                    <span>{row.status}</span>
                  </div>
                  {row.notes && <p className="text-sm text-muted-foreground">{row.notes}</p>}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowMenteeHistoryDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={editStudentDialog} onOpenChange={setEditStudentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student dept, year and hours/week</DialogDescription>
          </DialogHeader>
          {editStudent ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const payload: any = {
                  dept: editStudent.profile?.dept || null,
                  year: editStudent.profile?.year || null,
                };
                // merge custom fields and set hours_per_week
                const custom = editStudent.custom_fields || {};
                custom.hours_per_week = Number(custom.hours_per_week || 0);
                payload.custom_fields = JSON.stringify(custom);

                const res = await api.updateStudentProfile(editStudent.user_id, payload);
                if (res.success) {
                  toast.success('Student updated');
                  setEditStudentDialog(false);
                  // refresh list
                  const listRes = await api.getProjectStudents(selectedProject.id);
                  if (listRes.success) setProjectStudents(listRes.students || []);
                  loadData();
                } else {
                  toast.error(res.message || 'Failed to update');
                }
              } catch (err: any) {
                toast.error('Failed to update: ' + (err.message || 'Unknown'));
              }
            }} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editStudent.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={editStudent.profile?.dept || ''} onChange={(e) => setEditStudent({ ...editStudent, profile: { ...editStudent.profile, dept: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input value={editStudent.profile?.year || ''} onChange={(e) => setEditStudent({ ...editStudent, profile: { ...editStudent.profile, year: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>Hours/Week</Label>
                <Input type="number" value={(editStudent.custom_fields?.hours_per_week ?? 0).toString()} onChange={(e) => setEditStudent({ ...editStudent, custom_fields: { ...editStudent.custom_fields, hours_per_week: e.target.value } })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" type="button" onClick={() => { setEditStudentDialog(false); setEditStudent(null); }}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mark Attendance Dialog */}
      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark Attendance - {selectedProject?.title}</DialogTitle>
            <DialogDescription>
              Mark attendance for all students in this project
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {projectStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students assigned to this project. Please assign students first.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectStudents.map((student: any) => (
                    <TableRow key={student.user_id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>
                        <Select
                          value={attendanceData[student.user_id] || 'present'}
                          onValueChange={(value) => {
                            setAttendanceData({
                              ...attendanceData,
                              [student.user_id]: value
                            });
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                Present
                              </div>
                            </SelectItem>
                            <SelectItem value="absent">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-600" />
                                Absent
                              </div>
                            </SelectItem>
                            <SelectItem value="late">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-yellow-600" />
                                Late
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowAttendanceDialog(false);
              setShowStudentsDialog(false);
              setSelectedProject(null);
              setAttendanceData({});
            }}>
              Cancel
            </Button>
            <Button onClick={handleMarkAttendance} disabled={projectStudents.length === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark Attendance
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Student Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Student to {selectedProject?.title}</DialogTitle>
            <DialogDescription>
              Choose a student who is not yet part of this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignStudent} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="assign-student">Student *</Label>
              <Select
                value={assignStudentId}
                onValueChange={setAssignStudentId}
                disabled={availableStudents.length === 0}
              >
                <SelectTrigger id="assign-student">
                  <SelectValue placeholder={availableStudents.length === 0 ? "No students available" : "Select a student"} />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map((student: any) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.name} ({student.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableStudents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All available students are already assigned to this project.
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setAssignStudentId("");
                  setSelectedProject(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!assignStudentId}>
                Assign Student
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditProject} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Project Title *</Label>
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
            <div className="space-y-2">
              <Label htmlFor="edit-ngo_name">NGO Partner</Label>
              <Input
                id="edit-ngo_name"
                value={formData.ngo_name}
                onChange={(e) => setFormData({ ...formData, ngo_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start_date">Start Date</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end_date">End Date</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedProject(null);
                  setFormData({
                    title: "",
                    description: "",
                    ngo_name: "",
                    start_date: "",
                    end_date: "",
                    status: "active",
                    image_url: ""
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setSelectedProject(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={showExcelImportDialog} onOpenChange={setShowExcelImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Students from Excel - {selectedProject?.title}</DialogTitle>
            <DialogDescription>
              Upload an Excel file to bulk assign students to this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExcelImport} className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 font-medium">📋 How it works:</p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Download the template Excel file</li>
                  <li>Add student emails and names in the Excel file</li>
                  <li>Upload the filled Excel file here</li>
                  <li>Students will be bulk assigned to the project</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={downloadExcelTemplate}
              >
                <Download className="w-4 h-4" />
                Download Excel Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excel-file">Upload Excel File *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileChange}
                  className="cursor-pointer"
                  required
                />
                {excelFile && (
                  <span className="text-sm text-green-600 font-medium">✓ {excelFile.name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: .xlsx, .xls (Max: Excel columns A-B with Student Email in column A)
              </p>
            </div>

            {availableStudents.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-900">
                  ⚠️ All students are already assigned to this project.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExcelImportDialog(false);
                  setExcelFile(null);
                  setSelectedProject(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!excelFile || excelImportLoading || availableStudents.length === 0}
              >
                {excelImportLoading ? "Importing..." : "Import Students"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Date Viewer Dialog (read-only) */}
      <Dialog open={showProjectDateViewer} onOpenChange={setShowProjectDateViewer}>
    <DialogContent className="max-w-5xl w-full max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div>
                  Attendance Dates for {projectDateViewerContext.title}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAvailableProjectDates([]); setSelectedProjectViewDate(null); setProjectDateRecords([]); setShowProjectDateViewer(false); }}>
                    Close
                  </Button>
                  {projectDateRecords.length > 0 && (
                    <Button size="sm" onClick={downloadProjectDateExcel} className="gap-2 bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4" />
                      Download Excel
                    </Button>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="col-span-1">
                <h4 className="font-semibold mb-2">Saved Dates</h4>
                {availableProjectDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved dates found</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableProjectDates.map((d) => (
                      <button
                        key={d}
                        onClick={() => loadProjectDateRecords(d)}
                        className={`w-full text-left px-3 py-2 rounded ${selectedProjectViewDate === d ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}
                      >
                        {new Date(d + 'T00:00:00').toLocaleDateString()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <h4 className="font-semibold mb-3">Details for {selectedProjectViewDate ? new Date(selectedProjectViewDate + 'T00:00:00').toLocaleDateString() : '—'}</h4>
                {projectDateRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select a date to view attendance details</p>
                ) : (
                  <div className="rounded-lg border bg-white shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[20%]">Name</TableHead>
                          <TableHead className="w-[22%]">Email</TableHead>
                          <TableHead className="w-[10%]">Dept</TableHead>
                          <TableHead className="w-[10%]">Year</TableHead>
                          <TableHead className="w-[12%]">Status</TableHead>
                          <TableHead className="w-[18%]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectDateRecords.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.user_name || r.name}</TableCell>
                            <TableCell className="text-muted-foreground">{r.user_email || r.email}</TableCell>
                            <TableCell>{r.user_dept || r.dept || 'N/A'}</TableCell>
                            <TableCell>{r.user_year || r.year || 'N/A'}</TableCell>
                            <TableCell>
                              {r.status === 'present' ? (
                                <Badge className="bg-green-600">Present</Badge>
                              ) : r.status === 'absent' ? (
                                <Badge variant="destructive">Absent</Badge>
                              ) : (
                                <Badge className="bg-yellow-600">{(r.status || '').charAt(0).toUpperCase() + (r.status || '').slice(1)}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.notes || '—'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => {
                                  // View full in centralized attendance view (with date)
                                  const dateParam = selectedProjectViewDate ? `&date=${selectedProjectViewDate}` : '';
                                  navigate(`/admin/attendance?projectId=${projectDateViewerContext.id}${dateParam}`);
                                }} className="gap-2">
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

      <Footer />
    </div>
  );
};

export default ManageProjects;

