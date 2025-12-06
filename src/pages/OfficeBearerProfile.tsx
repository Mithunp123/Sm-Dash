import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft, Save, Upload, X, Camera, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const OfficeBearerProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileFields, setProfileFields] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

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

      // Load profile fields
      const fieldsRes = await api.getProfileFieldSettings();
      if (fieldsRes.success) {
        setProfileFields(fieldsRes.fields || []);
      }

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
        setProfileData(data.profile);
        // Load existing photo if available
        if (data.profile.photo_url) {
          setPhotoPreview(data.profile.photo_url);
        }
      } else {
        // Initialize empty profile data
        const initialized: any = {};
        if (fieldsRes.success) {
          fieldsRes.fields.forEach((f: any) => {
            initialized[f.field_name] = '';
          });
        }
        setProfileData(initialized);
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
            toast.success('Photo uploaded successfully!');
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate("/office-bearer")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>

          <Card className="gradient-card border-border/50 hover:shadow-xl transition-all animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                My Profile
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Update your profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin">Loading...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Photo Upload Section */}
                  <div className="space-y-4 p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border-2 border-blue-200/50 shadow-sm hover:shadow-md transition-all animate-fade-in">
                    <Label className="text-lg font-bold flex items-center gap-2">
                      <Camera className="w-5 h-5 text-primary" />
                      Profile Photo
                    </Label>
                    <div className="flex items-start gap-6">
                      {/* Photo Preview */}
                      <div className="flex-shrink-0">
                        <div className="w-36 h-36 rounded-xl border-2 border-dashed border-blue-300 bg-white flex items-center justify-center overflow-hidden shadow-md hover:shadow-lg transition-shadow group">
                          {photoPreview ? (
                            <img 
                              src={photoPreview} 
                              alt="Profile preview" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="text-center py-8 animate-fade-in">
                              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2 group-hover:text-primary transition-colors" />
                              <p className="text-sm text-muted-foreground font-medium">No photo</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <Label htmlFor="photo-upload" className="text-sm font-semibold mb-2 block">
                            Choose a photo to upload
                          </Label>
                          <Input
                            id="photo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            disabled={saving}
                            className="mt-2 cursor-pointer h-10 border-2 border-blue-300 hover:border-primary transition-colors"
                          />
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Supported formats: JPG, PNG, GIF. Max size: 5MB
                          </p>
                        </div>
                        
                        {photoPreview && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleRemovePhoto}
                            disabled={saving}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Remove Photo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {profileFields.length === 0 ? (
                    <p className="text-muted-foreground">No profile fields configured.</p>
                  ) : (
                    profileFields.map((field: any) => {
                      // Only show visible fields
                      if (!field.visible) return null;

                      const value = profileData[field.field_name] || '';
                      const isEditable = field.editable_by_student || false;

                      // Render based on field type
                      if (field.field_type === 'textarea') {
                        return (
                          <div key={field.field_name} className="space-y-2 animate-fade-in">
                            <Label htmlFor={field.field_name} className="font-semibold">{field.label}</Label>
                            <textarea
                              id={field.field_name}
                              value={value}
                              onChange={(e) => setProfileData({ ...profileData, [field.field_name]: e.target.value })}
                              disabled={!isEditable}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              className="w-full min-h-24 px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                        );
                      } else if (field.field_name === 'year') {
                        return (
                          <div key={field.field_name} className="space-y-2 animate-fade-in">
                            <Label htmlFor={field.field_name} className="font-semibold">{field.label}</Label>
                            <Select value={value} onValueChange={(val) => setProfileData({ ...profileData, [field.field_name]: val })} disabled={!isEditable}>
                              <SelectTrigger disabled={!isEditable} className="h-11 border-2 focus:ring-2 focus:ring-primary">
                                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="I">I Year</SelectItem>
                                <SelectItem value="II">II Year</SelectItem>
                                <SelectItem value="III">III Year</SelectItem>
                                <SelectItem value="IV">IV Year</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      } else if (field.field_name === 'gender') {
                        return (
                          <div key={field.field_name} className="space-y-2">
                            <Label htmlFor={field.field_name}>{field.label}</Label>
                            <Select value={value} onValueChange={(val) => setProfileData({ ...profileData, [field.field_name]: val })} disabled={!isEditable}>
                              <SelectTrigger disabled={!isEditable}>
                                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      } else if (field.field_name === 'blood_group') {
                        return (
                          <div key={field.field_name} className="space-y-2">
                            <Label htmlFor={field.field_name}>{field.label}</Label>
                            <Select value={value} onValueChange={(val) => setProfileData({ ...profileData, [field.field_name]: val })} disabled={!isEditable}>
                              <SelectTrigger disabled={!isEditable}>
                                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
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
                        );
                      } else if (field.field_type === 'date') {
                        return (
                          <div key={field.field_name} className="space-y-2">
                            <Label htmlFor={field.field_name}>{field.label}</Label>
                            <Input
                              id={field.field_name}
                              type="date"
                              value={value}
                              onChange={(e) => setProfileData({ ...profileData, [field.field_name]: e.target.value })}
                              disabled={!isEditable}
                            />
                          </div>
                        );
                      } else if (field.field_type === 'number') {
                        return (
                          <div key={field.field_name} className="space-y-2">
                            <Label htmlFor={field.field_name}>{field.label}</Label>
                            <Input
                              id={field.field_name}
                              type="number"
                              value={value}
                              onChange={(e) => setProfileData({ ...profileData, [field.field_name]: e.target.value })}
                              disabled={!isEditable}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          </div>
                        );
                      } else {
                        return (
                          <div key={field.field_name} className="space-y-2 animate-fade-in">
                            <Label htmlFor={field.field_name} className="font-semibold">{field.label}</Label>
                            <Input
                              id={field.field_name}
                              type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : field.field_type === 'date' ? 'date' : 'text'}
                              value={value}
                              onChange={(e) => setProfileData({ ...profileData, [field.field_name]: e.target.value })}
                              disabled={!isEditable}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              className="h-11 border-2 focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                        );
                      }
                    })
                  )}

                  <div className="flex gap-3 justify-end pt-6 border-t-2 border-border/50">
                    <Button 
                      variant="outline" 
                      onClick={() => loadProfile()} 
                      disabled={saving}
                      className="px-6 h-11 hover:bg-muted transition-all"
                    >
                      Reset
                    </Button>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={saving} 
                      className="gap-2 px-8 h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Profile'}
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

export default OfficeBearerProfile;
