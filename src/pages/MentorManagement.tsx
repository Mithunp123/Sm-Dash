import { useState, useEffect, useMemo } from "react";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Edit, Trash2, ArrowLeft, PhoneCall, UserCheck, ClipboardList, Calendar, Upload, FileSpreadsheet, Download, Mic, Image as ImageIcon, Settings, Loader2, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";

type Mentor = {
  id: number;
  name: string;
  email: string;
  role: string;
  dept?: string;
  year?: string;
};

type Project = {
  id: number;
  title: string;
  required_calls?: number;
  start_date?: string;
  end_date?: string;
};

type Mentee = {
  id: number;
  mentee_name: string;
  mentee_phone?: string;
  mentee_year?: string;
  mentee_gender?: string;
  mentee_school?: string;
  mentee_district?: string;
  mentee_address?: string;
  mentee_parent_contact?: string;
  mentee_status?: string;
  mentee_notes?: string;
  volunteer_id?: number;
  volunteer_name?: string;
  volunteer_phone?: string;
  project_id?: number;
  project_title?: string;
  total_classes?: number;
  total_calls?: number;
  calls_taken_by_mentor?: number;
  expected_classes?: number;
};

const MENTEE_ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Class Taken" },
  { value: "ABSENT", label: "Not Taken" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "NOT_REACHABLE", label: "Student Not Reachable" },
];

const MentorManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("mentees");
  const [projects, setProjects] = useState<Project[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const [menteeSearchQuery, setMenteeSearchQuery] = useState<string>("");
  const [showMenteeSelectDialog, setShowMenteeSelectDialog] = useState(false);
  const [selectDialogType, setSelectDialogType] = useState<'updates' | 'attendance' | null>(null);

  // Mentor Management Settings
  const [mentorSettings, setMentorSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('mentor_management_settings');
      return stored ? JSON.parse(stored) : {
        enableImage: true,
        enableVoice: true,
        showTotalCalls: true
      };
    } catch {
      return {
        enableImage: true,
        enableVoice: true,
        showTotalCalls: true
      };
    }
  });

  // Mentee form state
  const [showMenteeDialog, setShowMenteeDialog] = useState(false);
  const [editingMentee, setEditingMentee] = useState<Mentee | null>(null);
  const [menteeForm, setMenteeForm] = useState({
    mentee_name: "",
    mentee_phone: "",
    mentee_year: "",
    mentee_gender: "",
    mentee_school: "",
    mentee_district: "",
    mentee_address: "",
    mentee_parent_contact: "",
    mentee_status: "active",
    mentee_notes: "",
    volunteer_id: "",
    project_id: "",
    expected_classes: ""
  });

  // Attendance state
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, { status: string; notes: string; voiceFile?: File; imageFile?: File }>>({});

  // Edit Attendance state
  const [showEditAttendanceDialog, setShowEditAttendanceDialog] = useState(false);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<{
    id: number;
    assignmentId: number;
    menteeId: number;
    menteeName: string;
    date: string;
    status: string;
    notes: string;
  } | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<string>("PRESENT");
  const [attendanceNotes, setAttendanceNotes] = useState<string>("");

  // History state
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyMentee, setHistoryMentee] = useState<Mentee | null>(null);
  const [historyType, setHistoryType] = useState<'updates' | 'attendance'>('updates');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // View Attendance state
  const [showViewAttendanceDialog, setShowViewAttendanceDialog] = useState(false);
  const [viewAttendanceData, setViewAttendanceData] = useState<any[]>([]);
  const [viewAttendanceLoading, setViewAttendanceLoading] = useState(false);
  const [viewAttendanceStartDate, setViewAttendanceStartDate] = useState<string>("");
  const [viewAttendanceEndDate, setViewAttendanceEndDate] = useState<string>("");

  // Assign mentor state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningMentee, setAssigningMentee] = useState<Mentee | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>("");
  const [projectVolunteers, setProjectVolunteers] = useState<Mentor[]>([]);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Project settings
  const [showProjectSettingsDialog, setShowProjectSettingsDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [requiredCalls, setRequiredCalls] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Excel upload state
  const [showExcelUploadDialog, setShowExcelUploadDialog] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelProjectId, setExcelProjectId] = useState<string>("");
  const [uploadingExcel, setUploadingExcel] = useState(false);


  // Bulk update expected classes state
  const [showBulkExpectedClassesDialog, setShowBulkExpectedClassesDialog] = useState(false);
  const [bulkExpectedClasses, setBulkExpectedClasses] = useState<string>("");
  const [bulkExpectedClassesProjectId, setBulkExpectedClassesProjectId] = useState<string>("all");
  const [updatingBulkExpectedClasses, setUpdatingBulkExpectedClasses] = useState(false);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    if (!permissions.can_manage_projects) {
      toast.error("You don't have permission to access mentor management");
      navigate(auth.getRole() === 'office_bearer' ? "/office-bearer" : "/admin");
      return;
    }

    loadData();
  }, [permissionsLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsRes, mentorsRes] = await Promise.all([
        api.getProjects(),
        loadMentorsList()
      ]);

      let loadedProjects: Project[] = [];
      if (projectsRes.success) {
        loadedProjects = projectsRes.projects || [];
        setProjects(loadedProjects);
      }

      if (mentorsRes.success) {
        // Mentors are set inside loadMentorsList if we use a helper or just use the response
        const allUsers = mentorsRes.users || [];
        const volunteerMentors = allUsers.filter((u: any) =>
          u.role === 'student' || u.role === 'office_bearer'
        );
        setMentors(volunteerMentors);

        // After projects and mentors are loaded, load mentees
        if (loadedProjects.length > 0) {
          await loadAllMenteesData(loadedProjects, volunteerMentors);
        }
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + (error.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  };

  const loadMentorsList = async () => {
    return await api.getUsers();
  };

  const loadAllMenteesData = async (projectsList: Project[], mentorsList: Mentor[]) => {
    try {
      const allMentees: Mentee[] = [];
      for (const project of projectsList) {
        try {
          const res = await api.getProjectMentees(project.id);
          if (res.success && res.mentees) {
            allMentees.push(...res.mentees);
          }
        } catch (err) {
          console.error(`Failed to load mentees for project ${project.id}`, err);
        }
      }

      const enrichedMentees = allMentees.map(mentee => {
        if (mentee.volunteer_id) {
          const volunteer = mentorsList.find(m => m.id === mentee.volunteer_id);
          if (volunteer) {
            return {
              ...mentee,
              volunteer_name: volunteer.name,
              volunteer_phone: (volunteer as any).phone || volunteer.email
            };
          }
        }
        return mentee;
      });

      setMentees(enrichedMentees);
    } catch (error) {
      console.error("Failed to load mentees data", error);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.getProjects();
      if (res.success) {
        setProjects(res.projects || []);
        // Projects loaded
      }
    } catch (error: any) {
      console.error("Failed to load projects", error);
    }
  };

  const loadMentors = async (projectId?: number) => {
    try {
      if (projectId) {
        // Load only mentors assigned to the specific project
        const res = await api.getProjectStudents(projectId);
        if (res.success) {
          const studentsList = res.students || [];
          // Map backend response to frontend Mentor type
          // Backend returns user_id, but we need id
          const mentorsList = studentsList.map((student: any) => ({
            id: student.user_id || student.id,
            name: student.name || "Unknown",
            email: student.email || "",
            role: student.role || "student",
            dept: student.dept || "",
            year: student.year || ""
          }));
          setMentors(mentorsList);
          // Also update projectVolunteers for assign dialog
          setProjectVolunteers(mentorsList);
          console.log("Loaded project volunteers:", mentorsList);
        } else {
          console.error("Failed to load project students:", res.message);
          setProjectVolunteers([]);
        }
      } else {
        // Load all volunteers (students and office bearers) as mentors
        const res = await api.getUsers();
        if (res.success) {
          const allUsers = res.users || [];
          const volunteerMentors = allUsers.filter((u: any) =>
            u.role === 'student' || u.role === 'office_bearer'
          );
          setMentors(volunteerMentors);
        }
      }
    } catch (error: any) {
      console.error("Failed to load mentors", error);
      setProjectVolunteers([]);
    }
  };

  const loadAllMentees = async () => {
    try {
      // Load all mentees from all projects
      const allMentees: Mentee[] = [];
      for (const project of projects) {
        try {
          const res = await api.getProjectMentees(project.id);
          if (res.success && res.mentees) {
            allMentees.push(...res.mentees);
          }
        } catch (err) {
          console.error(`Failed to load mentees for project ${project.id}`, err);
        }
      }

      // Enrich mentees with volunteer names
      const enrichedMentees = allMentees.map(mentee => {
        if (mentee.volunteer_id) {
          const volunteer = mentors.find(m => m.id === mentee.volunteer_id);
          if (volunteer) {
            return {
              ...mentee,
              volunteer_name: volunteer.name,
              volunteer_phone: (volunteer as any).phone || volunteer.email
            };
          }
        }
        return mentee;
      });

      setMentees(enrichedMentees);
    } catch (error: any) {
      console.error("Failed to load mentees", error);
    }
  };

  // Removed redundant useEffects that cause race conditions
  // Sequential loading is now handled in loadData

  const resetMenteeForm = () => {
    setMenteeForm({
      mentee_name: "",
      mentee_phone: "",
      mentee_year: "",
      mentee_gender: "",
      mentee_school: "",
      mentee_district: "",
      mentee_address: "",
      mentee_parent_contact: "",
      mentee_status: "active",
      mentee_notes: "",
      volunteer_id: "",
      project_id: "",
      expected_classes: ""
    });
    setEditingMentee(null);
  };

  const openMenteeForm = (mentee?: Mentee) => {
    if (mentee) {
      setEditingMentee(mentee);
      setMenteeForm({
        mentee_name: mentee.mentee_name || "",
        mentee_phone: mentee.mentee_phone || "",
        mentee_year: mentee.mentee_year || "",
        mentee_gender: mentee.mentee_gender || "",
        mentee_school: mentee.mentee_school || "",
        mentee_district: mentee.mentee_district || "",
        mentee_address: (mentee as any).mentee_address || "",
        mentee_parent_contact: mentee.mentee_parent_contact || "",
        mentee_status: mentee.mentee_status || "active",
        mentee_notes: mentee.mentee_notes || "",
        volunteer_id: mentee.volunteer_id?.toString() || "",
        project_id: mentee.project_id?.toString() || "",
        expected_classes: (mentee as any).expected_classes?.toString() || ""
      });
    } else {
      resetMenteeForm();
    }
    setShowMenteeDialog(true);
  };

  const handleSaveMentee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menteeForm.project_id || menteeForm.project_id === "") {
      toast.error("Please select a project");
      return;
    }
    if (!menteeForm.mentee_name || menteeForm.mentee_name.trim() === "") {
      toast.error("Mentee name is required");
      return;
    }

    const projectId = Number(menteeForm.project_id);
    const payload: any = {
      mentee_name: menteeForm.mentee_name.trim(),
      mentee_phone: menteeForm.mentee_phone?.trim() || null,
      mentee_year: menteeForm.mentee_year?.trim() || null,
      mentee_gender: menteeForm.mentee_gender || null,
      mentee_school: menteeForm.mentee_school?.trim() || null,
      mentee_district: menteeForm.mentee_district?.trim() || null,
      mentee_address: menteeForm.mentee_address?.trim() || null,
      mentee_parent_contact: menteeForm.mentee_parent_contact?.trim() || null,
      mentee_status: menteeForm.mentee_status || "active",
      mentee_notes: menteeForm.mentee_notes?.trim() || null,
      volunteer_id: null,
      expected_classes: menteeForm.expected_classes ? Number(menteeForm.expected_classes) : null
    };

    try {
      const response = editingMentee
        ? await api.updateProjectMentee(projectId, editingMentee.id, payload)
        : await api.createProjectMentee(projectId, payload);

      if (response.success) {
        toast.success(editingMentee ? "Mentee updated successfully" : "Mentee added successfully");
        setShowMenteeDialog(false);
        resetMenteeForm();
        await loadAllMentees();
      } else if (response.message) {
        toast.error(response.message);
      }
    } catch (error: any) {
      console.error("Save mentee error:", error);
      toast.error("Failed to save mentee: " + (error.message || "Unknown"));
    }
  };

  const handleDeleteMentee = async (mentee: Mentee) => {
    if (!mentee.project_id) {
      toast.error("Cannot delete: Project information missing");
      return;
    }
    const confirmed = window.confirm(`Remove mentee ${mentee.mentee_name}?`);
    if (!confirmed) return;
    try {
      const res = await api.deleteProjectMentee(mentee.project_id, mentee.id);
      if (res.success) {
        toast.success("Mentee removed");
        await loadAllMentees();
      } else if (res.message) {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error("Failed to remove mentee: " + (error.message || "Unknown"));
    }
  };

  const openAssignMentorDialog = async (mentee: Mentee) => {
    setAssigningMentee(mentee);
    setSelectedVolunteerId(mentee.volunteer_id?.toString() || "");

    // Load volunteers for this project
    if (mentee.project_id) {
      setLoadingVolunteers(true);
      try {
        // Get all project mentees to find who's already assigned
        const menteesRes = await api.getProjectMentees(mentee.project_id);
        const assignedVolunteerIds = new Set(
          (menteesRes.mentees || [])
            .filter((m: any) => m.volunteer_id && m.id !== mentee.id) // Exclude current mentee
            .map((m: any) => m.volunteer_id)
        );

        // Get volunteers assigned to this project
        const res = await api.getProjectStudents(mentee.project_id);

        if (res.success) {
          // Filter volunteers:
          // 1. Must be a student (handled by backend usually, but check just in case)
          // 2. Not already assigned to another mentee in this project (unless it's self-assignment - handled by not excluding self)
          const volunteers = (res.students || []).filter((u: any) =>
            !assignedVolunteerIds.has(u.user_id) && !assignedVolunteerIds.has(u.id)
          );

          // Map to match Mentor interface if needed, or ensure component handles the student object structure
          // api.getProjectStudents returns { students: [{ user_id, name, ... }] } usually
          const mappedVolunteers = volunteers.map((v: any) => ({
            ...v,
            id: v.user_id || v.id // Handle potential ID field difference
          }));

          setProjectVolunteers(mappedVolunteers);
        }
      } catch (error: any) {
        toast.error("Failed to load volunteers");
      } finally {
        setLoadingVolunteers(false);
      }
    }

    setShowAssignDialog(true);
  };

  const handleAssignMentor = async () => {
    if (!assigningMentee || !selectedVolunteerId) {
      toast.error("Please select a mentor");
      return;
    }

    setIsAssigning(true);
    try {
      const res = await api.updateProjectMentee(
        assigningMentee.project_id,
        assigningMentee.id,
        { volunteer_id: Number(selectedVolunteerId) }
      );

      if (res.success) {
        toast.success("Mentor assigned successfully!");
        setShowAssignDialog(false);
        setAssigningMentee(null);
        setSelectedVolunteerId("");
        await loadAllMentees();
      } else {
        toast.error(res.message || "Failed to assign mentor");
      }
    } catch (error: any) {
      toast.error("Failed to assign mentor: " + (error.message || "Unknown"));
    } finally {
      setIsAssigning(false);
    }
  };

  const openAttendanceDialog = () => {
    setAttendanceRecords({});
    setShowAttendanceDialog(true);
  };

  const handleSaveAttendance = async () => {
    // Group mentees by project for attendance
    const menteesByProject = new Map<number, Mentee[]>();
    filteredMentees.forEach(mentee => {
      if (mentee.project_id) {
        if (!menteesByProject.has(mentee.project_id)) {
          menteesByProject.set(mentee.project_id, []);
        }
        menteesByProject.get(mentee.project_id)!.push(mentee);
      }
    });

    if (menteesByProject.size === 0) {
      toast.error("No mentees found to mark attendance");
      return;
    }

    // For now, mark attendance for the first project's mentees
    // In future, can be enhanced to handle multiple projects
    const firstProjectId = Array.from(menteesByProject.keys())[0];

    if (Object.keys(attendanceRecords).length === 0) {
      toast.error("Please mark attendance for at least one mentee");
      return;
    }

    // Process attendance with voice and image files
    const attendancePromises = Object.entries(attendanceRecords).map(async ([assignmentId, data]) => {
      if (!data.status) return { success: false, message: 'Status required' };

      const formData = new FormData();
      formData.append('status', data.status);
      formData.append('notes', data.notes || '');
      formData.append('date', attendanceDate);

      if (mentorSettings.enableVoice && data.voiceFile) {
        formData.append('call_recording', data.voiceFile);
      }
      if (mentorSettings.enableImage && data.imageFile) {
        formData.append('image', data.imageFile);
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/phone-mentoring/mentees/${assignmentId}/attendance`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
            },
            body: formData
          }
        );
        return await response.json();
      } catch (error) {
        console.error(`Failed to save attendance for ${assignmentId}:`, error);
        return { success: false, message: 'Failed to save' };
      }
    });

    try {
      const results = await Promise.all(attendancePromises);
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        toast.success(`Attendance saved for ${successCount} mentee(s)`);
        setShowAttendanceDialog(false);
        setAttendanceRecords({});
        await loadAllMentees();
      } else {
        toast.error("Failed to save attendance");
      }
    } catch (error: any) {
      toast.error("Failed to save attendance: " + (error.message || "Unknown"));
    }
  };

  const loadViewAttendance = async () => {
    try {
      setViewAttendanceLoading(true);
      if (mentees.length === 0) {
        setViewAttendanceData([]);
        return;
      }

      const attendanceData: any[] = [];

      for (const mentee of mentees) {
        if (!mentee.id || !mentee.project_id) continue;

        try {
          // Use projects endpoint for admin/office bearer view (allows viewing all mentees)
          const res = await api.getMenteeAttendance(mentee.project_id, mentee.id);

          if (res?.success && res.attendance) {
            res.attendance.forEach((record: any) => {
              const recordDate = record.attendance_date || record.date;

              // Filter by date range if provided
              if (viewAttendanceStartDate || viewAttendanceEndDate) {
                if (viewAttendanceStartDate && recordDate < viewAttendanceStartDate) return;
                if (viewAttendanceEndDate && recordDate > viewAttendanceEndDate) return;
              }

              attendanceData.push({
                id: record.id,
                assignmentId: mentee.id,
                menteeId: mentee.id,
                menteeName: mentee.mentee_name,
                phone: mentee.mentee_phone || '',
                date: recordDate,
                status: record.status === 'PRESENT' ? 'Class Taken' :
                  record.status === 'ABSENT' ? 'Not Taken' :
                    record.status === 'FOLLOW_UP' ? 'Follow Up' :
                      record.status === 'NOT_REACHABLE' ? 'Not Reachable' : record.status,
                notes: record.notes || '',
                callRecording: record.call_recording_path ? 'Yes' : 'No',
                rawStatus: record.status
              });
            });
          }
        } catch (error) {
          console.error(`Failed to fetch attendance for ${mentee.mentee_name}`, error);
        }
      }

      // Sort by date descending
      attendanceData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setViewAttendanceData(attendanceData);
    } catch (error: any) {
      console.error("Failed to load attendance", error);
      toast.error("Failed to load attendance: " + (error.message || "Unknown"));
    } finally {
      setViewAttendanceLoading(false);
    }
  };

  const handleDownloadAttendanceExcel = () => {
    const filteredData = viewAttendanceData;

    if (filteredData.length === 0) {
      toast.error("No attendance records to download");
      return;
    }

    try {
      const excelData = filteredData.map((record: any) => ({
        'Mentee Name': record.menteeName,
        'Phone': record.phone,
        'Date': record.date,
        'Status': record.status,
        'Notes': record.notes,
        'Call Recording': record.callRecording
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Mentee Name
        { wch: 15 }, // Phone
        { wch: 12 }, // Date
        { wch: 15 }, // Status
        { wch: 30 }, // Notes
        { wch: 15 }  // Call Recording
      ];

      const dateRange = viewAttendanceStartDate || viewAttendanceEndDate
        ? `_${viewAttendanceStartDate || 'all'}_to_${viewAttendanceEndDate || 'all'}`
        : '';
      const filename = `attendance${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Attendance data downloaded as ${filename}`);
    } catch (error: any) {
      console.error("Failed to download attendance", error);
      toast.error("Failed to download attendance: " + (error.message || "Unknown"));
    }
  };

  const openHistoryDialog = async (mentee: Mentee, type: 'updates' | 'attendance') => {
    setHistoryMentee(mentee);
    setHistoryType(type);
    setHistoryLoading(true);
    setHistoryData([]);
    setShowHistoryDialog(true);

    try {
      if (!mentee.project_id) {
        toast.error("Cannot load history: Project information missing");
        return;
      }
      if (type === 'updates') {
        const res = await api.getMenteeUpdates(mentee.project_id, mentee.id);
        if (res.success) {
          setHistoryData(res.updates || []);
        }
      } else {
        const res = await api.getMenteeAttendance(mentee.project_id, mentee.id);
        if (res.success) {
          setHistoryData(res.attendance || []);
        }
      }
    } catch (error: any) {
      toast.error("Failed to load history: " + (error.message || "Unknown"));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUpdateRequiredCalls = async () => {
    if (!editingProject) return;
    const calls = parseInt(requiredCalls) || 0;

    try {
      const res = await api.updateProject(editingProject.id, {
        required_calls: calls,
        start_date: startDate || null,
        end_date: endDate || null
      });
      if (res.success) {
        toast.success("Project settings updated");
        setShowProjectSettingsDialog(false);
        setEditingProject(null);
        setRequiredCalls("");
        setStartDate("");
        setEndDate("");
        await loadProjects();
      } else {
        toast.error(res.message || "Failed to update");
      }
    } catch (error: any) {
      toast.error("Failed to update: " + (error.message || "Unknown"));
    }
  };

  const openProjectSettings = (project: Project) => {
    setEditingProject(project);
    setRequiredCalls(project.required_calls?.toString() || "0");
    // Format dates for input fields (YYYY-MM-DD)
    if (project.start_date) {
      const start = new Date(project.start_date);
      setStartDate(start.toISOString().split('T')[0]);
    } else {
      setStartDate("");
    }
    if (project.end_date) {
      const end = new Date(project.end_date);
      setEndDate(end.toISOString().split('T')[0]);
    } else {
      setEndDate("");
    }
    setShowProjectSettingsDialog(true);
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      toast.error("Please select an Excel file");
      return;
    }

    if (!excelProjectId || excelProjectId === "") {
      toast.error("Please select a project");
      return;
    }

    const uploadProjectId = Number(excelProjectId);

    setUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/projects/${uploadProjectId}/mentees/upload-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        const errorCount = data.errors?.length || 0;
        const warningCount = data.warnings || 0;
        if (errorCount > 0) {
          toast.error(
            `Imported ${data.imported || 0} mentees. ${errorCount} errors occurred. Check console for details.`,
            { duration: 7000 }
          );
          console.error('Excel Import Errors:', data.errors);
        } else if (warningCount > 0) {
          toast.warning(
            `Successfully imported ${data.imported || 0} mentees. ${warningCount} mentees were imported without mentor assignment.`,
            { duration: 5000 }
          );
        } else {
          toast.success(`Successfully imported ${data.imported || 0} mentees`);
        }
        setShowExcelUploadDialog(false);
        setExcelFile(null);
        setExcelProjectId("");
        await loadAllMentees();
      } else {
        toast.error(data.message || "Failed to import mentees");
        if (data.errors) {
          console.error('Excel Import Errors:', data.errors);
        }
      }
    } catch (error: any) {
      toast.error("Failed to upload Excel: " + (error.message || "Unknown"));
    } finally {
      setUploadingExcel(false);
    }
  };

  const filteredMentees = useMemo(() => {
    let filtered = mentees;

    // Filter by project first
    if (selectedProjectFilter && selectedProjectFilter !== "all") {
      filtered = filtered.filter(mentee =>
        mentee.project_id?.toString() === selectedProjectFilter
      );
    }

    // Then filter by search query
    if (menteeSearchQuery.trim()) {
      const query = menteeSearchQuery.toLowerCase();
      filtered = filtered.filter(mentee =>
        mentee.mentee_name?.toLowerCase().includes(query) ||
        mentee.mentee_phone?.toLowerCase().includes(query) ||
        mentee.mentee_school?.toLowerCase().includes(query) ||
        mentee.mentee_district?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [mentees, menteeSearchQuery, selectedProjectFilter]);

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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Mentor Management</h1>
            <p className="text-muted-foreground">Manage mentors, mentees, assignments, and attendance</p>
          </div>

          {/* Mentees Section */}
          <Card className="border shadow-xl bg-grey">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-end">
                  <Button onClick={() => openMenteeForm()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Mentee
                  </Button>
                </div>

                {/* Search and Filter Section */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-3 border-t">
                  <div className="flex flex-1 gap-3 w-full">
                    <Select
                      value={selectedProjectFilter}
                      onValueChange={(val) => setSelectedProjectFilter(val)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by Project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Search by name, phone, school, or district..."
                      value={menteeSearchQuery}
                      onChange={(e) => setMenteeSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setShowExcelUploadDialog(true)}
                      variant="outline"
                      className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Upload Excel
                    </Button>
                    <Button
                      onClick={() => {
                        setBulkExpectedClasses("");
                        setBulkExpectedClassesProjectId("all");
                        setShowBulkExpectedClassesDialog(true);
                      }}
                      variant="outline"
                      className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <Settings className="w-4 h-4" />
                      Set Expected Classes (All)
                    </Button>
                    {/* Mark Attendance button removed as requested – attendance is now managed via View Attendance with edit option */}
                    <Button
                      onClick={async () => {
                        setViewAttendanceStartDate("");
                        setViewAttendanceEndDate("");
                        setViewAttendanceData([]);
                        setShowViewAttendanceDialog(true);
                        await loadViewAttendance();
                      }}
                      variant="outline"
                      className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      View Attendance
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary animate-pulse" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium text-gray-600">Loading mentees...</p>
                </div>
              ) : filteredMentees.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No mentees found. Add a mentee to get started.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-900">
                        <TableHead className="w-16 text-center font-bold text-gray-700 dark:text-slate-200">S.No</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">Name</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">Phone / Mentor</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">Standard</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">School</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">District</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">Panchayat</TableHead>
                        <TableHead className="font-bold text-gray-700 dark:text-slate-200">Status</TableHead>
                        <TableHead className="font-bold text-center text-gray-700 dark:text-slate-200">Expected Classes</TableHead>
                        <TableHead className="font-bold text-center text-gray-700 dark:text-slate-200">Classes Taken</TableHead>
                        <TableHead className="font-bold text-right text-gray-700 dark:text-slate-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMentees.map((mentee, idx) => (
                        <TableRow key={mentee.id} className="bg-grey hover:bg-gray-50/30">
                          <TableCell className="text-center font-medium text-gray-600">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-indigo-700">{mentee.mentee_name}</TableCell>
                          <TableCell className="text-gray-700">
                            <div className="flex items-center gap-3 flex-wrap">
                              {mentee.mentee_phone && (
                                <a
                                  href={`tel:${mentee.mentee_phone}`}
                                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  <PhoneCall className="w-4 h-4" />
                                  <span>{mentee.mentee_phone}</span>
                                </a>
                              )}
                              {!mentee.mentee_phone && <span>—</span>}
                              {mentee.volunteer_name && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">Mentor:</span>
                                  {mentee.volunteer_phone ? (
                                    <a
                                      href={`tel:${mentee.volunteer_phone}`}
                                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                    >
                                      <PhoneCall className="w-3.5 h-3.5" />
                                      <span>{mentee.volunteer_name}</span>
                                    </a>
                                  ) : (
                                    <span className="text-xs text-gray-700 font-medium">{mentee.volunteer_name}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700">{mentee.mentee_year || "—"}</TableCell>
                          <TableCell className="text-gray-700">{mentee.mentee_school || "—"}</TableCell>
                          <TableCell className="text-gray-700">{mentee.mentee_district || "—"}</TableCell>
                          <TableCell className="text-gray-700">{(mentee as any).mentee_address || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={mentee.mentee_status === "active" ? "default" : "secondary"}
                              className={mentee.mentee_status === "active" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : ""}
                            >
                              {mentee.mentee_status || "active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium text-gray-700">{(mentee as any).expected_classes || "—"}</span>
                              {(mentee as any).expected_classes && (
                                <span className="text-xs text-gray-500">Scheduled</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium text-gray-700">{mentee.total_classes || 0}</span>
                              {(mentee as any).expected_classes && (
                                <span className={`text-xs ${(mentee.total_classes || 0) >= ((mentee as any).expected_classes || 0)
                                  ? "text-emerald-600"
                                  : "text-orange-600"
                                  }`}>
                                  of {(mentee as any).expected_classes}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openAssignMentorDialog(mentee)}
                                className="h-8 px-2 gap-2 bg-green-600 hover:bg-green-700"
                                title="Assign Mentor"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/admin/mentees/${mentee.project_id || 0}/${mentee.id}`)}
                                className="h-8 px-2 gap-2"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteMentee(mentee)}
                                className="h-8 px-2"
                                title="Delete Mentee"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Mentee Dialog */}
          <Dialog open={showMenteeDialog} onOpenChange={setShowMenteeDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-grey dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>{editingMentee ? "Edit Mentee" : "Add New Mentee"}</DialogTitle>
                <DialogDescription>
                  {editingMentee ? "Update mentee details and mentor assignment" : "Add a new mentee and assign a mentor"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveMentee} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select Project *</Label>
                  <Select
                    value={menteeForm.project_id || ""}
                    onValueChange={(val) => setMenteeForm({ ...menteeForm, project_id: val || "" })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mentee Name *</Label>
                    <Input
                      value={menteeForm.mentee_name}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={menteeForm.mentee_phone}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Standard</Label>
                    <Input
                      value={menteeForm.mentee_year}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_year: e.target.value })}
                      placeholder="e.g., 10, 11, 12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={menteeForm.mentee_gender || ""}
                      onValueChange={(val) => setMenteeForm({ ...menteeForm, mentee_gender: val || "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>School</Label>
                    <Input
                      value={menteeForm.mentee_school}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_school: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input
                      value={menteeForm.mentee_district}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_district: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Panchayat</Label>
                  <Input
                    value={menteeForm.mentee_address || ""}
                    onChange={(e) => setMenteeForm({ ...menteeForm, mentee_address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parent Contact</Label>
                    <Input
                      value={menteeForm.mentee_parent_contact}
                      onChange={(e) => setMenteeForm({ ...menteeForm, mentee_parent_contact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Classes (Schedule)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={menteeForm.expected_classes || ""}
                      onChange={(e) => setMenteeForm({ ...menteeForm, expected_classes: e.target.value })}
                      placeholder="e.g., 30"
                    />
                    <p className="text-xs text-gray-500">Total classes planned for this mentee</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={menteeForm.mentee_status || "active"}
                    onValueChange={(val) => setMenteeForm({ ...menteeForm, mentee_status: val || "active" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={menteeForm.mentee_notes}
                    onChange={(e) => setMenteeForm({ ...menteeForm, mentee_notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowMenteeDialog(false);
                    resetMenteeForm();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingMentee ? "Update Mentee" : "Add Mentee"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Attendance Dialog (no longer used for bulk marking; retain for potential future use) */}

          {/* History Dialog */}
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {historyType === 'updates' ? 'Daily Updates' : 'Attendance'} - {historyMentee?.mentee_name}
                </DialogTitle>
                <DialogDescription>
                  View {historyType === 'updates' ? 'daily call updates' : 'attendance records'} for this mentee
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {historyLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No records found</div>
                ) : (
                  <div className="space-y-3">
                    {historyData.map((row: any) => (
                      <div key={row.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {historyType === 'updates' ? row.update_date : row.attendance_date}
                            </p>
                            {historyType === 'updates' ? (
                              <>
                                <p className="text-sm text-gray-600">Status: {row.status}</p>
                                {row.explanation && (
                                  <p className="text-sm text-gray-700 mt-1">{row.explanation}</p>
                                )}
                                {row.attempts && (
                                  <p className="text-xs text-gray-500">Attempts: {row.attempts}</p>
                                )}
                                {row.attachment_path && (
                                  <a
                                    href={row.attachment_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 underline"
                                  >
                                    View Attachment
                                  </a>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-gray-600">Status: {row.status}</p>
                                {row.notes && (
                                  <p className="text-sm text-gray-700 mt-1">{row.notes}</p>
                                )}
                                {row.call_recording_path && (
                                  <a
                                    href={row.call_recording_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 underline"
                                  >
                                    View Call Recording
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Excel Upload Dialog */}
          <Dialog open={showExcelUploadDialog} onOpenChange={setShowExcelUploadDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Mentees from Excel</DialogTitle>
                <DialogDescription>
                  Upload an Excel file (.xlsx) with mentee details. Minimum required columns:{' '}
                  <strong>Name</strong> and <strong>Phone</strong>. You can optionally add:{' '}
                  <strong>Mentor Name</strong> or <strong>Mentor Email</strong> (to auto-link mentees to mentors),{' '}
                  <strong>Expected Classes</strong> (total scheduled classes), and other details.
                  All information can be updated later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Need a sample file?</p>
                      <p className="text-xs text-blue-700 mt-1">Download the Excel template with example data</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Create sample Excel data with minimal required columns
                        const sampleData = [
                          {
                            Name: 'John Doe',
                            Phone: '9876543210',
                            'Mentor Name': mentors.length > 0 ? mentors[0].name : 'Sample Mentor',
                            'Mentor Email': mentors.length > 0 ? mentors[0].email : 'mentor@example.com',
                            'Expected Classes': '30'
                          },
                          {
                            Name: 'Jane Smith',
                            Phone: '9876543212',
                            'Mentor Name': mentors.length > 1 ? mentors[1].name : 'Another Mentor',
                            'Mentor Email': mentors.length > 1 ? mentors[1].email : 'another@example.com',
                            'Expected Classes': '30'
                          }
                        ];

                        const ws = XLSX.utils.json_to_sheet(sampleData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Mentees');
                        XLSX.writeFile(wb, 'mentee_template.xlsx');
                        toast.success('Sample Excel file downloaded');
                      }}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Sample
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Project *</Label>
                  <Select
                    value={excelProjectId}
                    onValueChange={setExcelProjectId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Excel File</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setExcelFile(file);
                      }
                    }}
                  />
                  {excelFile && (
                    <p className="text-sm text-gray-600">Selected: {excelFile.name}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowExcelUploadDialog(false);
                    setExcelFile(null);
                    setExcelProjectId("");
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleExcelUpload} disabled={!excelFile || uploadingExcel || !excelProjectId || projects.length === 0}>
                    {uploadingExcel ? "Uploading..." : "Upload Excel"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Select Mentee Dialog for Updates/Attendance */}
          <Dialog open={showMenteeSelectDialog} onOpenChange={setShowMenteeSelectDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Select Mentee</DialogTitle>
                <DialogDescription>
                  Select a mentee to view {selectDialogType === 'updates' ? 'Updates' : 'Attendance'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Search mentees..."
                  value={menteeSearchQuery}
                  onChange={(e) => setMenteeSearchQuery(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredMentees.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No mentees found</p>
                  ) : (
                    filteredMentees.map((mentee) => (
                      <div
                        key={mentee.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (selectDialogType) {
                            openHistoryDialog(mentee, selectDialogType);
                            setShowMenteeSelectDialog(false);
                            setSelectDialogType(null);
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{mentee.mentee_name}</p>
                            <p className="text-sm text-gray-600">
                              {mentee.mentee_phone || "—"} • {mentee.mentee_school || "—"} • {mentee.mentee_district || "—"}
                            </p>
                          </div>
                          <Badge
                            variant={mentee.mentee_status === "active" ? "default" : "secondary"}
                            className={mentee.mentee_status === "active" ? "bg-emerald-100 text-emerald-700" : ""}
                          >
                            {mentee.mentee_status || "active"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setShowMenteeSelectDialog(false);
                  setSelectDialogType(null);
                }}>
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Assign Mentor Dialog */}
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogContent className="bg-white dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>Assign Mentor</DialogTitle>
                <DialogDescription>
                  Assign a mentor to {assigningMentee?.mentee_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {assigningMentee && (
                  <>
                    {assigningMentee.project_title && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Project: {assigningMentee.project_title}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Select Volunteer (Mentor) *</Label>
                      {loadingVolunteers ? (
                        <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
                          <p className="text-sm text-gray-600">Loading volunteers...</p>
                        </div>
                      ) : projectVolunteers.length === 0 ? (
                        <div className="p-3 border border-yellow-200 rounded-md bg-yellow-50">
                          <p className="text-sm text-yellow-800">
                            {assigningMentee.project_id
                              ? "No volunteers found in this project. Please add volunteers to the project first."
                              : "Mentee is not assigned to any project."}
                          </p>
                        </div>
                      ) : (
                        <Select
                          value={selectedVolunteerId}
                          onValueChange={setSelectedVolunteerId}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a volunteer" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectVolunteers.filter(volunteer => volunteer.id).map((volunteer) => (
                              <SelectItem key={volunteer.id} value={volunteer.id.toString()}>
                                {volunteer.name || "Unknown"} ({volunteer.email || "No email"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => {
                    setShowAssignDialog(false);
                    setAssigningMentee(null);
                    setSelectedVolunteerId("");
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!assigningMentee || !assigningMentee.project_id || !selectedVolunteerId) {
                        toast.error("Please select a volunteer");
                        return;
                      }
                      setIsAssigning(true);
                      try {
                        const res = await api.updateProjectMentee(
                          assigningMentee.project_id,
                          assigningMentee.id,
                          { volunteer_id: Number(selectedVolunteerId) }
                        );
                        if (res.success) {
                          const selectedMentor = projectVolunteers.find(v => v.id === Number(selectedVolunteerId));
                          toast.success(`Mentor assigned successfully! ${selectedMentor?.name || 'Mentor'} is now assigned to ${assigningMentee.mentee_name}. The volunteer can now see this mentee in their dashboard.`);
                          setShowAssignDialog(false);
                          setAssigningMentee(null);
                          setSelectedVolunteerId("");
                          setIsAssigning(false);
                          // Reload mentees to show updated assignment
                          await loadAllMentees();
                          // Also reload mentors to refresh the list
                          if (assigningMentee.project_id) {
                            await loadMentors(assigningMentee.project_id);
                          }
                        } else {
                          toast.error(res.message || "Failed to assign mentor");
                          setIsAssigning(false);
                        }
                      } catch (error: any) {
                        toast.error("Failed to assign mentor: " + (error.message || "Unknown"));
                        setIsAssigning(false);
                      }
                    }}
                    disabled={!selectedVolunteerId || projectVolunteers.length === 0 || isAssigning}
                    className="gap-2"
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign Mentor"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Project Settings Dialog */}
          <Dialog open={showProjectSettingsDialog} onOpenChange={setShowProjectSettingsDialog}>
            <DialogContent className="bg-grey dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>Project Settings</DialogTitle>
                <DialogDescription>
                  Configure mentoring requirements for {editingProject?.title}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Required Total Calls</Label>
                  <Input
                    type="number"
                    min="0"
                    value={requiredCalls}
                    onChange={(e) => setRequiredCalls(e.target.value)}
                    placeholder="e.g., 30"
                  />
                  <p className="text-xs text-gray-500">
                    Set the total number of calls required for mentors in this project
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowProjectSettingsDialog(false);
                    setStartDate("");
                    setEndDate("");
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateRequiredCalls}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Attendance Dialog */}
          <Dialog open={showViewAttendanceDialog} onOpenChange={setShowViewAttendanceDialog}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-grey dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>View Attendance</DialogTitle>
                <DialogDescription>
                  View and filter attendance records by date. Download to export as Excel.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Date Filter */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Start Date (Optional)</Label>
                    <Input
                      type="date"
                      value={viewAttendanceStartDate}
                      onChange={(e) => {
                        setViewAttendanceStartDate(e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={viewAttendanceEndDate}
                      onChange={(e) => {
                        setViewAttendanceEndDate(e.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={loadViewAttendance}
                      className="flex-1"
                    >
                      Apply Filter
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewAttendanceStartDate("");
                        setViewAttendanceEndDate("");
                        loadViewAttendance();
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Attendance Table */}
                {viewAttendanceLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : viewAttendanceData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No attendance records found</p>
                    {viewAttendanceStartDate || viewAttendanceEndDate ? (
                      <p className="text-sm mt-2">Try adjusting the date filter</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {viewAttendanceData.length} record{viewAttendanceData.length !== 1 ? 's' : ''}
                      </div>
                      <Button
                        onClick={handleDownloadAttendanceExcel}
                        variant="outline"
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Excel
                      </Button>
                    </div>
                    <div className="overflow-x-auto border rounded-xl">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900">
                          <TableRow>
                            <TableHead className="font-bold">Mentee Name</TableHead>
                            <TableHead className="font-bold">Phone</TableHead>
                            <TableHead className="font-bold">Date</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="font-bold">Notes</TableHead>
                            <TableHead className="font-bold">Call Recording</TableHead>
                            <TableHead className="text-right font-bold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewAttendanceData.map((record: any, index: number) => (
                            <TableRow key={`${record.menteeId}-${record.date}-${index}`}>
                              <TableCell className="font-medium">{record.menteeName}</TableCell>
                              <TableCell>{record.phone || '-'}</TableCell>
                              <TableCell>
                                {new Date(record.date).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    record.rawStatus === 'PRESENT' ? 'default' :
                                      record.rawStatus === 'ABSENT' ? 'destructive' :
                                        record.rawStatus === 'FOLLOW_UP' ? 'secondary' :
                                          'outline'
                                  }
                                >
                                  {record.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{record.notes || '-'}</TableCell>
                              <TableCell>{record.callRecording}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => {
                                    if (!record.id || !record.assignmentId) {
                                      toast.error("Cannot edit: missing record information");
                                      return;
                                    }
                                    setEditingAttendanceRecord({
                                      id: record.id,
                                      assignmentId: record.assignmentId,
                                      menteeId: record.menteeId,
                                      menteeName: record.menteeName,
                                      date: record.date,
                                      status: record.rawStatus || 'PRESENT',
                                      notes: record.notes || ''
                                    });
                                    setAttendanceStatus(record.rawStatus || 'PRESENT');
                                    setAttendanceNotes(record.notes || '');
                                    setShowEditAttendanceDialog(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewAttendanceDialog(false);
                    setViewAttendanceStartDate("");
                    setViewAttendanceEndDate("");
                  }}
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Attendance Dialog */}
          <Dialog open={showEditAttendanceDialog} onOpenChange={setShowEditAttendanceDialog}>
            <DialogContent className="bg-grey dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>Edit Attendance</DialogTitle>
                <DialogDescription>
                  Update attendance for {editingAttendanceRecord?.menteeName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {editingAttendanceRecord && (
                  <>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={editingAttendanceRecord.date.includes('T') ? editingAttendanceRecord.date.split('T')[0] : editingAttendanceRecord.date}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status *</Label>
                      <Select
                        value={attendanceStatus}
                        onValueChange={setAttendanceStatus}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MENTEE_ATTENDANCE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={attendanceNotes}
                        onChange={(e) => setAttendanceNotes(e.target.value)}
                        rows={3}
                        placeholder="Add any notes about this attendance..."
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowEditAttendanceDialog(false);
                          setEditingAttendanceRecord(null);
                          setAttendanceStatus("PRESENT");
                          setAttendanceNotes("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!editingAttendanceRecord || !attendanceStatus) {
                            toast.error("Please select a status");
                            return;
                          }
                          try {
                            const formData = new FormData();
                            formData.append('status', attendanceStatus);
                            formData.append('notes', attendanceNotes || '');
                            // Normalize date format - ensure it's YYYY-MM-DD
                            const dateValue = editingAttendanceRecord.date.includes('T')
                              ? editingAttendanceRecord.date.split('T')[0]
                              : editingAttendanceRecord.date;
                            formData.append('date', dateValue);

                            const response = await fetch(
                              `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/phone-mentoring/mentees/${editingAttendanceRecord.assignmentId}/attendance/${editingAttendanceRecord.id}`,
                              {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
                                },
                                body: formData
                              }
                            );

                            const result = await response.json();
                            if (result.success) {
                              toast.success("Attendance updated successfully");
                              setShowEditAttendanceDialog(false);
                              setEditingAttendanceRecord(null);
                              setAttendanceStatus("PRESENT");
                              setAttendanceNotes("");
                              await loadViewAttendance();
                            } else {
                              toast.error(result.message || "Failed to update attendance");
                            }
                          } catch (error: any) {
                            toast.error("Failed to update attendance: " + (error.message || "Unknown error"));
                          }
                        }}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Update Expected Classes Dialog */}
          <Dialog open={showBulkExpectedClassesDialog} onOpenChange={setShowBulkExpectedClassesDialog}>
            <DialogContent className="bg-grey dark:bg-slate-900">
              <DialogHeader>
                <DialogTitle>Set Expected Classes for All Mentees</DialogTitle>
                <DialogDescription>
                  Set the expected classes (total scheduled classes) for all mentees. You can update all mentees across all projects, or limit to a specific project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Update Scope *</Label>
                  <Select
                    value={bulkExpectedClassesProjectId}
                    onValueChange={setBulkExpectedClassesProjectId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects (All Mentees)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expected Classes (Total Scheduled Classes) *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bulkExpectedClasses}
                    onChange={(e) => setBulkExpectedClasses(e.target.value)}
                    placeholder="e.g., 30"
                    required
                  />
                  <p className="text-xs text-gray-500">Enter the total number of scheduled classes for all mentees in this project</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBulkExpectedClassesDialog(false);
                      setBulkExpectedClasses("");
                      setBulkExpectedClassesProjectId("");
                    }}
                    disabled={updatingBulkExpectedClasses}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!bulkExpectedClassesProjectId) {
                        toast.error("Please select a scope");
                        return;
                      }
                      const expectedClassesNum = bulkExpectedClasses ? Number(bulkExpectedClasses) : null;
                      if (expectedClassesNum === null || expectedClassesNum < 0) {
                        toast.error("Please enter a valid number (0 or greater)");
                        return;
                      }
                      try {
                        setUpdatingBulkExpectedClasses(true);
                        let response;
                        if (bulkExpectedClassesProjectId === "all") {
                          response = await api.bulkUpdateExpectedClassesAll(expectedClassesNum);
                          if (response.success) {
                            toast.success(`Updated expected classes to ${expectedClassesNum} for all mentees across all projects`);
                          }
                        } else {
                          response = await api.bulkUpdateExpectedClasses(Number(bulkExpectedClassesProjectId), expectedClassesNum);
                          if (response.success) {
                            const project = projects.find(p => p.id.toString() === bulkExpectedClassesProjectId);
                            toast.success(`Updated expected classes to ${expectedClassesNum} for all mentees in ${project?.title || 'project'}`);
                          }
                        }
                        if (response.success) {
                          setShowBulkExpectedClassesDialog(false);
                          setBulkExpectedClasses("");
                          setBulkExpectedClassesProjectId("all");
                          await loadAllMentees();
                        } else {
                          toast.error(response.message || "Failed to update expected classes");
                        }
                      } catch (error: any) {
                        toast.error("Failed to update expected classes: " + (error.message || "Unknown error"));
                      } finally {
                        setUpdatingBulkExpectedClasses(false);
                      }
                    }}
                    disabled={updatingBulkExpectedClasses}
                  >
                    {updatingBulkExpectedClasses ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update All"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </main>
    </div>
  );
};

// Export default component
export default MentorManagement;
