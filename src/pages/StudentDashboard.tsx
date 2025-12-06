import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Commitment Level UI removed
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import Sidebar from "@/components/Sidebar";
import { CalendarMonth, CalendarEvent } from "@/components/CalendarMonth";
import {
  Calendar, Clock, FileText, LogOut, Loader2, CheckCircle2, MessageSquare, 
  AlertCircle, Camera, Check, X, Settings, UserCircle, ClipboardCheck, 
  BookOpen, Download, Eye, Upload, Save, ArrowLeft, ChevronLeft, ChevronRight,
  Mail, Send, Star, StarIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { buildProfilePayload, mergeProfileWithCustom } from "@/utils/profileFields";

type StudentDashboardProps = {
  initialTab?: string;
};

const StudentDashboard = ({ initialTab }: StudentDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || "dashboard");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [odHistory, setOdHistory] = useState<any>(null);
  const [notifiedIds, setNotifiedIds] = useState<number[]>([]);
  const [profileFields, setProfileFields] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  // Commitment level state removed
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate("/login");
      return;
    }
    loadDashboardData();
    
    // Listen for profile update events
    const handleProfileUpdate = () => {
      console.log('Profile updated event received, reloading dashboard data...');
      loadDashboardData();
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (!profileFields.length || !profileData) return;
    setProfileData((prev: any) => {
      if (!prev) return prev;
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Load critical data first (profile) - this is needed for UI
      try {
        const profileRes = await api.getStudentProfile(currentUser.id);
        if (profileRes.success && profileRes.profile) {
          const { mergedProfile } = mergeProfileWithCustom(profileRes.profile);
          setProfileData(mergedProfile);
        } else {
          setProfileData({});
        }
      } catch (pfErr: any) {
        console.error('Error loading profile:', pfErr);
        setProfileData({});
      }

      // Load profile fields in background (non-blocking)
      api.getProfileFieldSettings()
        .then(fieldsRes => {
          if (fieldsRes.success) setProfileFields(fieldsRes.fields || []);
        })
        .catch((pfErr: any) => console.error('Error loading profile fields:', pfErr));

      // Set loading to false early so UI is responsive
      setLoading(false);

      // Load non-critical data in background (non-blocking)
      // This allows the page to be interactive while data loads
      Promise.allSettled([
        // Load projects
        (async () => {
          try {
            const projectsRes = await fetch(
              `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attendance/student/projects/${currentUser.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${auth.getToken()}`
                }
              }
            );
            const projectsData = await projectsRes.json();
            if (projectsData.success && projectsData.projects?.length > 0) {
              setProjects(projectsData.projects || []);
            } else {
              // Fallback to membership-based projects
              try {
                const membership = await api.getUserProjects(currentUser.id);
                if (membership.success && Array.isArray(membership.projects)) {
                  setProjects(membership.projects || []);
                }
              } catch (mErr) {
                console.error('Error loading membership projects:', mErr);
              }
            }
          } catch (projErr: any) {
            console.error('Error loading projects:', projErr);
            // Try fallback
            try {
              const membership = await api.getUserProjects(currentUser.id);
              if (membership.success && Array.isArray(membership.projects)) {
                setProjects(membership.projects || []);
              }
            } catch (mErr) {
              console.error('Error loading membership projects:', mErr);
            }
          }
        })(),

        // Load meetings
        fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/meetings`,
          {
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`
            }
          }
        )
        .then(r => r.json())
        .then(meetingsData => {
          if (meetingsData.success && meetingsData.meetings) {
            setMeetings(meetingsData.meetings || []);
          }
        })
        .catch((meetErr: any) => console.error('Error loading meetings:', meetErr)),

        // Load events (simplified - no multiple fallbacks)
        (async () => {
          try {
            const currentUserYear = (auth.getUser() as any)?.year || new Date().getFullYear().toString();
            const eventsRes = await api.getEvents(currentUserYear);
            if (eventsRes.success) {
              const allEvents = eventsRes.events || [];
              const currentUserId = currentUser.id;
              const filtered = allEvents.filter((ev: any) => {
                if (ev.student_status) return true;
                if (Array.isArray(ev.assigned_students) && ev.assigned_students.includes(currentUserId)) return true;
                return false;
              });
              setEvents(filtered);
            }
          } catch (evErr: any) {
            console.error('Error loading events:', evErr);
          }
        })(),

        // Load resources
        fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/resources`,
          {
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`
            }
          }
        )
        .then(r => r.json())
        .then(resourcesData => {
          if (resourcesData.success) {
            setResources(resourcesData.resources || []);
          }
        })
        .catch((resErr: any) => console.error('Error loading resources:', resErr)),

        // Load OD history
        api.getStudentODHistory(currentUser.id)
        .then(odHistoryRes => {
          if (odHistoryRes.success) {
            setOdHistory(odHistoryRes);
          }
        })
        .catch((odErr: any) => console.error('Error loading OD history:', odErr)),

        // Load my mentees (if user is a mentor)
        api.getMyMentees()
        .then(menteesRes => {
          if (menteesRes.success && menteesRes.mentees) {
            setMyMentees(menteesRes.mentees || []);
          } else {
            setMyMentees([]);
          }
        })
        .catch((menteesErr: any) => {
          // Silently fail - user might not be a mentor
          setMyMentees([]);
        })
      ]).catch(() => {
        // All errors are handled individually above
      });
    } catch (error: any) {
      console.error('Error in loadDashboardData:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meetings || meetings.length === 0) return;
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    const upcomingToday = meetings.filter((m) => {
      const key = new Date(m.date).toISOString().split("T")[0];
      return key === todayKey;
    });
    upcomingToday.forEach((m) => {
      if (!notifiedIds.includes(m.id)) {
        toast.info(`Meeting today: ${m.title} at ${new Date(m.date).toLocaleTimeString()}`);
        setNotifiedIds((ids) => [...ids, m.id]);
      }
    });
  }, [meetings]);

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleSendMessage = async () => {
    try {
      const user = auth.getUser() || { name: 'Anonymous', email: '' };
      
      // Save to localStorage (same as landing page contact form)
      const store = localStorage.getItem('admin_messages');
      const arr = store ? JSON.parse(store) : [];
      const msg = {
        id: Date.now(),
        name: user.name || user.email || 'Student',
        email: user.email || '',
        phone: '',
        subject: msgSubject || 'Message from student',
        message: msgText,
        created_at: new Date().toISOString(),
        read: false
      };
      arr.unshift(msg);
      localStorage.setItem('admin_messages', JSON.stringify(arr));
      
      // Trigger notification update
      window.dispatchEvent(new Event('adminMessage'));
      
      toast.success('Message sent to admin');
      setMsgText('');
      setMsgSubject('');
      setShowMsgModal(false);
    } catch (e: any) {
      console.error('Failed to send message', e);
      toast.error('Failed to send message: ' + (e.message || 'Unknown error'));
    }
  };

  // Commitment level handler removed

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

  const handleUploadPhoto = async () => {
    if (!photoFile) {
      toast.error('Please select a photo');
      return;
    }
    setUploadingPhoto(true);
    try {
      const currentUser = auth.getUser();
      if (!currentUser) return;

      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('userId', currentUser.id.toString());

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/upload-photo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          },
          body: fd
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success('Photo uploaded successfully! ✅');
        setProfileData({ ...profileData, photo_url: data.photo_url || photoPreview });
        setShowPhotoUpload(false);
        setPhotoFile(null);
        setPhotoPreview('');
        loadDashboardData();
        // update auth user so header/avatar updates across pages
        try {
          const current = auth.getUser();
          if (current) {
            auth.setUser({ ...current, photo: data.photo_url || photoPreview });
          }
        } catch (e) {
          console.error('Failed to update auth user photo', e);
        }
        // fetch authoritative profile from server and update local state/auth
        try {
          const profileRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${currentUser.id}/profile`, {
            headers: { Authorization: `Bearer ${auth.getToken()}` }
          });
          const profileJson = await profileRes.json();
          if (profileJson.success) {
            const prof = profileJson.profile;
            if (prof) {
              const { mergedProfile } = mergeProfileWithCustom(prof);
              setProfileData(mergedProfile);
            }
            const current = auth.getUser();
            if (current && prof) {
              auth.setUser({ ...current, photo: prof.photo_url || prof.photo || (data.photo_url || photoPreview) });
            }
          }
        } catch (err) {
          console.error('Failed to refresh profile after upload', err);
        }
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
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

      const payload = profileFields.length
        ? buildProfilePayload(profileFields, profileData || {}, { photo_url: photoUrl })
        : { ...profileData, photo_url: photoUrl };
      const res = await api.updateStudentProfile(currentUser.id, payload);
      if (res.success) {
        toast.success('Profile updated successfully!');
        loadDashboardData();
        // Refresh authoritative profile from server and update auth user
        try {
          const profileRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${currentUser.id}/profile`, {
            headers: { Authorization: `Bearer ${auth.getToken()}` }
          });
          const profileJson = await profileRes.json();
          if (profileJson.success) {
            const prof = profileJson.profile;
            if (prof) {
              const { mergedProfile } = mergeProfileWithCustom(prof);
              setProfileData(mergedProfile);
            }
            const current = auth.getUser();
            if (current && prof) {
              auth.setUser({ ...current, photo: prof.photo_url || prof.photo || photoUrl, name: prof.name || current.name });
            }
          } else {
            const current = auth.getUser();
            if (current) {
              const updated: any = { ...current };
              if (photoUrl) updated.photo = photoUrl;
              if ((profileData as any).name) updated.name = (profileData as any).name;
              auth.setUser(updated);
            }
          }
        } catch (e) {
          console.error('Failed to refresh profile after save', e);
        }
      } else {
        throw new Error(res.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error('Failed to save profile: ' + (err.message || 'Unknown error'));
    }
  };

  const calendarEvents: CalendarEvent[] = [
    ...meetings.map(m => ({ id: `meeting-${m.id}`, title: `📅 ${m.title}`, date: m.date })),
    ...events.map(e => ({ id: `event-${e.id}`, title: `🎉 ${e.title}`, date: e.date }))
  ];

  const handleCalendarPrev = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleCalendarNext = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const getDateWiseRecords = async (projectId: number) => {
    try {
      const currentUser = auth.getUser();
      if (!currentUser) return [];

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attendance/project/${projectId}/user/${currentUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`
          }
        }
      );

      const data = await res.json();
      if (data.success) {
        return data.records || [];
      }
      return [];
    } catch (err: any) {
      console.error('Error loading attendance:', err);
      return [];
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden lg:block sticky top-[73px] h-[calc(100vh-73px)] bg-white dark:bg-slate-900 shadow-sm">
          <Sidebar />
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Avatar key={profileData?.photo_url || auth.getUser()?.photo} className="w-14 h-14">
                    <AvatarImage src={(profileData && (profileData.photo_url || profileData.photo)) || auth.getUser()?.photo || '/Images/original logo.png'} />
                    <AvatarFallback>{((auth.getUser()?.name || '').split(' ').map(s => s[0]).slice(0,2).join('') || '?')}</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-violet bg-clip-text text-transparent mb-2">
                    Welcome, {auth.getUser()?.name || 'Student'}!
                  </h1>
                  <p className="text-muted-foreground text-lg">Manage your volunteer journey</p>
                </div>
              </div>

              {/* Settings button removed as requested */}
            </div>

            {/* Tabs Interface (tab bar removed; page fixed to Dashboard) */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground font-medium">My Profile</p>
                        <p className="text-2xl font-bold">{auth.getUser()?.name?.split(' ')[0] || 'Student'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                        <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground font-medium">Projects</p>
                        <p className="text-2xl font-bold">{projects.length}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-950">
                        <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground font-medium">Meetings</p>
                        <p className="text-2xl font-bold">{meetings.length}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-950">
                        <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground font-medium">OD Status</p>
                        <p className="text-2xl font-bold">{odHistory?.odCount || 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Calendar */}
                <div className="grid grid-cols-1 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Calendar & Commitment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                          <h3 className="font-semibold text-sm mb-3">📅 This Month</h3>
                          <CalendarMonth
                            month={new Date().getMonth()}
                            year={new Date().getFullYear()}
                            events={calendarEvents}
                            showHeader={false}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Attendance Summary */}
                {projects.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>📊 Attendance Summary</CardTitle>
                      <CardDescription>Your attendance across all projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {projects.map((project) => (
                          <div key={project.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <p className="font-semibold text-sm mb-3">{project.title}</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-green-600">✅ Present</span>
                                <span className="font-bold">{project.present_count || 0}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-red-600">❌ Absent</span>
                                <span className="font-bold">{project.absent_count || 0}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-yellow-600">⏱️ Late</span>
                                <span className="font-bold">{project.late_count || 0}</span>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Total: {project.total_records || 0} records</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Calendar Tab */}
              <TabsContent value="calendar" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>📅 Calendar</CardTitle>
                        <CardDescription>View meetings and events</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleCalendarPrev}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setCalendarMonth(new Date().getMonth());
                          setCalendarYear(new Date().getFullYear());
                        }}>
                          Today
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCalendarNext}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CalendarMonth
                      month={calendarMonth}
                      year={calendarYear}
                      events={calendarEvents}
                      onDayClick={(iso) => setSelectedDate(iso)}
                    />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Meetings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {meetings.length > 0 ? (
                        <div className="space-y-2">
                          {meetings.map((m) => (
                            <div key={m.id} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                              <p className="font-medium text-sm">{m.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                📍 {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {m.location && <p className="text-xs text-muted-foreground">📍 {m.location}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No meetings</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {events.length > 0 ? (
                        <div className="space-y-2">
                          {events.map((ev) => (
                            <div key={ev.id} className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{ev.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    📅 {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                </div>
                                {ev.student_status && (
                                  <Badge className={ev.student_status === 'od' ? 'bg-green-500' : 'bg-red-500'}>
                                    {ev.student_status.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No events</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>📊 Attendance Tracking</CardTitle>
                    <CardDescription>View and manage your attendance records</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {projects.length > 0 ? (
                      <div className="space-y-4">
                        {projects.map((project) => (
                          <Card key={project.id} className="border">
                            <CardHeader>
                              <CardTitle className="text-lg">{project.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex gap-2 mb-4">
                                <Badge className="bg-green-500">{project.present_count || 0} Present</Badge>
                                <Badge className="bg-red-500">{project.absent_count || 0} Absent</Badge>
                                <Badge className="bg-yellow-500">{project.late_count || 0} Late</Badge>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate("/student/attendance")}
                              >
                                View Details
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No projects assigned yet</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Resources Tab */}
              <TabsContent value="resources" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>📚 Learning Resources</CardTitle>
                    <CardDescription>Access documents and materials</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : resources.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resources.map((resource) => (
                          <Card key={resource.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                {resource.title || resource.original_name || 'Untitled'}
                              </CardTitle>
                              <CardDescription>{resource.category || resource.resource_type || 'Document'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => window.open(resource.url, '_blank')}
                                  className="w-full gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No resources available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-6 animate-fade-in">
                {/* View Replies Section */}
                <Card className="gradient-card border-border/50 hover:shadow-lg transition-all">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-primary" />
                      Message Replies
                    </CardTitle>
                    <CardDescription>View replies from administrators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const user = auth.getUser();
                      if (!user || !user.email) return <p className="text-muted-foreground">No user found</p>;
                      
                      try {
                        const repliesJson = localStorage.getItem('message_replies');
                        const replies = repliesJson ? JSON.parse(repliesJson) : [];
                        const userReplies = replies.filter((r: any) => r.email === user.email);
                        
                        if (userReplies.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>No replies yet</p>
                              <p className="text-sm mt-2">You'll see replies to your messages here</p>
                            </div>
                          );
                        }
                        
                        // Mark as read when viewing
                        const updatedReplies = replies.map((r: any) => 
                          r.email === user.email ? { ...r, read: true } : r
                        );
                        localStorage.setItem('message_replies', JSON.stringify(updatedReplies));
                        window.dispatchEvent(new Event('messageReply'));
                        
                        return (
                          <div className="space-y-4">
                            {userReplies.reverse().map((reply: any) => (
                              <Card key={reply.id} className={`border-l-4 ${!reply.read ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300'}`}>
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="font-semibold">{reply.replied_by || 'Admin'}</div>
                                        {!reply.read && (
                                          <Badge className="bg-blue-500 text-white text-xs">New</Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground mb-2">
                                        {reply.replied_at ? new Date(reply.replied_at).toLocaleString() : 'Unknown date'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mb-3">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Your Message:</div>
                                    <div className="p-3 bg-muted rounded-lg text-sm">{reply.original_message || 'No original message'}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-primary mb-1">Reply:</div>
                                    <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-lg text-sm">{reply.reply}</div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        );
                      } catch (e) {
                        return <p className="text-destructive">Error loading replies</p>;
                      }
                    })()}
                  </CardContent>
                </Card>

                {/* Send Message Section */}
                <Card className="gradient-card border-border/50 hover:shadow-lg transition-all">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-accent" />
                      Send Message to Admin
                    </CardTitle>
                    <CardDescription>Contact the administrators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Subject (optional)</Label>
                        <Input 
                          placeholder="Enter subject" 
                          value={msgSubject} 
                          onChange={(e) => setMsgSubject(e.target.value)} 
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Message *</Label>
                        <Textarea 
                          placeholder="Write your message here..." 
                          value={msgText} 
                          onChange={(e) => setMsgText(e.target.value)} 
                          rows={6}
                          className="mt-2"
                        />
                      </div>
                      <Button onClick={handleSendMessage} disabled={!msgText.trim()} className="gap-2 bg-primary hover:bg-primary/90">
                        <Send className="w-4 h-4" />
                        Send Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Feedback Tab */}
              <TabsContent value="feedback" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>💬 Feedback</CardTitle>
                    <CardDescription>Share your feedback and help us improve</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Provide feedback on events, meetings, and your overall experience.
                      </p>
                      <Button onClick={() => navigate("/student/feedback")} className="gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Go to Feedback Page
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>⚙️ Settings</CardTitle>
                    <CardDescription>Manage your preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-sm text-muted-foreground">No settings available.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Photo Upload Modal */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Profile Photo</DialogTitle>
            <DialogDescription>Upload a new profile photo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-full object-cover border-2 border-primary" />
              ) : (
                <Avatar key={profileData?.photo_url} className="w-32 h-32">
                  <AvatarImage src={profileData?.photo_url || '/Images/original logo.png'} />
                  <AvatarFallback>{((auth.getUser()?.name || '').split(' ').map(s => s[0]).slice(0,2).join('') || '?')}</AvatarFallback>
                </Avatar>
              )}
            </div>
            <div>
              <Label htmlFor="photo-input">Choose Image</Label>
              <Input
                id="photo-input"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Max 5MB, JPG/PNG/GIF</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => {
                setShowPhotoUpload(false);
                setPhotoFile(null);
                setPhotoPreview('');
              }}>Cancel</Button>
              <Button 
                onClick={handleUploadPhoto}
                disabled={!photoFile || uploadingPhoto}
                className="gap-2"
              >
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploadingPhoto ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default StudentDashboard;
