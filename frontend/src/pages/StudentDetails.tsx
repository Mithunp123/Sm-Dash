
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { BackButton } from "@/components/BackButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Edit, Save, Plus, Briefcase, Calendar, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
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
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
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

const StudentDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [userProjects, setUserProjects] = useState<any[]>([]);
    const [userEvents, setUserEvents] = useState<any[]>([]);

    const [profileFields, setProfileFields] = useState<ProfileFieldDefinition[]>([]);
    const [profileData, setProfileData] = useState<Record<string, any>>({});
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);

    // Assignment states
    const [assignIndex, setAssignIndex] = useState<number>(0);
    const [assignEventIndex, setAssignEventIndex] = useState<number>(0);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [showAssignEventDialog, setShowAssignEventDialog] = useState(false);

    // Fetch Data
    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    useEffect(() => {
        if (!profileFields.length || !isEditing) return;
        // Only init empty fields if we are editing and they are missing
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
    }, [profileFields, isEditing]);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const studentId = parseInt(id);
            const [userRes, profileRes, projectsRes, eventsRes, fieldsRes, studentProjectsRes, studentEventsRes] = await Promise.all([
                api.getUsers(), // Need basic user info (name, email role etc)
                api.getStudentProfile(studentId),
                api.getProjects(),
                api.getEvents(new Date().getFullYear().toString()),
                api.getProfileFieldSettings(),
                api.getUserProjects(studentId),
                api.getUserEvents(studentId)
            ]);

            if (userRes.success) {
                const foundUser = userRes.users?.find((u: any) => u.id === studentId);
                if (foundUser) {
                    let mergedProfile = foundUser;
                    if (profileRes.success) {
                        const payload = mergeProfileWithCustom(profileRes.profile);
                        // We need to mix the basic user object with the profile object
                        mergedProfile = {
                            ...foundUser,
                            profile: payload.mergedProfile,
                            // Add profile fields to top level if needed, or keep in profile
                            ...payload.mergedProfile
                        };
                    }
                    setStudent(mergedProfile);
                    setProfilePreview(mergedProfile);
                } else {
                    toast.error("Student not found");
                    navigate("/admin/students");
                    return;
                }
            }

            if (projectsRes.success) setProjects(projectsRes.projects || []);
            if (eventsRes.success) setEvents(eventsRes.events || []);
            if (fieldsRes.success) setProfileFields(fieldsRes.fields || []);
            if (studentProjectsRes.success) setUserProjects(studentProjectsRes.projects || []);
            if (studentEventsRes.success) setUserEvents(studentEventsRes.events || []);

        } catch (error: any) {
            toast.error("Failed to load student details");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const setProfilePreview = (studentData: any) => {
        const p = studentData.profile || {};
        const initialData: Record<string, any> = {
            dept: p.dept || studentData.dept || "",
            year: p.year || studentData.year || "",
            phone: p.phone || studentData.phone || "",
            blood_group: p.blood_group || studentData.blood_group || "",
            gender: p.gender || studentData.gender || "",
            dob: p.dob || studentData.dob || "",
            address: p.address || studentData.address || ""
        };

        // Custom fields
        // We need to wait for profileFields to be set potentially... 
        // But since we batch loaded, we might need access to it here. 
        // We'll rely on the useEffect updating it when fields load or we just set what we have.
        // For now simple fix:
        Object.keys(p).forEach(key => {
            if (!initialData[key]) initialData[key] = p[key];
        });

        setProfileData(initialData);
        setPhotoPreview(p.photo_url || p.photo || studentData.photo || studentData.photoUrl || '/Images/Brand_logo.png');
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

    const handleSaveProfile = async () => {
        if (!student) return;
        setSavingProfile(true);
        try {
            let workingProfileData: Record<string, any> = { ...profileData };

            if (photoFile) {
                const formData = new FormData();
                formData.append("file", photoFile);
                formData.append("userId", student.id.toString());

                // This seems to be a custom upload endpoint
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
                if (!uploadData.success) throw new Error(uploadData.message || "Photo upload failed");
                workingProfileData = { ...workingProfileData, photo: uploadData.photoUrl };
            }

            const payload = profileFields.length
                ? buildProfilePayload(profileFields, workingProfileData)
                : workingProfileData;

            const response = await api.updateStudentProfile(student.id, payload);
            if (response.success) {
                toast.success("Profile updated successfully");
                setIsEditing(false);
                loadData(); // Reload to refresh everything
            }
        } catch (e: any) {
            toast.error("Failed to save profile: " + e.message);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAssignProject = async () => {
        if (!projects[assignIndex] || !student) return;
        try {
            const projectId = projects[assignIndex].id;
            const response = await api.assignStudentToProject(student.id, projectId);
            if (response.success) {
                toast.success("Student assigned to project");
                setShowAssignDialog(false);
                loadData();
            } else {
                toast.error(response.message || 'Failed to assign');
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const handleAssignEvent = async () => {
        if (!events[assignEventIndex] || !student) return;
        try {
            const eventId = events[assignEventIndex].id;
            const response = await api.addEventMembers(eventId, [student.id]);
            if (response.success) {
                toast.success("Student assigned to event");
                setShowAssignEventDialog(false);
                loadData();
            } else {
                toast.error(response.message || 'Failed to assign');
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading student details...</div>;
    }

    if (!student) {
        return <div className="min-h-screen flex items-center justify-center">Student not found</div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1 p-2 md:p-4 w-full">
                <div className="mb-4">

                </div>

                {/* Header Profile Section */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
                    <div className="relative group">
                        <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-card shadow-xl">
                            <AvatarImage src={photoPreview || ""} className="object-cover" />
                            <AvatarFallback className="text-4xl bg-muted">{student.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {isEditing && (
                            <label className="absolute bottom-0 right-0 p-2 bg-primary text-foreground rounded-full cursor-pointer hover:bg-primary/90 shadow-lg" htmlFor="photo-upload">
                                <UserIcon className="w-5 h-5" />
                                <input id="photo-upload" type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                            </label>
                        )}
                    </div>

                    <div className="flex-1">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">{student.name}</h1>
                        <div className="flex flex-wrap gap-3 text-muted-foreground">
                            <div className="flex items-center gap-1"><UserIcon className="w-4 h-4" /> {student.email}</div>
                            <span>•</span>
                            <div>{student.profile?.dept || profileData.dept || "No Dept"}</div>
                            <span>•</span>
                            <div>Year {student.profile?.year || profileData.year || "-"}</div>
                        </div>
                        {!isEditing && (
                            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setIsEditing(true)}>
                                <Edit className="w-4 h-4" /> Edit Profile
                            </Button>
                        )}
                        {isEditing && (
                            <div className="flex gap-2 mt-4">
                                <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setProfilePreview(student); }}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                                    <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="profile" className="w-full space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="profile">Profile Details</TabsTrigger>
                        <TabsTrigger value="projects">Projects</TabsTrigger>
                        <TabsTrigger value="events">Events</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="focus-visible:outline-none">
                        <Card className="bg-card border-border/50">
                            <CardHeader>
                                <CardTitle>Personal Information</CardTitle>
                                <CardDescription>Manage student's personal details and custom fields.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Department</Label>
                                        {isEditing ? (
                                            <Input value={profileData.dept} onChange={e => setProfileData({ ...profileData, dept: e.target.value })} />
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.dept || "—"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Year</Label>
                                        {isEditing ? (
                                            <Select value={profileData.year} onValueChange={v => setProfileData({ ...profileData, year: v })}>
                                                <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="I">I Year</SelectItem>
                                                    <SelectItem value="II">II Year</SelectItem>
                                                    <SelectItem value="III">III Year</SelectItem>
                                                    <SelectItem value="IV">IV Year</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.year || "—"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        {isEditing ? (
                                            <Input value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} />
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.phone || "—"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date of Birth</Label>
                                        {isEditing ? (
                                            <Input type="date" value={profileData.dob} onChange={e => setProfileData({ ...profileData, dob: e.target.value })} />
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.dob ? new Date(profileData.dob).toLocaleDateString() : "—"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Blood Group</Label>
                                        {isEditing ? (
                                            <Select value={profileData.blood_group} onValueChange={v => setProfileData({ ...profileData, blood_group: v })}>
                                                <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
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
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.blood_group || "—"}</div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gender</Label>
                                        {isEditing ? (
                                            <Select value={profileData.gender} onValueChange={v => setProfileData({ ...profileData, gender: v })}>
                                                <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.gender || "—"}</div>
                                        )}
                                    </div>
                                </div>

                                {profileFields.filter(f => f.is_custom).length > 0 && (
                                    <>
                                        <div className="h-px bg-border/50 my-6" />
                                        <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {profileFields.filter(f => f.is_custom).map(field => (
                                                <div key={field.field_name} className="space-y-2">
                                                    <Label>{field.label}</Label>
                                                    {isEditing ? (
                                                        renderCustomFieldInput(field, profileData[field.field_name], (v) => setProfileData(prev => ({ ...prev, [field.field_name]: v })))
                                                    ) : (
                                                        <div className="p-2 bg-muted/30 rounded-md text-sm whitespace-pre-wrap">{profileData[field.field_name] || "—"}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div className="h-px bg-border/50 my-6" />
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    {isEditing ? (
                                        <Input value={profileData.address} onChange={e => setProfileData({ ...profileData, address: e.target.value })} />
                                    ) : (
                                        <div className="p-2 bg-muted/30 rounded-md text-sm">{profileData.address || "—"}</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="projects" className="focus-visible:outline-none">
                        <Card className="bg-card border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Assigned Projects</CardTitle>
                                    <CardDescription>Projects this student is currently working on.</CardDescription>
                                </div>
                                <Button onClick={() => setShowAssignDialog(true)} className="gap-2">
                                    <Plus className="w-4 h-4" /> Assign Project
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {userProjects.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No projects assigned</div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {userProjects.map(p => (
                                            <div key={p.id} className="p-4 rounded-lg bg-muted/30 border border-border flex items-start gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <Briefcase className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{p.title}</div>
                                                    <div className="text-sm text-muted-foreground">{p.ngo_name}</div>
                                                    <div className="text-xs mt-2 px-2 py-1 bg-background rounded border inline-block">
                                                        {p.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="events" className="focus-visible:outline-none">
                        <Card className="bg-card border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Assigned Events</CardTitle>
                                    <CardDescription>Events this student is participating in.</CardDescription>
                                </div>
                                <Button onClick={() => setShowAssignEventDialog(true)} className="gap-2">
                                    <Plus className="w-4 h-4" /> Assign Event
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {userEvents.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No events assigned</div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {userEvents.map(e => (
                                            <div key={e.id} className="p-4 rounded-lg bg-muted/30 border border-border flex items-start gap-3">
                                                <div className="bg-primary/10 p-2 rounded-md">
                                                    <Calendar className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{e.title}</div>
                                                    <div className="text-sm text-muted-foreground">{new Date(e.date).toLocaleDateString()}</div>
                                                    <div className="text-xs mt-2 px-2 py-1 bg-background rounded border inline-block">
                                                        {e.is_special_day ? 'Special Day' : 'Regular'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Assign Project Dialog */}
                <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Project</DialogTitle>
                            <DialogDescription>Assign {student.name} to a project</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Select Project</Label>
                                {projects.length > 0 ? (
                                    <>
                                        <Slider
                                            value={[assignIndex]}
                                            min={0}
                                            max={projects.length - 1}
                                            step={1}
                                            onValueChange={v => setAssignIndex(v[0])}
                                        />
                                        <div className="p-2 border rounded-md mt-2 text-center bg-muted/20 text-foreground font-medium slider-value">
                                            {projects[assignIndex]?.title}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">No projects available</div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="h-10 rounded-md font-semibold text-sm px-4">Cancel</Button>
                                <Button onClick={handleAssignProject} disabled={projects.length === 0} className="h-10 rounded-md font-semibold text-sm px-4">Assign</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Assign Event Dialog */}
                <Dialog open={showAssignEventDialog} onOpenChange={setShowAssignEventDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Event</DialogTitle>
                            <DialogDescription>Assign {student.name} to an event</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Select Event</Label>
                                {events.length > 0 ? (
                                    <>
                                        <Slider
                                            value={[assignEventIndex]}
                                            min={0}
                                            max={events.length - 1}
                                            step={1}
                                            onValueChange={v => setAssignEventIndex(v[0])}
                                        />
                                        <div className="p-2 border rounded-md mt-2 text-center bg-muted/20 text-foreground font-medium slider-value">
                                            {events[assignEventIndex]?.title}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground">No events available</div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowAssignEventDialog(false)} className="h-10 rounded-md font-semibold text-sm px-4">Cancel</Button>
                                <Button onClick={handleAssignEvent} disabled={events.length === 0} className="h-10 rounded-md font-semibold text-sm px-4">Assign</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
};

export default StudentDetails;
