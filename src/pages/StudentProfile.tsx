import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft, Save, Upload, X, Camera, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
// Common departments list
const DEPARTMENTS = [
  "AI&DS",
  "AIML",
  "BIO-TECH",
  "CIVIL",
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "MCT",
  "FOOT TECH",
  "IT",
  "TEXTILE",
  "VLSI",
  "CSBS",
  "MBA",
  "MCA"
];

const StudentProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        if (profileRes.profile.photo_url) {
          setPhotoPreview(profileRes.profile.photo_url);
        }
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
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

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setProfileData({ ...profileData, photo_url: '' });
  };

  const handleSaveProfile = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      setSaving(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        toast.error("Unable to save profile");
        return;
      }

      let photoUrl = profileData.photo_url || '';
      
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
            toast.success('Photo uploaded successfully!');
          }
        } catch (err: any) {
          console.error('Photo upload failed:', err);
          toast.error('Failed to upload photo: ' + (err.message || 'Unknown error'));
        }
      }

      // Update user name and email first
      if (profileData.name || profileData.email) {
        try {
          const token = auth.getToken();
          if (!token) {
            throw new Error('No authentication token found');
          }

          const updateUserRes = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${currentUser.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: profileData.name || undefined,
                email: profileData.email || undefined
              })
            }
          );

          if (!updateUserRes.ok) {
            const errorData = await updateUserRes.json().catch(() => ({ message: 'Failed to update user info' }));
            console.error('User update failed:', {
              status: updateUserRes.status,
              statusText: updateUserRes.statusText,
              error: errorData,
              userId: currentUser.id,
              requesterId: currentUser.id
            });
            
            if (updateUserRes.status === 403) {
              console.warn('User update forbidden (403) - This might be a permission issue. Continuing with profile update...');
              // Continue with profile update even if user update fails
            } else {
              throw new Error(errorData.message || `HTTP ${updateUserRes.status}: Failed to update user info`);
            }
          } else {
            const updateUserData = await updateUserRes.json();
            if (updateUserData.success) {
              // Update local user data
              const current = auth.getUser();
              if (current) {
                auth.setUser({
                  ...current,
                  name: profileData.name || current.name,
                  email: profileData.email || current.email
                });
              }
            }
          }
        } catch (err: any) {
          console.error('Failed to update user info:', err);
          // Continue with profile update even if user update fails
          toast.warning('Profile updated, but name/email update failed. Please try updating name/email separately.');
        }
      }

      // Prepare payload with all profile fields
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
        hosteller_dayscholar: profileData.hosteller_dayscholar || null,
        photo_url: photoUrl || null
      };
      
      const res = await api.updateStudentProfile(currentUser.id, payload);
      if (res.success) {
        toast.success('Profile updated successfully!');
        
        // Reload user data to get updated name/email
        try {
          const userRes = await api.getUser(currentUser.id);
          if (userRes.success && userRes.user) {
            const current = auth.getUser();
            if (current) {
              auth.setUser({
                ...current,
                name: userRes.user.name,
                email: userRes.user.email
              });
            }
          }
        } catch (e) {
          console.error('Failed to reload user data:', e);
        }
        
        try {
          // Reload profile to get updated data
          const profileRes = await api.getStudentProfile(currentUser.id);
          if (profileRes.success && profileRes.profile) {
            // Get updated user data
            const updatedUser = auth.getUser();
            const updatedProfile = {
              ...profileRes.profile,
              name: updatedUser?.name || profileData.name || '',
              email: updatedUser?.email || profileData.email || ''
            };
            setProfileData(updatedProfile);

            // Also persist latest photo URL into auth user so header avatar updates after login
            if (updatedProfile.photo_url) {
              const currentAuthUser = auth.getUser();
              if (currentAuthUser) {
              auth.setUser({ 
                  ...currentAuthUser,
                  photo_url: updatedProfile.photo_url
              });
              }
            }
            
              // Update photo preview after save
              if (updatedProfile.photo_url || photoUrl) {
                setPhotoPreview(updatedProfile.photo_url || photoUrl);
              }
            
            // Trigger dashboard reload by dispatching custom event
            window.dispatchEvent(new CustomEvent('profileUpdated'));
          } else {
            // If reload fails, keep current data
            setProfileData({
              ...profileData,
              photo_url: photoUrl
            });
          }
        } catch (e) {
          console.error('Failed to refresh profile after save', e);
          // On error, preserve current data
          setProfileData({
            ...profileData,
            photo_url: photoUrl
          });
        }
      } else {
        throw new Error(res.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error('Failed to save profile: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 bg-gradient-to-br from-background via-background to-muted/20 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8 animate-fade-in">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/student")} 
              className="gap-2 hover:bg-primary/10 hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-4 flex-1 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl p-4 border-2 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-slide-in drop-shadow-lg">
                  {profileData.name || 'My Profile'}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm md:text-base animate-fade-in-delay flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {profileData.email || 'Update your profile information'}
                </p>
              </div>
            </div>
          </div>

          <Card className="gradient-card border-2 border-primary/30 hover:shadow-2xl transition-all duration-500 animate-fade-in bg-white/90 backdrop-blur-md relative overflow-hidden group">
            {/* Decorative overlay - ignore pointer events so inputs below remain clickable */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <CardHeader className="bg-gradient-to-r from-primary/15 via-accent/15 to-primary/15 border-b-2 border-primary/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary pointer-events-none"></div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent text-center relative z-10 animate-slide-in drop-shadow-md">
                Profile Information
              </CardTitle>
              <CardDescription className="text-base mt-3 text-center relative z-10 animate-fade-in-delay text-muted-foreground/80">
                Fill in your profile details. Fields marked as required must be completed.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="text-center py-12">Loading profile...</div>
              ) : (
                <div className="space-y-6">
                  {/* Fixed Profile Fields - Centered */}
                  <div className="space-y-5">
                    {/* Row 1: Name, Mail Id, Register No */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="space-y-2 animate-slide-in-left group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Name</Label>
                        <Input 
                          value={profileData.name || ''} 
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your name"
                        />
                      </div>
                      <div className="space-y-2 animate-slide-in-right group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Mail Id</Label>
                        <Input 
                          type="email"
                          value={profileData.email || ''} 
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                          placeholder="Enter your email"
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Register No</Label>
                        <Input 
                          value={profileData.register_no || ''} 
                          onChange={(e) => setProfileData({ ...profileData, register_no: e.target.value })}
                          placeholder="Enter register number"
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                        />
                      </div>
                    </div>

                    {/* Row 2: Department, Year, Academic Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="space-y-2 animate-slide-in-left group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Department</Label>
                        <Select 
                          value={profileData.dept || ""} 
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, dept: val });
                          }}
                        >
                          <SelectTrigger className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                        <Label className="text-center block font-bold text-sm text-primary/80">Year</Label>
                        <Select 
                          value={profileData.year || ""} 
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, year: val });
                          }}
                        >
                          <SelectTrigger className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                      <div className="space-y-2 animate-slide-in-right group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Academic Year</Label>
                        <Input 
                          value={profileData.academic_year || ''} 
                          onChange={(e) => setProfileData({ ...profileData, academic_year: e.target.value })}
                          placeholder="e.g., 2024-2025"
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                        />
                      </div>
                    </div>

                    {/* Row 3: Phone Number, Father Number, DOB */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Phone Number</Label>
                        <Input 
                          type="tel"
                          value={profileData.phone || ''} 
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="Enter mobile number"
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Father Number</Label>
                        <Input 
                          type="tel"
                          value={profileData.father_number || ''} 
                          onChange={(e) => setProfileData({ ...profileData, father_number: e.target.value })}
                          placeholder="Enter father's number"
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text"
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">DOB</Label>
                        <Input 
                          type="date"
                          value={profileData.dob || ''} 
                          onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                          className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Row 4: Age, Gender, Blood Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Age</Label>
                        <Input 
                          value={age !== null ? `${age} years` : ''} 
                          disabled
                          className="bg-gradient-to-r from-muted/60 to-muted/40 text-center border-2 border-primary/20 font-semibold shadow-sm cursor-not-allowed"
                          placeholder="Auto-calculated from DOB"
                        />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Gender</Label>
                        <Select 
                          value={profileData.gender || ""} 
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, gender: val });
                          }}
                        >
                          <SelectTrigger className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                        <Label className="text-center block font-bold text-sm text-primary/80">Blood Group</Label>
                        <Select 
                          value={profileData.blood_group || ""} 
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, blood_group: val });
                          }}
                        >
                          <SelectTrigger className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="space-y-2 group">
                        <Label className="text-center block font-bold text-sm text-primary/80">Hosteller or Dayscholar</Label>
                        <Select 
                          value={profileData.hosteller_dayscholar || ""} 
                          onValueChange={(val) => {
                            setProfileData({ ...profileData, hosteller_dayscholar: val });
                          }}
                        >
                          <SelectTrigger className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-pointer w-full">
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
                      <Label className="text-center block font-bold text-sm text-primary/80">Address</Label>
                      <Textarea 
                        value={profileData.address || ''} 
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        placeholder="Enter address"
                        rows={4}
                        className="text-center border-2 border-primary/20 hover:border-primary/50 focus:border-primary transition-all duration-300 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-primary/20 cursor-text resize-y"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center pt-6 border-t-2 border-border/50 animate-fade-in-delay">
                    <Button 
                      variant="outline" 
                      onClick={() => loadProfile()}
                      disabled={saving}
                      className="px-6 h-11 hover:bg-muted hover:scale-105 transition-all duration-200 hover:shadow-md"
                    >
                      Reset
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleSaveProfile} 
                      disabled={saving} 
                      className="gap-2 px-8 h-11 bg-gradient-to-r from-primary via-accent to-primary hover:from-primary/90 hover:via-accent/90 hover:to-primary/90 text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                      <Save className="w-4 h-4 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                      <span className="relative z-10">{saving ? 'Saving...' : 'Save Profile'}</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StudentProfile;
