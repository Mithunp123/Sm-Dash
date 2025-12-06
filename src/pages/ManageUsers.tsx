import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Plus, ArrowLeft, Key, Search, Filter, Edit, Trash2, Upload, Shield } from "lucide-react";
import * as XLSX from 'xlsx';
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [importedUsers, setImportedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [replaceMode, setReplaceMode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "student",
    password: ""
  });

  const [replaceData, setReplaceData] = useState({
    oldEmail: "",
    newName: "",
    newEmail: "",
    newRole: "student",
    newPassword: ""
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('admin')) {
      navigate("/login");
      return;
    }
    loadUsers();
  }, []);

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
          email: formData.email
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

  const handleReplaceUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Find user by old email
    const userToReplace = users.find(u => u.email === replaceData.oldEmail);
    if (!userToReplace) {
      toast.error("User with that email not found");
      return;
    }

    try {
      // Delete the old user
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${userToReplace.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });

      // Create new user with new data
      const newUserData: any = {
        name: replaceData.newName,
        email: replaceData.newEmail,
        role: replaceData.newRole
      };
      
      if (replaceData.newPassword && replaceData.newPassword.trim() !== "") {
        newUserData.password = replaceData.newPassword;
      }

      const response = await api.addUser(newUserData);
      if (response.success) {
        toast.success(`User "${replaceData.oldEmail}" replaced successfully!`);
        if (response.defaultPassword) {
          toast.info(`Default password: ${response.defaultPassword}`);
        }
        setShowReplaceDialog(false);
        setReplaceData({ oldEmail: "", newName: "", newEmail: "", newRole: "student", newPassword: "" });
        loadUsers();
      }
    } catch (error: any) {
      toast.error("Failed to replace user: " + error.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'office_bearer': return 'default';
      case 'student': return 'outline';
      case 'alumni': return 'outline';
      default: return 'outline';
    }
  };

  const handleManagePermissions = (user: any) => {
    const params = new URLSearchParams();
    params.set('userId', user.id.toString());
    if (user.email) {
      params.set('search', user.email);
    } else if (user.name) {
      params.set('search', user.name);
    }
    navigate(`/admin/permissions?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-7xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={downloadTemplate} variant="outline" className="gap-2 bg-white/20 text-white hover:bg-white/30">
                  <Upload className="w-4 h-4" />
                  Download Template
                </Button>
                <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2 bg-white/20 text-white hover:bg-white/30">
                  <Upload className="w-4 h-4" />
                  Import from Excel
                </Button>
                <Button onClick={() => setShowReplaceDialog(true)} variant="outline" className="gap-2 bg-white/20 text-white hover:bg-white/30">
                  Replace User
                </Button>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                  <Plus className="w-4 h-4" />
                  Add User
                </Button>
              </div>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Users</h1>
              <p className="text-lg opacity-90">Add, edit, or remove users</p>
            </div>
          </div>

          {/* Filter Section */}
          <Card className="gradient-card border-border/50 mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="office_bearer">Office Bearer</SelectItem>
                      {/* SPOC role removed */}
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Grid - Cards Layout */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-8">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              users
                .filter((user) => {
                  const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                       user.email.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesRole = roleFilter === "all" || user.role === roleFilter;
                  return matchesSearch && matchesRole;
                })
                .map((user) => (
                <Card key={user.id} className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <Badge variant={getRoleBadgeColor(user.role)}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription>{user.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Created: {new Date(user.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex flex-col gap-2 pt-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
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
                            className="gap-2 flex-1"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                            className="gap-2 flex-1"
                            disabled={user.role === 'admin'}
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowSetPasswordDialog(true);
                            }}
                            className="gap-2 flex-1"
                          >
                            <Key className="w-4 h-4" />
                            Set Password
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetDialog(true);
                            }}
                            className="gap-2 flex-1"
                          >
                            Reset
                          </Button>
                        </div>
                        {(user.role === 'student' || user.role === 'office_bearer' || user.role === 'alumni') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleManagePermissions(user)}
                            className="gap-2 w-full"
                          >
                            <Shield className="w-4 h-4" />
                            Manage Permission
                          </Button>
                        )}
                      </div>
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
                  {/* SPOC role removed */}
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
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
              <Label>Role</Label>
              <Badge variant={getRoleBadgeColor(selectedUser?.role)}>
                {selectedUser?.role?.replace('_', ' ').toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground">Role cannot be changed</p>
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
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedUsers.map((user, index) => (
                        <TableRow key={user.id}>
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
                                {/* SPOC role removed */}
                                <SelectItem value="alumni">Alumni</SelectItem>
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

      {/* Replace User Dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Existing User</DialogTitle>
            <DialogDescription>
              Find an existing user and replace them with new user data
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReplaceUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="oldEmail">Email of User to Replace *</Label>
              <Input
                id="oldEmail"
                type="email"
                value={replaceData.oldEmail}
                onChange={(e) => setReplaceData({ ...replaceData, oldEmail: e.target.value })}
                placeholder="Enter email of user to replace"
                required
              />
              <p className="text-xs text-muted-foreground">
                The old user account will be deleted
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-4">New User Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="newName">New Name *</Label>
                <Input
                  id="newName"
                  value={replaceData.newName}
                  onChange={(e) => setReplaceData({ ...replaceData, newName: e.target.value })}
                  placeholder="Enter new name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email *</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={replaceData.newEmail}
                  onChange={(e) => setReplaceData({ ...replaceData, newEmail: e.target.value })}
                  placeholder="Enter new email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newRole">New Role *</Label>
                <Select 
                  value={replaceData.newRole} 
                  onValueChange={(value) => setReplaceData({ ...replaceData, newRole: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="office_bearer">Office Bearer</SelectItem>
                    {/* SPOC role removed */}
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password (Optional)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={replaceData.newPassword}
                  onChange={(e) => setReplaceData({ ...replaceData, newPassword: e.target.value })}
                  placeholder="Leave empty for default password"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowReplaceDialog(false);
                  setReplaceData({ oldEmail: "", newName: "", newEmail: "", newRole: "student", newPassword: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Replace User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManageUsers;

