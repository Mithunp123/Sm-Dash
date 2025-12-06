import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
import { Users, Plus, Edit, Trash2, ArrowLeft, PhoneCall, UserCheck, ClipboardList, Calendar, Upload, FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  mentee_parent_contact?: string;
  mentee_status?: string;
  mentee_notes?: string;
  volunteer_id?: number;
  volunteer_name?: string;
  project_id?: number;
  project_title?: string;
  total_classes?: number;
  total_calls?: number;
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
    mentee_parent_contact: "",
    mentee_status: "active",
    mentee_notes: "",
    volunteer_id: "",
    project_id: ""
  });

  // Attendance state
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, { status: string; notes: string }>>({});

  // History state
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyMentee, setHistoryMentee] = useState<Mentee | null>(null);
  const [historyType, setHistoryType] = useState<'updates' | 'attendance'>('updates');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Project settings
  const [showProjectSettingsDialog, setShowProjectSettingsDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [requiredCalls, setRequiredCalls] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  // Excel upload state
  const [showExcelUploadDialog, setShowExcelUploadDialog] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProjects(), loadMentors(), loadAllMentees()]);
    } catch (error: any) {
      toast.error("Failed to load data: " + (error.message || "Unknown"));
    } finally {
      setLoading(false);
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

  const loadMentors = async () => {
    try {
      // Load all volunteers (students and office bearers) as mentors
      const res = await api.getUsers();
      if (res.success) {
        const allUsers = res.users || [];
        const volunteerMentors = allUsers.filter((u: any) => 
          u.role === 'student' || u.role === 'office_bearer'
        );
        setMentors(volunteerMentors);
      }
    } catch (error: any) {
      console.error("Failed to load mentors", error);
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
      setMentees(allMentees);
    } catch (error: any) {
      console.error("Failed to load mentees", error);
    }
  };

  useEffect(() => {
    loadProjects();
    loadMentors();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      loadAllMentees();
    }
  }, [projects]);

  const resetMenteeForm = () => {
    setMenteeForm({
      mentee_name: "",
      mentee_phone: "",
      mentee_year: "",
      mentee_gender: "",
      mentee_school: "",
      mentee_district: "",
      mentee_parent_contact: "",
      mentee_status: "active",
      mentee_notes: "",
      volunteer_id: ""
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
        mentee_parent_contact: mentee.mentee_parent_contact || "",
        mentee_status: mentee.mentee_status || "active",
        mentee_notes: mentee.mentee_notes || "",
        volunteer_id: mentee.volunteer_id?.toString() || "",
        project_id: mentee.project_id?.toString() || ""
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
    if (!menteeForm.volunteer_id) {
      toast.error("Please assign a mentor to this mentee");
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
      mentee_parent_contact: menteeForm.mentee_parent_contact?.trim() || null,
      mentee_status: menteeForm.mentee_status || "active",
      mentee_notes: menteeForm.mentee_notes?.trim() || null,
      volunteer_id: Number(menteeForm.volunteer_id)
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
    const projectMentees = menteesByProject.get(firstProjectId)!;
    const records = Object.entries(attendanceRecords).map(([assignmentId, data]) => ({
      assignmentId: Number(assignmentId),
      status: data.status,
      notes: data.notes || undefined
    }));

    if (records.length === 0) {
      toast.error("Please mark attendance for at least one mentee");
      return;
    }

    try {
      const res = await api.submitMenteeAttendance(firstProjectId, {
        date: attendanceDate,
        records
      });
      if (res.success) {
        toast.success("Attendance saved");
        setShowAttendanceDialog(false);
        await loadAllMentees();
      } else {
        toast.error(res.message || "Failed to save attendance");
      }
    } catch (error: any) {
      toast.error("Failed to save attendance: " + (error.message || "Unknown"));
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
    
    // For Excel upload, we need to select a project
    // Show a dialog or use the first project as default
    if (projects.length === 0) {
      toast.error("No projects available. Please create a project first.");
      return;
    }
    
    // Use first project for now, or can add project selection in Excel dialog
    const uploadProjectId = projects[0].id;
    
    setUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('project_id', uploadProjectId.toString());
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/projects/${uploadProjectId}/mentees/upload-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`Successfully imported ${data.imported || 0} mentees`);
        setShowExcelUploadDialog(false);
        setExcelFile(null);
        await loadAllMentees();
      } else {
        toast.error(data.message || "Failed to import mentees");
      }
    } catch (error: any) {
      toast.error("Failed to upload Excel: " + (error.message || "Unknown"));
    } finally {
      setUploadingExcel(false);
    }
  };

  const filteredMentees = useMemo(() => {
    return mentees; // Show all mentees from all projects
  }, [mentees]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Mentor Management
              </h1>
              <p className="text-sm md:text-base text-gray-600">
                Manage mentors, mentees, assignments, and attendance.
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mentees">Mentees</TabsTrigger>
            <TabsTrigger value="projects">Projects & Settings</TabsTrigger>
            <TabsTrigger value="mentors">Mentors</TabsTrigger>
          </TabsList>

          {/* Mentees Tab */}
          <TabsContent value="mentees" className="mt-6">
            <Card className="border shadow-xl bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-emerald-600">Mentee Management</CardTitle>
                  <CardDescription>
                    Add, edit, and manage mentees. Assign mentors to each mentee.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={openAttendanceDialog} variant="outline" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    Mark Attendance
                  </Button>
                  <Button onClick={() => openMenteeForm()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Mentee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading mentees...</div>
                ) : filteredMentees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No mentees found. Add a mentee to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Name</TableHead>
                          <TableHead className="font-semibold">Phone</TableHead>
                          <TableHead className="font-semibold">Year</TableHead>
                          <TableHead className="font-semibold">School</TableHead>
                          <TableHead className="font-semibold">District</TableHead>
                          <TableHead className="font-semibold">Mentor</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold text-center">Classes</TableHead>
                          <TableHead className="font-semibold text-center">Calls</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMentees.map((mentee, idx) => (
                          <TableRow key={mentee.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <TableCell className="font-medium text-gray-900">{mentee.mentee_name}</TableCell>
                            <TableCell className="text-gray-700">{mentee.mentee_phone || "—"}</TableCell>
                            <TableCell className="text-gray-700">{mentee.mentee_year || "—"}</TableCell>
                            <TableCell className="text-gray-700">{mentee.mentee_school || "—"}</TableCell>
                            <TableCell className="text-gray-700">{mentee.mentee_district || "—"}</TableCell>
                            <TableCell className="text-gray-700 font-medium">{mentee.volunteer_name || "—"}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={mentee.mentee_status === "active" ? "default" : "secondary"}
                                className={mentee.mentee_status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : ""}
                              >
                                {mentee.mentee_status || "active"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium text-gray-700">{mentee.total_classes || 0}</TableCell>
                            <TableCell className="text-center font-medium text-gray-700">{mentee.total_calls || 0}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openMenteeForm(mentee)}
                                  className="h-8 px-2"
                                  title="Edit Mentee"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openHistoryDialog(mentee, 'updates')}
                                  className="h-8 px-2 text-xs"
                                  title="View Updates"
                                >
                                  Updates
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openHistoryDialog(mentee, 'attendance')}
                                  className="h-8 px-2 text-xs"
                                  title="View Attendance"
                                >
                                  Attendance
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
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-6">
            <Card className="border shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-emerald-600">Projects & Requirements</CardTitle>
                <CardDescription>
                  Set required calls and manage project mentoring settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading projects...</div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No projects found</div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{project.title}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-gray-600">
                              Required Calls: <strong>{project.required_calls || 0}</strong>
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProjectSettings(project)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Settings
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mentors Tab */}
          <TabsContent value="mentors" className="mt-6">
            <Card className="border shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <Users className="w-5 h-5" />
                  Available Mentors
                </CardTitle>
                <CardDescription>
                  Volunteers who can be assigned as mentors to mentees
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading mentors...</div>
                ) : mentors.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No mentors found</div>
                ) : (
                  <div className="space-y-2">
                    {mentors.map((mentor) => {
                      const menteeCount = mentees.filter(m => m.volunteer_id === mentor.id).length;
                      return (
                        <div
                          key={mentor.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{mentor.name}</p>
                            <p className="text-xs text-gray-600">{mentor.email}</p>
                            {(mentor.dept || mentor.year) && (
                              <p className="text-xs text-gray-500">
                                {mentor.dept || ""} {mentor.year ? `• ${mentor.year}` : ""}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {menteeCount} Mentees
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Mentee Dialog */}
        <Dialog open={showMenteeDialog} onOpenChange={setShowMenteeDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  value={menteeForm.project_id}
                  onValueChange={(val) => setMenteeForm({ ...menteeForm, project_id: val })}
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
                  <Label>Year / Standard</Label>
                  <Input
                    value={menteeForm.mentee_year}
                    onChange={(e) => setMenteeForm({ ...menteeForm, mentee_year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={menteeForm.mentee_gender || undefined}
                    onValueChange={(val) => setMenteeForm({ ...menteeForm, mentee_gender: val })}
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
                <Label>Parent Contact</Label>
                <Input
                  value={menteeForm.mentee_parent_contact}
                  onChange={(e) => setMenteeForm({ ...menteeForm, mentee_parent_contact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign Mentor *</Label>
                {mentors.length === 0 ? (
                  <div className="p-3 border border-yellow-200 rounded-md bg-yellow-50">
                    <p className="text-sm text-yellow-800">No mentors available. Please add mentors first.</p>
                  </div>
                ) : (
                  <Select
                    value={menteeForm.volunteer_id}
                    onValueChange={(val) => setMenteeForm({ ...menteeForm, volunteer_id: val })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a mentor" />
                    </SelectTrigger>
                    <SelectContent>
                      {mentors.map((mentor) => (
                        <SelectItem key={mentor.id} value={mentor.id.toString()}>
                          {mentor.name} ({mentor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {mentors.length > 0 && !menteeForm.volunteer_id && (
                  <p className="text-xs text-red-500 mt-1">Please select a mentor to assign</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={menteeForm.mentee_status}
                  onValueChange={(val) => setMenteeForm({ ...menteeForm, mentee_status: val })}
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
                <Button type="submit" disabled={!menteeForm.volunteer_id || mentors.length === 0}>
                  {editingMentee ? "Update Mentee" : "Add Mentee"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Attendance Dialog */}
        <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mark Mentee Attendance</DialogTitle>
              <DialogDescription>
                Mark attendance for all mentees in {selectedProject?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mentees</Label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredMentees.map((mentee) => (
                    <div key={mentee.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{mentee.mentee_name}</p>
                        <p className="text-xs text-gray-600">Mentor: {mentee.volunteer_name || "—"}</p>
                      </div>
                      <Select
                        value={attendanceRecords[mentee.id]?.status || ""}
                        onValueChange={(val) => {
                          setAttendanceRecords({
                            ...attendanceRecords,
                            [mentee.id]: {
                              status: val,
                              notes: attendanceRecords[mentee.id]?.notes || ""
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="w-40">
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
                        value={attendanceRecords[mentee.id]?.notes || ""}
                        onChange={(e) => {
                          setAttendanceRecords({
                            ...attendanceRecords,
                            [mentee.id]: {
                              status: attendanceRecords[mentee.id]?.status || "",
                              notes: e.target.value
                            }
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAttendanceDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAttendance}>
                  Save Attendance
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                Upload an Excel file (.xlsx) with mentee details. Columns: Name, Phone, Year, Gender, School, District, Parent Contact, Mentor Email, Status, Notes
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
                      // Create sample Excel data
                      const sampleData = [
                        {
                          'Name': 'John Doe',
                          'Phone': '9876543210',
                          'Year': '10',
                          'Gender': 'Male',
                          'School': 'ABC School',
                          'District': 'Chennai',
                          'Parent Contact': '9876543211',
                          'Mentor Email': mentors.length > 0 ? mentors[0].email : 'mentor@example.com',
                          'Status': 'active',
                          'Notes': 'Sample mentee'
                        },
                        {
                          'Name': 'Jane Smith',
                          'Phone': '9876543212',
                          'Year': '9',
                          'Gender': 'Female',
                          'School': 'XYZ School',
                          'District': 'Coimbatore',
                          'Parent Contact': '9876543213',
                          'Mentor Email': mentors.length > 1 ? mentors[1].email : 'mentor2@example.com',
                          'Status': 'active',
                          'Notes': 'Another sample'
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
                }}>
                  Cancel
                </Button>
                <Button onClick={handleExcelUpload} disabled={!excelFile || uploadingExcel || projects.length === 0}>
                  {uploadingExcel ? "Uploading..." : "Upload Excel"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Project Settings Dialog */}
        <Dialog open={showProjectSettingsDialog} onOpenChange={setShowProjectSettingsDialog}>
          <DialogContent>
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
      </main>
      <Footer />
    </div>
  );
};

export default MentorManagement;
