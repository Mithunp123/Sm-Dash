import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Key, Save, Moon, Sun, Download, Upload, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Theme state
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored || 'dark';
  });

  // College name state
  const [collegeName, setCollegeName] = useState("K.S.Rangasamy College of Technology");

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

  // Determine which dashboard to go back to based on role
  const dashboardPath =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'office_bearer'
        ? '/office-bearer'
        : user?.role === 'student'
          ? '/student'
          : '/';

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

  const handleBackup = async () => {
    try {
      const response = await api.exportBackup();
      if (response.success && response.backup) {
        const dataStr = JSON.stringify(response.backup, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `sm_volunteers_backup_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        toast.success("Backup downloaded successfully!");
      } else {
        toast.error("Failed to export backup: " + response.message);
      }
    } catch (error: any) {
      toast.error("Error creating backup: " + error.message);
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event: any) => {
        try {
          const backupData = JSON.parse(event.target.result);
          if (!backupData.data) {
            toast.error("Invalid backup file format");
            return;
          }

          if (!window.confirm("Are you sure you want to restore? This will merge data from the backup into your existing database. Duplicate records will be skipped.")) {
            return;
          }

          toast.loading("Restoring data...", { id: 'restore' });
          const response = await api.restoreBackup(backupData);
          if (response.success) {
            toast.success("Database restored successfully!", { id: 'restore' });
            // Optionally reload page to reflect changes
            setTimeout(() => window.location.reload(), 2000);
          } else {
            toast.error("Restore failed: " + response.message, { id: 'restore' });
          }
        } catch (err) {
          toast.error("Error parsing backup file", { id: 'restore' });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSaveCollege = () => {
    localStorage.setItem('college_name', collegeName);
    toast.success("College name saved successfully!");
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      <DeveloperCredit />

      <div className="w-full flex-1">
        <div className="w-full p-4 md:p-8">
          {/* Back Button */}
          <div className="mb-6">

          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle mt-2">Manage your account settings and preferences</p>
          </div>

          {/* Settings Sections */}
          <div className="grid gap-6">
            {/* Profile Information */}
            <Card className="border-border/40 bg-card shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="text-foreground">Profile Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Name</Label>
                  <Input
                    value={user?.name || ""}
                    disabled
                    className="h-10 rounded-md bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Role</Label>
                  <Input
                    value={user?.role?.replace('_', ' ').toUpperCase() || ""}
                    disabled
                    className="h-10 rounded-md bg-muted text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">College</Label>
                  <div className="flex gap-2">
                    <Input
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="h-10 rounded-md"
                      placeholder="Enter college name"
                    />
                    <Button
                      onClick={handleSaveCollege}
                      className="h-10 rounded-md font-semibold text-sm px-4 gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="border-border/40 bg-card shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="text-foreground">Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowChangePassword(true)}
                  className="gap-2 h-10 rounded-md font-semibold text-sm px-4"
                >
                  <Key className="w-4 h-4" />
                  Change Password
                </Button>
              </CardContent>
            </Card>

            {/* Backup & Restore */}
            <Card className="border-border/40 bg-card shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="text-foreground">Backup & Restore</CardTitle>
                <CardDescription>Manage data backups and restoration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    onClick={handleBackup}
                    variant="outline"
                    className="gap-2 h-10 rounded-md font-semibold text-sm px-4 flex-1"
                  >
                    <Download className="w-4 h-4" />
                    Create Backup
                  </Button>
                  <Button
                    onClick={handleRestore}
                    variant="outline"
                    className="gap-2 h-10 rounded-md font-semibold text-sm px-4 flex-1"
                  >
                    <Upload className="w-4 h-4" />
                    Restore Backup
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Theme Settings */}
            <Card className="border-border/40 bg-card shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="text-foreground">Theme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="w-5 h-5 text-primary" />
                    ) : (
                      <Sun className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">Current Theme</p>
                      <p className="text-sm text-muted-foreground capitalize">{theme} Mode</p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setTheme('light');
                      toast.success('Switched to light mode');
                    }}
                    className={`p-4 rounded-md border-2 transition-all ${theme === 'light'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <Sun className="w-6 h-6 mx-auto mb-2 text-foreground" />
                    <p className="text-sm font-medium text-foreground">Light</p>
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      toast.success('Switched to dark mode');
                    }}
                    className={`p-4 rounded-md border-2 transition-all ${theme === 'dark'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <Moon className="w-6 h-6 mx-auto mb-2 text-foreground" />
                    <p className="text-sm font-medium text-foreground">Dark</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
              <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
                className="h-10 rounded-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={5}
                className="h-10 rounded-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={5}
                className="h-10 rounded-md"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChangePassword(false)}
                className="h-10 rounded-md font-semibold text-sm px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-md font-semibold text-sm px-4 gap-2"
              >
                <Save className="w-4 h-4" />
                Save Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
