import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft, Save, Upload, X, Camera, AlertCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";

// Common departments list (match student profile)
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

const OfficeBearerProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate age from DOB (same logic as StudentProfile)
  const age = useMemo(() => {
    if (!profileData.dob) return null;
    const birthDate = new Date(profileData.dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let calculated = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculated--;
    }
    return calculated;
  }, [profileData.dob]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    // If user is not an office bearer, send them to admin dashboard instead of forcing a login
    if (!auth.hasRole('office_bearer')) {
      navigate("/admin");
      return;
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to load user info");
        return;
      }

      // Base shape mirroring student profile fields
      const baseProfile: any = {
        name: currentUser.name || "",
        email: currentUser.email || "",
        register_no: "",
        dept: "",
        year: "",
        academic_year: "",
        phone: "",
        father_number: "",
        blood_group: "",
        gender: "",
        dob: "",
        address: "",
        hosteller_dayscholar: ""
      };

      // Load office bearer profile
      const profileRes = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }
      );

      const data = await profileRes.json();
      if (data.success && data.profile) {
        // Merge API data into base shape so new fields always exist
        setProfileData({ ...baseProfile, ...data.profile });
        // Load existing photo if available
        if (data.profile.photo_url) {
          setPhotoPreview(data.profile.photo_url);
        }
      } else {
        // Initialize empty profile data
        setProfileData(baseProfile);
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      toast.error('Failed to load profile: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setProfileData({ ...profileData, photo_url: '' });
    setShowDeleteConfirm(false);
    toast.success('Photo removed from selection');
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to save profile");
        return;
      }

      let photoUrl = profileData.photo_url || '';

      // Upload photo if a new file was selected
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('userId', currentUser.id.toString());

        try {
          const uploadRes = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/upload-photo`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${auth.getToken()}`
              },
              body: formData
            }
          );

          const uploadData = await uploadRes.json();
          if (uploadData.success) {
            photoUrl = uploadData.photo_url;
            setPhotoFile(null);
          }
        } catch (err: any) {
          console.error('Photo upload failed:', err);
          toast.error('Failed to upload photo: ' + (err.message || 'Unknown error'));
        }
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${currentUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({ ...profileData, photo_url: photoUrl })
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        loadProfile();
      } else {
        throw new Error(data.message || 'Failed to update profile');
      }
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

      <main className="flex-1 p-2 md:p-4 bg-transparent overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton to="/office-bearer" />
          </div>

          <div className="mb-6 bg-white dark:bg-slate-900 border border-border rounded-lg p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              {/* Profile Picture */}
              <div className="relative group">
                <input
                  type="file"
                  id="profile-photo-upload"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <div className="w-24 h-24 rounded-full border-2 border-border bg-muted flex items-center justify-center overflow-hidden relative shadow-inner">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                      <span className="text-3xl font-semibold text-primary">
                        {profileData.name ? profileData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'OB'}
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
                      title={photoPreview ? "Change photo" : "Upload photo"}
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                    {photoPreview && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 cursor-pointer hover:scale-110 transition-transform"
                        title="Delete photo"
                      >
                        <X className="w-4 h-4" />
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
                      {profileData.name || 'Office Bearer Profile'}
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
                    onClick={handleRemovePhoto}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Card className="border border-border bg-white dark:bg-slate-900">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-semibold text-foreground">
                Profile Information
              </CardTitle>
              <CardDescription className="text-sm mt-1 text-muted-foreground">
                Manage your personal and academic details as an Office Bearer.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin mr-2 h-5 w-5 border-b-2 border-primary"></div>
                  <span>Loading profile...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {/* Row 1: Name, Email, Register No */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Name</Label>
                        <Input
                          value={profileData.name || ''}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your name"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Email</Label>
                        <Input
                          type="email"
                          value={profileData.email || ''}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your email"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Register No</Label>
                        <Input
                          value={profileData.register_no || ''}
                          onChange={(e) => setProfileData({ ...profileData, register_no: e.target.value })}
                          placeholder="Enter register number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 2: Department, Year, Academic Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Department</Label>
                        <Select
                          value={profileData.dept || ""}
                          onValueChange={(val) => setProfileData({ ...profileData, dept: val })}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Year</Label>
                        <Select
                          value={profileData.year || ""}
                          onValueChange={(val) => setProfileData({ ...profileData, year: val })}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Academic Year</Label>
                        <Input
                          value={profileData.academic_year || ''}
                          onChange={(e) => setProfileData({ ...profileData, academic_year: e.target.value })}
                          placeholder="e.g., 2024-2025"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 3: Phone Number, Parent Number, DOB */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Phone Number</Label>
                        <Input
                          type="tel"
                          value={profileData.phone || ''}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="Enter mobile number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Parent's Phone</Label>
                        <Input
                          type="tel"
                          value={profileData.father_number || ''}
                          onChange={(e) => setProfileData({ ...profileData, father_number: e.target.value })}
                          placeholder="Enter parent's number"
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text"
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">DOB</Label>
                        <Input
                          type="date"
                          value={profileData.dob || ''}
                          onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                          className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    {/* Row 4: Age, Gender, Blood Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Age</Label>
                        <Input
                          value={age !== null ? `${age} years` : ''}
                          disabled
                          className="bg-muted text-foreground border-2 border-border font-semibold shadow-sm cursor-not-allowed"
                          placeholder="Auto-calculated from DOB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Gender</Label>
                        <Select
                          value={profileData.gender || ""}
                          onValueChange={(val) => setProfileData({ ...profileData, gender: val })}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Blood Group</Label>
                        <Select
                          value={profileData.blood_group || ""}
                          onValueChange={(val) => setProfileData({ ...profileData, blood_group: val })}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                      <div className="space-y-2">
                        <Label className="font-medium text-sm text-foreground">Hosteller or Dayscholar</Label>
                        <Select
                          value={profileData.hosteller_dayscholar || ""}
                          onValueChange={(val) => setProfileData({ ...profileData, hosteller_dayscholar: val })}
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                    <div className="space-y-2">
                      <Label className="font-medium text-sm text-foreground">Address</Label>
                      <Textarea
                        value={profileData.address || ''}
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        placeholder="Enter full address"
                        rows={4}
                        className="border-2 border-border hover:border-primary/50 focus:border-primary transition-all duration-300 focus:ring-2 focus:ring-primary/20 cursor-text resize-y"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 justify-center pt-6 border-t border-border">
                      <Button
                        variant="outline"
                        onClick={() => {
                          loadProfile();
                          setIsEditing(false);
                          setPhotoFile(null);
                        }}
                        disabled={saving}
                        className="px-6 h-11 hover:bg-muted transition-all duration-200 gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="gap-2 px-8 h-11 bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Profile'}
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

export default OfficeBearerProfile;
