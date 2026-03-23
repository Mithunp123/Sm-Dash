import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft, Save, UserCircle, Camera, Settings, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { buildImageUrl } from "@/utils/imageUtils";

// Common departments list
const DEPARTMENTS = [
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Biotechnology",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Food Technology",
  "Information Technology",
  "Textile Technology",
  "Very Large Scale Integration Technology",
  "Computer Science and Business Systems",
  "Master of Business Administration",
  "Master of Computer Applications"
];

const StudentProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate age from DOB
  const age = useMemo(() => {
    if (!profileData.dob) return null;
    const birthDate = new Date(profileData.dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [profileData.dob]);

  // Load profile picture
  useEffect(() => {
    const user = auth.getUser();
    if (user?.id) {
      if (user.photo_url) {
        setProfilePicture(user.photo_url);
      }
    }
  }, []);

  // Handle profile picture upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      try {
        const user = auth.getUser();
        if (!user?.id) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id.toString());

        const res = await api.uploadPhoto(formData);
        if (res.success && res.photoUrl) {
          // Update profile in DB with new photo URL
          await api.updateStudentProfile(user.id, { photo: res.photoUrl });

          setProfilePicture(res.photoUrl);

          // Update global auth user
          auth.setUser({
            ...user,
            photo_url: res.photoUrl
          });

          window.dispatchEvent(new CustomEvent('profileUpdated'));
          toast.success('Profile picture updated!');
        } else {
          throw new Error(res.message || 'Upload failed');
        }
      } catch (err: any) {
        console.error('Photo upload error:', err);
        toast.error('Failed to upload photo: ' + err.message);
      }
    }
  };

  // Handle profile picture delete
  const handlePhotoDelete = async () => {
    const user = auth.getUser();
    if (user?.id) {
      try {
        await api.updateStudentProfile(user.id, { photo: null });
        setProfilePicture(null);

        auth.setUser({
          ...user,
          photo_url: undefined
        });

        window.dispatchEvent(new CustomEvent('profileUpdated'));
        setShowDeleteConfirm(false);
        toast.success('Profile picture removed');
      } catch (err) {
        toast.error('Failed to remove photo');
      }
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      if (!auth.isAuthenticated()) {
        toast.error("Please login to access your profile");
        navigate("/login");
        return false;
      }
      if (!auth.hasRole('student')) {
        toast.error("Access denied. Student role required.");
        navigate("/login");
        return false;
      }
      return true;
    };

    if (checkAuth()) {
      loadProfile();
    }
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to load user info");
        return;
      }

      // Load student profile
      const profileRes = await api.getStudentProfile(currentUser.id);
      if (profileRes.success && profileRes.profile) {
        // Always include name and email from current user
        setProfileData({
          ...profileRes.profile,
          name: currentUser.name || profileRes.profile.name || '',
          email: currentUser.email || profileRes.profile.email || ''
        });
      } else {
        // Initialize empty profile data with name and email
        setProfileData({
          name: currentUser.name || '',
          email: currentUser.email || '',
          register_no: '',
          dept: '',
          year: '',
          academic_year: '',
          phone: '',
          father_number: '',
          blood_group: '',
          gender: '',
          dob: '',
          address: '',
          hosteller_dayscholar: ''
        });
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      toast.error('Failed to load profile: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };


  const handleSaveProfile = async (e?: React.MouseEvent) => {
    // universal save handler with refresh logic
    e?.preventDefault();
    e?.stopPropagation();
    try {
      setSaving(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to save profile");
        return;
      }

      // Update user name/email if changed
      if (profileData.name || profileData.email) {
        try {
          const updateUserRes = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${currentUser.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${auth.getToken()}`
              },
              body: JSON.stringify({
                name: profileData.name || undefined,
                email: profileData.email || undefined
              })
            }
          );
          if (updateUserRes.ok) {
            const data = await updateUserRes.json();
            if (data.success) {
              const cur = auth.getUser();
              if (cur) {
                auth.setUser({
                  ...cur,
                  name: profileData.name || cur.name,
                  email: profileData.email || cur.email
                });
              }
            }
          }
        } catch (err) {
          console.warn('user info update failed', err);
          toast.warning('Name/email update failed');
        }
      }

      // build profile payload
      const payload = {
        register_no: profileData.register_no || null,
        dept: profileData.dept || null,
        year: profileData.year || null,
        academic_year: profileData.academic_year || null,
        phone: profileData.phone || null,
        father_number: profileData.father_number || null,
        blood_group: profileData.blood_group || null,
        gender: profileData.gender || null,
        dob: profileData.dob || null,
        address: profileData.address || null,
        hosteller_dayscholar: profileData.hosteller_dayscholar || null
      };

      const res = await api.updateStudentProfile(currentUser.id, payload);
      if (!res.success) throw new Error(res.message || 'Failed to update profile');

      toast.success('Profile updated successfully!');

      // refresh user and profile from server
      try {
        const usr = await api.getUser(currentUser.id);
        if (usr.success && usr.user) {
          auth.setUser({ ...auth.getUser(), ...usr.user });
        }
      } catch (e) {
        console.error('refresh user failed', e);
      }

      await loadProfile();
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error('Failed to save profile: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />



      <main className="flex-1 p-4 md:p-6 lg:p-8 bg-transparent overflow-y-auto">
        <div className="w-full">
          {/* page title */}
          <div className="mb-6">
            <h1 className="page-title uppercase font-black">My Profile</h1>
            <p className="page-subtitle uppercase tracking-widest mt-1 text-muted-foreground">
              Manage your personal and academic details
            </p>
          </div>

          {/* Hero Header Section with Profile Picture */}
          <div className="mb-6 bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              {/* Profile Picture */}
              <div className="relative group">
                <input
                  type="file"
                  id="profile-photo-upload"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="w-20 h-20 rounded-full border-2 border-border bg-muted flex items-center justify-center overflow-hidden relative">
                  {/* Avatar with initials or uploaded photo */}
                  {profilePicture ? (
                    <img
                      src={buildImageUrl(profilePicture)}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                      <span className="text-3xl font-semibold text-primary">
                        {profileData.name ? profileData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'ME'}
                      </span>
                    </div>
                  )}
                </div>
                {/* Action buttons - Only visible when isEditing is true */}
                {isEditing && (
                  <div className="absolute bottom-0 right-0 flex gap-1">
                    <label
                      htmlFor="profile-photo-upload"
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 cursor-pointer hover:scale-110 transition-transform"
                      title={profilePicture ? "Change photo" : "Upload photo"}
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                    {profilePicture && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 cursor-pointer hover:scale-110 transition-transform"
                        title="Delete photo"
                      >
                        <span className="text-base font-bold">×</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Name and Email */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground mb-1">
                      {profileData.name || 'My Profile'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {profileData.email || 'Update your profile information'}
                    </p>
                    {profileData.dept && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {profileData.dept} {profileData.year ? `• ${profileData.year} Year` : ''}
                      </p>
                    )}
                  </div>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                <h3 className="text-xl font-bold mb-4">Delete Profile Picture?</h3>
                <p className="text-muted-foreground mb-6">Are you sure you want to remove your profile picture?</p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handlePhotoDelete}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Card className="border-none bg-card/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-semibold text-foreground">
                Profile Information
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-muted-foreground">
                Fill in your profile details. Fields marked as required must be completed.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="text-center py-12">Loading profile...</div>
              ) : (
                <div className="space-y-6">
                  {/* Fixed Profile Fields - Centered */}
                  <div className="space-y-4">
                    {/* Row 1: Name, Mail Id, Register No */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Name</Label>
                        <Input
                          value={profileData.name || ''}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your name"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2 ">
                        <Label className="font-medium text-sm text-foreground">Mail Id</Label>
                        <Input
                          type="email"
                          value={profileData.email || ''}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your email"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Register No</Label>
                        <Input
                          value={profileData.register_no || ''}
                          onChange={(e) => setProfileData({ ...profileData, register_no: e.target.value })}
                          placeholder="Enter register number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 2: Department, Year, Academic Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 ">
                        <Label className="font-medium text-sm text-foreground">Department</Label>
                        <Select
                          value={profileData.dept || ""}
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, dept: val });
                          }}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Year</Label>
                        <Select
                          value={profileData.year || ""}
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, year: val });
                          }}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                      <div className="space-y-2 ">
                        <Label className="font-medium text-sm text-foreground">Academic Year</Label>
                        <Input
                          value={profileData.academic_year || ''}
                          onChange={(e) => setProfileData({ ...profileData, academic_year: e.target.value })}
                          placeholder="e.g., 2024-2025"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 3: Phone Number, Father Number, DOB */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Phone Number</Label>
                        <Input
                          type="tel"
                          value={profileData.phone || ''}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="Enter mobile number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Father Number</Label>
                        <Input
                          type="tel"
                          value={profileData.father_number || ''}
                          onChange={(e) => setProfileData({ ...profileData, father_number: e.target.value })}
                          placeholder="Enter father's number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">DOB</Label>
                        <Input
                          type="date"
                          value={profileData.dob || ''}
                          onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 4: Age, Gender, Blood Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Age</Label>
                        <Input
                          value={age !== null ? `${age} years` : ''}
                          disabled
                          className="bg-gradient-to-r from-muted/60 to-muted/40 border-2 border-border font-semibold shadow-sm cursor-not-allowed"
                          placeholder="Auto-calculated from DOB"
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Gender</Label>
                        <Select
                          value={profileData.gender || ""}
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, gender: val });
                          }}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Blood Group</Label>
                        <Select
                          value={profileData.blood_group || ""}
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, blood_group: val });
                          }}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                    </div>

                    {/* Row 5: Hosteller/Dayscholar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 group">
                        <Label className="font-medium text-sm text-foreground">Hosteller or Dayscholar</Label>
                        <Select
                          value={profileData.hosteller_dayscholar || ""}
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, hosteller_dayscholar: val });
                          }}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Hosteller">Hosteller</SelectItem>
                            <SelectItem value="Dayscholar">Dayscholar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Address - Full Width */}
                    <div className="space-y-2 group">
                      <Label className="font-medium text-sm text-foreground">Address</Label>
                      <Textarea
                        value={profileData.address || ''}
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        placeholder="Enter address"
                        rows={4}
                        className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300  focus:ring-2 focus:ring-primary/20 cursor-text resize-y"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 justify-center pt-6 border-t-2 border-border/50 ">
                      <Button
                        variant="outline"
                        onClick={() => {
                          loadProfile();
                          setIsEditing(false);
                        }}
                        disabled={saving}
                        className="px-6 h-11 hover:bg-muted  transition-all duration-200 hover:shadow-md gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="gap-2 px-8 h-11 bg-primary text-foreground font-semibold shadow-lg hover:shadow-2xl transition-all duration-300  relative overflow-hidden group"
                      >
                        <Save className="w-4 h-4 relative z-10  transition-transform duration-300" />
                        <span className="relative z-10">{saving ? 'Saving...' : 'Save Profile'}</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

    </div>
  );
};

export default StudentProfile;
