import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Settings as SettingsIcon, ArrowLeft, Key, Save, Lock, AlertCircle, Clock, Eye, EyeOff, Edit3, Settings2, Moon, Sun } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface SettingsSection {
  label: string;
  icon: string;
  description: string;
  canView: boolean;
  canEdit: boolean;
}

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [availabilityHours, setAvailabilityHours] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('ob_availability_hours');
      return stored ? JSON.parse(stored) : [40];
    } catch {
      return [40];
    }
  });
  const { permissions } = usePermissions();
  const [lastModified] = useState(() => ({
    user: 'Admin User',
    date: new Date(),
    action: 'System initialization'
  }));

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Mentor Management Settings
  const [mentorSettings, setMentorSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('mentor_management_settings');
      return stored ? JSON.parse(stored) : {
        enableImage: true,
        enableVoice: true,
        showTotalCalls: true
      };
    } catch {
      return {
        enableImage: true,
        enableVoice: true,
        showTotalCalls: true
      };
    }
  });

  // Theme state
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored || 'light';
  });

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
    toast.success(`Switched to ${theme === 'light' ? 'dark' : 'light'} mode`);
  };

  const user = auth.getUser();
  const isAdmin = auth.hasRole('admin');

  // Determine which dashboard to go back to based on role
  const dashboardPath =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'office_bearer'
        ? '/office-bearer'
        : user?.role === 'student'
          ? '/student'
          : '/';

  const pageTitle = isAdmin ? "System Settings" : "Settings";
  const pageSubtitle = isAdmin
    ? "Configure system preferences and permissions"
    : "Manage your account settings and preferences";

  const handleMentorSettingsSave = () => {
    try {
      localStorage.setItem('mentor_management_settings', JSON.stringify(mentorSettings));
      toast.success('Mentor management settings saved successfully!');
      // Dispatch event to notify MentorManagement page
      window.dispatchEvent(new CustomEvent('mentorSettingsUpdated', { detail: mentorSettings }));
    } catch (e) {
      console.error(e);
      toast.error("Failed to save mentor management settings");
    }
  };

  const handleAvailabilitySave = () => {
    try {
      // Persist to backend profile custom_fields so availability reflects for Office Bearer logins
      if (user && user.id) {
        // read existing custom_fields from profile and merge
        (async () => {
          try {
            const res = await api.getProfile(user.id);
            if (res && res.success) {
              const profile = res.profile || {};
              let custom = {};
              try { custom = profile.custom_fields ? JSON.parse(profile.custom_fields) : {}; } catch (e) { custom = {}; }
              (custom as any).ob_availability_hours = availabilityHours;
              const update = await api.updateProfile(user.id, { custom_fields: JSON.stringify(custom) });
              if (update && update.success) {
                toast.success('Availability updated successfully!');
                localStorage.setItem('ob_availability_hours', JSON.stringify(availabilityHours));
              } else {
                throw new Error(update.message || 'Failed to save');
              }
            } else {
              throw new Error(res.message || 'Failed to fetch profile');
            }
          } catch (e: any) {
            console.error('Failed to save availability to backend:', e);
            toast.error('Failed to save availability: ' + (e.message || e));
          }
        })();
      } else {
        // fallback to localStorage for non-logged-in or missing user
        localStorage.setItem('ob_availability_hours', JSON.stringify(availabilityHours));
        toast.success('Availability updated locally');
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save availability");
    }
  };

  useEffect(() => {
    // Load availability from backend profile if office bearer
    (async () => {
      if (user && user.role === 'office_bearer' && user.id) {
        try {
          const res = await api.getProfile(user.id);
          if (res && res.success && res.profile) {
            const profile = res.profile;
            let custom = {};
            try { custom = profile.custom_fields ? JSON.parse(profile.custom_fields) : {}; } catch (e) { custom = {}; }
            if ((custom as any).ob_availability_hours) {
              const v = (custom as any).ob_availability_hours;
              setAvailabilityHours(Array.isArray(v) ? v : [v]);
            }
          }
        } catch (e) {
          // ignore - keep local value
        }
      }
    })();
  }, [user]);

  // Settings sections with role-based permission control
  const settingsSections: Record<string, SettingsSection> = {
    profileSettings: {
      label: 'Profile Settings',
      icon: '⚙️',
      description: 'Manage your account settings',
      canView: true,
      canEdit: true
    },
    systemInfo: {
      label: 'System Information',
      icon: '🏫',
      description: 'Application details and version',
      canView: true,
      canEdit: false
    },
    about: {
      label: 'About Section',
      icon: '📖',
      description: 'Information about SM Volunteers',
      canView: true,
      canEdit: false
    },
    backup: {
      label: 'Backup & Restore',
      icon: '💾',
      description: 'Manage data backups and restoration',
      canView: isAdmin,
      canEdit: isAdmin
    },
    versionManagement: {
      label: 'Version Management',
      icon: '📦',
      description: 'Manage application versions',
      canView: isAdmin,
      canEdit: isAdmin
    },
    institutionDetails: {
      label: 'Institution Details',
      icon: '🏢',
      description: 'Update institution information',
      canView: true,
      canEdit: isAdmin
    },
    mentorManagement: {
      label: 'Mentor Management Settings',
      icon: '👥',
      description: 'Configure mentor management display options',
      canView: isAdmin,
      canEdit: isAdmin
    }
  };

  const allowedSections = Object.entries(settingsSections).filter(([_, section]) => section.canView);
  const restrictedSections = Object.entries(settingsSections).filter(([_, section]) => !section.canView);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 5) {
      toast.error("Password must be at least 5 characters");
      return;
    }

    try {
      const response = await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
      if (response.success) {
        toast.success("Password changed successfully!");
        setShowChangePassword(false);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (error: any) {
      toast.error("Failed to change password: " + error.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />

      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-transparent">
          <div className="max-w-5xl mx-auto">
            {/* Back Button */}
            <div className="mb-4">
              <BackButton to={dashboardPath} />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-primary">{pageTitle}</h1>
                <p className="text-muted-foreground">{pageSubtitle}</p>
              </div>
            </div>

            {/* Admin Notice */}
            {isAdmin && (
              <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">System Admin Note</p>
                    <p className="text-sm text-muted-foreground">
                      Permissions are controlled via <Button
                        variant="link"
                        className="p-0 h-auto text-sm underline"
                        onClick={() => navigate("/manage-permissions")}
                      >
                        Manage Permissions → System Settings Access
                      </Button>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Role & Access Summary */}
            <Card className="mb-6 gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Role Access Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-sm text-muted-foreground">Current Role</p>
                    <p className="text-lg font-semibold text-primary capitalize">
                      {user?.role?.replace('_', ' ') || 'Unknown'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <p className="text-sm text-muted-foreground">Allowed Modules</p>
                    <p className="text-lg font-semibold text-green-600">{allowedSections.length} of {Object.keys(settingsSections).length}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-sm text-muted-foreground">Restricted Modules</p>
                    <p className="text-lg font-semibold text-red-600">{restrictedSections.length} modules</p>
                  </div>
                </div>

                {allowedSections.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Accessible Settings:</p>
                    <div className="flex flex-wrap gap-2">
                      {allowedSections.map(([key, section]) => (
                        <Badge key={key} variant="outline" className="flex items-center gap-1">
                          {section.icon} {section.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {restrictedSections.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Restricted Settings:</p>
                    <div className="flex flex-wrap gap-2">
                      {restrictedSections.map(([key, section]) => (
                        <Badge key={key} variant="outline" className="flex items-center gap-1 opacity-50">
                          <Lock className="w-3 h-3" /> {section.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Sections */}
            <div className="grid gap-6">
              {/* Profile Settings */}
              {settingsSections.profileSettings.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>⚙️</span> Profile Settings
                        </CardTitle>
                        <CardDescription>Manage your account settings</CardDescription>
                      </div>
                      {settingsSections.profileSettings.canEdit ? (
                        <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={user?.name || ""} disabled className={settingsSections.profileSettings.canEdit ? "" : "opacity-60"} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={user?.email || ""} disabled className={settingsSections.profileSettings.canEdit ? "" : "opacity-60"} />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input value={user?.role?.replace('_', ' ').toUpperCase() || ""} disabled className={settingsSections.profileSettings.canEdit ? "" : "opacity-60"} />
                    </div>
                    <Button onClick={() => setShowChangePassword(true)} className="gap-2">
                      <Key className="w-4 h-4" />
                      Change Password
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Theme Settings */}
              <Card className="gradient-card border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        Theme Settings
                      </CardTitle>
                      <CardDescription>Choose your preferred color theme</CardDescription>
                    </div>
                    <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-accent/5">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-primary" />
                      ) : (
                        <Sun className="w-5 h-5 text-primary" />
                      )}
                      <div>
                        <p className="font-medium">Current Theme</p>
                        <p className="text-sm text-muted-foreground capitalize">{theme} Mode</p>
                      </div>
                    </div>
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={toggleTheme}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setTheme('light');
                        toast.success('Switched to light mode');
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${theme === 'light'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <Sun className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">Light</p>
                    </button>
                    <button
                      onClick={() => {
                        setTheme('dark');
                        toast.success('Switched to dark mode');
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${theme === 'dark'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <Moon className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">Dark</p>
                    </button>
                  </div>
                </CardContent>
              </Card>


              {/* System Information */}
              {settingsSections.systemInfo.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>🏫</span> System Information
                        </CardTitle>
                        <CardDescription>Application details and version</CardDescription>
                      </div>
                      {settingsSections.systemInfo.canEdit ? (
                        <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Application Name</span>
                      <span className="font-medium">SM Volunteers</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Institution</span>
                      <span className="font-medium">K.S.Rangasamy College of Technology</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-medium">1.0.0</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Developer</span>
                      <span className="font-medium">Narendhar D</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* About */}
              {settingsSections.about.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>📖</span> About
                        </CardTitle>
                        <CardDescription>Information about SM Volunteers</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      SM Volunteers is a comprehensive volunteer management system for K.S.Rangasamy College of Technology.
                      The system helps manage volunteers, NGOs, meetings, attendance, reports, and projects.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      <span className="text-accent font-semibold">Tagline:</span> 🕊 "Fostering Society."
                    </p>
                    <div className="pt-2 mt-4 border-t border-border/30">
                      <p className="text-xs text-muted-foreground">
                        This application is designed to streamline volunteer coordination and community engagement initiatives.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Backup & Restore */}
              {settingsSections.backup.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>💾</span> Backup & Restore
                        </CardTitle>
                        <CardDescription>Manage data backups and restoration</CardDescription>
                      </div>
                      {settingsSections.backup.canEdit ? (
                        <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Last Backup</p>
                      <p className="font-medium">12/11/2025, 02:30 AM</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" disabled={!settingsSections.backup.canEdit}>
                        <span>⬇️</span> Create Backup
                      </Button>
                      <Button variant="outline" className="gap-2" disabled={!settingsSections.backup.canEdit}>
                        <span>⬆️</span> Restore Backup
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Version Management */}
              {settingsSections.versionManagement.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>📦</span> Version Management
                        </CardTitle>
                        <CardDescription>Manage application versions</CardDescription>
                      </div>
                      {settingsSections.versionManagement.canEdit ? (
                        <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Current Version</span>
                      <Badge>1.0.0</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Latest Available</span>
                      <Badge variant="outline">1.0.0</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground">Release Date</span>
                      <span className="font-medium text-sm">November 12, 2025</span>
                    </div>
                    <Button variant="outline" className="w-full gap-2" disabled={!settingsSections.versionManagement.canEdit || true}>
                      <span>🔄</span> Check for Updates
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Institution Details */}
              {settingsSections.institutionDetails.canView && (
                <Card className="gradient-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>🏢</span> Institution Details
                        </CardTitle>
                        <CardDescription>Update institution information</CardDescription>
                      </div>
                      {settingsSections.institutionDetails.canEdit ? (
                        <Badge className="gap-1"><Edit3 className="w-3 h-4" /> Editable</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> View Only</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Institution Name</Label>
                      <Input
                        value="K.S.Rangasamy College of Technology"
                        disabled
                        className={settingsSections.institutionDetails.canEdit ? "" : "opacity-60"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Institution Code</Label>
                      <Input
                        value="KSRCT-2025"
                        disabled
                        className={settingsSections.institutionDetails.canEdit ? "" : "opacity-60"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value="Namakkal, Tamil Nadu"
                        disabled
                        className={settingsSections.institutionDetails.canEdit ? "" : "opacity-60"}
                      />
                    </div>
                    <Button
                      disabled={!settingsSections.institutionDetails.canEdit}
                      className="gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      Edit Institution Details
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Availability Hours Slider (Office Bearer only) */}
            {user?.role === 'office_bearer' && location.pathname.includes('/settings') && (
              <Card className="gradient-card border-border/50 mt-8">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>⏰</span> Weekly Availability
                      </CardTitle>
                      <CardDescription>Set your available hours per week for volunteering</CardDescription>
                    </div>
                    <Badge className="gap-1"><Edit3 className="w-3 h-3" /> Editable</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="mb-2 block">Hours per week: {availabilityHours[0]}</Label>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round((availabilityHours[0] / 168) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0 hrs</span>
                        <span>84 hrs</span>
                        <span>168 hrs</span>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleAvailabilitySave} className="gap-2">
                    <Save className="w-4 h-4" />
                    Save Availability
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Activity Log Footer */}
            <Card className="mt-8 bg-muted/30 border-muted/50">
              <CardContent className="pt-6 flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Last modified by:</span>
                  <span className="font-semibold ml-1">{lastModified.user}</span>
                  <span className="text-muted-foreground"> on {lastModified.date.toLocaleDateString()}, {lastModified.date.toLocaleTimeString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your account password
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={5}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="w-4 h-4" />
                Save Password
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Settings;
