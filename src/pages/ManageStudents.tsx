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

      <main className="flex-1 p-2 md:p-4 bg-background">
        <div className="w-full">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-foreground mb-1">Students</h1>
            <p className="text-sm text-muted-foreground">View and manage student profiles and project assignments</p>
          </div>

          {/* Filter Section */}
          <Card className="border-border/50 mb-6 bg-card">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search students by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="CSE">CSE</SelectItem>
                      <SelectItem value="ECE">ECE</SelectItem>
                      <SelectItem value="MECH">MECH</SelectItem>
                      <SelectItem value="EEE">EEE</SelectItem>
                      <SelectItem value="CIVIL">CIVIL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="I">I Year</SelectItem>
                      <SelectItem value="II">II Year</SelectItem>
                      <SelectItem value="III">III Year</SelectItem>
                      <SelectItem value="IV">IV Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students Table - Compact Layout */}
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-6">
              {students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No students found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Blood Group</TableHead>
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
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={student.profile?.photo || student.photo || student.photoUrl || '/Images/Brand_logo.png'} alt={student.name} />
                                  <AvatarFallback>
                                    {((student.name || "").split(" ").map(s => s[0]).slice(0, 2).join("") || "?")}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{student.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{student.email}</TableCell>
                            <TableCell>{student.profile?.dept || "-"}</TableCell>
                            <TableCell>{student.profile?.year || "-"}</TableCell>
                            <TableCell>{student.profile?.phone || "-"}</TableCell>
                            <TableCell>{student.profile?.dob ? new Date(student.profile.dob).toLocaleDateString() : "-"}</TableCell>
                            <TableCell>{student.profile?.gender || "-"}</TableCell>
                            <TableCell>{student.profile?.blood_group || "-"}</TableCell>
                            <TableCell className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProfile(student)}
                                className="gap-1"
                              >
                                <Edit className="w-4 h-4" />
                                View Profile
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAssignProject(student)}
                                className="gap-1"
                              >
                                📋 Project
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAssignEvent(student)}
                                className="gap-1"
                              >
                                🎯 Event
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowDeleteDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
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
                  <div className="mb-2 text-sm font-medium">
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
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assignIndex === null}>Assign</Button>
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
                  <div className="mb-2 text-sm font-medium">
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
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assignEventIndex === null}>Assign</Button>
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

