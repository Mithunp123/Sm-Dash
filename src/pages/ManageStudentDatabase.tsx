import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Edit, Trash2, Search, Plus, ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { usePermissions } from '@/hooks/usePermissions';
import { api } from "@/lib/api";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";

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

const ManageStudentDatabase = () => {
  const navigate = useNavigate();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const userIsAdmin = auth.hasRole('admin');
  const canEdit = userIsAdmin || permissions?.can_manage_student_db || permissions?.can_manage_students;
  const user = auth.getUser();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestPending, setRequestPending] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all"); // Filter by role
  const [filterDept, setFilterDept] = useState("all"); // Filter by department
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
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
  });
  const [addUserData, setAddUserData] = useState({
    name: "",
    email: "",
    role: "student" as "student" | "office_bearer" | "alumni",
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
  });
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // wait for permissions to load
    if (permissionsLoading) return;

    // allow admins or users with student-db/students permission
    const userIsAdmin = auth.hasRole('admin');
    const allowed = userIsAdmin || permissions?.can_manage_student_db || permissions?.can_manage_students;
    if (!allowed) {
      navigate('/admin');
      return;
    }

    // If a role is present in query params, use it as initial filter
    const params = new URLSearchParams(window.location.search || '');
    const roleParam = params.get('role');
    if (roleParam) {
      setFilterRole(roleParam);
    }
    loadData();
  }, [navigate, permissionsLoading, permissions]);
  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      const usersRes = await api.getUsers();
      if (usersRes.success) {
        const users = usersRes.users || [];

        // Fetch profiles for students, office bearers, and alumni
        const usersWithProfiles = await Promise.all(
          users.map(async (u: any) => {
            try {
              let profile = null;
              if (u.role === 'student') {
                const p = await api.getStudentProfile(u.id);
                profile = p.success ? p.profile : null;
              } else if (u.role === 'office_bearer') {
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${u.id}`, {
                  headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                });
                const data = await res.json();
                profile = data.success ? data.profile : null;
              } else if (u.role === 'alumni') {
                // For alumni, try to get profile from unified profiles table
                try {
                  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${u.id}/profile`, {
                    headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                  });
                  const data = await res.json();
                  profile = data.success ? data.profile : null;
                } catch {
                  profile = null;
                }
              }
              return { ...u, profile };
            } catch {
              return { ...u, profile: null };
            }
          })
        );
        
        setAllUsers(usersWithProfiles);
        
        // Extract unique departments
        const depts = Array.from(new Set(
          usersWithProfiles
            .map(u => u.profile?.dept)
            .filter(Boolean) as string[]
        )).sort();
        setDepartments(depts);
      } else {
        setError(usersRes.message || 'Failed to fetch users');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
      toast.error('Failed to load users: ' + (error.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: any) => {
    if (!canEdit) {
      toast.error('You have view-only access; editing is disabled.');
      return;
    }
    setSelectedUser(user);
    setProfileData({
      register_no: user.profile?.register_no || '',
      dept: user.profile?.dept || '',
      year: user.profile?.year || '',
      academic_year: user.profile?.academic_year || '',
      phone: user.profile?.phone || '',
      father_number: user.profile?.father_number || '',
      blood_group: user.profile?.blood_group || '',
      gender: user.profile?.gender || '',
      dob: user.profile?.dob || '',
      address: user.profile?.address || '',
      hosteller_dayscholar: user.profile?.hosteller_dayscholar || ''
    });
    setShowEditDialog(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('You do not have permission to save changes.');
      return;
    }
    if (!selectedUser) return;
    try {
      let res;
      if (selectedUser.role === 'student') {
        res = await api.updateStudentProfile(selectedUser.id, profileData);
      } else if (selectedUser.role === 'office_bearer') {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        res = await response.json();
      } else if (selectedUser.role === 'alumni') {
        // For alumni, update using unified profiles endpoint
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${selectedUser.id}/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        res = await response.json();
      }
      
      if (res?.success) {
        toast.success('Profile updated');
        setShowEditDialog(false);
        setSelectedUser(null);
        loadData();
      }
    } catch (error: any) {
      toast.error('Failed to update profile: ' + (error.message || 'Unknown'));
    }
  };

  const handleDelete = async (user: any) => {
    if (!canEdit) {
      toast.error('You have view-only access; deleting is disabled.');
      return;
    }
    if (!user) return;
    if (!confirm(`Delete user ${user.name}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('User deleted');
        loadData();
      } else {
        throw new Error(data.message || 'Failed');
      }
    } catch (error: any) {
      toast.error('Failed to delete user: ' + (error.message || 'Unknown'));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('You have view-only access; adding users is disabled.');
      return;
    }
    try {
      // First create the user
      const userData: any = {
        name: addUserData.name,
        email: addUserData.email,
        role: addUserData.role
      };

      const response = await api.addUser(userData);
      if (response.success && response.user) {
        const userId = response.user.id;
        
        // Then create/update the profile
        const profileDataToSave = {
          register_no: addUserData.register_no || null,
          dept: addUserData.dept || null,
          year: addUserData.year || null,
          academic_year: addUserData.academic_year || null,
          phone: addUserData.phone || null,
          father_number: addUserData.father_number || null,
          blood_group: addUserData.blood_group || null,
          gender: addUserData.gender || null,
          dob: addUserData.dob || null,
          address: addUserData.address || null,
          hosteller_dayscholar: addUserData.hosteller_dayscholar || null
        };

        let profileRes;
        if (addUserData.role === 'student') {
          profileRes = await api.updateStudentProfile(userId, profileDataToSave);
        } else if (addUserData.role === 'office_bearer') {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${userId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileDataToSave)
          });
          profileRes = await res.json();
        } else if (addUserData.role === 'alumni') {
          // For alumni, use unified profiles endpoint
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${userId}/profile`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${auth.getToken()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileDataToSave)
          });
          profileRes = await res.json();
        }

        if (profileRes?.success) {
          toast.success(`${addUserData.role === 'student' ? 'Student' : addUserData.role === 'office_bearer' ? 'Office Bearer' : 'Alumni'} added successfully!`);
          if (response.defaultPassword) {
            toast.info(`Default password: ${response.defaultPassword}`);
          }
          setShowAddDialog(false);
          setAddUserData({
            name: "",
            email: "",
            role: "student",
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
          });
          loadData();
        } else {
          toast.error('User created but failed to save profile');
        }
      } else {
        throw new Error(response.message || 'Failed to create user');
      }
    } catch (error: any) {
      toast.error('Failed to add user: ' + (error.message || 'Unknown'));
    }
  };

  // Close any edit/add dialogs if the user's edit permission is revoked
  useEffect(() => {
    if (!canEdit) {
      setShowAddDialog(false);
      setShowEditDialog(false);
    }
  }, [canEdit]);

  const submitPermissionRequest = async () => {
    if (!user) return;
    try {
      setRequestPending(true);
      const key = 'can_manage_student_db_edit';
      const res = await api.requestPermission(key, requestMessage);
      if (res && res.success) {
        toast.success('Permission request submitted to admin');
        setRequestDialogOpen(false);
        setRequestMessage('');
      } else {
        throw new Error(res?.message || 'Failed to submit request');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to submit request: ' + (err.message || 'Unknown'));
    } finally {
      setRequestPending(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['S.No', 'Name', 'Email', 'Role', 'Register No', 'Dept', 'Year', 'Academic Year', 'Phone', 'Father Number', 'Blood', 'Gender', 'DOB', 'Hosteller/Dayscholar', 'Address'];
    const rows = filtered.map((u, i) => [
      i + 1,
      u.name,
      u.email,
      u.role,
      u.profile?.register_no || '-',
      u.profile?.dept || '-',
      u.profile?.year || '-',
      u.profile?.academic_year || '-',
      u.profile?.phone || '-',
      u.profile?.father_number || '-',
      u.profile?.blood_group || '-',
      u.profile?.gender || '-',
      u.profile?.dob || '-',
      u.profile?.hosteller_dayscholar || '-',
      u.profile?.address || '-'
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_database_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filtered = allUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) || 
                         u.email.toLowerCase().includes(q) || 
                         (u.profile?.dept || '').toLowerCase().includes(q);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesDept = filterDept === 'all' || u.profile?.dept === filterDept;
    return matchesSearch && matchesRole && matchesDept;
  });

  const roleLabels: Record<string, string> = {
    'admin': 'Admin',
    'student': 'Student',
    'office_bearer': 'Office Bearer',
    'alumni': 'Alumni'
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <ErrorBoundary>
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-primary">User Database</h1>
                  <p className="text-muted-foreground">View, edit, and manage all user records (Students, Office Bearers, Alumni)</p>
                </div>
                  {canEdit ? (
                  <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add User
                  </Button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">View-only access</div>
                      {user?.role === 'office_bearer' && (
                        <>
                          <Button size="sm" onClick={() => setRequestDialogOpen(true)}>Request Edit Access</Button>
                        </>
                      )}
                    </div>
                  )}
              </div>

              {/* Search and Filter Controls */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <Input 
                    id="search"
                    placeholder="Search by name, email, dept..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Filter by Role</Label>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="office_bearer">Office Bearer</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dept">Filter by Department</Label>
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger id="dept">
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => loadData()} variant="outline" className="flex-1">Refresh</Button>
                  <Button onClick={() => handleExportCSV()} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>

            <Card className="gradient-card">
              <CardHeader>
                <CardTitle>Users ({filtered.length})</CardTitle>
                <CardDescription>List of all users and their profile details</CardDescription>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="text-center py-8 text-red-500">
                    {error}
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => loadData()}>
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No users found</div>
                ) : (
                  <div>
                    {!canEdit && (
                      <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded">
                        You have view-only access to the user database. Editing, adding, and deleting users is disabled.
                      </div>
                    )}
                    <div className="overflow-auto max-h-[calc(100vh-350px)] border rounded-lg">
                      <Table>
                      <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="bg-white">S.No</TableHead>
                          <TableHead className="bg-white">Name</TableHead>
                          <TableHead className="bg-white">Email</TableHead>
                          <TableHead className="bg-white">Role</TableHead>
                          <TableHead className="bg-white">Reg No</TableHead>
                          <TableHead className="bg-white">Dept</TableHead>
                          <TableHead className="bg-white">Year</TableHead>
                          <TableHead className="bg-white">Academic Year</TableHead>
                          <TableHead className="bg-white">Phone</TableHead>
                          <TableHead className="bg-white">Father Number</TableHead>
                          <TableHead className="bg-white">Blood</TableHead>
                          <TableHead className="bg-white">Gender</TableHead>
                          <TableHead className="bg-white">DOB</TableHead>
                          <TableHead className="bg-white">Hosteller/Dayscholar</TableHead>
                          <TableHead className="bg-white">Address</TableHead>
                          <TableHead className="text-right bg-white">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((u, i) => (
                          <TableRow key={u.id}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-sm">{u.email}</TableCell>
                            <TableCell><span className="text-xs bg-primary/20 px-2 py-1 rounded">{roleLabels[u.role] || u.role}</span></TableCell>
                            <TableCell>{u.profile?.register_no || '-'}</TableCell>
                            <TableCell>{u.profile?.dept || '-'}</TableCell>
                            <TableCell>{u.profile?.year || '-'}</TableCell>
                            <TableCell>{u.profile?.academic_year || '-'}</TableCell>
                            <TableCell>{u.profile?.phone || '-'}</TableCell>
                            <TableCell>{u.profile?.father_number || '-'}</TableCell>
                            <TableCell>{u.profile?.blood_group || '-'}</TableCell>
                            <TableCell>{u.profile?.gender || '-'}</TableCell>
                            <TableCell>{u.profile?.dob || '-'}</TableCell>
                            <TableCell>{u.profile?.hosteller_dayscholar || '-'}</TableCell>
                            <TableCell className="text-sm">{u.profile?.address || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {canEdit ? (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => handleEdit(u)} className="gap-1">
                                      <Edit className="w-4 h-4" /> Edit
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(u)} className="gap-1">
                                      <Trash2 className="w-4 h-4" /> Delete
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new student, office bearer, or alumni account</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  value={addUserData.name} 
                  onChange={(e) => setAddUserData({ ...addUserData, name: e.target.value })} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email"
                  value={addUserData.email} 
                  onChange={(e) => setAddUserData({ ...addUserData, email: e.target.value })} 
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={addUserData.role} onValueChange={(value: "student" | "office_bearer" | "alumni") => setAddUserData({ ...addUserData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="office_bearer">Office Bearer</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Register No</Label>
                <Input value={addUserData.register_no} onChange={(e) => setAddUserData({ ...addUserData, register_no: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={addUserData.dept || "none"} onValueChange={(val) => setAddUserData({ ...addUserData, dept: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={addUserData.year || "none"} onValueChange={(val) => setAddUserData({ ...addUserData, year: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select year</SelectItem>
                    <SelectItem value="I">I Year</SelectItem>
                    <SelectItem value="II">II Year</SelectItem>
                    <SelectItem value="III">III Year</SelectItem>
                    <SelectItem value="IV">IV Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input value={addUserData.academic_year} onChange={(e) => setAddUserData({ ...addUserData, academic_year: e.target.value })} placeholder="e.g., 2024-2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={addUserData.phone} onChange={(e) => setAddUserData({ ...addUserData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Father Number</Label>
                <Input value={addUserData.father_number} onChange={(e) => setAddUserData({ ...addUserData, father_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DOB</Label>
                <Input type="date" value={addUserData.dob} onChange={(e) => setAddUserData({ ...addUserData, dob: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <select 
                  value={addUserData.gender}
                  onChange={(e) => setAddUserData({ ...addUserData, gender: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <select 
                  value={addUserData.blood_group}
                  onChange={(e) => setAddUserData({ ...addUserData, blood_group: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Hosteller or Dayscholar</Label>
                <select 
                  value={addUserData.hosteller_dayscholar}
                  onChange={(e) => setAddUserData({ ...addUserData, hosteller_dayscholar: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select</option>
                  <option value="Hosteller">Hosteller</option>
                  <option value="Dayscholar">Dayscholar</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={addUserData.address} onChange={(e) => setAddUserData({ ...addUserData, address: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit">Add User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Edit Access Dialog */}
      <UIDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <UIDialogContent className="max-w-lg">
          <UIDialogHeader>
            <UIDialogTitle>Request Edit Access</UIDialogTitle>
          </UIDialogHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Send a short message to the admin explaining why you need edit access.</p>
            <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} className="w-full p-2 border rounded" rows={4} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => submitPermissionRequest()} disabled={requestPending}>{requestPending ? 'Sending...' : 'Send Request'}</Button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>Update profile for {selectedUser?.name} ({roleLabels[selectedUser?.role] || selectedUser?.role})</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Register No</Label>
                <Input value={profileData.register_no} onChange={(e) => setProfileData({ ...profileData, register_no: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={profileData.dept || "none"} onValueChange={(val) => setProfileData({ ...profileData, dept: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={profileData.year || "none"} onValueChange={(val) => setProfileData({ ...profileData, year: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select year</SelectItem>
                    <SelectItem value="I">I Year</SelectItem>
                    <SelectItem value="II">II Year</SelectItem>
                    <SelectItem value="III">III Year</SelectItem>
                    <SelectItem value="IV">IV Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input value={profileData.academic_year} onChange={(e) => setProfileData({ ...profileData, academic_year: e.target.value })} placeholder="e.g., 2024-2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Father Number</Label>
                <Input value={profileData.father_number} onChange={(e) => setProfileData({ ...profileData, father_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DOB</Label>
                <Input type="date" value={profileData.dob} onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <select 
                  value={profileData.gender}
                  onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <select 
                  value={profileData.blood_group}
                  onChange={(e) => setProfileData({ ...profileData, blood_group: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Hosteller or Dayscholar</Label>
                <select 
                  value={profileData.hosteller_dayscholar}
                  onChange={(e) => setProfileData({ ...profileData, hosteller_dayscholar: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select</option>
                  <option value="Hosteller">Hosteller</option>
                  <option value="Dayscholar">Dayscholar</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManageStudentDatabase;
