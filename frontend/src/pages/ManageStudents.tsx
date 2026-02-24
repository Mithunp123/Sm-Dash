import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Users, ArrowLeft, Edit, Briefcase, GraduationCap, Trash2, Search, Filter } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { ProfileFieldDefinition, buildProfilePayload, mergeProfileWithCustom } from "@/utils/profileFields";
import { buildImageUrl } from "@/utils/imageUtils";

const renderCustomFieldInput = (
  field: ProfileFieldDefinition,
  value: any,
  onChange: (val: string) => void
) => {
  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
        />
      );
  }
};

const ManageStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAssignEventDialog, setShowAssignEventDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const [profileFields, setProfileFields] = useState<ProfileFieldDefinition[]>([]);
  const [profileData, setProfileData] = useState<Record<string, any>>({
    dept: "",
    year: "",
    phone: "",
    blood_group: "",
    gender: "",
    dob: "",
    address: ""
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [assignData, setAssignData] = useState({
    projectId: ""
  });
  const [assignIndex, setAssignIndex] = useState<number | null>(null);

  const [assignEventIndex, setAssignEventIndex] = useState<number | null>(null);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';
    // Wait for permissions to load before deciding access
    if (permissionsLoading) return;

    // Admin or someone with student management permission may access
    const canAccess = isAdmin || permissions.can_manage_students;
    if (!canAccess) {
      toast.error("You don't have permission to access student management");
      navigate("/admin");
      return;
    }

    // Load page data
    loadData();
  }, [navigate, permissions, permissionsLoading]);

  useEffect(() => {
    if (!profileFields.length) return;
    setProfileData((prev) => {
      const next = { ...prev };
      let changed = false;
      profileFields.forEach((field) => {
        if (next[field.field_name] === undefined) {
          next[field.field_name] = '';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [profileFields]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [usersRes, projectsRes, eventsRes, profileFieldsRes] = await Promise.all([
        api.getUsers(),
        api.getProjects(),
        api.getEvents(new Date().getFullYear().toString()),
        api.getProfileFieldSettings()
      ]);

      if (profileFieldsRes.success) {
        setProfileFields(profileFieldsRes.fields || []);
      }

      if (usersRes.success) {
        // Filter only students
        const studentUsers = usersRes.users?.filter((u: any) => u.role === 'student') || [];

        // Fetch student profiles for each student
        const studentsWithProfiles = await Promise.all(
          studentUsers.map(async (student: any) => {
            try {
              const profileRes = await api.getStudentProfile(student.id);
              const profilePayload = profileRes.success ? mergeProfileWithCustom(profileRes.profile) : null;
              return {
                ...student,
                profile: profilePayload ? profilePayload.mergedProfile : null
              };
            } catch {
              return {
                ...student,
                profile: null
              };
            }
          })
        );

        setStudents(studentsWithProfiles);
      }

      if (projectsRes.success) {
        setProjects(projectsRes.projects || []);
      }

      if (eventsRes.success) {
        setEvents(eventsRes.events || []);
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = (student: any) => {
    navigate(`/admin/students/${student.id}`);
  };


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
        toast.error("Supported formats: JPG, PNG, GIF, WebP");
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };



  const handleAssignProject = async (student: any) => {
    setSelectedStudent(student);
    setAssignData({ projectId: "" });
    // Try to set slider to current project if any
    try {
      const res = await api.getUserProjects(student.id);
      if (res.success && Array.isArray(res.projects) && res.projects.length > 0 && projects.length > 0) {
        // Find index of first project in the full projects list
        const firstProject = res.projects[0];
        const idx = projects.findIndex((p: any) => p.id === firstProject.id);
        setAssignIndex(idx >= 0 ? idx : 0);
      } else {
        setAssignIndex(projects.length > 0 ? 0 : null);
      }
    } catch (err) {
      setAssignIndex(projects.length > 0 ? 0 : null);
    }
    setShowAssignDialog(true);
  };

  const handleAssignEvent = async (student: any) => {
    setSelectedStudent(student);
    // Try to set slider to current event if any
    try {
      const res = await api.getUserEvents(student.id);
      if (res.success && Array.isArray(res.events) && res.events.length > 0 && events.length > 0) {
        // Find index of first event in the full events list
        const firstEvent = res.events[0];
        const idx = events.findIndex((e: any) => e.id === firstEvent.id);
        setAssignEventIndex(idx >= 0 ? idx : 0);
      } else {
        setAssignEventIndex(events.length > 0 ? 0 : null);
      }
    } catch (err) {
      setAssignEventIndex(events.length > 0 ? 0 : null);
    }
    setShowAssignEventDialog(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || assignIndex === null) return;

    const idx = assignIndex as number;
    if (idx < 0 || idx >= projects.length) {
      toast.error('Invalid project selection');
      return;
    }

    const projectId = projects[idx].id;

    try {
      const response = await api.assignStudentToProject(selectedStudent.id, projectId);
      if (response.success) {
        toast.success("Student assigned to project successfully!");
        setShowAssignDialog(false);
        setSelectedStudent(null);
        setAssignIndex(null);
        loadData();
      } else {
        toast.error(response.message || 'Failed to assign student');
      }
    } catch (error: any) {
      toast.error("Failed to assign student: " + error.message);
    }
  };

  const handleSaveEventAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || assignEventIndex === null) return;

    const idx = assignEventIndex as number;
    if (idx < 0 || idx >= events.length) {
      toast.error('Invalid event selection');
      return;
    }

    const eventId = events[idx].id;

    try {
      const response = await api.addEventMembers(eventId, [selectedStudent.id]);
      if (response.success) {
        toast.success("Student assigned to event successfully!");
        setShowAssignEventDialog(false);
        setSelectedStudent(null);
        setAssignEventIndex(null);
        loadData();
      } else {
        toast.error(response.message || 'Failed to assign student');
      }
    } catch (error: any) {
      toast.error("Failed to assign student: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 w-full">
          {/* Back Button */}
          <div className="mb-6">

          </div>

          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title">Student Profiles</h1>
              <p className="page-subtitle border-l-4 border-primary/30 pl-3 mt-2">Manage core community database</p>
            </div>
          </div>

          {/* Filter Section - Standardized */}
          <Card className="border-border/40 mb-8 bg-card shadow-sm rounded-md overflow-hidden">
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search students by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 rounded-md bg-background border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Department
                  </Label>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full h-10 rounded-md bg-background border-border text-foreground">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="all" className="text-foreground">All Departments</SelectItem>
                      <SelectItem value="CSE" className="text-foreground">CSE</SelectItem>
                      <SelectItem value="ECE" className="text-foreground">ECE</SelectItem>
                      <SelectItem value="MECH" className="text-foreground">MECH</SelectItem>
                      <SelectItem value="EEE" className="text-foreground">EEE</SelectItem>
                      <SelectItem value="CIVIL" className="text-foreground">CIVIL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Year
                  </Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-full h-10 rounded-md bg-background border-border text-foreground">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <SelectItem value="all" className="text-foreground">All Years</SelectItem>
                      <SelectItem value="I" className="text-foreground">I Year</SelectItem>
                      <SelectItem value="II" className="text-foreground">II Year</SelectItem>
                      <SelectItem value="III" className="text-foreground">III Year</SelectItem>
                      <SelectItem value="IV" className="text-foreground">IV Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students Table - Compact Layout */}
          <Card className="border-none bg-card/40 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden mb-10">
            <CardContent className="p-0">
              {students.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground italic font-bold">No students found</div>
              ) : (
                <>
                  {/* Mobile Mobile Cards View */}
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {students
                      .filter((student) => {
                        const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.email.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesDept = deptFilter === "all" || student.profile?.dept === deptFilter;
                        const matchesYear = yearFilter === "all" || student.profile?.year === yearFilter;
                        return matchesSearch && matchesDept && matchesYear;
                      })
                      .map((student) => (
                        <Card key={student.id} className="rounded-3xl border-border/40 overflow-hidden bg-card/60 backdrop-blur-sm shadow-md active:scale-[0.98] transition-all">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar className="w-14 h-14 rounded-2xl border-2 border-primary/10">
                                <AvatarImage src={buildImageUrl(student.profile?.photo || student.photo || student.photoUrl) || '/Images/Brand_logo.png'} />
                                <AvatarFallback className="bg-primary/5 text-primary font-black uppercase">
                                  {student.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-black text-foreground uppercase tracking-tight truncate pr-2">{student.name}</h3>
                                <div className="flex gap-2 mt-1">
                                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                                    {student.profile?.dept || "No Dept"}
                                  </Badge>
                                  <Badge variant="outline" className="font-bold border-primary/30 text-primary/70 text-[9px] px-2 py-0.5">
                                    {student.profile?.year || "N/A"}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div className="bg-muted/30 p-2 rounded-md border border-border/50">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                                <p className="text-sm font-medium text-foreground truncate">{student.profile?.phone || "-"}</p>
                              </div>
                              <div className="bg-muted/30 p-2 rounded-md border border-border/50">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Blood</p>
                                <p className="text-sm font-medium text-foreground truncate">{student.profile?.blood_group || "-"}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProfile(student)}
                                className="flex-1 h-9 rounded-md font-semibold text-xs"
                              >
                                Profile
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAssignProject(student)}
                                className="flex-1 h-9 rounded-md font-semibold text-xs bg-primary"
                              >
                                Project
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowDeleteDialog(true);
                                }}
                                className="h-9 w-9 rounded-md p-0 flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30">
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students
                          .filter((student) => {
                            const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              student.email.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesDept = deptFilter === "all" || student.profile?.dept === deptFilter;
                            const matchesYear = yearFilter === "all" || student.profile?.year === yearFilter;
                            return matchesSearch && matchesDept && matchesYear;
                          })
                          .map((student) => (
                            <TableRow key={student.id} className="border-border/30 group hover:bg-muted/20">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-10 h-10 border-2 border-primary/10">
                                    <AvatarImage src={buildImageUrl(student.profile?.photo || student.photo || student.photoUrl) || '/Images/Brand_logo.png'} alt={student.name} />
                                    <AvatarFallback>
                                      {((student.name || "").split(" ").map(s => s[0]).slice(0, 2).join("") || "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-black text-foreground uppercase tracking-tight">{student.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm font-medium text-muted-foreground">{student.email}</TableCell>
                              <TableCell>
                                <Badge className="bg-primary/5 text-primary border-none font-bold text-[10px] uppercase tracking-widest">
                                  {student.profile?.dept || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-black text-[10px] tracking-widest text-muted-foreground">{student.profile?.year || "-"}</TableCell>
                              <TableCell className="text-sm font-bold">{student.profile?.phone || "-"}</TableCell>
                              <TableCell className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditProfile(student)}
                                  className="h-8 text-primary hover:text-primary hover:bg-primary/10 font-bold text-[10px] uppercase tracking-widest rounded-lg"
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAssignProject(student)}
                                  className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-[10px] uppercase tracking-widest rounded-lg"
                                >
                                  Project
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="h-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Profile Dialog - Removed (moved to StudentDetails page) */}

      {/* Assign Project Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Student to Project</DialogTitle>
            <DialogDescription>
              Assign {selectedStudent?.name} to a project
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAssignment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="projectSlider">Project</Label>
              {projects.length === 0 ? (
                <div className="text-sm text-muted-foreground">No projects available</div>
              ) : (
                <div>
                  <div className="mb-2 text-sm font-medium text-foreground slider-value">
                    Selected: {assignIndex !== null && projects[assignIndex] ? `${projects[assignIndex].title}${projects[assignIndex].ngo_name ? ` (${projects[assignIndex].ngo_name})` : ''}` : 'None'}
                  </div>
                  <Slider
                    id="projectSlider"
                    value={assignIndex !== null ? [assignIndex] : [0]}
                    min={0}
                    max={Math.max(0, projects.length - 1)}
                    step={1}
                    onValueChange={(val) => setAssignIndex(val[0])}
                  />
                  <div className="text-xs text-muted-foreground mt-2">
                    Slide to choose a project. The label above shows which project the student is currently in (if any).
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedStudent(null);
                }}
                className="h-10 rounded-md font-semibold text-sm px-4"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assignIndex === null} className="h-10 rounded-md font-semibold text-sm px-4">Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Event Dialog */}
      <Dialog open={showAssignEventDialog} onOpenChange={setShowAssignEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Student to Event</DialogTitle>
            <DialogDescription>
              Assign {selectedStudent?.name} to an event
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEventAssignment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="eventSlider">Event</Label>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events available</div>
              ) : (
                <div>
                  <div className="mb-2 text-sm font-medium text-foreground slider-value">
                    Selected: {assignEventIndex !== null && events[assignEventIndex] ? `${events[assignEventIndex].name}` : 'None'}
                  </div>
                  <Slider
                    id="eventSlider"
                    value={assignEventIndex !== null ? [assignEventIndex] : [0]}
                    min={0}
                    max={Math.max(0, events.length - 1)}
                    step={1}
                    onValueChange={(val) => setAssignEventIndex(val[0])}
                  />
                  <div className="text-xs text-muted-foreground mt-2">
                    Slide to choose an event. The label above shows which event the student is currently assigned to (if any).
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAssignEventDialog(false);
                  setSelectedStudent(null);
                }}
                className="h-10 rounded-md font-semibold text-sm px-4"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assignEventIndex === null} className="h-10 rounded-md font-semibold text-sm px-4">Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedStudent?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setSelectedStudent(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={async () => {
              if (!selectedStudent) return;
              try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${selectedStudent.id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                  }
                });
                const data = await response.json();
                if (data.success) {
                  toast.success("Student removed successfully!");
                  setShowDeleteDialog(false);
                  setSelectedStudent(null);
                  loadData();
                }
              } catch (error: any) {
                toast.error("Failed to remove student: " + error.message);
              }
            }}>
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default ManageStudents;

