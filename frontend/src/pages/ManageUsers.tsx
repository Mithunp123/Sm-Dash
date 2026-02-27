import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Users, Plus, ArrowLeft, Key, Search, Filter, Edit, Trash2, Upload, RefreshCw } from "lucide-react";
import * as XLSX from 'xlsx';
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { BulkUploadModal } from "@/components/BulkUploadModal";

const ManageUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [importedUsers, setImportedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "student",
    password: ""
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const { permissions, loading: permissionsLoading } = usePermissions();
  const userIsAdmin = auth.hasRole('admin');
  // Only admins can edit
  const canEdit = userIsAdmin;
  // Only admins may view
  const canView = userIsAdmin;

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    if (!canView) {
      toast.error("Access denied. Management access required.");
      const userRole = auth.getRole();
      navigate(userRole === 'office_bearer' ? "/office-bearer" : "/login");
      return;
    }

    loadUsers();
  }, [permissionsLoading, permissions, canView]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      if (response.success) {
        setUsers(response.users || []);
      }
    } catch (error: any) {
      toast.error("Failed to load users: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };

      // If password is provided, include it
      if (formData.password && formData.password.trim() !== "") {
        userData.password = formData.password;
      }

      const response = await api.addUser(userData);
      if (response.success) {
        toast.success("User created successfully!");
        if (response.defaultPassword) {
          toast.info(`Default password: ${response.defaultPassword}`);
        }

        setShowAddDialog(false);
        setFormData({ name: "", email: "", role: "student", password: "" });
        loadUsers();
      }
    } catch (error: any) {
      toast.error("Failed to create user: " + error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      const response = await api.resetUserPassword(selectedUser.id);
      if (response.success) {
        toast.success("Password reset successfully!");
        if (response.defaultPassword) {
          toast.info(`New password: ${response.defaultPassword}`);
        }
        setShowResetDialog(false);
        setSelectedUser(null);
        loadUsers();
      }
    } catch (error: any) {
      toast.error("Failed to reset password: " + error.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("User updated successfully!");
        setShowEditDialog(false);
        setSelectedUser(null);
        setFormData({ name: "", email: "", role: "student", password: "" });
        loadUsers();
      } else {
        throw new Error(data.message || 'Failed to update user');
      }
    } catch (error: any) {
      toast.error("Failed to update user: " + error.message);
    }
  };

  const downloadTemplate = () => {
    // Create sample data for template
    const templateData = [
      { Name: 'John Doe', Email: 'john.doe@example.com' },
      { Name: 'Jane Smith', Email: 'jane.smith@example.com' },
      { Name: 'Bob Johnson', Email: 'bob.johnson@example.com' }
    ];

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate Excel file
    XLSX.writeFile(workbook, 'user_import_template.xlsx');
    toast.success('Template downloaded successfully!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Extract name and email from Excel
        const users = jsonData.map((row: any, index: number) => {
          // Try different possible column names
          const name = row['Name'] || row['name'] || row['NAME'] || row['Student Name'] || row['Full Name'] || '';
          const email = row['Email'] || row['email'] || row['EMAIL'] || row['Email ID'] || row['Email Address'] || '';

          return {
            id: index + 1,
            name: name.toString().trim(),
            email: email.toString().trim().toLowerCase(),
            role: 'student' // Default role
          };
        }).filter((user: any) => user.name && user.email); // Filter out empty rows

        if (users.length === 0) {
          toast.error("No valid users found in Excel file. Please ensure columns are named 'Name' and 'Email'");
          return;
        }

        setImportedUsers(users);
        setShowImportDialog(true);
        toast.success(`Found ${users.length} users in Excel file`);
      } catch (error: any) {
        toast.error("Failed to read Excel file: " + error.message);
      }
    };
    reader.readAsBinaryString(file);

    // Reset file input
    e.target.value = '';
  };

  const handleBulkCreateUsers = async () => {
    if (importedUsers.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const user of importedUsers) {
        try {
          const userData: any = {
            name: user.name,
            email: user.email,
            role: user.role
          };

          const response = await api.addUser(userData);
          if (response.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${user.name}: ${response.message || 'Failed'}`);
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${user.name}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} user(s)!`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} user(s). Check console for details.`);
        console.error('Import errors:', errors);
      }

      setShowImportDialog(false);
      setImportedUsers([]);
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to create users: " + error.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success("User deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        throw new Error(data.message || 'Failed to delete user');
      }
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
    }
  };

  const handleToggleInterviewer = async (user: any) => {
    try {
      const response = await api.toggleInterviewer(user.id);
      if (response.success) {
        toast.success(response.message);
        // Update local state immediately
        setUsers((prev: any[]) => prev.map((u: any) =>
          u.id === user.id ? { ...u, is_interviewer: response.is_interviewer } : u
        ));
      } else {
        toast.error(response.message || 'Failed to toggle interviewer status');
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) return;

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    if (passwordData.newPassword.length < 5) {
      toast.error("Password must be at least 5 characters");
      return;
    }

    // If it's admin resetting their own password, need old password
    const currentUser = auth.getUser();
    const isResettingOwnPassword = currentUser?.id === selectedUser.id;

    if (isResettingOwnPassword && !passwordData.oldPassword) {
      toast.error("Please enter your current password");
      return;
    }

    try {
      // If resetting own password, use change password endpoint
      if (isResettingOwnPassword) {
        const response = await api.changePassword(passwordData.oldPassword, passwordData.newPassword);
        if (response.success) {
          toast.success("Password changed successfully!");
          setShowSetPasswordDialog(false);
          setSelectedUser(null);
          setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
        }
      } else {
        // Admin resetting other user's password - use reset endpoint with new password
        const response = await api.resetUserPassword(selectedUser.id, passwordData.newPassword);
        if (response.success) {
          toast.success("Password set successfully!");
          setShowSetPasswordDialog(false);
          setSelectedUser(null);
          setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
          loadUsers();
        }
      }
    } catch (error: any) {
      toast.error("Failed to set password: " + error.message);
    }
  };


  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'office_bearer': return 'default';
      case 'student': return 'outline';
      default: return 'outline';
    }
  };


  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <div className="flex flex-1">
        <main className="flex-1 w-full bg-background overflow-x-hidden">
          <div className="w-full px-4 md:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <div className="mb-6">

            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="page-title">User Control</h1>
                <p className="page-subtitle border-l-4 border-primary/30 pl-3 mt-2">Manage platform access and permissions</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
                {canEdit && (
                  <>
                    <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-10 px-4 rounded-md font-semibold bg-primary text-sm">
                      <Plus className="w-4 h-4" />
                      Add User
                    </Button>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <Button onClick={downloadTemplate} variant="outline" className="flex-1 sm:flex-none gap-2 h-10 rounded-md font-semibold text-sm px-4">
                        <Upload className="w-4 h-4" />
                        Template
                      </Button>
                      <Button onClick={() => setShowImportDialog(true)} variant="outline" className="flex-1 sm:flex-none gap-2 h-10 rounded-md font-semibold text-sm px-4">
                        <Upload className="w-4 h-4" />
                        Import Users
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Filter Section - Standardized */}
            <Card className="border-border/40 mb-8 bg-card shadow-sm rounded-md overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 flex-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-md bg-background border-border text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Filter by Role
                    </Label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full h-10 rounded-md bg-background border-border text-foreground">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        <SelectItem value="all" className="text-foreground">All Roles</SelectItem>
                        <SelectItem value="admin" className="text-foreground">Admin</SelectItem>
                        <SelectItem value="office_bearer" className="text-foreground">Office Bearer</SelectItem>
                        <SelectItem value="student" className="text-foreground">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users Grid - Cards Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {loading ? (
                <div className="col-span-full text-center py-8">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                filteredUsers.map((user) => (
                  <Card key={user.id} className="group relative overflow-hidden rounded-3xl border-border/40 bg-card/60 backdrop-blur-md shadow-md hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 flex flex-col">
                    <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 blur-xl ${user.role === 'admin' ? 'bg-red-500' : user.role === 'office_bearer' ? 'bg-primary' : 'bg-slate-400'}`} />
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${user.role === 'admin' ? 'bg-red-500' : user.role === 'office_bearer' ? 'bg-primary' : 'bg-slate-400'}`} />

                    <CardHeader className="pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <CardTitle className="card-title uppercase tracking-tight truncate leading-tight mb-1" title={user.name}>{user.name}</CardTitle>
                          <CardDescription className="body-text-sm truncate tracking-wide" title={user.email}>{user.email}</CardDescription>
                        </div>
                        <Badge variant={getRoleBadgeColor(user.role)} className="shrink-0 font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 h-5">
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-col flex-1 justify-end">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowSetPasswordDialog(true);
                          }}
                          className="h-8 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 hover:bg-primary/5 hover:text-primary transition-all gap-1.5"
                        >
                          <Key className="w-3 h-3" />
                          Password
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowResetDialog(true);
                          }}
                          className="h-8 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 hover:bg-orange-500/10 hover:text-orange-500 transition-all gap-1.5"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reset
                        </Button>
                        {/* Interviewer toggle */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleInterviewer(user)}
                          title={user.is_interviewer ? 'Remove from interviewers' : 'Mark as interviewer'}
                          className={`h-8 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all gap-1.5 ${user.is_interviewer
                              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-500 hover:bg-cyan-500/25'
                              : 'hover:bg-cyan-500/10 hover:text-cyan-500 hover:border-cyan-500/50'
                            }`}
                        >
                          🎤 {user.is_interviewer ? 'Interviewer ✓' : 'Interviewer'}
                        </Button>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-border/50 mt-auto">
                        {canEdit && (
                          <>
                            <Button
                              onClick={() => {
                                setSelectedUser(user);
                                setFormData({
                                  name: user.name,
                                  email: user.email,
                                  role: user.role,
                                  password: ""
                                });
                                setShowEditDialog(true);
                              }}
                              className="flex-1 h-9 rounded-xl font-black text-[10px] uppercase tracking-widest bg-primary hover:bg-primary/90 transition-all"
                            >
                              Edit Profile
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteDialog(true);
                              }}
                              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. Default password will be assigned based on role.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="office_bearer">Office Bearer</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave empty for default password"
              />
              <p className="text-xs text-muted-foreground">
                Default passwords: Admin (12345), Office Bearer (OB@123), Student (SMV@123)
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setShowAddDialog(false);
                setFormData({ name: "", email: "", role: "student", password: "" });
              }}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              {selectedUser && auth.getUser()?.id === selectedUser.id
                ? "Change your password. Enter your current password and new password."
                : `Set password for ${selectedUser?.name}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetPassword} className="space-y-4 mt-4">
            {selectedUser && auth.getUser()?.id === selectedUser.id && (
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Current Password *</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  required
                  placeholder="Enter current password"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={5}
                placeholder="Enter new password (min 5 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={5}
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSetPasswordDialog(false);
                  setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Set Password</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset to Default Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Default Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.name} to default password based on role.
              {selectedUser?.role === 'admin' && ' (Default: 12345)'}
              {selectedUser?.role === 'office_bearer' && ' (Default: OB@123)'}
              {selectedUser?.role === 'student' && ' (Default: SMV@123)'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowResetDialog(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword}>Reset to Default</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="office_bearer">Office Bearer</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditDialog(false);
                setSelectedUser(null);
                setFormData({ name: "", email: "", role: "student", password: "" });
              }}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Users Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Users from Excel</DialogTitle>
            <DialogDescription>
              Review and assign roles for imported users. Excel file should have 'Name' and 'Email' columns.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {importedUsers.length === 0 ? (
              <div className="text-center py-8">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-upload"
                />
                <div className="space-y-4">
                  <Label htmlFor="excel-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-8 hover:bg-accent transition-colors">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-semibold">Click to upload Excel file</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Supported formats: .xlsx, .xls
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Excel should have columns: Name, Email
                      </p>
                    </div>
                  </Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="excel-upload"
                  />
                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={downloadTemplate}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Download Excel Template
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Download a sample template with proper column format
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {importedUsers.length} user(s) found. Select role for each user.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportedUsers([]);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-16">S.No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedUsers.map((user, index) => (
                        <TableRow key={user.id}>
                          <TableCell className="text-center">{index + 1}</TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value) => {
                                const updated = [...importedUsers];
                                updated[index].role = value;
                                setImportedUsers(updated);
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="office_bearer">Office Bearer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowImportDialog(false);
                      setImportedUsers([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleBulkCreateUsers}>
                    Create {importedUsers.length} User(s)
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
              {selectedUser?.role === 'admin' && (
                <span className="block mt-2 text-destructive font-semibold">
                  Cannot delete admin users.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={selectedUser?.role === 'admin'}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkUploadModal
        isOpen={showBulkUploadDialog}
        onClose={() => setShowBulkUploadDialog(false)}
        onSuccess={() => loadUsers()}
      />
    </div>
  );
};

export default ManageUsers;
