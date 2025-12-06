import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Settings as SettingsIcon, ArrowLeft, Key, Save, Lock, AlertCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

const Settings = () => {
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { permissions } = usePermissions();
  const [lastModified, setLastModified] = useState(new Date());
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Settings sections with permission control
  const settingsSections = {
    profileSettings: { label: 'Profile Settings', icon: '⚙️', canView: true, canEdit: true },
    systemInfo: { label: 'System Information', icon: '🏫', canView: true, canEdit: false },
    about: { label: 'About Section', icon: '📖', canView: true, canEdit: false },
    backup: { label: 'Backup & Restore', icon: '💾', canView: auth.hasRole('admin'), canEdit: auth.hasRole('admin') },
    versionManagement: { label: 'Version Management', icon: '📦', canView: auth.hasRole('admin'), canEdit: auth.hasRole('admin') },
    institutionDetails: { label: 'Institution Details', icon: '🏢', canView: true, canEdit: auth.hasRole('admin') }
  };

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

  const user = auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-primary">System Settings</h1>
                <p className="text-muted-foreground">Configure system preferences and permissions</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Profile Settings */}
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  Profile Settings
                </CardTitle>
                <CardDescription>
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={user?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={user?.role?.replace('_', ' ').toUpperCase() || ""} disabled />
                </div>
                <Button onClick={() => setShowChangePassword(true)} className="gap-2">
                  <Key className="w-4 h-4" />
                  Change Password
                </Button>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  Application details and version
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Application Name</span>
                  <span className="font-medium">SM Volunteers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Institution</span>
                  <span className="font-medium">K.S.Rangasamy College of Technology</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Developer</span>
                  <span className="font-medium">Narendhar D</span>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  SM Volunteers is a comprehensive volunteer management system for K.S.Rangasamy College of Technology.
                  The system helps manage volunteers, NGOs, meetings, attendance, reports, projects, and alumni.
                </p>
                <p className="text-muted-foreground mt-2">
                  <span className="text-accent font-semibold">Tagline:</span> 🕊 "Fostering Society."
                </p>
              </CardContent>
            </Card>
          </div>
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

      <Footer />
    </div>
  );
};

export default Settings;

