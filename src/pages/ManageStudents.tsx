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
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
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
    setSelectedStudent(student);
    const mergedProfile = student.profile
      ? mergeProfileWithCustom(student.profile).mergedProfile
      : {};

    const initialData: Record<string, any> = {
      dept: mergedProfile.dept || "",
      year: mergedProfile.year || "",
      phone: mergedProfile.phone || "",
      blood_group: mergedProfile.blood_group || "",
      gender: mergedProfile.gender || "",
      dob: mergedProfile.dob || "",
      address: mergedProfile.address || ""
    };

    profileFields.forEach((field) => {
      if (field.is_custom) {
        initialData[field.field_name] = mergedProfile[field.field_name] ?? "";
      }
    });

    setProfileData(initialData);
    setPhotoFile(null);
    setPhotoPreview(mergedProfile.photo_url || mergedProfile.photo || student.photo || '/Images/Brand_logo.png');
    setShowEditDialog(true);
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      let workingProfileData: Record<string, any> = { ...profileData };

      // If photo file selected, upload it first
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        formData.append("userId", selectedStudent.id.toString());

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/upload/photo`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.getToken()}`,
            },
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          toast.error("Photo upload failed: " + (uploadData.message || "Unknown error"));
          return;
        }

        workingProfileData = { ...workingProfileData, photo: uploadData.photoUrl };
      }

      const payload = profileFields.length
        ? buildProfilePayload(profileFields, workingProfileData)
        : workingProfileData;

      const response = await api.updateStudentProfile(selectedStudent.id, payload);
      if (response.success) {
        toast.success("Student profile updated successfully!");
        setShowEditDialog(false);
        setSelectedStudent(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to update profile: " + error.message);
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
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Students</h1>
              <p className="text-lg opacity-90">View and manage student profiles and project assignments</p>
            </div>
          </div>

          {/* Filter Section */}
          <Card className="gradient-card border-border/50 mb-6">
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
          <Card className="gradient-card border-border/50">
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
                                    {((student.name || "").split(" ").map(s => s[0]).slice(0,2).join("") || "?")}
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
                                Edit
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

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>
              Update profile details for {selectedStudent?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-4 mt-4">
            {/* Photo Upload Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-2 border-dashed border-blue-200 dark:border-blue-900 rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-8 items-stretch">
                {/* Photo Preview - Stylish Frame */}
                <div className="flex flex-col items-center gap-4 flex-shrink-0">
                  <div className="relative w-36 h-44 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg border-3 border-white dark:border-slate-700 flex items-center justify-center group">
                    {photoPreview ? (
                      <>
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="text-5xl animate-pulse">📷</div>
                        <span className="text-xs font-medium text-center">No photo</span>
                      </div>
                    )}
                  </div>
                  {photoFile && (
                    <div className="text-xs text-center text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950 px-3 py-1 rounded-full">
                      ✓ Ready to upload
                    </div>
                  )}
                </div>

                {/* File Input Section */}
                <div className="flex-1 flex flex-col justify-center gap-4">
                  <div>
                    <Label htmlFor="photoInput" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                      Choose a photo to upload
                    </Label>
                    <div className="relative">
                      <input
                        id="photoInput"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="photoInput"
                        className="flex flex-col items-center justify-center gap-3 px-6 py-8 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl bg-white/50 dark:bg-slate-800/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors group"
                      >
                        <div className="text-3xl group-hover:scale-110 transition-transform">📁</div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Click to upload</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">or drag and drop</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Format & Size Info */}
                  <div className="bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <span className="text-lg">ℹ️</span> Supported formats
                    </p>
                    <div className="space-y-1.5 text-xs text-blue-800 dark:text-blue-300">
                      <p className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">✓</span> JPG, PNG, GIF, WebP
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">✓</span> Max size: 5MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept">Department</Label>
                <Input
                  id="dept"
                  value={profileData.dept}
                  onChange={(e) => setProfileData({ ...profileData, dept: e.target.value })}
                  placeholder="e.g., CSE, ECE, MECH"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={profileData.year} onValueChange={(value) => setProfileData({ ...profileData, year: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I Year</SelectItem>
                    <SelectItem value="II">II Year</SelectItem>
                    <SelectItem value="III">III Year</SelectItem>
                    <SelectItem value="IV">IV Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={profileData.gender} onValueChange={(value) => setProfileData({ ...profileData, gender: value })}>
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
                <Label htmlFor="blood_group">Blood Group</Label>
                <Select value={profileData.blood_group} onValueChange={(value) => setProfileData({ ...profileData, blood_group: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={profileData.dob}
                  onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={profileData.address}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                placeholder="Full address"
              />
            </div>
            {profileFields.filter((field) => field.is_custom).length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-sm text-muted-foreground">Custom Fields</Label>
                {profileFields
                  .filter((field) => field.is_custom)
                  .map((field) => (
                    <div key={field.field_name} className="space-y-2">
                      <Label htmlFor={`custom-${field.field_name}`}>{field.label}</Label>
                      {renderCustomFieldInput(
                        field,
                        profileData[field.field_name],
                        (val) => setProfileData((prev) => ({ ...prev, [field.field_name]: val }))
                      )}
                    </div>
                  ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save Profile</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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

      <Footer />
    </div>
  );
};

export default ManageStudents;

